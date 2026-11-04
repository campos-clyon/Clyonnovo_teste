import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BLOG_POSTS } from "./blog-data";
import {
  ENTULHO_ATE_10_SACOS,
  ENTULHO_POR_VOLUME,
  ESVAZIAMENTO_POR_TIPOLOGIA,
  PECAS_DE_REFERENCIA,
  PRECOS,
  RECOLHA_MINIMA_DOS_MOVEIS,
  etiquetaDoEsvaziamento,
  precoDaPeca,
} from "./precos-publicos";
import {
  PAGINAS_DE_PRECO,
  comIva,
  comIvaEscrito,
  euros,
  exemplosDeMudanca,
  extrasDasMudancas,
  linhasDasMudancas,
  linhasDoEntulho,
  linhasDoEsvaziamento,
  linhasDosMonosEMoveis,
  semIvaEscrito,
} from "./quanto-custa";
import { servicoDaLigacao } from "./servico-na-ligacao";
import {
  ELEVADOR_EXTERIOR,
  HORAS_A_MAIS_COM_DESMONTAGEM,
  HORAS_POR_TIPOLOGIA,
  POR_ANDAR_SEM_ELEVADOR,
  PRECO_POR_HORA,
  PRECO_POR_KM_LONGE,
} from "./tabela-das-mudancas";

