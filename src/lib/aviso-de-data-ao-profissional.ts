import { comoTratar } from "./whatsapp-recolha";
import { servicoEmPalavras } from "./servico-em-palavras";
import { diaEmLisboa } from "./hora-de-lisboa";
import { quandoPorExtenso } from "./aviso-de-data-ao-cliente";
import { COMO_SE_SAI } from "./aviso-de-pedido-ao-profissional";

/**
 * «A CLYON MUDOU O DIA DO SEU TRABALHO» — o WhatsApp ao profissional.
 *
 * *«Avise também o profissional quando a data mudar.»* — 01-10-2026.
 *
 * Só quando foi a CLYON a mudar (o arrasto ou a ficha do backoffice): o que
 * ele próprio marcou no painel, já sabe. A volta de mudanças e o «antes era»
 * dele estão em `proximaVolta`, em `aviso-de-data-ao-cliente.ts`.
 *
 * A MESMA FECHADURA DOS OUTROS AVISOS AO PROFISSIONAL: o interruptor «Avisar o
 * profissional» e o sim dele no painel (`whatsappAvisos`). «Parar» desliga
 * este como desliga os outros — é por isso que a mensagem diz como.
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
  const fecho = "Se não puder neste dia, avise a CLYON quanto antes.\n" + COMO_SE_SAI;

  return [abertura, [oQue, cliente].filter(Boolean).join(" "), fecho].join("\n\n");
}
