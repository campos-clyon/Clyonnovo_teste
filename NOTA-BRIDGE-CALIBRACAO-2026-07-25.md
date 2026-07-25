# Terceira nota para o site — calibração do motor

**25-07-2026.** Resposta à pergunta que levantaram sobre `pricing_outcomes` e o
ajuste no local. Tinham razão, e há mais debaixo disso.

> **Para o Wanderson:** copia tudo entre `INÍCIO` e `FIM`. O SQL vai inline —
> não dependam do ficheiro, que o visualizador não tem conseguido abrir.

```
═══════════════════════════════════════════════════════════════════════
   INÍCIO — COPIAR PARA O PROJETO DO SITE (clyon.pt/admin)
═══════════════════════════════════════════════════════════════════════
```

## 1. Tinham razão, e o problema é maior

> *"Se o ajuste no local subir o `final_price` depois de o cliente aceitar a
> proposta, o conjunto de treino fica com o valor antes do ajuste."*

Correto. E se o `price_executed` não incluir os ajustes, **o motor parece melhor
do que é e nunca aprende a medir**. É o sinal mais valioso que vamos ter.

Mas somar tudo num número só perde o que interessa. Há **duas razões
diferentes** para o preço final não ser o previsto, e pedem correções opostas:

| Desvio | O que significa | Como se corrige |
|---|---|---|
| `price_approved − price_shown` | O motor acertou no tamanho e errou no **mercado**: o cliente achou caro e negociou | margem, mínimos de zona |
| soma dos ajustes no local | O motor errou no **tamanho**: eram 21 sacos e não 18 | leitura das fotos, perguntas do wizard |

Misturadas, um desvio de +20% não diz se o problema é o preço ou a medição.
Separadas, diz — e são equipas diferentes a resolver cada uma.

---

## 2. A armadilha na vossa proposta

Ler o `final_price` no fecho é melhor do que confiar no que o operador escreve
— **mas só enquanto a CLYON processar o pagamento.**

No modelo de créditos para onde a CLYON vai (ver nota anterior, §6), o cliente
paga ao profissional **em mão**. Nada garante que ele cobrou exatamente o que o
sistema diz. Se o `price_executed` passar a ser *sempre* o `final_price`,
ficamos cegos a cobranças fora da plataforma — que num marketplace de
intermediação é o risco que mata o negócio.

**A solução:** `final_price` entra como valor **pré-preenchido**, não imposto.
O campo continua editável, e há uma coluna nova para o valor real.

---

## 3. Colunas novas em `pricing_outcomes`

| Coluna | Tipo | Quem preenche | Para quê |
|---|---|---|---|
| `ajustes_total` | `numeric` | vocês, no fecho | Soma dos ajustes aprovados. Isola o erro de medição |
| `ajustes_contagem` | `integer` | vocês, no fecho | Vários ajustes no mesmo trabalho = orçamento mal feito |
| `valor_cobrado_real` | `numeric` | operador, se divergir | O que o profissional cobrou de facto |

A `ajustes_no_local` (text) mantém-se para a nota escrita do operador.

---

## 4. Vista `v_calibracao_motor`

Já criada. Use-a em vez de calcular médias à mão:

```sql
SELECT * FROM public.v_calibracao_motor;
```

Devolve, por serviço e zona:

| Coluna | Leitura |
|---|---|
| `desvio_negociacao` | quanto o mercado corrige o motor |
| `desvio_ajuste` | quanto a realidade corrige a medição |
| `desvio_total` | o que o cliente sente |
| `erro_medio_abs` | a métrica única de qualidade do motor |
| `pct_com_ajuste` | **acima de ~20% o orçamento está a ser feito às cegas** |
| `abaixo_do_piso` | 🔴 trabalhos executados abaixo do custo |
| `divergencias_cobranca` | cobrança fora da plataforma |

Sem trabalhos fechados devolve zero linhas — é o esperado por agora.

---

## 5. O que implementar no fecho

Três notas sobre o que já propuseram:

1. **Pré-preencher com `final_price`, não impor.** O operador confirma ou
   corrige. Se corrigir, gravar em `valor_cobrado_real`.
2. **Gravar `ajustes_total` e `ajustes_contagem`** no mesmo momento, a partir
   de `service_adjustments` com `status = 'approved'`.
3. **`price_executed`** = o valor realmente cobrado, incluindo ajustes.

Sugestão de consulta para o fecho:

```sql
UPDATE public.pricing_outcomes o
   SET price_executed     = $1,           -- confirmado pelo operador
       valor_cobrado_real = NULLIF($2, $1), -- só se divergir
       horas_reais        = $3,
       pessoas_reais      = $4,
       ajustes_no_local   = $5,
       ajustes_total      = sub.total,
       ajustes_contagem   = sub.n,
       executed_at        = now(),
       updated_at         = now()
  FROM (
    SELECT COALESCE(SUM(a.suggested_amount - o2.estimated_price), 0) AS total,
           COUNT(*) AS n
      FROM public.service_adjustments a
      JOIN public.service_requests o2 ON o2.id = a.request_id
     WHERE a.request_id = $6 AND a.status = 'approved'
  ) sub
 WHERE o.service_request_id = $6;
```

