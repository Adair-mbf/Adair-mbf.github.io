# StudyFlow — Planejador Inteligente de Estudos

Projeto do **Grupo 7 — Planejamento de estudos**.

## Rodar localmente

1. Abra a pasta `studyflow` no Visual Studio Code.
2. Instale a extensão **Live Server** (opcional, mas recomendada).
3. Clique com o botão direito em `index.html` e selecione **Open with Live Server**.
4. Alternativa sem extensão: abra `index.html` diretamente no navegador (duplo clique).

Não é necessário instalar Node.js, bibliotecas, bancos de dados ou criar conta.

## Funcionalidades

- Cadastro e exclusão de avaliações (nome, data, dificuldade e domínio).
- Definição das horas disponíveis em cada dia da semana.
- Geração automática de cronograma, priorizando urgência, dificuldade e domínio.
- Limite de horas respeitado; não agenda estudo a partir da data da prova.
- Marcação de sessões concluídas e indicador de progresso.
- Armazenamento local (`localStorage`): permanece após atualizar a página no mesmo navegador.
- Exemplo pronto para testar, responsividade e explicação da priorização.

## Publicar no GitHub Pages

Envie `index.html`, `style.css` e `script.js` para a **raiz do repositório**. No GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → main / (root) → Save**. Depois de publicar, o site aparecerá em um endereço semelhante a `https://usuario.github.io/repositorio/`.

## Como o algoritmo funciona

Para cada dia, a aplicação seleciona matérias cuja prova ainda não ocorreu, considerando a disponibilidade daquela data. Ela distribui blocos de até 25 minutos. O peso da matéria depende de: (a) dias restantes para a prova; (b) dificuldade informada; (c) domínio informado. A pontuação é reduzida conforme a matéria recebe blocos no mesmo dia, permitindo alternância.

**Limites conscientes:** não existe login nem sincronização entre dispositivos; o plano cobre até 60 dias de antecedência; as horas são **duração** e não horários reais do relógio; não há integração com uma API de IA. O uso de IA foi no auxílio ao desenvolvimento do código.

## Sugestões de teste

1. Cadastre uma prova para amanhã e outra para daqui a duas semanas. A mais urgente deve concentrar mais estudo.
2. Altere um dia para 0h. Não deve aparecer nenhuma sessão nesse dia.
3. Marque uma sessão como concluída e atualize a página. O progresso deve continuar salvo.
4. Teste a aplicação no celular e no computador.
5. Adicione uma avaliação com texto contendo `<` ou `&`. Ela deve aparecer como texto, sem quebrar a página.
