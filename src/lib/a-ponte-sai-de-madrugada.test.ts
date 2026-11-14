import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as saida from "../../ponte-whatsapp/saida-diaria.js";

/**
 * A PONTE SAI UMA VEZ POR DIA, ÀS 04h DE LISBOA — 14-11-2026 (d24).
 *
 * O Chromium engorda desde cada arranque e o Railway cobra a memória (pausou
 * a base e a ponte a 13-11 por limite de gasto). A ponte sai sozinha de
 * madrugada e o Railway levanta-a de novo. A hora é a de Lisboa, nunca a do
 * servidor: no Inverno 04h Lisboa = 04h UTC, no Verão = 03h UTC.
 */

const { deveSairAgora, horaDeLisboa, HORA_DA_SAIDA, IDADE_MINIMA_MS, CODIGO_DA_SAIDA_DIARIA } =
  saida as {
    deveSairAgora: (a: { agora: Date | number; arrancouEm: number; ocupada: boolean }) => boolean;
    horaDeLisboa: (d: Date) => { hora: number; minuto: number };
    HORA_DA_SAIDA: number;
    IDADE_MINIMA_MS: number;
    CODIGO_DA_SAIDA_DIARIA: number;
  };

const UM_DIA = 24 * 60 * 60_000;
const velha = (agora: Date) => agora.getTime() - UM_DIA;

describe("a hora da saída é a de Lisboa", () => {
  it("é às 04h", () => {
    expect(HORA_DA_SAIDA).toBe(4);
  });

  it("no Inverno, 04h de Lisboa são 04h UTC", () => {
    const agora = new Date("2026-11-14T04:10:00Z");
    expect(horaDeLisboa(agora)).toEqual({ hora: 4, minuto: 10 });
    expect(deveSairAgora({ agora, arrancouEm: velha(agora), ocupada: false })).toBe(true);
    // 03h UTC no Inverno são 03h de Lisboa: ainda não.
    const antes = new Date("2026-11-14T03:10:00Z");
    expect(deveSairAgora({ agora: antes, arrancouEm: velha(antes), ocupada: false })).toBe(false);
  });

  it("no Verão, 04h de Lisboa são 03h UTC", () => {
    const agora = new Date("2026-07-14T03:10:00Z");
    expect(horaDeLisboa(agora)).toEqual({ hora: 4, minuto: 10 });
    expect(deveSairAgora({ agora, arrancouEm: velha(agora), ocupada: false })).toBe(true);
    // 04h UTC no Verão já são 05h de Lisboa: passou.
    const depois = new Date("2026-07-14T04:10:00Z");
    expect(deveSairAgora({ agora: depois, arrancouEm: velha(depois), ocupada: false })).toBe(false);
  });

  it("fora da hora das 04h nunca sai", () => {
    for (const h of [0, 3, 5, 12, 23]) {
      const agora = new Date(`2026-11-14T${String(h).padStart(2, "0")}:30:00Z`);
      expect(deveSairAgora({ agora, arrancouEm: velha(agora), ocupada: false })).toBe(false);
    }
  });
});

describe("sai com ordem", () => {
  it("não sai se arrancou há menos de uma hora", () => {
    expect(IDADE_MINIMA_MS).toBe(60 * 60_000);
    const agora = new Date("2026-11-14T04:30:00Z");
    const ha30min = agora.getTime() - 30 * 60_000;
    expect(deveSairAgora({ agora, arrancouEm: ha30min, ocupada: false })).toBe(false);
  });

  it("não sai a meio de uma mensagem — adia", () => {
    const agora = new Date("2026-11-14T04:00:00Z");
    expect(deveSairAgora({ agora, arrancouEm: velha(agora), ocupada: true })).toBe(false);
  });

  it("sai com um código que o Railway levanta (On Failure: diferente de zero)", () => {
    expect(CODIGO_DA_SAIDA_DIARIA).not.toBe(0);
  });
});

describe("a ponte usa-a", () => {
  const PONTE = readFileSync(join(process.cwd(), "ponte-whatsapp/index.js"), "utf8").replace(/\r\n/g, "\n");
  const CODIGO = PONTE.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
  const DOCKER = readFileSync(join(process.cwd(), "ponte-whatsapp/Dockerfile"), "utf8");

  it("pergunta ao deveSairAgora, fecha o Chromium e sai com o código", () => {
    expect(CODIGO).toContain('from "./saida-diaria.js"');
    expect(CODIGO).toContain("deveSairAgora({");
    expect(CODIGO).toContain("client?.destroy()");
    expect(CODIGO).toContain("process.exit(CODIGO_DA_SAIDA_DIARIA)");
    // destroy, nunca logout: logout apagava a sessão e obrigava a emparelhar.
    expect(CODIGO).not.toMatch(/client\??\.logout\(/);
  });

  it("a ronda pára quando está a sair", () => {
    expect(CODIGO).toContain("if (!ligado || aSair) return;");
  });

  it("o Dockerfile copia o módulo para a imagem", () => {
    expect(DOCKER).toMatch(/^COPY index\.js saida-diaria\.js \.\/$/m);
  });
});
