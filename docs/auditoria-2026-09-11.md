# Auditoria profunda do clyon.pt — 11-09-2026

**O que se fez.** Dezasseis agentes em leque sobre o código e sobre o site em produção:
treze frentes de auditoria (segurança em três camadas, privacidade/RGPD, bugs nos fluxos
do cliente, do profissional e do backoffice, coerência entre o que o site diz e o que a
empresa é, escrita, SEO técnico, SEO de conteúdo, o site vivo, desempenho e
acessibilidade) e três de concorrência (Fixando, Oscar e a SERP das pesquisas que valem
dinheiro). Cada achado traz caminho:linha e a citação real.

**O que correu mal, e é preciso dizer.** A auditoria bateu no limite de gastos a meio:
193 dos 222 agentes morreram. Sobreviveram **doze das treze frentes de busca** e **as
três de concorrência** — que é a substância — mas **a verificação adversarial não
chegou a correr**. Confirmei pessoalmente, lendo o código e o site, os cinco achados
mais graves; os restantes **estão por verificar** e vão marcados como tal. Nenhum deve
ser corrigido sem alguém confirmar primeiro que é verdade.

**Números.** 123 achados: 5 críticos, 45 altos, e o resto médios e baixos. (A frente de
SEO técnico e um crítico de completude correram à parte, no dia seguinte, e juntaram 20.)

---

## 1. O que não pode ficar assim mais um dia

Estes cinco estão **confirmados por mim**, no código e no site em produção.

### 1.1 A morada de casa de um profissional está publicada no Google

`https://clyon.pt/profissionais/fred` devolve, no `<title>` e na meta description:

> `Fred Teste — Recolha de móveis em R. dos Jasmins 3, Amora | CLYON | CLYON`

A rua e o número de porta de um profissional — pessoa singular, não empresa — numa
página indexável, submetida ao Google pelo sitemap. A causa está em
`src/lib/perfil-publico-do-profissional.ts:122`: o campo `cidade` é lido da coluna
`city` de `providers`, e essa coluna tem moradas completas lá dentro (foi o problema que
o `MoradaDaBase` veio resolver no formulário, mas os dados antigos ficaram). O comentário
do próprio ficheiro diz, em maiúsculas, que ali nunca aparece a morada.

**Corrigir:** cortar `cidade` à localidade antes de a publicar (última parte depois da
vírgula, ou o campo de localidade da geocodificação), no `perfilPublicoPorSlug`. E limpar
os dados: `UPDATE providers SET city = <localidade>` onde `city` tiver número de porta.

### 1.2 Um perfil de teste está em produção, indexado e no sitemap

O mesmo URL. Um em cada quatro profissionais que a CLYON mostra ao mundo chama-se
**«Fred Teste»**. Quem chega por pesquisa vê um marketplace com quatro profissionais, um
deles de mentira, sem avaliações e sem trabalhos.

**Corrigir:** excluir de `slugsDosProfissionais` quem não estiver activo e aprovado, ou
marcar a conta como de teste e filtrá-la. Verificar quem são os outros três antes de
publicar seja o que for.

### 1.3 XSS guardado na página pública do profissional

`src/app/profissionais/[slug]/page.tsx:179`:

```tsx
dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosEstruturados(p, slug)) }}
```

`JSON.stringify` não escapa `<`. O `p.nome` é escrito pelo próprio profissional em
`PUT /api/profissionais/perfil` e as validações são de comprimento e de "parece morada" —
nada sobre HTML. Um profissional aprovado que se chame
`Silva</script><script>…</script>` fica com esse código a correr em clyon.pt para
qualquer visitante do perfil dele, com a sessão do cliente activa. A CSP não trava nada:
`next.config.ts:402` tem `script-src 'self' 'unsafe-inline' 'unsafe-eval'`.

**O agravante:** a função certa já existe e tem teste — `jsonParaScript` em
`src/lib/escapar-html.ts:58` — e não é chamada em lado nenhum. O comentário dela diz que
foi escrita «para o dia em que alguém acrescentar ali uma avaliação vinda da base». Esse
dia chegou e a função ficou na gaveta.

**Corrigir:** uma linha. E um teste que chumbe `JSON.stringify` dentro de
`dangerouslySetInnerHTML` em `src/app`.

