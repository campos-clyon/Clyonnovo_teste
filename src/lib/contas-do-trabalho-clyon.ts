import { precoDaPropostaClyon } from "./proposta-clyon-ao-cliente";
import { taxasDoTrabalhoClyon } from "./oferta-clyon";
import { quantoOProfissionalRecebe } from "./taxas-plataforma";
import { ENTIDADE_QUE_FACTURA } from "./identificacao-legal";

/**
 * PARA ONDE VAI O DINHEIRO DE UM TRABALHO CLYON — 15-10-2026.
 *
 * *«Esses cálculos não fazem sentido.»* E logo a seguir: *«Deixe aqui quanto
 * foi pago pelo cliente, quanto vamos passar à empresa parceira e quanto a
 * CLYON fica.»*
 *
 * O cartão do #437 dizia 130 € sem IVA, «o pro recebe 104 €», «fica para a
 * CLYON 26 €» e «Enviar proposta ao cliente · 159,90 €» — e 104 + 26 não dá
 * 159,90. Faltava à vista o IVA: 29,90 €, que é da empresa parceira, porque é
 * ela que emite a factura ao cliente, no regime normal (a CLYON está no artigo
 * 53.º e não liquida imposto — ver `ENTIDADE_QUE_FACTURA`).
 *
 * As quatro partes somam SEMPRE o que o cliente paga, ao cêntimo: o IVA e o
 * total saem da mesma conta da proposta ao cliente (`precoDaPropostaClyon`),
 * o profissional da mesma conta do cartão, e a CLYON é o resto do sem IVA.
 */
export type ContasDoTrabalhoClyon = {
  /** O que o cliente paga, com IVA — o mesmo número do botão da proposta. */
  cliente: number;
  /** O mesmo, sem IVA. */
  semIva: number;
  /** O IVA da factura: é o que passa para a empresa parceira que a emite. */
  parceira: number;
  /** O que o profissional recebe. */
  profissional: number;
  /** O que fica para a CLYON, sem IVA. */
  clyon: number;
};

/** O nome da empresa parceira que factura, para o ecrã. */
export const EMPRESA_PARCEIRA = ENTIDADE_QUE_FACTURA.nomeCurto;

const aosCentimos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * A repartição de um Trabalho CLYON, ou `null` quando não há preço ao cliente
 * (um antigo sem ele escrito) — sem o preço não se inventa a conta de ninguém.
 *
 * Num trabalho com taxa o valor é o preço ao cliente sem IVA, e o profissional
 * recebe o valor menos a taxa. Num antigo (sem taxa) o valor era o que o
 * profissional recebia, e o preço ao cliente é o que se escreveu à parte.
 */
export function contasDoTrabalhoClyon(t: {
  valorFixo: number;
  taxa: number | null;
  precoAoCliente: number | null;
}): ContasDoTrabalhoClyon | null {
  const preco = precoDaPropostaClyon(t);
  if (!preco) return null;
  const profissional =
    t.taxa != null ? quantoOProfissionalRecebe(t.valorFixo, taxasDoTrabalhoClyon(t.taxa)) : t.valorFixo;
  return {
    cliente: preco.total,
    semIva: preco.semIva,
    parceira: preco.iva,
    profissional,
    clyon: aosCentimos(preco.semIva - profissional),
  };
}
