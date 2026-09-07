# A conta de assistente

Duas contas entram em `clyon.pt/admin/login`: o **administrador**, que vê
tudo, e o **assistente**, que tem um painel só dele.

## O que o assistente vê

Cinco secções, e nada mais:

| Secção | O que faz lá |
|---|---|
| Pedidos | a fila do site: abrir, aceitar, aprovar, pedir informação, agendar, arquivar |
| Profissionais | inscritos, aprovação, guia de transporte, convites |
| Negociações | a mesa dos pedidos da plataforma: propor, aceitar, redistribuir, promover |
| Agenda | os trabalhos marcados |
| WhatsApp | o cérebro que fala com os clientes de telefone |

Não vê Início, App CLYON, Leads, Contas, Suporte, Carteiras, Levantamentos,
Acesso aos testes, Assistentes nem Configs. **Não apaga nada** — pedidos,
profissionais ou negociações. Arquiva.

O painel dele está em `/admin/assistente`. Se escrever `/admin` à mão, o
middleware devolve-o lá.

## Como se gere

Só o administrador, na secção **Gerir → Assistentes** do painel dele:

- **Criar**: nome (maiúsculas, sem espaços) e palavra-passe (8+, com letra e
  número). A palavra-passe entrega-se à pessoa por fora; o sistema guarda o
  hash e nunca a volta a mostrar.
- **Repor senha**: quando a pessoa a esquece.
- **Desactivar / Reactivar**: desactivar fecha a porta no acto — a chamada
  seguinte que a pessoa fizer responde 401 e o painel volta ao login. O
  registo fica; não se apagam pessoas.

## Onde vive

Na tabela `colaboradores` do MySQL (Railway), a mesma do administrador:
`funcao = 'assistente'`, `isAdmin = 0`, `active = 1`. Não toca no Supabase,
por isso não há nota para a app.

## Como está trancado

Três camadas, todas a ler a mesma lista em `src/lib/papel-do-painel.ts`:

1. **Middleware** — que páginas de `/admin` abre e que chamadas a `/api/admin`
   e `/api/colaboradores` passam. Um assistente fora da lista leva 403 antes
   de a rota correr.
2. **`requireAdmin`** (`src/lib/admin-auth-helper.ts`) — dentro de cada rota.
   Para o assistente verifica o caminho e o método outra vez, e confirma na
   base que a conta continua activa. `requireAdminGeral` é a variante "só
   administrador", usada na gestão de assistentes.
3. **Painel** — só desenha as secções do papel, e não aceita `?section=` fora
   delas.

Nenhum `DELETE` passa a um assistente, em rota nenhuma; e
`POST /api/admin/negociacoes/apagar` está fechado à parte.

O token JWT leva `papel: "assistente"` com `isAdmin: 0`. Tokens antigos de
administrador, sem `papel`, continuam a valer: `isAdmin: 1` manda.

## Se for preciso alargar

Acrescentar a secção a `SECCOES_DO_ASSISTENTE` e a rota a
`PREFIXOS_DE_API_DO_ASSISTENTE`, no mesmo ficheiro. Os testes em
`papel-do-painel.test.ts` dizem o que está aberto e o que está fechado —
actualizar primeiro o teste.
