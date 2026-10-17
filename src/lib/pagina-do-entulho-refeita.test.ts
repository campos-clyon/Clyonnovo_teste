import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { A_GRANEL, COMO_SE_RECOLHE_ENTULHO, NAO_HA_CONTENTORES } from "./sacos-de-entulho";
import { reviews } from "./reviews-data";
import { PEDIR_ENTULHO } from "@/app/recolha-de-entulho/CalculadoraDeEntulho";

/**
 * A PÁGINA DO ENTULHO, REFEITA — 17-10-2026.
 *
 * *«Nós fazemos recolha a granel!»* — o dono, sobre a página que dizia «e não
 * faz recolha a granel». E no mesmo pedido: *«melhore essa página, achei-a
 * muito fraca… crie uma história sobre nós… e um bom SEO»*.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (t: string) =>
  t.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");
const PAGINA = ler("src/app/recolha-de-entulho/page.tsx");
const CODIGO = semComentarios(PAGINA);

describe("a granel recolhe-se", () => {
  it("as frases da casa dizem-no, e o «não» fica só para os contentores", () => {
    expect(A_GRANEL).toContain("recolhe-se a granel");
    expect(COMO_SE_RECOLHE_ENTULHO).toContain("ou a granel");
    expect(NAO_HA_CONTENTORES).not.toContain("granel");
  });

  it("e nenhum ficheiro de produção diz o contrário", () => {
    const ficheiros: string[] = [];
    const andar = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) andar(p);
        else if (/\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n)) ficheiros.push(p);
      }
    };
    andar(join(process.cwd(), "src"));
    expect(ficheiros.length).toBeGreaterThan(300);
    const maus = ficheiros.filter((f) =>
      /não faz recolha a granel|única forma de recolha de entulho/i.test(semComentarios(readFileSync(f, "utf8"))),
    );
    expect(maus).toEqual([]);
  });
});

describe("a página", () => {
  it("diz «a granel» no título da secção, na descrição e na pergunta", () => {
    expect(CODIGO).toContain("Recolha de entulho em sacos ou a granel");
    expect(CODIGO).toContain('"Recolha de entulho de obras em Lisboa, Margem Sul e Setúbal, em sacos ou a granel e sem contentores."');
    expect(CODIGO).toContain('question: "Recolhem entulho a granel?"');
  });

  it("o botão principal abre o simulador já no entulho — o mesmo endereço da calculadora", () => {
    expect(CODIGO).toContain(`const PEDIR_ENTULHO = "${PEDIR_ENTULHO}";`);
    expect(CODIGO).toContain("<Link href={PEDIR_ENTULHO} className=\"site-btn-primary");
  });

  it("não escreve euros à mão: os números vêm das constantes", () => {
    expect(CODIGO).not.toMatch(/\d\s*€/);
    // E as notas também: nada de «158» ou «4,9» escritos no texto.
    expect(CODIGO).toContain("{AVALIACOES.contratacoes} trabalhos");
    expect(CODIGO).not.toMatch(/\b(158|119|42) (trabalhos|avaliações)/);
  });

  it("o preço nunca vai sozinho: «+ IVA» ao lado, e o com IVA por baixo", () => {
    expect(CODIGO).toContain("const semIvaComAviso = (v: Valor) => `${semIvaEscrito(v)} + IVA`;");
    expect(CODIGO).toContain("{comIvaEscrito(l.valor)} com IVA");
  });

  it("a história existe, e liga para quem somos", () => {
    expect(CODIGO).toContain("A história da CLYON, e porque o entulho se recolhe assim");
    expect(CODIGO).toContain('href="/sobre-nos"');
  });

  it("os testemunhos são os de reviews-data, palavra por palavra", () => {
    const nomes = [...CODIGO.matchAll(/const TESTEMUNHOS = \[([^\]]+)\]/g)][0]?.[1] ?? "";
    const escolhidos = [...nomes.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(escolhidos.length).toBe(3);
    for (const n of escolhidos) expect(reviews.some((r) => r.name === n), n).toBe(true);
    expect(CODIGO).toContain("{t.text}");
  });

  it("o catálogo de preços vai para os dados estruturados, sem IVA", () => {
    expect(CODIGO).toContain('"@type": "OfferCatalog"');
    expect(CODIGO).toContain("valueAddedTaxIncluded: false");
  });
});
