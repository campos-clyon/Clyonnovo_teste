# Auditoria de Setembro de 2026 — o que mudou

Ramo `auditoria-set-2026`, 31 commits, 106 ficheiros.
Base: o documento `CLYON-auditoria-2026-09-10.md`.

Cada item numerado tem o seu commit, com a mensagem a explicar o porquê. Este
ficheiro é o resumo para quem não vai ler trinta e um commits — e, sobretudo,
a **lista do que ficou por decidir**, que é a parte que interessa ao dono.

---

## Antes de tudo: a verificação que não existia

O repositório não tinha nenhum workflow. Os 117 ficheiros de teste nunca
corriam sozinhos, e a única rede era a build da Vercel, que verifica tipos mas
não corre testes.

Criou-se `.github/workflows/verificar.yml`: `pnpm check` e `pnpm test` a cada
push, em qualquer ramo. As falhas saem também como anotações, porque os
registos de um workflow só se descarregam com direitos de administrador do
repositório e as anotações lêem-se pela API pública.

**A primeira corrida encontrou nove testes a falhar em `main`.** Nenhum era um
defeito em produção — eram asserções que tinham ficado para trás de mudanças já
feitas, três delas com a taxa antiga do cliente (6 % em vez de 5 %). Estavam
assim há dias e ninguém podia saber. Ver `audit(0)`.

---

## O que mudou, por fase

### Fase 1 — ficheiros e assets

| # | O quê |
|---|---|
| 1 | 125 MB fora de `/public`: `clyon1.apk` (68 MB, e um APK descompila-se — levava as chaves do Supabase), `hero-video.mp4` (45 MB) e três `hero-*.jpg` que eram o mesmo ficheiro byte a byte. Nenhum era referenciado. `*.apk` e `*.mp4` no `.gitignore`. |
| 2 | `og-image` passa a existir. O `layout.tsx` apontava para `/og-image.jpg` em três sítios e o ficheiro nunca existiu: **todas as partilhas no WhatsApp e no Facebook saíam sem imagem**. Gera-se com o `ImageResponse` do Next em `/og-image.png`. |
| 3 | `.env.example` reescrito: faltavam 34 variáveis e sobravam 6. |
| 4 | O 410 de `/credito-fiscal` passa a acontecer. Os redirects do `next.config` correm antes do middleware, por isso o 410 nunca disparou uma única vez. |
| 5 | `/contacto/page.tsx` era código morto. |
| 6 | `theme_color` unificado em `#00B4CC`. |

### Fase 2 — desinformação

| # | O quê |
|---|---|
| 7 | "Limpeza pós-obra" sai de 26 sítios. O serviço está descontinuado (as páginas dele redireccionam), e continuava anunciado na descrição global, no schema, nas três regiões, em `/servicos`, `/precos`, `/faq` e `/sobre-nos`. Dois enganos apanhados de caminho: o cartão em `/servicos` ligava para `/limpeza-de-quintais` (jardinagem), e o preço divergia entre 150 € e 160 € para o mesmo trabalho. |
| 8 | A base deixa de ser da CLYON. |
| 9 | Seis páginas declaravam `PostalAddress` em Lisboa. |
| 10 | **19 declarações de negócio passam a uma.** A `/mudancas/<cidade>` inventava um `LocalBusiness` por cidade, com morada e coordenadas dessa cidade — o que a Google chama *misrepresentation of location*. |
| 11 | A home deixa de dizer "Confirmamos preço e data — ligamos-lhe" e "24+ cidades". |
| 12 | As avaliações de `/avaliacoes` vêm das constantes. |
| 13 | A Fixando sai de todas as meta descriptions e do texto visível. Fica em `/avaliacoes` e `/contactos`, onde a prova mora. Saem quatro capturas do perfil dela de `public/images`. |
| 14 | Ortografia AO90 no texto do cliente: páginas públicas, emails e mensagens do WhatsApp. |
| 14b | O mesmo no backoffice, a pedido do dono. 62 cadeias. |

### Fase 3 — SEO

| # | O quê |
|---|---|
| 15 | As páginas gémeas juntam-se. |
| 16 | Cinco páginas que existiam e nunca foram declaradas entram no sitemap. Os perfis dos profissionais deixam de levar a data de hoje a cada publicação. |
| 17 | Título de 87 para 59 caracteres. `sameAs` com TODO. |
| 18 | `/profissionais` (a raiz) abre e passa a ser indexável. |
| 19 | Oito páginas de freguesia deixam de pedir indexação. |

### Fase 4 — código duplicado

| # | O quê |
|---|---|
| 20 | Três componentes idênticos passam a `src/components/pedido/`, com os tipos unificados. |
| 21 | Dois endpoints de chat com 350 linhas quase iguais passam a um. |
| 22 | Sai o `bcrypt` nativo, que ninguém importava. |

### Fase 5 — posicionamento

| # | O quê |
|---|---|
| 23 | A home diz em voz alta a garantia que o código já dava: o pagamento fica retido até o cliente confirmar. |
| 24 | A landing de recrutamento diz que responder não custa nada. |
| 25 | "Sem IVA" passa a ter a conta feita ao lado. |

---

## Para o Search Console

**Endereços que passaram a 301:**

```
/retirar-moveis-velhos        → /recolha-de-moveis
/recolha-de-moveis-urgente    → /recolha-de-moveis
/recolha-de-sofa-lisboa       → /recolha-de-sofas
/retirada-de-moveis           → /recolha-de-moveis   (era cadeia de dois saltos)
/esvaziamento-casas-amadora   → /esvaziamento-de-casas-amadora
/recolha-monos-amadora        → /recolha-de-monos-amadora
```

