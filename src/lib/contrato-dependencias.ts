/**
 * O que o site precisa que exista na base.
 *
 * O site e a app partilham uma única base Supabase, e o dono do esquema é o
 * CLYON Bridge. Isso funciona — o que faltava era o site declarar aquilo de
 * que depende. Enquanto essa lista viveu só dentro do código, três coisas
 * aconteceram e voltariam a acontecer:
 *
 *   · o painel juntava `partner_profiles.id` a um id de utilizador, e a lista
 *     de profissionais aparecia sem serviços nem documentos;
 *   · a lista da visão geral lia `profiles.name`, campo que não existe, e
 *     mostrava um traço em vez do cliente;
 *   · uma função nova chegou descrita por posição, e o PostgREST só chama por
 *     nome — foi preciso ir ao `pg_proc` descobrir como se chamavam.
 *
 * Nada disto dá erro de compilação nem falha nos testes: falha em produção,
 * em silêncio, a mostrar um traço. Esta lista existe para que uma migração do
 * lado da app seja detectada aqui em segundos, em vez de num screenshot.
 *
 * Como se usa: `npm run contrato:sql` imprime uma consulta. Corre-a no SQL
 * editor do Supabase e o resultado diz, linha a linha, o que falta.
 */

export type Dependencia = {
  /** Tabela, vista ou função. */
  nome: string;
  tipo: "tabela" | "vista" | "funcao";
  /** Colunas que o site lê ou escreve pelo nome. */
  colunas?: string[];
  /** Argumentos da função, na ordem — o PostgREST chama-os por nome. */
  argumentos?: string[];
  /** Onde parte se isto desaparecer. Escrito para quem lê o resultado. */
  usadoEm: string;
};

