import { comoTratar } from "./whatsapp-recolha";
import { servicoEmPalavras } from "./servico-em-palavras";
import { diaEmLisboa } from "./hora-de-lisboa";
import { quandoPorExtenso } from "./aviso-de-data-ao-cliente";

/**
 * «A CLYON MUDOU O DIA DO SEU TRABALHO» — o WhatsApp ao profissional.
 *
 * *«Avise também o profissional quando a data mudar.»* — 01-10-2026.
 *
 * Só quando foi a CLYON a mudar (o arrasto ou a ficha do backoffice): o que
 * ele próprio marcou no painel, já sabe. A volta de mudanças e o «antes era»
 * dele estão em `proximaVolta`, em `aviso-de-data-ao-cliente.ts`.
 *
 * CHEGA A TODOS OS QUE TÊM O TRABALHO — mesmo a quem nunca ligou os avisos
 * no painel, e mesmo a quem escreveu «parar». Perguntado ao dono no próprio
 * dia, com as três hipóteses à frente, escolheu *«Todos, sem excepção»*: não
 * é um pedido novo a oferecer-lhe trabalho, é o dia do trabalho que ele já
 * aceitou, mudado por outra pessoa. Por isso a mensagem NÃO diz «escreva
 * parar» — aqui não pararia nada, e dizê-lo era mentir-lhe.
 *
 * Quem continua a mandar é o interruptor «Avisar o profissional», do dono.
 *
 * O QUE LEVA: o número do pedido, o serviço e onde (é o que se diz ao ligar à
 * CLYON), o dia novo e o de antes, e se o cliente já foi avisado — para ele não
 * ligar ao cliente a dar uma notícia que o cliente já tem.
 */
export function textoDoAvisoDeDataAoProfissional(
  t: {
    pedidoId: number;
    profissional: string | null;
    servico: string | null;
    localidade: string | null;
    /** O dia que ele sabia. `null` quando ainda não havia dia nenhum. */
    antes: Date | null;
    depois: Date;
    /** O aviso ao cliente saiu nesta mesma passagem. */
    clienteJaSabe: boolean;
  },
  agora: Date,
): string {
  const abertura = `${comoTratar(t.profissional, agora)} Aqui é a CLYON — aviso de agenda.`;
  const onde = t.localidade?.trim() ? `, ${t.localidade.trim()}` : "";
  const doTrabalho = `do trabalho #${t.pedidoId} (${servicoEmPalavras(t.servico)}${onde})`;

  let oQue: string;
  if (!t.antes) {
    oQue = `A CLYON marcou o dia ${doTrabalho}: ${quandoPorExtenso(t.depois, agora)}.`;
  } else if (diaEmLisboa(t.antes) === diaEmLisboa(t.depois)) {
    oQue =
      `A CLYON mudou a hora ${doTrabalho}: fica para ${quandoPorExtenso(t.depois, agora)} ` +
      `(antes era ${quandoPorExtenso(t.antes, agora, true)}).`;
  } else {
    oQue =
      `A CLYON mudou o dia ${doTrabalho}: fica para ${quandoPorExtenso(t.depois, agora)} ` +
      `(antes era ${quandoPorExtenso(t.antes, agora)}).`;
  }

  const cliente = t.clienteJaSabe ? "O cliente também já foi avisado." : null;
  const fecho = "Se não puder neste dia, avise a CLYON quanto antes.";

  return [abertura, [oQue, cliente].filter(Boolean).join(" "), fecho].join("\n\n");
}