**Endereço que passou a 410:** `/credito-fiscal`. Passava a 301 e o 410 nunca
chegava a acontecer.

**Endereços que deixaram de estar no sitemap e passaram a `noindex`:**

```
/recolha-entulho-benfica        /esvaziamento-casas-benfica
/recolha-entulho-lumiar         /esvaziamento-casas-lumiar
/recolha-entulho-alvalade       /esvaziamento-casas-alvalade
/recolha-entulho-olivais        /esvaziamento-casas-olivais
```

Continuam a responder a quem lá chegar. A lista está em `PAGINAS_SEM_PROCURA`
(`src/lib/seo-data.ts`) e **quem manda nela é o Search Console**: se alguma
trouxer impressões a sério, tira-se de lá.

**Endereços novos no sitemap:** `/como-funciona`, `/limpeza-de-quintais`,
`/profissionais`, `/privacidade`, `/cookies`.

**Páginas a pedir reindexação com prioridade** (o Google ainda mostra o texto
antigo em cache):

- Todas as que diziam "limpeza pós-obra" na descrição — a home, `/servicos`,
  `/precos`, as três regiões e as 108 programáticas.
- As que diziam "163 avaliações 5 estrelas no Fixando".
- `/mudancas/<cidade>`, pelas 13 fichas de negócio falsas que saíram.

---

## O que ficou por decidir — e é do dono

### 1. Morada comercial e o Map Pack

O schema principal deixou de declarar `geo` e `hasMap`, e as páginas deixaram
de declarar moradas de cidades servidas. **Isto fecha a porta ao Map Pack do
Google.** Já estava fechada: segundo a auditoria, o perfil de negócio foi
recusado sete vezes por falta de morada física.

Abri-la é a decisão da domiciliação ou escritório virtual (10–30 €/mês). Se a
tomar, volta a haver uma morada a sério para declarar, e aí faz sentido pôr o
`geo` de volta.

### 2. IVA nos preços públicos

Acrescentou-se um exemplo com a conta feita (100 € sem IVA são 123 € com IVA).
**Não se mudou o que os preços mostram.** Passar a mostrar o TOTAL em vez do
valor sem imposto é decisão sua com o contabilista — o próprio código já
reconhece que o DL 138/90 exige preço com imposto ao consumidor.

### 3. Os quatro componentes que divergiram

O item 20 juntou três dos sete. Os outros quatro divergiram entre o simulador
e a plataforma:

```
CompactOrderDetails      282 linhas diferentes
VolumeQuantitySelector    53 linhas diferentes
EntulhoDetails            32 linhas diferentes
MovelItemSelector          2 linhas diferentes
```

Com 282 linhas de diferença, "manter a versão mais recente" não é manter uma
versão: é substituir um dos dois ecrãs pelo outro. Precisa de ser decidido com
o ecrã à frente.

### 4. As três páginas finas que ficaram no repositório

`/retirar-moveis-velhos`, `/recolha-de-moveis-urgente` e
`/recolha-de-sofa-lisboa` passaram a 301, mas os ficheiros ficaram. Se houver
ali um parágrafo que valha a pena, funde-se na página que ficou antes de os
apagar.

### 5. O artigo do blogue sobre limpeza pós-obra

`limpeza-pos-obra-e-retirada-de-residuos` continua publicado. É conteúdo
editorial, não uma promessa de serviço, e traz visitas. Mas fala de um serviço
que a CLYON já não faz — decida se fica, se muda de ângulo, ou se sai.

### 6. O APK

`clyon1.apk` era servido em `clyon.pt/clyon1.apk`. Se distribuía a app por esse
link, ele deixou de funcionar. A razão de o tirar não foi o tamanho: um APK
descompila-se, e aquele levava as chaves do Supabase com ele.

---

## Coisas que a auditoria dizia e não se confirmaram

**A mensagem do `/api/admin/setup` já estava certa.** O documento dizia que ela
anuncia `custo_km=0.50` e `overhead=17.00` enquanto o motor usa `0.33` e
`15.30`. É ao contrário: o motor usa 0,50 e 17,00 (ver `pricing-helper.ts` e
`simulator-settings.ts`), e 0,33 e 15,30 são os valores antigos — o próprio
comentário dessa rota descreve a mudança nesse sentido. Não havia nada para
corrigir, e as regras da auditoria diziam para não tocar em `/api/admin/*`.

**O middleware tinha um problema que a auditoria não viu.** A lista de cidades
com página de mudanças tinha 19 nomes e só 13 têm página. Seis endereços
(`/mudancas-almada`, `-amadora`, `-cascais`, `-moita`, `-seixal`, `-setubal`)
faziam 301 para uma página que chama `notFound()`: **um redirect que morre num
404**, que é o pior dos dois mundos porque o Google deita fora o sinal
acumulado. Resolvido no `audit(4)`.

---

## Limites desta passagem

Feita numa máquina sem Node. Não correu `pnpm dev` nem `pnpm build`
localmente: a verificação foi o workflow novo (tipos e testes) e a build da
Vercel em cada push. As verificações de URL do item 26 (`/credito-fiscal` a
410, `/clyon1.apk` a 404, etc.) ficam por fazer contra o site a correr, e o
mesmo para o Rich Results Test do item 27.

O `pnpm-lock.yaml` perdeu à mão as duas entradas do `bcrypt`, porque não havia
como o regenerar. A instalação no workflow aceitou-o; na próxima instalação a
sério as entradas órfãs desaparecem sozinhas.
