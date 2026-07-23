-- Tabela de cupões de desconto para a App CLYON
-- Executar no SQL Editor do Supabase Dashboard

CREATE TABLE IF NOT EXISTS cupons (
  id                   UUID           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code                 TEXT           NOT NULL,
  discount_type        TEXT           NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value       NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  currency_code        TEXT           NOT NULL DEFAULT 'EUR',
  starts_at            TIMESTAMPTZ,
  ends_at              TIMESTAMPTZ,
  usage_limit          INTEGER        CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_count          INTEGER        NOT NULL DEFAULT 0,
  minimum_order_amount NUMERIC(10, 2) CHECK (minimum_order_amount IS NULL OR minimum_order_amount >= 0),
  per_account_limit    INTEGER        CHECK (per_account_limit IS NULL OR per_account_limit > 0),
  active               BOOLEAN        NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CONSTRAINT cupons_code_unique UNIQUE (code),
  CONSTRAINT cupons_percent_max CHECK (
    discount_type <> 'percent' OR (discount_value > 0 AND discount_value <= 100)
  )
);

CREATE INDEX IF NOT EXISTS idx_cupons_code   ON cupons (code);
CREATE INDEX IF NOT EXISTS idx_cupons_active ON cupons (active, starts_at, ends_at);

ALTER TABLE cupons ENABLE ROW LEVEL SECURITY;

-- Apenas service_role (servidor) pode ler/escrever; nenhum acesso anónimo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cupons' AND policyname = 'admin_service_role_all'
  ) THEN
    CREATE POLICY "admin_service_role_all" ON cupons
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Função para actualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cupons_set_updated_at ON cupons;
CREATE TRIGGER cupons_set_updated_at
  BEFORE UPDATE ON cupons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
