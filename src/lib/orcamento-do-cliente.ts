import { baseDoPrecoDoCliente } from "./preco-do-cliente";
import { temIvaIncluido, type ModeloDoPreco } from "./iva-incluido";
import type { Taxas } from "./taxas-plataforma";

/**
 * «QUANTO CONTA GASTAR?» — O NÚMERO DO CLIENTE, COM IVA, E O QUE O
 * PROFISSIONAL VÊ. 01-10-2026.
 *
 * "Quanto conta gastar? — Como preço com IVA." — decisão do dono, 01-10-2026.
 *
 * Com os preços a IVA incluído (`iva-incluido.ts`), o cliente lê todas as
 * propostas já com a taxa CLYON e com os 23 %. O número que ele escreve no
 * pedido tem de estar na mesma unidade: quem escreve 100 € está a dizer «quero
 * que me saia 100 € do bolso», e não «quero que o profissional receba 100 €»
 * — que lhe sairia em 129,15 €.
 *
 * O PROFISSIONAL, ESSE, CONTINUA A PENSAR SEM IVA. Propõe sem IVA e vê sem IVA
 * (`preco-do-cliente.ts`). Por isso o número do cliente faz a volta ANTES de
 * se gravar — `baseDoPrecoDoCliente`, a mesma volta das propostas que o
 * cliente escreve —, e o que fica em `simulatorOrders.valorDesejadoCliente` é o
 * valor do profissional: 100 € com IVA → 77,43 € (77,43 × 1,05 = 81,30;
 * × 1,23 = 100,00).
 *
 * PORQUE SE CONVERTE AO GRAVAR, E NÃO AO MOSTRAR. Aquela coluna já guardava
 * três coisas (o que o cliente escreveu, a nossa estimativa sem IVA, e a conta
 * da CLYON de uma promoção — ver `reenviar`), as duas últimas já em valor do
 * profissional. Decidir na leitura, pela data do pedido, convertia também as
 * estimativas — e 150 € de estimativa sem IVA apareciam ao profissional como
 * 116,14 €. Gravado já convertido, a coluna passa a querer dizer UMA coisa
 * («valor de partida, do lado do profissional») em todos os pedidos novos, e
 * nenhum dos sítios que a lê — distribuição, email e WhatsApp do aviso,
 * «recebe se aceitar», promover, recomeçar, o alcance — precisou de mudar.
 *
 * O QUE O CLIENTE ESCREVEU NÃO SE PERDE: fica em `valorDoClienteComIva`, para o
 * backoffice o ver tal como foi dito e para o email lho repetir.
 *
 * ANTES DO CORTE NADA MUDA. O modelo é o do momento em que o pedido é gravado
 * (`modeloDeHoje()`), e um pedido gravado antes de `IVA_INCLUIDO_DESDE` fica
 * com o número tal como foi escrito, como sempre ficou.
 */

export type ValoresDoOrcamento = {
  /** O que se grava em `valorDesejadoCliente` — o valor do profissional, sem IVA. */
  valorDesejadoCliente: number;
  /** O que o cliente escreveu, com IVA e taxa. Nulo antes do corte. */
  valorDoClienteComIva: number | null;
};

export function valoresDoQueOClienteEscreveu(
  escrito: number,
  taxas: Taxas | undefined,
  modelo: ModeloDoPreco,
): ValoresDoOrcamento {
  if (!temIvaIncluido(modelo)) return { valorDesejadoCliente: escrito, valorDoClienteComIva: null };
  /*
   * A volta fica no cêntimo DE BAIXO quando não há um valor exacto (ver
   * `baseDoPrecoDoCliente`): o profissional nunca vê um número que, com taxa e
   * IVA, passe do que o cliente disse.
   */
  const base = baseDoPrecoDoCliente(escrito, taxas, modelo);
  return {
    valorDesejadoCliente: base ?? escrito,
    valorDoClienteComIva: escrito,
  };
}

/**
 * COMO SE PERGUNTA, em cada modelo. Os dois formulários (o pedido da
 * plataforma e o simulador) dizem «com IVA» desde o corte — e só desde o
 * corte: até lá o número escrito ainda é o do profissional.
 */
export function perguntaDoOrcamento(modelo: ModeloDoPreco): {
  /** O rótulo curto do campo. */
  rotulo: string;
  /** A frase por baixo. */
  ajuda: string;
} {
  if (temIvaIncluido(modelo)) {
    return {
      rotulo: "Quanto conta pagar, com IVA",
      ajuda:
        "Escreva o que conta pagar no fim — com IVA e a taxa CLYON incluídos, como " +
        "as propostas lhe vão aparecer. Os profissionais vêem esse valor sem IVA e sem a taxa.",
    };
  }
  return {
    rotulo: "Valor desejado",
    ajuda: "É este o valor que os profissionais vêem.",
  };
}
