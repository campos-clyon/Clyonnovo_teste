import { dataEHoraEmLisboa, instanteDaBase } from "@/lib/hora-de-lisboa";
import { servicoEmPalavras } from "@/lib/servico-em-palavras";

/**
 * SEM VALOR HÁ MAIS DE 4 HORAS — d50, 16-11-2026.
 *
 * Um pedido «por enviar» ainda não foi a parceiro nenhum: não tem valor (nem
 * proposta, nem negociação) e, enquanto ninguém pergunta nada ao cliente,
 * também não tem pergunta. Às 4 horas assim, o selo da Mesa passa a vermelho
 * e o Início mostra-o numa lista à parte, pelo n.º do pedido (do maior para o
 * menor), com a hora de entrada em hora de Lisboa.
 *
 * «Pergunta» é o «Pedir o que falta» / «Pedir info»: o pedido fica no estado
 * `precisa_info` (`pedirMaisDetalhes`) até o cliente responder. Esse está à
 * espera do cliente, não da equipa, e não fica vermelho.
 *
 * A regra vive aqui, numa função só, para o selo da Mesa e o contador do
 * Início dizerem o mesmo (`pedido-sem-valor.test.ts`).
 */

/** As horas a partir das quais um pedido por enviar, sem valor nem pergunta, fica vermelho. */
export const HORAS_SEM_VALOR = 4;

/** O estado de um pedido com uma pergunta ao cliente por responder. */
const COM_PERGUNTA = "precisa_info";

export type PedidoPorEnviar = {
  id: number;
  serviceType?: string | null;
  status?: string | null;
  createdAt: string | Date | null;
};

/** Há quantas horas entrou — `null` sem data que se leia (lida como a base a guarda, em UTC). */
export function horasDesdeQueEntrou(createdAt: string | Date | null | undefined, agora: Date): number | null {
  const d = instanteDaBase(createdAt ?? null);
  if (!d) return null;
  return (agora.getTime() - d.getTime()) / 3_600_000;
}

/**
 * O pedido por enviar está há 4 horas ou mais sem valor nem pergunta?
 *
 * Só se chama com pedidos «por enviar» (sem negociação): é isso que garante o
 * «sem valor». Sem data que se leia, não fica vermelho — não se acusa um
 * pedido de estar atrasado sem saber quando entrou.
 */
export function semValorHaMaisDe4h(p: PedidoPorEnviar, agora: Date): boolean {
  if (String(p.status ?? "") === COM_PERGUNTA) return false;
  const h = horasDesdeQueEntrou(p.createdAt, agora);
  return h != null && h >= HORAS_SEM_VALOR;
}

/** O selo da linha: «por enviar · recolha de móveis», e se está vermelho. */
export function seloDePorEnviar(p: PedidoPorEnviar, agora: Date): { texto: string; vermelho: boolean; titulo: string } {
  const vermelho = semValorHaMaisDe4h(p, agora);
  const servico = p.serviceType ? servicoEmPalavras(p.serviceType) : "serviço por indicar";
  return {
    texto: `por enviar · ${servico}`,
    vermelho,
    titulo: vermelho
      ? `Há mais de ${HORAS_SEM_VALOR} h sem valor nem pergunta ao cliente`
      : String(p.status ?? "") === COM_PERGUNTA
        ? "À espera da resposta do cliente à pergunta"
        : `Ainda dentro das ${HORAS_SEM_VALOR} h`,
  };
}

export type SemValorNoInicio = {
  id: number;
  servico: string;
  /** Quando entrou, em hora de Lisboa («16/11/2026, 09:30»). */
  entrouEm: string;
  horas: number;
};

/** A lista do Início: só os vermelhos, pelo n.º do pedido, do maior para o menor. */
export function semValorParaOInicio(pedidos: readonly PedidoPorEnviar[], agora: Date): SemValorNoInicio[] {
  return pedidos
    .filter((p) => semValorHaMaisDe4h(p, agora))
    .map((p) => {
      const d = instanteDaBase(p.createdAt ?? null)!;
      return {
        id: Number(p.id),
        servico: p.serviceType ? servicoEmPalavras(p.serviceType) : "serviço por indicar",
        entrouEm: dataEHoraEmLisboa(d),
        horas: Math.floor((agora.getTime() - d.getTime()) / 3_600_000),
      };
    })
    .sort((a, b) => b.id - a.id);
}
