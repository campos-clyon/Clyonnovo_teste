import { describe, it, expect } from "vitest";
import { deslocamentoDeLisboa, instanteEmLisboa } from "./hora-de-lisboa";

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
