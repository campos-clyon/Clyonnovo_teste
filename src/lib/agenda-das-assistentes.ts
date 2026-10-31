/**
 * A AGENDA PESSOAL DA ASSISTENTE — 31-10-2026 (ordem do CEO e do dono).
 *
 * Na conta dela, «A minha agenda»: as ausências que ela própria marca — um
 * dia inteiro (folga), uma parte do dia (a partir de HH:MM, ou de HH:MM a
 * HH:MM) ou vários dias seguidos (de dd/mm a dd/mm), com uma nota se quiser.
 * Ela vê e mexe só nas dela; o administrador vê as de todas num calendário,
 * ao lado da presença no backoffice («avisou» ou «sem aviso»).
 *
 * Os dias e as horas são os de LISBOA, guardados como se escrevem — `AAAA-MM-DD`
 * e `HH:MM` —, sem passar por instantes: uma folga a 2 de Novembro é a 2 de
 * Novembro em qualquer computador. Só se convertem em instantes para comparar
 * com a presença (`intervaloDaMarcacaoNoDia`, em presenca-do-backoffice.ts).
 *
 * Este ficheiro é PURO: sem base de dados, para se testar com um relógio à mão.
 */

import { somarDiasAoDia } from "./hora-de-lisboa";

export const TIPOS_DE_AUSENCIA = [
  { id: "dia", rotulo: "Dia inteiro (folga)" },
  { id: "parte", rotulo: "Parte do dia" },
  { id: "dias", rotulo: "Vários dias seguidos" },
] as const;

export type TipoDeAusencia = (typeof TIPOS_DE_AUSENCIA)[number]["id"];

/** A nota é opcional e curta: diz o porquê, não conta a vida. */
export const NOTA_MAXIMA = 300;

/** Vários dias seguidos, até dois meses de uma vez. */
export const DIAS_MAXIMOS_SEGUIDOS = 62;

/** Até que distância de hoje se pode marcar: um pouco mais de um ano para trás, dois para a frente. */
export const DIAS_PARA_TRAS = 400;
export const DIAS_PARA_A_FRENTE = 730;

/** O que a assistente escreve — sem id nem datas de registo. */
export type MarcacaoNova = {
  tipo: TipoDeAusencia;
  /** `AAAA-MM-DD`, o dia em Lisboa. */
  deDia: string;
  /** Igual a `deDia`, salvo em «vários dias seguidos». */
  ateDia: string;
  /** `HH:MM` — só na parte do dia. */
  deHora: string | null;
  /** `HH:MM`, ou `null` para «a partir de» (até ao fim do dia). */
  ateHora: string | null;
  nota: string | null;
};

/** Uma marcação gravada, como as rotas a devolvem (datas de registo em ISO). */
export type Marcacao = MarcacaoNova & {
  id: number;
  colaboradorId: number;
  criadaEm: string;
  actualizadaEm: string;
};

export function eTipoDeAusencia(v: unknown): v is TipoDeAusencia {
  return typeof v === "string" && TIPOS_DE_AUSENCIA.some((t) => t.id === v);
}

/** `AAAA-MM-DD` que existe no calendário (nada de 31 de Abril). */
export function diaValido(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  return somarDiasAoDia(v, 0) === v;
}