### 1.4 O site promete um seguro que não existe

`src/app/mudancas/page.tsx:110` e `:226`, vivo em clyon.pt/mudancas:

> «Seguro de responsabilidade civil incluído»
> «Proteção incluída — Seguro de responsabilidade civil e proteção dos seus bens durante o transporte.»

Não há apólice nenhuma. Não se pede seguro ao profissional, não se verifica, não se
guarda — não há um único campo de seguro em `providers`. O único «seguro» no produto é o
**seguro de risco** do perfil do profissional, que é uma percentagem que ele põe de lado
nos custos dele, dinheiro dele para ele.

Um cliente com um móvel partido vai reclamar uma cobertura que não existe, e tem por
escrito que lhe foi prometida. É o maior risco legal do site.

### 1.5 A mesma página vende frota e equipas próprias

`src/app/mudancas/page.tsx:103-108, :225`: «Equipa profissional treinada para cargas
pesadas», «Veículos de vários tamanhos (carrinhas a camiões)», «Equipa de 2 a 4 pessoas
conforme necessidade», «Chegamos à hora combinada».

A CLYON não tem veículos nem pessoal. E `/sobre-nos` — a página onde alguém vai saber com
quem está a lidar — descreve uma empresa executante e **nunca diz que a CLYON é um
marketplace**. Quem lê sai convencido de que contrata uma empresa com equipa própria;
quem depois recebe três propostas de nomes diferentes conclui que foi enganado.

---

### 1.6 Todas as partilhas do site saem sem imagem

`https://clyon.pt/og-image.jpg` devolve **404**. O ficheiro não existe no repositório, e
o `layout.tsx` referencia-o três vezes: no Open Graph, no Twitter card e no `image` do
LocalBusiness em JSON-LD — que é o campo que o Google usa para o painel de negócio local,
em todas as 165 páginas.

Pior: **34 das 35 rotas que declaram `openGraph` não declaram `images`**, e em Next.js o
`openGraph` do filho substitui o do layout. Resultado: `og:image` **não é emitido em
página nenhuma**. Cada link do clyon.pt partilhado no WhatsApp — que é por onde um
marketplace local circula — sai sem imagem, como texto simples.

### 1.7 Há um cron que apaga pedidos e fotografias todos os dias, e não há cópia de segurança

`vercel.json` agenda `/api/cron/purgar-pedidos` para as **04:30, todos os dias**.
A função apaga a linha do pedido, as negociações e as imagens. E uma busca por
`backup|cópia de seguran|restore|mysqldump` em todo o repositório não devolve **uma única
ocorrência operacional**: não há runbook, não há plano de recuperação, não há prova de que
exista de onde recuperar.

A condição da purga parece bem escrita (só concluídos, cancelados ou arquivados, com mais
de 60 dias, e sem negociação acordada por pagar). Mas um trabalho destrutivo diário sem
rede por baixo está a uma alteração de distância de uma perda irreversível.

**Isto não é código para corrigir — é uma pergunta para si:** o Railway tem cópias
automáticas da base? Alguém já experimentou restaurar uma?

---

## 2. O dinheiro: o rodapé ainda diz que a CLYON recebe

Ontem corrigimos a FAQ do profissional que dizia que o cliente paga à CLYON. Faltou o
resto:

- **`src/components/Footer.tsx:75-79`** — uma secção «Pagamentos» com Revolut, MB WAY e
  Novo Banco, em **todas as páginas do site**. A CLYON não tem como receber por nenhum
  deles: `A_PLATAFORMA_COBRA = false`.
- **`src/app/faq/page.tsx:146`** — «Aceitamos… Emitimos fatura sempre», que contradiz a
  FAQ imediatamente a seguir na mesma página, corrigida de propósito para dizer que quem
  factura é o profissional.
- **`src/app/servicos/page.tsx:177`** — o mesmo.

E a incoerência que já tínhamos identificado continua: a carteira do profissional tem
«Transferir» e diz «sem IBAN não há para onde transferir o seu saldo», mas o modelo é o
cliente pagar-lhe directamente. **Isto é uma decisão de produto, não um bug** — ou o
levantamento existe (e então há dinheiro que passa pela CLYON), ou a carteira devia dizer
apenas o que ele tem a receber.