export const DEPENDENCIAS: Dependencia[] = [
  {
    nome: "service_requests",
    tipo: "tabela",
    colunas: [
      "id", "status", "urgency", "details", "notes", "city", "region",
      "customer_id", "category_slug", "scheduled_for", "created_at",
      // Motor de preços (§3.1): sem estas, o painel conta 0 € em silêncio
      "estimated_price", "final_price", "estimate_min", "estimate_max", "price_status",
    ],
    usadoEm: "Todo o painel de pedidos, agenda, visão geral e métricas",
  },
  {
    nome: "profiles",
    tipo: "tabela",
    // full_name, não `name` — este engano deixou a visão geral sem clientes
    colunas: ["id", "full_name", "email", "phone"],
    usadoEm: "Nome do cliente em pedidos, agenda, visão geral e contas",
  },
  {
    nome: "partner_profiles",
    tipo: "tabela",
    // `id` é a chave do parceiro; `user_id` aponta a profiles.id. Trocá-los
    // não dá erro — devolve zero linhas, e o painel parece vazio.
    colunas: [
      "id", "user_id", "trade_name", "legal_name", "kind", "status", "tier",
      "trust_score", "earning_share", "jobs_completed", "is_system",
    ],
    usadoEm: "Profissionais: perfil, verificação, condições comerciais",
  },
  { nome: "partner_documents", tipo: "tabela", colunas: ["id", "partner_id", "doc_type", "status"], usadoEm: "Verificação e distintivo do profissional" },
  { nome: "partner_services", tipo: "tabela", colunas: ["partner_id", "category_slug", "is_active"], usadoEm: "Elegibilidade do profissional por categoria" },
  // reviews não tem partner_id: chega-se ao parceiro por booking_id → bookings
  { nome: "reviews", tipo: "tabela", colunas: ["id", "booking_id", "rating"], usadoEm: "Avaliações no perfil do profissional" },
  { nome: "bookings", tipo: "tabela", colunas: ["id", "request_id", "partner_id", "status", "reservation_status"], usadoEm: "Reservas; bloqueiam a publicação de um pedido" },
  { nome: "job_offers", tipo: "tabela", colunas: ["id", "request_id", "status"], usadoEm: "Saber se um pedido chegou mesmo aos profissionais" },
  { nome: "service_categories", tipo: "tabela", colunas: ["slug", "name", "icon", "active"], usadoEm: "Catálogo de serviços e nome da categoria em todo o painel" },
  { nome: "service_request_ops", tipo: "tabela", colunas: ["id", "request_id", "action_type", "status_from", "status_to", "reason", "note", "colab_nome", "created_at"], usadoEm: "Histórico e auditoria de operações" },
  { nome: "request_events", tipo: "tabela", colunas: ["id", "request_id", "event_type", "actor_role", "note", "created_at"], usadoEm: "Eventos do sistema no histórico do pedido" },
  { nome: "admin_audit_log", tipo: "tabela", colunas: ["action", "entity_type", "entity_id", "old_value", "new_value", "reason"], usadoEm: "Rasto de quem confirmou dinheiro e quem eliminou pedidos" },
  { nome: "payment_references", tipo: "tabela", colunas: ["reference", "method", "amount", "paid_at", "confirmed_by_staff", "provider", "expires_at", "reminded_at"], usadoEm: "Conciliação de pagamentos" },
  { nome: "payment_reconciliation", tipo: "vista", colunas: ["reference", "valor_esperado", "valor_recebido", "diferenca", "conciliada", "confirmado_por", "estado_do_pedido"], usadoEm: "Ecrã de conciliação — a lista inteira" },
  { nome: "payments", tipo: "tabela", colunas: ["id", "request_id", "status", "amount"], usadoEm: "Relatório de pagamentos" },
  { nome: "manual_payments", tipo: "tabela", colunas: ["id", "amount", "internal_note"], usadoEm: "Pagamentos registados à mão" },
  { nome: "professional_earnings", tipo: "tabela", colunas: ["id", "partner_id", "gross_amount", "partner_share_pct", "partner_amount", "status"], usadoEm: "Quanto há a pagar a profissionais" },
  { nome: "credit_fee_rules", tipo: "tabela", colunas: ["id", "fee_credits", "is_active"], usadoEm: "Bandas de custo por trabalho aceite" },
  { nome: "price_proposals", tipo: "tabela", colunas: ["id", "request_id", "amount", "status"], usadoEm: "Negociação de preço" },
  { nome: "schedule_proposals", tipo: "tabela", colunas: ["id", "request_id", "status"], usadoEm: "Propostas de horário" },
  { nome: "service_adjustments", tipo: "tabela", colunas: ["id", "request_id", "amount_delta"], usadoEm: "Ajustes no local — a soma usa amount_delta" },
  { nome: "pricing_outcomes", tipo: "tabela", colunas: ["id", "request_id"], usadoEm: "Calibração do motor de preços" },
  { nome: "quote_engine_trace", tipo: "tabela", colunas: ["id", "request_id"], usadoEm: "Diagnóstico do motor" },
  { nome: "price_quotes", tipo: "tabela", colunas: ["id", "request_id"], usadoEm: "Orçamentos do motor" },
  { nome: "cupons", tipo: "tabela", colunas: ["id", "code", "is_active"], usadoEm: "Separador de cupões: lista, criação e activação" },
  { nome: "user_roles", tipo: "tabela", colunas: ["user_id", "role"], usadoEm: "Papéis de utilizador" },

  // ── Funções ──────────────────────────────────────────────────────────────
  // Os nomes dos argumentos fazem parte do contrato: o PostgREST envia JSON e
  // um argumento renomeado é um 404, não um aviso.
  {
    nome: "painel_confirmar_pagamento",
    tipo: "funcao",
    argumentos: ["_reference", "_staff", "_amount", "_paid_at", "_notes"],
    usadoEm: "Confirmar um pagamento — é o que publica o pedido aos profissionais",
  },
  { nome: "processa_reservas_por_pagar", tipo: "funcao", argumentos: [], usadoEm: "Botão de processar prazos das reservas por pagar" },
  { nome: "patch_request_with_audit", tipo: "funcao", usadoEm: "Alterar um pedido deixando rasto" },
  { nome: "admin_send_price_proposal", tipo: "funcao", usadoEm: "Enviar proposta de preço ao cliente" },
  { nome: "admin_accept_counter_proposal", tipo: "funcao", usadoEm: "Aceitar a contraproposta do cliente" },
];

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

