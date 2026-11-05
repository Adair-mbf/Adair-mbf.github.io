'use strict';

// StudyFlow — aplicação 100% front-end, sem dependências de JavaScript.
const STORAGE_KEY = 'studyflow-v1';
const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DEFAULT_HOURS = [1, 2, 2, 2, 2, 2, 1];
const $ = (selector) => document.querySelector(selector);

function localDate(date = new Date()) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function isoDay(date) { const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0'); return `${y}-${m}-${d}`; }
function parseDay(value) { const [y,m,d] = value.split('-').map(Number); return new Date(y, m - 1, d); }
function plusDays(date, days) { const out = new Date(date); out.setDate(out.getDate() + days); return out; }
function daysUntil(iso, from = localDate()) { return Math.round((parseDay(iso) - from) / 86400000); }
function dateLabel(iso, opts = {day:'2-digit', month:'short'}) { return parseDay(iso).toLocaleDateString('pt-BR',opts); }
function minutesLabel(minutes) { const hours=Math.floor(minutes/60), rem=minutes%60; return hours && rem ? `${hours}h${String(rem).padStart(2,'0')}` : hours ? `${hours}h` : `${rem}min`; }
function safeText(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function uid() { return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.subjects) && Array.isArray(saved.hours) && saved.hours.length === 7) {
      return { subjects: saved.subjects.filter(s => s && typeof s.id === 'string' && typeof s.name === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date)).map(s=>({...s,difficulty:Math.max(1,Math.min(3,Number(s.difficulty)||2)),mastery:Math.max(0,Math.min(100,Number(s.mastery)||0))})), hours: saved.hours.map(h=>Math.max(0,Math.min(12,Number(h)||0))), completed: saved.completed && typeof saved.completed === 'object' ? saved.completed : {}, planGenerated: Boolean(saved.planGenerated) };
    }
  } catch (err) { console.warn('Dados antigos não puderam ser lidos.',err); }
  return {subjects:[],hours:[...DEFAULT_HOURS],completed:{},planGenerated:false};
}
let state = readState();
let plan = [];
let toastTimer;
function saveState(){ try {localStorage.setItem(STORAGE_KEY,JSON.stringify(state));} catch(e) {toast('Não foi possível salvar: o armazenamento do navegador está indisponível.');} }
function toast(message){ const node=$('#toast'); node.textContent=message; node.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>node.classList.remove('show'),3400); }

// Pontuação: urgência (1 a 6), dificuldade (1 a 3) e domínio (0 a 100%).
function priority(subject, today = localDate()) {
  const remaining = daysUntil(subject.date,today);
  if (remaining <= 0) return 0;
  const urgency = 1 + 5 / (1 + remaining / 4);
  const difficulty = Number(subject.difficulty);
  const need = 1.15 - Number(subject.mastery) / 125;
  return urgency * difficulty * need;
}
function priorityKind(subject) { const days=daysUntil(subject.date); if(days<=0) return ['Encerrada','low']; const s=priority(subject); return s>=9 ? ['Alta','high'] : s>=5 ? ['Média','medium'] : ['Baixa','low']; }
function remainingLabel(date) { const d=daysUntil(date); return d<0?'Data passada':d===0?'É hoje':d===1?'Amanhã':`Em ${d} dias`; }

// Distribui todo o tempo elegível por incrementos de até 25 minutos.
// O peso de uma disciplina diminui conforme ela recebe blocos no mesmo dia:
// isso promove variedade sem ignorar prazos e dificuldades.
function buildPlan(today = localDate()) {
  const active = state.subjects.filter(s=>daysUntil(s.date,today)>0);
  if(!active.length) return [];
  const lastExam=Math.max(...active.map(s=>daysUntil(s.date,today)));
  const horizon=Math.min(60,lastExam); // evita gerar milhares de sessões
  const output=[];
  for(let offset=0; offset<horizon; offset++) {
    const date=plusDays(today,offset), key=isoDay(date), minutes=Math.round(state.hours[date.getDay()]*60);
    const eligible=active.filter(s=>parseDay(s.date)>date);
    if(!eligible.length || minutes<=0) continue;
    const assigned = new Map(eligible.map(s=>[s.id,0]));
    const daily=[];
    let available=minutes;
    while(available>0) {
      const chosen=eligible.reduce((best, s) => {
        const score=priority(s,date)/(1+assigned.get(s.id)/50);
        return !best || score>best.score ? {subject:s,score}:best;
      },null);
      if(!chosen) break;
      const block=Math.min(25,available);
      const s=chosen.subject;
      const last=daily[daily.length-1];
      // Agrupa blocos consecutivos da mesma matéria para uma agenda mais legível.
      if(last && last.subjectId===s.id) last.minutes+=block;
      else daily.push({subjectId:s.id,name:s.name,minutes:block,exam:s.date});
      assigned.set(s.id,assigned.get(s.id)+block);
      available-=block;
    }
    daily.forEach((session,index)=>{session.id=`${key}|${session.subjectId}|${index}`;session.date=key;});
    output.push({date:key,sessions:daily,total:minutes});
  }
  return output;
}
function availableForFirstWeek(){ return state.hours.reduce((sum,h)=>sum+h,0); }
function allSessions(){return plan.flatMap(day=>day.sessions);}

