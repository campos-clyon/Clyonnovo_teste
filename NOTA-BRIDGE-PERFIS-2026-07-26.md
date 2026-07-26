# Quinta nota para o site — perfis, avaliações e uma fuga de dados

**26-07-2026.** Continuação das quatro anteriores. Esta cobre a migração
`20260725190000_perfis_e_avaliacoes.sql` (**já aplicada em produção**) e a
`20260726100000_protege_titular_de_espera.sql` (por aplicar).

> **Para o Wanderson:** copia tudo entre `INÍCIO` e `FIM`. O SQL vai inline.

```
═══════════════════════════════════════════════════════════════════════
   INÍCIO — COPIAR PARA O PROJETO DO SITE (clyon.pt/admin)
═══════════════════════════════════════════════════════════════════════
```

## ⛔ Primeiro: há um bloqueador por corrigir

**`partner_profiles.rating` é `NUMERIC(3,2)` — máximo 9,99.** Com a escala 0–10
(§4), uma única avaliação de 5 estrelas dá média `10,00` e a coluna recusa-a:
`numeric field overflow`, SQLSTATE 22003.

Quem escreve nessa coluna são **gatilhos** sobre `reviews`, portanto o erro
rebenta a transação inteira:

- o cliente não consegue gravar uma avaliação máxima;
- no backoffice, **`moderate_review` falha** — publicar ou esconder uma
  avaliação devolve um erro técnico sem contexto.

Ninguém deu por isso porque ainda não existe nenhuma avaliação real na base.

A correção vai no SQL do fim desta nota (secção 0b) e tem de ser aplicada
**antes** de qualquer avaliação ser criada.

---

## Resumo

1. ⛔ `partner_profiles.rating` não aceita 10 — corrigir já (acima).
2. `partner_profiles` deixou de ser legível por utilizadores comuns — expunha
   IBAN, NIF e a localização em tempo real dos profissionais. **Confirmem com
   que chave o backoffice lê a base** (§1).
3. O vocabulário e a escala das avaliações mudaram. Consultas que filtrem
   `reviewer_role = 'client'` passam a devolver zero (§3, §4).
4. Apareceu uma linha técnica em `partner_profiles` que **não é um
   profissional** e tem de sair de todas as listagens e métricas (§6).
5. Precisamos que corram um diagnóstico e nos digam o resultado (§11).

---

## 1. ⚠️ `partner_profiles` — política de leitura pública removida

Existia isto desde o primeiro dia:

```sql
CREATE POLICY "Approved partners public read" ON public.partner_profiles
  FOR SELECT TO authenticated USING (status = 'approved');
```

RLS é **por linha, não por coluna**. Qualquer conta com sessão iniciada — um
cliente qualquer — podia ler a linha inteira de todos os profissionais
aprovados:

| Coluna | O que expunha |
|---|---|
| `iban` | conta bancária |
| `nif`, `legal_name` | identificação fiscal |
| `address`, `base_address`, `base_lat/lng` | morada |
| `earning_share` | a comissão negociada com aquele profissional |
| `last_lat`, `last_lng`, `last_location_at` | **localização em tempo real** |

Não havia nenhum `REVOKE` de colunas em migração nenhuma. A política foi
removida.

### O que têm de verificar

**Se o backoffice lê a base com a `service_role` key**, o RLS é ignorado e
**não há nada a fazer** — continua tudo a funcionar.

**Se lê com a chave `anon`/`authenticated`**, todas as listagens de
profissionais deixaram de devolver linhas, em silêncio. Nesse caso, ou passam a
`service_role` (é um backend, é o correto), ou usam a vista do §2.

Não conseguimos ver o vosso código daqui — por favor confirmem qual é.

---

## 2. Duas vistas novas

### `partner_public_profiles`

O que um cliente pode ver de um profissional. Já traz calculado o que antes
obrigava a três consultas.

| Coluna | Notas |
|---|---|
| `id`, `trade_name`, `description`, `bio` | |
| `rating` | **escala 0–10** — ver §4 |
| `jobs_completed` | |
| `service_categories`, `regions`, `kind`, `has_vehicle` | |
| `avatar_url` | vem de `profiles`, não de `partner_profiles` |
| `verificado` | `true` = documentos `id` **e** `nif` aprovados |
| `total_avaliacoes` | contagem de avaliações publicadas de clientes |

Filtra `status = 'approved' AND is_system = false`.

### `partner_public_reviews`

`id, partner_id, rating, comment, created_at, quality_rating,
punctuality_rating, communication_rating`

