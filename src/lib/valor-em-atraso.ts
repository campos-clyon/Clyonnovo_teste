import { DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO } from "./novo-modelo";

/** Os 4 dias, para a app CLYON Pro (que não importa novo-modelo.ts: não tem a data). */
export { DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO };

/**
 * O VALOR EM ATRASO E O STAND-BY — d10, desde 15-11-2026 (dono, 12-11-2026).
 *
 * Quando um trabalho do modelo novo fecha, nasce o valor em atraso do parceiro:
 * a taxa da plataforma e o IVA dela (`faturaDaClyonCent` de `pagamento-directo.ts`),
 * com uma referência Multibanco ou MB WAY do euPago, uma por trabalho. Tem
 * `DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO` dias para o pagar; passados eles, a conta
 * fica em STAND-BY: continua a ver os pedidos, mas aceitar e enviar proposta
 * mostram «Pagar o valor em atraso». O pagamento confirmado pelo euPago (o
 * webhook, ou a conferência de hora a hora) normaliza sozinho — não há estado de
 * stand-by guardado em lado nenhum: lê-se dos valores por pagar a cada pedido.
 *
 * A palavra é «valor em atraso», nunca «valor em dívida», em tudo o que o
 * parceiro lê.
 *
 * Pura: a carteira, o bloqueio, o painel e as rotas lêem isto.
 */

const DIA = 86_400_000;

/** O botão e o título que o parceiro lê no stand-by. */
export const PAGAR_O_VALOR_EM_ATRASO = "Pagar o valor em atraso";

export type ValorEmAtraso = {
  negociacaoId: number;
  pedidoId?: number | null;
  /** O que falta pagar, em euros (a fatura da taxa: taxa + IVA dela). */
  total: number;
  /** Quando nasceu (o trabalho fechou). */
  nasceuEm: Date | null;
  paga: boolean;
  /** A referência viva para o pagar, quando há. */
  multibanco?: { entidade: string | null; referencia: string | null } | null;
};

/** O fim do prazo — `null` sem data de nascimento. */
export function prazoDoValorEmAtraso(v: Pick<ValorEmAtraso, "nasceuEm">): Date | null {
  if (!v.nasceuEm || Number.isNaN(v.nasceuEm.getTime())) return null;
  return new Date(v.nasceuEm.getTime() + DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO * DIA);
}

/**
 * Os que passaram do prazo. «4 dias» ao pé da letra: no 4.º dia ainda está a
 * tempo; passa no instante a seguir a fazer quatro dias certos — o 5.º dia já é
 * stand-by. Sem data, não conta (não se castiga por um buraco nosso).
 */
export function valoresForaDoPrazo(valores: ValorEmAtraso[], agora: Date): ValorEmAtraso[] {
  return valores
    .filter((v) => !v.paga && v.total > 0)
    .filter((v) => {
      const fim = prazoDoValorEmAtraso(v);
      return fim != null && agora.getTime() > fim.getTime();
    });
}

export type StandBy = {
  emStandBy: boolean;
  /** Soma do que está fora do prazo. */
  total: number;
  /** Soma de tudo o que está por pagar (no prazo ou fora). */
  porPagar: number;
  valores: ValorEmAtraso[];
};

export function standByDe(valores: ValorEmAtraso[], agora: Date): StandBy {
  const fora = valoresForaDoPrazo(valores, agora);
  const soma = (vs: ValorEmAtraso[]) => Math.round(vs.reduce((s, v) => s + v.total, 0) * 100) / 100;
  return {
    emStandBy: fora.length > 0,
    total: soma(fora),
    porPagar: soma(valores.filter((v) => !v.paga && v.total > 0)),
    valores: fora,
  };
}

function euros(v: number): string {
  return `${v.toFixed(2).replace(".", ",")} €`;
}

/** A frase do stand-by, com o valor, o pedido e a referência. */
export function explicacaoDoStandBy(valores: Array<Pick<ValorEmAtraso, "total" | "pedidoId" | "multibanco">>): string {
  if (valores.length === 0) return "";
  const total = Math.round(valores.reduce((s, v) => s + v.total, 0) * 100) / 100;
  const cada = valores
    .map((v) => {
      const de = v.pedidoId != null ? `${euros(v.total)} do pedido #${v.pedidoId}` : euros(v.total);
      return v.multibanco?.referencia
        ? `${de} (Multibanco: entidade ${v.multibanco.entidade ?? "—"}, referência ${v.multibanco.referencia})`
        : de;
    })
    .join("; ");
  return (
    `${PAGAR_O_VALOR_EM_ATRASO}: tem ${euros(total)} da taxa da plataforma e do IVA dela por pagar há mais de ` +
    `${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias — ${cada}. Enquanto não estiver pago, continua a ver os pedidos, ` +
    "mas não pode aceitar pedidos nem enviar propostas. Assim que o pagamento for confirmado, a conta volta ao normal sozinha."
  );
}
