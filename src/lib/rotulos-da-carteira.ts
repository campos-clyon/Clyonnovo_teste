/**
 * OS NOMES DA CARTEIRA DO PROFISSIONAL — um mapa só, para o painel e para a
 * app (28-10-2026, d4).
 *
 * O mesmo dinheiro tinha dois vocabulários: no painel o cativo chamava-se
 * «Por receber», na app «Cativo»; e a app tinha um «Para receber» que é outro
 * número (o disponível, o que vai a caminho e o cativo dos trabalhos já
 * feitos). A ajuda que a app mostra explicava «Por receber», um nome que não
 * aparecia em ecrã nenhum dela.
 *
 * Decisão do dono: «Por receber» é o cativo em todo o lado. O número de cima
 * da app passa a «A receber, já feito», para não se confundir com ele.
 *
 * Puro e sem imports: a app importa-o tal e qual. Um rótulo novo da carteira
 * entra aqui, e o teste `rotulos-da-carteira.test.ts` chumba se o painel ou a
 * app o escreverem à mão.
 */

export type ChaveDaCarteira =
  | "aReceberJaFeito"
  | "porReceber"
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
  /** O número de cima da app: disponível + a caminho + o cativo dos trabalhos já feitos. */
  aReceberJaFeito: {
    rotulo: "A receber, já feito",
    nota: "trabalho feito que ainda não lhe chegou ao banco",
  },
  /** O cativo: pago pelo cliente à CLYON, à espera de o trabalho ficar confirmado. */
  porReceber: {
    rotulo: "Por receber",
    nota: "pago pelo cliente, à espera da confirmação",
  },
  disponivel: {
    rotulo: "Disponível para transferir",
    nota: "pode pedir já",
  },
  /** Levantamentos pagos e trabalhos pagos um a um. */
  pago: {
    rotulo: "Pago",
    nota: "já no seu banco",
  },
  aCaminho: {
    rotulo: "A caminho da sua conta",
    nota: "transferência pedida, a ser feita",
  },
  porCobrar: {
    rotulo: "Por cobrar",
    nota: "trabalho feito que o cliente ainda não pagou",
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
