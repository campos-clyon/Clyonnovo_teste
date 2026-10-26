# URLs Removidas e Redirects - CLYON.pt

> Última atualização: 2026-10-26
> Este ficheiro documenta as URLs que foram removidas, redirecionadas ou devem retornar erro.
> A fonte de verdade é o código: `next.config.ts` (redirects), `src/lib/paginas-consolidadas.ts`,
> `src/lib/mudancas-cidades.ts` e `src/middleware.ts` (410, https/domínio, mudanças sem página).

---

## Por onde passa um pedido (e porque é que a ordem importa)

1. **Domínio (Vercel):** `www.clyon.pt` → `clyon.pt` (308).
2. **Redirects do `next.config.ts`:** `permanent: true` responde **308**. Correm **antes** do middleware.
3. **Middleware (`src/middleware.ts`):** http → https e host canónico (301), as URLs em **410**, e
   `/mudancas-<cidade>` sem página própria → `/mudancas` (301).

**Um endereço, uma regra.** Uma regra no middleware para um caminho que o `next.config.ts` já
redireciona nunca corre — e um redirect no `next.config.ts` para um caminho que devia dar 410 apaga
o 410 sem ninguém dar por isso (foi o que aconteceu a `/credito-fiscal` até 26-10-2026). O teste
`src/lib/redirects-sem-contradicoes.test.ts` guarda as duas coisas.

---

## Resumo de Validação (2026-10-26)

| Item | Estado |
|------|--------|
| `/credito-fiscal` retorna HTTP 410 | Middleware; sem redirect no `next.config.ts` desde 26-10-2026 |
| `/credito-fiscal` não está no sitemap | Confirmado |
| Links internos para `/credito-fiscal` | Nenhum encontrado |
| Search Console «Erro de redirecionamento» (18 URLs) | Todos num salto (308) para uma página 200; o www em dois |
| Cópias de redirects no middleware (`/contato`, `/avaliacoes-clientes`, `/central-ajuda`, `/mudanças-*`) | Retiradas a 26-10-2026 — a regra é a do `next.config.ts` |

---

## Legenda

| Código | Significado |
|--------|-------------|
| **308** | Redirect permanente do `next.config.ts` (`permanent: true`) - página equivalente existe |
| **301** | Redirect permanente do middleware (https, domínio, mudanças sem página) |
| **404** | Página não encontrada - nunca existiu ou foi erro de digitação |
| **410** | Gone - página existiu mas foi permanentemente removida |

---

## URLs com Redirect Permanente (Página Equivalente Existe)

Todas as desta secção são do `next.config.ts` (308), salvo indicação.

### Variações de Escrita / Typos

| URL Antiga | Destino | Motivo |
|------------|---------|--------|
| `/orcamento` | `/simulador` | Variação sem acento |
| `/orçamento` | `/simulador` | Nome antigo do simulador |
| `/contato` | `/contactos` | Variação brasileira |
| `/contacto` | `/contactos` | Singular vs plural |
| `/contact` | `/contactos` | Versão inglesa |
| `/contacts` | `/contactos` | Versão inglesa plural |
| `/preco` | `/precos` | Singular vs plural |
| `/price` | `/precos` | Versão inglesa |
| `/prices` | `/precos` | Versão inglesa plural |
| `/servico` | `/servicos` | Singular vs plural |
| `/services` | `/servicos` | Versão inglesa |
| `/sobre` | `/sobre-nos` | Variação curta |
| `/quem-somos` | `/sobre-nos` | Variação alternativa |
| `/reviews` | `/avaliacoes` | Versão inglesa |
| `/testimonials` | `/avaliacoes` | Versão inglesa |
| `/gallery` | `/trabalhos` | Versão inglesa |
| `/galeria` | `/trabalhos` | Nome alternativo |
| `/portfolio` | `/trabalhos` | Nome alternativo |

### URLs Antigas Renomeadas

| URL Antiga | Destino | Motivo |
|------------|---------|--------|
| `/avaliacoes-clientes` | `/avaliacoes` | URL antiga renomeada |
| `/central-ajuda` | `/faq` | URL antiga renomeada |
| `/tabela-precos` | `/precos` | URL antiga renomeada |
| `/areas` | `/regioes` | URL antiga renomeada |
| `/zonas` | `/regioes` | URL antiga renomeada |
| `/cobertura` | `/regioes` | URL antiga renomeada |
| `/recolha` | `/recolha-de-moveis` | URL curta |
| `/recolha/lisboa` | `/orcamento-recolha-lisboa` | Endereço que o anúncio mostra como texto |
| `/recolha/orcamento` e `/recolha/orçamento` | `/orcamento-recolha-lisboa` | Página de orçamento da recolha |

