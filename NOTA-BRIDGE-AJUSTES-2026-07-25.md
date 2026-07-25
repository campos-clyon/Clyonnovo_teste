# Segunda nota para o site — ajustes no local, estados e monetização

**25-07-2026, fim do dia.** Continuação de `NOTA-PARA-O-SITE-MOTOR.md`, que
tratou do motor de preços. Esta cobre o que mudou **depois** dessa.

> **Para o Wanderson:** copia para o projeto do site tudo entre `INÍCIO` e `FIM`.

<!-- ═══════════════════════════════════════════════════════════════════════ -->
```
═══════════════════════════════════════════════════════════════════════
   INÍCIO — COPIAR PARA O PROJETO DO SITE (clyon.pt/admin)
═══════════════════════════════════════════════════════════════════════
```

## 1. Resumo: três mudanças que vos afetam

1. **O preço pode mudar a meio do trabalho, sem passar por vocês.** É novo e é
   deliberado.
2. **`extra_review_requested` mudou de significado.** Já não quer dizer "à
   espera do admin".
3. **A comissão vai passar de 35% para 0%** (modelo de créditos). Ainda não
   está aplicado, mas muda toda a matemática de pagamentos.

Os detalhes abaixo. O ponto 2 é o que vos parte o painel se não mexerem.

---

## 2. Novo: ajuste de preço no local

### O problema que resolve

A equipa fecha um trabalho por 180 € — 18 sacos de entulho. Chega ao local e
tem 21 sacos, com 45 kg em vez de 30. Era preciso telefonar ao cliente,
renegociar, e às vezes perder a deslocação.

Agora o orçamento declara à partida **"até 18 sacos, cada saco a mais 5 €"**, e
o ajuste passa a ser uma soma que o cliente já aceitou.

### Duas funções novas

| Função | Quem chama | O que faz |
|---|---|---|
| `partner_register_adjustment(_request_id, _unidades, _motivo, _photos, _notes)` | profissional, na app | declara quantas unidades encontrou; calcula o preço novo |
| `customer_review_adjustment(_adjustment_id, _decision, _note)` | cliente, na app | aceita ou recusa um ajuste que passou o teto |

O profissional declara **quantas unidades encontrou**, nunca um valor. O preço
por unidade ficou fixado no orçamento que o cliente aceitou. Não há números
inventados no local.

### 🔴 O comportamento que vos afeta

**Dentro do teto** (preço novo ≤ `details.breakdown.teto_sem_nova_aprovacao`,
por omissão +15%):

- o ajuste entra em `service_adjustments` **já com `status = 'approved'`**
- `service_requests.final_price` **é atualizado imediatamente**
- o cliente recebe notificação
- **nenhum admin é envolvido**

**Acima do teto:**

- entra com `status = 'pending'`
- o pedido passa a `extra_review_requested`
- **quem decide é o CLIENTE**, não vocês

### O que isto implica no vosso código

**Se assumirem que `final_price` fica fixo depois da aprovação, vão ter valores
desatualizados.** Ele muda enquanto o trabalho decorre. Releiam antes de
faturar, e não guardem cópias em cache.

**Se `admin_review_adjustment` for o vosso único caminho para ajustes, vão
deixar de ver a maioria deles** — os pequenos já vêm resolvidos. Essa função
continua a existir e a funcionar, mas agora só apanha os que ninguém resolveu.

**`extra_review_requested` já não é uma fila vossa.** Passou a significar "à
espera do cliente". Se tiverem um ecrã de "ajustes a aguardar análise", ele vai
mostrar coisas sobre as quais não podem agir. Filtrem por
`service_adjustments.status = 'pending'` **e** verifiquem se já passou tempo
demais — aí sim faz sentido intervirem.

---

## 3. Novo no orçamento: preço marginal e premissas

O `estimate-request` passou a guardar em `service_requests.details.breakdown`:

```jsonc
{
  "marginal": {
    "unidade": "saco",          // saco | item | carga | hora
    "unidade_plural": "sacos",
    "incluidas": 18,            // quantas o preço base cobre
    "valor_adicional": 5        // preço de cada uma além dessas, s/IVA
  },
  "inclui": [
    "Até 18 sacos",
    "Sacos até 30 kg cada",
    "3.º andar sem elevador"
  ],
  "teto_sem_nova_aprovacao": 206
}
```

**Vale a pena mostrarem isto no ecrã de aprovação.** É o que a equipa vai dizer
ao cliente no local, e é o que torna o ajuste indiscutível. Se o operador
aprovar um orçamento sem perceber que "cada saco a mais são 5 €", vai ser
apanhado de surpresa quando o valor subir sozinho.

---

## 4. Estado `awaiting_customer_approval`

Já existia na base. Passou a ser **visível e acionável na app**: o cliente vê o
valor proposto e pode aceitar, contrapor (até 2 vezes) ou cancelar.

