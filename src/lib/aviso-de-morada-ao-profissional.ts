import { comoTratar } from "./whatsapp-recolha";
import { servicoEmPalavras } from "./servico-em-palavras";

/**
 * «A CLYON MUDOU A MORADA DO SEU TRABALHO» — o WhatsApp ao profissional.
 *
 * *«Sim, avisa por WhatsApp»* — 07-10-2026, à pergunta «quando o trabalho já
 * está atribuído e mudas a data ou a morada, o profissional não recebe
 * aviso». A data tem o seu aviso (`aviso-de-data-ao-profissional.ts`); este é
 * o da morada, que não havia.
 *
 * Como o da data: só a quem já tem o trabalho, a todos (com ou sem os avisos
 * do painel ligados — é o trabalho que ele aceitou, mudado por outra pessoa),
 * sem «escreva parar», e com o interruptor «Avisar o profissional» do dono a
 * mandar.
 *
 * LEVA A MORADA NOVA POR EXTENSO. Ele já a via no painel desde que ficou com o
 * trabalho; quem lê isto pode estar na carrinha, e o que precisa é de saber
 * para onde ir.
 */
export function textoDoAvisoDeMoradaAoProfissional(
  t: {
    pedidoId: number;
    profissional: string | null;
    servico: string | null;
    localidade: string | null;
    /** A morada nova, quando foi ela que mudou. */
    morada: string | null;
    /** O destino novo de uma mudança, quando foi ele que mudou. */
    destino: string | null;
    link: string;
  },
  agora: Date,
): string {
  const abertura = `${comoTratar(t.profissional, agora)} Aqui é a CLYON — aviso de morada.`;
  const onde = t.localidade?.trim() ? `, ${t.localidade.trim()}` : "";
  const doTrabalho = `do trabalho #${t.pedidoId} (${servicoEmPalavras(t.servico)}${onde})`;

  const morada = t.morada?.trim();
  const destino = t.destino?.trim();
  let oQue: string;
  if (morada && destino) {
    oQue = `A CLYON mudou a morada e o destino ${doTrabalho}. Recolha em ${morada}; entrega em ${destino}.`;
  } else if (destino) {
    oQue = `A CLYON mudou o destino ${doTrabalho}: a entrega passa a ser em ${destino}.`;
  } else {
    oQue = `A CLYON mudou a morada ${doTrabalho}: passa a ser em ${morada ?? "—"}.`;
  }

  const fecho = `Está no seu painel: ${t.link}\nSe alguma coisa não bater certo, avise a CLYON quanto antes.`;
  return [abertura, oQue, fecho].join("\n\n");
}
