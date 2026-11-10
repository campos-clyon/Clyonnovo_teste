import { pedidoArrumado, pedidoFechado } from "@/lib/pedido-arrumado";
import { VALOR_MAXIMO_ACEITE, VALOR_MINIMO_ACEITE } from "@/lib/pedido-valores";

/**
 * APROVAR O ORÇAMENTO CONFERE O PREÇO E O ESTADO — 10-11-2026 (d27).
 *
 * As duas rotas de aprovar (`/api/admin/pedidos/approve` e
 * `/api/admin/pedidos/[id]/approve`) faziam `Number(precoFinal)` e gravavam:
 * «350,50» dava um número que não é número, um valor negativo ou zero seguia
 * para o email do cliente, e um pedido cancelado, arquivado ou já concluído
 * voltava a «aprovado» — com email ao cliente e um link para o confirmar.
 *
 * As regras ficam aqui, para as duas rotas dizerem o mesmo.
 */

export type PrecoDoOrcamento = { ok: true; preco: number } | { ok: false; erro: string };

/** O preço sem IVA que a equipa escreveu. Aceita a vírgula decimal de um teclado português. */
export function lerPrecoDoOrcamento(bruto: unknown): PrecoDoOrcamento {
  const texto = typeof bruto === "string" ? bruto.trim().replace(/\s/g, "").replace(",", ".") : bruto;
  const n = typeof texto === "number" ? texto : typeof texto === "string" && texto !== "" ? Number(texto) : NaN;
  if (!Number.isFinite(n)) return { ok: false, erro: "Indique o preço do orçamento, em euros." };
  const preco = Math.round((n + Number.EPSILON) * 100) / 100;
  if (preco < VALOR_MINIMO_ACEITE) {
    return { ok: false, erro: `O preço do orçamento tem de ser pelo menos ${VALOR_MINIMO_ACEITE} €.` };
  }
  if (preco > VALOR_MAXIMO_ACEITE) {
    return { ok: false, erro: "Esse preço é alto de mais para ser verdade — confirme o valor." };
  }
  return { ok: true, preco };
}

/** `null` quando o pedido se pode aprovar; senão, o que a equipa lê (409). */
export function porqueNaoSeAprova(status: string | null | undefined): string | null {
  if (pedidoArrumado(status)) {
    return "Este pedido está cancelado ou arquivado — não se aprova. Restaure-o primeiro.";
  }
  if (pedidoFechado(status)) return "Este pedido já foi concluído — não se aprova outra vez.";
  return null;
}
