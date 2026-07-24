-- ═══════════════════════════════════════════════════════════════════════════
-- 006: Entrada automática em análise — quando o cliente submete um pedido,
--      o estado inicial passa a ser "in_review" (Em análise).
-- Executar no SQL Editor do Supabase Dashboard.
--
-- Normaliza os estados de entrada legados no INSERT, independentemente do
-- cliente que cria o pedido (app móvel cria com "open"; outras interfaces
-- podem criar com "received" ou sem estado). "draft" é preservado — é um
-- rascunho intencional do cliente.
--
-- O painel admin também promove open/received → in_review ao listar
-- (fallback enquanto este trigger não existir).
--
-- REVERSÃO:
--   DROP TRIGGER IF EXISTS trg_service_requests_auto_in_review ON service_requests;
--   DROP FUNCTION IF EXISTS service_requests_auto_in_review();
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION service_requests_auto_in_review()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NULL OR NEW.status IN ('open', 'received') THEN
    NEW.status := 'in_review';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_requests_auto_in_review ON service_requests;
CREATE TRIGGER trg_service_requests_auto_in_review
  BEFORE INSERT ON service_requests
  FOR EACH ROW
  EXECUTE FUNCTION service_requests_auto_in_review();

-- Nota: se a tabela ainda tiver o CHECK antigo
-- (status IN ('draft','open','in_progress','completed','cancelled')),
-- é preciso alargá-lo primeiro ao vocabulário actual do painel:
--
-- ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_status_check;
-- ALTER TABLE service_requests ADD CONSTRAINT service_requests_status_check
--   CHECK (status IN (
--     'draft','open','received','in_review','awaiting_deposit',
--     'assignment_pending','partner_selected','confirmed','in_route',
--     'arrived','in_execution','extra_review_requested',
--     'awaiting_confirmation','completed','in_dispute','canceled',
--     'rejected','in_progress','cancelled'
--   ));
