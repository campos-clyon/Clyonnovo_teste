/**
 * OS NOMES DA CARTEIRA DO PROFISSIONAL — um mapa só, para o painel e para a
 * app (28-10-2026, d4).
 *
 * 30-10-2026 (ordem do CEO e do dono): «Por receber» passa a ser o que a
 * CLYON AINDA LHE VAI PAGAR — trabalho feito e confirmado, por transferir (o
 * disponível + o que vai a caminho). O cativo (o cliente pagou, à espera da
 * confirmação) chama-se «À espera da confirmação». *«Aqui não consigo ter
 * controle de nada»* — dono, sobre a carteira de antes.
 *
 * Puro e sem imports: a app importa-o tal e qual. Um rótulo novo da carteira
 * entra aqui, e os testes chumbam se o painel ou a app o escreverem à mão.
 */

export type ChaveDaCarteira =
  | "porReceber"
  | "aEsperaDaConfirmacao"
  | "disponivel"
  | "pago"
  | "aCaminho"
  | "porCobrar"
  | "recebidoEmMao"
  | "aPagarAClyon"
  | "pagoAClyonComOSaldo"
  | "totalGanho";

export type RotuloDaCarteira = {
  /** O nome, como aparece no ecrã. */
  rotulo: string;
  /** A linha pequena por baixo: o que o número é. */
  nota: string;
};

export const ROTULOS_DA_CARTEIRA: Record<ChaveDaCarteira, RotuloDaCarteira> = {
  /** O disponível + o que vai a caminho: confirmado e ainda não transferido. */
  porReceber: {
    rotulo: "Por receber",
    nota: "trabalho confirmado que a CLYON ainda lhe vai pagar",
  },
  /** O cativo: pago pelo cliente à CLYON, à espera de o trabalho ficar confirmado. */
  aEsperaDaConfirmacao: {
    rotulo: "À espera da confirmação",
    nota: "o cliente já pagou à CLYON; passa a «Por receber» quando o trabalho for confirmado",
  },
  /** A parte do «Por receber» que se pode pedir hoje — o botão Transferir pede-a. */
  disponivel: {
    rotulo: "Pode pedir já",
    nota: "peça a transferência e a CLYON envia-a para o seu IBAN",
  },
  /** Levantamentos pagos e trabalhos pagos um a um. */
  pago: {
    rotulo: "Recebido",
    nota: "já transferido pela CLYON para o seu banco",
  },
  aCaminho: {
    rotulo: "A caminho da sua conta",
    nota: "transferência pedida, a ser feita",
  },
  porCobrar: {
    rotulo: "O cliente ainda não pagou",
    nota: "trabalho feito; passa a «Por receber» quando o cliente pagar",
  },
  recebidoEmMao: {
    rotulo: "Recebido em mão",
    nota: "pago em dinheiro, no local — já está consigo",
  },
  aPagarAClyon: {
    rotulo: "A pagar à CLYON",
    nota: "IVA e taxa da plataforma de trabalhos pagos em dinheiro",
  },
  pagoAClyonComOSaldo: {
    rotulo: "Pago à CLYON com o saldo",
    nota: "IVA e taxa da plataforma de trabalhos em dinheiro",
  },
  totalGanho: {
    rotulo: "Total ganho",
    nota: "desde que começou na CLYON",
  },
};
