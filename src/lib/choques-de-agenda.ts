import { temHoraMarcada } from "./agenda-dos-trabalhos";
import { DURACAO_PADRAO_MIN } from "./agenda-em-grelha";

/**
 * O PROFISSIONAL JÁ TEM UM TRABALHO A ESSA HORA — 21-10-2026.
 *
 * *«Coloque os nomes em vermelho dos profissionais na hora da gente escolher —
 * somente os que já têm um agendamento para aquela data e aquele horário,
 * para a gente não agendar dois trabalhos na mesma data e horário para aquele
 * profissional.»* — o dono.
 *
 * Um choque é outro trabalho DELE, já contratado e não cancelado, cujo
 * bloco na agenda se sobrepõe ao deste: o início de cada um e a duração da
 * Agenda (a que se arrastou, ou as duas horas de sempre — `DURACAO_PADRAO_MIN`).
 * Só com hora marcada dos dois lados: «só o dia» (00:00 em Lisboa) não diz a
 * que horas, e a pergunta dele é «aquela data E aquele horário».
 */
export type Marcacao = {
  pedidoId: number;
  providerId: number;
  inicio: Date;
  duracaoMin: number | null;
};

export type Choque = { pedidoId: number; inicio: string };

const MINUTO = 60_000;

function fimDe(inicio: Date, duracaoMin: number | null | undefined): number {
  return inicio.getTime() + (duracaoMin && duracaoMin > 0 ? duracaoMin : DURACAO_PADRAO_MIN) * MINUTO;
}

/** Os trabalhos deste profissional que chocam com este — do mais cedo para o mais tarde. */
export function choquesDoProfissional(
  alvo: { pedidoId: number; inicio: Date | null; duracaoMin?: number | null },
  providerId: number,
  marcacoes: ReadonlyArray<Marcacao>,
): Choque[] {
  const inicio = alvo.inicio;
  if (!inicio || Number.isNaN(inicio.getTime()) || !temHoraMarcada(inicio)) return [];
  const de = inicio.getTime();
  const ate = fimDe(inicio, alvo.duracaoMin);
  return marcacoes
    .filter(
      (m) =>
        m.providerId === providerId &&
        m.pedidoId !== alvo.pedidoId &&
        !Number.isNaN(m.inicio.getTime()) &&
        temHoraMarcada(m.inicio) &&
        m.inicio.getTime() < ate &&
        fimDe(m.inicio, m.duracaoMin) > de,
    )
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
    .map((m) => ({ pedidoId: m.pedidoId, inicio: m.inicio.toISOString() }));
}

const HORA_EM_LISBOA = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  hour: "2-digit",
  minute: "2-digit",
});

/** «já tem o #462 às 10:00» — o que se escreve ao lado do nome. */
export function textoDosChoques(choques: ReadonlyArray<Choque>): string {
  return (
    "já tem " +
    choques.map((c) => `o #${c.pedidoId} às ${HORA_EM_LISBOA.format(new Date(c.inicio))}`).join(" e ")
  );
}