### Serviços - Variações de Nome

| URL Antiga | Destino | Motivo |
|------------|---------|--------|
| `/recolha-de-moveis-usados` | `/recolha-de-moveis` | Variação com "usados" |
| `/recolha-moveis` | `/recolha-de-moveis` | Falta "de" |
| `/remocao-de-moveis` | `/recolha-de-moveis` | Sinónimo |
| `/retirada-de-moveis` | `/retirar-moveis-velhos` | Sinónimo |
| `/esvaziamento-apartamento` | `/esvaziamento-de-casas` | Variação |
| `/esvaziar-casa` | `/esvaziamento-de-casas` | Verbo vs substantivo |
| `/limpeza-de-casa` | `/esvaziamento-de-casas` | Serviço relacionado |
| `/recolha-entulho` | `/recolha-de-entulho` | Falta "de" |
| `/entulho` | `/recolha-de-entulho` | URL curta |
| `/monos` | `/recolha-de-monos` | Termo coloquial (a página dos monos existe) |
| `/recolha-monos` | `/recolha-de-monos` | Falta "de" |
| `/mudanca` | `/mudancas` | Singular vs plural |
| `/mudancas-residenciais` | `/mudancas` | Especificação desnecessária |
| `/empresa-mudancas` | `/mudancas` | Variação |
| `/sofas` | `/recolha-de-sofas` | URL curta |
| `/recolha-sofa` | `/recolha-de-sofas` | Singular vs plural |
| `/camas` | `/recolha-de-camas` | URL curta |
| `/armarios` | `/recolha-de-armarios` | URL curta |
| `/electrodomesticos` | `/recolha-de-eletrodomesticos` | Grafia antiga |
| `/eletrodomesticos` | `/recolha-de-eletrodomesticos` | URL curta |

`/recolha-de-monos` tem página própria e não é redirecionada.

### Serviços Descontinuados

| URL Antiga | Destino | Motivo |
|------------|---------|--------|
| `/limpeza-obra` | `/servicos` | Limpeza pós-obra descontinuada |
| `/limpeza-pos-obra` | `/servicos` | Limpeza pós-obra descontinuada |
| `/limpeza-pos-obra-<cidade>` | `/recolha-entulho-<cidade>` | O caso de entulho da cidade responde melhor |
| `/camiao-com-motorista` | `/mudancas` | Serviço descontinuado |
| `/camiao-com-motorista-<cidade>` | `/mudancas/<cidade>` | Cidade com página de mudanças |
| `/camiao-com-motorista-<outra>` | `/mudancas` | Cidade sem página |

### Mudanças por Cidade

As cidades com página são as de `src/lib/mudancas-cidades.ts` (26 em 26-10-2026). A cidade não se
perde no caminho: quem escreveu `/mudancas-lumiar` quer o Lumiar, não o balcão geral.

| URL Antiga | Destino | Onde |
|------------|---------|------|
| `/mudancas-<cidade>` (cidade com página) | `/mudancas/<cidade>` | `next.config.ts` (308) |
| `/mudancas-<outra>` (cidade sem página) | `/mudancas` | middleware (301) |
| `/mudanças` (com ç, `/mudan%C3%A7as`) | `/mudancas` | `next.config.ts` (308) |
| `/mudanças-<cidade>` (com ç, cidade com página) | `/mudancas/<cidade>` | `next.config.ts` (308) |
| `/mudanças-<outra>` (com ç, cidade sem página) | `/mudancas` | `next.config.ts` (308) |

`/mudancas-de-escritorio` é uma página (tipo de mudança), não uma cidade: o middleware deixa-a
passar pela lista `PAGINAS_DE_TIPO_DE_MUDANCA`.

### Páginas Consolidadas

A lista, e o porquê de cada uma, vivem em `src/lib/paginas-consolidadas.ts`.

