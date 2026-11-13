import { pecasEmLisboa } from "./hora-de-lisboa";

/**
 * O HORÁRIO DE ATENDIMENTO, EM HORAS — d21 (I&D, 13-11-2026).
 *
 * É o que a CLYON promete em todo o lado (`ATENDIMENTO` em
 * `promessas-publicas.ts`: «de segunda a sábado, das 08:00 às 20:00») e o que a
 * Vitória diz quando passa uma conversa a uma pessoa
 * (`MENSAGEM_DE_PASSAR_A_UMA_PESSOA`: «de segunda a sábado, das 8h às 20h»). Um
 * teste confere que as três dizem o mesmo.
 *
 * Não é o horário dos avisos à equipa (08h–21h, `avisos-a-equipa.ts`): esse é
 * quando o telemóvel da equipa pode tocar; este é quando alguém responde a
 * quem escreve — e é o que se promete.
 *
 * Sempre a hora de Lisboa, seja qual for o fuso do servidor (a Vercel corre em
 * UTC e esta máquina em UTC+2). Puro.
 */

/** A hora a que se começa a responder (inclusive). */
export const ATENDIMENTO_ABRE_AS = 8;
/** A hora a que se deixa de responder (exclusive: às 20:00 já está fechado). */
export const ATENDIMENTO_FECHA_AS = 20;
/** Os dias com atendimento: 1 = segunda … 6 = sábado (0 = domingo, fechado). */
export const DIAS_COM_ATENDIMENTO: readonly number[] = [1, 2, 3, 4, 5, 6];

const HORA = 3_600_000;

/** Há alguém da equipa a responder agora? Hora de Lisboa. */
export function emHorarioDeAtendimento(agora: Date): boolean {
  const p = pecasEmLisboa(agora);
  return DIAS_COM_ATENDIMENTO.includes(p.diaDaSemana) && p.hora >= ATENDIMENTO_ABRE_AS && p.hora < ATENDIMENTO_FECHA_AS;
}

/** O início da hora em que `agora` está (as fronteiras do horário são horas certas). */
function inicioDaHora(agora: Date): Date {
  const p = pecasEmLisboa(agora);
  return new Date(agora.getTime() - (p.minuto * 60 + p.segundo) * 1000 - agora.getMilliseconds());
}

/**
 * O INÍCIO DESTA «NOITE» — o instante em que o atendimento fechou pela última
 * vez, quando `agora` está fora de horas (ou `null`, em horário). De sábado às
 * 20h a segunda às 8h é uma noite só. Anda-se de hora em hora no relógio
 * verdadeiro, e cada hora lê-se em Lisboa — a mudança da hora não engana.
 */
export function inicioDoFecho(agora: Date): Date | null {
  if (emHorarioDeAtendimento(agora)) return null;
  let inicio = inicioDaHora(agora);
  for (let i = 0; i < 24 * 4; i++) {
    const antes = new Date(inicio.getTime() - HORA);
    if (emHorarioDeAtendimento(antes)) return inicio;
    inicio = antes;
  }
  return inicio;
}

/** Quando volta a abrir — o primeiro instante em horário depois de `agora` (ou `agora`, em horário). */
export function quandoAbre(agora: Date): Date {
  if (emHorarioDeAtendimento(agora)) return agora;
  let t = inicioDaHora(agora);
  for (let i = 0; i < 24 * 4; i++) {
    t = new Date(t.getTime() + HORA);
    if (emHorarioDeAtendimento(t)) return t;
  }
  return t;
}

const DIAS_POR_EXTENSO = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/**
 * «amanhã, a partir das 8h» / «hoje, a partir das 8h» / «na segunda-feira, a
 * partir das 8h» — quando se responde a quem escreve agora, fora de horas.
 */
export function quandoSeResponde(agora: Date): string {
  const abre = quandoAbre(agora);
  const a = pecasEmLisboa(agora);
  const b = pecasEmLisboa(abre);
  const hora = `a partir das ${b.hora}h`;
  const mesmoDia = a.ano === b.ano && a.mes === b.mes && a.dia === b.dia;
  if (mesmoDia) return `hoje, ${hora}`;
  const amanha = pecasEmLisboa(new Date(agora.getTime() + 24 * HORA));
  if (amanha.ano === b.ano && amanha.mes === b.mes && amanha.dia === b.dia) return `amanhã, ${hora}`;
  const dia = DIAS_POR_EXTENSO[b.diaDaSemana];
  return `${dia === "sábado" || dia === "domingo" ? "no" : "na"} ${dia}, ${hora}`;
}
