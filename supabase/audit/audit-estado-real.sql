-- ═══════════════════════════════════════════════════════════════════════════
-- AUDITORIA DO ESTADO REAL — service_requests e máquina de estados
-- 100% leitura. Executar no SQL Editor do Supabase e guardar cada resultado.
-- Cada secção é uma consulta independente — corre uma de cada vez.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Enum real de request_status (ordem de criação revela os acrescentos) ──
SELECT e.enumsortorder AS ordem, e.enumlabel AS estado
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'request_status'
ORDER BY e.enumsortorder;

-- ── 2. Tipo REAL da coluna status (enum ou texto? constraint CHECK?) ─────────
SELECT c.column_name, c.data_type, c.udt_name,
       (SELECT string_agg(pg_get_constraintdef(con.oid), ' | ')
        FROM pg_constraint con
        WHERE con.conrelid = 'public.service_requests'::regclass
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%status%') AS check_constraints
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.table_name = 'service_requests'
  AND c.column_name = 'status';

-- ── 3. Estados em uso e volumetria (estados órfãos = enum sem linhas) ────────
SELECT status::text, COUNT(*) AS pedidos,
       MIN(created_at) AS primeiro, MAX(created_at) AS ultimo
FROM public.service_requests
GROUP BY 1
ORDER BY 2 DESC;

-- ── 4. Todas as funções que tocam em service_requests (quem escreve?) ────────
SELECT p.proname AS funcao,
       pg_get_function_identity_arguments(p.oid) AS argumentos,
       CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'invoker' END AS seguranca,
       CASE
         WHEN p.prosrc ILIKE '%UPDATE%service_requests%SET%status%' THEN 'ESCREVE STATUS'
         WHEN p.prosrc ILIKE '%UPDATE%service_requests%'            THEN 'escreve outras colunas'
         WHEN p.prosrc ILIKE '%INSERT INTO%service_requests%'       THEN 'INSERE'
         ELSE 'só lê'
       END AS efeito
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosrc ILIKE '%service_requests%'
ORDER BY efeito, funcao;

-- ── 5. Triggers activos em service_requests ──────────────────────────────────
SELECT tgname AS trigger, pg_get_triggerdef(oid) AS definicao
FROM pg_trigger
WHERE tgrelid = 'public.service_requests'::regclass
  AND NOT tgisinternal;

-- ── 6. Views que dependem de service_requests (contratos de leitura) ─────────
SELECT DISTINCT dependent.relname AS vista
FROM pg_depend d
JOIN pg_rewrite r ON r.oid = d.objid
JOIN pg_class dependent ON dependent.oid = r.ev_class
JOIN pg_class source ON source.oid = d.refobjid
WHERE source.relname = 'service_requests'
  AND dependent.relkind = 'v'
  AND dependent.relname <> 'service_requests';

-- ── 7. Políticas RLS e privilégios directos na tabela ────────────────────────
SELECT polname AS politica, polcmd AS comando,
       pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check
FROM pg_policy
WHERE polrelid = 'public.service_requests'::regclass;

SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'service_requests'
ORDER BY grantee, privilege_type;

-- ── 8. Transições REALMENTE observadas (auditoria do painel) ─────────────────
-- Mostra o grafo de transições que aconteceu na prática, e quem o fez.
SELECT status_from, status_to, COUNT(*) AS vezes,
       COUNT(*) FILTER (WHERE colab_nome = 'Sistema') AS automaticas,
       MAX(created_at) AS ultima_vez
FROM public.service_request_ops
WHERE action_type = 'status_change' AND status_from IS NOT NULL
GROUP BY 1, 2
ORDER BY 3 DESC;

-- ── 9. DETECTOR DO BUG DE HOJE: pedidos publicáveis sem oferta activa ────────
-- Pedidos em estado visível aos parceiros mas sem nenhuma job_offer pendente
-- ou aceite → invisíveis na app dos profissionais.
SELECT sr.id, sr.status::text, sr.estimated_price, sr.final_price, sr.created_at
FROM public.service_requests sr
WHERE sr.status::text IN ('confirmed', 'assignment_pending')
  AND NOT EXISTS (
    SELECT 1 FROM public.job_offers jo
    WHERE jo.request_id = sr.id
      AND jo.status IN ('pending', 'accepted')
  )
ORDER BY sr.created_at DESC;

-- ── 10. Preço aprovado vs estado (incoerências) ──────────────────────────────
-- a) aprovados sem preço  b) com preço mas ainda em análise
SELECT 'aprovado_sem_preco' AS problema, id, status::text, estimated_price, final_price
FROM public.service_requests
WHERE status::text IN ('awaiting_deposit','assignment_pending','partner_selected','confirmed')
  AND COALESCE(final_price, estimated_price, 0) <= 0
UNION ALL
SELECT 'preco_aprovado_mas_em_analise', id, status::text, estimated_price, final_price
FROM public.service_requests
WHERE status::text IN ('draft','open','received','in_review')
  AND COALESCE(final_price, 0) > 0
ORDER BY problema, id;

-- ── 11. Estados de job_offers e bookings (vocabulários secundários) ──────────
SELECT 'job_offers' AS tabela, status::text, COUNT(*) FROM public.job_offers GROUP BY 1, 2
UNION ALL
SELECT 'bookings', status::text, COUNT(*) FROM public.bookings GROUP BY 1, 2
ORDER BY tabela, count DESC;
