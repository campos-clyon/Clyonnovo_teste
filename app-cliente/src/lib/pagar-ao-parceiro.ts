/**
 * PAGAR AO PARCEIRO NA APP DE CLIENTE — d10, o modelo de 15-11-2026.
 *
 * O cliente paga o trabalho diretamente ao parceiro que contratou
 * (transferência, MB WAY ou dinheiro no local — escolhe ele) e recebe duas
 * faturas no pedido: a do trabalho, do parceiro, e a da taxa da plataforma.
 *
 * A DATA NÃO VIVE AQUI. Quem diz se um trabalho é do modelo novo é o site:
 * `novoModelo` em cada negociação da R5 (antes de contratar: o tipo de fatura do
 * parceiro), `pagamento.pagaAoParceiro` e `GET /api/pagamentos/ao-parceiro`
 * (depois de contratar: o IBAN, o MB WAY, a escolha e as faturas). Antes de
 * 15-11 vêm `null`/falso e a app fica como hoje.
 *
 * Puro: os testes do site importam-no.
 */

/** O bloco `novoModelo` de uma negociação (`NovoModeloNaVista`, src/lib/negociacao-na-vista.ts). */
export type NovoModeloDaNegociacao = {
  perfilFiscal: { tipoDeFatura: "com_iva" | "isento" | "a_confirmar"; fatura: string; emiteGuia: boolean; guia: string | null };
  total: number | null;
  pagarAoParceiroPor: "transferencia" | "mbway" | "dinheiro" | null;
};

/** O que `GET/POST /api/pagamentos/ao-parceiro` devolve ao cliente que contratou. */
export type VistoDoPagarAoParceiro = {
  pagaAoParceiro: boolean;
  frase?: string;
  parceiro?: string;
  paraPagar?: { iban: string | null; titular: string | null; mbway: string | null } | null;
  /** O total pelo regime do parceiro e as duas faturas, numa frase já escrita pelo servidor (d18). */
  totalEmTexto?: string | null;
  /** Sem IBAN nem MB WAY (d17): o que o cliente lê em vez dos dados. */
  semDados?: string | null;
  /**
   * d5 (19-11-2026): os dados de pagamento do parceiro estão retidos até a
   * CLYON os confirmar. Com `true` o servidor manda `paraPagar` a null, a frase
   * em `semDados` e só «dinheiro» em `opcoes`; a app não desenha o IBAN nem o
   * MB WAY, mesmo que venham (`dadosParaPagar`).
   */
  dadosPorConfirmar?: boolean;
  /**
   * Os dados de pagamento do parceiro mudaram depois de contratar (d28): a frase
   * já escrita pelo servidor, que a app mostra tal e qual. Sem ela (ou um site
   * antigo), nada. A app não decide se mudaram: só o servidor o sabe.
   */
  dadosMudaram?: string | null;
  perfilFiscal?: { fatura: string; guia: string | null };
  /** As duas faturas e o total, pelo regime do parceiro (d17, `total-ao-cliente.ts`): números do servidor. */
  conta?: {
    semIva: number;
    total: number | null;
    faturaDoParceiro: number;
    faturaDaTaxa: number;
    ivaDoParceiro?: number;
    ivaDaTaxa?: number;
  } | null;
  comoPagar?: string | null;
  /**
   * O REGISTO DO PAGAMENTO (d3, 23-11-2026): onde está, a frase pronta (nada de
   * preços escritos na app), se ainda pode dizer «Já paguei», o botão e a pergunta
   * de confirmação por forma — tudo escrito no servidor.
   */
  registo?: {
    estado: "por_pagar" | "cliente_disse" | "pago" | "em_duvida";
    pago: boolean;
    texto: string | null;
    podeDizerQuePagou: boolean;
    botao: string;
    confirmacoes?: Record<string, string>;
  };
  opcoes?: Array<{ id: string; curta: string; cliente: string }>;
  faturas?: {
    frase: string;
    daTaxa: { url: string; nome: string | null } | null;
    doTrabalho: { url: string; nome: string | null } | null;
  };
};

export const ROTA_DE_PAGAR_AO_PARCEIRO = "/api/pagamentos/ao-parceiro";

export function rotaDePagarAoParceiro(pedidoId: number, negociacaoId: number): string {
  return `${ROTA_DE_PAGAR_AO_PARCEIRO}?pedidoId=${pedidoId}&negociacaoId=${negociacaoId}`;
}

/** A linha que o cliente lê ao escolher: «Fatura com IVA · Emite guia de resíduos». `null` fora do modelo novo. */
export function linhaDaFaturaDoParceiro(nm: NovoModeloDaNegociacao | null | undefined): string | null {
  if (!nm?.perfilFiscal) return null;
  return nm.perfilFiscal.guia ? `${nm.perfilFiscal.fatura} · ${nm.perfilFiscal.guia}` : nm.perfilFiscal.fatura;
}

/** A mesma frase do bloco do site (`PagarAoParceiro.tsx`): só se paga para os dados do pedido. */
export const SO_PARA_ESTES_DADOS =
  "Pague só para estes dados. Se alguém lhe pedir que pague para outra conta ou outro número, não pague e fale connosco.";

/*
 * O PREÇO NÃO SE ESCREVE AQUI (a regra da app de cliente: nenhum preço, taxa ou
 * imposto escrito na app). O total e as três linhas já vêm da R5 no cartão do
 * parceiro contratado (`preco`); este bloco diz para onde e como pagar, e mostra
 * a frase do total e das duas faturas que o servidor já escreveu (`totalEmTexto`, d18).
 */

/** O que a R5 trouxe serve para desenhar o bloco sem um segundo pedido? (Um site antigo não o manda.) */
export function vistoDaR5(v: unknown): VistoDoPagarAoParceiro | null {
  const o = v as Partial<VistoDoPagarAoParceiro> | null | undefined;
  return o && o.pagaAoParceiro === true ? (o as VistoDoPagarAoParceiro) : null;
}

/** A frase dos dados que mudaram depois de contratar (d28), se o servidor a mandou; senão `null`. */
export function avisoDosDadosMudados(v: VistoDoPagarAoParceiro | null | undefined): string | null {
  const t = v?.dadosMudaram;
  return typeof t === "string" && t.trim() ? t : null;
}

/** O IBAN e o MB WAY a mostrar: nenhum com os dados por confirmar (d5), e nenhum sem dados. */
export function dadosParaPagar(v: VistoDoPagarAoParceiro | null | undefined): { iban: string | null; titular: string | null; mbway: string | null } | null {
  if (!v || v.dadosPorConfirmar === true) return null;
  const p = v.paraPagar;
  return p && (p.iban || p.mbway) ? p : null;
}
