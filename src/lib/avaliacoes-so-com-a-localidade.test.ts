import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cidadePublica } from "./localidade-publica";

/*
 * AS AVALIAÇÕES DO PERFIL PÚBLICO SÓ DIZEM A TERRA — 27-10-2026.
 *
 * A «cidade» de cada avaliação vem do pedido, que guarda o que o cliente
 * escreveu. Na página pública passa pelo mesmo filtro do resto do perfil.
 */

const tirarComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("avaliações no perfil público", () => {
  it("o filtro devolve só a terra, nunca o código postal nem a morada", () => {
    for (const bruto of ["2840-123 Seixal", "Rua das Flores 12, 2840-123 Seixal", "Av. da República 5, Amora"]) {
      const saida = cidadePublica(bruto) ?? "";
      expect(saida).not.toMatch(/\d/);
      expect(saida).not.toMatch(/rua|av\./i);
    }
    expect(cidadePublica("2840-123 Seixal")).toBe("Seixal");
    expect(cidadePublica("2840-123")).toBeNull();
    expect(cidadePublica("Rua das Flores 12")).toBeNull();
  });

  it("a cidade de cada avaliação passa pelo filtro público", () => {
    const fonte = tirarComentarios(
      readFileSync(join(process.cwd(), "src/lib/perfil-publico-do-profissional.ts"), "utf8"),
    );
    const i = fonte.indexOf("avaliacoes: (aLinhas");
    expect(i).toBeGreaterThan(-1);
    const bloco = fonte.slice(i, fonte.indexOf("})),", i));
    expect(bloco).toMatch(/cidade:\s*cidadePublica\(/);
    expect(bloco).not.toMatch(/cidade:\s*\(a\.city/);
  });
});
