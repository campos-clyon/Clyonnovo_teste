import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PRECOS, SEM_IVA_NA_FRASE, maisIva } from "./precos-publicos";
import { CITIES, NA_PROPOSTA_COM_IVA, SERVICES } from "./seo-data";
import { tituloDaCidade } from "./titulos-seo";
import { PRECO_DA_MUDANCA_CURTO, PRECO_DA_MUDANCA_POR_EXTENSO } from "./tabela-das-mudancas";

/*
 * «DEIXE O PREÇO SEM IVA MAS COM A INFORMAÇÃO» — o dono, 14-10-2026.
 *
 * Os preços de referência ficam sem IVA (decisão de 03-10-2026), mas nenhum
 * sai sozinho: ao lado vai «+ IVA», ou «sem IVA (na proposta, o preço já vem
 * com IVA incluído)». Os títulos de 50 páginas de cidade e várias descrições
 * mostravam o número nu.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

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

  it("as frases de preço das mudanças já trazem o IVA dentro", () => {
    // Por isso o teste de cima as deixa passar pelo nome.
    expect(PRECO_DA_MUDANCA_CURTO).toContain("IVA");
    expect(PRECO_DA_MUDANCA_POR_EXTENSO).toContain("IVA");
  });

  it("e a lista de referências das páginas de cidade diz que é sem IVA", () => {
    // O último item usa a etiqueta; a nota completa vai por baixo da lista.
    expect(ler("src/app/[...slug]/page.tsx")).toContain("Referências úteis {paraTerra(city.name)}, sem IVA");
  });

  it("nos cartões e nas frases que mostram o número em letra grande", () => {
    expect(ler("src/app/page.tsx")).toContain("{maisIva(price)}");
    for (const f of ["src/app/precos/page.tsx", "src/app/servicos/page.tsx"]) {
      expect(ler(f), f).toContain("return preco ? maisIva(preco) : \"orçamento personalizado\";");
    }
    expect(ler("src/app/recolha-de-moveis/page.tsx")).toContain("{maisIva(PRECO_MOVEIS.etiqueta)}</p>");
    for (const f of ["recolha-de-camas", "recolha-de-armarios", "recolha-de-eletrodomesticos", "recolha-de-sofas"]) {
      expect(ler(`src/app/${f}/page.tsx`), f).toMatch(/custa, tipicamente, \{PRECO_MOVEIS\.etiqueta\}, \{SEM_IVA_NA_FRASE\}\./);
    }
  });
});
