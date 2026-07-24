# Alterações de 24-07-2026 — o que o site tem de rever

> Tudo o que segue **já está aplicado em produção** (`clyon-staging` / `main`).
> Não é proposta: é o estado atual da base de dados.
> Complementa o [`CONTRATO.md`](CONTRATO.md) — que foi **atualizado depois** de o
> terem copiado; ver §5 desta nota.

---

## 1. 🔴 CRÍTICO — aprovar sem preço cria pedidos invisíveis

O trigger só publica aos profissionais se `COALESCE(final_price, estimated_price, 0) > 0`.

Se o painel colocar um pedido em `confirmed` **sem preço**, acontece o seguinte:

- o pedido fica em `confirmed`
- o trigger corre, vê preço 0 e **não cria ofertas**
- nenhum profissional o vê
- **não há erro nenhum** — a operação parece ter sucesso

A `admin_approve_request` protege contra isto (`RAISE EXCEPTION 'Não é possível
aprovar pedido sem preço definido.'`). Mas o painel escreve `status` diretamente
via `patch_request_with_audit`, o que **salta essa validação**.

**Ação:** enquanto as escritas diretas existirem, o painel tem de recusar ele
próprio a aprovação sem preço. É uma guarda de uma linha que evita pedidos
silenciosamente perdidos.

Havia um pedido nestas condições esta manhã (total 0,00 € com itens de 75 € e
80 € listados).

---

## 2. Não publicar manualmente — o trigger já o faz

Ao entrar em `confirmed` (ou `assignment_pending`), o trigger
`trg_auto_match_request`:

1. cria uma oferta `pending` para **cada** parceiro aprovado
2. com `expires_at = NULL` (sem prazo)
3. avança `confirmed` → `assignment_pending`

Já removeram o `partner-publish.ts` — correto. Confirmem que não resta nenhuma
chamada a `broadcast_request_to_partners` ou `publish_request_to_eligible_partners`
no fluxo de aprovação. A guarda anti-duplicação impede ofertas repetidas, por
isso não parte nada, mas é trabalho redundante.

---

## 3. Ofertas deixaram de ter prazo — e há um cron novo

**Porquê:** uma oferta com `expires_at` no passado mantinha `status = 'pending'`
para sempre. Ficava invisível na vista (que exige `expires_at > now()`) **e**
bloqueava a guarda anti-duplicação (que testava `status IN ('pending','accepted')`).
O pedido ficava preso: ninguém o via e não se podia republicar. Foi o que
prendeu o pedido de 600 € (`fbe4c5ea`).

**O que mudou:**

- ofertas criadas pelo trigger têm `expires_at = NULL`
- a guarda passou a ignorar ofertas caducadas
- cron `clyon_expira_ofertas`, de 5 em 5 minutos, fecha as caducadas
  (`process_expired_job_offers(500)`)

**Ação no painel:** se a UI mostra "expira em X minutos" nas ofertas, esse campo
passa a estar vazio na maioria dos casos. E se o painel criar ofertas com prazo
(`broadcast_request_to_partners(_request_id, _expires_minutes)`), essas continuam
a caducar — agora fecham-se sozinhas, mas o pedido só volta a ser publicado no
próximo evento de mudança de estado. Preferir sem prazo.

---

## 4. Uma conta = um papel, imposto na base

Novo trigger `trg_user_roles_single_role` em `user_roles`. Qualquer tentativa de
dar um segundo papel a uma conta falha com:

```
ERRCODE 23514 — "Esta conta já está associada a outro tipo de utilizador."
```

Verificado antes de ativar: 0 contas com dois papéis, em 5 contas com papel.

**Ação:** qualquer código do painel que insira em `user_roles` (criar admin,
promover utilizador) tem de tratar o erro `23514` com mensagem legível, em vez
de rebentar com erro genérico.

---

## 5. O CONTRATO.md mudou depois de o copiarem

O **§9 (teste de regressão)** foi corrigido: a versão que copiaram só detetava
pedidos aprovados **com preço** e sem oferta. Tinha um ponto cego — pedidos
aprovados **sem preço** também ficam invisíveis e passavam despercebidos.

A versão atual cobre as duas causas numa consulta. **Voltem a copiar o ficheiro.**

