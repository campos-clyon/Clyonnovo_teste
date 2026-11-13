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

/**
 * A CARTEIRA DEPOIS DE 15-11-2026 — d16 (13-11-2026). No modelo novo o cliente
 * paga ao profissional, e o dinheiro do trabalho deixa de passar pela CLYON: o
 * que ainda está à espera da confirmação, por receber ou por cobrar é só dos
 * trabalhos pagos (ou por pagar) à CLYON antes dessa data, e «A pagar à CLYON»
 * passa a ser a taxa da plataforma e o IVA dela dos trabalhos que o cliente lhe
 * pagou. Os rótulos não mudam; mudam as notas que falavam do dinheiro na CLYON.
 *
 * Quem diz se vale é o SERVIDOR (`novoModelo` da carteira), nunca o relógio do
 * telemóvel: a app e o painel chamam isto com o que a rota mandou.
 */
const NOTAS_NO_NOVO_MODELO: Partial<Record<ChaveDaCarteira, string>> = {
  porReceber: "trabalhos pagos à CLYON antes de 15 de novembro, já confirmados, que a CLYON ainda lhe vai transferir",
  aEsperaDaConfirmacao:
    "trabalhos que o cliente pagou à CLYON antes de 15 de novembro; passam a «Por receber» quando forem confirmados",
  porCobrar: "trabalhos de antes de 15 de novembro; passa a «Por receber» quando o cliente pagar à CLYON",
  aPagarAClyon: "a taxa da plataforma e o IVA dela, dos trabalhos que o cliente lhe pagou",
};

export function rotulosDaCarteira(novoModelo: boolean): Record<ChaveDaCarteira, RotuloDaCarteira> {
  if (!novoModelo) return ROTULOS_DA_CARTEIRA;
  const r = { ...ROTULOS_DA_CARTEIRA };
  for (const [chave, nota] of Object.entries(NOTAS_NO_NOVO_MODELO) as Array<[ChaveDaCarteira, string]>) {
    r[chave] = { ...r[chave], nota };
  }
  return r;
}