function renderAvailability(){
  const list=$('#availability-list');
  list.innerHTML=DAY_NAMES.map((name, index)=>`<div class="time-row"><label for="hours-${index}">${name}</label><select id="hours-${index}" data-day="${index}" aria-label="Horas disponíveis no(a) ${name}">${Array.from({length:13},(_,h)=>`<option value="${h}" ${state.hours[index]===h?'selected':''}>${h}h ${h===0?'(descanso)':''}</option>`).join('')}</select></div>`).join('');
  list.querySelectorAll('select').forEach(select=>select.addEventListener('change',()=>{
    state.hours[Number(select.dataset.day)]=Number(select.value); state.planGenerated=false; state.completed={}; saveState(); renderSummary(); renderPlan(); toast('Disponibilidade atualizada. Gere o plano novamente.');
  }));
  $('#weekly-total').textContent=`${availableForFirstWeek()}h`;
}
function renderSubjects(){
  const sorted=[...state.subjects].sort((a,b)=>a.date.localeCompare(b.date));
  $('#subject-count').textContent=`${sorted.length} ${sorted.length===1?'matéria':'matérias'}`;
  $('#subjects-list').innerHTML=sorted.length?sorted.map(s=>{
    const [label,kind]=priorityKind(s);
    return `<div class="subject-item"><div class="subject-initial">${safeText(s.name.trim().slice(0,1).toUpperCase())}</div><div class="subject-info"><strong>${safeText(s.name)}</strong><small>${dateLabel(s.date)} · ${remainingLabel(s.date)} · Domínio ${s.mastery}%</small></div><span class="priority-tag ${kind}">${label}</span><button class="delete-btn" type="button" data-delete="${safeText(s.id)}" aria-label="Excluir ${safeText(s.name)}" title="Excluir matéria">×</button></div>`;
  }).join(''):'<div class="empty-list">Nenhuma avaliação por aqui ainda. Comece adicionando uma matéria acima.</div>';
  $('#subjects-list').querySelectorAll('[data-delete]').forEach(btn=>btn.addEventListener('click',()=>{
    state.subjects=state.subjects.filter(s=>s.id!==btn.dataset.delete); state.planGenerated=false;state.completed={};saveState();renderSubjects();renderSummary();renderPlan();toast('Avaliação removida. Gere o plano novamente.');
  }));
}
function renderSummary(){
  const active=state.subjects.filter(s=>daysUntil(s.date)>0).sort((a,b)=>a.date.localeCompare(b.date));
  $('#stat-exams').textContent=active.length;
  const nearest=active[0];
  $('#stat-next').textContent=nearest?`${daysUntil(nearest.date)} ${daysUntil(nearest.date)===1?'dia':'dias'}`:'—';
  $('#stat-next-caption').textContent=nearest?nearest.name:'Nenhuma prova futura';
  const sessions=state.planGenerated?allSessions():[];
  const completed=sessions.filter(s=>Boolean(state.completed[s.id])).length;
  $('#stat-done').textContent=sessions.length?`${Math.round(completed/sessions.length*100)}%`:'0%';
  $('#stat-done-caption').textContent=sessions.length?`${completed} de ${sessions.length} sessões concluídas`:'Gere um plano para começar';
}
function renderPlan(){
  const list=$('#schedule-list'), explanation=$('#plan-explanation');
  if(!state.planGenerated){
    explanation.innerHTML='✨ Adicione uma avaliação e defina seu tempo disponível. Depois clique em <strong>Gerar plano</strong>.';
    list.innerHTML='<div class="empty-schedule"><span>▦</span><strong>Seu plano começa aqui</strong><p>Seu cronograma aparecerá quando você gerar o planejamento.</p></div>';
    return;
  }
  if(!plan.length){
    explanation.textContent='Não há sessões para gerar. Confira se existem provas futuras e se há horas disponíveis antes delas.';
    list.innerHTML='<div class="empty-schedule"><strong>Sem sessões disponíveis</strong><p>Adicione provas futuras ou aumente suas horas de estudo.</p></div>';
    return;
  }
  const active=state.subjects.filter(s=>daysUntil(s.date)>0).sort((a,b)=>priority(b)-priority(a));
  const focus=active[0];
  explanation.innerHTML=focus ? `💡 <strong>Por que priorizamos ${safeText(focus.name)}?</strong> Faltam ${daysUntil(focus.date)} dia(s) para a prova; dificuldade ${['','fácil','média','difícil'][focus.difficulty]}; domínio informado de ${focus.mastery}%. A distribuição considera esses três fatores e respeita as horas que você informou.`:'Plano calculado!';
  $('#plan-subtitle').textContent=`${plan.length} dia(s) com sessões planejadas · horizonte máximo de 60 dias`;
  list.innerHTML=plan.map((day,i)=>{
    const title=i===0&&day.date===isoDay(localDate())?'Hoje':dateLabel(day.date,{weekday:'long',day:'2-digit',month:'short'});
    return `<article class="day-card"><div class="day-heading"><strong>${safeText(title)}</strong><small>${minutesLabel(day.total)} planejados</small></div>${day.sessions.map(s=>`<label class="session ${state.completed[s.id]?'completed':''}"><input type="checkbox" data-session="${safeText(s.id)}" ${state.completed[s.id]?'checked':''} /><span class="session-main"><strong>${safeText(s.name)}</strong><small>Prova: ${dateLabel(s.exam)} · ${remainingLabel(s.exam)}</small></span><span class="session-duration">${minutesLabel(s.minutes)}</span></label>`).join('')}</article>`;
  }).join('');
  list.querySelectorAll('[data-session]').forEach(input=>input.addEventListener('change',()=>{
    if(input.checked)state.completed[input.dataset.session]=true;
    else delete state.completed[input.dataset.session];
    input.closest('.session').classList.toggle('completed',input.checked);
    saveState();renderSummary();
  }));
}
function generate(){
  if(!state.subjects.some(s=>daysUntil(s.date)>0)){toast('Adicione pelo menos uma avaliação com data futura.');$('#materias').scrollIntoView({behavior:'smooth'});return;}
  if(state.hours.every(h=>h===0)){toast('Informe pelo menos um dia com tempo disponível.');$('#disponibilidade').scrollIntoView({behavior:'smooth'});return;}
  plan=buildPlan();state.planGenerated=true;
  const ids=new Set(allSessions().map(s=>s.id));
  state.completed=Object.fromEntries(Object.entries(state.completed).filter(([id])=>ids.has(id)));
  saveState();renderSummary();renderPlan();toast(plan.length?'Seu cronograma está pronto!':'Nenhum horário antes das provas. Ajuste seus dados.');
  $('#cronograma').scrollIntoView({behavior:'smooth'});
}
function handleSubmit(event){
  event.preventDefault();
  const name=$('#subject-name').value.trim(), date=$('#subject-date').value;
  if(!name){toast('Digite o nome da matéria.');return;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||daysUntil(date)<=0){toast('Escolha uma data futura para a avaliação.');return;}
  if(state.subjects.length>=30){toast('Limite de 30 avaliações por planejamento.');return;}
  state.subjects.push({id:uid(),name,date,difficulty:Number($('#subject-difficulty').value),mastery:Number($('#subject-mastery').value)});
  state.planGenerated=false;state.completed={};saveState();renderSubjects();renderSummary();renderPlan();
  $('#subject-form').reset();$('#mastery-value').textContent='50%';toast('Avaliação adicionada! Agora você pode gerar o plano.');
}
function loadExample(){
  if(state.subjects.length && !window.confirm('Substituir as avaliações atuais pelos dados de demonstração?'))return;
  const today=localDate();
  state.subjects=[{id:uid(),name:'Estrutura de Dados',date:isoDay(plusDays(today,5)),difficulty:3,mastery:30},{id:uid(),name:'Banco de Dados',date:isoDay(plusDays(today,11)),difficulty:2,mastery:60},{id:uid(),name:'Cálculo',date:isoDay(plusDays(today,17)),difficulty:3,mastery:40}];
  state.hours=[1,2,2,3,2,2,1];state.completed={};state.planGenerated=false;
  saveState();renderAvailability();renderSubjects();generate();toast('Exemplo carregado! Explore as sessões e marque uma como concluída.');
}
function init(){
  const today=localDate();
  $('#today-label').textContent=today.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'});
  $('#subject-date').min=isoDay(plusDays(today,1));
  $('#subject-date').value=isoDay(plusDays(today,7));
  $('#subject-mastery').addEventListener('input',e=>$('#mastery-value').textContent=`${e.target.value}%`);
  $('#subject-form').addEventListener('submit',handleSubmit);
  $('#generate-btn').addEventListener('click',generate);
  $('#example-btn').addEventListener('click',loadExample);
  document.querySelectorAll('[data-nav]').forEach(link=>link.addEventListener('click',()=>{
    document.querySelectorAll('[data-nav]').forEach(n=>n.classList.toggle('active',n===link));
  }));
  if(state.planGenerated)plan=buildPlan();
  renderAvailability();renderSubjects();renderSummary();renderPlan();
}
init();
