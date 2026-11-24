/**
 * A VOZ DA VITÓRIA — a assistente automática da CLYON. 13-10-2026.
 *
 * *«Tivemos a nossa primeira reclamação por causa do assistente: ele está a
 * ser muito duro e robotizado. Se pudesse dar-lhe uma característica, daria a
 * de uma mulher delicada, simpática e atenciosa, sempre cordial e com energias
 * positivas.»* — o dono, com a avaliação de 1 estrela do Abílio no Google
 * («arrogância e grosseria») e a conversa que a causou:
 *
 *   CLIENTE: Vocês fazem recolha de janelas?
 *   CLYON:   Recolha de móveis - certo. Com quem estou a falar?
 *   CLIENTE: (...) já contratei vcs umas duas vezes (...)
 *   CLYON:   Qual é a morada? Rua e número - é por aí que o profissional se orienta.
 *   CLIENTE: A morada é Rua 3 de março 14B 2860-321 Moita
 *   CLYON:   Preciso da rua e do número - é por aí que o profissional se orienta.
 *   CLYON:   Dá para estacionar à porta? Responda sim ou não.
 *   CLIENTE: Sim da, mas com esse atendimento fica difícil
 *   CLIENTE: Pode deixar vou arrumar outra empresa. Passar bem!
 *   CLYON:   Para quando precisa? Se não houver pressa, diga-me também.
 *
 * As decisões dele: chama-se VITÓRIA; apresentava-se como «assistente
 * online» — nem IA nem virtual; e pode usar um emoji, com conta (no
 * cumprimento e no agradecimento final, e mais nenhum).
 *
 * «ASSISTENTE AUTOMÁTICA» — 22-11-2026 (decisão d85). Um assistente para
 * consumidores tem de dizer que é automático (art. 50.º, n.º 1, do AI Act, e
 * a política de utilização do fornecedor do modelo): a Vitória apresenta-se
 * como «a assistente automática da CLYON», oferece logo uma pessoa da equipa,
 * e a quem pergunta se é uma pessoa diz a verdade. Nunca finge ser uma pessoa.
 * A voz delicada fica.
 *
 * O que isto quer dizer, em regras que o código cumpre:
 *   · responde ao que lhe perguntam ANTES de fazer a pergunta dela;
 *   · agradece cada resposta, e diz «Obrigada» (é ela que fala);
 *   · quem volta é recebido como quem volta;
 *   · nunca «Responda sim ou não», nunca «Preciso de»: pede, por favor;
 *   · a quem se queixa pede desculpa, e passa logo a uma pessoa da CLYON.
 */

import { semAcentos } from "./leitor-da-recolha";
import { EMPRESA_PARCEIRA_AO_PUBLICO } from "./identificacao-legal";

export const NOME_DA_ASSISTENTE = "Vitória";

/** «Aqui é a Vitória, a assistente automática da CLYON» — como ela se apresenta (d85, 22-11-2026). */
export const QUEM_FALA = `Aqui é a ${NOME_DA_ASSISTENTE}, a assistente automática da CLYON`;

/**
 * A PESSOA, OFERECIDA LOGO — 22-11-2026 (d85). Na apresentação, a seguir ao que
 * ela faz. Sem «passo-o»: não se sabe se fala um senhor ou uma senhora. Quem
 * responde «quero falar com uma pessoa» passa à equipa (`pedeUmaPessoa`).
 */
export const SE_PREFERIR_UMA_PESSOA = "Se preferir falar com uma pessoa da equipa, é só dizer.";

/**
 * A VERDADE, A QUEM PERGUNTA — «é um robô?», «estou a falar com uma pessoa?»,
 * «is this a bot?» (d85, 22-11-2026). Sem rodeios e sem fingir: é a assistente
 * automática, e a conversa passa a uma pessoa da equipa.
 */
export const SOU_A_ASSISTENTE_AUTOMATICA = `Sou a ${NOME_DA_ASSISTENTE}, a assistente automática da CLYON — não sou uma pessoa.`;

/**
 * PERGUNTA SE FALA COM UMA PESSOA? — «é um robô?», «és uma pessoa?», «isto é
 * automático?», «are you a bot?», «c'est un robot ?», «¿eres un bot?». Só a
 * pergunta: «parece um robô» é uma queixa (`reclamaDoAtendimento`), e «um robô
 * de cozinha» é uma descrição.
 */
