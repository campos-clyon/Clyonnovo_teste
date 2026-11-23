import { mensagemDaReferencia } from "./mensagem-da-referencia";
import { lerParte } from "./parte-do-pagamento";
import type { DividaNaCarteira } from "./carteira";

/**
 * A REFERÊNCIA DA DÍVIDA DO PROFISSIONAL, VISTA DO BACKOFFICE — d89 (CEO e dono,
 * 23-11-2026). Puro: a rota de Pagamentos › A receber dos profissionais e os
 * testes lêem isto.
 *
 * Um Trabalho CLYON que o cliente pagou ao profissional deixa-o a dever a taxa
 * (e o IVA, com fatura). A referência dessa dívida é à parte (`parte = 'divida'`):
 * a negociação já está fechada pelo registo «pago ao profissional». O ecrã só a
 * mostrava nas do modelo de 15-11 — e parecia não haver referência nenhuma.
 */

type LinhaDaReferencia = {
  estado: string;
  metodo: string;
  valor: number;
  parte?: unknown;
  referencia: string | null;
  entidade: string | null;
  expiraEm: Date | string | null;
};

/**
 * A referência viva desta dívida: pendente, com número, não expirada — numa
 * dívida à parte, só as da parte «divida» e do valor que falta (a mesma regra da
 * carteira dele). `null` quando não há.
 */
export function referenciaVivaDaDivida<L extends LinhaDaReferencia>(
  d: Pick<DividaNaCarteira, "aParte" | "total">,
  linhas: ReadonlyArray<L>,
  agora: Date,
): L | null {
  return (
    linhas.find(
      (p) =>
        p.estado === "pendente" &&
        p.referencia != null &&
        (!d.aParte || (lerParte(p.parte) === "divida" && p.valor === d.total)) &&
        (!p.expiraEm || new Date(p.expiraEm).getTime() > agora.getTime()),
    ) ?? null
  );
}

/**
 * O TEXTO PARA MANDAR AO PROFISSIONAL — a mensagem de sempre das referências
 * (`mensagemDaReferencia`), com o que esta paga dito como é: sem IVA, só a taxa.
 * A equipa copia-o ou abre o WhatsApp com ele; nunca se manda sozinho.
 */
export function mensagemDaDividaAoProfissional(o: {
  pedidoId: number | null;
  pagamento: {
    metodo: string;
    valor: number;
    entidade: string | null;
    referencia: string | null;
    telemovel?: string | null;
    expiraEm: Date | string | null;
  };
  divida: { iva: number };
  nome: string | null;
}): string {
  const expira = o.pagamento.expiraEm ? new Date(o.pagamento.expiraEm) : null;
  const pedido = o.pedidoId != null ? ` do pedido #${o.pedidoId}` : "";
  return mensagemDaReferencia({
    pedidoId: o.pedidoId ?? 0,
    metodo: o.pagamento.metodo === "mbway" ? "mbway" : "multibanco",
    valor: o.pagamento.valor,
    entidade: o.pagamento.entidade,
    referencia: o.pagamento.referencia,
    telemovel: o.pagamento.telemovel ?? null,
    expiraEm: expira && !Number.isNaN(expira.getTime()) ? expira : null,
    cliente: o.nome,
    paraOProfissional: true,
    oQueParaOProfissional:
      o.divida.iva > 0
        ? `o IVA e a taxa da plataforma${pedido}, que o cliente lhe pagou diretamente`
        : `a taxa da plataforma${pedido}, que o cliente lhe pagou diretamente`,
  });
}