/**
 * AS PÁGINAS «QUANTO CUSTA» — 17-10-2026.
 *
 * *«Começa pelas páginas quanto custa.»* — o dono, depois do raio-X da
 * Fixando. Guarda-se aqui que os números destas páginas são os do motor (e
 * não outros escritos à mão), que o IVA vai sempre ao lado, e que as páginas
 * estão ligadas e no sitemap.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (t: string) =>
  t.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");
const ficheiroDa = (caminho: string) => `src/app${caminho}/page.tsx`;

describe("os números são os das tabelas do motor", () => {
  /*
   * A grelha do dono, 17-10-2026: 10 sacos a 40–50 €, e 1, 3 e 5 m³ desde
   * 120, 432 e 720 €. Sem IVA.
   */
  // 03-11-2026 (d4): os 10 sacos a 4,00–4,80 € cada, 40–48 €. 04-11-2026 (d7): os m³ pelos sacos que fazem.
  it("entulho: até 10 sacos a 40–48 €, e 1, 3 e 5 m³ a 160–192, 480–576 e 800–960 €", () => {
    const [sacos, um, tres, cinco, mais] = linhasDoEntulho();
    expect(sacos.valor).toEqual({ tipo: "faixa", de: 40, ate: 48 });
    expect(sacos.exemplo).toBe("Pequenas quantidades, em sacos de 25 a 30 kg");
    expect(um.valor).toEqual({ tipo: "faixa", de: 160, ate: 192 });
    expect(tres.valor).toEqual({ tipo: "faixa", de: 480, ate: 576 });
    expect(cinco.valor).toEqual({ tipo: "faixa", de: 800, ate: 960 });
    expect(mais.valor).toEqual({ tipo: "orcamento" });
    expect(um.oQue).toBe("1 m³ (≈ 40 sacos, ou a granel)");
    // O preço por m³ que se anuncia é o da linha de 1 m³.
    expect([PRECOS.recolha_entulho.minimo, PRECOS.recolha_entulho.maximo]).toEqual([ENTULHO_POR_VOLUME[0].de, ENTULHO_POR_VOLUME[0].ate]);
  });

  it("o m³ é linear, pelos sacos: 40 sacos por m³ em todas as linhas (d7; era 120 e depois 144 €/m³)", () => {
    for (const v of ENTULHO_POR_VOLUME) {
      expect(v.sacos, String(v.m3)).toBe(v.m3 * 40);
      expect(v.de / v.m3, String(v.m3)).toBe(160);
      expect(v.ate / v.m3, String(v.m3)).toBe(192);
    }
  });

  it("a grelha de /recolha-de-entulho lê os mesmos sacos e volumes", () => {
    const pagina = semComentarios(ler("src/app/recolha-de-entulho/page.tsx"));
    expect(pagina).toContain("priceFrom: `${ENTULHO_ATE_10_SACOS.minimo} €`");
    expect(pagina).toContain("priceTo: `${ENTULHO_ATE_10_SACOS.maximo} €`");
    expect(pagina).toContain("description: ENTULHO_ATE_10_SACOS.descricao");
    expect(pagina).toContain("const f = faixaDoVolume(m3);");
    expect(pagina).toContain("...linhaDosMetros(1)");
    expect(pagina).not.toContain('priceTo: "120 €"');
    expect(ENTULHO_ATE_10_SACOS.maximo).toBe(48);
  });

  // Os móveis por peça desde 03-11-2026 (d6 v2): uma linha por tamanho, «/ peça»; a recolha mínima e
  // as peças de referência pela tabela desde a d7 (04-11-2026).
  it("monos e móveis: a faixa dos monos, as três peças dos móveis, a recolha mínima e as peças de referência", () => {
    const [monos, pequena, media, grande, minima, ...pecas] = linhasDosMonosEMoveis();
    expect(monos.valor).toEqual({ tipo: "faixa", de: PRECOS.recolha_monos.minimo, ate: PRECOS.recolha_monos.maximo });
    expect([pequena, media, grande].map((l) => [l.valor, l.unidade])).toEqual([
      [{ tipo: "exacto", valor: 15 }, "peça"],
      [{ tipo: "exacto", valor: 30 }, "peça"],
      [{ tipo: "exacto", valor: 50 }, "peça"],
    ]);
    expect(minima.valor).toEqual({ tipo: "exacto", valor: RECOLHA_MINIMA_DOS_MOVEIS });
    expect(minima.oQue).toBe("Móveis: recolha mínima");
    expect(pecas.map((p) => p.valor)).toEqual(PECAS_DE_REFERENCIA.map((p) => ({ tipo: "exacto", valor: precoDaPeca(p) })));
    expect(pecas.map((p) => [p.oQue, p.exemplo])).toEqual([
      ["Sofá de 2 a 3 lugares", "Peça grande"],
      ["Cama de casal com estrado", "Peça grande"],
      ["Armário grande", "Peça grande"],
      ["Mesa com cadeiras", "Peça média"],
    ]);
  });

  it("esvaziamento: as tipologias de /esvaziamento-de-casas, com o mínimo e a moradia", () => {
    const linhas = linhasDoEsvaziamento();
    for (const t of ESVAZIAMENTO_POR_TIPOLOGIA) {
      const linha = linhas.find((l) => l.oQue === t.tipo);
      expect(linha?.valor, t.tipo).toEqual(
        t.maximo != null ? { tipo: "faixa", de: t.minimo, ate: t.maximo } : { tipo: "desde", de: t.minimo },
      );
    }
    // A garagem, o sótão e a cave, cada um com a sua faixa (29-10-2026).
    expect(linhas.find((l) => l.oQue === "Garagem")?.valor).toEqual({ tipo: "faixa", de: 120, ate: 420 });
    expect(linhas.find((l) => l.oQue === "Sótão")?.valor).toEqual({ tipo: "faixa", de: 150, ate: 480 });
    expect(linhas.find((l) => l.oQue === "Cave")?.valor).toEqual({ tipo: "faixa", de: 140, ate: 450 });
    // Os apartamentos ficam dentro da faixa oficial, e a moradia começa no tecto dela.
    const apartamentos = ESVAZIAMENTO_POR_TIPOLOGIA.filter((t) => t.maximo != null);
    expect(Math.min(...apartamentos.map((t) => t.minimo))).toBe(PRECOS.esvaziamento_apartamento.minimo);
    expect(Math.max(...apartamentos.map((t) => t.maximo!))).toBe(PRECOS.esvaziamento_apartamento.maximo);
  });

  it("as tipologias do esvaziamento já não se escrevem à mão em /esvaziamento-de-casas nem em /faq", () => {
    for (const f of ["src/app/esvaziamento-de-casas/page.tsx", "src/app/faq/page.tsx"]) {
      const codigo = semComentarios(ler(f));
      for (const t of ESVAZIAMENTO_POR_TIPOLOGIA) {
        expect(codigo, `${f}: ${t.tipo}`).not.toContain(etiquetaDoEsvaziamento(t.chave));
      }
    }
  });

  it("mudanças: cada tipologia são as horas da tabela vezes o preço da hora", () => {
    const linhas = linhasDasMudancas();
    const horas = Object.values(HORAS_POR_TIPOLOGIA);
    expect(linhas.map((l) => l.valor)).toEqual(horas.map((h) => ({ tipo: "cerca", valor: h * PRECO_POR_HORA })));
  });

  it("mudanças: os extras são os da tabela", () => {
    const valores = extrasDasMudancas().map((l) => l.valor);
    expect(valores).toEqual([
      { tipo: "exacto", valor: PRECO_POR_HORA },
      { tipo: "exacto", valor: POR_ANDAR_SEM_ELEVADOR },
      { tipo: "cerca", valor: HORAS_A_MAIS_COM_DESMONTAGEM * PRECO_POR_HORA },
      { tipo: "exacto", valor: ELEVADOR_EXTERIOR },
      { tipo: "exacto", valor: PRECO_POR_KM_LONGE },
    ]);
  });

  it("mudanças: os quatro exemplos, com a conta feita à mão", () => {
    const totais = exemplosDeMudanca().map((e) => e.totalSemIva);
    expect(totais).toEqual([
      // T1, com elevador nas duas casas.
      HORAS_POR_TIPOLOGIA.T1 * PRECO_POR_HORA,
      // T2, de um 3.º andar sem elevador para um rés-do-chão.
      HORAS_POR_TIPOLOGIA.T2 * PRECO_POR_HORA + 3 * POR_ANDAR_SEM_ELEVADOR,
      // T3, com desmontagem e montagem.
      (HORAS_POR_TIPOLOGIA.T3 + HORAS_A_MAIS_COM_DESMONTAGEM) * PRECO_POR_HORA,
      // T2 a 120 km: todos os km, ida e volta.
      HORAS_POR_TIPOLOGIA.T2 * PRECO_POR_HORA + Math.round(120 * 2 * PRECO_POR_KM_LONGE * 100) / 100,
    ]);
  });
});

