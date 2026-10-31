import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ENTULHO_ATE_10_SACOS,
  ENTULHO_POR_VOLUME,
  ESVAZIAMENTO_POR_ESPACO,
  ESVAZIAMENTO_POR_TIPOLOGIA,
  PECAS_DE_REFERENCIA,
  PRECOS,
} from "./precos-publicos";
import { PROPOSTA_COM_FOTOGRAFIAS, faixaSemEComIva, valorSemEComIva } from "./preco-de-referencia";
import { comIva, euros } from "./quanto-custa";
import { referenciasDaCidade } from "./referencias-da-cidade";
import { SERVICES, getAllCityServiceSlugs } from "./seo-data";

/*
 * O BLOCO DE PREÇOS DAS PÁGINAS DE CIDADE — 31-10-2026.
 *
 * Nas páginas de monos e de entulho (vistas no ar no Barreiro, em Lisboa e no
 * Seixal) o bloco «Referências úteis …, sem IVA» aparecia com o título e sem
 * preço nenhum por baixo: só a recolha de móveis tinha referências. Este teste
 * percorre todas as páginas que a rota gera, serviço × cidade, e chumba com um
 * bloco sem preço, com um valor sem IVA sozinho ou com um número que não é o
 * das fontes únicas.
 */

const PAGINAS = getAllCityServiceSlugs();
/** «40 – 70 € + IVA (49,20 – 86,10 € com IVA)», «desde 120 € + IVA (147,60 € com IVA)». */
const SEM_E_COM_IVA = /\d[\d ,]* € \+ IVA \(\d[\d ,–]* € com IVA\)$/;

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const semComentarios = (s: string) =>
  s
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

describe("os preços de referência das páginas de cidade", () => {
  it("percorre as páginas todas da rota, de todos os serviços que ela gera", () => {
    expect(PAGINAS.length).toBeGreaterThan(50);
    const servicos = new Set(PAGINAS.map((p) => p.service.slug));
    expect([...servicos].sort()).toEqual(["esvaziamento-casas", "recolha-entulho", "recolha-monos", "recolha-moveis"]);
  });

  it("nenhuma página fica com o bloco vazio ou sem um único preço", () => {
    const vazias: string[] = [];
    for (const { slug, service, city } of PAGINAS) {
      const refs = referenciasDaCidade(service.slug, city.name);
      const comNumero = refs.filter((r) => SEM_E_COM_IVA.test(r.preco));
      if (refs.length === 0 || comNumero.length === 0) vazias.push(slug[0]);
    }
    expect(vazias).toEqual([]);
  });

  it("cada linha tem o sem IVA e o com IVA ao lado — nunca o sem IVA sozinho", () => {
    const nus: string[] = [];
    for (const { slug, service, city } of PAGINAS) {
      for (const r of referenciasDaCidade(service.slug, city.name)) {
        expect(r.oQue.trim(), slug[0]).not.toBe("");
        if (r.preco === PROPOSTA_COM_FOTOGRAFIAS) continue;
        if (!SEM_E_COM_IVA.test(r.preco)) nus.push(`${slug[0]}: ${r.oQue}: ${r.preco}`);
      }
    }
    expect(nus).toEqual([]);
  });

  it("os nomes das linhas não se repetem (são a chave do React)", () => {
    for (const { slug, service, city } of PAGINAS) {
      const nomes = referenciasDaCidade(service.slug, city.name).map((r) => r.oQue);
      expect(new Set(nomes).size, slug[0]).toBe(nomes.length);
    }
  });

  it("um serviço sem referências devolve uma lista vazia (e a página não mostra o bloco)", () => {
    expect(referenciasDaCidade("mudancas", "Lisboa")).toEqual([]);
    expect(referenciasDaCidade("servico-que-nao-existe", "Lisboa")).toEqual([]);
    // As mudanças têm rota própria: a desta nunca as gera.
    expect(SERVICES.some((s) => s.slug === "mudancas")).toBe(true);
    expect(PAGINAS.some((p) => p.service.slug === "mudancas")).toBe(false);
  });
});