---

## 6. ▶️ CORRER NO SQL EDITOR — as colunas e a vista

```sql
BEGIN;

ALTER TABLE public.pricing_outcomes
  ADD COLUMN IF NOT EXISTS ajustes_total      numeric,
  ADD COLUMN IF NOT EXISTS ajustes_contagem   integer,
  ADD COLUMN IF NOT EXISTS valor_cobrado_real numeric;

COMMENT ON COLUMN public.pricing_outcomes.ajustes_total IS
  'Soma dos ajustes aprovados no local. Isola o erro de MEDIÇÃO do erro de mercado.';
COMMENT ON COLUMN public.pricing_outcomes.ajustes_contagem IS
  'Quantos ajustes houve. Vários no mesmo trabalho é sinal de orçamento mal feito.';
COMMENT ON COLUMN public.pricing_outcomes.valor_cobrado_real IS
  'O que o profissional cobrou de facto. Divergir de price_executed indica cobrança fora da plataforma.';

UPDATE public.pricing_outcomes o
   SET ajustes_total = sub.total,
       ajustes_contagem = sub.n
  FROM (
    SELECT a.request_id,
           SUM(a.suggested_amount - COALESCE(
             (SELECT r2.estimated_price FROM public.service_requests r2 WHERE r2.id = a.request_id), 0
           )) AS total,
           COUNT(*) AS n
      FROM public.service_adjustments a
     WHERE a.status = 'approved' AND a.suggested_amount IS NOT NULL
     GROUP BY a.request_id
  ) sub
 WHERE o.service_request_id = sub.request_id
   AND o.ajustes_total IS NULL;

CREATE OR REPLACE VIEW public.v_calibracao_motor
WITH (security_invoker = true)
AS
SELECT
  service_type,
  zone_name,
  count(*)                                                   AS trabalhos,
  round(avg(price_approved - price_shown)::numeric, 2)       AS desvio_negociacao,
  round(avg(COALESCE(ajustes_total, 0))::numeric, 2)         AS desvio_ajuste,
  round(avg(price_executed - price_shown)::numeric, 2)       AS desvio_total,
  round(avg(abs(price_executed - price_shown))::numeric, 2)  AS erro_medio_abs,
  round(100.0 * count(*) FILTER (WHERE COALESCE(ajustes_contagem, 0) > 0)
        / NULLIF(count(*), 0), 1)                            AS pct_com_ajuste,
  count(*) FILTER (WHERE price_executed < engine_floor)      AS abaixo_do_piso,
  count(*) FILTER (WHERE valor_cobrado_real IS NOT NULL
                     AND valor_cobrado_real <> price_executed) AS divergencias_cobranca
FROM public.pricing_outcomes
WHERE price_executed IS NOT NULL AND price_shown IS NOT NULL
GROUP BY service_type, zone_name;

COMMENT ON VIEW public.v_calibracao_motor IS
  'Onde o motor erra e porquê: separa o desvio de negociação (mercado) do desvio de ajuste (medição).';

COMMIT;
```

**Esperado:** `Success. No rows returned`.

Confirmar depois:

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'pricing_outcomes'
   AND column_name IN ('ajustes_total','ajustes_contagem','valor_cobrado_real');
```

Três linhas.

---

## 7. O que fazer com estes números

Depois de ~30 trabalhos fechados:

- **`erro_medio_abs` alto com `desvio_ajuste` baixo** → o motor mede bem e
  precifica mal. Mexer na margem.
- **`pct_com_ajuste` acima de 20%** → o orçamento está a ser feito com
  informação insuficiente. Mexer nas perguntas do wizard ou tornar as fotos
  obrigatórias.
- **`abaixo_do_piso` > 0** → alarme. Trabalhos executados abaixo do custo.
- **`divergencias_cobranca` > 0** → alguém está a cobrar fora da plataforma.

```
═══════════════════════════════════════════════════════════════════════
   FIM — COPIAR PARA O PROJETO DO SITE
═══════════════════════════════════════════════════════════════════════
```

---

## Para ti, Wanderson — não copiar

Corre primeiro o SQL da §6 (é o mesmo da migração
`20260725150000_outcomes_decompoe_desvio.sql`), e só depois entrega a nota. Se
eles implementarem o fecho antes das colunas existirem, o `UPDATE` falha.

A parte mais valiosa desta nota é a §7 — é a primeira vez que existe uma forma
de responder a *"o motor está a melhorar?"* com um número em vez de uma
impressão. Mas só ganha sentido com trabalhos reais fechados, e continuam zero.