describe("o IVA vai sempre ao lado", () => {
  it("as contas e a escrita", () => {
    expect(comIva(110)).toBe(135.3);
    expect(euros(135.3)).toBe("135,30 €");
    expect(euros(110)).toBe("110 €");
    expect(euros(1476)).toBe("1 476 €");
    expect(semIvaEscrito({ tipo: "faixa", de: 40, ate: 70 })).toBe("40 – 70 €");
    expect(comIvaEscrito({ tipo: "faixa", de: 40, ate: 70 })).toBe("49,20 – 86,10 €");
    expect(comIvaEscrito({ tipo: "desde", de: 330 })).toBe("desde 405,90 €");
    expect(semIvaEscrito({ tipo: "exacto", valor: 50 }, "hora")).toBe("50 € / hora");
  });

  it("a tabela tem as duas colunas, e a nota completa do preço por baixo", () => {
    const desenho = ler("src/components/precos/PaginaDePreco.tsx");
    expect(desenho).toContain(">Sem IVA</th>");
    expect(desenho).toContain(">Com IVA</th>");
    expect(desenho).toContain("{NOTA_DE_PRECO.completa}");
  });

  it("nenhuma página escreve um preço à mão", () => {
    for (const f of [
      ...PAGINAS_DE_PRECO.map((p) => ficheiroDa(p.caminho)),
      "src/components/precos/PaginaDePreco.tsx",
      "src/lib/quanto-custa.ts",
    ]) {
      expect(semComentarios(ler(f)), f).not.toMatch(/\d\s?€/);
    }
  });
});

describe("as quatro páginas", () => {
  it("existem, e cada título cabe no Google com a marca", () => {
    for (const p of PAGINAS_DE_PRECO) {
      expect(existsSync(join(process.cwd(), ficheiroDa(p.caminho))), p.caminho).toBe(true);
      expect([...`${p.titulo} | CLYON`].length, p.titulo).toBeLessThanOrEqual(60);
    }
  });

  it("estão no sitemap", () => {
    const sitemap = ler("src/app/sitemap.ts");
    for (const p of PAGINAS_DE_PRECO) expect(sitemap).toContain("url: `${SITE_URL}" + p.caminho + "`");
  });

  it("/precos liga às quatro, e cada página de serviço liga à sua", () => {
    expect(ler("src/app/precos/page.tsx")).toContain("PAGINAS_DE_PRECO.map(");
    for (const p of PAGINAS_DE_PRECO) {
      expect(semComentarios(ler(ficheiroDa(p.paginaDoServico))), p.paginaDoServico).toContain(`href="${p.caminho}"`);
    }
    expect(ler("src/app/recolha-de-moveis/page.tsx")).toContain('href="/precos/recolha-de-monos-e-moveis"');
  });

  it("o pedido abre com o serviço já escolhido", () => {
    for (const p of PAGINAS_DE_PRECO) expect(servicoDaLigacao(`?servico=${p.servico}`), p.caminho).toBe(p.servico);
  });

  it("a FAQ visível e a do FAQPage são a mesma lista, e não há nota agregada", () => {
    const desenho = ler("src/components/precos/PaginaDePreco.tsx");
    expect(desenho).toContain("mainEntity: c.faqs.map(");
    expect(desenho).toContain("faqs={c.faqs} includeSchema={false}");
    expect(desenho).not.toMatch(/aggregateRating/i);
  });

  it("as ligações «para ler a seguir» vão a páginas e artigos que existem", () => {
    const artigos = new Set(BLOG_POSTS.map((b) => `/blog/${b.slug}`));
    for (const p of PAGINAS_DE_PRECO) {
      const codigo = ler(ficheiroDa(p.caminho));
      const ligacoes = [...codigo.matchAll(/href: "(\/[^"]+)"/g)].map((m) => m[1]);
      expect(ligacoes.length, p.caminho).toBeGreaterThanOrEqual(3);
      for (const h of ligacoes) {
        if (h.startsWith("/blog/")) expect(artigos.has(h), h).toBe(true);
        else expect(existsSync(join(process.cwd(), ficheiroDa(h))), h).toBe(true);
      }
    }
  });
});