---

## 3. Bugs que custam dinheiro a sério

*(Por verificar — confirmar antes de mexer.)*

| O quê | Onde | O que acontece |
|---|---|---|
| **IVA a dobrar** | `src/lib/valor-de-arranque.ts:49` | O valor de arranque é `estimatedPriceWithVat` e a plataforma trata tudo como base sem IVA. Estimativa de 300 € nasce como 369 € «sem IVA»; fechado no regime normal dá 472,32 € ao cliente. |
| **Sucesso quando falhou** | `SimulatorThreePhaseForm.tsx:521` | Se a rota devolver 429 ou 500, o ecrã mostra «Pedido enviado» na mesma. O cliente fica à espera de propostas de um pedido que nunca existiu. |
| **«Os profissionais já receberam»** | `SimulatorThreePhaseForm.tsx:640` | Não receberam: o pedido fica à espera de alguém carregar em «Enviar aos profissionais». Acontece em **todos** os pedidos do simulador. |
| **Cartão ≠ ecrã de dentro** | `Trabalhos.tsx:1537` | 310,20 € no cartão, 374,50 € ao tocar nele, e a legenda «já com a taxa CLYON descontada» está errada em 22,47 €. |
| **Por carga vs total** | `sugestao-para-o-profissional.ts:331` | Num pedido por carga a sugestão calcula o trabalho todo e apresenta-o como preço de uma carga. Três cargas → o cliente paga 1 020 € por 243 € de custo, ou o profissional faz três viagens pelo preço de uma. |
| **Redistribuir manda link morto** | `src/lib/db.ts:1056` | Quem já tinha negociação recebe um segundo email com token novo cujo hash nunca foi gravado → 404. E o histórico escreve «Todos avisados por email». |
| **Cancelar na conta falha sempre** | `api/users/me/negociacao/route.ts:62` | Falta o ramo `cancelar_pedido`. O cliente com conta escreve o motivo e recebe «Pedido ou negociação em falta». |
| **O link do email mente** | `profissionais/pedidos/[token]/page.tsx:145` | Lê campos que a tabela não tem: percurso da mudança, sacos e acesso ao destino chegam sempre vazios. O painel diz 374,50 €, o link do email diz outro número. |
| **Preços publicados abaixo do motor** | `precos-publicos.ts:46` | «desde 40 €» (móveis) e «desde 30 €» (monos); o motor nunca devolve menos de 48,78 € sem IVA. |

---

## 4. Desempenho: três índices que faltam

*(Por verificar, mas o diagnóstico é sólido e a correcção é trivial.)*

1. **`negociacoes` não tem índice com `providerId` como primeira coluna.** A lista de
   trabalhos do profissional varre a tabela inteira — de 30 em 30 segundos, por cada
   painel aberto, contra um pool de 5 ligações.
   → `CREATE INDEX idx_negociacoes_provider ON negociacoes (providerId, updatedAt)`
2. **`simulatorOrders` não tem índice em `contactEmail`**, e as consultas fazem
   `LOWER(TRIM(contactEmail))`, o que impediria qualquer índice de servir. São três
   varrimentos completos por carregamento de «Os meus pedidos», de minuto a minuto.
3. **Cinquenta `ALTER TABLE` antes da primeira leitura**, em cada arranque a frio, no
   caminho de `/pedido/[token]` — a porta de entrada do cliente, vinda de um email, no
   telemóvel. 0,5 a 1,5 s somados ao TTFB.

---

## 5. Privacidade e RGPD

- **O EXIF das fotografias não é removido.** Fotos abaixo de 1 MB ou de lado pequeno
  chegam intactas ao armazenamento, com GPS de precisão métrica, e são mostradas a todos
  os profissionais da zona **antes de haver contrato** — ao lado do email que lhes diz «a
  morada exacta aparece depois de o contratar».
- **O Gemini não está na política.** As fotos do interior da casa e a descrição do cliente
  vão para a Google e a secção «com quem partilhamos» não o menciona.
- **O Supabase também não** — e guarda nome, email, telefone e morada de clientes numa
  segunda base, de outro fornecedor.