Antes disto, a proposta que vocês enviavam **não aparecia em lado nenhum na
app** — o cartão de negociação existia mas estava numa rota a que a navegação
não levava. Se enviaram propostas nos últimos dias e não obtiveram resposta,
é provavelmente por isso.

Também faltava o passo seguinte: depois de aceitar, o pedido ia para
`awaiting_deposit` e não havia botão para pagar a reserva. Já existe.

---

## 5. `description` dos profissionais — podem desligar o remendo

A app passou a escrever `partner_profiles.description` além de `bio`. O botão
de "copiar a bio para a descrição" que criaram continua útil para perfis
antigos, mas **os novos já entram com a apresentação correta**.

Do lado da app, o ecrã do cliente também passou a ler `bio` como segunda opção,
o que recupera os perfis antigos sem ninguém os reeditar.

---

## 6. ⚠️ A seguir: a comissão passa a zero

**Ainda não aplicado.** Mas quando for, muda tudo o que calcula pagamentos.

Modelo novo: o profissional fica com **100%** do que o cliente paga, e a CLYON
cobra uma **taxa de desbloqueio em créditos** (~10% do valor) quando ele aceita
o trabalho. O dinheiro do serviço deixa de passar pela CLYON.

| | Hoje | Depois |
|---|---|---|
| `partner_earning_share_default` | 0.65 | **1.00** |
| Profissional recebe (trabalho de 250 €) | 162,50 € | **250 €** |
| CLYON recebe | 87,50 € (comissão) | ~25 € (créditos) |

**Se calcularem comissões a partir de `partner_earning_share_default`, passam a
dar zero — o que é o valor correto.** Se tiverem 0.65 escrito à mão nalgum
sítio, vai divergir. Procurem.

A receita passa a estar em `credit_transactions`, não em `payments.platform_fee`.

---

## 7. Verificação

### ▶️ CORRER NO SQL EDITOR — as funções novas existem?

```sql
SELECT proname, pronargs
  FROM pg_proc
 WHERE proname IN ('partner_register_adjustment', 'customer_review_adjustment')
 ORDER BY proname;
```

**Esperado:** 2 linhas — `customer_review_adjustment` com 3 argumentos e
`partner_register_adjustment` com 5.

### ▶️ CORRER NO SQL EDITOR — ajustes aplicados sem admin

```sql
SELECT a.id, a.status, a.reason, a.suggested_amount, a.reviewed_at,
       a.review_notes, r.final_price, r.status AS estado_pedido
  FROM public.service_adjustments a
  JOIN public.service_requests r ON r.id = a.request_id
 WHERE a.created_at > '2026-07-25'
 ORDER BY a.created_at DESC;
```

Linhas com `status = 'approved'` e `review_notes` a começar por "Automático:"
foram aplicadas sem intervenção humana — é o comportamento esperado.

### ▶️ CORRER NO SQL EDITOR — orçamentos com preço marginal

```sql
SELECT id,
       details->'breakdown'->'marginal'->>'unidade'         AS unidade,
       details->'breakdown'->'marginal'->>'incluidas'       AS incluidas,
       details->'breakdown'->'marginal'->>'valor_adicional' AS por_unidade,
       details->'breakdown'->>'teto_sem_nova_aprovacao'     AS teto,
       final_price, estimated_price
  FROM public.service_requests
 WHERE details->'breakdown'->'marginal' IS NOT NULL
 ORDER BY created_at DESC
 LIMIT 10;
```

Se devolver zero linhas, nenhum pedido passou ainda pelo motor novo.

```
═══════════════════════════════════════════════════════════════════════
   FIM — COPIAR PARA O PROJETO DO SITE
═══════════════════════════════════════════════════════════════════════
```
<!-- ═══════════════════════════════════════════════════════════════════════ -->

---

## Para ti, Wanderson — não copiar

**A ordem importa.** A secção 6 (comissão a zero) descreve a migração
`20260725120000_monetizacao_mvp_creditos.sql`, que **ainda não correste**. Se o
site se preparar para ela antes de tu a aplicares, ficam dessincronizados no
sentido inverso — o painel a mostrar 0% de comissão enquanto a base ainda cobra
35%.

Duas ordens possíveis, ambas seguras:

1. Corres a migração primeiro, avisas o site depois
2. O site prepara o código mas só o publica depois de tu correres

O que **não** funciona é o site publicar antes.

**As duas migrações do ajuste já correste:** `partner_register_adjustment` (5
args, confirmado) e `customer_review_adjustment` — confirma esta segunda com a
consulta da §7.

**Fica por resolver:** a taxa de deslocação quando o cliente recusa o ajuste. A
função devolve o trabalho a `in_execution` e não cobra nada a ninguém. Depende
de decidires se seguras uma caução — é a contradição do modelo de pagamento
direto que te apontei e continua em aberto.
