import { faixaSemEComIva, quantidadeDoEntulhoDoPedido, valorDoEntulho } from "./preco-de-referencia";
import { MINIMO_DE_SACOS } from "./precos-publicos";

/**
 * O PREÇO DO ENTULHO, COM A QUANTIDADE QUE ELE JÁ DISSE — 16-11-2026 (d51,
 * acrescento do dono). Quem já disse «15 sacos» e pergunta o valor ouve a
 * estimativa da grelha, e não só «o valor é dado pelos parceiros». Os números
 * saem da fonte única (`precos-publicos.ts`, pela mesma conta do simulador e
 * do motor — `valorDoEntulho`): o saco a 4,00–4,80 € sem IVA, o mínimo de uma
 * recolha (10 sacos), e o com IVA sempre ao lado. Sem andares: esses somam-se
 * quando se souberem, e o valor final vem das propostas dos parceiros.
 *
 * `null` sem quantidade em sacos que a grelha leia, ou acima da grelha (aí é
 * proposta com fotografias, como no simulador).
 */
export function estimativaDoEntulhoDito(quantidade: string | null | undefined): string | null {
  if (!quantidade?.trim()) return null;
  const q = quantidadeDoEntulhoDoPedido({ entulhoQuantidade: quantidade });
  const conta = valorDoEntulho(q, null);
  if (!conta || conta.valor.tipo !== "faixa") return null;
  const sacos = conta.ref.sacos;
  const oQue =
    sacos < MINIMO_DE_SACOS
      ? `${sacos === 1 ? "1 saco" : `${sacos} sacos`} contam como o mínimo de uma recolha (${MINIMO_DE_SACOS} sacos)`
      : `${sacos} sacos ficam`;
  return (
    `Pela grelha do entulho, ${oQue} em ${faixaSemEComIva(conta.valor.de, conta.valor.ate)}. ` +
    "Os andares somam-se depois, e o valor final vem das propostas dos parceiros."
  );
}