- **O token do pedido fica em claro na tabela `leadEvents`**, porque o `PageViewTracker`
  envia `window.location.href` inteiro. Quem tiver leitura sobre a base tem a chave de
  qualquer pedido. A função que resolve isto — `enderecoSemSegredos` — já existe.
- **Apagar a conta não toca em `leadEvents`**, onde ficam nome, telefone, email e as
  mensagens do cliente.
- **Suspender um profissional não lhe fecha a sessão.** O JWT dura 30 dias e é apátrida:
  um profissional suspenso por fraude continua a negociar, a aceitar trabalhos e a pedir
  levantamentos durante um mês.

---

## 6. SEO: onde se está a perder tráfego

- **Notas de estratégia publicadas como texto visível.** Em três páginas de produção o
  visitante lê: *«Em Cascais, o Google mostra muitos resultados informativos, municipais e
  de doação. Esta página precisa de deixar clara a intenção comercial»*. É a nossa ficha
  de intenções sobre quem está a ler.
- **A Amadora tem dois URLs vivos para o mesmo serviço**, ambos auto-canónicos, os quatro
  no sitemap.
- **Os hubs nacionais estão titulados «em Lisboa»** e competem de frente com as páginas
  de Lisboa. Quatro candidatos nossos para «recolha de móveis lisboa».
- **87 das 104 páginas cidade×serviço são o mesmo texto com o nome da terra trocado** —
  o erro das *doorway pages* que o próprio `cidades-local.ts` diz ter sido corrigido.
- **O artigo «Quanto custa uma mudança em Lisboa em 2026? Guia completo de preços» não
  tem um único preço.**
- **O portão do MVP devolve uma folha branca de 0 bytes** em vez de um 404 com caminho de
  volta. Um profissional convidado que abra o link noutro telemóvel não sabe se o site
  caiu.

**O que está bem, e é justo dizê-lo:** das 165 URLs do sitemap, **todas devolvem 200** —
zero 301, zero 404. Nenhuma tem canónico em falta, nenhuma canonicaliza para outra, não há
descriptions em falta nem duplicadas, todas têm exactamente um H1, e todas as imagens têm
`alt` e usam `next/image`. O `robots.txt` tem um único grupo de user-agent, que é o
correcto. A base técnica está sólida; o que falha são os detalhes acima.

**Além disso:** 25 páginas servem `| CLYON | CLYON` no título; 114 dos 165 títulos passam
dos 65 caracteres e 147 das 165 descriptions passam dos 160; dois pares de nós JSON-LD
partilham `@id` com horários e coordenadas contraditórios (`/recolha-de-moveis` diz que
fecha às 19h num bloco e às 20h noutro, com 1,7 km de diferença nas coordenadas); e as 29
`Review` de `/avaliacoes` têm `datePublished` escrito em português em vez de ISO 8601.

---

## 6-A. O que ninguém estava a ver

Um agente de completude foi procurar o que uma auditoria destas normalmente não vê:

- **Não há observabilidade nenhuma.** 334 `console.error` no código e ninguém do outro
  lado: sem Sentry, sem alertas, sem captura de erros. Quando um email não sai ou a base
  falha, ninguém dá por isso — descobre-se pelo cliente que telefona.
- **Não há `error.tsx` nem `global-error.tsx` em toda a App Router.** Um erro por apanhar
  numa página é o ecrã de erro cru do Next, sem marca e sem caminho de volta.
- **O CI não corre a build nem lint.** Só `tsc` e os testes. E o ESLint está instalado sem
  ficheiro de configuração, portanto nunca correu.
- **78 dos 128 ficheiros de teste lêem o código-fonte e fixam frases exactas.** É a
  disciplina desta casa e apanha regressões de texto a sério — mas também é gesso: metade
  da suite chumba quando o código muda por bem, como se viu ontem duas vezes.
- **29 variáveis de ambiente lidas pelo código estão ausentes do `.env.example`.** Quem
  montar isto de novo não sabe do que precisa.
- **Uma rota órfã e viva:** `/api/chat-simulador`, 347 linhas, duplica
  `/api/simulator/chat` e ninguém a chama.
- **Cinco ficheiros concentram 22 mil linhas** — o `db.ts` sozinho tem 6 557.
- **A ponte do WhatsApp corre sobre biblioteca não oficial** (`whatsapp-web.js`): se o
  WhatsApp bloquear o número ou mudar o protocolo, o canal desaparece sem aviso.

