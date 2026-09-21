import { comoTratar } from "./whatsapp-recolha";
import { servicoEmPalavras } from "./servico-em-palavras";
import { euros } from "./texto-da-mesa";
import { quantoOProfissionalRecebe, type Taxas } from "./taxas-plataforma";
import { precoComBase, type BaseDoPreco } from "./base-do-preco";

/**
 * «UM PEDIDO NOVO» — no telemóvel, e não só no email.
 *
 * "Vamos criar uma funcionalidade para sempre que publicarmos um pedido /
 *  enviar aos profissionais o assistente enviar mensagens no wpp para os pro
 *  falando sobre o pedido novo com localidade e descrição e valor estimativa,
 *  a mensagem deve ser claro que e o assistente de pedidos que enviou da
 *  clyon" — 20-09-2026.
 *
 * O TERCEIRO AVISO DO MESMO ACONTECIMENTO, e é de propósito. Quando um pedido
 * chega a um profissional, a distribuição já manda um email e já toca o
 * telemóvel por push. O problema nunca foi ele não ser avisado — é os dois
 * avisos caírem onde ele não olha: o email fica por abrir uma hora, e o push
 * só existe para quem deu permissão no navegador, que hoje são poucos. O
 * WhatsApp é onde ele está.
 *
 * ── PORQUE É QUE ISTO É UM FICHEIRO SÓ COM O TEXTO ────────────────────────
 *
 * Porque o texto é a funcionalidade. A mecânica — a fila, o horário, o
 * interruptor — é encanamento e está noutro sítio; o que decide se um homem
 * ao volante larga o que está a fazer e vai propor é esta meia dúzia de
 * linhas. Separadas, testam-se sem base de dados nenhuma.
 *
 * ── AS REGRAS QUE ESTE TEXTO CUMPRE, E PORQUÊ ─────────────────────────────
 *
 * 1. DIZ QUEM ESCREVE, NA PRIMEIRA LINHA. Foi o que o dono pediu e é o que a
 *    situação exige: chega de um número que nunca lhe escreveu, sobre dinheiro.
 *    Sem nome à frente é indistinguível de burla — e é assim que se ensina um
 *    profissional a bloquear o número da CLYON.
 *
 *    ⚠️ ISTO NÃO CONTRADIZ A DECISÃO DE 10-09-2026 («não quero que ele fale
 *    que é o assistente com essa mensagem engessada»), e as duas ficam escritas
 *    lado a lado para que ninguém desfaça uma sem ver a outra. Essa decisão é
 *    sobre o CLIENTE, a meio de uma conversa que ele começou, onde anunciar-se
 *    a cada mensagem é um tique de robô. Esta é a PRIMEIRA palavra dita a um
 *    PROFISSIONAL que não pediu nada. São situações opostas.
 *
 * 2. NUNCA A MORADA, NUNCA O TELEFONE DO CLIENTE. Nesta fase o profissional vê
 *    a localidade e mais nada — a regra é a mesma do painel dele e não se abre
 *    uma excepção por o canal ser outro.
 *
 * 3. O VALOR É O DELE, LÍQUIDO E SEM IVA. Não o que o cliente indicou, não o
 *    preço do simulador: o que lhe fica na mão depois da comissão, calculado
 *    com a taxa GRAVADA naquela negociação. É o mesmo número que o painel lhe
 *    mostra como «valor CLYON», e tem de ser o mesmo — um profissional que
 *    recebe 94 € no WhatsApp e lê 89 € no painel não volta a acreditar em
 *    nenhum dos dois.
 *
 * 4. E RESPEITA A BASE DO PREÇO. «94,00 €» num trabalho combinado por carga é
 *    mentir por três cargas. Passa por `precoComBase`, como em todo o lado.
 *
 * 5. SEM VALOR, NÃO INVENTA UM. A coluna admite nulo e o backoffice cria
 *    pedidos assim. Nunca sai «0,00 €», que se lê como trabalho de graça.
 *
 * 6. DIZ COMO SE SAI. A frase do «parar» não é cortesia: é o que separa um
 *    aviso de uma mensagem não solicitada, e é a razão pela qual o número
 *    sobrevive.
 */

/** O que a mensagem precisa de saber. Tudo já existe no momento da distribuição. */
export type PedidoParaAvisar = {
  pedidoId: number;
  /** A localidade. NUNCA a morada. */
  localidade: string | null;
  servico: string | null;
  descricao: string | null;
  urgencia: string | null;
  /** O valor de partida do cliente, em euros. Nulo quando o pedido não tem. */
  valorDesejadoCliente: number | null;
  /** Por trabalho ou por carga — muda o que o número quer dizer. */
  baseDoPreco: BaseDoPreco;
  /** As taxas gravadas NAQUELA negociação, não as de hoje. */
  taxas: Taxas;
  /** Distância rodoviária à base dele, quando foi medida. */
  distanciaKm: number | null;
  /** O endereço completo do pedido no painel dele. */
  link: string;
};

/**
 * A DESCRIÇÃO DO CLIENTE, DOMADA.
 *
 * Chega como ele a escreveu: pode ter novecentos caracteres, pode ter mudanças
 * de linha a mais, pode estar vazia.
 *
 * O CORTE É NA PALAVRA e não a meio dela, porque «dois sofás e uma mes…» faz o
 * leitor parar a tentar adivinhar em vez de carregar no link.
 */
