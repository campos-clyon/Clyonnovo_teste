import { comoTratar } from "./whatsapp-recolha";
import { servicoEmPalavras } from "./servico-em-palavras";
import { naAgenda } from "./agenda-dos-trabalhos";
import { COMO_SE_SAI } from "./aviso-de-pedido-ao-profissional";

/**
 * «TEM UM TRABALHO HOJE» — o lembrete da manhã, no WhatsApp do profissional.
 *
 * *«Eles deviam receber notificações de pedidos novos (…) e pedidos
 * agendados, por exemplo: aviso CLYON, você tem um trabalho agendado para
 * hoje na Costa da Caparica para as 10h00.»* — 29-09-2026.
 *
 * O trabalho estava fechado, com dia e hora, e a única forma de o
 * profissional se lembrar era abrir o painel. Quem tem três trabalhos numa
 * semana não abre o painel todas as manhãs — abre o WhatsApp.
 *
 * O QUE O LEMBRETE TRAZ, e porquê cada coisa:
 *   · ONDE e A QUE HORAS, na primeira frase — é o que decide a manhã dele;
 *   · o SERVIÇO e o NÚMERO do pedido, que é o que se diz ao ligar à CLYON;
 *   · o CLIENTE, o TELEFONE e a MORADA. Aqui podem ir, ao contrário do aviso
 *     de pedido novo: o trabalho é dele, e são os dados que ele recebeu PARA o
 *     fazer. A regra é a mesma do painel — enquanto está por fazer;
 *   · o que fazer se não puder ir, porque um profissional que falta sem dizer
 *     nada é o pior dia que um cliente pode ter connosco.
 *
 * SEM HORA MARCADA NÃO SE INVENTA UMA. Uma data à meia-noite em ponto é um
 * dia sem hora — diz-se «hoje», e mais nada.
 */

export type TrabalhoDeHoje = {
  pedidoId: number;
  profissional: string | null;
  servico: string | null;
  localidade: string | null;
  morada: string | null;
  cliente: string | null;
  telefoneDoCliente: string | null;
  /** O instante que conta — o combinado, ou o que o cliente pediu. */
  quando: Date;
};

/** A partir de que hora de Lisboa sai o lembrete. Antes disso, dorme-se. */
export const HORA_DO_LEMBRETE = 7;
/** Depois disto já não é lembrete — é barulho a meio da noite. */
export const ULTIMA_HORA_DO_LEMBRETE = 21;

function partesEmLisboa(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Lisbon",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return {
    dia: `${p.year}-${p.month}-${p.day}`,
    hora: Number(p.hour),
    minuto: Number(p.minute),
  };
}

/** O dia de hoje em Lisboa, `AAAA-MM-DD` — a chave do lembrete. */
export function diaEmLisboa(agora: Date): string {
  return partesEmLisboa(agora).dia;
}

/** «às 10:00», ou nada quando o dia não tem hora. */
export function horaDoTrabalho(quando: Date): string | null {
  const { hora, minuto } = partesEmLisboa(quando);
  if (hora === 0 && minuto === 0) return null;
  return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

/**
 * Este trabalho leva lembrete agora?
 *
 * É hoje em Lisboa, está por fazer, a hora ainda não passou, e estamos dentro
 * da janela da manhã à noite. Um trabalho das 8h cuja hora já passou não leva
 * lembrete às 10h: nessa altura já não é lembrar, é acusar.
 */
export function deveLembrar(
  t: { dataCombinada?: Date | string | null; dataAgendada?: Date | string | null },
  agora: Date,
): { lembrar: boolean; quando: Date | null } {
  const a = naAgenda({ dataCombinada: t.dataCombinada, dataAgendada: t.dataAgendada }, agora);
  if (a.estado !== "hoje" || !a.quando) return { lembrar: false, quando: null };
  const { hora } = partesEmLisboa(agora);
  if (hora < HORA_DO_LEMBRETE || hora >= ULTIMA_HORA_DO_LEMBRETE) return { lembrar: false, quando: a.quando };
  const temHora = horaDoTrabalho(a.quando) != null;
  if (temHora && a.horaJaPassou) return { lembrar: false, quando: a.quando };
  return { lembrar: true, quando: a.quando };
}

export function lembreteDoTrabalhoDeHoje(t: TrabalhoDeHoje, agora: Date): string {
  const abertura = `${comoTratar(t.profissional, agora)} Aqui é a CLYON — aviso de agenda.`;

  const onde = t.localidade?.trim() ? ` em ${t.localidade.trim()}` : "";
  const hora = horaDoTrabalho(t.quando);
  const quando = hora ? `, às ${hora}` : "";
  const oQue =
    `Tem um trabalho marcado para hoje${onde}${quando}: ` +
    `${servicoEmPalavras(t.servico)} (#${t.pedidoId}).`;

  const quem = [
    t.cliente?.trim() ? `Cliente: ${t.cliente.trim()}` : null,
    t.telefoneDoCliente?.trim() ? `Telefone: ${t.telefoneDoCliente.trim()}` : null,
    t.morada?.trim() ? `Morada: ${t.morada.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const fecho =
    "Se não puder ir ou se se atrasar, avise o cliente e a CLYON. Bom trabalho!\n" + COMO_SE_SAI;

  return [abertura, oQue, quem || null, fecho].filter(Boolean).join("\n\n");
}
