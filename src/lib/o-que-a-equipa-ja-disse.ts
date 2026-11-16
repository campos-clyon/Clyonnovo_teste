import { semAcentos } from "./leitor-da-recolha";
import { eDaEquipa, semMarcaDeMao } from "./rajada-do-whatsapp";

/**
 * O QUE A CLYON JÁ DISSE NESTE FIO — 16-11-2026 (decisão d51, acrescento do
 * dono).
 *
 * O caso (nome e moradas inventados): a conversa foi apagada na Mesa do
 * WhatsApp; um colega escreveu à mão «Boa tarde, Anselmo!», «O material é
 * entulho? se sim quantos sacos?» e «Qual é o endereço senhor Anselmo?». O
 * cliente respondeu «Sim são 15 sacos» e a morada — e a Vitória, quando a
 * conversa lhe passou, abriu com «Boa tarde! Aqui é a Vitória, assistente
 * online da CLYON…», anotou só «recolha de entulho» e perguntou «Com quem
 * tenho o gosto de falar?».
 *
 * Três regras, puras:
 *   · `jaFalouComEle` — a CLYON já lhe escreveu: não se apresenta outra vez;
 *   · `nomeDitoPelaEquipa` — o nome que a equipa já usou («Boa tarde,
 *     Anselmo!», «senhor Anselmo») não se pergunta;
 *   · `oQueRespondeAEquipa` — a resposta à pergunta do colega («O material é
 *     entulho? quantos sacos?» → «Sim são 15 sacos») fica no pedido como o
 *     simulador grava: recolha de entulho, «15 sacos».
 */

type MensagemDoFio = { direccao?: string; texto?: string; haSegundos?: number | null };

/** Os últimos 30 dias: uma conversa de há três meses já não é «esta conversa». */
export const DIAS_DE_CONVERSA = 30;

function recente(m: MensagemDoFio): boolean {
  return m.haSegundos == null || m.haSegundos <= DIAS_DE_CONVERSA * 24 * 3600;
}

/**
 * UM AVISO AUTOMÁTICO — o «Pedido #N registado», o «Recebemos o seu pedido»
 * que sai sozinho, uma proposta que chegou. Não é ninguém a falar com ele.
 */
function eAvisoAutomatico(texto: string): boolean {
  const t = semAcentos(texto);
  return (
    /\bpedido\s+(?:n\.?\s*[ºo]\s*)?#?\s?\d+\b[^.]{0,60}\b(?:registad|recebid)/.test(t) ||
    /\brecebemos o seu pedido\b/.test(t) ||
    /\b(?:nova\s+)?proposta\s+d[eo]\b/.test(t)
  );
}

/**
 * A CLYON JÁ FALOU COM ELE NESTE FIO? A apresentação («Aqui é a Vitória / a
 * CLYON»), como sempre; ou qualquer mensagem que lhe saiu nos últimos 30 dias
 * — de uma pessoa da equipa (à mão no telemóvel ou pelo backoffice) ou da
 * Vitória a meio de uma conversa cuja apresentação já ficou para trás das
 * vinte do fio.
 *
 * Os avisos automáticos (o «Pedido #N registado» do simulador, uma proposta)
 * NÃO contam: quem só recebeu um aviso nunca falou com ninguém, e ouve a
 * Vitória dizer quem é — é a vez em que fica a saber que fala com a
 * assistente online. Um aviso escrito à mão por um colega (a marca «[à mão]»)
 * conta sempre.
 */
export function jaFalouComEle(fio: ReadonlyArray<MensagemDoFio> | null | undefined): boolean {
  if (!Array.isArray(fio)) return false;
  const saidas = fio.filter((m) => m?.direccao === "out" && typeof m.texto === "string" && m.texto.trim());
  if (saidas.some((m) => /aqui e a (clyon|vitoria)/.test(semAcentos(m.texto!)))) return true;
  return saidas.filter(recente).some((m) => eDaEquipa(m.texto!) || !eAvisoAutomatico(m.texto!));
}

/** As palavras que vêm depois de «Olá» e não são um nome. */
const NAO_E_NOME =
  /^(?:cliente|senhor|senhora|sr|sra|dona|clyon|vitoria|tudo|como|obrigad[oa]|bom|boa|ola|desde|aqui|recebemos|e|o|a|pode|sim|nao|equipa|caro|cara|amigo|amiga)$/;

