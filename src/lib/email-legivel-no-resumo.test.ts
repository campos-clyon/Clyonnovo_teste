import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { legivelNoResumo } from "./email-legivel-no-resumo";

/**
 * O resumo do Gmail juntava as palavras: «CLYONValor de partida… taxa
 * CLYONA morada exacta». Um espaço antes de cada fecho de bloco separa-as, e
 * tem de estar em TODOS os emails, porque estão todos escritos da mesma
 * maneira.
 */

describe("o resumo do email lê-se", () => {
  it("põe um espaço antes do fecho de cada bloco, e só aí", () => {
    const html = "<div>CLYON</div><td>Valor</td><p>A morada</p><strong>x</strong>,";
    expect(legivelNoResumo(html)).toBe("<div>CLYON </div><td>Valor </td><p>A morada </p><strong>x</strong>,");
  });

  it("todos os emails passam pela cura antes de sair", () => {
    const pasta = join(process.cwd(), "src/lib");
    const emails = readdirSync(pasta).filter(
      (f) => f.startsWith("email-") && f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "email-legivel-no-resumo.ts",
    );
    expect(emails.length).toBeGreaterThan(8);
    for (const f of emails) {
      const corpo = readFileSync(join(pasta, f), "utf8");
      if (!corpo.includes("emails.send(")) continue;
      expect(corpo, `${f} envia HTML sem legivelNoResumo`).toContain("legivelNoResumo(");
    }
  });

  it("o email do profissional leva uma primeira frase e uma versão só texto", () => {
    const corpo = readFileSync(join(process.cwd(), "src/lib/email-profissional.ts"), "utf8");
    expect(corpo).toContain("primeiraFrase(p)");
    expect(corpo).toContain("text: montarTexto(p)");
    expect(corpo).not.toContain("Valor de partida");
  });
});
