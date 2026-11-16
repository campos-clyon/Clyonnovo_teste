import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { horasPorExtenso, lerHorasDaFolha, oQueSePercebeuDasHoras } from "./horas-escritas-na-folha";
import { horasDe } from "./folha-final";
import { fimPelasHoras } from "./horas-do-trabalho";


/*
 * d49 (dono, 16-11-2026) — a «Folha final da mudança» e o «Preencher a folha»
 * da Mesa: as horas como a equipa as escreve, e a linha do material com o nome
 * a ocupar a linha.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");

describe("as horas escritas", () => {
  it("6,5 · 6.5 · 6:30 · 6h30 · 6 h 30 min dão 6,5 horas", () => {
    for (const t of ["6,5", "6.5", "6:30", "6h30", "6 h 30 min", "6h30min"]) expect(lerHorasDaFolha(t)).toBe(6.5);
    expect(lerHorasDaFolha("6h")).toBe(6);
    expect(lerHorasDaFolha("")).toBeNull();
    expect(Number.isNaN(lerHorasDaFolha("seis"))).toBe(true);
    expect(Number.isNaN(lerHorasDaFolha("6h75"))).toBe(true);
  });

  it("a folha final e o «Preencher a folha» lêem igual", () => {
    expect(horasDe("6h30")).toBe(6.5);
    expect(fimPelasHoras("09:00", "4h30")).toBe("13:30");
    expect(fimPelasHoras("09:00", "4:30")).toBe("13:30");
    expect(fimPelasHoras("09:00", "4,5")).toBe("13:30");
  });

  it("diz o que percebeu", () => {
    expect(horasPorExtenso(6.5)).toBe("6 h 30 min");
    expect(horasPorExtenso(6)).toBe("6 h");
    expect(horasPorExtenso(0.25)).toBe("15 min");
    expect(oQueSePercebeuDasHoras("6h30")).toEqual({ texto: "= 6 h 30 min", ok: true });
    expect(oQueSePercebeuDasHoras("xx")?.ok).toBe(false);
    expect(oQueSePercebeuDasHoras(" ")).toBeNull();
  });
});

describe("a linha do material", () => {
  it("a mensagem pede o nome do material pela linha", () => {
    expect(ler("src/lib/conta-da-mudanca.ts")).toContain("`Escreva o nome do material na linha ${n + 1}.`");

  });

  it("o nome com o exemplo e sem a largura do campo geral; o valor estreito com «€»", () => {
    const f = ler("src/components/admin/FolhaFinalDaMudanca.tsx");
    expect(f).toContain('placeholder="Material (ex.: cartão, plástico, filme)"');
    expect(f).toContain("className={campoDoNome}");
    expect(f).toContain("className={campoDoValor}");
    expect(f).not.toContain("${campo} mt-0 flex-1");
    expect(f).not.toContain("${campo} mt-0 w-24");
  });
});
