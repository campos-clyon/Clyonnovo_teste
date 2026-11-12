import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lerMudancaDeTaxa } from "./ultima-mudanca-de-taxa";
import { fraseDaMudancaDeTaxa } from "@/components/admin/frase-da-mudanca-de-taxa";

/*
 * d2, 12-11-2026 — o ecrã das Taxas mostra a última mudança (quem, quando, de
 * quanto para quanto), lida do registo permanente. Só leitura.
 */

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf8");

describe("a última mudança de taxa, lida do registo", () => {
  const linha = {
    // Texto da base, em UTC: 12:23 em Lisboa (Inverno, UTC+0).
    ocorridoEm: "2026-11-12 12:23:00",
    autorNome: "Pessoa de Teste",
    detalheJson: JSON.stringify({
      antes: { cliente: 0, profissional: 0.2 },
      depois: { cliente: 0, profissional: 0.25 },
      perfil: "administrador",
    }),
  };

  it("diz quem, com o perfil, quando (em Lisboa) e de quanto para quanto", () => {
    const m = lerMudancaDeTaxa(linha);
    expect(m).not.toBeNull();
    expect(m!.quem).toBe("Pessoa de Teste");
    expect(m!.perfil).toBe("administrador");
    const frase = fraseDaMudancaDeTaxa(m!);
    expect(frase).toContain("12/11/2026 · 12:23");
    expect(frase).toContain("Pessoa de Teste (administrador)");
    expect(frase).toContain("20 % → 25 %");
  });

  it("uma linha antiga sem perfil não inventa um", () => {
    const m = lerMudancaDeTaxa({
      ...linha,
      detalheJson: JSON.stringify({ antes: { cliente: 0, profissional: 0.2 }, depois: { cliente: 0, profissional: 0.25 } }),
    });
    expect(m!.perfil).toBeNull();
    expect(fraseDaMudancaDeTaxa(m!)).toContain("por Pessoa de Teste: ");
  });

  it("sem linha, ou com o detalhe estragado, devolve null", () => {
    expect(lerMudancaDeTaxa(null)).toBeNull();
    expect(lerMudancaDeTaxa({ ...linha, detalheJson: "{" })).toBeNull();
    expect(lerMudancaDeTaxa({ ...linha, detalheJson: "{}" })).toBeNull();
  });

  it("a rota lê-a do registo e o ecrã mostra-a", () => {
    const db = ler("src/lib/db.ts");
    expect(db).toMatch(/registoParaOBackoffice\(\{\s*acontecimento:\s*"taxas_alteradas",\s*limite:\s*1/);
    expect(db).toMatch(/detalhe:\s*\{\s*antes,\s*depois:\s*\{\s*cliente,\s*profissional\s*\},\s*perfil\s*\}/);
    const rota = ler("src/app/api/admin/taxas/route.ts");
    expect(rota).toContain("ultimaMudancaDasTaxas()");
    expect(rota).toMatch(/ultimaMudanca,/);
    const ecra = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(ecra).toContain("setUltimaMudancaDeTaxa(d.ultimaMudanca ?? null)");
    expect(ecra).toContain("fraseDaMudancaDeTaxa(ultimaMudancaDeTaxa)");
  });
});
