# Prompt para amanhã — corrigir o que a auditoria de 11-09-2026 encontrou

> Cola isto numa sessão nova do Claude Code, na raiz do repositório.

---

Lê primeiro `docs/auditoria-2026-09-11.md`. É a auditoria de ontem: 103 achados sobre o
clyon.pt, com caminho:linha e prova. Hoje vamos corrigir, por ordem, e não vamos corrigir
tudo — vamos corrigir o que faz mal a alguém.

## Como quero que trabalhes

1. **Verifica antes de mexer.** Só cinco achados foram confirmados por uma pessoa (os da
   secção 1 do relatório). Os outros vêm de agentes e **a verificação adversarial não
   chegou a correr**. Para cada item, abre o ficheiro, lê o código à volta, e confirma
   que o problema existe como está descrito. **Se não existir, diz-me e passa ao
   seguinte** — não inventes uma correcção para justificar o achado.
2. **Um commit por item numerado**, com a mensagem a explicar o *porquê*, no estilo do
   repositório (português de Portugal, a citar o problema real). Nada de commits
   caça-tudo.
3. **NÃO TOCAR** em `src/lib/pricing-helper.ts`, `src/lib/taxas-plataforma.ts`,
   `src/auth.ts` (excepto o item 4.2, que é lá dentro e está explicado), na lógica de
   autenticação do `middleware.ts`, nem em nada de `/api/admin/*` sem me perguntar.
4. **Para cada ficheiro que apagares, confirma antes com grep que não é referenciado.**
5. **Se algo for ambíguo, PARA e pergunta.** Há quatro decisões que são minhas e estão na
   secção 9 do relatório.
6. **Empurra para o `main` e vê a acção `verificar` passar** antes de me dizeres que está
   feito. Há 125 ficheiros de teste que lêem o código-fonte e exigem frases exactas: se
   mudares texto, há testes a acompanhar.
7. Não abras servidor nem tentes correr `pnpm` — não há Node nesta máquina. A verificação
   é a acção do GitHub e o build do Vercel.

## Bloco 1 — Parar de expor e de enganar (é para hoje)

**1.1 A morada de casa de um profissional está no Google.**
`https://clyon.pt/profissionais/fred` tem no `<title>` e na meta description
`R. dos Jasmins 3, Amora`. A causa é `src/lib/perfil-publico-do-profissional.ts:122`, que
lê a coluna `city` de `providers` — e essa coluna tem moradas completas de dados antigos.
Corta para a localidade antes de publicar (e só aí; a distância continua a usar o valor
completo). Acrescenta teste. Diz-me quantas linhas de `providers` têm número de porta no
`city`, para eu decidir se limpo a base.

**1.2 O perfil «Fred Teste» está indexado e no sitemap.**
Filtra de `slugsDosProfissionais` quem não estiver activo e aprovado. Antes disso,
lista-me os profissionais que hoje aparecem no sitemap — quero ver os quatro.

**1.3 XSS no JSON-LD do perfil público.**
`src/app/profissionais/[slug]/page.tsx:179` usa `JSON.stringify` dentro de
`dangerouslySetInnerHTML`. A função certa já existe e nunca foi chamada:
`jsonParaScript` em `src/lib/escapar-html.ts:58`. Troca lá, e nas outras ocorrências do
mesmo padrão em `src/app`. Acrescenta um teste que chumbe `JSON.stringify` dentro de
`dangerouslySetInnerHTML`, à imagem de `promessa-do-dinheiro.test.ts`.

**1.4 O seguro que não existe.**
`src/app/mudancas/page.tsx:110` e `:226` prometem «Seguro de responsabilidade civil
incluído». Não há apólice nenhuma no produto. **Pergunta-me primeiro** se existe seguro:
se não existir, tira as duas frases hoje.

**1.5 «Nós fazemos» onde quem faz é um terceiro.**
`src/app/mudancas/page.tsx:103-108, :225` vende equipas e camiões próprios. `/sobre-nos`
descreve uma empresa executante e nunca diz que a CLYON é um marketplace. Reescreve as
duas na terceira pessoa. O texto certo já existe e está pronto em
`src/lib/pagamento-na-plataforma.ts` (`SEM_COBRANCA.faqQuemFaz`, `faqQuemResponde`) e em
`src/lib/como-funciona-para-o-profissional.ts`.

