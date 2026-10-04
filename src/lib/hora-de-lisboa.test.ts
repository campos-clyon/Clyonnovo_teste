import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  campoEmLisboa,
  dataEHoraEmLisboa,
  deslocamentoDeLisboa,
  diaEmLisboa,
  doRelogioDeLisboa,
  hojeOuOntem,
  instanteDaBase,
  instanteEmLisboa,
  noRelogioDeLisboa,
  pecasEmLisboa,
  somarDiasAoDia,
} from "./hora-de-lisboa";

/**
 * O BUG QUE ISTO FECHA, escrito por quem o apanhou:
 *
 * *«Eu troco o horário para as 15h00 e salvo, mas ele não muda realmente.»*
 *
 * Mudava — para as 16h00. O campo do telemóvel envia `2026-09-18T15:00` sem
 * fuso nenhum, o servidor da Vercel corre em UTC e lê isso como 15:00 UTC, e
 * Lisboa em Setembro está uma hora à frente. O salto caiu exactamente em cima
 * do valor antigo, e por isso pareceu que nada tinha acontecido.
 *
 * Uma hora à frente de Março a Outubro e certo no Inverno — a pior espécie de
 * erro, porque desaparece quando alguém o vai procurar.
 */

/** A hora que um relógio em Lisboa mostraria neste instante. */
const emLisboa = (d: Date) =>
  new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

describe("o deslocamento de Lisboa sai da tabela de fusos, não de um palpite", () => {
  it("no Verão está uma hora à frente do UTC", () => {
    expect(deslocamentoDeLisboa(new Date("2026-07-15T12:00:00Z"))).toBe(3_600_000);
  });

  it("no Inverno está no UTC", () => {
    expect(deslocamentoDeLisboa(new Date("2026-01-15T12:00:00Z"))).toBe(0);
  });

  /*
   * Escrever «no Verão soma-se uma hora» à mão seria assinar um erro para o
   * último domingo de Outubro. Em 2026 a mudança é a 25 de Outubro, às 02:00
   * em Lisboa (01:00 UTC).
   */
  it("acerta nos dois lados da mudança da hora", () => {
    expect(deslocamentoDeLisboa(new Date("2026-10-25T00:59:00Z"))).toBe(3_600_000);
    expect(deslocamentoDeLisboa(new Date("2026-10-25T01:01:00Z"))).toBe(0);
  });
});

