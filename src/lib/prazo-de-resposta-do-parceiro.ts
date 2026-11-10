import { diaEmLisboa, instanteEmLisboa, pecasEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";

/**
 * O PRAZO DE RESPOSTA DE UM PARCEIRO ESCOLHIDO PELO CLIENTE — 10-11-2026.
 *
 * Numa mudança com a lista de parceiros, o pedido vai logo aos escolhidos, e
 * cada um tem 3 horas para responder — contadas só entre as 8h e as 21h de
 * Lisboa (um pedido das 20h00 acaba às 10h00 do dia seguinte). O prazo grava-se
 * na negociação e vê-se na Mesa. O que acontece quando passa fica para a fase
 * seguinte.
 *
 * Pura: o relógio é o de Lisboa (hora-de-lisboa.ts), seja qual for o fuso de
 * quem corre isto.
 */

export const HORAS_PARA_RESPONDER = 3;
export const JANELA_DE_RESPOSTA = Object.freeze({ abre: 8, fecha: 21 });

const dois = (n: number) => String(n).padStart(2, "0");
const naHora = (dia: string, hora: number) => instanteEmLisboa(`${dia}T${dois(hora)}:00`) as Date;

export function prazoDeResposta(
  desde: Date,
  horas: number = HORAS_PARA_RESPONDER,
  janela: { abre: number; fecha: number } = JANELA_DE_RESPOSTA,
): Date {
  let falta = Math.round(horas * 60 * 60_000);
  let cursor = new Date(desde.getTime());
  // Uma semana chega de sobra para 3 horas; o limite só impede um ciclo sem fim.
  for (let i = 0; i < 14; i++) {
    const dia = diaEmLisboa(cursor);
    const hora = pecasEmLisboa(cursor).hora;
    if (hora < janela.abre) {
      cursor = naHora(dia, janela.abre);
      continue;
    }
    const fecho = naHora(dia, janela.fecha);
    if (hora >= janela.fecha || cursor >= fecho) {
      cursor = naHora(somarDiasAoDia(dia, 1), janela.abre);
      continue;
    }
    const cabe = fecho.getTime() - cursor.getTime();
    if (falta <= cabe) return new Date(cursor.getTime() + falta);
    falta -= cabe;
    cursor = naHora(somarDiasAoDia(dia, 1), janela.abre);
  }
  return cursor;
}
