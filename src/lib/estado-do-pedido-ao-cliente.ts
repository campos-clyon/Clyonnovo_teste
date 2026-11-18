import { instanteDaBase } from "./hora-de-lisboa";
import { quemNegoceia } from "./quem-negoceia";
import { origemDoPedido } from "./acesso";
import { valorUnicoDaLinha } from "./valor-unico-ao-cliente";
import {
  AINDA_SEM_PROPOSTAS,
  PEDIDO_A_CONFERIR,
  VALOR_UNICO_ACEITE,
  VALOR_UNICO_EM_PREPARACAO,
} from "./promessas-publicas";

/**
 * O ESTADO DE UM PEDIDO, DITO AO CLIENTE — 16-11-2026 (d53).
 *
 * Pela mesma regra do portão da Mesa: um pedido SEM NEGOCIAÇÕES ainda não foi
 * a ninguém (é o «Orçamentos novos», `pedidosPorPromover`) — a CLYON está a
 * conferi-lo. Com negociações, seguiu para os parceiros. Depois:
 *
 *   · com o valor único enviado e o «sim» dele gravado (`valorUnicoAceiteEm`
 *     posterior ao último envio, como `aceitesDoValorUnico`) → aceite: a CLYON
 *     escolhe o parceiro, e já não se lhe pede que aceite;
 *   · com o valor único enviado e sem aceite → null: o bloco do valor fala;
 *   · sem valor único, num pedido em que é a CLYON que responde por ele
 *     (`quemNegoceia` = «clyon»: registado pela equipa, ou sem email) → a CLYON
 *     prepara o valor (o caminho do valor único, d39);
 *   · o resto → enviado, à espera das propostas.
 *
 * Com o parceiro escolhido, null: o resto da página fala. Esta lib é pura —
 * a página, a app (pela rota) e os testes usam a mesma.
 */
export type EstadoAoCliente = "a_conferir" | "enviado" | "valor_unico_em_preparacao" | "valor_unico_aceite";

export const FRASE_DO_ESTADO: Record<EstadoAoCliente, string> = {
  a_conferir: PEDIDO_A_CONFERIR,
  enviado: AINDA_SEM_PROPOSTAS,
  valor_unico_em_preparacao: VALOR_UNICO_EM_PREPARACAO,
  valor_unico_aceite: VALOR_UNICO_ACEITE,
};

/** O «sim» ao valor único vale se for posterior ao último envio dele. */
export function valorUnicoAceiteValido(aceiteEm: unknown, valorUnicoEm: unknown): boolean {
  const aceite = instanteDaBase(aceiteEm as string | Date | null | undefined);
  if (!aceite) return false;
  const envio = instanteDaBase(valorUnicoEm as string | Date | null | undefined);
  return !envio || aceite.getTime() >= envio.getTime();
}

export type PedidoParaOEstado = {
  valorUnicoCliente?: unknown;
  valorUnicoEm?: unknown;
  valorUnicoAceiteEm?: unknown;
  contactEmail?: string | null;
  rawOrderJson?: string | null;
};

export function estadoDoPedidoAoCliente(
  pedido: PedidoParaOEstado,
  negociacoes: ReadonlyArray<{ estado?: unknown }>,
): EstadoAoCliente | null {
  if (negociacoes.some((n) => n.estado === "acordada")) return null;
  if (valorUnicoDaLinha(pedido.valorUnicoCliente) != null) {
    return valorUnicoAceiteValido(pedido.valorUnicoAceiteEm, pedido.valorUnicoEm) ? "valor_unico_aceite" : null;
  }
  if (negociacoes.length === 0) return "a_conferir";
  const lado = quemNegoceia({ origem: origemDoPedido(pedido.rawOrderJson ?? null).slug, contactEmail: pedido.contactEmail ?? null });
  return lado === "clyon" ? "valor_unico_em_preparacao" : "enviado";
}
