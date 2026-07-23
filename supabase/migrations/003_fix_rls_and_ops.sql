-- ═══════════════════════════════════════════════════════════════════════════
-- 003: Correcções de segurança e tabela de auditoria
-- Executar no SQL Editor do Supabase Dashboard
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Corrigir partner_offer_previews (UNRESTRICTED → restrita) ────────

ALTER TABLE partner_offer_previews ENABLE ROW LEVEL SECURITY;

-- Apenas service_role (servidor) pode aceder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'partner_offer_previews'
      AND policyname = 'service_role_only'
  ) THEN
    CREATE POLICY "service_role_only" ON partner_offer_previews
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ─── 2. Criar service_request_ops (se não existir) ──────────────────────

CREATE TABLE IF NOT EXISTS service_request_ops (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id    UUID        NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  colab_id      INTEGER     NOT NULL,
  colab_nome    TEXT        NOT NULL,
  action_type   TEXT        NOT NULL,
  status_from   TEXT,
  status_to     TEXT,
  reason        TEXT,
  note          TEXT,
  data_json     JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_request_ops_request_id
  ON service_request_ops (request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_request_ops_colab_id
  ON service_request_ops (colab_id);

ALTER TABLE service_request_ops ENABLE ROW LEVEL SECURITY;