---

## 7. A concorrência

### Fixando (fixando.pt) — o concorrente directo

**Modelo:** marketplace de leads pré-pagas. O cliente não paga nada; o profissional paga
**por proposta enviada**, em créditos comprados antes: 22 € por 10 créditos (2,20 €/un.)
até 1 000 € por 800 (1,25 €/un.). Contactar um cliente custa-lhe **2 a 4 €**. Não cobram
comissão sobre o trabalho e não processam o pagamento — **exactamente como a CLYON**.

**O que fazem melhor:**
- **Receita antes do trabalho.** Têm dinheiro em caixa antes de qualquer serviço
  acontecer. A CLYON só tem receita depois, e cobrada fora da plataforma.
- **Matriz de SEO com quatro camadas:** `/servicos/<serviço>`, `/<serviço>/preco` **e**
  `/<serviço>/custo` (duas páginas para a mesma pergunta), `/<serviço>/preco/<Distrito>`
  (18 distritos), e páginas «TOP 2026 … perto de mim». Sete slugs só para mudanças, onde
  a CLYON tem um.
- **Publicam números.** «Preço total médio: 92 €», «25 € – 3 200 €», tabela por cidade.
  A CLYON tem **uma** página de preços para o país inteiro.
- Aceitam **áudio** no pedido — o formato natural de quem está no meio da casa a apontar.

**Onde estão fracos, e é por aí que se entra:**
- **As páginas «TOP 2026: Empresas de Mudanças em Lisboa perto de mim» não listam
  profissional nenhum.** Título promete directório, página entrega formulário.
- **Não têm perfil público de profissional.** O activo que se escreve sozinho à medida
  que o profissional trabalha não existe lá.
- **A nota externa desmente a interna:** anunciam 4,8/5; no Trustpilot têm **3,6/5 com
  17% de uma estrela**.
- **A queixa dominante dos profissionais é pagar por leads falsas.** «90% of these leads
  are FAKE», «€200+» perdidos, sem devolução.
- **Recusam responsabilidade por escrito:** «A Fixando não garante o cumprimento da
  prestação por parte do Especialista.»
- **Não têm o vocabulário português:** não existe categoria «recolha de monos» nem
  «esvaziamento de casas».

**E o ponto que mais interessa:** **118 das 155 avaliações que a CLYON exibe estão
alojadas na Fixando** (`src/app/avaliacoes/page.tsx:12`). 76% da prova social da CLYON
vive dentro do concorrente directo, que lha pode fechar quando quiser.

### Oscar (oscar-app.com) — não é o concorrente que parecia

O «Oscar» que compete no mesmo eixo **não é oscar.pt**: é a **oscar-app.com**, plataforma
de serviços para casa com €6M levantados (Indico, Lince, fundadores da Bolt e da Wolt),
+€7M de receita, 33 cidades em três países, duas apps nativas.

**Mas não compete neste nicho:** não fazem recolha de monos, nem entulho, nem
esvaziamentos. O modelo é **preço fixo por tarefa** («Desde €29,90», «€89,90 reparar
frigorífico», deslocação fixa €5,90) — e preço fixo não encaixa em trabalho volumétrico.
Um sofá, uma casa cheia ou 40 sacos de obra não cabem num «desde €29,90». É por isso que
a categoria lhes escapa.

**O que se aprende com eles:**
- **Preço visível antes de marcar** mata a fricção do «espere que lhe respondemos».
- **Garantia datada:** «Todos os serviços OSCAR têm garantia de 15 dias.» Só é possível
  porque o dinheiro passa pela plataforma.
- **Pagamentos diários ao profissional** — é a dor de quem trabalha por conta própria.
- **Exigem seguro de acidentes de trabalho e de responsabilidade civil ao prestador.**

**Onde estão fracos:** Trustpilot **2,5/5 com 65% de uma estrela**; Portal da Queixa
41,7/100, atrás da Zaask; uma peça no Observador intitulada *«Oscar, a app de serviços
domésticos "mais popular em Portugal" inundada de reclamações»*. E o SEO é um sitemap
inflado: 7 662 URLs com **460 cópias da mesma página por serviço**, sem páginas de
cidade, sem blog — a landing de mudanças é um redirect 307 para a homepage.