describe("«15:00» escrito em Lisboa é 15:00 em Lisboa", () => {
  /*
   * ⚠️ O TESTE DO BUG. Se isto voltar a dar 16:00, voltou o bug de 18-09-2026.
   */
  it("o caso relatado: 15:00 de 18-09-2026 continua a ser 15:00", () => {
    const d = instanteEmLisboa("2026-09-18T15:00")!;
    expect(emLisboa(d)).toBe("15:00");
    // E, por baixo, é mesmo 14:00 UTC — o Verão português está +1.
    expect(d.toISOString()).toBe("2026-09-18T14:00:00.000Z");
  });

  it("no Inverno, a hora escrita é a hora UTC", () => {
    const d = instanteEmLisboa("2026-01-18T15:00")!;
    expect(emLisboa(d)).toBe("15:00");
    expect(d.toISOString()).toBe("2026-01-18T15:00:00.000Z");
  });

  it("dá a volta ao ano inteiro sem nunca deslizar", () => {
    for (let mes = 1; mes <= 12; mes++) {
      const dia = `2026-${String(mes).padStart(2, "0")}-15T09:30`;
      const d = instanteEmLisboa(dia)!;
      expect(emLisboa(d), dia).toBe("09:30");
    }
  });

  it("aceita o espaço em vez do T, e os segundos", () => {
    expect(emLisboa(instanteEmLisboa("2026-09-18 15:00")!)).toBe("15:00");
    expect(emLisboa(instanteEmLisboa("2026-09-18T15:00:30")!)).toBe("15:00");
  });

  /*
   * Uma string que JÁ traz fuso é um instante e não se lhe toca. É o que o
   * ecrã passou a enviar — e o que impede esta função de somar uma hora a
   * quem já a tinha certa.
   */
  it("o que já traz fuso passa tal e qual", () => {
    expect(instanteEmLisboa("2026-09-18T14:00:00.000Z")!.toISOString()).toBe(
      "2026-09-18T14:00:00.000Z",
    );
    expect(instanteEmLisboa("2026-09-18T15:00:00+01:00")!.toISOString()).toBe(
      "2026-09-18T14:00:00.000Z",
    );
  });

  /*
   * O ecrã envia ISO e o servidor converte o que não o traz. As duas estradas
   * TÊM de chegar ao mesmo sítio — senão um telemóvel com a versão antiga em
   * cache marca a hora errada e ninguém dá por isso.
   */
  it("os dois caminhos — ecrã novo e ecrã antigo — dão o mesmo instante", () => {
    for (const quando of ["2026-07-01T08:00", "2026-12-01T08:00", "2026-03-29T05:00"]) {
      const doServidor = instanteEmLisboa(quando)!;
      // O que o ecrã faz agora: converte no navegador e envia com fuso.
      const doEcra = instanteEmLisboa(doServidor.toISOString())!;
      expect(doEcra.toISOString(), quando).toBe(doServidor.toISOString());
    }
  });

  /*
   * Uma data que não se percebe não pode virar «agora» nem «1970». Tem de ser
   * recusada por quem chama — é a diferença entre um erro no ecrã e um
   * trabalho marcado para o dia 1 de Janeiro de 1970.
   */
  it("o que não se percebe é recusado, não adivinhado", () => {
    for (const mau of ["", "   ", "amanhã de manhã", "18/09/2026 15:00", "2026-09-18"]) {
      expect(instanteEmLisboa(mau), JSON.stringify(mau)).toBeNull();
    }
  });
});

/*
 * AS PEÇAS PARA O NAVEGADOR — 01-10-2026.
 *
 * «Deve estar sempre no horário de Lisboa, independente de onde o admin
 * esteja.» Do Brasil, `getHours()` dava quatro horas a menos e o «hoje»
 * acabava às 4h de Lisboa. Estas são as peças que o substituem.
 */
describe("uma data que veio da base", () => {
  /*
   * A base grava em UTC, e o texto sai sem fuso. Lido com `new Date`, valia o
   * fuso de quem corria o código — uma hora a menos no servidor no Verão,
   * quatro no Brasil.
   */
  it("o texto sem fuso é UTC", () => {
    expect(instanteDaBase("2026-10-01 14:00:00")!.toISOString()).toBe("2026-10-01T14:00:00.000Z");
    expect(instanteDaBase("2026-10-01 14:00")!.toISOString()).toBe("2026-10-01T14:00:00.000Z");
  });

  it("com fuso, ou já instante, passa tal e qual", () => {
    expect(instanteDaBase("2026-10-01T14:00:00+01:00")!.toISOString()).toBe("2026-10-01T13:00:00.000Z");
    expect(instanteDaBase("2026-10-01T14:00:00.000Z")!.toISOString()).toBe("2026-10-01T14:00:00.000Z");
    const d = new Date("2026-10-01T14:00:00Z");
    expect(instanteDaBase(d)).toBe(d);
  });

  it("o que não se lê é null", () => {
    expect(instanteDaBase(null)).toBeNull();
    expect(instanteDaBase("")).toBeNull();
    expect(instanteDaBase("ontem")).toBeNull();
  });
});

