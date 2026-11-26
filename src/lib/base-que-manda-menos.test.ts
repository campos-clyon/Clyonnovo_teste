import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  bateAgora,
  BATIDAS_QUANDO_PARADO,
  INTERVALO_DO_CICLO,
  PARADO_AO_FIM_DE_MS,
} from "@/components/admin/useAutoRefresh";

/**
 * d133 (26-11-2026): a base do Railway mandava ~4,8 GB por dia para fora.
 * Três cortes, sem mudar o que ninguém vê.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const DB = ler("src/lib/db.ts");
const PAINEL = ler("src/components/admin/LegacyAdminClient.tsx");
const GALERIA = ler("src/lib/work-gallery.ts");

describe("a base comprime o que manda", () => {
  it("o pool do mysql2 liga com o protocolo comprimido", () => {
    expect(DB).toContain("export const BASE_COMPRIMIDA = true;");
    expect(DB).toContain("compress: BASE_COMPRIMIDA,");
  });
});

describe("as imagens da galeria não saem da base sem precisar", () => {
  it("o painel já não puxa a galeria inteira (11 MB) para contar imagens", () => {
    expect(PAINEL).not.toContain("carregarImageStats");
    expect(PAINEL).not.toContain("/api/media/gallery");
  });

  it("as páginas públicas lêem a galeria sem o base64, com a versão feita na base", () => {
    expect(DB).toContain("export async function getGalleryMediaItemsSemAImagem()");
    expect(DB).toContain("LOWER(HEX(CRC32(imageUrl)))");
    expect(DB).toContain("CASE WHEN imageUrl LIKE 'data:image/%' THEN NULL ELSE imageUrl END AS urlExterna");
    expect(GALERIA).toContain('const items = await itensPublicosComEndereco("showcase");');
    expect(GALERIA).toContain('const items = await itensPublicosComEndereco("hero");');
    expect(GALERIA).toContain("`/api/media/gallery/render/${l.id}?v=${l.versaoDaImagem}`");
  });
});

describe("ninguém a mexer, o pulso abranda", () => {
  const agora = 1_800_000_000_000;

  it("quem está a trabalhar continua nos 20 segundos", () => {
    expect(INTERVALO_DO_CICLO).toBe(20_000);
    for (let n = 1; n <= 20; n++) expect(bateAgora(agora, agora - 60_000, n)).toBe(true);
    expect(bateAgora(agora, agora - PARADO_AO_FIM_DE_MS, 3)).toBe(true);
  });

  it("parado há mais de 5 min, bate uma vez em cada nove (3 min)", () => {
    const parado = agora - PARADO_AO_FIM_DE_MS - 1;
    const batidas = Array.from({ length: 27 }, (_, i) => bateAgora(agora, parado, i + 1)).filter(Boolean).length;
    expect(BATIDAS_QUANDO_PARADO * INTERVALO_DO_CICLO).toBe(180_000);
    expect(batidas).toBe(3);
  });

  it("e ao primeiro movimento bate logo", () => {
    const CICLO = ler("src/components/admin/useAutoRefresh.ts");
    expect(CICLO).toContain("if (estavaParado && temporizador !== null && separadorVisivel()) bater();");
    expect(CICLO).toContain('["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "focus"]');
  });
});
