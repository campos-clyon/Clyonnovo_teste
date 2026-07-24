# CONTRATO CLYON — App ↔ Supabase ↔ Backoffice

> Referência única partilhada pelos três sistemas.
> Ancorado na auditoria da base de dados real (`clyon-staging` / `main`) de
> **24-07-2026**, não na documentação anterior — que se provou desatualizada.
>
> Copiar este ficheiro para o projeto do site. O `order-status-flow.ts` do
> backoffice deve ser **gerado a partir daqui**, não mantido à mão.

---

## 1. Princípio

**A base de dados é a fonte de verdade. As regras de negócio vivem em funções
(RPC), não nos clientes.**

Nenhum sistema deve escrever `service_requests.status` diretamente. Toda a
mudança de estado passa por uma função que valida a transição e executa os
efeitos associados.

**Nota crítica sobre imposição:** o backoffice usa a chave `service_role`, que
**ignora RLS por definição**. Retirar políticas de `UPDATE` não o trava. A única
imposição eficaz é um trigger `BEFORE UPDATE` — os triggers disparam para todos
os roles. Ver §7.

---

## 2. Máquina de estados

`request_status` tem **19 valores** em produção. Apenas 3 estão em uso.

### Fluxo canónico

```
draft → received → in_review → confirmed → assignment_pending
      → partner_selected → in_route → arrived → in_execution
      → awaiting_confirmation → completed
```

### Ramos laterais

| Estado | Quando |
|---|---|
| `awaiting_deposit` | à espera de pagamento do cliente |
| `extra_review_requested` | profissional pediu reavaliação no local |
| `in_dispute` | conflito aberto |
| `canceled` | cancelado por qualquer das partes |
| `rejected` | recusado pela administração |

### Estados publicáveis

Só nestes dois o pedido é visível aos profissionais:

- `confirmed`
- `assignment_pending`

E **apenas** se: preço > 0, sem `booking` ativo, e com oferta em `job_offers`
não expirada.

### ⚠️ Valores que não pertencem a este enum

`PENDING`, `SUCCESS`, `ERROR` — vocabulário de pagamento/job acrescentado ao
enum errado. Zero pedidos associados. **Não usar.** Ver dívida em §8.

Os valores com ordem fracionária (`awaiting_deposit` 3.25,
`assignment_pending` 3.5, `arrived` 6.5, `extra_review_requested` 7.5) foram
acrescentados com `ALTER TYPE ... ADD VALUE` fora de migração.

---

## 3. Ações de negócio → função a chamar

**Esta é a API partilhada.** Existem ~29 funções que escrevem `status`; estas são
as que os clientes devem usar.

### Administração (backoffice)

| Ação | Função | Efeito no estado |
|---|---|---|
| Aprovar pedido | `admin_approve_request(_request_id)` | → `confirmed`. Exige preço definido. Rejeita se não estiver em `received`/`in_review`/`draft` |
| Rejeitar pedido | `admin_reject_request(_request_id, _reason)` | → `rejected` |
| Definir preço | `admin_update_request_price(_request_id, _final_price)` | não muda estado |
| Editar detalhes | `admin_update_service_request_details(_request_id, _patch, _reason)` | não muda estado |
| Atribuir parceiro | `assign_partner_to_request(_request_id, _partner_id, _notes)` | → `partner_selected` |
| Publicar a parceiros | `broadcast_request_to_partners(_request_id, _expires_minutes)` | cria ofertas |
| Confirmar conclusão | `admin_confirm_completion(_request_id)` | → `completed` |
| Registar pagamento manual | `admin_register_manual_payment(...)` | conforme método |
| Ajustar créditos | `admin_adjust_partner_credits(...)` | — |
| Moderar avaliação | `admin_moderate_review(...)` | — |

**Importante:** `admin_approve_request` **não publica** aos profissionais. A
publicação acontece pelo trigger `trg_service_requests_auto_match` ao entrar em
`confirmed` (corrigido em 24-07-2026). Não duplicar a publicação no backoffice.

### Cliente (app)

| Ação | Função |
|---|---|
| Aceitar orçamento | `customer_confirm_quote(_request_id)` |
| Marcar depósito pago | `customer_mark_deposit_paid(_request_id)` |
| Confirmar conclusão | `customer_confirm_completion(_request_id)` |
| Abrir disputa | `customer_open_dispute(_request_id, _reason)` |
| Cancelar | `cancel_service_request(_request_id, _reason)` |

### Profissional (app)

| Ação | Função |
|---|---|
| Responder a oferta | `respond_job_offer(_offer_id, _accept)` |
| Aceitar pedido | `accept_service_request(_request_id)` |
| Avançar fase | `partner_advance_request(_request_id)` |
| Pedir reavaliação | `partner_request_adjustment(_request_id, _reason, _suggested_amount, _notes)` |
| Atualizar localização | `update_partner_live_location(_lat, _lng)` |

### Manutenção

| Ação | Função | Estado |
|---|---|---|
| Fechar ofertas caducadas | `process_expired_job_offers(_limit)` | ⚠️ **existe mas nada a agenda** — ver §8 |
| Diagnosticar matching | `diagnose_partner_matching(_request_id)` | leitura |

---

## 4. Efeitos automáticos (triggers)

O que acontece sozinho quando alguém escreve. **Não replicar nos clientes.**

### `service_requests`

| Trigger | Efeito |
|---|---|
| `trg_service_requests_auto_match` | em `confirmed` ou `assignment_pending` com preço > 0: cria ofertas para todos os parceiros aprovados e avança `confirmed` → `assignment_pending` |
| `trg_service_requests_sync_booking` | sincroniza `bookings` a partir do estado |
| `trg_audit_service_request_status` | regista em `admin_audit_log` |
| `request_status_event` | regista em `request_events` |
| `trg_notify_status_change` | notificações |
| `trg_record_earning_on_completion` | cria ganho do profissional |
| `trg_refund_job_credits_on_early_cancellation` | devolve créditos |
| `protect_sr_critical_fields` | protege campos críticos |
| `trg_service_requests_risk` | recalcula risco |

