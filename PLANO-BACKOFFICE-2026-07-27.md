# Plano do backoffice — reanálise do plano Manus contra o código real

> **📖 DOCUMENTO PARA LER E DECIDIR — não há nada aqui para executar.**
> Os blocos SQL estão marcados individualmente.
>
> Reanálise de 27-07-2026 do plano produzido pela Manus (arquitetura-alvo +
> plano de evolução + auditoria visual), confrontado com o código em
> `nova clyon`, o `CONTRATO.md` e o histórico de commits.

---

## 1. Veredicto

O plano da Manus está **certo no método e desatualizado nos factos**. Três
problemas de encaixe, por ordem de gravidade:

1. **Audita um painel que já não existe.** As capturas são anteriores aos
   commits de 24–27 de julho. Cinco dos seus P0/P1 já estão feitos, incluindo o
   crash da agenda que ele classifica como *o* bloqueio.
2. **Não sabe que a CLYON são três sistemas.** Metade das iniciativas —
   máquina de estados, idempotência, eventos imutáveis, versionamento de preço —
   são trabalho na **base de dados**, propriedade do repo Bridge. Escritas como
   tarefas do painel, seriam implementadas no sítio errado e criariam uma
   segunda verdade sobre o mesmo pedido. É exatamente o erro que custou o pedido
   de 240 € invisível durante dias.
3. **Dimensiona para uma equipa de seis e 18 semanas.** É uma pessoa. A
   sequência tem de ser reordenada por "o que parte dinheiro ou confiança
   esta semana", não por ondas paralelas.

O que sobrevive à confrontação é valioso e está na §5. O que ele não podia ver
— e é mais urgente que quase tudo o que propõe — está na §6.

---

## 2. Já está feito (o plano não podia saber)

| Iniciativa do plano | Prioridade que lhe dá | Estado real | Evidência |
|---|---|---|---|
| Recuperar a agenda + fallback em lista | **P0** | Feito. Alternador Calendário/Lista, `vistaInicial` remonta em lista quando o calendário rebenta, datas inválidas já não derrubam a semana | `AppClyonEmbedded.tsx:2081-2126`, commit `0f1667a` |
| Limite de erro por secção | **P0** | Feito | `SecaoErrorBoundary.tsx`, `AdminErrorBoundary.tsx` |
| Central operacional de exceções | **P1** | Feito em parte. A Visão Geral já é fila: próxima ação vinda da máquina de estados, "com o cliente" vs. ação nossa, tempo parado, o mais parado primeiro | `AppClyonEmbedded.tsx:1965-2011`, commit `efba85b` |
| Cruzar capacidade com procura | **P1** | Feito. `unassigned > 0 && partnersActive == 0` gera um aviso com diagnóstico — literalmente o exemplo que o plano dá como o que faltava | `AppClyonEmbedded.tsx:1945-1955` |
| Negociação versionada, máx. 2 contrapropostas | **P1** | Feito na base. `price_proposals`, `customer_counter_proposal`, trigger `trg_valida_publicacao` a rejeitar publicação sem aprovação do cliente | `CONTRATO.md` §2-§4 |
| Finanças / reconciliação | **P2** | Feito em parte. Ecrã de conciliação com confirmação manual, referências, duas taxas, pagamento em dinheiro | commits `e388a36`, `d0f59f0`, `3af2844` |
| Catálogo, cupões, bandas de custo, auditoria | P2 | Ecrãs existem com CRUD real | `TabCatalogo:2867`, `TabCupons:3016`, `CreditFeeRulesSection:3302`, `TabAuditoria:4230` |

E existe uma coisa **melhor** do que o plano propõe e que ele não menciona
porque não é visível numa captura: `src/lib/contrato-dependencias.ts` +
`npm run contrato:sql` declaram as 25 tabelas, 5 funções e os nomes de argumentos
de que o painel depende, e verificam-nos contra o catálogo da base. O plano pede
"observabilidade" e "integridade" em abstrato; isto já apanha a classe de falha
que mais custou aqui — a coluna que mudou de nome e o painel que mostra traços.

---

## 3. Onde não encaixa

### 3.1 A camada errada

O plano escreve, em §5.2 da arquitetura-alvo: *"cada transição deve ser um comando
validado pelo servidor"*, com idempotência, pré-condições e eventos de domínio
imutáveis. Está certo. **Já é assim, e não é no painel.**

O `CONTRATO.md` §1 é explícito: nenhum sistema escreve `service_requests.status`
directamente; tudo passa por RPC; a imposição é um trigger `BEFORE UPDATE`
porque o painel usa `service_role` e ignora RLS. O `order-status-flow.ts` do
painel é uma **cópia derivada** do contrato, para a UI não oferecer botões
ilegais — não é a autoridade.

**Consequência prática:** toda a iniciativa do plano que fale de estados,
transições, eventos, idempotência ou snapshot de preço tem de ser reescrita como
**nota para o Bridge**, não como tarefa do painel. Se for implementada no site,
cria a segunda verdade. Na tabela da §7 cada linha diz a camada.

### 3.2 O obstáculo real não é a navegação

