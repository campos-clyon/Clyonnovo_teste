/**
 * «QUINZE HORAS» É UMA HORA EM LISBOA, NÃO UM INSTANTE.
 *
 * Isto nasceu de um bug relatado a 18-09-2026: *«Eu troco o horário para as
 * 15h00 e salvo, mas ele não muda realmente.»* Mudava — para as 16h00.
 *
 * A CORRIDA INTEIRA, porque é sempre a mesma e engana sempre:
 *
 *   1. o campo `datetime-local` do telemóvel envia `2026-09-18T15:00`,
 *      SEM FUSO NENHUM. É só o que se vê no relógio;
 *   2. o servidor da Vercel corre em UTC, e `new Date("2026-09-18T15:00")`
 *      lê uma string sem fuso como hora LOCAL DELE — ou seja, 15:00 UTC;
 *   3. grava-se 15:00 UTC;
 *   4. o telemóvel, em Lisboa, mostra o instante no fuso dele: 16:00.
 *
 * Uma hora à frente de Março a Outubro, e certo no Inverno — que é a pior
 * espécie de erro, porque desaparece quando alguém o vai procurar.
 *
 * ESTE FICHEIRO É PURO e não tem dependências. `Intl` já sabe quando é que
 * Portugal muda a hora; escrever «no Verão soma-se uma» à mão seria assinar
 * um erro para o último domingo de Outubro.
 */

/**
 * Quanto é que Lisboa está à frente do UTC NESTE instante, em milissegundos.
 *
 * `+3600000` no Verão (WEST), `0` no Inverno (WET). Sai da tabela de fusos do
 * sistema e não de um calendário escrito à mão.
 */
export function deslocamentoDeLisboa(instante: Date): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instante);

  const p: Record<string, number> = {};
  for (const x of partes) if (x.type !== "literal") p[x.type] = Number(x.value);

  /*
   * `hour24` dá 24 à meia-noite em algumas plataformas, e `Date.UTC` com 24
   * salta para o dia seguinte — o que daria um desvio de um dia inteiro numa
   * noite por ano. O resto por 24 resolve-o.
   */
  const comoSeFosseUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return comoSeFosseUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

/** `YYYY-MM-DDTHH:mm` ou `YYYY-MM-DD HH:mm`, com segundos opcionais. */
const SEM_FUSO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Traz fuso explícito — `Z`, `+01:00`, `-03:00`. */
const COM_FUSO = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * O INSTANTE que corresponde a uma hora escrita em Lisboa.
 *
 * Uma string COM fuso já é um instante e passa tal e qual — é o que o ecrã
 * passou a enviar. Uma string SEM fuso é o que se lê num relógio em Portugal,
 * e é aqui que se converte.
 *
 * Devolve `null` para o que não se perceber. Uma data que não se percebe não
 * pode virar «agora» nem «1970»: tem de ser recusada por quem chama.
 */
export function instanteEmLisboa(cru: string): Date | null {
  const texto = cru.trim();
  if (!texto) return null;

  if (COM_FUSO.test(texto)) {
    const d = new Date(texto);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m = SEM_FUSO.exec(texto);
  if (!m) {
    // Não é nenhum dos dois formatos. Tenta-se na mesma — mas o resultado de
    // `new Date` sobre uma string sem fuso depende do fuso do SERVIDOR, e por
    // isso só se aceita o que for inequívoco.
    return null;
  }

  const [, ano, mes, dia, hora, minuto, segundo] = m;
  const comoSeFosseUtc = Date.UTC(
    Number(ano),
    Number(mes) - 1,
    Number(dia),
    Number(hora),
    Number(minuto),
    Number(segundo ?? 0),
  );
  if (Number.isNaN(comoSeFosseUtc)) return null;

  /*
   * DUAS PASSAGENS, E A SEGUNDA NÃO É ZELO A MAIS.
   *
   * Para saber o deslocamento é preciso um instante; para ter o instante é
   * preciso o deslocamento. Começa-se por supor que a hora escrita é UTC e
   * corrige-se — o que acerta em todos os dias do ano menos dois.
   *
   * Nos dois domingos em que o relógio muda, o primeiro palpite pode cair do
   * lado errado da fronteira e escolher o deslocamento errado. A segunda
   * passagem parte de um instante já quase certo e apanha-o.
   */
  let instante = new Date(comoSeFosseUtc - deslocamentoDeLisboa(new Date(comoSeFosseUtc)));
  instante = new Date(comoSeFosseUtc - deslocamentoDeLisboa(instante));
  return Number.isNaN(instante.getTime()) ? null : instante;
}
