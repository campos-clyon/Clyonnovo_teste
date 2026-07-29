-- ═══════════════════════════════════════════════════════════════════════════
-- 008: patch_request_with_audit deixa de assumir que tudo é texto
-- Executar no SQL Editor do Supabase Dashboard
--
-- O QUE ESTAVA MAL
--
-- A função escrevia `COALESCE(p_updates->>'status', status)`. O operador
-- `->>` devolve TEXTO, e `service_requests.status` é um ENUM
-- (`request_status`). O Postgres recusa comparar os dois:
--
--   ERROR: 42804: COALESCE types text and request_status cannot be matched
--
-- Resultado: TODAS as mudanças de estado por esta função falhavam. O painel
-- mostrava "Erro ao avançar a fase" sem dizer porquê, e o botão de fechar
-- preço gravava sem efeito. Enquanto a função não existia, a API caía num
-- caminho alternativo e funcionava — aplicá-la foi o que partiu isto.
--
-- A CORRECÇÃO
--
-- `jsonb_populate_record` converte cada chave para o tipo da coluna
-- correspondente, seja enum, numeric ou timestamptz. Deixa de haver
-- conversões escritas à mão, e uma coluna que mude de tipo amanhã não volta
-- a partir isto.
--
-- O `p_updates ? 'chave'` continua a decidir o que se toca, para que passar
-- um campo a NULL de propósito continue a ser possível — o que um COALESCE
-- simples não permitiria.
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
  v_new service_requests%ROWTYPE;
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

  -- Cada chave convertida para o tipo da sua coluna, pelo Postgres.
  -- Chaves que não sejam colunas de service_requests são ignoradas aqui, e a
  -- whitelist abaixo é o que decide o que se escreve de facto.
  v_new := jsonb_populate_record(NULL::service_requests, p_updates);

  UPDATE service_requests SET
    status          = CASE WHEN p_updates ? 'status'          THEN v_new.status          ELSE status          END,
    urgency         = CASE WHEN p_updates ? 'urgency'         THEN v_new.urgency         ELSE urgency         END,
    estimated_price = CASE WHEN p_updates ? 'estimated_price' THEN v_new.estimated_price ELSE estimated_price END,
    scheduled_for   = CASE WHEN p_updates ? 'scheduled_for'   THEN v_new.scheduled_for   ELSE scheduled_for   END,
    -- Fechar o preço: a equipa decidiu, a app deixa de esperar
    price_status    = CASE WHEN p_updates ? 'price_status'    THEN v_new.price_status    ELSE price_status    END,
    final_price     = CASE WHEN p_updates ? 'final_price'     THEN v_new.final_price     ELSE final_price     END
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
