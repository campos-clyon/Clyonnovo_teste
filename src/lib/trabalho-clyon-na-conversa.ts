/**
 * O TRABALHO CLYON NA CONVERSA — 25-11-2026 (decisão d120), o #558. PURO.
 *
 * A conta do pedido estava certa (100 € + IVA = 123 €) e foi isso que se
 * mandou ao cliente. Quando ele perguntou «o pagamento é feito a quem?», a
 * Vitória respondeu que «o valor no sistema não bate certo» e pediu desculpa
 * pela mensagem anterior. A causa: o ecrã do pedido que ela lê
 * (`ecraDoPedido`) contava um Trabalho CLYON como uma negociação — pelo
 * valor do parceiro e as taxas dele —, e não pelo preço ao cliente do
 * Trabalho CLYON (`precoDaPropostaClyon`). Dois números diferentes para o
 * mesmo pedido.
 *
 * Agora: o ecrã diz o preço do Trabalho CLYON, o mesmo da conta e da
 * mensagem (`linhaDoTrabalhoClyonNaConversa`); e a revisão não deixa sair a
 * frase «não bate certo» (`DIZ_QUE_NAO_BATE_CERTO`) — quem compara compara o
 * com IVA com o com IVA e o sem IVA com o sem IVA (`valoresBatem`), e se
 * baterem confirma.
 */
import { TAXA_IVA } from "./taxas-plataforma";

const euros = (v: number) => `${(Math.round((v + Number.EPSILON) * 100) / 100).toFixed(2).replace(".", ",")} €`;
const perto = (a: number, b: number) => Math.abs(a - b) < 0.011;

/**
 * DOIS VALORES BATEM? Comparados como devem: o sem IVA com o sem IVA, o com
 * IVA com o com IVA — e o sem IVA de um com o com IVA do outro pela taxa do
 * IVA (100 € + IVA é o mesmo que 123 €). Pura.
 */
export function valoresBatem(a: { semIva?: number | null; total?: number | null }, b: { semIva?: number | null; total?: number | null }): boolean {
  const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const [as, at, bs, bt] = [n(a.semIva), n(a.total), n(b.semIva), n(b.total)];
  const comIva = (s: number) => Math.round(s * (1 + TAXA_IVA) * 100) / 100;
  if (as != null && bs != null && !perto(as, bs)) return false;
  if (at != null && bt != null && !perto(at, bt)) return false;
  if (as != null && bt != null && !perto(comIva(as), bt) && !perto(as, bt)) return false;
  if (at != null && bs != null && !perto(at, comIva(bs)) && !perto(at, bs)) return false;
  return (as != null || at != null) && (bs != null || bt != null);
}

/**
 * A LINHA DO PEDIDO NUM TRABALHO CLYON — o preço ao cliente, o mesmo da conta
 * e da mensagem: «Pedido #558: Trabalho CLYON com X — 100,00 € + IVA =
 * 123,00 €, o total.» (sem fatura: «100,00 €, o total, sem fatura»). Pura.
 */
export function linhaDoTrabalhoClyonNaConversa(t: {
  pedidoId: number;
  parceiro?: string | null;
  preco: { semIva: number; total: number };
  semFactura?: boolean;
  unidade?: string;
}): string {
  const com = t.parceiro?.trim() ? ` com ${t.parceiro.trim()}` : "";
  const por = t.unidade ?? "";
  const valor = t.semFactura
    ? `${euros(t.preco.semIva)}${por}, o total, sem fatura`
    : `${euros(t.preco.semIva)} + IVA = ${euros(t.preco.total)}${por}, o total`;
  return `Pedido #${t.pedidoId}: Trabalho CLYON${com} — ${valor}.`;
}

/** A frase que a revisão não deixa sair: dizer ao cliente que um valor «não bate certo». */
export const DIZ_QUE_NAO_BATE_CERTO =
  /n[ãa]o\s+bat(?:e|em)\s+cert|n[ãa]o\s+(?:corresponde|coincide)m?\b|valor\s+(?:no|do)\s+sistema|dizia\s+outra\s+coisa|pe[çc]o\s+desculpa\s+pela\s+mensagem\s+anterior/i;
