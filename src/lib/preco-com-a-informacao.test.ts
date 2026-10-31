import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ESVAZIAMENTO_POR_ESPACO, PECAS_DE_REFERENCIA, PRECOS, SEM_IVA_NA_FRASE, maisIva } from "./precos-publicos";
import { CITIES, NA_PROPOSTA_COM_IVA, SERVICES } from "./seo-data";
import { tituloDaCidade } from "./titulos-seo";
import {
  PRECO_DA_MUDANCA_CURTO,
  PRECO_DA_MUDANCA_POR_EXTENSO,
  PRECO_POR_HORA_COM_IVA,
  tabelaEmLinhas,
} from "./tabela-das-mudancas";
import { BLOG_POSTS } from "./blog-data";
import {
  comIva,
  euros,
  extrasDasMudancas,
  linhasDasMudancas,
  linhasDoEntulho,
  linhasDoEsvaziamento,
  linhasDosMonosEMoveis,
  semEComIvaEscrito,
} from "./quanto-custa";
import { comIvaDaEtiqueta, esvaziamentoComOIvaAoLado, faixaSemEComIva, pecaComOIvaAoLado } from "./preco-de-referencia";
import PricingTable from "@/components/service/PricingTable";

/*
 * «DEIXE O PREÇO SEM IVA MAS COM A INFORMAÇÃO» — o dono, 14-10-2026.
 *
 * Os preços de referência ficam sem IVA (decisão de 03-10-2026), mas nenhum
 * sai sozinho: ao lado vai «+ IVA», ou «sem IVA (na proposta, o preço já vem
 * com IVA incluído)». Os títulos de 50 páginas de cidade e várias descrições
 * mostravam o número nu.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

/** «250 €», «260 – 350 €», «1,30 €» — um preço escrito à letra. */
const NUMERO_A_LETRA = /(?<![\w.,])\d{1,4}(?:[.,]\d{1,2})?\s?(?:–\s?\d{1,4}(?:[.,]\d{1,2})?\s?)?€/;

function paginas(dir: string): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...paginas(p));
    else if (/\.tsx?$/.test(nome) && !/\.test\./.test(nome)) out.push(p);
  }
  return out;
}

describe("a informação que acompanha o preço", () => {
  it("«+ IVA» vai atrás do número, e só uma vez", () => {
    expect(maisIva("40 – 120 €")).toBe("40 – 120 € + IVA");
    expect(maisIva(PRECOS.mudanca.etiqueta)).toBe(PRECOS.mudanca.etiqueta);
  });

  it("a frase é a nota do dono, dita a meio da frase", () => {
    const nota = NA_PROPOSTA_COM_IVA.replace(/\.$/, "");
    expect(SEM_IVA_NA_FRASE).toBe(`sem IVA (${nota.charAt(0).toLowerCase()}${nota.slice(1)})`);
  });
});