Filtra `status = 'published' AND reviewer_role = 'customer'`.

> **Porque isto existe:** a app juntava `bookings` a `reviews` do lado do
> cliente. Como o RLS de `bookings` só devolve as reservas do próprio, cada
> cliente via apenas as avaliações que ele mesmo tinha escrito — uma página de
> reputação que não mostrava reputação nenhuma.

### Permissões

```sql
GRANT SELECT ON public.partner_public_profiles TO authenticated;
GRANT SELECT ON public.partner_public_reviews  TO authenticated;
```

**`anon` NÃO tem acesso.** Se o site público (clyon.pt, não o /admin) mostrar
perfis de profissionais a visitantes sem sessão, digam — acrescentamos o
`GRANT ... TO anon`. Não o fizemos por omissão porque expor perfis a anónimos é
uma decisão de produto, não técnica.

---

## 3. ⚠️ `reviews.reviewer_role`: `'client'` passou a `'customer'`

Havia duas migrações a contradizerem-se:

```
20260618002255 → CHECK (reviewer_role IN ('client','partner'))
202607131200   → CHECK recíproco que exige 'customer'
```

Escrever `'customer'` falhava a primeira. Escrever `'client'` falhava a
segunda. **Só `NULL` passava nas duas** — e era o que a app gravava. O gatilho
da reputação exige `'customer'`, portanto nunca disparava: a app dizia
"Obrigado!" e a média do profissional não mexia.

Ficou `'customer'`. As linhas existentes foram migradas.

**Ação vossa:** procurem no código do site por `'client'` associado a
`reviewer_role` ou `target_role`. Qualquer filtro assim devolve agora zero
linhas, sem erro.

---

## 4. ⚠️ Escala das avaliações: 0–10 é o canónico

`rating`, `quality_rating`, `punctuality_rating` e `communication_rating` são
todos **0–10**.

A app recolhe 5 estrelas e multiplica por 2 ao gravar; ao mostrar, divide por
2. A conversão está num único ficheiro do nosso lado
(`src/lib/avaliacoes.ts`), com testes.

**Porque importa:** o gatilho suspende automaticamente um profissional com
média `< 4` após 3 avaliações. Com a app a enviar estrelas em bruto, três
clientes a dar 3 estrelas ("razoável") gravavam 3/10 e **suspendiam o
profissional**.

| Estrelas | Guardado | Suspende? |
|---|---|---|
| 5 | 10 | não |
| 3 | 6 | não |
| 2 | 4 | não (está no limite) |
| 1 | 2 | sim, ao fim de 3 |

**Ação vossa:**
- Ao mostrar em estrelas: `rating / 2`.
- Ao mostrar em escala de 10: usar em bruto.
- **A migração multiplicou por 2 as linhas antigas** (as que tinham
  `reviewer_role IS NULL`, marcador de "gravada pela app antiga"). Se tinham
  relatórios exportados ou valores em cache, os números mudaram.

---

## 5. Esconder uma avaliação não baixava a média — corrigido

O `moderate_review` põe `status = 'hidden'`. O gatilho da reputação começava
com:

```sql
IF NEW.reviewer_role = 'customer' AND NEW.status = 'published' THEN
```

Ao esconder, a condição ficava falsa e **a média não era recalculada**. A
avaliação saía da vista e continuava a contar no número.

É o pior dos dois mundos: o profissional deixava de ver a acusação e continuava
a pagar por ela.

Corrigido na migração `20260726100000` — sai o `AND NEW.status = 'published'`
da condição (a consulta interna já filtra por `published`). A mesma migração
recalcula as médias já gravadas.

**Ação vossa:** nenhuma. Mas passem a contar com o efeito: esconder uma
avaliação altera o `rating` do profissional imediatamente.

---

## 6. ⚠️ Nova linha técnica em `partner_profiles`

```
trade_name = 'CLYON — por atribuir'
status     = 'pending'
user_id    = NULL
is_system  = true
```

**Não é um profissional.** É o titular das reservas criadas no checkout antes
de existir profissional atribuído — `bookings.partner_id` é `NOT NULL` e
`payments.booking_id` também, portanto o pagamento exige uma reserva e a
reserva exige um profissional, antes de haver profissional.

Antes disto, o `Checkout.tsx` escolhia **um profissional ao acaso**
(`select id from partner_profiles limit 1`) e, se não encontrasse nenhum,
**criava um perfil `status:'approved'` em nome do próprio cliente**.