export function descricaoParaOAviso(
  bruta: string | null | undefined,
  maximo = 180,
): string | null {
  if (typeof bruta !== "string") return null;
  const limpa = bruta.replace(/\s+/g, " ").trim();
  if (!limpa) return null;
  if (limpa.length <= maximo) return limpa;
  const cortada = limpa.slice(0, maximo);
  const espaco = cortada.lastIndexOf(" ");
  const fim = espaco > maximo * 0.6 ? cortada.slice(0, espaco) : cortada;
  return `${fim.trimEnd()}…`;
}

/**
 * A URGÊNCIA, em três palavras ou nenhuma.
 *
 * Só sai quando muda a decisão dele. «Sem pressa» não muda nada e ocupa uma
 * linha que o pedido precisa — quem tem a agenda cheia não é por ler «sem
 * pressa» que a desocupa.
 */
export function urgenciaParaOAviso(u: string | null | undefined): string | null {
  const v = (u ?? "").toLowerCase();
  if (v.includes("hoje") || v.includes("urgente")) return "É para hoje.";
  if (v.includes("amanh")) return "É para amanhã.";
  return null;
}

/** «A cerca de 7 km da sua base.» — ou nada, quando ninguém mediu. */
export function distanciaParaOAviso(km: number | null | undefined): string | null {
  if (typeof km !== "number" || !Number.isFinite(km) || km < 0) return null;
  return `A cerca de ${Math.round(km)} km da sua base.`;
}

/**
 * O QUE ELE RECEBERIA — ou a verdade de que ainda não há número.
 *
 * Devolve a frase inteira, e não só o valor, porque as duas situações não têm
 * a mesma forma: uma diz quanto, a outra diz que a proposta é dele.
 */
export function valorParaOAviso(p: PedidoParaAvisar): string {
  const v = p.valorDesejadoCliente;
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
    return "Este pedido ainda não tem valor de partida: a proposta é sua.";
  }
  const liquido = euros(quantoOProfissionalRecebe(v, p.taxas));
  return (
    `Receberia ${precoComBase(liquido, p.baseDoPreco)}, já com a taxa CLYON ` +
    "descontada e sem IVA. Pode propor outro."
  );
}

/** A frase de saída. É uma constante porque a rota da ponte tem de a reconhecer. */
export const COMO_SE_SAI = "Para deixar de receber estes avisos, escreva parar.";

/** A palavra que o faz parar. Em minúsculas e sem acentos — é assim que se compara. */
export const PALAVRA_PARA_PARAR = "parar";

/**
 * Ele quer deixar de receber isto?
 *
 * GENEROSO DE PROPÓSITO. Quem escreve «parar» está irritado, e a última coisa
 * que se lhe deve fazer é exigir-lhe a palavra exacta: «PARAR», «parar.»,
 * «parem», «pára» e «stop» são todos a mesma pessoa a dizer a mesma coisa. Um
 * opt-out que falha por causa de um ponto final é um opt-out que não existe, e
 * a pessoa passa da irritação para a queixa.
 *
 * MAS SÓ QUANDO É A MENSAGEM TODA. «não quero parar agora, mando proposta
 * logo» tem lá a palavra e é o contrário do pedido. Exigir que a mensagem
 * inteira seja a palavra é o que separa uma coisa da outra sem adivinhar nada.
 */
export function ePedidoParaParar(texto: string | null | undefined): boolean {
  if (typeof texto !== "string") return false;
  const limpo = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return limpo === "parar" || limpo === "parem" || limpo === "para" || limpo === "stop";
}

/**
 * A mensagem, inteira.
 *
 * Quatro blocos separados por linha em branco, porque é assim que se lê num
 * telemóvel: quem escreve, o que é, o que o cliente disse, e o que fazer a
 * seguir. Tudo o que é condicional cai por inteiro em vez de deixar um espaço
 * a mais — daí o `filter(Boolean)`.
 */
export function avisoDePedidoAoProfissional(
  nomeDoProfissional: string | null,
  p: PedidoParaAvisar,
  agora: Date,
): string {
  const abertura =
    `${comoTratar(nomeDoProfissional, agora)} Aqui é a CLYON. ` +
    "Quem lhe escreve é o assistente de pedidos.";

  const onde = p.localidade ? `Pedido novo em ${p.localidade}` : "Pedido novo";
  const oQueE = [
    `${onde}: ${servicoEmPalavras(p.servico)} (#${p.pedidoId}).`,
    urgenciaParaOAviso(p.urgencia),
    distanciaParaOAviso(p.distanciaKm),
    valorParaOAviso(p),
  ]
    .filter(Boolean)
    .join(" ");

  const descricao = descricaoParaOAviso(p.descricao);
  const oQueOClienteDisse = descricao ? `O cliente escreveu: ${descricao}` : null;

  const fecho =
    `Fotografias e proposta: ${p.link}\n` +
    "O orçamento é feito pela descrição e pelas fotografias, e confirma-se no local. " +
    COMO_SE_SAI;

  return [abertura, oQueE, oQueOClienteDisse, fecho].filter(Boolean).join("\n\n");
}