describe("o relógio de Lisboa, peça a peça", () => {
  // 23:30 em UTC no Verão: já são 00:30 do dia seguinte em Lisboa.
  const TARDE = new Date("2026-09-28T23:30:00Z");

  it("as peças são as de Lisboa, e o dia muda à meia-noite de Lisboa", () => {
    expect(pecasEmLisboa(TARDE)).toEqual({
      ano: 2026,
      mes: 9,
      dia: 29,
      hora: 0,
      minuto: 30,
      segundo: 0,
      diaDaSemana: 2, // terça
    });
    expect(diaEmLisboa(TARDE)).toBe("2026-09-29");
  });

  it("o campo de data mostra a hora de Lisboa, e volta ao mesmo instante", () => {
    expect(campoEmLisboa("2026-09-28T13:32:00Z")).toBe("2026-09-28T14:32");
    expect(campoEmLisboa("2026-12-10T13:32:00Z")).toBe("2026-12-10T13:32");
    expect(instanteEmLisboa(campoEmLisboa(TARDE))!.toISOString()).toBe(TARDE.toISOString());
    expect(campoEmLisboa(null)).toBe("");
    expect(campoEmLisboa("não é data")).toBe("");
  });

  it("a data de uma lista é a de Lisboa, e vira o dia à meia-noite de Lisboa", () => {
    // A data do pedido na mesa das Negociações (04-10-2026).
    expect(dataEHoraEmLisboa(new Date("2026-10-03T07:12:00Z"))).toBe("03/10/2026 · 08:12");
    expect(dataEHoraEmLisboa(TARDE)).toBe("29/09/2026 · 00:30");
    expect(dataEHoraEmLisboa(new Date("2026-12-10T13:32:00Z"))).toBe("10/12/2026 · 13:32");
  });

  it("somar dias é no calendário: fim de mês, fim de ano, e o domingo de 25 horas", () => {
    expect(somarDiasAoDia("2026-09-30", 1)).toBe("2026-10-01");
    expect(somarDiasAoDia("2026-01-01", -1)).toBe("2025-12-31");
    expect(somarDiasAoDia("2026-10-25", 1)).toBe("2026-10-26");
  });

  it("hoje e ontem são dias de Lisboa", () => {
    const agora = new Date("2026-10-01T13:00:00Z");
    expect(hojeOuOntem(new Date("2026-09-30T23:30:00Z"), agora)).toBe("hoje");
    expect(hojeOuOntem(new Date("2026-09-30T22:30:00Z"), agora)).toBe("ontem");
    expect(hojeOuOntem(new Date("2026-09-29T12:00:00Z"), agora)).toBeNull();
  });

  it("noRelogioDeLisboa dá a hora de Lisboa no getHours(), e doRelogioDeLisboa desfaz", () => {
    const local = noRelogioDeLisboa(TARDE);
    expect([local.getDate(), local.getHours(), local.getMinutes()]).toEqual([29, 0, 30]);
    expect(doRelogioDeLisboa(local)!.toISOString()).toBe(TARDE.toISOString());
  });

  it("e dá o mesmo num computador em São Paulo", () => {
    /*
     * No processo dos testes o fuso pode ser o de Lisboa, e aí `getHours()`
     * já dava certo sem nada. Corre-se num Node à parte, com outro relógio.
     */
    const fonte = readFileSync(join(process.cwd(), "src/lib/hora-de-lisboa.ts"), "utf8");
    const js = ts.transpileModule(fonte, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const codigo = `
      const module = { exports: {} };
      const exports = module.exports;
      ${js}
      const h = module.exports;
      const local = h.noRelogioDeLisboa(new Date("2026-09-28T23:30:00Z"));
      const volta = h.doRelogioDeLisboa(local).toISOString();
      console.log([local.getDate(), local.getHours(), local.getMinutes(), volta].join(","));
    `;
    const r = spawnSync(process.execPath, ["-"], {
      input: codigo,
      encoding: "utf8",
      env: { ...process.env, TZ: "America/Sao_Paulo" },
    });
    expect(r.stderr).toBe("");
    expect(r.stdout.trim()).toBe("29,0,30,2026-09-28T23:30:00.000Z");
  });
});