### A SERP — quem está mesmo no caminho

Quatro tipos de adversário, e nenhum é a Oscar:

1. **Marketplaces de orçamentos** — Zaask e Fixando. O `zaask.pt` é o **nº 1** de
   «empresa de mudanças Almada».
2. **Empresas com frota e domínio exacto** — megaentulhos.pt, recolhaentulho.pt,
   recolhademonos.com, mudancasalmada.com. Cobram directamente, vivem de serviço+cidade.
3. **Municípios** — em «recolha de monos Setúbal» os **dez primeiros resultados** são
   câmara, serviços municipalizados, juntas e jornal local. Nem uma empresa privada.
4. **Solidariedade** — Betel, REMAR. Dominam «recolha de móveis usados grátis».

**E o buraco:** `/mudancas/almada`, `/mudancas/cascais`, `/mudancas/amadora`,
`/mudancas/seixal` e `/mudancas/setubal` **respondem 404**. São os cinco concelhos onde a
CLYON tem base. Não é uma questão de posição — é não haver página.

---

## 8. Onde investir para passar à frente

Por ordem de retorno sobre esforço:

**1. Consertar o que já existe e está partido.** O perfil público de profissional é o
único activo que nem a Fixando nem a Oscar têm — e hoje publica a morada de casa de
alguém e um perfil chamado «Teste». Vale mais uma semana aqui do que um mês de páginas
novas.

**2. Directório a sério onde a Fixando entrega formulário.** `/recolha-de-monos/lisboa`
com dez parceiros reais — nome, foto, avaliação, link para o perfil. A página equivalente
deles, com H1 «TOP 2026… perto de mim», não mostra ninguém. É a maior lacuna do líder.

**3. As cinco páginas de mudanças que dão 404.** Almada, Cascais, Amadora, Seixal e
Setúbal. É a base declarada da empresa e não existe página.

**4. A matriz preço × cidade.** É a intenção que converte («quanto custa recolha de
entulho em Lisboa») e vai toda para a Fixando. Com dados reais de trabalhos feitos, as
páginas da CLYON são melhores do que as deles, que só têm médias.

**5. Sair da dependência da Fixando para prova social.** Pedir avaliação no Google, não
na Fixando. Hoje 76% está alojada no concorrente.

**6. O argumento de recrutamento que está à espera de ser escrito.** «Não vendemos leads.
Não paga 2 a 4 € por contacto. Não compra pacotes de 22 € a 1 000 € antes de ganhar um
euro.» A dor dominante dos profissionais da Fixando está documentada no Trustpilot, e a
CLYON tem por acaso o modelo oposto. Isto é copy, não é produto.

**7. Verificar o que a Fixando recusa verificar.** Eles escrevem nos termos que não
garantem nem verificam nada. A CLYON é pequena e conhece os parceiros um a um: pode
confirmar NIF, actividade aberta e — se vier a exigir — seguro, e dizê-lo na página.
Diferenciação barata e impossível de copiar por quem tem mil tipos de serviço.

---

## 9. Decisões que são suas, não minhas

1. **Existe seguro de responsabilidade civil?** Se não, as duas frases saem hoje. Se quer
   ter, o caminho é exigi-lo ao profissional e verificá-lo, como já se faz com o número
   de transportador.
2. **O levantamento da carteira existe mesmo?** Ou seja: há dinheiro que passa pela
   CLYON? A resposta decide se a carteira fica como está ou passa a dizer só «tem a
   receber».
3. **O «Fred Teste» é seu?** Apago-o, escondo-o, ou é um profissional a sério com um nome
   de teste?
4. **Quer páginas de preço por cidade?** É o maior investimento da lista e o que mais
   tráfego traz — mas são páginas a mais para manter se não houver dados reais para as
   encher.

---

## 10. O que ficou por fazer

- A **verificação adversarial não correu**: 98 dos 103 achados estão por confirmar.
- A frente de **SEO técnico** morreu no limite e foi relançada à parte.
- Não foi testado nada em execução (não há Node nesta máquina): tudo o que aqui está vem
  de leitura de código e de páginas em produção.
- A ponte de WhatsApp foi auditada por leitura; o comportamento com o WhatsApp real não.