const NOME = "([A-ZÀ-Ý][a-zà-ÿ'’]+(?:[ \\t]+(?:d[aeo]s?[ \\t]+)?[A-ZÀ-Ý][a-zà-ÿ'’]+)?)";
const PELO_CUMPRIMENTO = new RegExp(
  `(?:^|[\\s,.!?])(?:Ol[áa]|Oi|Bom dia|Boa tarde|Boa noite)[ \\t]*[,!]?[ \\t]+(?:(?:[Ss]enhor|[Ss]enhora|[Ss]r\\.?|[Ss]ra\\.?|[Dd]ona|D\\.)[ \\t]+)?${NOME}`,
  "g",
);
const PELO_TRATAMENTO = new RegExp(`(?:^|[\\s,.!?])(?:[Ss]enhor|[Ss]enhora|[Ss]r\\.|[Ss]ra\\.|[Dd]ona)[ \\t]+${NOME}`, "g");

/**
 * O NOME QUE A EQUIPA JÁ LHE CHAMOU — «Boa tarde, Anselmo!», «Qual é o
 * endereço senhor Anselmo?», «Olá D. Rosa». Das mensagens que lhe saíram (à
 * mão, pelo backoffice, ou da Vitória, que o nome vem do pedido dele), a mais
 * recente primeiro.
 */
export function nomeDitoPelaEquipa(fio: ReadonlyArray<MensagemDoFio> | null | undefined): string | null {
  if (!Array.isArray(fio)) return null;
  for (let i = fio.length - 1; i >= 0; i--) {
    const m = fio[i];
    if (m?.direccao !== "out" || typeof m.texto !== "string" || !recente(m)) continue;
    const t = semMarcaDeMao(m.texto);
    for (const r of [PELO_TRATAMENTO, PELO_CUMPRIMENTO]) {
      for (const x of t.matchAll(r)) {
        const nome = x[1].trim();
        const primeiro = semAcentos(nome.split(/\s+/)[0]);
        if (!NAO_E_NOME.test(primeiro)) return nome;
      }
    }
  }
  return null;
}

/** A última mensagem que saiu antes das dele — a pergunta a que ele está a responder. */
function ultimaPerguntaDaEquipa(fio: ReadonlyArray<MensagemDoFio>): string | null {
  for (let i = fio.length - 1; i >= 0; i--) {
    const m = fio[i];
    if (m?.direccao !== "out") continue;
    if (typeof m.texto !== "string" || !recente(m) || eAvisoAutomatico(m.texto)) return null;
    const t = semMarcaDeMao(m.texto);
    return t.includes("?") ? t : null;
  }
  return null;
}

/**
 * A RESPOSTA À PERGUNTA DO COLEGA — o que ela diz, como o simulador o grava.
 * «O material é entulho? se sim quantos sacos?» → «Sim são 15 sacos»: recolha
 * de entulho, 15 sacos. Só quando a última mensagem que saiu é uma pergunta
 * (e não um aviso automático); o resto lê-se como sempre.
 *
 * A resposta citada (o «responder» do WhatsApp) chega como texto simples: a
 * pergunta citada é, quase sempre, esta última — é com ela que se lê.
 */
export function oQueRespondeAEquipa(
  fio: ReadonlyArray<MensagemDoFio> | null | undefined,
  texto: string,
): { serviceType?: "recolha_entulho"; entulhoQuantidade?: string } {
  if (!Array.isArray(fio) || !texto.trim()) return {};
  const pergunta = ultimaPerguntaDaEquipa(fio);
  if (!pergunta) return {};
  const p = semAcentos(pergunta);
  const t = semAcentos(texto);
  const saida: { serviceType?: "recolha_entulho"; entulhoQuantidade?: string } = {};
  const disseQueSim = /^\s*(?:sim|s|e|exacto|exato|isso|claro|certo)\b/.test(t) || /\bentulho\b/.test(t);
  const disseQueNao = /^\s*(?:nao|n)\b/.test(t);
  if (/\bentulho\b/.test(p) && disseQueSim && !disseQueNao) saida.serviceType = "recolha_entulho";
  if (/\bsacos?\b/.test(p) || /\bsacos?\b/.test(t)) {
    const n = /(?<![\d,.])(\d{1,4})(?:\s*(?:a|-|ou)\s*(\d{1,4}))?\s*(?:sacos?\b)?/.exec(t);
    if (n && (/\bsacos?\b/.test(t) || /\bsacos?\b/.test(p))) {
      saida.entulhoQuantidade = n[2] ? `${n[1]} a ${n[2]} sacos` : `${n[1]} ${n[1] === "1" ? "saco" : "sacos"}`;
    }
  }
  return saida;
}
