import { diaEmLisboa, horaEmLisboa } from "@/lib/hora-de-lisboa";

/**
 * O TRABALHO AINDA NÃO ESTÁ NA DATA — 14-10-2026.
 *
 * *«Os pedidos futuros devem ter uma proteção extra para serem confirmados
 * que foram realizados ou apagados: deve aparecer uma tela vermelha
 * perguntando se tem a certeza que quer continuar, pois esse pedido AINDA
 * NÃO ESTÁ NA DATA.»*
 *
 * Conta-se em Lisboa, que é onde o trabalho acontece. Um dia a seguir a hoje
 * ainda não chegou. Hoje só não chegou se tem hora marcada e ela ainda não
 * passou: um dia sem hora (meia-noite, que é o que fica gravado) já é hoje.
 */
export function aindaNaoEstaNaData(
  quando: string | Date | null | undefined,
  agora: Date = new Date(),
): boolean {
  if (quando == null || quando === "") return false;
  const d = quando instanceof Date ? quando : new Date(quando);
  if (Number.isNaN(d.getTime())) return false;
  const dia = diaEmLisboa(d);
  const hoje = diaEmLisboa(agora);
  if (dia > hoje) return true;
  if (dia < hoje) return false;
  return horaEmLisboa(d) !== "00:00" && d.getTime() > agora.getTime();
}

const POR_EXTENSO = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** «domingo, 19 de outubro, às 10:00» — ou sem a hora, quando não a há. */
export function diaDoTrabalhoPorExtenso(quando: string | Date): string {
  const d = quando instanceof Date ? quando : new Date(quando);
  const hora = horaEmLisboa(d);
  return POR_EXTENSO.format(d) + (hora === "00:00" ? "" : `, às ${hora}`);
}
