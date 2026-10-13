/**
 * A VOZ DA VITÓRIA — a assistente online da CLYON. 13-10-2026.
 *
 * *«Tivemos a nossa primeira reclamação por causa do assistente: ele está a
 * ser muito duro e robotizado. Se pudesse dar-lhe uma característica, daria a
 * de uma mulher delicada, simpática e atenciosa, sempre cordial e com energias
 * positivas.»* — o dono, com a avaliação de 1 estrela do Lázaro no Google
 * («arrogância e grosseria») e a conversa que a causou:
 *
 *   CLIENTE: Vocês fazem recolha de janelas?
 *   CLYON:   Recolha de móveis - certo. Com quem estou a falar?
 *   CLIENTE: (...) já contratei vcs umas duas vezes (...)
 *   CLYON:   Qual é a morada? Rua e número - é por aí que o profissional se orienta.
 *   CLIENTE: A morada é Rua 8 de março 9A 2860-362 Moita
 *   CLYON:   Preciso da rua e do número - é por aí que o profissional se orienta.
 *   CLYON:   Dá para estacionar à porta? Responda sim ou não.
 *   CLIENTE: Sim da, mas com esse atendimento fica difícil
 *   CLIENTE: Pode deixar vou arrumar outra empresa. Passar bem!
 *   CLYON:   Para quando precisa? Se não houver pressa, diga-me também.
 *
 * As decisões dele: chama-se VITÓRIA; apresenta-se como «assistente online»
 * — nem IA nem virtual; e pode usar um emoji, com conta (no cumprimento e no
 * agradecimento final, e mais nenhum).
 *
 * O que isto quer dizer, em regras que o código cumpre:
 *   · responde ao que lhe perguntam ANTES de fazer a pergunta dela;
 *   · agradece cada resposta, e diz «Obrigada» (é ela que fala);
 *   · quem volta é recebido como quem volta;
 *   · nunca «Responda sim ou não», nunca «Preciso de»: pede, por favor;
 *   · a quem se queixa pede desculpa, e passa logo a alguém da equipa.
 */

import { semAcentos } from "./leitor-da-recolha";

export const NOME_DA_ASSISTENTE = "Vitória";

/** «Aqui é a Vitória, assistente online da CLYON» — como ela se apresenta. */
export const QUEM_FALA = `Aqui é a ${NOME_DA_ASSISTENTE}, assistente online da CLYON`;

/** O único emoji do cumprimento. */
const SORRISO = "😊";

/**
 * O QUE ELA FAZ, dito logo ao princípio — 13-10-2026. «A assistente deve
 * informar que irá apenas recolher as informações do pedido, para os colegas
 * avaliarem e darem o orçamento.» — o dono. Quem sabe o que esperar dela não
 * lhe pede o preço a meio, nem estranha as perguntas.
 */
export const O_QUE_ELA_FAZ =
  "Vou recolher as informações do seu pedido para os meus colegas avaliarem e lhe darem o orçamento.";

/**
 * «Boa tarde, Ana! Aqui é a Vitória, assistente online da CLYON 😊
 *  Vou recolher as informações do seu pedido para os meus colegas…»
 */
export function apresentacao(saudacao: string, primeiroNome: string | null | undefined): string {
  const quem = primeiroNome ? `${saudacao}, ${primeiroNome}!` : `${saudacao}!`;
  return `${quem} ${QUEM_FALA} ${SORRISO}\n${O_QUE_ELA_FAZ}`;
}

/**
 * UMA PERGUNTA QUE ELA NÃO SABE RESPONDER — «Vocês também vendem?» (o André,
 * 13-10-2026), que levou «Peço desculpa, não apanhei bem». Uma pergunta não é
 * uma resposta que falhou: fica anotada para a equipa, e a conversa segue.
 */
export function eUmaPergunta(texto: string): boolean {
  return /\?\s*$/.test(texto.trim());
}

export const PERGUNTA_ANOTADA =
  "Boa pergunta! Deixo-a anotada para os meus colegas lhe responderem.";

/**
 * QUEM VOLTA — «já contratei vcs umas duas vezes», «já sou cliente».
 *
 * O Lázaro disse-o na segunda mensagem e levou «Qual é a morada?». Um cliente
 * que volta é a melhor notícia que um dia pode trazer, e diz-se.
 */
export function eClienteDeVolta(texto: string): boolean {
  const t = semAcentos(texto);
  return (
    /\bja\s+(vos\s+|os\s+)?(contratei|contratamos|trabalhei|trabalhamos|usei|pedi|chamei|fiz)\b/.test(t) ||
    /\bja\s+(sou|fui|somos)\s+client/.test(t) ||
    /\b(outra vez|de novo|novamente)\s+(convosco|com voces|com vcs|com a clyon)\b/.test(t)
  );
}

/** «Que bom voltar a falar consigo, Lázaro! Obrigada pela confiança.» */
export function boasVindasDeVolta(primeiroNome: string | null | undefined): string {
  return primeiroNome
    ? `Que bom voltar a falar consigo, ${primeiroNome}! Obrigada pela confiança.`
    : "Que bom voltar a falar consigo! Obrigada pela confiança.";
}

/**
 * PERGUNTOU SE FAZEMOS — «Vocês fazem recolha de janelas?», «recolhem
 * frigoríficos?», «levam colchões?». Responde-se primeiro: «Fazemos, sim!».
 */
