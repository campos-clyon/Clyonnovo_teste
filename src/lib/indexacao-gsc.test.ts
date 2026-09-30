import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAllCidadeSlugs } from "./mudancas-cidades";
import { ROTAS_COM_SEGREDO } from "./endereco-sem-segredos";

/**
 * O que o Search Console apanhou, e o que aqui fica preso.
 *
 * 100 páginas indexadas contra 108 não indexadas. Fui ler os sete motivos, um
 * a um, e as conclusões não foram as que eu esperava:
 *
 * — Os 404 e os erros de redirecionamento JÁ ESTAVAM corrigidos. As cadeias
 *   resolvem-se hoje em um ou dois saltos e acabam em 200; os relatórios são
 *   de rastreios de Março a Julho. Falta pedir a revalidação, não código.
 *
 * — O que sobrava era um redirect que perdia a cidade pelo caminho:
 *   /mudanças-lisboa aterrava em /mudancas, o balcão geral. Quem escreveu
 *   aquele URL queria Lisboa.
 *
 * — E as rotas que levam um segredo no endereço não estavam no robots.txt.
 *
 * O maior número, esse, não se corrige com um commit: 75 páginas rastreadas
 * ou descobertas e não indexadas. Medi duas páginas de cidade — 81% de texto
 * igual entre elas. É uma decisão de conteúdo, não um erro.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const CONFIG = ler("next.config.ts");
const ROBOTS = ler("src/app/robots.ts");
const CIDADE = ler("src/app/[...slug]/page.tsx");

describe("os redirects não perdem a cidade", () => {
  it("são gerados da fonte, e não escritos à mão", () => {
    // Uma lista repetida diverge da outra ao segundo mês, e a divergência
    // manifesta-se como 404 — que é o que estes redirects vieram apagar.
    expect(CONFIG).toContain('import { getAllCidadeSlugs } from "./src/lib/mudancas-cidades"');
    expect(CONFIG).toContain("const CIDADES_COM_PAGINA = getAllCidadeSlugs()");
    expect(CONFIG).toContain("const paraAsCidades = (prefixo: string)");
  });

  it("cobrem as duas famílias que o Google reportou", () => {
    expect(CONFIG).toContain('...paraAsCidades("/mudan%C3%A7as-")');
    expect(CONFIG).toContain('...paraAsCidades("/camiao-com-motorista-")');
  });

  it("uma cidade sem página própria cai no balcão geral, não num 404", () => {
    // camiao-com-motorista-moita, -amadora, -cascais, -benfica e -setubal não
    // têm página de mudanças. Sem o apanha-tudo a seguir, o redirect trocava
    // um 404 por outro.
    const i = CONFIG.indexOf('...paraAsCidades("/camiao-com-motorista-")');
    expect(i).toBeGreaterThan(-1);
    const seguinte = CONFIG.slice(i, i + 400);
    // `:city(.*)` desde o Next 15.5, que recusa `:city*` sem prefixo — é o
    // mesmo apanha-tudo escrito de outra maneira.
    expect(seguinte).toContain('source: "/camiao-com-motorista-:city(.*)"');
    expect(seguinte).toContain('destination: "/mudancas"');
  });

  it("o apanha-tudo vem DEPOIS das cidades — a ordem é a regra", () => {
    const apanhaTudo = CONFIG.indexOf('source: "/mudan%C3%A7as-:city(.*)"');
    expect(apanhaTudo).toBeGreaterThan(-1);
    expect(CONFIG.indexOf('...paraAsCidades("/mudan%C3%A7as-")')).toBeLessThan(apanhaTudo);
  });

  it("nenhum parâmetro repetido sem prefixo — parava o build do Next 15.5", () => {
    // «Can not repeat "city" without a prefix and suffix»: `-:city*` e
    // `-:city+` só são aceites depois de uma "/". O `/:path*` continua válido.
    expect(CONFIG).not.toMatch(/[^/]:[a-zA-Z]+[*+]"/);
  });

  it("as treze cidades de mudanças existem mesmo", () => {
    const cidades = getAllCidadeSlugs();
    expect(cidades.length).toBeGreaterThanOrEqual(13);
    for (const reportada of ["lisboa", "montijo", "sintra", "alcochete", "carnaxide"]) {
      expect(cidades).toContain(reportada);
    }
  });

  it("o camião com motorista continua descontinuado — e sem uma ligação no site", () => {
    // Ele confirmou: "camiao-com-motorista foi descontinuado do projeto".
    // O redirect existe para quem chega de fora; o site não pode oferecê-lo.
    const paginas = ler("src/app/servicos/page.tsx");
    expect(paginas).not.toContain("camiao-com-motorista");
  });
});

describe("o robots.txt", () => {
  it("bloqueia TODAS as rotas que levam um segredo no endereço", () => {
    // O URL é a credencial: quem o tiver abre o pedido de outra pessoa, com a
    // morada e o telefone lá dentro. Um link colado num fórum bastava.
    for (const rota of ROTAS_COM_SEGREDO) {
      // /admin/aprovar/ já está coberto por /admin.
      if (rota.startsWith("/admin")) {
        expect(ROBOTS).toContain('"/admin"');
        continue;
      }
      expect(ROBOTS).toContain(`"${rota}"`);
    }
  });

  it("bloqueia as áreas de quem está de dentro", () => {
    for (const area of ["/plataforma", "/profissionais/painel"]) {
      expect(ROBOTS).toContain(`"${area}"`);
    }
  });

  it("deixa o /colaboradores aberto, para o Google ver o 404 e o esquecer", () => {
    /*
     * Este teste exigia `"/colaboradores"` no robots.txt. As páginas de lá
     * foram removidas e tudo o que está debaixo responde 404 (confirmado a
     * 29-09-2026): bloqueado, o Google nunca via o 404 e deixava os endereços
     * em «Bloqueada pelo robots.txt» indefinidamente. Sem comentários, porque
     * o comentário do robots.ts explica o caminho pelo nome.
     */
    const codigo = ROBOTS.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(codigo).not.toContain('"/colaboradores"');
    expect(codigo).not.toContain('"/colaboradores/"');
  });

  it("deixa passar o CSS e o JavaScript de que a página precisa", () => {
    /*
     * «Bloqueada pelo robots.txt», 19-09-2026, num /_next/static/css/….css.
     * O Disallow: /_next/ apanhava as folhas de estilo e os chunks do Next, e
     * o Googlebot renderizava o site inteiro sem eles — avaliando uma página
     * que nenhuma pessoa vê.
     *
     * O desbloqueio depende de uma coisa só: no robots.txt manda a regra MAIS
     * LONGA que casa com o endereço. /_next/static/ tem de continuar a ser
     * mais comprida do que /_next/, ou o Disallow volta a ganhar em silêncio.
     */
    expect(ROBOTS).toContain('const ABERTO = ["/", "/_next/static/"]');
    expect(ROBOTS).toContain("allow: ABERTO,");
    expect(ROBOTS).toContain('"/_next/"');
    expect("/_next/static/".length).toBeGreaterThan("/_next/".length);
  });

  it("continua a ter UM só grupo de user-agent", () => {
    // Em robots.txt vence o grupo mais específico, e um robô só lê esse. Um
    // grupo Googlebot com Allow: / anulava a lista toda — já aconteceu aqui.
    expect((ROBOTS.match(/userAgent:/g) ?? []).length).toBe(1);
  });
});

describe("o texto das páginas de cidade", () => {
  it("deixou de ter a gralha que ia em todas elas", () => {
    // "noutrás zonas da Lisboa" — duas gralhas numa frase, replicadas por
    // todas as páginas de cidade da região.
    expect(CIDADE).not.toContain("noutrás");
    expect(CIDADE).not.toContain("zonas da ${regionLabel}");
    expect(CIDADE).toContain("noutras zonas de ${regionLabel}");
  });
});