describe("nenhum preço sai sozinho", () => {
  it("nos títulos das páginas de cidade", () => {
    const nus: string[] = [];
    for (const city of CITIES) {
      for (const s of SERVICES) {
        const t = tituloDaCidade(s.name, city.name, s.slug, city.slug);
        if (t.includes("€") && !t.includes("IVA")) nus.push(t);
      }
    }
    expect(nus).toEqual([]);
  });

  it("nas descrições, respostas e subtítulos que levam uma etiqueta de preço", () => {
    // O texto que o cliente lê — a descrição que o Google mostra, a resposta
    // de uma FAQ, o subtítulo de uma tabela — com uma etiqueta de preço lá
    // dentro tem de levar a informação do IVA: «+ IVA», «sem IVA», a frase
    // feita ou a nota completa.
    const PRECO = /PRECOS?\.[a-z_]+\.etiqueta|PRECO_[A-Z_]+\.etiqueta|\$\{PRECO_(?!FECHADO|DA_MUDANCA_)[A-Z_]+\}|MENOR_PRECO_PUBLICADO\} €/;
    const nus: string[] = [];
    for (const f of paginas(join(process.cwd(), "src", "app"))) {
      const codigo = readFileSync(f, "utf8");
      for (const m of codigo.matchAll(/\b(description|answer|a|text|texto|subtitle|desc)(?::\s*|=\{)`([^`]*)`/g)) {
        const txt = m[2];
        if (!PRECO.test(txt)) continue;
        if (/IVA|maisIva|SEM_IVA_NA_FRASE|NOTA_DE_PRECO/.test(txt)) continue;
        nus.push(`${f.replace(process.cwd(), "")}: ${m[1]}: ${txt.slice(0, 80)}`);
      }
    }
    expect(nus).toEqual([]);
  });

  it("nenhum «N €» escrito à letra sai sem a informação do IVA nas páginas de src/app (25-10-2026)", () => {
    /*
     * O teste de cima só via as etiquetas das fontes. Um número escrito à mão
     * — «a partir de 250 €», «desde 75 €», «(120 €)» — passava, e era aí que
     * as páginas divergiam da fonte. Fica de fora o que o cliente não lê: as
     * rotas da API, o backoffice e o painel do profissional.
     */
    const FORA = /[\\/](api|admin)[\\/]|[\\/]profissionais[\\/]painel[\\/]/;
    const semComentarios = (s: string) =>
      s
        .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
        .replace(/^[ \t]*\/\/.*$/gm, "")
        .replace(/[ \t]\/\/ [^\n]*$/gm, "");
    // As cadeias: "…", '…', `…`, e o texto solto do JSX entre > e <.
    const CADEIA = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`]*`|>[^<>{}]*</g;
    const nus: string[] = [];
    for (const f of paginas(join(process.cwd(), "src", "app"))) {
      if (FORA.test(f)) continue;
      const codigo = semComentarios(readFileSync(f, "utf8"));
      for (const m of codigo.matchAll(CADEIA)) {
        if (!NUMERO_A_LETRA.test(m[0])) continue;
        if (/IVA|maisIva|SEM_IVA_NA_FRASE|NOTA_DE_PRECO/.test(m[0])) continue;
        nus.push(`${f.replace(process.cwd(), "")}: ${m[0].replace(/\s+/g, " ").slice(0, 80)}`);
      }
    }
    expect(nus).toEqual([]);
  });

  it("e a regra apanha o número à mão, e não o que vem da fonte", () => {
    expect(NUMERO_A_LETRA.test("a partir de 250 €")).toBe(true);
    expect(NUMERO_A_LETRA.test("260 – 350 €")).toBe(true);
    expect(NUMERO_A_LETRA.test("(1,30 € por km)")).toBe(true);
    expect(NUMERO_A_LETRA.test("${PRECO_CASA} para arrecadações")).toBe(false);
  });

  it("as frases de preço das mudanças já trazem o IVA dentro", () => {
    // Por isso o teste de cima as deixa passar pelo nome.
    expect(PRECO_DA_MUDANCA_CURTO).toContain("IVA");
    expect(PRECO_DA_MUDANCA_POR_EXTENSO).toContain("IVA");
  });

  it("e a lista de referências das páginas de cidade leva o com IVA ao lado de cada valor", () => {
    // Desde 31-10-2026 cada linha diz os dois valores (`referencias-da-cidade.ts`),
    // e o título deixou de dizer «sem IVA». Ver referencias-da-cidade.test.ts.
    const pagina = ler("src/app/[...slug]/page.tsx");
    expect(pagina).toContain("Preços de referência {paraTerra(city.name)}");
    expect(pagina).toContain("{r.preco}");
  });

  it("nos cartões e nas frases que mostram o número em letra grande", () => {
    expect(ler("src/app/page.tsx")).toContain("{maisIva(price)}");
    expect(ler("src/app/servicos/page.tsx")).toContain("return preco ? maisIva(preco) : \"orçamento personalizado\";");
    // Em /precos vai sozinho num título, com maiúscula (15-10-2026).
    expect(ler("src/app/precos/page.tsx")).toContain(
      "return comMaiuscula(preco ? maisIva(preco) : \"orçamento personalizado\");",
    );
    expect(ler("src/app/recolha-de-moveis/page.tsx")).toContain("{maisIva(PRECO_MOVEIS.etiqueta)}</p>");
    for (const f of ["recolha-de-camas", "recolha-de-armarios", "recolha-de-eletrodomesticos", "recolha-de-sofas"]) {
      expect(ler(`src/app/${f}/page.tsx`), f).toMatch(/custa, tipicamente, \{PRECO_MOVEIS\.etiqueta\}, \{SEM_IVA_NA_FRASE\}\./);
    }
  });
});

/*
 * O SEM IVA NUNCA SOZINHO, TAMBÉM NAS LISTAS — 31-10-2026 (ordem do CEO, pela
 * regra do dono de 03 e 14-10-2026).
 *
 * O artigo «Quanto custa retirar um sofá em Lisboa» listava as peças só com o
 * sem IVA, debaixo de «(valores sem IVA)»; /precos/esvaziamento-de-casas dizia
 * as faixas da garagem, do sótão e da cave «(sem IVA)» e mais nada; e os
 * cartões de /contactos, as grelhas do esvaziamento e do entulho, o preço de
 * /recolha-de-monos e a tabela de /mudancas mostravam o número nu por cima de
 * «Valores orientativos, sem IVA». Cada valor leva agora o com IVA ao lado.
 * A regra das frases («fica em ‹›, também sem IVA») é a p da orquestra.
 */
describe("o sem IVA nunca sozinho, também nas listas (31-10-2026)", () => {
  const UM_EURO = /\d\s?€/;
  const COM_IVA = /com IVA|IVA inclu[íi]do/;
  const frasesDe = (t: string) => t.split(/(?<=[.!?;])\s+/);

  it("nos artigos: nenhuma linha de lista sem o IVA, e nenhum «sem IVA» sem o com IVA na frase", () => {
    const nus: string[] = [];
    for (const a of BLOG_POSTS) {
      const textos = [
        a.description,
        a.intro,
        ...a.sections.flatMap((s) => [...s.paragraphs, ...(s.bullets ?? [])]),
        ...a.faq.map((f) => f.answer),
      ];
      for (const t of textos) {
        for (const frase of frasesDe(t)) {
          if (/sem IVA/.test(frase) && UM_EURO.test(frase) && !COM_IVA.test(frase)) nus.push(`${a.slug}: ${frase}`);
        }
      }
      // Uma linha de lista com um preço diz o IVA nela mesma: o «(valores sem IVA)» de cima não chega.
      // As tarifas das câmaras («47,02 € por metro cúbico») são delas, não preços da plataforma.
      for (const b of a.sections.flatMap((s) => s.bullets ?? [])) {
        if (UM_EURO.test(b) && !/IVA/.test(b) && !/\bCâmara\b/.test(b)) nus.push(`${a.slug} (lista): ${b}`);
      }
    }
    expect(nus).toEqual([]);
  });

  it("o artigo do sofá: cada peça das fontes, com o com IVA ao lado", () => {
    const sofa = BLOG_POSTS.find((p) => p.slug === "quanto-custa-retirar-um-sofa-em-lisboa")!;
    const lista = sofa.sections.flatMap((s) => s.bullets ?? []);
    expect(lista).toEqual(PECAS_DE_REFERENCIA.map(pecaComOIvaAoLado));
    for (const p of PECAS_DE_REFERENCIA) {
      expect(lista.join("\n")).toContain(`${euros(comIva(p.minimo)).replace(" €", "")} – ${euros(comIva(p.maximo))} com IVA`);
    }
    expect(JSON.stringify(sofa)).not.toMatch(/valores sem IVA\)|também sem IVA/);
  });

  it("nas tabelas «quanto custa», o texto pequeno de cada linha leva o com IVA", () => {
    const linhas = [
      ...linhasDoEntulho(),
      ...linhasDosMonosEMoveis(),
      ...linhasDoEsvaziamento(),
      ...linhasDasMudancas(),
      ...extrasDasMudancas(),
    ];
    const nus = linhas.filter((l) => l.exemplo && UM_EURO.test(l.exemplo) && !COM_IVA.test(l.exemplo)).map((l) => `${l.oQue}: ${l.exemplo}`);
    expect(nus).toEqual([]);
    // A garagem, o sótão e a cave: as três faixas, cada uma com os dois valores.
    for (const e of ESVAZIAMENTO_POR_ESPACO) {
      const linha = linhasDoEsvaziamento().find((l) => l.oQue === e.espaco)!;
      for (const f of Object.values(e.faixas)) {
        expect(linha.exemplo, e.espaco).toContain(semEComIvaEscrito({ tipo: "faixa", de: f.de, ate: f.ate }));
      }
      expect(linha.exemplo, e.espaco).not.toMatch(/\(sem IVA\)/);
    }
    expect(semEComIvaEscrito({ tipo: "faixa", de: 120, ate: 180 })).toBe("120 – 180 € + IVA (147,60 – 221,40 € com IVA)");
    expect(semEComIvaEscrito({ tipo: "faixa", de: 120, ate: 180 })).toBe(faixaSemEComIva(120, 180));
  });

  it("a tabela das mudanças: cada número com o mesmo com IVA por baixo", () => {
    const linhas = tabelaEmLinhas().flatMap((s) => s.linhas);
    const nus = linhas.filter(([, semIva, comIvaAoLado]) => UM_EURO.test(semIva) && !(comIvaAoLado && /com IVA$/.test(comIvaAoLado)));
    expect(nus).toEqual([]);
    const hora = linhas.find(([o]) => o.startsWith("Carrinha"))!;
    expect(hora[2]).toBe(`${PRECO_POR_HORA_COM_IVA.toFixed(2).replace(".", ",")} € / hora com IVA`);
    const componente = ler("src/components/mudancas/TabelaDasMudancas.tsx");
    expect(componente).toContain("{secao.linhas.map(([o, quanto, comIva]) =>");
    expect(componente).not.toContain("Valores sem IVA (23 %), salvo onde se diz o contrário.");
  });

  it("os cartões e as grelhas que mostravam o número nu", () => {
    // Só o com IVA, para a linha pequena por baixo de `maisIva(etiqueta)`.
    expect(comIvaDaEtiqueta("recolha_moveis")).toBe("49,20 – 147,60 € com IVA");
    expect(comIvaDaEtiqueta("esvaziamento_casa")).toBe("desde 307,50 € com IVA");
    expect(comIvaDaEtiqueta("esvaziamento_garagem")).toBe("desde 147,60 € com IVA");
    expect(comIvaDaEtiqueta("recolha_entulho")).toBe("desde 147,60 €/m³ com IVA");
    expect(comIvaDaEtiqueta("mudanca")).toBe(`${euros(PRECO_POR_HORA_COM_IVA)}/hora com IVA`);
    expect(comIvaDaEtiqueta("outro")).toBeNull();

    const contactos = ler("src/app/contactos/page.tsx");
    expect(contactos).toContain("{comIvaDaEtiqueta(chave)}");
    expect(contactos).not.toContain("{PRECOS[chave]?.etiqueta}");
    for (const f of ["src/app/esvaziamento-de-casas/page.tsx", "src/app/esvaziamento-de-casas-amadora/page.tsx"]) {
      expect(ler(f), f).toContain("price: esvaziamentoComOIvaAoLado(t.chave)");
      expect(ler(f), f).not.toMatch(/price:\s*etiquetaDoEsvaziamento\(/);
    }
    expect(esvaziamentoComOIvaAoLado("T2")).toBe(faixaSemEComIva(320, 420));
    expect(esvaziamentoComOIvaAoLado("moradia")).toBe("desde 450 € + IVA (553,50 € com IVA)");
    expect(ler("src/app/recolha-de-monos/page.tsx")).not.toContain("{PRECO_MONOS.etiqueta}</span>");
    expect(ler("src/app/servicos/[slug]/page.tsx")).toContain("{comIvaDaEtiqueta(cat.id)}");
  });

  it("a grelha do entulho (PricingTable) diz o com IVA de cada linha com número", () => {
    (globalThis as { React?: typeof React }).React = React;
    const html = renderToStaticMarkup(
      React.createElement(PricingTable, {
        rows: [
          { service: "Sacos", priceFrom: "40 €", priceTo: "50 €" },
          { service: "Até 1 m³", priceFrom: "120 €" },
          { service: "Acima de 5 m³", priceFrom: "Orçamento personalizado" },
        ],
      }),
    );
    expect(html).toContain("40 – 50 € + IVA");
    expect(html).toContain("49,20 – 61,50 € com IVA");
    expect(html).toContain("desde 120 € + IVA");
    expect(html).toContain("desde 147,60 € com IVA");
    expect(html).not.toContain("Orçamento personalizado + IVA");
  });

  it("nenhuma etiqueta de preço nua num ecrã que o cliente lê", () => {
    // `{PRECOS[x]?.etiqueta}`, `{PRECO_MONOS.etiqueta}` sozinhos: sem «+ IVA», sem a frase do dono.
    const FORA = /[\\/](api|admin|conta|pedido|portal)[\\/]|[\\/]profissionais[\\/](painel|pedidos)[\\/]/;
    const ETIQUETA_NUA = /\{\s*[\w.]+(\[[^\]]+\])?\??\.etiqueta\s*\}/;
    // No JSX ou numa grelha; numa frase (`${etiquetaDoEsvaziamento(…)}` … NOTA_DE_PRECO) vale a nota.
    const ESVAZIAMENTO_NU = /(?<!\$)\{\s*etiquetaDoEsvaziamento\(|price:\s*etiquetaDoEsvaziamento\(/;
    const semComentarios = (s: string) =>
      s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");
    const nus: string[] = [];
    for (const dir of ["src/app", "src/components"]) {
      for (const f of paginas(join(process.cwd(), dir))) {
        if (!f.endsWith(".tsx") || FORA.test(f)) continue;
        semComentarios(readFileSync(f, "utf8"))
          .split(/\r?\n/)
          .forEach((linha, i) => {
            const nua = (ETIQUETA_NUA.test(linha) && !/IVA/.test(linha)) || ESVAZIAMENTO_NU.test(linha);
            if (nua) nus.push(`${f.replace(process.cwd(), "")}:${i + 1}: ${linha.trim().slice(0, 100)}`);
          });
      }
    }
    expect(nus).toEqual([]);
    // E a regra apanha o que se viu no ar.
    expect(ETIQUETA_NUA.test("{PRECOS[chave]?.etiqueta}")).toBe(true);
    expect(ETIQUETA_NUA.test('<span className="x">{PRECO_MONOS.etiqueta}</span>')).toBe(true);
    expect(ESVAZIAMENTO_NU.test("price: etiquetaDoEsvaziamento(t.chave) })),")).toBe(true);
  });
});
