import { perguntaPeloPreco } from "./leitor-da-recolha";
import {
  deOutraForma,
  outraVez,
  perguntaDo,
  primeiroPassoEmFalta,
  type DadosDaRecolha,
  type EstadoDaRecolha,
  type PassoDaRecolha,
  type RespostaDaRecolha,
} from "./whatsapp-recolha";

/*
 * «ORÇAMENTO», A MEIO DA RECOLHA — 16-11-2026 (decisão d48).
 *
 *   VITÓRIA: Obrigada, fica anotado. Qual é a morada, por favor? Rua e número…
 *   CLIENTE: Orçamento
 *   VITÓRIA: Peço desculpa, não apanhei bem. Qual é a morada…
 *   CLIENTE: Orçamento
 *   (nada)
 *
 * Ele não deixou de responder: disse o que queria, duas vezes. Quem pergunta
 * pelo preço a meio ouve numa frase de onde vem o preço (das propostas dos
 * parceiros da zona) e o pouco que é preciso para as pedir — a zona e 2 ou 3
 * fotografias. A rua não é condição: com a zona, o pedido regista-se e vai aos
 * parceiros (localiza-se pela localidade), e a morada certa pede-se depois de
 * ele aceitar uma proposta. Ver `soAZona`.
 *
 * Só a pergunta do preço sozinha («Orçamento», «Preço?», «Quanto custa?»).
 * Uma mensagem com mais coisas («Rua das Flores 3, quanto custa?») lê-se como
 * sempre, e a nota do preço vai à frente da pergunta seguinte
 * (`notaDoPrecoPara`).
 *
 * Puro: chama-o a recolha do WhatsApp antes da leitura de sempre, e os testes.
 */

const semAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A mensagem é só a pergunta do preço — sem morada, sem coisas, sem números. */
export function soPedeOPreco(texto: string | null | undefined): boolean {
  const t = semAcentos(texto ?? "")
    .replace(/[?!.,;:)(]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.length > 80 || /\d/.test(t)) return false;
  const so =
    /^(e |entao |mas |e entao )?(o |um |os |qual (e )?o |quero (o |um )?|queria (o |um )?|preciso (de )?(um |do )?)?(orcamento|orcamentos|preco|precos|valor|valores|custo|quanto custa|quanto fica|quanto e|quanto sai)( (por favor|pf|pfv|se faz favor|sff|primeiro|antes))*$/;
  return so.test(t) || (perguntaPeloPreco(t) && t.split(" ").length <= 8);
}

/** Já se lhe disse, nesta conversa, como chega o preço — a primeira frase ou esta. */
export const COMO_SE_PEDE_O_PRECO = "O valor é dado pelos parceiros da sua zona, nas propostas que lhe chegam por aqui — grátis e sem compromisso.";

function oQueFalta(fotos: number, temZona: boolean): string {
  if (temZona && fotos > 0) return "Para as pedir já tenho a zona e as fotografias.";
  if (temZona) return "Para as pedir já tenho a zona; ajudam 2 ou 3 fotografias do que é para levar.";
  if (fotos > 0) return "Para as pedir só me falta a zona.";
  return "Para as pedir só preciso da zona e de 2 ou 3 fotografias do que é para levar.";
}

const A_RUA_FICA_PARA_DEPOIS = "A morada certa fica para quando aceitar uma proposta.";

/** A zona que já se tem, como se diz: «Mina de Água, Amadora», «Amadora», «2700-000». */
function aZona(d: DadosDaRecolha): string {
  if (d.anuncio?.localidade && d.anuncio.concelho && d.city === d.anuncio.concelho) {
    return `${d.anuncio.localidade}, ${d.anuncio.concelho}`;
  }
  return [d.postalCode, d.city].filter(Boolean).join(" ");
}

/** A pergunta da zona, quando ainda não há nenhuma. Lê-se como a do código postal (`passoDaPergunta`). */
export const PERGUNTA_DA_ZONA = "Em que zona é? Basta a localidade ou o código postal.";

/**
 * A RESPOSTA A «ORÇAMENTO» A MEIO DA RECOLHA, ou null quando a mensagem não é
 * só isso (ou a recolha ainda não sabe o serviço, ou já tem pedido).
 */
export function responderAoOrcamentoAMeio(
  estado: EstadoDaRecolha,
  texto: string,
  agora: Date,
  contexto: { fotos?: number; jaExplicouOPreco?: boolean } = {},
): RespostaDaRecolha | null {
  const passo: PassoDaRecolha = estado.passo;
  if (passo === "servico" || estado.dados.pedidoAberto != null) return null;
  if (!soPedeOPreco(texto)) return null;
  const fotos = Math.max(contexto.fotos ?? 0, estado.dados.fotosRecebidas ?? 0);
  const d: DadosDaRecolha = { ...estado.dados };
  const temZona = Boolean(d.city || d.postalCode);
  const explicacao = contexto.jaExplicouOPreco
    ? "Como lhe disse, o valor chega nas propostas dos parceiros da sua zona."
    : COMO_SE_PEDE_O_PRECO;

  if (passo === "morada" || passo === "codigoPostal") {
    d.soAZona = true;
    if (!temZona) {
      return {
        estado: { passo: "codigoPostal", dados: { ...d, saltados: [...new Set([...(d.saltados ?? []), "morada" as PassoDaRecolha])] } },
        resposta: `${explicacao} ${oQueFalta(fotos, false)} ${A_RUA_FICA_PARA_DEPOIS}\n\n${PERGUNTA_DA_ZONA}`,
      };
    }
    const seguinte = primeiroPassoEmFalta(d);
    return {
      estado: { passo: seguinte, dados: d },
      resposta: `${explicacao} ${oQueFalta(fotos, true)} Sigo com a zona (${aZona(d)}); ${A_RUA_FICA_PARA_DEPOIS.charAt(0).toLowerCase()}${A_RUA_FICA_PARA_DEPOIS.slice(1)}\n\n${perguntaDo(seguinte, d, false, agora)}`,
    };
  }

  // Noutra pergunta: a explicação, e a mesma pergunta por outras palavras.
  const pergunta = passo === "confirmar" ? outraVez("confirmar", d) : deOutraForma(passo, d);
  return {
    estado: { passo, dados: d },
    resposta: `${explicacao} ${oQueFalta(fotos, temZona)}\n\n${pergunta}`,
  };
}
