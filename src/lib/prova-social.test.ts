import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { AVALIACOES, AVALIACOES_TOTAL } from "./seo-data";
import { reviews } from "./reviews-data";

/**
 * Os números que o site diz sobre si próprio.
 *
 * PORQUE É QUE ISTO PRECISA DE TESTE
 *
 * Porque já divergiram duas vezes. O site chegou a ter três contagens em
 * circulação ao mesmo tempo — "188 trabalhos", "163 avaliações", "155
 * avaliações" — e a página /recolha-de-moveis contradizia-se a si própria
 * dentro do mesmo HTML: 155 no badge, 163 no bloco de estatísticas, 42 linhas
 * abaixo.
 *
 * Nenhum destes números dá erro quando está errado. Compila, renderiza, e
 * fica ali a dizer uma coisa que ninguém consegue confirmar. A única forma de
 * o apanhar é procurá-lo.
 *
 * O QUE ESTÁ EM JOGO NÃO É ARRUMAÇÃO
 *
 * `aggregateRating` a declarar mais avaliações do que a página mostra é o
 * padrão que o Google sanciona como "self-serving review snippets", e a
 * penalização não é da página — é das estrelas em TODO o domínio. O site já
 * declarou 163 numa página que mostrava trinta.
 */

const RAIZ = process.cwd();

function ficheirosDe(dir: string, encontrados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      ficheirosDe(caminho, encontrados);
    } else if (nome.endsWith(".tsx") || nome.endsWith(".ts")) {
      encontrados.push(caminho);
    }
  }
  return encontrados;
}

/** O código, sem os comentários — que é onde estes números são explicados. */
function semComentarios(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const PAGINAS = ficheirosDe(join(RAIZ, "src", "app"));

describe("a nota agregada", () => {
  /**
   * A regra tem uma razão simples: a nota agregada tem de contar avaliações
   * que a própria página mostra. /avaliacoes mostra-as; mais nenhuma mostra.
   */
  it("só existe nas páginas que mostram as avaliações que contam", () => {
    /*
     * SÃO DUAS, E A REGRA É A MESMA.
     *
     * `/avaliacoes` agrega as avaliações da CLYON e reproduz-nas. A página de
     * um profissional agrega as DELE e reproduz as dele — cada uma conta o que
     * mostra, que é a única coisa que um revisor humano do Google verifica.
     */
    const comRating = PAGINAS.filter((f) =>
      semComentarios(readFileSync(f, "utf8")).includes("aggregateRating"),
    ).map((f) => f.replace(RAIZ, "").replace(/\\/g, "/"));

    expect(comRating.sort()).toEqual([
      "/src/app/avaliacoes/page.tsx",
      "/src/app/profissionais/[slug]/page.tsx",
    ]);
  });

  it("a do profissional não declara nota nenhuma sem avaliações", () => {
    /*
     * Um `aggregateRating` com zero avaliações é motivo de acção manual do
     * Google, e é justo que seja: são as estrelas que aparecem no resultado da
     * pesquisa. A guarda tem de vir ANTES da declaração.
     */
    // Sem comentários: a palavra aparece primeiro numa nota explicativa, e
    // procurar no ficheiro cru media a distância à nota em vez de ao código.
    const perfil = semComentarios(
      readFileSync(join(RAIZ, "src/app/profissionais/[slug]/page.tsx"), "utf8"),
    );
    const i = perfil.indexOf("aggregateRating");
    expect(i).toBeGreaterThan(-1);
    expect(
      perfil.lastIndexOf("p.quantasAvaliacoes > 0 && p.notaMedia != null", i),
    ).toBeGreaterThan(-1);
  });

  it("e reproduz mesmo as avaliações que agrega", () => {
    // É a regra toda: contar o que se mostra. Uma nota agregada numa página
    // sem as provas visíveis é o que o Google trata como enganoso.
    const perfil = readFileSync(join(RAIZ, "src/app/profissionais/[slug]/page.tsx"), "utf8");
    expect(perfil).toContain("p.avaliacoes.map");
    expect(perfil).toContain("O que dizem os clientes");
  });

  it("declara exactamente as avaliações que a página reproduz", () => {
    const pagina = readFileSync(join(RAIZ, "src/app/avaliacoes/page.tsx"), "utf8");
    // `String(reviews.length)` e não AVALIACOES_TOTAL. Declarar 155 sobre 29
    // provas visíveis é exactamente o que fazia o antigo 163 — e é a
    // discrepância que um revisor humano do Google confirma em dez segundos.
    expect(pagina).toContain("reviewCount: String(reviews.length)");
    expect(pagina).not.toContain("reviewCount: String(AVALIACOES_TOTAL)");
  });

  it("o número de avaliações reproduzidas é menor do que o total declarado em texto", () => {
    // Se um dia forem iguais, deixa de haver conflito nenhum — mas enquanto
    // forem diferentes, é o schema que tem de ficar com o número pequeno.
    expect(reviews.length).toBeLessThanOrEqual(AVALIACOES_TOTAL);
  });
});

describe("os números de prova social", () => {
  it("não estão escritos à mão em página nenhuma", () => {
    /*
     * "188" nunca teve origem: não vinha de constante, não vinha da base de
     * dados, não era contado em lado nenhum. "163" era o total antigo das
     * avaliações e sobreviveu em oito sítios depois de a constante existir.
     *
     * Procura-se o número junto da palavra que o qualifica, e não o número
     * sozinho — senão qualquer `maxLength={163}` fazia o teste falhar por
     * nada.
     */
    const proibidos = [
      /\b188\s*\+?\s*(trabalhos|avalia|reviews)/i,
      /\b163\s*(trabalhos|avalia|reviews)/i,
      /value:\s*"188/,
      /REVIEWS_COUNT\s*=\s*\d/,
    ];

    const maus: string[] = [];
    for (const f of [...PAGINAS, ...ficheirosDe(join(RAIZ, "src", "lib"))]) {
      if (f.endsWith("prova-social.test.ts")) continue;
      const codigo = semComentarios(readFileSync(f, "utf8"));
      for (const p of proibidos) {
        if (p.test(codigo)) maus.push(`${f.replace(RAIZ, "")} — ${p}`);
      }
    }
    expect(maus).toEqual([]);
  });

  it("somam o que a constante diz", () => {
    expect(AVALIACOES_TOTAL).toBe(AVALIACOES.google + AVALIACOES.fixando);
    expect(AVALIACOES_TOTAL).toBe(155);
  });

  it("a média usa vírgula, como em português", () => {
    expect(AVALIACOES.media).toBe("5,0");
  });

  it("cada origem tem um endereço onde se confirma", () => {
    // Um número de prova social sem fonte não se confirma, e um número que não
    // se confirma não vale nada. É por isso que estes dois URL existem.
    expect(AVALIACOES.googleUrl).toMatch(/^https:\/\//);
    expect(AVALIACOES.fixandoUrl).toMatch(/^https:\/\//);
  });
});
