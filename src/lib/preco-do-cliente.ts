import { contaDoCliente, TAXAS_DE_ORIGEM, type Taxas } from "./taxas-plataforma";

/**
 * O PREÇO QUE O CLIENTE VÊ — UM NÚMERO SÓ, JÁ COM A TAXA CLYON.
 *
 * "Vamos mudar como cobramos para simplificar tudo: invés de cobrar 5 % do
 *  cliente depois, vamos apresentar o valor proposto já com a taxa. Ex.: o pro
 *  propôs 350, para o cliente vai aparecer 367,5 que foi proposto, para o pro
 *  327,08 — assim a CLYON mantém-se a ganhar os 11 %." — 29-09-2026.
 *
 * O QUE NÃO MUDOU: o valor da negociação continua a ser o do profissional. É
 * ele que se grava nas propostas e no `valorAcordado`, e é sobre ele que se
 * fazem a carteira, as facturas e a referência do euPago. O que mudou foi o
 * que se MOSTRA ao cliente: em vez de «350 € mais a taxa CLYON, 367,50 € a
 * pagar», diz-se «367,50 €». Uma conta a menos para ele fazer, e um número a
 * menos para ele repetir errado ao profissional.
 *
 * O que ele ESCREVE é também um preço dele. «Posso pagar 300» quer dizer 300 a
 * sair da carteira — e não 300 mais a taxa, que era como se lia até aqui.
 * `baseDoPrecoDoCliente` faz a volta, antes de a proposta chegar ao motor.
 *
 * Sem dependências de servidor: o ecrã do cliente importa isto.
 */

/** O que o cliente paga, sem IVA, por um valor do profissional. */
export function precoParaOCliente(valorDoProfissional: number, taxas?: Taxas): number {
  return contaDoCliente(valorDoProfissional, taxas ?? TAXAS_DE_ORIGEM).semIva;
}

/**
 * O valor do profissional que corresponde a um preço dito pelo cliente.
 *
 * NEM TODOS OS CÊNTIMOS TÊM VOLTA. A taxa arredonda ao cêntimo, e por isso há
 * preços a que nenhum valor chega: com 5 %, 238,09 € dá 249,99 € e 238,10 € dá
 * 250,01 € — os 250,00 € ficam no meio. Acontece a um preço redondo em cada
 * vinte e um. Nesses casos fica o de baixo: o cliente nunca passa a pagar mais
 * do que escreveu, e quem chama mostra-lhe o número que ficou
 * (`precoPossivel`).
 *
 * `null` para um preço que não é preço nenhum — zero, negativo, lixo.
 */
export function baseDoPrecoDoCliente(preco: number, taxas?: Taxas): number | null {
  if (!Number.isFinite(preco) || preco <= 0) return null;
  const t = taxas ?? TAXAS_DE_ORIGEM;
  const alvo = Math.round((preco + Number.EPSILON) * 100) / 100;
  /*
   * Em cêntimos inteiros, para a descida não acumular o erro de somar 0,01
   * em vírgula flutuante. A resposta está a um cêntimo do aproximado, dois
   * no máximo; começa-se acima e desce-se até caber.
   */
  const aproximado = Math.round((alvo / (1 + t.cliente)) * 100);
  for (let c = aproximado + 2; c >= Math.max(1, aproximado - 3); c--) {
    const base = c / 100;
    if (precoParaOCliente(base, t) <= alvo + 1e-9) return base;
  }
  return null;
}

/**
 * O preço que fica depois da volta — o escrito, em vinte casos em vinte e um,
 * e um cêntimo abaixo no que sobra. É ESTE que se mostra ao cliente antes de
 * ele carregar em propor, e depois na confirmação.
 */
export function precoPossivel(preco: number, taxas?: Taxas): number | null {
  const base = baseDoPrecoDoCliente(preco, taxas);
  return base == null ? null : precoParaOCliente(base, taxas);
}

/** «300», «300,5», 300 — como chega de um corpo de pedido. */
function numeroEscrito(v: unknown): number {
  return typeof v === "string" ? Number(v.trim().replace(",", ".")) : Number(v);
}

/**
 * O VALOR QUE ENTRA NO MOTOR, a partir do que o ecrã do cliente mandou.
 *
 * O ecrã de agora manda `preco` — o que o cliente escreveu, que é o que ele
 * paga — e aqui vira o valor do profissional. Um ecrã aberto ANTES de
 * 29-09-2026 ainda manda `valor`, que nessa altura já era o do profissional
 * («Se ele aceitar, paga X com a taxa CLYON»): lê-se como sempre se leu, e a
 * proposta sai como ele a viu escrita.
 *
 * NaN quando não há número — o motor responde «Indique um valor.».
 */
export function valorDaPropostaDoCliente(
  corpo: { preco?: unknown; valor?: unknown },
  taxas?: Taxas,
): number {
  if (corpo.preco !== undefined && corpo.preco !== null && corpo.preco !== "") {
    return baseDoPrecoDoCliente(numeroEscrito(corpo.preco), taxas) ?? Number.NaN;
  }
  return numeroEscrito(corpo.valor);
}
