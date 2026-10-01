import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SCRIPT_DO_FUSO_DE_LISBOA } from "./relogio-de-lisboa";

/**
 * O SITE INTEIRO À HORA DE LISBOA — 01-10-2026.
 *
 * *«Deve estar sempre no horário de Lisboa, independente de onde o admin
 * esteja.»* O script vai para o `<head>` e muda o que «sem fuso» quer dizer no
 * browser. Para provar que funciona LONGE de Lisboa, corre-se num Node à
 * parte com o relógio de São Paulo — no processo dos testes, a máquina podia
 * estar em Lisboa e o teste passava sem provar nada.
 */

/** Corre `codigo` num Node com o fuso dado, e devolve o que ele imprimir. */
function noFuso(fuso: string, codigo: string): string {
  const r = spawnSync(process.execPath, ["-"], {
    input: codigo,
    encoding: "utf8",
    env: { ...process.env, TZ: fuso },
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

/* 13:32 em UTC no Verão: 14:32 em Lisboa, 10:32 em São Paulo. */
const INSTANTE = "2026-09-28T13:32:00Z";
const LER = `
  const d = new Date("${INSTANTE}");
  console.log(JSON.stringify({
    hora: d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
    tudo: d.toLocaleString("pt-PT"),
    dia: d.toLocaleDateString("pt-PT"),
    intl: new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" }).format(d),
    fuso: new Intl.DateTimeFormat().resolvedOptions().timeZone,
    explicito: d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }),
    instancia: new Intl.DateTimeFormat() instanceof Intl.DateTimeFormat,
    semNew: Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" }).format(d),
  }));
`;

describe("o browser escreve as horas de Lisboa, esteja onde estiver", () => {
  it("sem o script, em São Paulo, saía a hora de São Paulo — é o erro", () => {
    const sem = JSON.parse(noFuso("America/Sao_Paulo", LER));
    expect(sem.hora).toBe("10:32");
  });

  it("com o script, em São Paulo, sai a hora de Lisboa — em todas as formas", () => {
    const com = JSON.parse(noFuso("America/Sao_Paulo", SCRIPT_DO_FUSO_DE_LISBOA + LER));
    expect(com.hora).toBe("14:32");
    expect(com.intl).toBe("14:32");
    expect(com.semNew).toBe("14:32");
    expect(com.tudo).toContain("14:32");
    expect(com.dia).toBe("28/09/2026");
    expect(com.fuso).toBe("Europe/Lisbon");
    expect(com.instancia).toBe(true);
  });

  it("quem pede outro fuso por escrito continua a tê-lo", () => {
    const com = JSON.parse(noFuso("America/Sao_Paulo", SCRIPT_DO_FUSO_DE_LISBOA + LER));
    expect(com.explicito).toBe("13:32");
  });

  it("correr duas vezes não muda nada", () => {
    const duas = JSON.parse(
      noFuso("Asia/Tokyo", SCRIPT_DO_FUSO_DE_LISBOA + SCRIPT_DO_FUSO_DE_LISBOA + LER),
    );
    expect(duas.hora).toBe("14:32");
  });
});

describe("e está no sítio onde corre primeiro", () => {
  it("é a primeira coisa do <head> do layout de todas as páginas", () => {
    const LAYOUT = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    // A linha do elemento, e não um comentário que fale do <head>.
    const head = LAYOUT.search(/^[ \t]*<head>[ \t]*\r?$/m);
    const script = LAYOUT.indexOf("<script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_FUSO_DE_LISBOA }}");
    expect(head).toBeGreaterThan(-1);
    expect(script).toBeGreaterThan(head);
    // Nada que se desenhe vem antes dele dentro do <head>.
    expect(LAYOUT.slice(head, script)).not.toMatch(/<(meta|link|script)\b/);
  });
});
