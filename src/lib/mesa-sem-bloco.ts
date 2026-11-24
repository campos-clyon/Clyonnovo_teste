/**
 * A MESA NUNCA ESCONDE UM PEDIDO — 24-11-2026 (d110, o #658).
 *
 * A procurar o #658, a Mesa dizia «1 pedido em toda a mesa» e todos os blocos
 * estavam a 0: o pedido estava carregado e não se via em lado nenhum, e o dono
 * não o conseguia abrir. Cada bloco tem a sua regra, e uma regra nova (um
 * estado, um seguimento, um modo) pode deixar um pedido entre dois blocos sem
 * ninguém dar por isso.
 *
 * A rede: o que a Mesa conta (o que carregou e a busca deixou passar) e o que
 * os blocos desenham comparam-se aqui. O que foi contado e não está em bloco
 * nenhum aparece na linha «Sem bloco — ver», com o botão para o abrir. Uma
 * linha à parte, e não «o bloco mais parecido»: um pedido que caiu fora das
 * regras é um defeito a corrigir, e enfiá-lo num bloco escondia-o outra vez.
 *
 * Pura e sem imports (`mesa-sem-bloco.test.ts`).
 */

/** O que cada bloco da Mesa desenha: os números dos pedidos, por bloco. */
export type PedidosPorBloco = Readonly<Record<string, ReadonlyArray<number>>>;

/** Os pedidos contados que não estão em bloco nenhum, do maior n.º para o menor, sem repetidos. */
export function pedidosSemBloco(contados: Iterable<number>, porBloco: PedidosPorBloco): number[] {
  const colocados = new Set<number>();
  for (const ids of Object.values(porBloco)) for (const id of ids) colocados.add(id);
  const fora = new Set<number>();
  for (const id of contados) if (!colocados.has(id)) fora.add(id);
  return [...fora].sort((a, b) => b - a);
}

/**
 * Quantos pedidos diferentes a Mesa mostra: os dos blocos mais os «sem bloco».
 * É o número que tem de bater com o que se contou (`mesa-sem-bloco.test.ts`).
 */
export function pedidosMostrados(contados: Iterable<number>, porBloco: PedidosPorBloco): number {
  const vistos = new Set<number>();
  for (const ids of Object.values(porBloco)) for (const id of ids) vistos.add(id);
  for (const id of pedidosSemBloco(contados, porBloco)) vistos.add(id);
  return vistos.size;
}

/** O título da linha e a frase dela. */
export const SEM_BLOCO_TITULO = "Sem bloco — ver";
export const SEM_BLOCO_DICA =
  "Estes pedidos foram contados mas não caíram em nenhum bloco. Abra-os e trate-os; avise a equipa técnica, para a regra ser corrigida.";
