import { contaDoCliente, TAXAS_DE_ORIGEM, TAXA_IVA, type ContaDoCliente, type Taxas } from "./taxas-plataforma";
import { temIvaIncluido, type ModeloDoPreco } from "./iva-incluido";

/**
 * O PREÇO QUE O CLIENTE VÊ — UM NÚMERO SÓ, JÁ COM A TAXA CLYON.
 *
 * "Vamos mudar como cobramos para simplificar tudo: invés de cobrar 5 % do
 *  cliente depois, vamos apresentar o valor proposto já com a taxa. Ex.: o pro
 *  propôs 350, para o cliente vai aparecer 367,5 que foi proposto, para o pro
 *  327,08 — assim a CLYON mantém-se a ganhar os 11 %." — 29-09-2026.
 *
 * E DESDE 01-10-2026 COM O IVA LÁ DENTRO. "Preços com IVA incluído: o cliente
 * vê um número só por proposta, já com a taxa da CLYON e com 23 % de IVA. Ex.:
 * profissional propõe 350 € → cliente vê 452,03 €." O número passa a depender
 * do MODELO da negociação (`iva-incluido.ts`): as abertas antes do corte
 * continuam a dizer 367,50 € sem IVA até ao fim, para ninguém ver um preço
 * mudar a meio. É por isso que o `modelo` é OBRIGATÓRIO em todas as funções
 * daqui — um parâmetro com valor por omissão era um ecrã esquecido a mostrar o
 * preço do outro modelo sem ninguém dar por isso.
 *
 * O QUE NÃO MUDOU: o valor da negociação continua a ser o do profissional,
 * SEM IVA. É ele que se grava nas propostas e no `valorAcordado`, e é sobre
 * ele que se fazem a carteira, as facturas e a referência do euPago. O que
 * mudou foi o que se MOSTRA ao cliente.
 *
 * O que ele ESCREVE é também um preço dele. «Posso pagar 450» quer dizer 450 a
 * sair da carteira — com a taxa e, no modelo de agora, com o IVA.
 * `baseDoPrecoDoCliente` faz a volta, antes de a proposta chegar ao motor.
 *
 * Sem dependências de servidor: o ecrã do cliente importa isto.
 */

/**
 * A CONTA INTEIRA DO CLIENTE, NO MODELO DA NEGOCIAÇÃO — a função a usar.
 *
 * É a `contaDoCliente` de sempre (serviço, taxa, IVA, total, sem IVA) mais as
 * duas coisas que o modelo decide:
 *
 *   · `ivaIncluido` — se o número que se lhe diz já leva o imposto;
 *   · `aPagar` — ESSE número: o `total` com IVA incluído, o `semIva` antes do
 *     corte. É o que se mostra, o que se escreve nas mensagens e o que se pede
 *     ao banco dele.
 */
export type PrecoDoCliente = ContaDoCliente & {
  ivaIncluido: boolean;
  aPagar: number;
};

export function precoDoCliente(
  valorDoProfissional: number,
  taxas: Taxas | undefined,
  modelo: ModeloDoPreco,
  acrescimo = 0,
): PrecoDoCliente {
  const conta = contaDoCliente(valorDoProfissional, taxas ?? TAXAS_DE_ORIGEM, acrescimo);
  const ivaIncluido = temIvaIncluido(modelo);
  return { ...conta, ivaIncluido, aPagar: ivaIncluido ? conta.total : conta.semIva };
}

/**
 * O que o cliente paga por um valor do profissional — o número que se lhe diz.
 *
 * Com IVA incluído desde o corte; sem IVA nas negociações anteriores.
 */
export function precoParaOCliente(
  valorDoProfissional: number,
  taxas: Taxas | undefined,
  modelo: ModeloDoPreco,
): number {
  return precoDoCliente(valorDoProfissional, taxas, modelo).aPagar;
}

/**
 * O valor do profissional que corresponde a um preço dito pelo cliente.
 *
 * NEM TODOS OS CÊNTIMOS TÊM VOLTA. A taxa e o IVA arredondam ao cêntimo, e por
 * isso há preços a que nenhum valor chega. Só com a taxa (modelo antigo) era um
 * preço redondo em cada vinte e um; com o IVA lá dentro, cada cêntimo do
 * profissional anda 1,29 cêntimos no preço do cliente, e passa a ser perto de
 * um em cada quatro — com um salto de até três cêntimos entre dois preços
 * possíveis. A REGRA FICA A MESMA: fica o de baixo. O cliente nunca passa a
 * pagar mais do que escreveu, e quem chama mostra-lhe o número que ficou
 * (`precoPossivel`).
 *
 * `null` para um preço que não é preço nenhum — zero, negativo, lixo.
 */