describe("os números são os das fontes únicas", () => {
  const precos = (servico: string, cidade = "Barreiro") => referenciasDaCidade(servico, cidade).map((r) => r.preco);

  it("móveis: as peças de referência e a faixa da recolha de móveis", () => {
    const p = precos("recolha-moveis");
    for (const peca of PECAS_DE_REFERENCIA) expect(p).toContain(faixaSemEComIva(peca.minimo, peca.maximo));
    expect(p).toContain(faixaSemEComIva(PRECOS.recolha_moveis.minimo!, PRECOS.recolha_moveis.maximo!));
    expect(referenciasDaCidade("recolha-moveis", "Barreiro").map((r) => r.oQue)).toEqual([
      ...PECAS_DE_REFERENCIA.map((x) => x.peca),
      "Recolha de vários móveis no Barreiro",
    ]);
  });

  it("monos: a faixa dos monos, e a dos móveis", () => {
    const p = precos("recolha-monos");
    expect(p[0]).toBe(faixaSemEComIva(PRECOS.recolha_monos.minimo!, PRECOS.recolha_monos.maximo!));
    expect(p).toContain(faixaSemEComIva(PRECOS.recolha_moveis.minimo!, PRECOS.recolha_moveis.maximo!));
    expect(referenciasDaCidade("recolha-monos", "Seixal")[0].oQue).toBe("Recolha de monos no Seixal");
  });

  it("entulho: os 10 sacos, os volumes da grelha e a proposta com fotografias acima deles", () => {
    const p = precos("recolha-entulho", "Lisboa");
    expect(p[0]).toBe(faixaSemEComIva(ENTULHO_ATE_10_SACOS.minimo, ENTULHO_ATE_10_SACOS.maximo));
    for (const v of ENTULHO_POR_VOLUME) expect(p).toContain(`desde ${valorSemEComIva(v.desde)}`);
    expect(p[p.length - 1]).toBe(PROPOSTA_COM_FOTOGRAFIAS);
  });

  it("esvaziamento: as tipologias, e a garagem, o sótão e a cave desde o mais baixo", () => {
    const p = precos("esvaziamento-casas", "Almada");
    for (const t of ESVAZIAMENTO_POR_TIPOLOGIA) {
      expect(p).toContain(t.maximo != null ? faixaSemEComIva(t.minimo, t.maximo) : `desde ${valorSemEComIva(t.minimo)}`);
    }
    const desde = Math.min(...ESVAZIAMENTO_POR_ESPACO.map((e) => e.faixas.carrinha.de));
    expect(p).toContain(`desde ${valorSemEComIva(desde)}`);
    expect(referenciasDaCidade("esvaziamento-casas", "Almada").map((r) => r.oQue)).toContain("Garagem, sótão ou cave");
  });

  it("o com IVA é o sem IVA com o IVA, e não outro número", () => {
    const sofa = PECAS_DE_REFERENCIA[0];
    const linha = referenciasDaCidade("recolha-moveis", "Lisboa")[0].preco;
    expect(linha).toContain(`(${euros(comIva(sofa.minimo)).replace(" €", "")} – ${euros(comIva(sofa.maximo))} com IVA)`);
  });
});

describe("a página de cidade mostra estas referências, e só com elas", () => {
  const pagina = semComentarios(ler("src/app/[...slug]/page.tsx"));

  it("lê-as de referencias-da-cidade.ts, e não de uma lista escrita na página", () => {
    expect(pagina).toContain("referenciasDaCidade(service.slug, city.name)");
    expect(pagina).not.toMatch(/getPricingCopy|pricingCopy/);
  });

  it("sem referências, o bloco não aparece", () => {
    expect(pagina).toMatch(/\{referencias\.length > 0 && \(/);
  });

  it("o título já não diz «sem IVA», e cada linha mostra o preço com o IVA ao lado", () => {
    const i = pagina.indexOf("Preços de referência {paraTerra(city.name)}");
    expect(i).toBeGreaterThan(-1);
    expect(pagina).not.toContain("Referências úteis {paraTerra(city.name)}, sem IVA");
    expect(pagina.slice(i, i + 1200)).toContain("{r.preco}");
    expect(pagina.slice(i, i + 1200)).toContain("{NOTA_DOS_PRECOS}");
  });
});
