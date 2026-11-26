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
  const lida = comOAvisoParaOParceiro(await contexto.lerOTexto(estado), texto);
  const comAnuncio = perguntarPeloAnuncio({ ...lida, estado: comOAnuncio(lida.estado, textos) }, agora);
  return comOQueAEmpresaPrecisa(perguntarSeEUmEsvaziamento(comAnuncio, textos, agora), textos);
}

/*
 * O AVISO DELE PARA O PARCEIRO — d129 (26-11-2026), o #688. «Cuidado: na rua
 * também há o lote 32» não responde a pergunta nenhuma e perdia-se; é o que o
 * parceiro precisa de ler à porta. Vai para as notas do pedido (tal e qual, as
 * observações que o parceiro lê — `descricaoOrganizada`), pelos dois caminhos.
 */
const AVISO_PARA_O_PARCEIRO =
  /(?:^|[\s,.;!])(?:cuidado|aten[cç][aã]o|aten[cç][aã]o\s+que|nota|aviso|importante|n[aã]o\s+confundir|n[aã]o\s+confunda)\b\s*[:,!-]?|\b(?:tamb[eé]m\s+h[aá]\s+(?:o|a|um|uma)\s+(?:lote|n[uú]mero|n\.?º|porta|pr[eé]dio|bloco)|h[aá]\s+dois\s+(?:lotes|n[uú]meros|pr[eé]dios|blocos))\b/i;

/** A mensagem é (ou traz) um aviso para quem vai fazer o trabalho? */
export function eAvisoParaOParceiro(texto: string | null | undefined): boolean {
  const t = String(texto ?? "").trim();
  return t.length > 0 && t.length <= 400 && AVISO_PARA_O_PARCEIRO.test(t);
}

/** Junta o aviso às notas do rascunho, tal e qual, uma vez. */
export function comOAvisoParaOParceiro(r: RespostaDaRecolha, texto: string): RespostaDaRecolha {
  if (!eAvisoParaOParceiro(texto)) return r;
  const n = texto.replace(/\s+/g, " ").trim().slice(0, 300);
  const notas = r.estado.dados.notas ?? [];
  if (notas.includes(n)) return r;
  return { ...r, estado: { ...r.estado, dados: { ...r.estado.dados, notas: [...notas, n].slice(-10) } } };
}