**1.6 O rodapé diz que a CLYON recebe pagamentos.**
`src/components/Footer.tsx:75-79` mostra «Pagamentos: Revolut, MB WAY, Novo Banco» em
todas as páginas. `A_PLATAFORMA_COBRA = false`. Corrige também `src/app/faq/page.tsx:146`
(«Emitimos fatura sempre», que contradiz a FAQ logo a seguir) e
`src/app/servicos/page.tsx:177`. Lê de `PROMESSA`, não escrevas texto novo à mão.

**1.7 Notas de estratégia de SEO publicadas ao cliente.**
`src/app/[...slug]/page.tsx:872, 902, 933`, `src/app/regioes/page.tsx:37-38` e
`src/lib/blog-data.ts:287`. Frases como «Esta página precisa de deixar clara a intenção
comercial» estão visíveis em produção. Reescreve-as como texto para o cliente.

**1.8 Todas as partilhas do site saem sem imagem.**
`https://clyon.pt/og-image.jpg` devolve **404** — o ficheiro não existe. É referenciado
três vezes em `src/app/layout.tsx` (Open Graph, Twitter, e o `image` do LocalBusiness em
JSON-LD, que vai nas 165 páginas). E **34 das 35 rotas que declaram `openGraph` não
declaram `images`**, pelo que em Next.js o do filho substitui o do layout e `og:image`
não é emitido em página nenhuma. Cria a imagem (1200×630) e centraliza num helper
`ogDe({title, description, url})` que inclua sempre as `images`, para não se voltar a
perder. Teste que faça fetch de N rotas e exija `og:image`.

**1.9 O EXIF das fotografias.**
`src/lib/reduzir-imagem.ts` só recodifica imagens acima de 1 MB e 1920 px — as outras
chegam intactas, com GPS, e são mostradas aos profissionais **antes do contrato**. Tira
os metadados no servidor, no ponto por onde tudo passa
(`/api/simulador/upload-fotos` e o caminho da URL assinada).

**1.10 PERGUNTA ANTES DE TUDO O RESTO: há cópia de segurança da base?**
`vercel.json` agenda `/api/cron/purgar-pedidos` para as 04:30 **todos os dias**, e a
função apaga a linha do pedido, as negociações e as fotografias. Uma busca por
`backup|cópia de seguran|restore|mysqldump` no repositório inteiro não devolve nada.
Não escrevas código para isto — **pergunta-me** se o Railway tem cópias automáticas e se
alguém já restaurou uma. Se a resposta for não, o teu primeiro trabalho do dia é pôr a
purga em modo de ensaio (registar o que apagaria, sem apagar) e escrever
`docs/recuperar-a-base.md`.

## Bloco 2 — Bugs que custam dinheiro

Confirma cada um com um exemplo numérico teu antes de corrigir.

**2.1** IVA a dobrar — `src/lib/valor-de-arranque.ts:49` prefere `estimatedPriceWithVat`
num sistema onde tudo é base sem IVA.
**2.2** Ecrã de sucesso quando a gravação falhou — `SimulatorThreePhaseForm.tsx:521` e
`FormularioDePedido.tsx:443`.
**2.3** «Os profissionais já receberam o pedido» quando ninguém recebeu —
`SimulatorThreePhaseForm.tsx:640`. Acontece em todos os pedidos do simulador.
**2.4** Cartão e ecrã de dentro com números diferentes — `Trabalhos.tsx:1537`.
**2.5** Pedido por carga: a sugestão calcula o trabalho todo —
`sugestao-para-o-profissional.ts:331`.
**2.6** Redistribuir manda link morto e conta-o como avisado — `src/lib/db.ts:1056`.
**2.7** Cancelar na área de cliente devolve sempre erro —
`api/users/me/negociacao/route.ts:62`, falta o ramo `cancelar_pedido`.
**2.8** O link do email do profissional lê campos que a tabela não tem —
`profissionais/pedidos/[token]/page.tsx:145`.
**2.9** Preços publicados abaixo do piso do motor — `precos-publicos.ts:46`.
**Pergunta-me** antes: subir o publicado ou baixar o motor? (não mexas no motor sem eu
dizer).

