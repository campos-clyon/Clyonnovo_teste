-- ═══════════════════════════════════════════════════════════════════════════
-- 007: o painel passa a poder fechar o preço de um pedido
-- Executar no SQL Editor do Supabase Dashboard
--
-- Quando o motor não consegue decidir sozinho, marca o pedido com
-- price_status = 'revisao' e devolve um intervalo. A app, com razão, recusa-se
-- a cobrar a reserva nesse estado: diz ao cliente "este pedido precisa de
-- validação humana" e espera.
--
-- Só que o painel não tinha por onde dar essa validação — nunca escrevia
-- price_status. O pedido ficava à espera de uma acção que não existia em lado
-- nenhum, e o cliente via "a CLYON vai confirmar o preço" para sempre.
--
-- Esta migração acrescenta price_status e final_price à lista de campos que a
-- patch_request_with_audit aceita. A lista continua a ser uma whitelist no
-- SQL, independente do que a API envie.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION patch_request_with_audit(
  p_request_id  UUID,
  p_updates     JSONB,   -- status, urgency, estimated_price, scheduled_for, price_status, final_price
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

  -- price_status só aceita os valores do motor. Um valor fora destes
  -- deixaria a app sem saber o que mostrar ao cliente.
  IF p_updates ? 'price_status'
     AND (p_updates->>'price_status') IS NOT NULL
     AND (p_updates->>'price_status') NOT IN ('firme', 'intervalo', 'revisao') THEN
    RAISE EXCEPTION 'Estado de preço inválido: %. Só firme, intervalo ou revisao.',
      (p_updates->>'price_status') USING ERRCODE = 'P0001';
  END IF;

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
                      END,
    -- Fechar o preço: a equipa decidiu, a app deixa de esperar
    price_status    = CASE
                        WHEN p_updates ? 'price_status'
                        THEN (p_updates->>'price_status')
                        ELSE price_status
                      END,
    final_price     = CASE
                        WHEN p_updates ? 'final_price'
                        THEN (p_updates->>'final_price')::NUMERIC
                        ELSE final_price
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
