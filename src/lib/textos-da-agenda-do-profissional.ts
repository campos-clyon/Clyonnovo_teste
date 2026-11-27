/**
 * «ADICIONAR À MINHA AGENDA» — os textos e a regra do «o dia mudou» (d144,
 * dono, 27-11-2026).
 *
 * *«Os trabalhos marcados devem ir para a agenda de cada parceiro, não para a
 * do dono.»* Num trabalho contratado com dia marcado, o profissional põe-no no
 * calendário DELE: pela ligação do Google Agenda, ou pelo ficheiro .ics (Apple,
 * Outlook e os outros).
 *
 * Sem imports, de propósito: a app CLYON Pro lê este ficheiro por caminho
 * relativo, e o painel e o servidor lêem-no daqui — as mesmas palavras nos
 * dois ecrãs (`app-pro.test.ts` guarda a cadeia dos imports da app).
 */

export const TEXTOS_DA_AGENDA = {
  titulo: "Adicionar à minha agenda",
  explicacao: "Ponha este trabalho no calendário do seu telemóvel, com o dia, a hora, a morada e o contacto do cliente.",
  google: "Google Agenda",
  outra: "Apple, Outlook e outras",
  diaMudou: "O dia mudou — atualize na sua agenda.",
  aAbrir: "A abrir…",
} as const;

/**
 * O DIA MUDOU DEPOIS DE ELE O PÔR NA AGENDA?
 *
 * `adicionadaPara` é o dia (o `dataCombinada`) que estava marcado quando ele
 * carregou no botão; `dataCombinada` é o de agora. Diferentes = o evento no
 * calendário dele está errado e tem de o actualizar. Nunca adicionado, ou sem
 * dia marcado agora: não há nada a dizer.
 *
 * Compara instantes (não o texto): o MySQL devolve `Date`, a API devolve ISO,
 * e «2026-12-01T09:00:00.000Z» e «2026-12-01 09:00:00» são o mesmo dia.
 */
export function diaMudouNaAgenda(
  dataCombinada: Date | string | null | undefined,
  adicionadaPara: Date | string | null | undefined,
): boolean {
  if (dataCombinada == null || dataCombinada === "" || adicionadaPara == null || adicionadaPara === "") return false;
  const agora = instante(dataCombinada);
  const antes = instante(adicionadaPara);
  if (agora == null || antes == null) return false;
  return agora !== antes;
}

/** Um instante em milissegundos; as datas da base sem fuso lêem-se em UTC (`a-base-e-lida-em-utc`). */
function instante(v: Date | string): number | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  const t = String(v).trim();
  const semFuso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(t);
  const ms = new Date(semFuso ? `${t.replace(" ", "T")}Z` : t).getTime();
  return Number.isNaN(ms) ? null : ms;
}
