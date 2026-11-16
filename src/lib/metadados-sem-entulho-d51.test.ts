import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REGIONS } from "./seo-data";
import { IMAGEM_DE_PARTILHA } from "./open-graph";

/*
 * d51 (16-11-2026): o entulho está fora da divulgação (d18). Nos metadados
 * gerais — o layout, a imagem de partilha e as três regiões — fica uma só vez
 * (a palavra-chave de Lisboa no layout). A página do próprio serviço fica.
 */
const RAIZ = join(__dirname, "..", "..");

describe("d51 — «entulho» nos metadados gerais", () => {
  it("uma só vez, e as regiões dentro dos 60 e dos 155", () => {
    const layout = readFileSync(join(RAIZ, "src/app/layout.tsx"), "utf8")
      .split(/\r?\n/)
      .filter((l) => !/^\s*(\/\/|\*)/.test(l)) // as linhas de comentário (começam por // ou *) ficam de fora
      .join("\n");
    const doLayout = layout.match(/entulho/gi)?.length ?? 0;
    const daPartilha = IMAGEM_DE_PARTILHA.alt.match(/entulho/gi)?.length ?? 0;
    const dasRegioes = REGIONS.flatMap((r) => [r.metaTitle, r.metaDescription, ...r.keywords]).join(" | ").match(/entulho/gi)?.length ?? 0;
    expect(doLayout + daPartilha + dasRegioes).toBe(1);
    expect(layout).toContain('"recolha de entulho lisboa"');
    for (const r of REGIONS) {
      expect(`${r.metaTitle} | CLYON`.length, r.slug).toBeLessThanOrEqual(60);
      expect([...r.metaDescription].length, r.slug).toBeLessThanOrEqual(155);
    }
  });
});