| URL Antiga | Destino | Motivo |
|------------|---------|--------|
| `/esvaziamento-casas-amadora` | `/esvaziamento-de-casas-amadora` | Gerada com página estática equivalente |
| `/recolha-monos-amadora` | `/recolha-de-monos-amadora` | Gerada com página estática equivalente |
| `/recolha-de-sofa-lisboa` | `/recolha-de-sofas` | Duas páginas para a mesma pesquisa |
| `/areas-de-atuacao` | `/regioes` | Duas páginas para a mesma pesquisa |
| `/blog/limpeza-pos-obra-e-retirada-de-residuos` | `/recolha-de-entulho` | Artigo retirado |
| `/recolha-moveis-parque-das-nacoes` | `/recolha-moveis-lisboa` | Zona dentro de Lisboa (`next.config.ts`) |

---

## URLs que Devem Retornar 410 (Gone)

> Páginas que existiram mas foram permanentemente removidas. O serviço deixou de existir ou a página não faz mais sentido.

| URL | Motivo | Página Equivalente | Links Internos | Implementado |
|-----|--------|-------------------|----------------|--------------|
| `/credito-fiscal` | Informação descontinuada | Nenhuma | Não | Sim (middleware) |

**Implementação:** o middleware retorna HTTP 410 com página HTML simples e header `X-Robots-Tag: noindex`
(lista `goneUrls` em `src/middleware.ts`). **Nunca** pôr um destes endereços nos redirects do
`next.config.ts`: correm antes do middleware e o 410 deixa de acontecer.

---

## URLs que Devem Retornar 404 (Nunca Existiram)

> URLs que foram rastreadas pelo Google mas nunca existiram no site. Não fazer redirect, deixar retornar 404 naturalmente.

| URL Pattern | Motivo | Acção |
|-------------|--------|-------|
| `/wp-admin/*` | Tentativas de acesso WordPress | 404 natural |
| `/wp-login.php` | Tentativas de acesso WordPress | 404 natural |
| `/*.php` | Tentativas de acesso a ficheiros PHP | 404 natural |
| `/login` | Não existe página de login pública | 404 natural |
| `/register` | Não existe registo público | 404 natural |

`/admin/*` não é um 404: sem sessão, o middleware manda para `/admin/login`.

---

## URLs a Monitorizar (Soft 404)

> Páginas que podem estar a retornar 200 mas com pouco conteúdo. Verificar e enriquecer ou remover.

| URL | Problema | Acção Recomendada |
|-----|----------|-------------------|
| Verificar no Search Console | Páginas com pouco conteúdo | Enriquecer ou consolidar |

---

## Notas Importantes

### Não Redirecionar para Homepage

As seguintes práticas devem ser evitadas:
- Redirecionar páginas de serviço para `/` (homepage)
- Redirecionar páginas de localização para `/` sem relação
- Redirecionar conteúdo removido para `/` em vez de 410

### Quando Usar Cada Código

1. **308 / 301 (Redirect Permanente)**
   - A página foi renomeada
   - Existe página equivalente com o mesmo conteúdo/serviço
   - Variação de escrita ou idioma

2. **404 (Not Found)**
   - URL nunca existiu
   - Erro de digitação do utilizador
   - Tentativas de acesso malicioso

3. **410 (Gone)**
   - Página existiu mas foi permanentemente removida
   - Serviço descontinuado
   - Conteúdo obsoleto sem substituto

### robots.txt

O `robots.txt` (`src/app/robots.ts`) **não bloqueia** URLs 404 ou 410: o Google precisa de as
rastrear para perceber que foram removidas. Bloqueia só as áreas privadas e as rotas com um
segredo no endereço — a lista está no próprio ficheiro.

---

## Histórico de Alterações

| Data | Alteração |
|------|-----------|
| 2026-06-02 | Criação do documento |
| 2026-06-02 | Adicionados 40+ redirects 301 |
| 2026-06-02 | Documentadas URLs de mudanças consolidadas |
| 2026-10-26 | `/credito-fiscal` volta a dar 410 (saiu o 308 para `/servicos` do `next.config.ts`); saem do middleware as cópias de redirects que nunca corriam; mudanças por cidade, monos, descontinuados e consolidadas actualizados |

---

## Próximas Acções

1. [x] `/credito-fiscal` retorna 410 (middleware, sem redirect à frente desde 26-10-2026)
2. [x] Página 410 com design profissional e links para serviços
3. [x] Páginas de mudanças por cidade (26 localidades)
4. [ ] Search Console: nova validação de «Erro de redirecionamento» depois da publicação de 26-10-2026
5. [ ] Monitorizar soft 404 no Search Console
