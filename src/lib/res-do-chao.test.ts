import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RES_DO_CHAO, eResDoChao } from "./res-do-chao";

/**
 * A CAIXA «RÉS-DO-CHÃO» NO FORMULÁRIO DO TRABALHO — 17-10-2026.
 *
 * *«Vamos colocar na opção andar a caixinha de rés-do-chão; quando essa caixa
 * for marcada não aparece a opção elevador, pois não precisa.»*
 */

describe("o que conta como rés-do-chão", () => {
  it("o que a caixa escreve, e o que se escreve à mão no mesmo campo", () => {
    for (const a of [RES_DO_CHAO, "R/C", "r/c", "R / C", "RC", "rés do chão", "Rés-do-Chão", "res do chao", "0", "R/C Esq."]) {
      expect(eResDoChao(a), a).toBe(true);
    }
  });

  it("um andar a sério, ou nada, não é", () => {
    for (const a of ["", "  ", "1", "2º", "3º Esq.", "cave", "10", "rua", null, undefined]) {
      expect(eResDoChao(a as string), String(a)).toBe(false);
    }
  });

  it("o que a caixa escreve é o que o preço já lê como andar 0", () => {
    // `floorNumber` em pricing-helper.ts: «rés-do-chão» → 0.
    const P = readFileSync(join(process.cwd(), "src/lib/pricing-helper.ts"), "utf8");
    expect(P).toContain(`if (!floor || floor === "${RES_DO_CHAO}") return 0;`);
  });
});

describe("o formulário", () => {
  const F = readFileSync(join(process.cwd(), "src/components/admin/RegistarPedido.tsx"), "utf8").replace(/\r\n/g, "\n");

  it("a caixa está nas duas pontas, e marcada limpa o elevador", () => {
    expect(F).toContain("checked={eResDoChao(f.floor)}");
    expect(F).toContain('if (e.target.checked) muda("hasElevator", "");');
    expect(F).toContain("checked={eResDoChao(f.andarDestino)}");
    expect(F).toContain('if (e.target.checked) muda("elevadorDestino", "");');
  });

  it("com rés-do-chão, a pergunta do elevador não aparece", () => {
    expect(F).toContain("{!eResDoChao(f.floor) && (");
    expect(F).toContain("{!eResDoChao(f.andarDestino) && (");
  });
});
