import { primeiroNome } from "./mensagem-whatsapp";
import { nomeDitoPelaEquipa, oQueRespondeAEquipa } from "./o-que-a-equipa-ja-disse";
import { perguntaDo, primeiroPassoEmFalta, type EstadoDaRecolha, type RespostaDaRecolha } from "./whatsapp-recolha";

/**
 * A RECOLHA, COM O QUE A EQUIPA JÁ DISSE — 16-11-2026 (d51, acrescento do dono).
 *
 * Antes de a Vitória ler a mensagem:
 *   · o nome que um colega já lhe chamou («Boa tarde, Anselmo!», «senhor
 *     Anselmo») — ou o de um pedido anterior do número — não se pergunta;
 *   · a resposta curta à pergunta do colega («O material é entulho? se sim
 *     quantos sacos?» → «Sim são 15 sacos») fica como o simulador a grava —
 *     recolha de entulho, «15 sacos» — e segue-se para a pergunta que falta.
 *     Lida pela recolha de sempre, «Sim são 15 sacos» ia para a morada.
 * Puro: quem lê a base é `whatsapp-negociacao.ts`.
 */

/** O nome que já se sabe, para a recolha não o perguntar. */
export function comONomeJaSabido(
  e: EstadoDaRecolha,
  fio: ReadonlyArray<{ direccao?: string; texto?: string; haSegundos?: number | null }> | null | undefined,
  doNumero: string | null | undefined,
): EstadoDaRecolha {
  if (e.dados.contactName) return e;
  const nome = nomeDitoPelaEquipa(fio) ?? (doNumero?.trim() || null);
  if (!nome) return e;
  const dados = { ...e.dados, contactName: nome };
  // Se a pergunta em cima era o nome, passa-se à seguinte.
  return { passo: e.passo === "nome" ? primeiroPassoEmFalta(dados) : e.passo, dados };
}

/** Uma resposta curta — a resposta a uma pergunta, e não uma mensagem com mais coisas. */
function curta(texto: string): boolean {
  return texto.trim().split(/\s+/).length <= 8 && !texto.includes("\n");
}

/**
 * A RESPOSTA À PERGUNTA DO COLEGA, sem passar pela leitura de sempre — ou
 * `null`, e lê-se como sempre.
 */
export function responderAoColega(
  e: EstadoDaRecolha,
  texto: string,
  fio: ReadonlyArray<{ direccao?: string; texto?: string; haSegundos?: number | null }> | null | undefined,
): RespostaDaRecolha | null {
  if (!curta(texto)) return null;
  const campos = oQueRespondeAEquipa(fio, texto);
  if (!campos.serviceType && !campos.entulhoQuantidade) return null;
  const dados = { ...e.dados };
  if (campos.serviceType && (!dados.serviceType || dados.serviceType === "outro")) dados.serviceType = campos.serviceType;
  // Os sacos só são do entulho: noutro serviço ficam no que ele disse.
  if (campos.entulhoQuantidade && dados.serviceType === "recolha_entulho" && !dados.entulhoQuantidade) {
    dados.entulhoQuantidade = campos.entulhoQuantidade;
    if (!dados.volumeDito) dados.volumeDito = campos.entulhoQuantidade;
  }
  if (JSON.stringify(dados) === JSON.stringify(e.dados)) return null;
  const passo = primeiroPassoEmFalta(dados);
  const nome = primeiroNome(dados.contactName);
  const oQue = [
    dados.serviceType === "recolha_entulho" && !e.dados.serviceType ? "recolha de entulho" : null,
    dados.entulhoQuantidade && !e.dados.entulhoQuantidade ? dados.entulhoQuantidade : null,
  ]
    .filter(Boolean)
    .join(", ");
  const obrigada = `Obrigada${nome ? `, ${nome}` : ""}! Fica anotado${oQue ? `: ${oQue}` : ""}.`;
  return { estado: { passo, dados }, resposta: `${obrigada} ${perguntaDo(passo, dados, false)}` };
}
