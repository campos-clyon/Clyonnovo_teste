import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * CADA PROFISSIONAL PASSA A TER UMA PÁGINA — e é a única do site que se
 * escreve sozinha.
 *
 * As 160 entradas do nosso sitemap eram todas escritas à mão: serviços,
 * cidades, artigos. A Fixando dá um endereço próprio a cada especialista, e
 * cada um deles apanha pesquisas que a página de serviço nunca apanha. Nós
 * tínhamos zero páginas de pessoas.
 *
 * Serve três coisas ao mesmo tempo: o cliente vê com quem vai lidar, o Google
 * recebe conteúdo que muda sozinho e que ninguém pode copiar, e o profissional
 * ganha o argumento de recrutamento mais barato que existe.
 */

const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const lerNu = (p: string) => semComentarios(ler(p));

const PAGINA = ler("src/app/profissionais/[slug]/page.tsx");
const PAGINA_NUA = lerNu("src/app/profissionais/[slug]/page.tsx");
const LIB = lerNu("src/lib/perfil-publico-do-profissional.ts");
const MEIO = lerNu("src/middleware.ts");
const SITEMAP = lerNu("src/app/sitemap.ts");

describe("a página existe e o Google chega lá", () => {
  it("o portão do MVP deixa passar o perfil, e mais nada", () => {
    /*
     * Todo o `/profissionais/*` estava fechado atrás da chave do MVP — uma
     * página que o Google não pode ler não é SEO nenhum. Abriu-se um segmento
     * só, e listou-se o que fica fechado em vez do que abre: ao contrário,
     * uma pasta criada daqui a seis meses nascia aberta.
     */
    expect(MEIO).toContain("ePerfilPublicoDeProfissional");
    expect(MEIO).toContain("SECCOES_PRIVADAS");
    for (const privada of ["painel", "entrar", "inscricao", "definir-senha", "pedidos"]) {
      expect(MEIO, `${privada} tem de continuar fechada`).toContain(`"${privada}"`);
    }
    // Um segmento só: /profissionais/joao-silva abre, /profissionais/painel/x não.
    expect(MEIO).toContain("partes.length !== 2");
  });

  it("entra no sitemap, e cresce sozinha", () => {
    expect(SITEMAP).toContain("slugsDosProfissionais");
    expect(SITEMAP).toContain("profissionaisPages");
  });

  it("uma base em baixo não parte o sitemap", () => {
    /*
     * Apanhado por um teste: o `ensureProvidersSchema` estava FORA do try, e o
     * sitemap inteiro rebentava sem DATABASE_URL. Um sitemap com menos páginas
     * é um problema pequeno; um que não responde faz o Google desistir de o
     * pedir.
     */
    const f = LIB.slice(LIB.indexOf("export async function slugsDosProfissionais"));
    const corpo = f.slice(0, f.indexOf("\n}"));
    expect(corpo.indexOf("try {")).toBeLessThan(corpo.indexOf("ensureProvidersSchema"));
    expect(corpo).toContain("return [];");
  });

  it("tem canónico próprio e dados estruturados", () => {
    expect(PAGINA_NUA).toContain("alternates: { canonical:");
    expect(PAGINA_NUA).toContain("application/ld+json");
    expect(PAGINA_NUA).toContain('"@type": "LocalBusiness"');
  });
});

describe("só aparece quem a CLYON aprovou", () => {
  it("pendente, suspenso ou inactivo não tem página", () => {
    /*
     * Não é estética. Uma página indexada de alguém que a CLYON ainda não
     * verificou é a plataforma a emprestar-lhe credibilidade que não lhe deu.
     */
    const f = LIB.slice(LIB.indexOf("export async function perfilPublicoPorSlug"));
    expect(f).toContain("estado = 'aprovado'");
    expect(f).toContain("isActive = 1");
    expect(f).toContain("isClyon = 0");
  });

  it("o sitemap segue a mesma regra", () => {
    const f = LIB.slice(LIB.indexOf("export async function slugsDosProfissionais"));
    expect(f).toContain("estado = 'aprovado'");
    expect(f).toContain("isClyon = 0");
  });

  it("um slug desconhecido dá 404 e não é indexado", () => {
    expect(PAGINA_NUA).toContain("notFound()");
    expect(PAGINA_NUA).toContain("robots: { index: false }");
  });
});

describe("o que a página NÃO diz", () => {
  it("nenhum contacto do profissional aparece", () => {
    /*
     * Telefone, email, NIF, IBAN, morada. A regra é a mesma do perfil dentro
     * da negociação — o perfil dá confiança, não dá o contacto. Numa página
     * aberta ao mundo deixa de ser regra de produto e passa a ser proteção de
     * dados de quem trabalha connosco.
     */
    for (const campo of ["phone", "email", "nif", "iban", "mbway", "address"]) {
      expect(PAGINA_NUA.toLowerCase(), `${campo} não pode estar na página`).not.toContain(
        `p.${campo}`,
      );
    }
  });

  it("a consulta do perfil nunca traz esses campos", () => {
    const f = LIB.slice(
      LIB.indexOf("SELECT name, slug, city"),
      LIB.indexOf("FROM providers WHERE id"),
    );
    for (const campo of ["phone", "email", "nif", "iban", "mbway"]) {
      expect(f, `${campo} não devia sair da base`).not.toContain(campo);
    }
  });

  it("não inventa uma nota a quem não tem avaliações", () => {
    /*
     * Um `aggregateRating` com zero avaliações é motivo de acção manual do
     * Google, e é justo que seja: são as estrelas que aparecem no resultado da
     * pesquisa. Escrever «0,0 ★» ao lado do nome de um profissional novo
     * também é pior do que não escrever nada — parece nota má, não ausência.
     */
    expect(PAGINA_NUA).toContain("p.quantasAvaliacoes > 0 && p.notaMedia != null");
    expect(PAGINA_NUA).toContain("Ainda sem avaliações na CLYON");
  });
});

describe("o sinal de quem está por perto", () => {
  it("a coluna que estava gravada há meses passou a ser mostrada", () => {
    // «Online nas últimas 48h» é das linhas mais rentáveis da app da Fixando:
    // transforma uma lista de nomes numa lista de pessoas disponíveis.
    expect(LIB).toContain("ultimoAcesso");
    expect(LIB).toContain("diasDesdeOUltimoAcesso");
    expect(PAGINA_NUA).toContain("<Presenca dias={p.diasDesdeOUltimoAcesso} />");
  });

  it("vai em dias, e nunca a data exacta da última visita", () => {
    // A data exacta em que alguém abriu o painel é informação sobre a vida
    // dele. O que o cliente precisa de saber é só se está por perto.
    expect(LIB).toContain("86_400_000");
    expect(PAGINA_NUA).toContain('"Activo hoje"');
    expect(PAGINA_NUA).toContain('"Activo esta semana"');
  });

  it("quem desapareceu há mais de um mês não mostra nada", () => {
    // Melhor silêncio do que «activo há 4 meses», que afasta em vez de atrair.
    expect(PAGINA_NUA).toContain("dias == null || dias > 30");
  });
});

describe("a página leva a algum lado", () => {
  it("o caminho para o contratar é o orçamento, e não o telefone dele", () => {
    expect(PAGINA_NUA).toContain('href="/simulador"');
    expect(PAGINA_NUA).toContain("Pedir orçamento");
  });

  it("diz de onde vêm as avaliações", () => {
    // Prova social sem proveniência não é prova de nada.
    expect(PAGINA).toContain("confirmaram o trabalho feito");
    expect(PAGINA).toContain("Não há avaliações compradas");
  });
});
