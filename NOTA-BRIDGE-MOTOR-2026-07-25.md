# Motor de preços — o que o backoffice tem de mudar

**25-07-2026.** Esquema verificado contra a base de produção depois da migração
aplicada. Substitui a versão de 24-07, que descrevia colunas que acabaram por
não ser criadas (arquivada em `codigo-arquivado/pre-motor-2026-07-24/`).

> **Para o Wanderson:** copia para o projeto do site tudo o que está entre os
> marcadores `INÍCIO` e `FIM`. O que vem depois do `FIM` é para ti.

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!--          INÍCIO — COPIAR PARA O PROJETO DO SITE                        -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->

```
═══════════════════════════════════════════════════════════════════════
   INÍCIO — COPIAR PARA O PROJETO DO SITE (clyon.pt/admin)
═══════════════════════════════════════════════════════════════════════
```

## 1. O que mudou, e porquê importa para vocês

Um cliente respondia a 7 passos do wizard e recebia **0 €** e a mensagem
"pedido recebido para análise". Não era avaria: a edge function `calculate-price`
forçava análise manual sempre que faltavam fotos com volume relevante, e nesse
caminho escrevia `total = 0`.

Existe agora uma edge function nova, **`estimate-request`**, que é o caminho
principal da app. Ela garante uma regra que a especificação do motor já exigia:

> **Nenhum pedido fica com preço 0 ou null.**

Todo o pedido sai com um valor e um estado. O estado diz o que esse valor é.

### Os três estados

| `price_status` | Significa | O que o operador vê |
|---|---|---|
| `firme` | Preço fechado, válido 24 h | Um valor. Pode avançar. |
| `intervalo` | Estimativa com margem | `min – max`. Falta confirmar algo (fotos, distância). |
| `revisao` | Precisa de decisão humana | O valor é referência. Piano, cofre, >1 carrinha, valor alto. |
| `NULL` | Cotação anterior a esta mudança | Comportamento antigo. |

**Mesmo em `revisao` o preço vai preenchido.** "Em análise" deixou de significar
"sem número".

---

## 2. Esquema — o que existe mesmo na base

### 2.1 `price_quotes` — colunas novas

| Coluna | Tipo | Conteúdo |
|---|---|---|
| `request_facts` | `jsonb` | A ficha completa do pedido. Ver §3.2. |
| `estimate_min` | `numeric` | Extremo inferior, **sem IVA** |
| `estimate_max` | `numeric` | Extremo superior, **sem IVA** |
| `price_status` | `text` | `firme` / `intervalo` / `revisao` / `NULL` |
| `notes` | `text` | Notas escritas pelo cliente no wizard |

`price_status` tem CHECK. `NULL` é permitido de propósito — todas as linhas
anteriores ficaram assim e são legítimas.

### 2.2 `service_requests` — colunas novas

As mesmas quatro: `request_facts`, `estimate_min`, `estimate_max`,
`price_status`. Duplicação intencional: a cotação pode expirar ou ser
substituída, e o pedido tem de continuar a saber com que ficha foi orçamentado.

### 2.3 `quote_engine_trace` — tabela nova, **só admin**

Uma linha por cotação. É aqui que vive a margem.

| Coluna | Tipo | Conteúdo |
|---|---|---|
| `quote_id` | `uuid` PK | FK para `price_quotes(id)`, `ON DELETE CASCADE` |
| `service_request_id` | `uuid` | FK, pode ser `NULL` |
| `engine_floor` | `numeric` | **Piso anti-prejuízo** do motor determinístico |
| `engine_ceiling` | `numeric` | Teto (hoje 2× o piso) |
| `gemini_price` | `numeric` | O que a IA sugeriu **antes** do clamp. `NULL` se não respondeu |
| `engine_source` | `text` | `gemini` ou `deterministico` |
| `engine_confidence` | `numeric` | 0 a 1 |
| `engine_reasons` | `jsonb` | Array de razões internas |

