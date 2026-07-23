-- ═══════════════════════════════════════════════════════════════════════════
-- 005: Arquivo de pedidos no backoffice
-- Executar no SQL Editor do Supabase Dashboard
--
-- Arquivar esconde o pedido das listas operacionais sem apagar dados nem
-- histórico (ao contrário de eliminar). archived_by guarda o colaborador.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by TEXT;

CREATE INDEX IF NOT EXISTS idx_service_requests_archived_at
  ON service_requests (archived_at)
  WHERE archived_at IS NOT NULL;
