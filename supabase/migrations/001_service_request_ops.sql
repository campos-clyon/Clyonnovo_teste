-- Tabela de operações administrativas sobre pedidos da app CLYON
-- Separação entre pedido original do cliente (imutável) e operação interna
-- Executar manualmente no dashboard Supabase: SQL Editor
--
-- REVERSÃO: DROP TABLE IF EXISTS service_request_ops;

CREATE TABLE IF NOT EXISTS service_request_ops (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id    UUID        NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  colab_id      INTEGER     NOT NULL,
  colab_nome    TEXT        NOT NULL,
  -- Tipo de acção: 'status_change' | 'note' | 'price_update' | 'schedule' | 'urgency_change' | 'assignment'
  action_type   TEXT        NOT NULL,
  status_from   TEXT,
  status_to     TEXT,
  -- Motivo obrigatório quando action_type = 'status_change' e status_to IN ('canceled', 'rejected')
  reason        TEXT,
  note          TEXT,
  -- Dados adicionais em JSON (ex: valor anterior/novo para price_update)
  data_json     JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para listar ops de um pedido em ordem cronológica
CREATE INDEX IF NOT EXISTS idx_service_request_ops_request_id
  ON service_request_ops (request_id, created_at DESC);

-- Índice para auditoria por colaborador
CREATE INDEX IF NOT EXISTS idx_service_request_ops_colab_id
  ON service_request_ops (colab_id);

-- RLS: apenas service_role acede (o cliente admin usa service_role key, nunca exposta no browser)
ALTER TABLE service_request_ops ENABLE ROW LEVEL SECURITY;
