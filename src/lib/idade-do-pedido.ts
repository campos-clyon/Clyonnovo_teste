import { instanteDaBase } from "@/lib/hora-de-lisboa";

/**
 * A partir de quando é que um pedido por enviar está frio.
 *
 * PORQUE É QUE ISTO É UMA REGRA E NÃO UM DETALHE DE ECRÃ
 *
 * O painel mostrava os pedidos por promover numa lista corrida: o de hoje e o
 * de há dez dias com o mesmo aspecto e o mesmo botão. Quem abre o backoffice de
 * manhã tinha de ler quinze datas para saber onde valia a pena carregar.
 *
 * Podia agrupar-se por serviço, por cidade, por urgência. Nenhuma dessas muda o
 * que se faz a seguir. A idade muda: um pedido de hoje ainda se ganha, um de há
 * dez dias já foi para outro lado.
 *
 * Três grupos, porque a decisão também é uma de três: atender agora, atender
 * ainda, ou arquivar.
 */

export type GrupoDeIdade = "hoje" | "semana" | "antigo";

/** Dias a partir dos quais um pedido deixa de estar quente. */
export const DIAS_ATE_ARREFECER = 7;

export function grupoPorIdade(criadoEm: string | Date, agora: Date): GrupoDeIdade {
  const d = criadoEm instanceof Date ? criadoEm : new Date(criadoEm);
  // Uma data que não se percebe não pode passar por recente: seria pôr lixo à
  // frente do pedido que chegou há dez minutos.
  if (Number.isNaN(d.getTime())) return "antigo";
  const dias = (agora.getTime() - d.getTime()) / 86_400_000;
  if (dias < 1) return "hoje";
  if (dias < DIAS_ATE_ARREFECER) return "semana";
  return "antigo";
}

export const ROTULO_DO_GRUPO: Record<GrupoDeIdade, string> = {
  hoje: "Hoje",
  semana: "Últimos 7 dias",
  antigo: "Mais antigos",
};

/**
 * A DATA DE CRIAÇÃO DIZ A IDADE — 20-10-2026. *«Coloque as datas de criação
 * dos pedidos do lado direito em destaque, na cor branca até 7 dias; depois
 * de 7 dias a partir da data atual, as datas ficam vermelhas — isso apenas
 * nos pedidos.»* — o dono. A mesma fronteira do «Mais antigos» do «Por
 * decidir» (`DIAS_ATE_ARREFECER`). A data lê-se como a base a guarda (UTC,
 * `instanteDaBase`); sem data que se perceba, fica a branco.
 */
export function corDaDataDeCriacao(
  criadoEm: string | Date | null | undefined,
  agora: Date,
  /**
   * Em fundo claro — a lista de «Todos os pedidos» — o branco não se lia
   * (23-10-2026): aí é quase preto, e o vermelho mais escuro.
   */
  tema: "escuro" | "claro" = "escuro",
): string {
  const d = instanteDaBase(criadoEm ?? null);
  const antigo = d != null && grupoPorIdade(d, agora) === "antigo";
  if (tema === "claro") return antigo ? "text-red-600" : "text-slate-900";
  return antigo ? "text-red-400" : "text-white";
}