## Bloco 3 — Três índices (trivial, grande retorno)

**3.1** `CREATE INDEX idx_negociacoes_provider ON negociacoes (providerId, updatedAt)` —
hoje a lista de trabalhos do profissional varre a tabela inteira de 30 em 30 segundos.
**3.2** Índice em `simulatorOrders (contactEmail, createdAt)` e parar de envolver a
coluna em `LOWER(TRIM(...))`.
**3.3** Tirar as 50 migrações do caminho do pedido (`ensureSimulatorOrdersTable` corre a
cada arranque a frio, antes de `/pedido/[token]` responder).

Acrescenta-os à lista de migrações que já existe; o erro «Duplicate key name» já está
apanhado.

## Bloco 4 — Sessões e RGPD

**4.1** Suspender um profissional não lhe fecha a sessão (JWT de 30 dias, apátrida).
**4.2** Redirect aberto no callback do NextAuth — `src/auth.ts:105`:
`"https://clyon.pt.mau.com".startsWith("https://clyon.pt")` é `true`.
**4.3** O token do pedido fica em claro em `leadEvents` — `track-contact.ts:64` envia
`window.location.href`. A função `enderecoSemSegredos` já existe. Inclui o `UPDATE` que
limpa as linhas já gravadas.
**4.4** Apagar a conta não toca em `leadEvents` (nome, telefone, email, mensagens).
**4.5** A política de privacidade não menciona o Gemini nem o Supabase, e os dois recebem
dados pessoais.

## Bloco 5 — SEO estrutural

**5.1** Amadora com dois URLs vivos para o mesmo serviço, ambos auto-canónicos.
**5.2** Os hubs nacionais titulados «em Lisboa» a competir com as páginas de Lisboa.
**5.3** As cinco páginas de mudanças que dão **404**: `/mudancas/almada`,
`/mudancas/cascais`, `/mudancas/amadora`, `/mudancas/seixal`, `/mudancas/setubal`. São os
concelhos onde a empresa tem base.
**5.4** O portão do MVP devolve 0 bytes em vez de um 404 com caminho de volta.
**5.5** O artigo «Quanto custa uma mudança em Lisboa em 2026 — guia completo de preços»
não tem um único preço.
**5.6** 25 páginas com `| CLYON | CLYON` no título — nove ficheiros escrevem o sufixo à
mão e o `layout.tsx:47` já tem `template: "%s | CLYON"`. Trivial, e um teste impede a
reincidência.
**5.7** Dois pares de nós JSON-LD com o mesmo `@id` e dados contraditórios
(`/recolha-de-moveis` e `/avaliacoes`), e as 29 `Review` de `/avaliacoes` com
`datePublished` em português em vez de ISO 8601.

## Bloco 6 — Se sobrar dia

**6.1** Não há `error.tsx` nem `global-error.tsx` em toda a App Router.
**6.2** Não há observabilidade: 334 `console.error` e ninguém do outro lado.
**6.3** O CI não corre a build nem lint, e o ESLint está instalado sem configuração.
**6.4** Rota órfã e viva: `/api/chat-simulador`, 347 linhas, duplica
`/api/simulator/chat`. Confirma com grep que ninguém a chama antes de a apagar.
**6.5** 29 variáveis de ambiente lidas pelo código estão fora do `.env.example`.

## O que NÃO fazer hoje

Não comeces páginas novas (matriz preço × cidade, directório de profissionais por
cidade). São a secção 8 do relatório, valem muito, e não se começam com o perfil público
a publicar a morada de alguém. Primeiro consertar, depois construir.

## No fim

Escreve-me em `docs/feito-2026-09-12.md`: o que corrigiste, o que verificaste e afinal
não era verdade, e o que ficou por fazer e porquê.