export function perguntaSeEUmaPessoa(texto: string): boolean {
  const t = semAcentos(String(texto ?? "")).trim();
  if (!t.includes("?")) return false;
  return [
    /\b(e|es|sera|sao|voce e|a senhora e|o senhor e|isto e|isso e|estou a falar com|estou a escrever a|falo com)\s+(um\s+|uma\s+)?(robo|robot|bot|chatbot|maquina|pessoa|humano|humana|ia|inteligencia artificial|automatic[oa]|assistente automatica|assistente virtual)(\s+(real|a serio|de verdade))?\s*\?/,
    /\b(respostas?|mensagens?)\s+(sao\s+|e\s+)?automatic[ao]s?\s*\?/,
    /\b(are you|is this|am i (talking|speaking|chatting|writing) (to|with))\s+(a\s+|an\s+)?(bot|robot|chatbot|human|person|real person|ai|machine|automated)\b/,
    /\b(es-tu|etes-vous|vous etes|tu es|c'est)\s+(un\s+|une\s+)?(robot|bot|humain|humaine|personne|ia|machine)\b/,
    /\b(eres|es usted|es)\s+(un\s+|una\s+)?(robot|bot|humano|humana|persona|ia|maquina)\b/,
  ].some((r) => r.test(t));
}

/** O único emoji do cumprimento. */
export const SORRISO = "😊";

/**
 * O QUE ELA FAZ, dito logo ao princípio — 13-10-2026. «A assistente deve
 * informar que irá apenas recolher as informações do pedido, para os colegas
 * avaliarem e darem o orçamento.» — o dono. Quem sabe o que esperar dela não
 * lhe pede o preço a meio, nem estranha as perguntas.
 *
 * COM A VOZ DE PLATAFORMA — 27-10-2026 (decisão d11). «Para os meus colegas
 * lhe darem o orçamento» punha a CLYON a orçamentar; o preço é de cada
 * profissional. A frase é a do Produto (frase-padrão 3).
 */
/*
 * d91 (3.1, 23-11-2026): quem sabe porque lhe fazem perguntas responde a elas, e
 * «grátis e sem compromisso» tira logo o medo de ficar preso.
 */
export const O_QUE_ELA_FAZ =
  "Faço-lhe só as perguntas de que os parceiros da sua zona precisam e envio-lhes o seu pedido: eles respondem com o preço deles, e pedir é grátis e sem compromisso.";

/**
 * «Boa tarde, Ana! Aqui é a Vitória, a assistente automática da CLYON 😊
 *  Vou anotar o seu pedido e enviá-lo aos parceiros… Se preferir falar com uma
 *  pessoa da equipa, é só dizer.»
 */
export function apresentacao(saudacao: string, primeiroNome: string | null | undefined): string {
  const quem = primeiroNome ? `${saudacao}, ${primeiroNome}!` : `${saudacao}!`;
  return `${quem} ${QUEM_FALA} ${SORRISO}\n${O_QUE_ELA_FAZ} ${SE_PREFERIR_UMA_PESSOA}`;
}

/**
 * UMA PERGUNTA QUE ELA NÃO SABE RESPONDER — «Vocês também vendem?» (o Tomé,
 * 13-10-2026), que levou «Peço desculpa, não apanhei bem». Uma pergunta não é
 * uma resposta que falhou: fica anotada para a equipa, e a conversa segue.
 */
export function eUmaPergunta(texto: string): boolean {
  return /\?\s*$/.test(texto.trim());
}

/**
 * A FOTOGRAFIA QUE NÃO CHEGOU — 15-11-2026 (decisão d34). A ponte não a
 * descarregou e a Vitória agradecia «as imagens» que ninguém viu: o parceiro
 * recebia o pedido sem ela, e o cliente achava que tinha sido vista. Pede-se
 * com delicadeza para a reenviar, e nunca se agradece o que não se viu. Sem
 * emoji: o dela é só o do cumprimento e o do agradecimento final.
 *
 * JÁ NÃO SE ENVIA — 18-11-2026 (continuação da d57). A ponte deixou de
 * descarregar as fotografias e a frase saía em todas as conversas; o cliente
 * reenviava a mesma fotografia, que falhava outra vez. A Vitória nunca mais
 * pede para reenviar uma fotografia: a conversa fica anotada para a equipa a
 * ver no telemóvel (rota da ponte). A frase fica só para se reconhecer nos
 * fios antigos (`ePedidoDeReenvio`) e nas traduções fixas.
 */
export const PEDIR_PARA_REENVIAR_A_FOTOGRAFIA =
  "Peço desculpa, a sua fotografia não me chegou: não a consegui abrir. Pode enviá-la outra vez, por favor?";

/**
 * QUEM PASSA A FATURA — 15-11-2026 (decisão d30, frase revista pelo Jurídico).
 * Dizia «Há fatura em todas as vendas, emitida pela empresa parceira da CLYON,
 * e o preço já vem com IVA» — o modelo de antes. Desde 15-11 o parceiro passa
 * a do trabalho (com IVA ou isento, conforme o regime dele) e a empresa
 * parceira da CLYON a da taxa. É a resposta a «passam fatura?» e a linha do
 * aviso ao modelo.
 */
export const AS_DUAS_FATURAS_DO_TRABALHO =
  "Cada trabalho tem duas faturas: a do trabalho, passada pelo parceiro (com IVA ou isento, conforme o regime dele), " +
  `e a da taxa da plataforma, passada pela ${EMPRESA_PARCEIRA_AO_PUBLICO}.`;

export const PERGUNTA_ANOTADA =
  "Boa pergunta! Deixo-a anotada para uma pessoa da CLYON lhe responder.";

/**
 * A PASSAGEM A UMA PESSOA, SEM PROMETER «JÁ DE SEGUIDA» — 03-11-2026 (d15,
 * proposta 7 do Apoio). Dizia «um colega (…) fala-lhe já de seguida», quando a
 * primeira resposta de uma pessoa leva horas: promete-se o que se cumpre — uma
 * pessoa da CLYON, por aqui, no horário de atendimento. Tem tradução fixa.
 * d113 (25-11-2026): no tom do dia a dia, e com o mesmo horário de todo o lado
 * (`horario-de-atendimento.ts`, `ATENDIMENTO` das promessas públicas).
 */
export const MENSAGEM_DE_PASSAR_A_UMA_PESSOA =
  "Combinado, vou chamar uma pessoa da equipa, que lhe responde aqui (de segunda a sábado, das 8h às 20h).";

/**
 * «DO YOU SPEAK ENGLISH?» — «Yes, of course!» — 28-10-2026 (decisão d35).
 *
 * Levou `PERGUNTA_ANOTADA`, e a conversa continuou em português. Um pedido de
 * língua nunca é uma pergunta para a equipa: a resposta é sim, e tudo o que se
 * segue sai nessa língua (a língua muda ao registar a mensagem, e traduz-se à
 * saída). Escrito em português, como tudo o que a Vitória diz; sai traduzido.
 */
export const CLARO_QUE_SIM = "Claro que sim!";

/** A quem já tem pedido e só pediu a língua. */
export const EM_QUE_POSSO_AJUDAR = "Em que posso ajudar?";

/**
 * QUEM VOLTA — «já contratei vcs umas duas vezes», «já sou cliente».
 *
 * O Abílio disse-o na segunda mensagem e levou «Qual é a morada?». Um cliente
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

/** «Que bom voltar a falar consigo, Abílio! Obrigada pela confiança.» */
export function boasVindasDeVolta(primeiroNome: string | null | undefined): string {
  return primeiroNome
    ? `Que bom voltar a falar consigo, ${primeiroNome}! Obrigada pela confiança.`
    : "Que bom voltar a falar consigo! Obrigada pela confiança.";
}

/**
 * PERGUNTOU SE FAZEMOS — «Vocês fazem recolha de janelas?», «recolhem
 * frigoríficos?», «levam colchões?». Responde-se primeiro, com o sim:
 * `SIM_OS_PARCEIROS_FAZEM`.
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
 * O SIM A QUEM PERGUNTA SE FAZEMOS — 10-11-2026 (d28). A resposta punha a
 * CLYON a fazer o trabalho, na primeira pessoa. Quem faz é o parceiro
 * escolhido; a CLYON é a plataforma. O sim fica, com a mesma simpatia, e diz
 * quem faz — como o «Sim, é material que os parceiros recolhem.». O teste da
 * orquestra (regra b) chumba a frase antiga.
 */
export const SIM_OS_PARCEIROS_FAZEM = "Sim, é um serviço que os parceiros fazem!";

/**
 * O QUE A CLYON NÃO FAZ, DE MOMENTO — 25-10-2026.
 *
 * A montagem de móveis e a jardinagem e limpeza de quintais saíram do site e
 * do simulador (decisão do dono). Quem as pede à Vitória ouve-o com
 * delicadeza, e logo a seguir o que ela pode fazer por ele — e a conversa
 * continua, sem pedido registado para um serviço que ninguém lhe vai fazer.
 *
 * As famílias da frase seguem a lista do site (`servicos-da-vitoria.ts`): um
 * teste chumba se uma entrar ou sair sem a frase mudar.
 */
const O_QUE_NAO_FAZ: Record<string, string> = {
  montagem_moveis: "montagem de móveis",
  jardinagem: "jardinagem nem limpeza de quintais",
};

export const O_QUE_PODE_FAZER = "uma recolha, um esvaziamento, uma mudança ou a manutenção da casa";

/** «Peço imensa desculpa, mas de momento a CLYON não faz montagem de móveis.» */
export function naoFazemosEsseServico(servico: string): string {
  return `Peço imensa desculpa, mas de momento a CLYON não faz ${O_QUE_NAO_FAZ[servico] ?? "esse serviço"}.`;
}

/** E pergunta se precisa de outra coisa — com a lista numerada, quando a conversa vai pelos números. */
export function precisaDeOutraCoisa(lista: string | null): string {
  return lista
    ? `Precisa de outra coisa? Diga-me qual — ou, se for mais fácil, responda com o número:\n${lista}`
    : `Precisa de outra coisa? Pode ser ${O_QUE_PODE_FAZER} — diga-me à vontade.`;
}

/**
 * PERGUNTOU PELA DISPONIBILIDADE — «Têm disponibilidade para recolha de
 * móveis esta sexta-feira (16 de outubro), ou até mesmo no sábado?» — a
 * Luciana, 13-10-2026, que levou «Com quem estou a falar?».
 */
export function perguntaPelaDisponibilidade(texto: string): boolean {
  const t = semAcentos(texto);
  return (
    /\b(tem|teem|ha|haveria|havera)\s+(ainda\s+)?disponibilidade\b/.test(t) ||
    /\bdisponibilidade\s+para\b/.test(t) ||
    /\bestao\s+disponiveis\b/.test(t) ||
    /\b(conseguem|podem|poderiam|conseguiriam)\s+(vir|ir|fazer|passar|recolher|levar|ca)\b[^?]*\?/.test(t) ||
    // «Quando podem efectuar o trabalho» — o Marcelo, 20-10-2026, sem ponto
    // de interrogação: o «quando» já faz dela uma pergunta.
    /\bquando\s+(e\s+que\s+)?(podem|conseguem|poderiam|conseguiriam|podiam|poderao)\s+(vir|ir|fazer|efe(c)?tuar|realizar|executar|passar|recolher|levar|tratar|comecar)\b/.test(t)
  );
}

/** A resposta: a data fica, e quem diz se pode é o profissional, na proposta. */
export function respostaADisponibilidade(temData: boolean): string {
  return temData
    ? "A data também fica anotada — os parceiros dizem-lhe nas propostas se lhes serve."
    : "Quanto à disponibilidade, os parceiros dizem-lhe nas propostas quando podem ir.";
}

/*
 * AS PERGUNTAS DIRECTAS DA PRIMEIRA MENSAGEM — 26-10-2026.
 *
 *   «Aceitam este tipo de material? Qual o preço total com IVA e a janela
 *   horária na quinta? Obrigado!»
 *
 * — o Teodoro (nome inventado). Ouviu a pergunta do nome, e nem uma palavra
 * sobre o material nem sobre a hora. O preço já tinha resposta
 * (`COMO_CHEGA_O_PRECO`); estas duas passam a ter.
 */

/** Perguntou a HORA — «a janela horária na quinta», «a que horas vêm?». */
export function perguntaPelaHora(texto: string): boolean {
  const t = semAcentos(texto);
  return (
    /\bjanela\s+(horaria|de\s+horas?|de\s+tempo)\b/.test(t) ||
    /\b(a\s+que\s+horas?|que\s+horas?|em\s+que\s+horario|qual\s+(e\s+)?(a\s+hora|o\s+horario))\b[^.!]*\?/.test(t) ||
    /\b(hora|horario)\s+(de\s+chegada|previst[ao]|aproximad[ao])\b/.test(t)
  );
}

/** A resposta: o dia fica anotado, e a hora combina-a o profissional. */
export function respostaAHora(temData: boolean): string {
  return temData
    ? "O dia fica anotado, e o parceiro combina a hora consigo."
    : "Quanto à hora, o parceiro combina-a consigo.";
}

/** Perguntou se ACEITAM o material — «Aceitam este tipo de material?», «Levam esferovite?». */
export function perguntaSeAceitam(texto: string): boolean {
  const t = semAcentos(texto);
  return /\b(aceitam|aceita|aceitariam|recebem|levam|recolhem|podem\s+(levar|recolher)|da\s+para\s+(levar|recolher))\b[^?]*\?/.test(
    t,
  );
}

/**
 * O QUE OS PROFISSIONAIS NÃO RECOLHEM — o que as páginas de recolha dizem:
 * amianto, químicos, tintas e outros resíduos perigosos, hospitalares, e lixo
 * doméstico comum. A estes nunca se diz que sim.
 */
const NAO_SE_RECOLHE: Array<[RegExp, string]> = [
  [/\b(amianto|fibrocimento|lusalite)\b/, "o amianto"],
  [/\b(produtos?\s+)?quimicos?\b/, "os químicos"],
  [/\b(tintas?|vernizes?|solventes?|diluentes?)\b/, "as tintas"],
  [/\bresiduos?\s+(perigosos?|contaminados?|hospitalares?|toxicos?)\b/, "os resíduos perigosos"],
  [/\blixo\s+(domestico|organico)\b/, "o lixo doméstico"],
];

/**
 * O que se recolhe, de certeza — monos, móveis, entulho e o resto da casa. As
 * embalagens também (o cartão, o plástico, a película, a esferovite).
 */
const RECOLHE_SE =
  /\b(cartao|cartoes|caixas?|embalage(m|ns)|plasticos?|pelicula|esferovite|colch(ao|oes)|moveis|movel|mobilia|mobiliario|sofas?|camas?|armarios?|monos?|electrodomestic\w*|eletrodomestic\w*|frigorifico\w*|maquinas?\s+de\s+lavar|entulho|madeiras?|paletes?|tralha|roupas?|livros?|brinquedos?|janelas?|vidros?|tapetes?|cadeiras?|mesas?|estantes?)\b/;

/**
 * A RESPOSTA A «ACEITAM ESTE MATERIAL?» — sim só para o que os profissionais
 * recolhem; para o que não recolhem, ou na dúvida, fica para a equipa
 * confirmar. Nunca um sim ao que não se faz.
 */
export function respostaAoMaterial(texto: string): string {
  const t = semAcentos(texto);
  const recusados = NAO_SE_RECOLHE.filter(([re]) => re.test(t)).map(([, nome]) => nome);
  if (recusados.length > 0) {
    const nomes = recusados.length > 1 ? `${recusados.slice(0, -1).join(", ")} e ${recusados[recusados.length - 1]}` : recusados[0];
    return `Sobre ${nomes}, deixo anotado para uma pessoa da CLYON confirmar consigo — há materiais que os parceiros não podem levar.`;
  }
  if (RECOLHE_SE.test(t)) return "Sim, é material que os parceiros recolhem.";
  return "Quanto ao material, deixo anotado para uma pessoa da CLYON confirmar consigo.";
}

/**
 * QUEIXA-SE DO ATENDIMENTO — «com esse atendimento fica difícil», «parece um
 * robô», «vou arranjar outra empresa».
 *
 * O Abílio escreveu a primeira e a última e levou «Para quando precisa?». Uma
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
/** d91 (3.3): a última frase das desculpas — segura o pedido. */
export const NADA_SE_PERDE = "Nada do que já me disse se perde.";

export function desculpasPeloAtendimento(primeiroNome: string | null | undefined, perguntouSeEUmaPessoa = false): string {
  const a = primeiroNome ? `, ${primeiroNome}` : "";
  // «Estou a falar com um robô?» — a verdade antes de passar (d85, 22-11-2026).
  const verdade = perguntouSeEUmaPessoa ? `${SOU_A_ASSISTENTE_AUTOMATICA} ` : "";
  return (
    `Peço imensa desculpa${a}. ${verdade}Não era nada disto que queríamos que sentisse. ` +
    "Vou passar já a conversa a uma pessoa da CLYON, que trata de tudo consigo pessoalmente, com todo o cuidado. " +
    // d91 (3.3): quem está zangado teme ter de repetir tudo.
    NADA_SE_PERDE
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
