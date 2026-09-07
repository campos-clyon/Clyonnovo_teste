# A conta de assistente

Duas contas entram em `clyon.pt/admin/login`: o **administrador**, que vê
tudo, e o **assistente**, que tem um painel só dele.

## O que o assistente vê

Até cinco secções — as que o administrador lhe der:

| Secção | O que faz lá |
|---|---|
| Pedidos | a fila do site: abrir, aceitar, aprovar, pedir informação, agendar, arquivar |
| Profissionais | inscritos, aprovação, guia de transporte, convites |
| Negociações | a mesa dos pedidos da plataforma: propor, aceitar, redistribuir, promover |
| Agenda | os trabalhos marcados |
| WhatsApp | o cérebro que fala com os clientes de telefone |

Nunca vê Início, App CLYON, Leads, Contas, Suporte, Carteiras, Levantamentos,
Acesso aos testes, Assistentes nem Configs. **Não apaga nada** — pedidos,
profissionais ou negociações. Arquiva.

O painel dele está em `/admin/assistente`. Se escrever `/admin` à mão, o
middleware devolve-o lá. No rodapé da barra lateral vê os seus números:
quantos trabalhos concluiu e quantos tem em curso.

## Como se gere

Só o administrador, na secção **Gerir → Assistentes** do painel dele:

- **Criar**: nome (maiúsculas, sem espaços), palavra-passe (8+, com letra e
  número), as secções que a conta vê, e a percentagem de comissão. A
  palavra-passe entrega-se à pessoa por fora; o sistema guarda o hash e nunca
  a volta a mostrar.
- **Gerir** (em cada conta): mudar as secções, mudar a comissão, repor a
  palavra-passe, desactivar e reactivar. As secções valem na chamada seguinte
  que a pessoa fizer, sem sair e entrar. Desactivar fecha a porta no acto.
  O registo fica; não se apagam pessoas.
- **Comissão da CLYON**: a percentagem comum a todas as contas, no topo da
  secção. Por omissão 11 % — a taxa total da plataforma (6 % ao cliente +
  5 % ao profissional, `taxas-plataforma.ts`).

## Os trabalhos e a comissão

Um trabalho é do assistente em `simulatorOrders.assignedToId`: quem carregou
em **Aceitar pedido**, ou quem foi o primeiro a agir num pedido sem
responsável — aprovar, pedir informação, agendar, enviar aos profissionais,
negociar, corrigir o valor, registar o pedido. O administrador nunca é
atribuído por esta via.

Por conta, o painel mostra: **concluídos** (`status = concluido`), **em
curso** (tudo o que ainda mexe), **cancelados** (cancelado ou rejeitado) e
**arquivados**.

A comissão de um trabalho concluído:

```
valor  = valorAcordado da negociação confirmada
         (senão precoFinal, senão estimateTotal)
CLYON  = valor × comissão da CLYON (11 %)
conta  = CLYON × comissão da conta (40 % por omissão)
```

As duas percentagens são editáveis e o cálculo é sempre feito com as que
estão em vigor — o que já foi pago é responsabilidade de quem pagou.

## Onde vive

Na tabela `colaboradores` do MySQL (Railway), a mesma do administrador:
`funcao = 'assistente'`, `isAdmin = 0`, `active = 1`, `seccoesJson` com a
lista de secções (NULL = todas), `commissionPercent` com a percentagem. A
percentagem da CLYON está em `painelConfig` (`comissao_clyon_percent`). Não
toca no Supabase, por isso não há nota para a app.

## Como está trancado

Três camadas, todas a ler a mesma lista em `src/lib/papel-do-painel.ts`:

1. **Middleware** — que páginas de `/admin` abre e que chamadas a `/api/admin`
   e `/api/colaboradores` passam, pela lista geral do papel. Corre no edge,
   sem base de dados, por isso não conhece as secções de cada conta.
2. **`requireAdmin`** (`src/lib/admin-auth-helper.ts`) — dentro de cada rota.
   Para o assistente lê a conta na base: tem de estar activa e ter uma das
   secções que abrem a rota (`seccoesQueAbrem`). `requireAdminGeral` é a
   variante "só administrador", usada na gestão de assistentes.
3. **Painel** — pede `/api/admin/sessao/eu` ao abrir e só desenha as secções
   que vieram; não aceita `?section=` fora delas.

Nenhum `DELETE` passa a um assistente, em rota nenhuma; e
`POST /api/admin/negociacoes/apagar` está fechado à parte.

O token JWT leva `papel: "assistente"` com `isAdmin: 0`. Tokens antigos de
administrador, sem `papel`, continuam a valer: `isAdmin: 1` manda.

## Se for preciso alargar

Acrescentar a secção a `SECCOES_DO_ASSISTENTE`, o rótulo a
`ROTULO_DA_SECCAO`, a rota a `PREFIXOS_DE_API_DO_ASSISTENTE` e a ligação
rota → secção a `SECCOES_QUE_ABREM`, tudo no mesmo ficheiro. Os testes em
`papel-do-painel.test.ts` dizem o que está aberto e o que está fechado —
actualizar primeiro o teste.
