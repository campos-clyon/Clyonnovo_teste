import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { instanteEmLisboa } from "./hora-de-lisboa";
import { fichaDaPonte } from "./ponte-viva";

/**
 * ⚠️ «A PONTE NÃO VEM HÁ 1 H» — COM A PONTE VIVA.
 *
 * 29-09-2026. O painel mostrou o alarme vermelho a noite toda. Os registos do
 * Railway mostravam a ponte ligada, a receber mensagens e a carimbar de cinco
 * em cinco segundos. Mexeu-se no Railway, no Serverless, nas Watch Paths — e o
 * alarme continuou, sempre com a mesma hora certinha.
 *
 * A avaria era o relógio do site:
 *   · o carimbo é escrito pelo MySQL com `NOW()`, que no Railway é UTC;
 *   · o `mysql2` lê um DATETIME no fuso DO PROCESSO;
 *   · e o processo do site corre em `Europe/Lisbon` (`instrumentation.ts`).
 *
 * «20:56» escrito em UTC era lido como «20:56 de Lisboa» — uma hora no passado,
 * no Verão. O alarme estava SEMPRE aceso, e ensinou toda a gente a
 * desconfiar da ponte em vez de desconfiar dele.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("o erro, com os números desta noite", () => {
  it("um DATETIME escrito em UTC e lido como Lisboa fica uma hora no passado, no Verão", () => {
    // O que o MySQL escreveu às 20:56:20 UTC, lido como se fosse de Lisboa:
    const lido = instanteEmLisboa("2026-09-29T20:56:20")!;
    const verdadeiro = new Date("2026-09-29T20:56:20Z");
    expect((verdadeiro.getTime() - lido.getTime()) / 1000).toBe(3600);
  });

  it("e o painel dizia exactamente o que se viu", () => {
    const lido = instanteEmLisboa("2026-09-29T20:56:20")!;
    const agora = new Date("2026-09-29T20:56:25Z"); // cinco segundos depois do carimbo
    expect(fichaDaPonte(lido, agora).titulo).toBe("A ponte não vem há 1 h");
  });

  it("no Inverno o erro some — e voltava na mudança da hora", () => {
    const lido = instanteEmLisboa("2026-12-10T20:56:20")!;
    expect(lido.toISOString()).toBe("2026-12-10T20:56:20.000Z");
  });

  it("a causa continua lá: o processo do site corre em Lisboa", () => {
    // Não se lhe mexe aqui — é uma decisão com alcance no site inteiro. Fica
    // escrito para ninguém voltar a ler um DATETIME do NOW() como se fosse
    // hora local sem pensar nisto.
    expect(ler("src/instrumentation.ts")).toContain('process.env.TZ = "Europe/Lisbon"');
  });
});

describe("a idade conta-se na base, com o relógio da base dos dois lados", () => {
  const DB = semComentarios(ler("src/lib/db.ts"));
  const i = DB.indexOf("export async function quandoAPonteVeio");
  const corpo = DB.slice(i, DB.indexOf("export async function", i + 10));

  it("TIMESTAMPDIFF com NOW(), e não a hora lida para um Date", () => {
    expect(i).toBeGreaterThan(-1);
    expect(corpo).toContain("TIMESTAMPDIFF(SECOND, ponteVistaEm, NOW())");
    expect(corpo).not.toContain("SELECT ponteVistaEm FROM");
  });

  it("devolve um instante verdadeiro — o painel continua a contar com o relógio de quem olha", () => {
    expect(corpo).toContain("new Date(Date.now() - Math.max(0, haSegundos) * 1000)");
    expect(ler("src/app/api/admin/whatsapp/route.ts")).toContain(
      "ponteVistaEm: ponteVistaEm ? ponteVistaEm.toISOString() : null",
    );
  });

  it("o carimbo continua a ser escrito pela base", () => {
    expect(DB).toContain("ON DUPLICATE KEY UPDATE ponteVistaEm = NOW()");
  });
});