/**
 * Gera uma consulta que devolve uma linha por dependência, com veredicto.
 *
 * É SÓ leitura, de catálogos do sistema — não toca em dados nem em esquema, e
 * pode correr em produção sem risco. Devolve texto para ser colado no SQL
 * editor: o painel não tem credenciais Supabase locais, e este caminho não
 * precisa de nenhuma.
 */
export function gerarSqlVerificacao(deps: Dependencia[] = DEPENDENCIAS): string {
  const relacoes = deps.filter((d) => d.tipo !== "funcao");
  const funcoes = deps.filter((d) => d.tipo === "funcao");

  const linhasRelacoes = relacoes.map((d) => {
    const cols = d.colunas ?? [];
    const lista = cols.length > 0 ? `ARRAY[${cols.map(q).join(",")}]` : "ARRAY[]::text[]";
    return `  (${q(d.nome)}, ${q(d.tipo)}, ${lista}, ${q(d.usadoEm)})`;
  }).join(",\n");

  const linhasFuncoes = funcoes.map((d) => {
    const args = d.argumentos ?? [];
    const lista = args.length > 0 ? `ARRAY[${args.map(q).join(",")}]` : "ARRAY[]::text[]";
    return `  (${q(d.nome)}, ${lista}, ${q(d.usadoEm)})`;
  }).join(",\n");

  return `-- Contrato do site CLYON — o que o painel precisa que exista.
-- Gerado por: npm run contrato:sql
-- Só lê catálogos do sistema. Não altera nada; pode correr em produção.

WITH esperado(nome, tipo, colunas, usado_em) AS (VALUES
${linhasRelacoes}
),
relacoes AS (
  SELECT
    e.nome,
    e.tipo,
    e.usado_em,
    EXISTS (
      SELECT 1 FROM information_schema.tables t
       WHERE t.table_schema = 'public' AND t.table_name = e.nome
    ) AS existe,
    ARRAY(
      SELECT c FROM unnest(e.colunas) AS c
       WHERE NOT EXISTS (
         SELECT 1 FROM information_schema.columns ic
          WHERE ic.table_schema = 'public'
            AND ic.table_name = e.nome
            AND ic.column_name = c
       )
    ) AS colunas_em_falta
  FROM esperado e
),
esperado_fn(nome, argumentos, usado_em) AS (VALUES
${linhasFuncoes}
),
funcoes AS (
  SELECT
    f.nome,
    'funcao'::text AS tipo,
    f.usado_em,
    EXISTS (
      SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = f.nome
    ) AS existe,
    -- Um argumento renomeado parte a chamada tal como um que desapareça
    ARRAY(
      SELECT a FROM unnest(f.argumentos) AS a
       WHERE NOT EXISTS (
         SELECT 1 FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = f.nome
            AND a = ANY (COALESCE(p.proargnames, ARRAY[]::text[]))
       )
    ) AS colunas_em_falta
  FROM esperado_fn f
)
SELECT
  CASE WHEN NOT existe THEN '✗ NÃO EXISTE'
       WHEN array_length(colunas_em_falta, 1) > 0 THEN '⚠ INCOMPLETO'
       ELSE '✓' END                                   AS veredicto,
  tipo,
  nome,
  COALESCE(array_to_string(colunas_em_falta, ', '), '') AS em_falta,
  usado_em
FROM (SELECT * FROM relacoes UNION ALL SELECT * FROM funcoes) tudo
-- O que está partido primeiro; o resto por ordem alfabética
ORDER BY (CASE WHEN NOT existe THEN 0
               WHEN array_length(colunas_em_falta, 1) > 0 THEN 1
               ELSE 2 END), nome;
`;
}