### `job_offers`

| Trigger | Efeito |
|---|---|
| `trg_job_offers_advance` | ao recusar/expirar, tenta o seguinte |
| `trg_notify_new_offer` | notifica o profissional |

### `price_quotes`

| Trigger | Efeito |
|---|---|
| `trg_price_quotes_sync_request` | orçamento aprovado → pedido em `confirmed` |

---

## 5. Vocabulários secundários

```
app_role         : customer, partner, admin
job_offer_status : pending, accepted, declined, expired, canceled
partner_status   : pending, in_review, approved, rejected, suspended
```

`bookings.status` é **texto livre**, não enum — dívida conhecida.

### Visibilidade de oportunidades

Um profissional vê uma oportunidade (`partner_offer_previews`) apenas se:

1. `partner_profiles.user_id = auth.uid()` **e** `status = 'approved'`
2. `job_offers.status = 'pending'`
3. `expires_at IS NULL OR expires_at > now()`
4. `service_requests.status IN ('confirmed', 'assignment_pending')`

Antes de aceitar, **nunca** são expostos: morada exata, contacto do cliente,
total pago pelo cliente. Só zona, categoria, acesso, volume e ganho estimado.

---

## 6. Eventos e auditoria

Duas tabelas, ambas em uso, com vocabulários **inconsistentes**:

- `admin_audit_log` — praticamente vazia (2 registos). O backoffice não está a
  registar aqui.
- `request_events` — em uso (18 registos), mas com duas convenções a coexistir:
  `status_changed` e `status.<estado>`.

**Convenção a adotar** (a definir em conjunto, depois normalizar o histórico):

```
request.created
status.<estado_destino>
admin.<acao>
partner.<acao>
```

E **`actor_role` deve ser sempre preenchido** — hoje muitos registos têm
`(sem papel)`, o que torna a auditoria inútil para saber quem fez o quê.

---

## 7. Imposição

RLS **não** trava o backoffice (`service_role` ignora-a). O mecanismo correto:

```sql
CREATE TRIGGER trg_valida_transicao
BEFORE UPDATE OF status ON public.service_requests
FOR EACH ROW EXECUTE FUNCTION public.valida_transicao_estado();
```

A função rejeita transições ilegais. Para distinguir "veio de RPC autorizada" de
"escrita direta", o padrão é a RPC marcar a sessão:

```sql
PERFORM set_config('clyon.via_rpc', 'on', true);
```

e o trigger verificar `current_setting('clyon.via_rpc', true)`.

**Risco a assumir:** se uma RPC esquecer a marca, bloqueia-se a si própria.
Implementar com todas as RPCs cobertas e testar antes de ativar em produção.

---

## 8. Dívida identificada na auditoria

| # | Problema | Impacto |
|---|---|---|
| 1 | `PENDING`/`SUCCESS`/`ERROR` no enum `request_status` | confusão; risco de escrita acidental |
| 2 | `process_expired_job_offers` existe mas **nada a agenda** | ofertas ficam `pending` após expirar, invisíveis **e** bloqueantes — causou o bug de 24-07 |
| 3 | Histórico de migrações dessincronizado (16 remotas sem ficheiro, 6 locais por aplicar) | qualquer `db push` é arriscado |
| 4 | `admin_audit_log` quase vazia | sem rasto de quem mudou o quê |
| 5 | `actor_role` frequentemente nulo em `request_events` | auditoria incompleta |
| 6 | Duas convenções de nomes de evento | impossível consultar de forma fiável |
| 7 | `bookings.status` é texto livre | valores inválidos possíveis |
| 8 | 16 dos 19 estados sem uso | máquina de estados por validar na prática |

**Prioridade:** #2 e #3. O #2 volta a partir a app sozinho com o tempo; o #3
bloqueia qualquer trabalho estruturado na base.

---

## 9. Teste de regressão

Correr após **qualquer** alteração ao fluxo. Deve devolver **zero linhas**.
Se devolver, há pedidos aprovados invisíveis aos profissionais.

```sql
SELECT left(sr.id::text, 8) AS pedido, sr.status::text, sr.created_at
FROM public.service_requests sr
WHERE sr.status IN ('confirmed'::public.request_status,
                    'assignment_pending'::public.request_status)
  AND coalesce(sr.final_price, sr.estimated_price, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.bookings b
                  WHERE b.request_id = sr.id AND b.status <> 'canceled')
  AND NOT EXISTS (SELECT 1 FROM public.job_offers jo
                  WHERE jo.request_id = sr.id
                    AND jo.status = 'pending'::public.job_offer_status
                    AND (jo.expires_at IS NULL OR jo.expires_at > now()));
```

Estado em 24-07-2026 após correção: **0 linhas** ✅

Auditoria completa em [`supabase/audit/auditoria-estado-real.sql`](supabase/audit/auditoria-estado-real.sql).

---

## 10. Divisão de responsabilidades

| | Bridge (este repo) | Site / Backoffice |
|---|---|---|
| `supabase/migrations/` | **dono** | consome, não cria |
| `CONTRATO.md` | **dono** | copia |
| Tipos gerados | `supabase gen types` | idem, da mesma base |
| Escrita na BD | via RPC | via RPC (nunca `UPDATE status`) |

**Ordem obrigatória na consolidação:** reconciliar primeiro o histórico do
Bridge (dívida #3), só depois absorver as migrações 001–006 do site. Fundir por
cima da deriva atual cria um terceiro histórico divergente.