export function perguntaSeFazemos(texto: string): boolean {
  const t = semAcentos(texto);
  return (
    /\b(voces|vcs|vc)\s+(fazem|recolhem|levam|tratam|tambem fazem)\b/.test(t) ||
    /\b(fazem|recolhem|levam)\s+(recolha|recolhas|mudanca|mudancas|esvaziamento|transporte|montagem|limpeza)\b/.test(t) ||
    /^(fazem|recolhem|levam)\b[^?]*\?/.test(t)
  );
}

/**
 * PERGUNTOU PELA DISPONIBILIDADE — «Têm disponibilidade para recolha de
 * móveis esta sexta-feira (16 de outubro), ou até mesmo no sábado?» — a
 * Susana, 13-10-2026, que levou «Com quem estou a falar?».
 */
export function perguntaPelaDisponibilidade(texto: string): boolean {
  const t = semAcentos(texto);
  return (
    /\b(tem|teem|ha|haveria|havera)\s+(ainda\s+)?disponibilidade\b/.test(t) ||
    /\bdisponibilidade\s+para\b/.test(t) ||
    /\bestao\s+disponiveis\b/.test(t) ||
    /\b(conseguem|podem|poderiam|conseguiriam)\s+(vir|ir|fazer|passar|recolher|levar|ca)\b[^?]*\?/.test(t)
  );
}

/** A resposta: a data fica, e quem diz se pode é o profissional, na proposta. */
export function respostaADisponibilidade(temData: boolean): string {
  return temData
    ? "A data também fica anotada — os profissionais dizem-lhe nas propostas se lhes serve."
    : "Quanto à disponibilidade, os profissionais dizem-lhe nas propostas quando podem ir.";
}

/**
 * QUEIXA-SE DO ATENDIMENTO — «com esse atendimento fica difícil», «parece um
 * robô», «vou arranjar outra empresa».
 *
 * O Lázaro escreveu a primeira e a última e levou «Para quando precisa?». Uma
 * queixa não é uma resposta: pede-se desculpa, e a conversa passa logo a uma
 * pessoa. «Passar bem» sozinho não conta: é também a despedida de quem ficou
 * contente.
 */
export function reclamaDoAtendimento(texto: string): boolean {
  const t = semAcentos(texto);
  return [
    /\b(com|por causa d\w*)\s+(esse|este|um|o|tal)\s+atendimento\b/,
    /\batendimento\s+(pessimo|horrivel|mau|fraco|vergonhoso|lamentavel|ridiculo|chato|frio|seco)\b/,
    /\b(pessimo|horrivel|mau|lamentavel)\s+atendimento\b/,
    // «parece um robô» queixa-se; «uma máquina de lavar e um robô de cozinha» não.
    /\b(parece|pareces|parecem)\s+(um\s+|uma\s+)?(robo|robot|bot|maquina)\b/,
    /\b(estou a falar|falo|estou a conversar)\s+com\s+(um\s+|uma\s+)?(robo|robot|bot|maquina)\b/,
    /\b(vou|vamos)\s+(arranjar|arrumar|procurar|chamar|contratar)\s+(outra|outras)\s+empresa/,
    /\b(que|uma)\s+(falta de educacao|falta de respeito)\b/,
    /\b(mal educad|arrogant|grosseir|antipatic|malcriad)\w*/,
    /\bninguem\s+(me\s+)?(responde|ouve|percebe)\b/,
    /\b(isto|isso)\s+e\s+(ridiculo|uma vergonha|absurdo)\b/,
  ].some((r) => r.test(t));
}

/** O que ela diz a quem se queixou — e a conversa passa a uma colega. */
export function desculpasPeloAtendimento(primeiroNome: string | null | undefined): string {
  const a = primeiroNome ? `, ${primeiroNome}` : "";
  return (
    `Peço imensa desculpa${a}. Não era nada disto que queríamos que sentisse. ` +
    "Vou passar já a conversa a alguém da nossa equipa, que trata de tudo consigo pessoalmente, com todo o cuidado."
  );
}

/**
 * O AGRADECIMENTO DE CADA RESPOSTA, antes da pergunta seguinte. Muda com o
 * passo — dizer «Obrigada!» dez vezes seguidas também soa a máquina — e é
 * sempre o mesmo para o mesmo passo, para a conversa se poder ensaiar.
 */
export function agradecimento(passo: string, primeiroNome?: string | null): string {
  switch (passo) {
    // «Muito prazer» não: «Ela não precisa de dizer Muito prazer» — o dono, 13-10-2026.
    case "nome":
      return primeiroNome ? `Obrigada, ${primeiroNome}!` : "Obrigada!";
    case "morada":
    case "moradaDestino":
      return "Obrigada!";
    case "codigoPostal":
    case "codigoPostalDestino":
      return "Perfeito.";
    case "andar":
    case "andarDestino":
      return "Muito bem.";
    case "elevador":
    case "elevadorDestino":
      return "Obrigada.";
    case "estacionamento":
    case "estacionamentoDestino":
      return "Óptimo.";
    case "entulhoQuantidade":
      return "Anotado.";
    case "quando":
      return "Perfeito, fica anotado.";
    case "descricao":
      return "Obrigada pela descrição!";
    case "fatura":
    case "nif":
      return "Obrigada.";
    default:
      return "";
  }
}