export function baseDoPrecoDoCliente(
  preco: number,
  taxas: Taxas | undefined,
  modelo: ModeloDoPreco,
): number | null {
  if (!Number.isFinite(preco) || preco <= 0) return null;
  const t = taxas ?? TAXAS_DE_ORIGEM;
  const alvo = Math.round((preco + Number.EPSILON) * 100) / 100;
  // O preço por euro do profissional: a taxa, e o IVA quando está incluído.
  const contaUmEuro = precoParaOCliente(100, t, modelo) / 100;
  /*
   * Em cêntimos inteiros, para a descida não acumular o erro de somar 0,01
   * em vírgula flutuante. A resposta está a um ou dois cêntimos do aproximado;
   * começa-se acima e desce-se até caber.
   */
  const aproximado = Math.round((alvo / contaUmEuro) * 100);
  for (let c = aproximado + 3; c >= Math.max(1, aproximado - 4); c--) {
    const base = c / 100;
    if (precoParaOCliente(base, t, modelo) <= alvo + 1e-9) return base;
  }
  return null;
}

/**
 * O preço que fica depois da volta — o escrito, na maior parte dos casos, e
 * até três cêntimos abaixo no que sobra. É ESTE que se mostra ao cliente antes
 * de ele carregar em propor, e depois na confirmação.
 */
export function precoPossivel(
  preco: number,
  taxas: Taxas | undefined,
  modelo: ModeloDoPreco,
): number | null {
  const base = baseDoPrecoDoCliente(preco, taxas, modelo);
  return base == null ? null : precoParaOCliente(base, taxas, modelo);
}

/** «300», «300,5», 300 — como chega de um corpo de pedido. */
function numeroEscrito(v: unknown): number {
  return typeof v === "string" ? Number(v.trim().replace(",", ".")) : Number(v);
}

/**
 * O VALOR QUE ENTRA NO MOTOR, a partir do que o ecrã do cliente mandou.
 *
 * O ecrã de agora manda `preco` — o que o cliente escreveu, que é o que ele
 * paga — e aqui vira o valor do profissional, no modelo DAQUELA negociação. Um
 * ecrã aberto ANTES de 29-09-2026 ainda manda `valor`, que nessa altura já era
 * o do profissional: lê-se como sempre se leu.
 *
 * NaN quando não há número — o motor responde «Indique um valor.».
 */
export function valorDaPropostaDoCliente(
  corpo: { preco?: unknown; valor?: unknown },
  taxas: Taxas | undefined,
  modelo: ModeloDoPreco,
): number {
  if (corpo.preco !== undefined && corpo.preco !== null && corpo.preco !== "") {
    return baseDoPrecoDoCliente(numeroEscrito(corpo.preco), taxas, modelo) ?? Number.NaN;
  }
  return numeroEscrito(corpo.valor);
}

/*
 * ── OS DOIS NÚMEROS, SEM E COM IVA — 03-10-2026 ────────────────────────────
 *
 * *«Quero que mostre o valor sem IVA e o valor com IVA, para o cliente saber o
 * que está pagando.»* — o dono, a olhar para «361,62 € IVA incluído» no cartão
 * de uma proposta e na mensagem de WhatsApp.
 *
 * O preço que se paga continua a ser UM: o com IVA. O sem IVA vai ao lado a
 * dizer de que é feito — e é dito sempre como parte do outro («294,00 € +
 * IVA = 361,62 €»), nunca sozinho: um número sem IVA solto numa mensagem é
 * o que o cliente arrisca responder quando lhe perguntam quanto quer pagar.
 * Pela mesma razão, a pergunta passa a dizer «(com IVA)» — ver
 * `comIvaNaResposta`.
 *
 * Antes do corte do IVA incluído a regra é a de sempre: o número é o sem IVA,
 * e quem chama já diz o que acresce com factura.
 */

const emEuros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const IVA_EM_PERCENTAGEM = `${Math.round(TAXA_IVA * 100)} %`;

/** «294,00 € + 67,62 € de IVA (23 %)» — de que é feito um preço com IVA incluído. */
export function desdobramentoDoIva(conta: Pick<ContaDoCliente, "semIva" | "iva">): string {
  return `${emEuros(conta.semIva)} + ${emEuros(conta.iva)} de IVA (${IVA_EM_PERCENTAGEM})`;
}

/**
 * «294,00 € + IVA = 361,62 €» — os dois números numa linha só, para as listas
 * de propostas. Antes do corte, só o número sem IVA, como sempre foi.
 */
export function semEComIva(conta: Pick<PrecoDoCliente, "semIva" | "total" | "ivaIncluido">): string {
  return conta.ivaIncluido
    ? `${emEuros(conta.semIva)} + IVA = ${emEuros(conta.total)}`
    : emEuros(conta.semIva);
}

/**
 * « (com IVA)» depois de «o valor que gostaria de pagar» — só no modelo novo.
 *
 * Com o sem IVA à vista ao lado do preço, a resposta podia vir nesse; e é
 * lida como um preço com IVA (`baseDoPrecoDoCliente`). Antes do corte o
 * número que se lhe diz é o sem IVA, e é nesse que ele responde — a frase
 * fica a de sempre.
 */
export function comIvaNaResposta(modelo: ModeloDoPreco): string {
  return temIvaIncluido(modelo) ? " (com IVA)" : "";
}