/** `HH:MM`, de 00:00 a 23:59. */
export function horaValida(v: unknown): v is string {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** Quantos dias vão de `de` a `ate` (0 se forem o mesmo). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

function notaLimpa(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // Uma linha só, sem caracteres de controlo.
  const limpa = Array.from(v.replace(/\s+/g, " "))
    .filter((ch) => ch >= " " && ch !== "\u007F")
    .join("")
    .trim();
  return limpa ? limpa.slice(0, NOTA_MAXIMA) : null;
}

/**
 * O que veio do formulário, conferido. `hoje` é o dia de Lisboa de quem grava
 * (`diaEmLisboa(new Date())` no servidor).
 */
export function lerMarcacao(
  corpo: unknown,
  hoje: string,
): { ok: true; marcacao: MarcacaoNova } | { ok: false; erro: string } {
  const c = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  if (!eTipoDeAusencia(c.tipo)) return { ok: false, erro: "Escolha o tipo: dia inteiro, parte do dia ou vários dias." };
  if (!diaValido(c.deDia)) return { ok: false, erro: "Escolha o dia." };

  const deDia = c.deDia;
  if (diasEntre(hoje, deDia) < -DIAS_PARA_TRAS) return { ok: false, erro: "Esse dia já vai muito longe." };
  if (diasEntre(hoje, deDia) > DIAS_PARA_A_FRENTE) return { ok: false, erro: "Esse dia ainda vem muito longe." };
  const nota = notaLimpa(c.nota);

  if (c.tipo === "dia") {
    return { ok: true, marcacao: { tipo: "dia", deDia, ateDia: deDia, deHora: null, ateHora: null, nota } };
  }

  if (c.tipo === "parte") {
    if (!horaValida(c.deHora)) return { ok: false, erro: "Escreva a hora a partir da qual não está (HH:MM)." };
    const ateHora = c.ateHora == null || c.ateHora === "" ? null : c.ateHora;
    if (ateHora !== null && !horaValida(ateHora)) return { ok: false, erro: "A hora do fim não se percebe (HH:MM)." };
    if (ateHora !== null && ateHora <= c.deHora) return { ok: false, erro: "A hora do fim tem de ser depois da do início." };
    return { ok: true, marcacao: { tipo: "parte", deDia, ateDia: deDia, deHora: c.deHora, ateHora, nota } };
  }

  if (!diaValido(c.ateDia)) return { ok: false, erro: "Escolha o último dia." };
  const ateDia = c.ateDia;
  const dias = diasEntre(deDia, ateDia);
  if (dias < 0) return { ok: false, erro: "O último dia tem de ser depois do primeiro." };
  if (dias === 0) return { ok: false, erro: "Para um dia só, escolha «Dia inteiro»." };
  if (dias + 1 > DIAS_MAXIMOS_SEGUIDOS) {
    return { ok: false, erro: `No máximo ${DIAS_MAXIMOS_SEGUIDOS} dias de uma vez.` };
  }
  return { ok: true, marcacao: { tipo: "dias", deDia, ateDia, deHora: null, ateHora: null, nota } };
}

/** `31/10` */
export function diaCurto(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

/** Os dias que a marcação cobre, por ordem. */
export function diasDaMarcacao(m: Pick<MarcacaoNova, "deDia" | "ateDia">): string[] {
  const n = Math.max(0, Math.min(DIAS_MAXIMOS_SEGUIDOS, diasEntre(m.deDia, m.ateDia)));
  return Array.from({ length: n + 1 }, (_, i) => somarDiasAoDia(m.deDia, i));
}

/** A marcação numa linha: «Folga a 31/10», «31/10 a partir das 14:00», «De 02/11 a 05/11». */
export function descricaoDaMarcacao(m: MarcacaoNova): string {
  if (m.tipo === "dia") return `Folga a ${diaCurto(m.deDia)}`;
  if (m.tipo === "parte") {
    return m.ateHora
      ? `${diaCurto(m.deDia)} das ${m.deHora} às ${m.ateHora}`
      : `${diaCurto(m.deDia)} a partir das ${m.deHora}`;
  }
  return `De ${diaCurto(m.deDia)} a ${diaCurto(m.ateDia)}`;
}

/** O rótulo curto do calendário, num dia da marcação: «Folga», «Desde 14:00», «14:00–16:00». */
export function rotuloNoDia(m: MarcacaoNova): string {
  if (m.tipo === "parte") return m.ateHora ? `${m.deHora}–${m.ateHora}` : `Desde ${m.deHora}`;
  return m.tipo === "dias" ? "Ausente" : "Folga";
}
