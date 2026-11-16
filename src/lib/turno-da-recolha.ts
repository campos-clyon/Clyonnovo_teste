import { comOAnuncio, perguntarPeloAnuncio } from "./anuncio-na-recolha";
import {
  comOQueAEmpresaPrecisa,
  perguntarSeEUmEsvaziamento,
  responderAoEsvaziamento,
  semAPerguntaDoEsvaziamento,
} from "./esvaziamento-na-recolha";
import { responderAoOrcamentoAMeio } from "./orcamento-a-meio";
import type { EstadoDaRecolha, RespostaDaRecolha } from "./whatsapp-recolha";

/*
 * UM TURNO DA RECOLHA, À VOLTA DA LEITURA DE SEMPRE — 16-11-2026 (d48).
 *
 * O que `recolherPedidoPorWhatsApp` faz a cada mensagem com palavras, pela
 * ordem, num sítio só (e o mesmo que o teste da conversa corre):
 *
 *   1. o link do anúncio da casa, no que ainda está vazio (`comOAnuncio`);
 *   2. a resposta à pergunta do esvaziamento, se estava pendente;
 *   3. «Orçamento» sozinho a meio: de onde vem o preço, e basta a zona;
 *   4. a leitura de sempre (o modelo, ou as regras) — `lerOTexto`;
 *   5. depois dela, a pergunta do anúncio ou a do «parece um esvaziamento»
 *      no lugar da pergunta seguinte, e o que o esvaziamento de empresa grava.
 */
export async function responderAoTurno(
  e: EstadoDaRecolha,
  texto: string,
  agora: Date,
  contexto: {
    /** O que ele escreveu nesta recolha, com a mensagem de agora no fim. */
    textos: readonly string[];
    fotos?: number;
    jaExplicouOPreco?: boolean;
    lerOTexto: (e: EstadoDaRecolha) => RespostaDaRecolha | Promise<RespostaDaRecolha>;
  },
): Promise<RespostaDaRecolha> {
  const textos = contexto.textos;
  let estado = comOAnuncio(e, textos);
  const aoEsvaziamento = responderAoEsvaziamento(estado, texto, agora, textos);
  if (aoEsvaziamento) return aoEsvaziamento;
  estado = semAPerguntaDoEsvaziamento(estado);
  const aoOrcamento = responderAoOrcamentoAMeio(estado, texto, agora, {
    fotos: contexto.fotos,
    jaExplicouOPreco: contexto.jaExplicouOPreco,
  });
  if (aoOrcamento) return aoOrcamento;
  const lida = await contexto.lerOTexto(estado);
  const comAnuncio = perguntarPeloAnuncio({ ...lida, estado: comOAnuncio(lida.estado, textos) }, agora);
  return comOQueAEmpresaPrecisa(perguntarSeEUmEsvaziamento(comAnuncio, textos, agora), textos);
}