Esse teste deve correr após cada deploy dos dois lados. Deve devolver 0 linhas.
Estado verificado hoje: 0 ✅

---

## 6. `geral@clyon.pt` foi eliminada

A conta foi apagada do Supabase Auth em 24-07-2026.

Consequência: `is_primary_admin` e `primary_admin_grant_admin` **não foram
criadas** na base — foram deliberadamente excluídas da migração porque
dependiam dessa conta e devolveriam sempre `false`.

**Ação:** se algum código do site chamar essas funções, falha com "function does
not exist". Confirmar que não são usadas.

---

## 7. Novidade utilizável: `simulator_settings`

Tabela nova com os **17 parâmetros do motor de preços** (custo/km, custo/hora,
margem, mínimos por escalão de entulho, etc.), agora editáveis sem recompilar a app.

⚠️ **Atenção aos nomes das chaves.** O `DEPLOY_CHECKLIST.md` do Bridge documentava
17 chaves com nomes **completamente diferentes** (`fuel_cost_per_km`,
`margin_multiplier`, …). A app ignora silenciosamente qualquer chave que não
exista em `SimulatorSettings` — usar os nomes do checklist criaria uma tabela
que parece funcionar e não faz nada. Os nomes corretos estão na migração
`20260724140000_simulator_settings.sql`.

**Oportunidade para o painel:** um ecrã de edição destes parâmetros. Duas notas
se o fizerem:

- a app faz **cache dos valores em memória** (`settingsCache` em
  `src/lib/fastEstimate.ts`) — alterações só se refletem depois de reiniciar a app
- os valores inseridos são iguais aos defaults compilados, por isso aplicar a
  migração não mudou nenhum preço

---

## 8. Ainda por decidir — bloqueia a migração para RPCs

As funções `admin_*` começam com `IF NOT has_role(auth.uid(), 'admin')`. Com a
chave `service_role`, **`auth.uid()` é NULL** → todas rebentam.

Ou seja, o painel **não consegue** chamar as RPCs de negócio tal como estão. O
§3 do CONTRATO.md descreve algo que hoje não é executável a partir do painel —
erro meu ao escrevê-lo sem verificar.

Duas saídas:

**A)** o painel autentica com um utilizador admin real do Supabase em vez de
`service_role` → as RPCs funcionam sem alterações, e o rasto de auditoria passa
a identificar quem fez o quê

**B)** as RPCs ganham um caminho que aceita `service_role` quando `auth.uid()` é
NULL → mais simples, mas todas as ações ficam anónimas no registo

Sem esta decisão, as escritas diretas de `status` mantêm-se, e com elas o risco
do ponto 1.

---

## 9. Nunca escrever estes estados

O enum `request_status` tem **19 valores**, três dos quais não pertencem ali:
`PENDING`, `SUCCESS`, `ERROR` — vocabulário de pagamento acrescentado ao enum
errado. Zero pedidos associados. Nunca os escrever.

Sequência canónica em uso hoje: `assignment_pending` (4 pedidos),
`partner_selected` (1), `canceled` (1). Os restantes 16 estados estão sem uso —
a máquina de estados ainda não foi validada na prática.

---

## Verificação rápida (correr no SQL Editor após cada deploy)

```sql
-- deve devolver 0 linhas
SELECT 'sem oferta ativa' AS causa, left(sr.id::text,8) AS pedido, sr.status::text
FROM public.service_requests sr
WHERE sr.status IN ('confirmed'::public.request_status,'assignment_pending'::public.request_status)
  AND coalesce(sr.final_price, sr.estimated_price, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.request_id=sr.id AND b.status<>'canceled')
  AND NOT EXISTS (SELECT 1 FROM public.job_offers jo WHERE jo.request_id=sr.id
                    AND jo.status='pending'::public.job_offer_status
                    AND (jo.expires_at IS NULL OR jo.expires_at > now()))
UNION ALL
SELECT 'aprovado sem preco', left(sr.id::text,8), sr.status::text
FROM public.service_requests sr
WHERE sr.status IN ('confirmed'::public.request_status,'assignment_pending'::public.request_status)
  AND coalesce(sr.final_price, sr.estimated_price, 0) <= 0;
```