O plano propõe nove espaços de trabalho e uma nova arquitetura de informação.
O que está mesmo no caminho é outra coisa:

| Ficheiro | Linhas |
|---|---|
| `src/components/admin/AppClyonEmbedded.tsx` | 4 470 |
| `src/components/admin/LegacyAdminClient.tsx` | 3 462 |
| `src/components/admin/PedidoDetailModal.tsx` | 3 104 |

**Onze mil linhas em três ficheiros.** As onze secções do painel — visão geral,
pedidos, agenda, profissionais, contas, pagamentos, cupões, moedas, catálogo,
métricas, auditoria — vivem todas dentro do primeiro, como funções `TabX`.

Qualquer item do plano toca num destes três. Redesenhar a navegação é a
intervenção mais barata e a de menor retorno: muda os separadores e deixa os
11 000 linhas intactos. **A decomposição é o que destrava o resto**, e não
aparece no plano em lado nenhum.

### 3.3 Uma pessoa, não seis

O plano prevê Product/Ops, Design/Research, Frontend, Backend/Platform, QA e
apoio de dados, em ondas de 5–6 semanas com trabalho paralelo. Traduzido para a
realidade: as ondas passam a ser sequenciais, e tudo o que exija investigação
com utilizadores, design system ou auditoria WCAG completa sai do caminho
crítico. Não porque não valha — porque não há quem o faça sem parar o resto.

### 3.4 Métricas sem volume

O plano pede quatro semanas de baseline e catorze métricas com fórmula,
denominador e drill-down. Na auditoria de 24-07 a base tinha **18 registos em
`request_events` e um profissional aprovado**. Um funil de conversão calculado
sobre isto é ruído com aparência de gestão.

A métrica que interessa agora é binária e já existe: a consulta de regressão do
`CONTRATO.md` §9 devolve zero linhas quando nenhum pedido está preso e
invisível. Funis quando houver volume que os sustente.

---

## 4. O que o plano acerta e devemos guardar

Estes são reais, confirmados no código, e continuam por fazer:

**Não existe dono do pedido.** Nenhum `owner_id`, `assigned_admin` ou
equivalente em `src/lib` ou nas rotas de API. O plano diz "nenhum pedido crítico
sem responsável" e tem razão — hoje um pedido parado há 3 dias não está parado
*com ninguém*.

**Não existe prazo.** A Visão Geral mostra `horas_a_espera` e marca a amarelo a
partir de 48 h (`AppClyonEmbedded.tsx:1978`). É um bom começo e é um número
único para todos os estados. Um pedido em `awaiting_customer_approval` há 48 h é
normal; em `in_review` há 48 h não é.

**As permissões são um booleano.** `requireAdmin` verifica `colab.isAdmin`, 0 ou
1 (`src/lib/admin-auth-helper.ts:24`). Quem pode ver um pedido pode libertar
dinheiro, alterar preço e arquivar. O RBAC+ABAC com quatro olhos que o plano
propõe é excessivo; **dois níveis e um motivo obrigatório nas ações de dinheiro**
não é.

**As bandas de custo não fazem snapshot.** `CreditFeeRulesSection` tem
"+ Nova banda", "Ativar" e "Desativar" a atuar em produção
(`AppClyonEmbedded.tsx:3302`). O pedido guarda `final_price`, mas o custo que o
profissional pagou por aceitar depende da banda vigente no momento — e essa pode
ser desativada depois. O plano acerta em cheio.

**A separação ação rotineira / exceção / destrutiva.** Guardar nota e eliminar
pedido ao mesmo nível visual é um defeito real, e é barato de corrigir.

**A definição de fila antes de a construir** (§6 do plano de evolução): objetivo,
quem trabalha nela, o que cria um item, prazo, decisão esperada, escalonamento,
evento de fecho. É a melhor ideia do plano inteiro e não custa código nenhum.

---

## 5. O que o plano não vê

Nada disto aparece numa captura de ecrã, e é mais urgente do que quase tudo o que
ele lista. Vem da auditoria à base no `CONTRATO.md` §8:

**Ofertas expiradas que ninguém fecha.** `process_expired_job_offers` existe,
nada a agenda. Uma oferta `pending` já expirada é invisível ao profissional **e**
bloqueia o pedido para os seguintes. Foi a causa do bug de 24-07. Volta a
acontecer sozinho com o tempo. O `pg_cron` já está em uso no projeto para
`clyon_reservas_por_pagar`, portanto o mecanismo existe — falta agendar esta.

**▶️ CORRER NO SQL EDITOR** — confirma se já foi agendada desde 24-07. Só lê.

```sql
SELECT jobname, schedule, command, active
FROM cron.job
ORDER BY jobname;
```

Espera-se ver `clyon_reservas_por_pagar`. Se **não** houver linha nenhuma a
chamar `process_expired_job_offers`, a dívida está aberta — e é P0.

**Histórico de migrações dessincronizado.** 16 migrações remotas sem ficheiro, 6
locais por aplicar. Qualquer `db push` é arriscado. Isto bloqueia *todo* o
trabalho estruturado na base — ou seja, bloqueia metade do plano da Manus antes
de começar. É trabalho do Bridge e tem de vir primeiro.