**Estas colunas não estão em `price_quotes` de propósito.** A política
`price_quotes own read` deixa o cliente ler a linha inteira da sua própria
cotação — e o piso é o custo interno da CLYON. Esta tabela só é legível por
quem tem papel `admin`.

### 2.4 `pricing_outcomes` — tabela nova, **só admin**

O conjunto de treino do motor futuro. Uma linha por trabalho.

| Coluna | Preenchida por | Quando |
|---|---|---|
| `quote_id`, `service_request_id`, `service_type`, `zone_name` | vocês | ao aprovar |
| `request_facts`, `engine_floor`, `engine_ceiling`, `gemini_price` | vocês | ao aprovar |
| `price_shown`, `estimate_min`, `estimate_max`, `price_status` | vocês | ao aprovar |
| `price_approved`, `approved_at` | **vocês** | quando o admin aprova |
| `price_executed`, `executed_at`, `ajustes_no_local` | **vocês** | quando o trabalho fecha |
| `horas_reais`, `pessoas_reais` | **vocês** | quando o trabalho fecha |
| `desvio_pct` | automática | coluna gerada — **não escrever** |

`service_request_id` tem índice **único** — é o alvo do `ON CONFLICT` da §3.4.

---

## 3. O que o backoffice tem de fazer

### 3.1 🔴 `total = 0` já não significa "sem preço"

**Este é o ponto mais importante da nota.** Se continuarem a ler só `total`, o
operador vai ver 0 € em pedidos que já têm valor.

- Nos pedidos criados pelo `estimate-request`, `total` traz sempre o preço.
- Nos criados pelo `calculate-price` (caminho antigo, ainda vivo noutros ecrãs),
  `total` continua a ser 0 quando não há preço fechado — mas agora
  `estimate_min`, `estimate_max` e `price_status` vão preenchidos.

Regra a implementar:

```js
function precoParaMostrar(q) {
  // 1. Estado explícito manda sempre.
  if (q.price_status === 'firme') {
    const v = Number(q.total) > 0 ? Number(q.total) : Number(q.estimate_min);
    return { tipo: 'fechado', texto: `${v} € + IVA` };
  }
  if (q.price_status === 'intervalo' || q.price_status === 'revisao') {
    return {
      tipo: q.price_status,
      texto: `${Number(q.estimate_min)} – ${Number(q.estimate_max)} € + IVA`,
    };
  }
  // 2. price_status NULL = cotação anterior ao motor.
  if (Number(q.total) > 0) return { tipo: 'fechado', texto: `${q.total} € + IVA` };
  return { tipo: 'legado', texto: 'Sem preço calculado' };
}
```

**Todos os valores são sem IVA.** O IVA (23 %) é acrescentado na apresentação ao
cliente, nunca guardado na base.

### 3.2 Ler `request_facts` — a ficha completa

É o contrato único entre a app, o motor e a IA. Estrutura estável
(`schema_version: 1`):

```jsonc
{
  "schema_version": 1,
  "service": "moveis",           // moveis | monos | entulho | mudancas | materiais
  "local": {
    "morada": "Avenida da Fé, 2635-033 Rio de Mouro",
    "lat": 38.7746, "lng": -9.3364,   // null quando escrita à mão
    "tipo": "apartamento",
    "andar": 3,
    "elevador": false,               // true | false | null (=não sei)
    "carrinha_perto": true           // true | false | null
  },
  "destino": null,                   // só mudanças e materiais
  "carga": {
    "escala": null,                  // poucos_itens | um_quarto | varias_divisoes | casa_toda
    "itens": [{ "nome": "Roupeiro grande", "qtd": 3 }],
    "volume_m3": 4.0,
    "volume_origem": "catalogo"      // fotos | catalogo | escala | cliente
  },
  "fotos": [{ "url": "...", "path": "..." }],
  "quando": { "urgencia": "amanha", "data": null, "turno": null },
  "notas_cliente": "Dois vão de escada.",
  "contacto": { "nome": "...", "telefone": "...", "email": "..." }
}
```

