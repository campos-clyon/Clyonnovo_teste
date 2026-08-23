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
