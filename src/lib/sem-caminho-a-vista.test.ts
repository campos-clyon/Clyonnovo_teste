import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * SEM O CAMINHO «INÍCIO / …» À VISTA — 18-10-2026.
 *
 * *«Remova esses títulos das páginas»* — o dono, com a captura de «Início /
 * Contactos» por cima do título de /contactos. Estava em sete sítios. Sai
 * do ecrã e fica no JSON-LD (`BreadcrumbList`), que é onde o Google o lê.
 */
const RAIZ = process.cwd();
const ficheiros: string[] = [];
const andar = (d: string) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) {
      if (n === "admin") continue;
      andar(p);
    } else if (n.endsWith(".tsx")) ficheiros.push(p);
  }
};
andar(join(RAIZ, "src/app"));
andar(join(RAIZ, "src/components/precos"));
andar(join(RAIZ, "src/components/mudancas"));

describe("o caminho não volta ao ecrã", () => {
  it("nenhuma página pública desenha um <nav> com «Início» a apontar para /", () => {
    expect(ficheiros.length).toBeGreaterThan(50);
    const maus: string[] = [];
    for (const f of ficheiros) {
      const t = readFileSync(f, "utf8");
      let i = t.indexOf("<nav");
      while (i !== -1) {
        const bloco = t.slice(i, t.indexOf("</nav>", i));
        if (bloco.includes('href="/"') && bloco.includes("Início")) maus.push(relative(RAIZ, f));
        i = t.indexOf("<nav", i + 4);
      }
    }
    expect(maus).toEqual([]);
  });

  it("e as páginas que o tinham continuam a dá-lo ao Google", () => {
    for (const f of [
      "src/app/blog/[slug]/page.tsx",
      "src/app/contactos/page.tsx",
      "src/app/mudancas/[cidade]/page.tsx",
      "src/components/mudancas/PaginaDeTipoDeMudanca.tsx",
      "src/components/precos/PaginaDePreco.tsx",
      "src/app/servicos/[slug]/page.tsx",
      "src/app/profissionais/[slug]/page.tsx",
    ]) {
      expect(readFileSync(join(RAIZ, f), "utf8"), f).toMatch(/BreadcrumbList|caminhoDaPagina|breadcrumbSchema/);
    }
  });
});