**`notas_cliente` é novo e importante.** Até agora o cliente escrevia "dois vão
de escada" e essa informação era descartada — nunca chegava a quem executava o
serviço. Agora vai também anexada em `service_requests.notes`, a seguir à
mensagem do sistema.

**`local.lat` a `null` significa morada escrita à mão.** Nesse caso o motor não
consegue calcular a deslocação e **nunca fecha preço** — sai sempre como
`intervalo`. Se virem muitos pedidos assim, vale a pena investigar o
autocomplete de moradas na app.

### 3.3 Ecrã de aprovação: mostrar o raciocínio, não só o número

Juntem `quote_engine_trace` à cotação e mostrem quatro valores lado a lado:

| Campo | Origem | Para quê |
|---|---|---|
| Piso | `engine_floor` | Abaixo disto a CLYON perde dinheiro |
| Sugestão da IA | `gemini_price` | O que o Gemini propôs antes do clamp |
| Preço mostrado | `price_quotes.total` | O que o cliente viu |
| Teto | `engine_ceiling` | Limite superior permitido |

**Marcar a vermelho se o preço aprovado descer abaixo de `engine_floor`.** É a
única defesa contra aprovar um trabalho com prejuízo.

`engine_source` diz se a IA participou. `gemini_price` a `NULL` com
`engine_source = 'deterministico'` significa que a IA não respondeu — a razão
está em `engine_reasons` (ex.: `motor_a_indisponivel:gemini_http_429`).

> **Nota operacional:** neste momento a quota gratuita do Gemini esgota depressa,
> por isso é normal ver muitos pedidos com `engine_source = 'deterministico'`.
> Não é avaria — o motor determinístico é o piso e funciona sozinho.

### 3.4 Preencher `pricing_outcomes` — sem isto o motor nunca aprende

Dois momentos. **O alvo do `ON CONFLICT` é `service_request_id`.**

Quando o admin aprova um preço:

```sql
INSERT INTO public.pricing_outcomes (
  service_request_id, quote_id, service_type, zone_name,
  request_facts, engine_floor, engine_ceiling, gemini_price,
  price_shown, estimate_min, estimate_max, price_status,
  price_approved, approved_at
)
SELECT
  sr.id, q.id, q.service_type, q.zone_name,
  q.request_facts, t.engine_floor, t.engine_ceiling, t.gemini_price,
  q.total, q.estimate_min, q.estimate_max, q.price_status,
  $1, now()
FROM public.service_requests sr
JOIN public.price_quotes q ON q.id = sr.price_quote_id
LEFT JOIN public.quote_engine_trace t ON t.quote_id = q.id
WHERE sr.id = $2
ON CONFLICT (service_request_id) DO UPDATE
  SET price_approved = EXCLUDED.price_approved,
      approved_at    = EXCLUDED.approved_at,
      updated_at     = now();
```

Quando o trabalho termina:

```sql
UPDATE public.pricing_outcomes
   SET price_executed   = $1,
       horas_reais      = $2,
       pessoas_reais    = $3,
       ajustes_no_local = $4,
       executed_at      = now(),
       updated_at       = now()
 WHERE service_request_id = $5;
```

`desvio_pct` calcula-se sozinha. Sem estes dois passos, `pricing_outcomes` fica
vazia e não há como saber se o motor está a acertar — é a diferença entre
calibrar com dados e calibrar com intuição.

---

## 4. O que a app já faz — não dupliquem

- Preenche e envia `request_facts` em cada pedido
- Chama `estimate-request`, que grava `price_quotes`, `quote_engine_trace` e
  `service_requests` de forma idempotente (por `customer_id` + `client_request_id`)
