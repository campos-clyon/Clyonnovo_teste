import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A PONTE DIZ QUE VERSÃO ESTÁ A CORRER — 23-10-2026.
 *
 * Durante a avaria do Railway de 21-10-2026, os dois commits da ponte (as
 * respostas à mão escritas no fio) não chegaram a ser construídos. Passou-se
 * um dia a pensar que estavam no ar: nada nos registos dizia que a ponte
 * activa era a de antes. Agora diz, na primeira linha.
 */

const PONTE = readFileSync(join(process.cwd(), "ponte-whatsapp/index.js"), "utf8");

describe("a primeira linha dos registos", () => {
  it("diz o commit que o Railway construiu", () => {
    expect(PONTE).toContain('(process.env.RAILWAY_GIT_COMMIT_SHA ?? "sem commit").slice(0, 8)');
  });

  it("e a versão do whatsapp-web.js que veio no npm install", () => {
    expect(PONTE).toContain('path.join(process.cwd(), "node_modules", "whatsapp-web.js", "package.json")');
    expect(PONTE).toContain('"· whatsapp-web.js",\n  versaoDaBiblioteca(),'.replace(/\n/g, PONTE.includes("\r\n") ? "\r\n" : "\n"));
  });

  it("antes de tudo o resto — logo a seguir a haver onde escrever", () => {
    const log = PONTE.indexOf("const log = (...a) =>");
    const versao = PONTE.indexOf("function versaoDaBiblioteca()");
    const porta = PONTE.indexOf("const PORTA = Number(process.env.PORT");
    expect(log).toBeGreaterThan(-1);
    expect(versao).toBeGreaterThan(log);
    expect(versao).toBeLessThan(porta);
  });
});
