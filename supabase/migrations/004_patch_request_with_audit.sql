-- ═══════════════════════════════════════════════════════════════════════════
-- 004: RPC transaccional — alterar pedido + gravar auditoria no mesmo commit
-- Executar no SQL Editor do Supabase Dashboard
--
-- Elimina a janela de corrida do padrão update→audit→revert usado pela API:
-- ou ambas as escritas acontecem, ou nenhuma. A API tenta esta RPC primeiro
-- e usa o caminho de compensação como fallback enquanto ela não existir.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION patch_request_with_audit(
  p_request_id  UUID,
  p_updates     JSONB,   -- só chaves permitidas: status, urgency, estimated_price, scheduled_for
  p_colab_id    INTEGER,
  p_colab_nome  TEXT,
  p_action_type TEXT,
  p_status_from TEXT DEFAULT NULL,
  p_status_to   TEXT DEFAULT NULL,
  p_reason      TEXT DEFAULT NULL,
  p_note        TEXT DEFAULT NULL,
  p_data_json   JSONB DEFAULT NULL
)
RETURNS SETOF service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row service_requests%ROWTYPE;
BEGIN
  -- Lock da linha para impedir escrita concorrente durante a transacção
  SELECT * INTO v_row FROM service_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Aplicar apenas campos operacionais permitidos (whitelist no SQL,
  -- independente do que a API envie)
  UPDATE service_requests SET
    status          = COALESCE((p_updates->>'status'), status),
    urgency         = COALESCE((p_updates->>'urgency'), urgency),
    estimated_price = CASE
                        WHEN p_updates ? 'estimated_price'
                        THEN (p_updates->>'estimated_price')::NUMERIC
                        ELSE estimated_price
                      END,
    scheduled_for   = CASE
                        WHEN p_updates ? 'scheduled_for'
                        THEN (p_updates->>'scheduled_for')::TIMESTAMPTZ
                        ELSE scheduled_for
                      END
  WHERE id = p_request_id;

  -- Auditoria no MESMO commit — se este INSERT falhar, o UPDATE reverte
  INSERT INTO service_request_ops (
    request_id, colab_id, colab_nome, action_type,
    status_from, status_to, reason, note, data_json
  ) VALUES (
    p_request_id, p_colab_id, p_colab_nome, p_action_type,
    p_status_from, p_status_to, p_reason, p_note, p_data_json
  );

  RETURN QUERY SELECT * FROM service_requests WHERE id = p_request_id;
END;
$$;

-- Apenas service_role pode executar (a API server-side)
REVOKE ALL ON FUNCTION patch_request_with_audit(UUID, JSONB, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION patch_request_with_audit(UUID, JSONB, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION patch_request_with_audit(UUID, JSONB, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