- Nunca mostra 0 € ao cliente
- Anexa `notas_cliente` a `service_requests.notes`
- **Nunca coloca um pedido em `confirmed`.** Quem aprova é o admin, pelo site.
  Isto não mudou.

---

## 5. Verificação

### ▶️ CORRER NO SQL EDITOR — o esquema ficou bem?

```sql
SELECT table_name, column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND (
     (table_name = 'price_quotes'
       AND column_name IN ('request_facts','estimate_min','estimate_max','price_status','notes'))
     OR (table_name = 'service_requests'
       AND column_name IN ('request_facts','estimate_min','estimate_max','price_status'))
     OR table_name IN ('quote_engine_trace','pricing_outcomes')
   )
 ORDER BY table_name, column_name;
```

**Esperado:** 5 linhas de `price_quotes`, 4 de `service_requests`, 8 de
`quote_engine_trace` e as de `pricing_outcomes`. Se faltar alguma das primeiras
nove, a migração `20260724260000_ficha_do_pedido_e_motor.sql` não correu por
inteiro.

### ▶️ CORRER NO SQL EDITOR — invariante "nunca 0"

Correr depois de cada deploy. **Tem de devolver ZERO linhas.**

```sql
SELECT id, created_at, service_type, total, estimate_min, estimate_max, price_status
  FROM public.price_quotes
 WHERE created_at > '2026-07-25'
   AND price_status IS NOT NULL
   AND COALESCE(estimate_min, 0) <= 0
 ORDER BY created_at DESC
 LIMIT 20;
```

Se devolver linhas, há um caminho a escrever cotações sem intervalo — avisem o
projeto da app antes de mexer no site.

### ▶️ CORRER NO SQL EDITOR — o motor está a acertar?

Só dá resultado depois de `pricing_outcomes` ter linhas fechadas.

```sql
SELECT service_type,
       count(*)                                AS trabalhos,
       round(avg(desvio_pct)::numeric, 1)      AS desvio_medio_pct,
       round(avg(abs(desvio_pct))::numeric, 1) AS erro_medio_pct,
       count(*) FILTER (WHERE price_executed < engine_floor) AS abaixo_do_piso
  FROM public.pricing_outcomes
 WHERE desvio_pct IS NOT NULL
 GROUP BY service_type
 ORDER BY trabalhos DESC;
```

`abaixo_do_piso > 0` é o alarme: significa trabalhos executados abaixo do custo.

### Teste ponta a ponta nos três sistemas

Um pedido de **3 roupeiros grandes + 2 cómodas, 3.º andar sem elevador, sem
fotos, em Rio de Mouro** tem de mostrar **o mesmo intervalo** na app, na base e
no backoffice. O valor medido em produção a 25-07-2026 foi **199 € [196–249],
`intervalo`** com o motor determinístico, ou ~289 € quando a IA participa.

```
═══════════════════════════════════════════════════════════════════════
   FIM — COPIAR PARA O PROJETO DO SITE
═══════════════════════════════════════════════════════════════════════
```

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!--          FIM — COPIAR PARA O PROJETO DO SITE                           -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->

---

## Para ti, Wanderson — não copiar

**O que enviar:** tudo entre os dois marcadores `INÍCIO`/`FIM` acima.

**O que dizer ao outro projeto Claude:** que a §3.1 é o que interessa primeiro.
Se o backoffice continuar a ler só `price_quotes.total`, o operador vê 0 € em
pedidos que já têm valor — e o problema que passámos dois dias a resolver
reaparece do lado deles.

**O que ainda depende de ti:**

1. A quota do Gemini. Enquanto não ativares faturação no projeto Google
   (`projects/951315810792`), quase todos os pedidos saem com
   `engine_source = 'deterministico'`.
2. A decisão sobre o teto (2× o piso). Ver `STATUS-MOTOR-2026-07-25.md`,
   secção "O que falta decidir".
3. A chave do Gemini que ficou exposta na conversa — rodar quando acabares os
   testes.