### Ação vossa — obrigatória

Acrescentámos a coluna `partner_profiles.is_system boolean NOT NULL DEFAULT false`.

**Excluam `is_system = true` de:**
- listagens de profissionais
- **fila de aprovação** (senão aparece lá para aprovar)
- contagens e métricas ("nº de profissionais", "trabalhos por profissional")
- exportações

```sql
-- em todas as consultas a partner_profiles
WHERE ... AND is_system = false
```

A base recusa aprová-la ou eliminá-la (gatilho
`trg_protege_titular_de_espera`), mas o botão continua a aparecer no vosso ecrã
se não filtrarem — e o administrador leva um erro sem contexto.

### `clyon_placeholder_partner()`

Função nova, `SECURITY DEFINER`, devolve o `id` dessa linha.

Uma reserva cujo `partner_id` seja esse valor significa **"ainda sem
profissional atribuído"**. Qualquer relatório de "trabalhos por profissional"
tem de a tratar como não atribuída, não como um profissional com muitos
trabalhos.

---

## 7. `partner_profiles.user_id` passou a aceitar `NULL`

Só por causa da linha do §6. Não é um relaxamento de segurança: as políticas
comparam `auth.uid() = user_id`, e `NULL` nunca é igual a nada — ninguém pode
reclamar essa linha como sua.

**Ação vossa:** se fazem `INNER JOIN` de `partner_profiles` a `auth.users` ou a
`profiles`, essa linha desaparece do resultado (o que normalmente é o que
querem) — mas as **contagens mudam**. Se usam `LEFT JOIN`, aparece com campos a
`NULL`.

---

## 8. Quem pode escrever uma avaliação

A política antiga só verificava que o autor era o próprio:

```sql
CREATE POLICY "Author creates own reviews" ... WITH CHECK (author_id = auth.uid());
```

Ou seja, **qualquer utilizador podia avaliar qualquer reserva**, incluindo
reservas de outras pessoas. Substituída por `"Parties review after completion"`,
que exige:

- `author_id = auth.uid()`
- ser parte da reserva (cliente **ou** o profissional atribuído)
- `reviewer_role` coerente com o lado
- pedido em `completed` ou `awaiting_confirmation`

A política de administração (`"Admins manage reviews" FOR ALL`) mantém-se — o
backoffice continua a poder criar e moderar sem restrições.

---

## 9. Perfis: cada lado passa a ver o outro

Duas políticas novas em `profiles`, ambas limitadas a **enquanto existe uma
reserva que liga as duas pessoas**:

- `"Partner reads assigned customer"` — o profissional lê o nome e telefone do
  cliente do trabalho que lhe foi atribuído.
- `"Customer reads assigned partner"` — o cliente lê o nome e a foto do
  profissional.

> Isto estava em falta e era invisível: o `PartnerJob.tsx` pedia
> `full_name, phone` de `profiles` e o RLS devolvia **zero linhas sem erro**. O
> bloco do cliente nunca aparecia, e o código parecia estar bem.

Sem impacto no backoffice — é adição, não remoção.

---

## 10. Pendente — decisão vossa e nossa

`bookings.request_id` é **UNIQUE**, e há dois caminhos que criam reservas:

1. o checkout (agora com o titular de espera do §6)
2. `respond_job_offer` / `accept_service_request`, quando um profissional aceita

O segundo faz `INSERT` sem `ON CONFLICT`. Quando um profissional aceitar um
trabalho já pago, **o `INSERT` colide e a aceitação falha**.

Nunca deu problema porque o fluxo ponta-a-ponta nunca chegou lá.

Duas saídas:

| | O quê | Custo |
|---|---|---|
| **A** | `ON CONFLICT (request_id) DO UPDATE SET partner_id = EXCLUDED.partner_id` nas duas funções | ~200 linhas a reescrever; desbloqueia hoje |
| **B** | `payments.booking_id` aceita nulo e ganha `request_id`. O pagamento liga-se ao pedido; a reserva só nasce quando há profissional real | mexe no vosso modelo de pagamentos; é o desenho correto |

Recomendamos **B**. Digam-nos qual preferem — se for B, mandamos nota
específica antes de mexer.

---

## 11. ❓ Diagnóstico que precisamos que corram

Há um gatilho declarado sobre `reviews` que nos parece impossível de executar,
e não conseguimos confirmar daqui se está mesmo na base:

```sql
-- 20260618003248_bdab7af9...sql:599-614
CREATE FUNCTION private.trg_recompute_trust_partner() ...
  _pid := COALESCE(NEW.partner_id, OLD.partner_id);
...
CREATE TRIGGER trg_trust_on_review AFTER INSERT OR UPDATE OR DELETE ON public.reviews
```

**`reviews` não tem coluna `partner_id`.** Se este gatilho estiver ativo,
qualquer escrita em `reviews` falha com `record "new" has no field
"partner_id"` — o que tornaria as avaliações completamente impossíveis, e não
só as de nota máxima.

Suspeitamos que a migração `20260618003248` não chegou a ser aplicada por
inteiro (existe uma `20260724150000_recupera_objetos_202607131200.sql` que
sugere precisamente isso), mas é preciso confirmar:

```sql
SELECT t.tgname,
       n.nspname || '.' || p.proname AS funcao,
       t.tgenabled
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE t.tgrelid = 'public.reviews'::regclass
   AND NOT t.tgisinternal
 ORDER BY t.tgname;
```

**Digam-nos o que devolve.** Se `trg_trust_on_review` aparecer, temos de o
corrigir ou remover antes de qualquer avaliação existir.

---

## SQL a correr (migração `20260726100000`)

A `20260725190000` **já está aplicada**. Falta esta:

```sql
BEGIN;

-- 0a) marca das linhas de sistema (tudo o resto a usa nos guardas)
ALTER TABLE public.partner_profiles
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

UPDATE public.partner_profiles SET is_system = true
 WHERE trade_name = 'CLYON — por atribuir';

COMMENT ON COLUMN public.partner_profiles.is_system IS
  'true = linha tecnica da CLYON, nao e um profissional real. Excluir de listagens, filas de aprovacao e metricas.';

-- 0b) ⛔ CRITICO: a coluna da media nao aceitava 10,00
ALTER TABLE public.partner_profiles
  ALTER COLUMN rating TYPE numeric(4,2);

COMMENT ON COLUMN public.partner_profiles.rating IS
  'Media das avaliacoes publicadas, escala 0-10. numeric(4,2) e nao (3,2): (3,2) tem maximo 9,99 e rejeitava a media perfeita.';

-- O mesmo teto estava num cast dentro da funcao. Resto do corpo inalterado.
CREATE OR REPLACE FUNCTION public.recompute_partner_rating(_partner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  _avg numeric; _count int; _completed int;
  _min_reviews int; _min_rating numeric;
BEGIN
  -- Era AVG(r.rating)::numeric(3,2) — rebentava aqui.
  SELECT ROUND(AVG(r.rating)::numeric, 2), COUNT(*)
    INTO _avg, _count
  FROM public.reviews r
  JOIN public.bookings b ON b.id = r.booking_id
  WHERE b.partner_id = _partner_id
    AND r.target_kind = 'partner' AND r.status = 'published';

  SELECT COUNT(*) INTO _completed
  FROM public.bookings
  WHERE partner_id = _partner_id AND status = 'completed';

  UPDATE public.partner_profiles
  SET rating = COALESCE(_avg, 0),
      jobs_completed = COALESCE(_completed, 0),
      updated_at = now()
  WHERE id = _partner_id AND COALESCE(is_system, false) = false;

  SELECT COALESCE(value, 5)   INTO _min_reviews FROM public.pricing_parameters WHERE key = 'quality_min_reviews' LIMIT 1;
  SELECT COALESCE(value, 3.5) INTO _min_rating  FROM public.pricing_parameters WHERE key = 'quality_min_rating'  LIMIT 1;

  IF _count >= COALESCE(_min_reviews, 5) AND COALESCE(_avg, 5) < COALESCE(_min_rating, 3.5) THEN
    UPDATE public.partner_profiles
    SET status = 'suspended'::partner_status,
        rejection_reason = COALESCE(rejection_reason, 'Qualidade abaixo do limite (' || _avg || ')'),
        updated_at = now()
    WHERE id = _partner_id AND status = 'approved'::partner_status
      AND COALESCE(is_system, false) = false;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protege_titular_de_espera()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp
AS $function$
BEGIN
  IF OLD.trade_name = 'CLYON — por atribuir' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'O titular de espera das reservas não pode ser eliminado: há reservas a apontar para ele.' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'O titular de espera das reservas não é um profissional real e não pode mudar de estado.' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.trade_name IS DISTINCT FROM OLD.trade_name THEN
      RAISE EXCEPTION 'O nome do titular de espera é usado para o encontrar e não pode mudar.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  -- Num BEFORE DELETE, NEW e NULL: devolver NEW cancelaria a eliminacao de
  -- QUALQUER profissional, em silencio.
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protege_titular_de_espera ON public.partner_profiles;
CREATE TRIGGER trg_protege_titular_de_espera
  BEFORE UPDATE OR DELETE ON public.partner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protege_titular_de_espera();

CREATE OR REPLACE VIEW public.partner_public_profiles
WITH (security_barrier = true, security_invoker = false) AS
SELECT p.id, p.trade_name, p.description, p.bio, p.rating, p.jobs_completed,
       p.service_categories, p.regions, p.kind, p.has_vehicle, p.created_at,
       pr.avatar_url,
       (SELECT bool_and(d.status = 'approved') FROM public.partner_documents d
         WHERE d.partner_id = p.id AND d.doc_type IN ('id','nif')) AS verificado,
       (SELECT count(*) FROM public.reviews r
          JOIN public.bookings b ON b.id = r.booking_id
         WHERE b.partner_id = p.id AND r.reviewer_role = 'customer'
           AND r.status = 'published') AS total_avaliacoes
FROM public.partner_profiles p
LEFT JOIN public.profiles pr ON pr.id = p.user_id
WHERE p.status = 'approved' AND p.is_system = false;

REVOKE ALL ON public.partner_public_profiles FROM PUBLIC;
REVOKE ALL ON public.partner_public_profiles FROM anon;
GRANT SELECT ON public.partner_public_profiles TO authenticated;

CREATE OR REPLACE FUNCTION private.refresh_reputation_after_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  _partner_id uuid; _average numeric; _count integer;
BEGIN
  SELECT b.partner_id INTO _partner_id FROM public.bookings b WHERE b.id = NEW.booking_id;

  IF NEW.reviewer_role = 'customer' THEN
    SELECT ROUND(AVG(r.rating)::numeric, 2), COUNT(*)::integer INTO _average, _count
    FROM public.reviews r JOIN public.bookings b ON b.id = r.booking_id
    WHERE b.partner_id = _partner_id AND r.reviewer_role = 'customer'
      AND r.status = 'published';

    UPDATE public.partner_profiles
    SET rating = COALESCE(_average, 0),
        status = CASE WHEN _count >= 3 AND COALESCE(_average, 0) < 4
                      THEN 'suspended'::public.partner_status ELSE status END,
        suspension_reason = CASE WHEN _count >= 3 AND COALESCE(_average, 0) < 4
          THEN 'Suspensao automatica para revisao: media inferior a 4/10 apos pelo menos 3 avaliacoes.'
          ELSE suspension_reason END,
        suspended_until = CASE WHEN _count >= 3 AND COALESCE(_average, 0) < 4
                               THEN NULL ELSE suspended_until END,
        updated_at = now()
    WHERE id = _partner_id AND is_system = false;
  END IF;

  RETURN NEW;
END;
$function$;

UPDATE public.partner_profiles p
   SET rating = COALESCE(sub.media, 0), updated_at = now()
  FROM (
    SELECT b.partner_id, ROUND(AVG(r.rating)::numeric, 2) AS media
      FROM public.reviews r JOIN public.bookings b ON b.id = r.booking_id
     WHERE r.reviewer_role = 'customer' AND r.status = 'published'
     GROUP BY b.partner_id
  ) sub
 WHERE p.id = sub.partner_id AND p.is_system = false
   AND p.rating IS DISTINCT FROM sub.media;

COMMIT;
```

### Verificação

```sql
SELECT
  (SELECT numeric_scale IS NOT NULL AND numeric_precision = 4
     FROM information_schema.columns
    WHERE table_name='partner_profiles' AND column_name='rating')      AS rating_4_2_deve_ser_true,
  (SELECT count(*) FROM public.partner_profiles WHERE is_system)        AS sistema_deve_ser_1,
  (SELECT count(*) FROM pg_policy WHERE polrelid='public.partner_profiles'::regclass
     AND polname='Approved partners public read')                       AS fuga_deve_ser_0,
  (SELECT count(*) FROM public.reviews WHERE reviewer_role='client')    AS papel_antigo_deve_ser_0,
  (SELECT count(*) FROM pg_views WHERE schemaname='public'
     AND viewname IN ('partner_public_profiles','partner_public_reviews')) AS vistas_deve_ser_2;
```

Esperado: `true`, `1`, `0`, `0`, `2`.

```
═══════════════════════════════════════════════════════════════════════
   FIM
═══════════════════════════════════════════════════════════════════════
```