**A auditoria está vazia por baixo.** `admin_audit_log` com 2 registos:
o painel não escreve lá. `actor_role` frequentemente nulo em `request_events`, e
duas convenções de nomes a coexistir (`status_changed` e `status.<estado>`).

O plano dedica uma secção inteira ao ledger de auditoria e desenha as colunas
certas. Só que o ecrã `TabAuditoria` já existe — **o que falta são os dados**.
Melhorar filtros sobre uma tabela vazia não produz investigação nenhuma. A ordem
é: primeiro escrever os eventos com `actor_role` e nome normalizado (Bridge +
painel), depois a interface de consulta.

---

## 6. O plano reordenado

Cada linha diz **em que sistema se faz**. Onde diz Bridge, o entregável do site é
uma nota escrita, não código.

### Agora — desbloquear (esta semana)

| # | O quê | Camada | Porquê primeiro | Aceite |
|---|---|---|---|---|
| 1 | Agendar `process_expired_job_offers` | **Base** | Reincidente e silencioso; parte a app sozinho | Consulta a `cron.job` mostra a tarefa activa; ofertas expiradas deixam de ficar `pending` |
| 2 | Reconciliar histórico de migrações | **Base** | Bloqueia tudo o que venha a seguir na base | `supabase db diff` limpo; um `db push` deixa de ser um risco |
| 3 | Registar `actor_role` e normalizar nomes de evento | **Base + Painel** | Sem isto a auditoria não serve para investigar | Zero eventos novos com `actor_role` nulo; uma só convenção |

### A seguir — destravar o painel

| # | O quê | Camada | Porquê | Aceite |
|---|---|---|---|---|
| 4 | Extrair as 11 `TabX` de `AppClyonEmbedded` para ficheiros próprios | **Painel** | Habilita todo o resto; hoje qualquer alteração toca num ficheiro de 4 470 linhas | Nenhum ficheiro do painel acima de ~600 linhas; comportamento idêntico |
| 5 | Dono do pedido (`owner_id`) + fila "sem dono" | **Base + Painel** | O melhor item do plano; hoje ninguém é responsável por nada | Um pedido aberto sem dono aparece numa fila; atribuir é uma ação de um clique |
| 6 | Prazo por estado, em vez de 48 h para todos | **Painel** | "Parado" tem significados diferentes por estado | Cada estado tem o seu limite; "com o cliente" não conta como atraso nosso |
| 7 | Separar ação primária / exceção / destrutiva no detalhe | **Painel** | Barato; previne o erro caro | Arquivar/eliminar/libertar fundos deixam de partilhar nível visual com guardar nota |

### Depois — proteger o dinheiro

| # | O quê | Camada | Aceite |
|---|---|---|---|
| 8 | Snapshot da banda de custo no momento em que o profissional aceita | **Base** | Desativar uma banda deixa de alterar o custo de trabalhos já aceites |
| 9 | Segundo nível de permissão + motivo obrigatório nas ações de dinheiro | **Base + Painel** | Libertar valor, alterar preço e reembolsar exigem permissão própria e motivo registado |
| 10 | Fila de exceção "sem capacidade" com dono e idade | **Painel** | A consulta do `CONTRATO.md` §9 vira ecrã: os pedidos sem ninguém disponível têm responsável e antiguidade |

### Por agora não

| O que o plano propõe | Porquê não agora |
|---|---|
| Nove espaços de trabalho, nova navegação global | Move separadores; deixa os 11 000 linhas. Fazer depois do #4, se ainda fizer falta |
| Motor de elegibilidade com ranking explicável | Com um profissional aprovado não há o que ordenar. O trigger já difunde a todos os aprovados |
| Catálogo/preços com rascunho→simulação→aprovação→vigência | Sobre-engenharia para o volume actual. O #8 resolve o risco real |
| Auditoria WCAG 2.2 AA completa | Painel interno, operadores contados. Contraste e foco visível sim, auditoria formal não |
| Catálogo de métricas com 14 fórmulas e baseline de 4 semanas | Sem volume que o sustente. A regressão do §9 é a métrica que interessa |
| Camada de recomendações / automação assistida | O plano diz "só depois de os dados serem fiáveis". Concordo — e ainda não são |

---

## 7. A disciplina a adotar já

Antes de construir qualquer fila nova, escrever sete linhas sobre ela:

1. Objetivo — que decisão fecha
2. Quem trabalha nela
3. Que condição faz entrar um item
4. Prazo, e o que acontece quando passa
5. Decisão esperada
6. Ações permitidas
7. Que evento fecha o item

Sem isto, uma fila é uma lista de estados com outro nome. É a contribuição mais
útil do plano da Manus e não custa uma linha de código.

---

## 8. O que segue para o Bridge

Os pontos **1, 2, 3, 5 e 8** são trabalho na base. Pelo protocolo do
`CONTRATO.md` §10, saem daqui como nota escrita para o projeto do Bridge, com o
que muda, o que o painel passa a precisar, o que a app passa a precisar, e uma
consulta de verificação que devolva zero linhas quando estiver bem.

Escrevo essa nota quando decidires a ordem.
