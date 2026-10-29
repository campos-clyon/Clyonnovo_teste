/**
 * A RECOLHA DO PEDIDO PELO WHATSAPP — o bot que preenche o formulário.
 *
 * "Quero esse WhatsApp a ser usado pelo site CLYON automaticamente: se o
 * cliente enviar mensagem, ele responde com o objectivo de recolher os dados
 * do cliente para preencher o pedido e criá-lo automaticamente. O admin pode
 * gerir essa conversa pelo painel e até interromper o bot; os números
 * bloqueados não podem ser respondidos." — 09-09-2026.
 *
 * Um número que escreve e NÃO tem pedido activo cai aqui. Pergunta-se uma
 * coisa de cada vez, pela ordem do formulário «Registar pedido» do
 * backoffice: serviço, nome, morada, código postal e localidade, (o destino,
 * numa mudança), andar, elevador, estacionamento, (os sacos, num entulho),
 * para quando, descrição, factura — e um resumo para confirmar. Ao SIM, o
 * pedido nasce na base como os registados à mão, na fila «por enviar» do
 * painel: é a equipa que o confere e o envia aos profissionais.
 *
 * ESTE FICHEIRO É PURO. `responderNaRecolha` recebe o estado e o que a pessoa
 * escreveu e devolve o estado seguinte e a resposta — sem base, sem envio.
 * Quem lê e grava o estado, e quem manda a resposta, é `whatsapp-negociacao`.
 * É assim que se testa uma conversa inteira sem WhatsApp nenhum.
 *
 * QUEM MANDA ANTES DISTO: o painel. Desligado, bloqueado ou entregue a uma
 * pessoa, o cérebro nem chega a esta função — `podeOWhatsAppFalarCom` está à
 * porta de `tratarMensagemDoCliente`. E a pessoa pode pedir uma pessoa:
 * «falar com alguém» entrega a conversa e o bot cala-se.
 */

import { FORA_DO_PLANO, SERVICE_CATEGORIES } from "./service-categories";
import { IDS_DA_LISTA, SERVICOS_DA_VITORIA } from "./servicos-da-vitoria";
import { primeiroNome } from "./mensagem-whatsapp";
import { deslocamentoDeLisboa, instanteEmLisboa } from "./hora-de-lisboa";
import type { CamposCrus, Intencao } from "./whatsapp-compreensao";
import { TAXA_IVA } from "./taxas-plataforma";
import { partirMorada } from "./morada-partida";
import { nifDaFactura } from "./pedido-valores";
import { PRAZO_DE_RESPOSTA } from "./seo-data";
import { PRECO_DA_MUDANCA_CURTO } from "./tabela-das-mudancas";
import {
  andarDaResposta,
  andarNaFrase,
  clienteCarrega,
  DESCRICAO_DAS_FOTOS,
  desisteDoPedido,
  excluiDoTrabalho,
  falaDeCoisas,
  falaDoAcesso,
  falaDoIva,
  fugiuAoNome,
  jaFezOPedido,
  ladoNaFrase,
  negaOEntulho,
  nomeDoTexto,
  pareceQuando,
  perguntaDirectaPeloPreco,
  perguntaPeloPreco,
  remeteParaAsFotos,
  semEntulhoNegado,
  separarAcessoDaMorada,
  soQuerOOrcamento,
  valeParaAmbos,
  volumeNaFrase,
} from "./leitor-da-recolha";
import {
  agradecimento,
  apresentacao,
  boasVindasDeVolta,
  CLARO_QUE_SIM,
  desculpasPeloAtendimento,
  EM_QUE_POSSO_AJUDAR,
  eClienteDeVolta,
  eUmaPergunta,
  naoFazemosEsseServico,
  PERGUNTA_ANOTADA,
  perguntaPelaDisponibilidade,
  perguntaPelaHora,
  perguntaSeAceitam,
  perguntaSeFazemos,
  precisaDeOutraCoisa,
  QUEM_FALA,
  reclamaDoAtendimento,
  respostaADisponibilidade,
  respostaAHora,
  respostaAoMaterial,
} from "./voz-da-vitoria";
import { eMarcaDeImagem } from "./rajada-do-whatsapp";
import { respostaDoSiteOuDasLicoes } from "./licoes-da-vitoria";
import { datasDitas, primeiraPreferida, quandoComVariasDatas } from "./datas-ditas";
import { linguaPedida, semPedidoDeLingua } from "./lingua-do-cliente";
import { COMO_FUNCIONA, perguntaOQueAconteceAgora } from "./perguntas-frequentes-da-vitoria";
import { separarASegundaMorada, type SegundaMorada } from "./segunda-morada";

/*
 * AS IMAGENS AGRADECEM-SE, E O QUE MOSTRAM NÃO SE PERGUNTA — 20-10-2026.
 *
 * *«Ela não está reconhecendo as imagens. No mínimo a gente gostaria que ela
 * soubesse que foram enviadas imagens e agradecesse — "obrigada pelas
 * imagens" […] e dê continuidade, para que no final ela não peça novamente as
 * imagens; e caso o cliente já tenha enviado a morada, não peça novamente.»*
 * E logo a seguir: *«se o cliente enviou as imagens, elas mostram o que é para
 * recolher — não precisa de estar a descrever item por item. Reconhecer,
 * agradecer e dar continuidade: os dados que faltam, o elevador…»* — o dono.
 *
 * «Imagens», e não fotografias ou vídeos: ele pediu a palavra geral.
 */
export const OBRIGADA_PELAS_IMAGENS = "Obrigada pelas imagens!";

/** O serviço, a quem já mostrou nas imagens o que é para levar. */
const SERVICO_PELAS_IMAGENS =
  "Para registar o pedido, diga-me só que serviço é — recolha de entulho, de móveis ou de monos, esvaziar uma casa, uma mudança…";

/*
 * A PERGUNTA DA FACTURA É SÓ A PERGUNTA — 13-10-2026.
 *
 * Dizia quem emite a factura (a parceira), que o IVA já vinha no preço e,
 * desde a manhã, que o NIF só se pedia se avançasse. «Não quero que cite a
 * [empresa parceira] nem dê explicações sobre a factura: apenas pergunte se deseja.» —
 * o dono. O «sim» guarda-se em `precisaFatura`; o NIF pede-se depois.
 *
 * E COM O IVA QUE SE APLICA — 17-10-2026. A Judite ouviu «Deseja factura?»,
 * disse «Pode ser», e quando chegou a proposta perguntou «Sem fatura é o
 * mesmo valor?». O dono: «quero que essa resposta venha com a % do IVA que
 * será aplicado — "Deseja fatura? (aplica-se IVA de 23%)"». Escrito como ele
 * o escreveu, «fatura»; o resumo diz o mesmo.
 */
const PERCENTAGEM_DO_IVA = `${Math.round(TAXA_IVA * 100)}%`;
const DESEJA_FACTURA = `Deseja fatura? (aplica-se IVA de ${PERCENTAGEM_DO_IVA})`;

export type PassoDaRecolha =
  | "servico"
  | "nome"
  | "morada"
  | "codigoPostal"
  | "moradaDestino"
  | "codigoPostalDestino"
  | "andar"
  | "elevador"
  | "estacionamento"
  | "andarDestino"
  | "elevadorDestino"
  | "estacionamentoDestino"
  | "entulhoQuantidade"
  | "quando"
  | "descricao"
  | "fatura"
  | "nif"
  | "confirmar";

export type DadosDaRecolha = {
  serviceType?: string;
  contactName?: string;
  address?: string;
  postalCode?: string | null;
  city?: string | null;
  moradaDestino?: string;
  codigoPostalDestino?: string | null;
  localidadeDestino?: string | null;
  floor?: string | null;
  hasElevator?: string | null;
  parkingDistance?: string | null;
  /**
   * O ACESSO NO DESTINO DE UMA MUDANÇA — 10-10-2026, o Gaspar.
   *
   * Perguntava-se o andar, o elevador e o estacionamento da origem, e mais
   * nada: o pedido chegava ao formulário com «Elevador no destino: não
   * perguntei» — e é metade do trabalho de uma mudança. Mesmos valores da
   * origem: o andar como o simulador o grava, "yes"/"no", "near"/"far" (e
   * `null` no estacionamento por saber).
   */
  andarDestino?: string | null;
  elevadorDestino?: string | null;
  estacionamentoDestino?: string | null;
  /**
   * A DISTÂNCIA QUE ELE DISSE, EM METROS — 28-10-2026 (decisão d35). «Yes
   * like 50 meters», à pergunta da carrinha, ficou «estacionar à porta: não».
   * Fica o que ele disse: «a carrinha fica a cerca de 50 m».
   */
  metrosAtePorta?: number | null;
  metrosAtePortaDestino?: number | null;
  /**
   * O que ele escreveu do acesso a seguir à morada — «saída para rua a porta
   * ja e na calcada Olivais». Sai da morada (ver `separarAcessoDaMorada`) e
   * vai para a descrição do pedido.
   */
  acessoDito?: string | null;
  /**
   * Disse que mandou fotografias («envio abaixo as fotos») — 17-10-2026. A
   * `DESCRICAO_DAS_FOTOS` dizia-o, mas é a primeira coisa que uma descrição
   * a sério substitui: na Judite, «Aproximadamente 30 sacos» apagou-a. Ver
   * `disseQueMandouFotografias`.
   */
  fotosDitas?: boolean;
  /**
   * As perguntas que ficaram para depois — 23-10-2026: *«Se o cliente demorar
   * mais de 10 minutos a responder a uma pergunta, que ela passe para a
   * próxima.»* — o dono. Ver `saltarAPergunta` e `recolhas-paradas.ts`.
   */
  saltados?: PassoDaRecolha[];
  /**
   * O LADO DA PORTA — «Esq», «Dto», «Frente» — 26-10-2026. A morada fica só
   * com a rua e o número, e o lado vai com o andar (`andarComLado`).
   */
  lado?: string | null;
  /**
   * O VOLUME QUE ELE DISSE — «0,5 a 0,7 m³», «20 sacos», «meia carrinha» —
   * 26-10-2026. Num entulho é a quantidade; nos outros serviços vai para o
   * pedido ao lado da descrição. Dito, não se volta a perguntar.
   */
  volumeDito?: string | null;
  /**
   * É O CLIENTE QUE CARREGA PARA A VIATURA — «Nós próprios carregamos tudo, os
   * profissionais nem precisam de sair da viatura» (26-10-2026). Vai para o
   * pedido, e o andar e o elevador deixam de se perguntar.
   */
  clienteCarrega?: boolean;
  entulhoQuantidade?: string | null;
  /** O que a pessoa escreveu sobre a data, tal e qual. */
  quandoTexto?: string | null;
  /**
   * TODAS AS DATAS, QUANDO DEU MAIS DO QUE UMA — 28-10-2026 (decisão d35):
   * «sexta 30/10 ou sábado 31/10; no máximo domingo 1/11». O resumo e a
   * descrição dizem-nas assim; o campo de data fica com a primeira preferida.
   * Ver `datas-ditas.ts`.
   */
  quandoComTodas?: string | null;
  /** A data interpretada, em ISO, quando se percebeu uma. */
  dataDesejada?: string | null;
  urgency?: string | null;
  description?: string;
  precisaFatura?: boolean;
  /**
   * O NIF para a factura — 10-10-2026. O Emiliano disse «Sim, pode colocar
   * nif» e o NIF nunca lhe foi pedido: o pedido saiu com «NIF na factura: sim»
   * e nenhum número. Nove algarismos, ou `null` quando ele o dá depois — e
   * então pede-o a equipa, como antes.
   */
  nifFactura?: string | null;
  /**
   * Quantas vezes já se repetiu a pergunta de cada passo sem resposta que se
   * aproveite. À segunda segue-se em frente: repetir a mesma pergunta pela
   * terceira vez é o assistente a parecer avariado — e o envio cala as
   * repetidas, por isso a pessoa ficava a olhar para o silêncio.
   */
  tentativas?: Partial<Record<PassoDaRecolha, number>>;
  /**
   * Pediu-se confirmacao de desistencia e a proxima mensagem decide.
   *
   * Vive aqui, e nao num membro novo de `PassoDaRecolha`, porque os switches
   * de `perguntaDo` e `respondido` sao exaustivos: um passo a mais parte a
   * compilacao em cadeia. E nao chega ao pedido — `registarPedidoDaRecolha`
   * escolhe os campos pelo nome.
   */
  aConfirmarDesistencia?: boolean;
  /**
   * O PEDIDO QUE ESTA CONVERSA ESTÁ A COMPLETAR — 26-10-2026 (decisão d30).
   *
   * *«Antes de iniciar os pedidos, olhar pelo número de telefone daquele
   * cliente, se ele já tem cadastro. Se tiver, não precisa de começar do
   * zero: só precisa de actualizar o que estiver a faltar.»* — o dono. Com
   * isto, os dados vêm do pedido, só se pergunta o que lá falta
   * (`PASSOS_DO_PEDIDO_ABERTO`), e no fim não há resumo nem pedido novo: o
   * que ele disse junta-se a ESTE pedido. Ver `pedido-aberto-na-conversa.ts`.
   */
  pedidoAberto?: number;
  /** Tem mais do que um pedido aberto, e a Vitória perguntou a qual se refere. */
  pedidosAEscolher?: number[];
  /** Quantas fotografias ele mandou nesta conversa — vão para a descrição. */
  fotosRecebidas?: number;
  /**
   * O bloco que a Vitória acrescentava à descrição do pedido aberto. Desde
   * 29-10-2026 a descrição escreve-se a partir das fontes do pedido
   * (`fontes-da-descricao.ts`) e isto já não se usa; fica no tipo para as
   * conversas guardadas antes.
   */
  blocoNoPedido?: string;
  /**
   * O QUE ELE DISSE QUE NÃO RESPONDE A PERGUNTA NENHUMA — 27-10-2026 (d2).
   * «Só preciso do orçamento», «Só não é preciso tirar o frigorífico». Tal e
   * qual, para o profissional e para a equipa lerem (`descricaoOrganizada`).
   */
  notas?: string[];
  /**
   * A 2.ª MORADA DE RECOLHA — «Haverá um segundo lugar de recolha intermédia:
   * …» (29-10-2026). Fica no pedido e na descrição («2.ª paragem», sem a rua),
   * e a equipa é avisada: o preço muda. Ver `segunda-morada.ts`.
   */
  segundaMorada?: SegundaMorada | null;
};

export type EstadoDaRecolha = {
  passo: PassoDaRecolha;
  dados: DadosDaRecolha;
};

export type RespostaDaRecolha = {
  estado: EstadoDaRecolha;
  resposta: string;
  /** A pessoa confirmou: o pedido está pronto a registar com `estado.dados`. */
  registar?: boolean;
  /** A pessoa pediu uma pessoa: entrega-se a conversa e o bot cala-se. */
  pedirPessoa?: boolean;
  /** Porque se entregou a conversa, para o painel dizer. Sem isto, «Pediu para falar com uma pessoa». */
  motivoDaEntrega?: string;
  /** A pessoa desistiu: apaga-se a recolha. */
  desistir?: boolean;
  /**
   * Pediu um serviço que a CLYON não faz, de momento — e a resposta já o diz
   * (`recusarOServico`). Na primeira mensagem, é ESTA a resposta que sai, e
   * não a pergunta do serviço de sempre. 25-10-2026.
   */
  foraDoPlano?: string;
  /**
   * Respondeu ao pedido de língua ou ao «como funciona» (`antesDaResposta`,
   * 28-10-2026): na primeira mensagem é ESTA a resposta que sai, e não a
   * pergunta do serviço de sempre.
   */
  respondidaAntes?: boolean;
};

const ETIQUETAS: Record<string, string> = Object.fromEntries(
  SERVICE_CATEGORIES.map((c) => [c.id, c.label]),
);

/**
 * A lista numerada, como se escreve numa mensagem — só com o que a CLYON faz
 * hoje (`SERVICOS_DA_VITORIA`, a lista do site). Até 25-10-2026 era a lista
 * inteira, com a montagem de móveis e a jardinagem, que já tinham saído do
 * site; e o número que o cliente escolhe converte-se por ESTA lista, e não
 * pela inteira — ver `servicoDoNumero`.
 */
const LISTA_DE_SERVICOS = SERVICOS_DA_VITORIA.map((c, i) => `${i + 1}. ${c.label}`).join("\n");

/**
 * OS SERVIÇOS DE UMA LISTA NUMERADA QUE SAIU NUMA MENSAGEM — os ids pela
 * ordem dos números, ou `null` quando a mensagem não tem uma lista.
 *
 * O número que o cliente escreve é o da lista que ELE viu. Uma conversa que
 * levou a lista antiga (dez serviços, com a montagem no 7 e a manutenção no 9)
 * e responde depois de a lista mudar tem de ter o serviço dessa lista — e não
 * o da de agora, onde o 7 é outra coisa. Lê-se pelos nomes, que o fio guarda
 * em português mesmo quando o cliente a leu traduzida.
 */
export function servicosDaLista(texto: string | null | undefined): string[] | null {
  if (!texto) return null;
  const porNome = new Map(SERVICE_CATEGORIES.map((c) => [semAcentos(c.label), c.id]));
  const ids: string[] = [];
  for (const linha of texto.split(/\r?\n/)) {
    const m = /^\s*(\d{1,2})\.\s+(.+?)\s*$/.exec(linha);
    if (!m) continue;
    const id = porNome.get(semAcentos(m[2]));
    // Os números seguidos desde o 1: outra numeração qualquer não é a lista.
    if (!id || Number(m[1]) !== ids.length + 1) continue;
    ids.push(id);
  }
  return ids.length >= 3 ? ids : null;
}

/** A última lista que saiu no fio — a que o cliente tem à frente. Ver `servicosDaLista`. */
export function servicosDaListaNoFio(
  fio: Array<{ direccao?: string; texto?: string }> | null | undefined,
): string[] | null {
  if (!Array.isArray(fio)) return null;
  for (let i = fio.length - 1; i >= 0; i--) {
    const m = fio[i];
    if (m?.direccao !== "out") continue;
    const lista = servicosDaLista(m.texto);
    if (lista) return lista;
  }
  return null;
}

/** O serviço do número N na lista que ele viu — a de agora, quando não se sabe qual viu. */
function servicoDoNumero(numero: number, lista?: readonly string[] | null): string | null {
  const ids = lista && lista.length > 0 ? lista : IDS_DA_LISTA;
  return ids[numero - 1] ?? null;
}

/**
 * Palavras que denunciam o serviço, para quem escreve em vez de escolher o número.
 *
 * OS BIG BAGS SÃO ENTULHO — 06-10-2026. «Recolha de 22 bigbags de 1T na zona
 * da Baixa da Banheira» caía na pista dos móveis, pela palavra «recolha», e o
 * Dinis levou «Recolha de móveis — certo». Quem fala em big bags (os sacos de
 * uma tonelada das obras) ou em caliça não está a falar de um sofá.
 */
/*
 * VAGAR UM APARTAMENTO É ESVAZIÁ-LO — 10-10-2026.
 *
 *   CLIENTE: Quero pedir valores para vagar um apartamento em Moscavide num 4
 *            andar sem elevador. É um T2 pequeno.
 *   CLYON:   Diga-me o que precisa de levar ou fazer.
 *   CLIENTE: Retirar mobiliário de um apartamento
 *   CLYON:   Não percebi o serviço. Responda com o número: 1. Recolha de móveis…
 *
 * — o Simão. Duas frases claras, e uma lista de dez números no fim. «Vagar»,
 * «despejar», «desocupar» e «retirar o mobiliário de um apartamento» são
 * esvaziar; e «mobiliário» e «mobília» são móveis, que a pista dos móveis só
 * conhecia como «móvel» e «móveis».
 */
/** As palavras dos móveis — sem o «recolh», que é de todas as recolhas. */
const MOVEIS =
  "m[oó]ve(l|is)|mobili[aá]rio|mob[ií]lia|sof[aá]|chaise|cama\\b|arm[aá]rio|roupeiro|c[oó]moda|cristaleira|aparador|mesa\\b|cadeira|estante|guarda-?roupa";

/*
 * AS EMBALAGENS SÃO MONOS — 26-10-2026, o Teodoro (nome inventado): «resíduos
 * de embalagens (cartão, plástico bolha, película, esferovite…)». Sem pista
 * nenhuma, caíam no «recolh» dos móveis. Antes dos móveis — mas só quando não
 * há móveis na frase: «um sofá e umas caixas» continua a ser recolha de móveis.
 */
const EMBALAGENS_SEM_MOVEIS = new RegExp(
  `^(?![\\s\\S]*(${MOVEIS}))[\\s\\S]*\\b(embalage(m|ns)|cart[aã]o|cart[oõ]es|caixas|caixotes|pl[aá]stico|pel[ií]cula|esferovite|isopor)`,
);

const PISTAS: Array<[string, RegExp]> = [
  ["mudanca", /\bmudan[cç]a|mudar\s+de\s+casa|mudar-me\b/],
  /*
   * A GARAGEM, O SÓTÃO E A CAVE — 29-10-2026. Antes do entulho e dos monos:
   * «esvaziar a garagem, tem uns frigoríficos e entulho» é um esvaziamento de
   * garagem. Só com o trabalho (esvaziar, limpar, despejar…) ou «cheia/toda»:
   * «o sofá está na garagem» continua a ser uma recolha.
   */
  [
    "esvaziamento_garagem",
    /\b(esvazia\w*|limpar|limpeza|despejar|vagar|desocupar|arrumar|tirar\s+tudo)\s+(\S+\s+){0,3}garage(m|ns)\b|\bgarage(m|ns)\s+(toda|cheia|inteira|atulhada)\b/,
  ],
  [
    "esvaziamento_sotao",
    /\b(esvazia\w*|limpar|limpeza|despejar|vagar|desocupar|arrumar|tirar\s+tudo)\s+(\S+\s+){0,3}(sotaos?|aguas[\s-]furtadas)\b|\bsotao\s+(todo|cheio|inteiro|atulhado)\b/,
  ],
  [
    "esvaziamento_cave",
    /\b(esvazia\w*|limpar|limpeza|despejar|vagar|desocupar|arrumar|tirar\s+tudo)\s+(\S+\s+){0,3}caves?\b|\bcave\s+(toda|cheia|inteira|atulhada)\b/,
  ],
  [
    "recolha_entulho",
    // Sacos a ir para um contentor são entulho — o Celso, 20-10-2026:
    // «Trazer cerca de 300 sacos do sexto andar para o contentore».
    /\bentulho|obra\b|obras\b|escombro|\bbig[\s-]?bags?\b|\bcali[cç]a\b|\bsacos?\b[^.\n]*\bcontentor|\bcontentor\w*\b[^.\n]*\bsacos?\b/,
  ],
  /*
   * JANELAS, VIDROS E CAIXILHARIA SÃO MONOS — 13-10-2026. «Vocês fazem
   * recolha de janelas?» — o Abílio — levou «Recolha de móveis», pela palavra
   * «recolha». «Porta» fica de fora: «estacionar à porta» diz-se todos os dias.
   */
  [
    "recolha_monos",
    /\bmonos?\b|electrodom[eé]stic|eletrodom[eé]stic|frigor[ií]fico|m[aá]quina de lavar|colch(?:[aã]o|[oõ]es)|\bjanela|caixilh|\bvidros?\b|alum[ií]nio|\bestores?\b/,
  ],
  [
    "esvaziamento_apartamento",
    /esvazia\w*\s+(o\s+|um\s+|de\s+)?apartamento|apartamento\s+(todo|inteiro)|\b(vagar|despejar|desocupar|libertar)\s+(o\s+|um\s+|uma\s+|do\s+)?(apartamento|t[0-6]\b)|\b(retirar|tirar|levar)\s+(o\s+|todo\s+o\s+|a\s+)?(mobiliario|mobilia|recheio|moveis|tudo)\s+(de|do|dum)\s+(um\s+|o\s+)?apartamento|\brecheio\s+(de|do|dum)\s+(um\s+)?apartamento/,
  ],
  [
    "esvaziamento_casa",
    /esvazia\w*|casa\s+(toda|inteira)|limpar\s+(a\s+)?casa\s+toda|\b(vagar|despejar|desocupar)\s+(a\s+|uma\s+)?(casa|moradia|vivenda)\b|\brecheio\s+(de|da|duma)\s+(uma\s+)?casa\b/,
  ],
  /*
   * A MANUTENÇÃO DA CASA, COM AS REPARAÇÕES E AS REMODELAÇÕES — 25-10-2026.
   * Voltou ao site com as duas, e passou para antes da montagem e da
   * jardinagem: «montar umas prateleiras e reparar a torneira» e «pintar o
   * muro do quintal» são trabalhos que a CLYON faz. «A manutenção do jardim»
   * não é a da casa — é jardinagem.
   */
  [
    "manutencao_casa",
    /manuten[cç][aã]o(?!\s+d[eoa]s?\s+(jardi|quinta))|pintura|pintar|canaliza|torneira|repara[cç]|\breparar\b|\bremodela(r|cao|coes)\b/,
  ],
  /*
   * ⚠️ O QUE A CLYON NÃO FAZ, DE MOMENTO — 25-10-2026: a montagem de móveis e
   * a jardinagem e limpeza de quintais (`FORA_DO_PLANO`). Continuam aqui, no
   * lugar de sempre, para a Vitória saber que é isso que lhe pedem e o dizer
   * (`servicoForaDoPlano`) — mas nunca dão o serviço do pedido.
   *
   * Só o TRABALHO, e não a palavra solta: dizer «não fazemos isso» a quem
   * queria uma recolha perde o cliente, e por isso as pistas ficaram mais
   * estreitas do que eram. «Desmontar» e «IKEA» saíram (o roupeiro desmonta-se
   * para o levar), e «jardim» e «quintal» sozinhos também (é onde estão as
   * coisas, «uma moradia com quintal»). E quem fala em levar alguma coisa
   * (`QUER_LEVAR_ALGUMA_COISA`) está a pedir uma recolha, monte o que montar.
   */
  ["montagem_moveis", /\bmont(ar|arem|armos|agem|agens)\b/],
  [
    "jardinagem",
    /\bjardinag|\bjardineir|\brelva(s|do|dos)?\b|\bpod(a|ar|as)\b|\bsebes?\b|\b(limpar|limpeza|tratar|arranjar|cuidar|manutencao)\s+((d[eoa]s?|o|a|os|as|um|uma|meu|minha|nosso|nossa)\s+){0,2}(jardi[mn]s?|quinta(l|is))\b|\bcortar\s+(a\s+|o\s+|as\s+|os\s+)?(mato|ervas?|arvores?)\b/,
  ],
  ["recolha_monos", EMBALAGENS_SEM_MOVEIS],
  ["recolha_moveis", new RegExp(`${MOVEIS}|recolh`)],
  ["outro", /\boutro\b/],
];

/**
 * QUEM FALA EM LEVAR ALGUMA COISA ESTÁ A PEDIR UMA RECOLHA — e não a montagem
 * nem a jardinagem, mesmo que as diga: «desmontar o roupeiro e levá-lo»,
 * «levam o sofá velho e montam o novo?». O «tirar uma dúvida» não conta.
 */
const QUER_LEVAR_ALGUMA_COISA =
  /\b(recolh\w*|lev(ar|am|em|arem|asse|assem)|leva-l[oa]s?|retir(ar|am|em|arem|e)|retira-l[oa]s?|tir(ar|am|em|arem)|tira-l[oa]s?|deitar\s+fora|remov(er|am|em)|despej\w*|abate\w*|livrar-me|desfazer-me)\b/;

function semDuvidas(t: string): string {
  return t.replace(/\btir(ar|o)\s+(uma\s+|umas\s+|as\s+|algumas\s+)?duvidas?\b/g, " ");
}

/**
 * A PRIMEIRA PISTA QUE O TEXTO DÁ — de um serviço que a CLYON faz ou de um
 * que não faz. As que não faz não contam para quem quer levar alguma coisa.
 * Recebe o texto já sem acentos.
 */
function pistaDoTexto(texto: string, semOutro: boolean): string | null {
  /*
   * O QUE ELE NEGA NÃO É PISTA — 26-10-2026. «não é entulho de obras» dava
   * «recolha de entulho», pela palavra negada. Sai antes de se procurar.
   */
  const t = semEntulhoNegado(texto);
  const levar = QUER_LEVAR_ALGUMA_COISA.test(semDuvidas(t));
  for (const [id, re] of PISTAS) {
    if (semOutro && id === "outro") continue;
    if (FORA_DO_PLANO.has(id) && levar) continue;
    if (re.test(t)) return id;
  }
  return null;
}

/** O serviço pelas PALAVRAS, sem o número da lista — para ler frases soltas. Só os que a CLYON faz. */
export function servicoPorPalavras(texto: string): string | null {
  const id = pistaDoTexto(semAcentos(texto), true);
  return id && !FORA_DO_PLANO.has(id) ? id : null;
}

/**
 * O SERVIÇO QUE ELE PEDE E A CLYON NÃO FAZ, DE MOMENTO — `montagem_moveis` ou
 * `jardinagem`, pelas palavras ou pelo número da lista que viu; ou `null`.
 * 25-10-2026.
 */
export function servicoForaDoPlano(texto: string, lista?: readonly string[] | null): string | null {
  const t = semAcentos(texto).replace(/[.!]+$/, "");
  const numero = t.match(/^\s*(\d{1,2})\s*[.)]?\s*$/);
  const id = numero ? servicoDoNumero(Number(numero[1]), lista) : pistaDoTexto(t, true);
  return id && FORA_DO_PLANO.has(id) ? id : null;
}

function semAcentos(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * O serviço do pedido, pelo número ou pelas palavras — só um que a CLYON faz.
 *
 * O NÚMERO É O DA LISTA QUE ELE VIU — 25-10-2026. Era `SERVICE_CATEGORIES[n - 1]`,
 * a lista inteira, e a lista mostrada passou a ser só a do site: o 7, que era a
 * montagem, é agora a manutenção da casa, e o 9 e o 10 já não existem. Quem
 * chama e tem o fio passa a `lista` que lá saiu (`servicosDaListaNoFio`); sem
 * ela, vale a de agora.
 */
export function servicoDoTexto(texto: string, lista?: readonly string[] | null): string | null {
  const t = semAcentos(texto).replace(/[.!]+$/, "");
  const numero = t.match(/^\s*(\d{1,2})\s*[.)]?\s*$/);
  const id = numero ? servicoDoNumero(Number(numero[1]), lista) : pistaDoTexto(t, false);
  return id && !FORA_DO_PLANO.has(id) ? id : null;
}

/**
 * ⚠️ A CLYON NAO COMPRA NADA — e quem quer vender tem de o saber ao minuto.
 *
 * 12:21  CLIENTE: «Bom dia tenho alguns artigos para venda.»
 * 12:23  CLIENTE: «Quero vender estes artigos semi-novos e preciso de recolha»
 * 12:49  CLIENTE: «E qual o valor para compra para os artigos que eu enviei»
 *
 * — a Elsa, 30-09-2026. Disse-o tres vezes. O assistente registou-lhe uma
 * «Recolha de moveis» sem uma palavra, e ela ia receber propostas de
 * profissionais a COBRAR-LHE para levar as coisas que ela julgava estar a
 * vender. Vinte e cinco minutos de formulario para acabar num desencontro.
 *
 * O que a CLYON faz esta escrito na propria pagina «recolha gratuita de
 * moveis usados»: vender no OLX ou no Facebook aparece la como ALTERNATIVA
 * ao servico. Um profissional leva, e e o cliente que paga.
 *
 * ⚠️ O QUE ISTO NAO PODE FAZER, EM CASO NENHUM, e disparar em «venda de
 * casa». Metade dos pedidos da CLYON sao exactamente isso — esvaziar para
 * vender o imovel, heranca, mudanca — e ate o exemplo da pagina de servicos
 * e «Herdei um T2 cheio e preciso de esvaziar para vender». Dizer a essa
 * pessoa que nao compramos e responder a uma pergunta que ela nao fez.
 *
 * Por isso a regra tem duas metades, e a segunda manda: reconhece-se a venda
 * de BENS e veta-se assim que apareca um IMOVEL na frase. Nao apanhar quem
 * queria vender custa uma conversa; mandar este aviso a quem esta a esvaziar
 * a casa da mae custa o cliente.
 */
const QUER_VENDER_BENS: RegExp[] = [
  /\bquero\s+vender\b/,
  /\bgostava\s+de\s+vender\b/,
  /\bpara\s+venda\b/,
  /\bvender\s+(estes|estas|uns|umas|alguns|algumas|os|as|meus|minhas|tudo)\b/,
  /\bquanto\s+(dao|dariam|pagam|pagariam|me\s+dao|me\s+pagam)\b/,
  /\b(compram|comprais)\b/,
  /\bvalor\s+(para|de)\s+compra\b/,
];

/**
 * As palavras que dizem que o que esta a ser vendido e o IMOVEL, e nao as
 * coisas la dentro. Uma so chega para vetar — ver a nota acima.
 */
const O_QUE_SE_VENDE_E_O_IMOVEL =
  /\b(casa|casas|apartamento|apartamentos|imovel|imoveis|moradia|vivenda|predio|terreno|loja|escritorio|armazem|arrecadacao|heranca|herdei|andar|t[0-5]\b)/;

export function querVenderBens(texto: string): boolean {
  const t = semAcentos(texto);
  if (O_QUE_SE_VENDE_E_O_IMOVEL.test(t)) return false;
  return QUER_VENDER_BENS.some((r) => r.test(t));
}

/**
 * O que se lhe diz, uma vez e sem rodeios.
 *
 * Curto de proposito: tem de ser percebido a primeira por uma senhora de
 * oitenta anos, e tem de vir ANTES de mais perguntas do formulario, porque e
 * a informacao que muda tudo o que ela decidir a seguir.
 *
 * E nao interrompe a conversa: a pergunta que se seguia sai logo a baixo, e
 * ela responde se quiser. Fecha-lhe a porta seria inventar uma decisao que e
 * dela.
 */
export const NAO_COMPRAMOS =
  "Só para não haver enganos: a CLYON não compra artigos. " +
  "Pela CLYON, um parceiro vai buscar e leva, e é um serviço que o cliente paga.\n\n" +
  "Se ainda assim quiser a recolha, seguimos. Se o que quer mesmo é vender, " +
  "diga «falar com alguém» e passo a conversa a uma pessoa da CLYON.\n\n";

/**
 * Ja se lhe disse isto nesta conversa? Le-se do fio, como o cumprimento.
 *
 * A frase muda de comprimento conforme o que vem a seguir, por isso a guarda
 * do envio (`jaFoiDito`) nao a apanharia: compara textos inteiros, e este sai
 * sempre colado a uma pergunta diferente.
 */
export function jaDisseQueNaoCompra(
  fio: Array<{ direccao?: string; texto?: string }> | null | undefined,
): boolean {
  if (!Array.isArray(fio)) return false;
  return fio.some(
    (m) =>
      m?.direccao === "out" &&
      typeof m.texto === "string" &&
      /a clyon nao compra artigos/.test(semAcentos(m.texto)),
  );
}

/** "sim"/"não" em todas as formas que um teclado escreve; null se não é nenhuma. */
export function simOuNao(texto: string): "sim" | "nao" | null {
  const t = semAcentos(texto).replace(/[.!,]+$/, "");
  /*
   * O inglês entra aqui porque o cliente PASSOU a poder ser inglês: desde
   * 14-09-2026 a pergunta sai na língua dele, e quem lê «reply YES» responde
   * YES. Este é o caminho sem Gemini — o que resta quando o modelo está em
   * baixo — e sem estas palavras ele deixava de fora justamente os clientes
   * que a tradução acabou de trazer.
   *
   * «no» só aqui, sozinho e sem acento: o «no» português («no prédio») nunca
   * chega a esta comparação porque nunca vem só.
   */
  if (/^(s|sim|yes|yeah|yep|sure|claro|ha|tem|com certeza|sim tem|sim ha|exacto|exato|ok|okay|certo|correct|isso)$/.test(t)) return "sim";
  if (/^(n|nao|no|nope|nem|nao tem|nao ha|sem|negativo)$/.test(t)) return "nao";
  if (/^sim\b/.test(t)) return "sim";
  if (/^nao\b/.test(t)) return "nao";
  /*
   * O «YES» E O «Y» DE QUEM ESCREVE NOUTRA LÍNGUA — 28-10-2026 (decisão d35).
   * Desde que a Vitória lhe responde na língua dele, o resumo diz «reply
   * YES», e ele escreve «yes», «y», «oui», «sí». «Yes like 50 meters» também
   * começa por um sim.
   */
  if (/^(y|oui|si|yes please|of course|all good|that'?s right|perfect|perfeito|parfait|exactement|d'?accord|vale|claro que si)$/.test(t)) {
    return "sim";
  }
  if (/^(non|nope)$/.test(t)) return "nao";
  if (/^(yes|yeah|yep|oui|si)\b/.test(t)) return "sim";
  if (/^(non|nope)\b|^no\s*,/.test(t)) return "nao";

  /*
   * O SIM QUE NÃO USA A PALAVRA «SIM».
   *
   *   CLYON:   Dá para encostar a carrinha à porta, ou fica longe?
   *   CLIENTE: Dá desde que tenha lugares livres
   *   CLYON:   Dá para estacionar à porta? Responda sim ou não.
   *
   * Ele respondeu com o VERBO DA PERGUNTA, que é a forma mais natural de
   * responder em português — «Dá para estacionar?» «Dá.» — e levou de volta
   * uma ordem para falar como uma máquina. A ressalva («desde que tenha
   * lugares livres») não muda a resposta: dá.
   *
   * O «não» manda sobre isto porque é testado ACIMA: «não dá» já saiu daqui
   * como «nao» antes de chegar a esta linha.
   */
  if (/^(da|pode|consegue|tem|ha|existe|cabe|e possivel|sem problema|sem problemas)\b/.test(t)) {
    return "sim";
  }
  return null;
}

/**
 * O SIM E O NAO DA PERGUNTA DA FACTURA, que tem palavras so dela.
 *
 *   CLYON:   Precisa de factura com NIF?
 *   CLIENTE: Podemos evitar isso
 *   CLYON:   Desculpe, nao apanhei. Precisa de factura com NIF?
 *
 * — a Elsa, 30-09-2026. «Podemos evitar isso» e um nao sem sombra de
 * duvida, e `simOuNao` nao tinha como o ler: nao ha ali palavra nenhuma de
 * negacao.
 *
 * ⚠️ PORQUE E QUE ISTO NAO VAI PARA DENTRO DE `simOuNao`. Porque «evitar»,
 * «dispensar» e «nao e preciso» so querem dizer NAO quando a pergunta e se
 * ele PRECISA de alguma coisa. A mesma `simOuNao` responde a «Ha elevador?»
 * e a «Da para estacionar a porta?», onde «podemos evitar» nao e resposta
 * nenhuma — e a `simOuNao` tem um ramo permissivo no fim (`^(da|pode|tem…)`)
 * que, alargado, transformaria leituras certas em erradas.
 *
 * Uma pergunta com vocabulario proprio le-se com um leitor proprio.
 */
export function simOuNaoNaFactura(texto: string): "sim" | "nao" | null {
  const directo = simOuNao(texto);
  if (directo) return directo;
  const t = semAcentos(texto).replace(/[.!,]+$/, "");
  // Dispensar a factura. O «evitar» exige o objecto para nao apanhar
  // «queria evitar escadas», que e conversa sobre o acesso.
  if (/\b(dispenso|dispensa|nao (e |eh )?(preciso|necessario)|sem factura|sem fatura|sem nif|nao quero factura|nao quero fatura|nao quero (o )?nif)\b/.test(t)) {
    return "nao";
  }
  if (/\b(podemos|pode|da para|prefiro|preferia|queria|quero)\s+(evitar|dispensar|passar sem|ficar sem)\b/.test(t)) {
    return "nao";
  }
  /*
   * O NIF PARA DEPOIS É UM SIM — 13-10-2026, a Rosana: «Prefiro disponibilizar
   * o meu NIF apenas se avançarmos», «Quero NIF, mas não o vou dar agora».
   * Quer a factura com NIF; o número vem quando avançar.
   */
  if (/\b(quero|prefiro|queria|preferia|dou|darei|disponibiliz\w*|envio|mando)\b.*\bnif\b|\bnif\b.*\b(depois|mais tarde|se avanc\w*|quando avanc\w*|nao agora|agora nao|nao o vou dar agora)\b/.test(t)) {
    return "sim";
  }
  if (/\b(com factura|com fatura|preciso de factura|preciso de fatura|quero factura|quero fatura|passe factura|passe fatura)\b/.test(t)) {
    return "sim";
  }
  return null;
}

/** «r/c», «2º», «terceiro», «cave» → o andar como o simulador o grava. */
export function andarDoTexto(texto: string): string {
  const t = semAcentos(texto).replace(/[.!]+$/, "");
  if (/\b(r\/?c|res\s*do\s*chao|res-do-chao|terreo|zero|loja|moradia|vivenda)\b/.test(t) || t === "0") return "0";
  if (/\bcave\b/.test(t)) return "-1";
  const n = t.match(/(\d{1,2})/);
  if (n) return String(Number(n[1]));
  const extenso: Record<string, string> = {
    primeiro: "1", segundo: "2", terceiro: "3", quarto: "4", quinto: "5",
    sexto: "6", setimo: "7", oitavo: "8", nono: "9", decimo: "10",
  };
  for (const [palavra, valor] of Object.entries(extenso)) {
    if (t.includes(palavra)) return valor;
  }
  // «NA RUA» — o que é para levar está cá fora, ao nível da rua. Depois dos
  // números, de propósito: «2º andar, mas o entulho está na rua» é o 2º.
  if (estaNaRua(texto) || t === "rua") return "0";
  return texto.trim().slice(0, 40);
}

/** Um código postal português dentro do texto, e o que sobra como localidade. */
export function codigoPostalELocalidade(texto: string): { postalCode: string | null; city: string | null } {
  const m = texto.match(/(\d{4})\s*-?\s*(\d{3})/);
  const postalCode = m ? `${m[1]}-${m[2]}` : null;
  // A localidade acaba num parêntese ou no fim da frase: «Lisboa (pátio ao
  // nível do chão…). Vamos compactar…» é Lisboa (26-10-2026).
  const semCodigo = texto.replace(m ? m[0] : "", "");
  const resto = semCodigo
    .slice(0, fimDaFrase(semCodigo, 0, { noParentese: true }))
    .replace(/[,;]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*,?\s*portugal\s*$/i, "")
    .trim();
  const city = resto.length >= 2 ? resto.slice(0, 120) : null;
  return { postalCode, city };
}

/**
 * AS ABREVIATURAS QUE ACABAM EM PONTO SEM ACABAR A FRASE — «Av.», «R.»,
 * «S. Domingos», «Sta.», «Esq.», «Dto.», «n.º». 26-10-2026: «…na quinta-feira
 * (29/10), Av. Xxx 43…» partia a frase no «Av.» e a descrição levava meia
 * morada.
 */
const ABREVIATURA_NO_FIM =
  /(?:^|[\s(,])(?:av|r|s|sto|sta|sao|dr|dra|sr|sra|esq|dto|dt|dta|dir|n|lt|lj|trav|tv|pct|urb|estr|qta|lgo|eng|prof|bl|fte|frt)$/i;

/**
 * ONDE ACABA A FRASE em `texto`, a partir de `desde` — fora dos parênteses —,
 * ou o comprimento do texto. Com `naVirgula`, também na primeira vírgula; com
 * `noParentese`, também no primeiro «(». É a régua da localidade e da morada.
 */
function fimDaFrase(
  texto: string,
  desde: number,
  opcoes: { naVirgula?: boolean; noParentese?: boolean } = {},
): number {
  let fundo = 0;
  for (let i = desde; i < texto.length; i++) {
    const c = texto[i];
    if (c === "(") {
      if (fundo === 0 && opcoes.noParentese) return i;
      fundo++;
      continue;
    }
    if (c === ")") {
      fundo = Math.max(0, fundo - 1);
      continue;
    }
    if (fundo > 0) continue;
    if (c === "!" || c === "?" || c === "\n" || c === ";") return i;
    if (c === "," && opcoes.naVirgula) return i;
    if (c === "." && (i + 1 >= texto.length || /\s/.test(texto[i + 1])) && !ABREVIATURA_NO_FIM.test(texto.slice(0, i))) {
      return i;
    }
  }
  return texto.length;
}

/**
 * A LOCALIDADE E O QUE VEM DEPOIS DELA — 26-10-2026.
 *
 *   «1700-123 Lisboa (pátio ao nível do chão, sem escadas nem elevador)»
 *
 * A localidade era tudo o que vinha a seguir ao código postal, e o formulário
 * abriu com «Lisboa (pátio ao nível do chão, sem escadas nem elevador). Vamos
 * compactar tudo, ficar…». É só até à primeira vírgula, parêntese ou fim de
 * frase; o resto, quando é uma frase (três palavras ou mais), é o acesso.
 */
export function localidadeEResto(texto: string | null | undefined): { localidade: string | null; resto: string | null } {
  const t = (texto ?? "").replace(/^[\s,;.·—–-]+/, "");
  if (!t) return { localidade: null, resto: null };
  const fim = fimDaFrase(t, 0, { naVirgula: true, noParentese: true });
  const localidade = t.slice(0, fim).replace(/[\s,.;]+$/, "").replace(/\s*,?\s*portugal\s*$/i, "").trim() || null;
  let resto = t.slice(fim).replace(/^[\s,;.]+/, "");
  // O parêntese colado à localidade perde os parênteses: é a frase dele.
  const parentese = /^\(([^()]*)\)[\s.,;]*/.exec(resto);
  if (parentese) {
    const depois = resto.slice(parentese[0].length).trim();
    resto = depois ? `${parentese[1].trim()}. ${depois}` : parentese[1];
  }
  resto = resto.trim();
  return { localidade, resto: resto && resto.split(/\s+/).length >= 3 ? resto : null };
}


/**
 * «amanhã de manhã», «sexta às 9», «14/09 11:30», «esta semana», «urgente».
 *
 * Devolve a data quando a percebeu, e a urgência com o vocabulário do
 * simulador. Sem data percebida a urgência vem das palavras — e o texto fica
 * guardado tal e qual, para a equipa ler.
 */
export function interpretarQuando(
  texto: string,
  agora: Date,
): { data: Date | null; urgency: string } {
  /*
   * ⚠️ «NÃO É URGENTE» NÃO É «URGENTE».
   *
   * *«preferencialmente esta semana — mas não é urgente»* — a Gabriela, a
   * 29-09-2026. O pedido saiu registado para «terça-feira, 29 de setembro às
   * 12:00»: hoje, daqui a uma hora. A regra via a palavra «urgente», ignorava
   * o «não» antes dela, e marcava para já. A Miriam teve de lhe escrever a
   * perguntar se era mesmo ao meio-dia — e a resposta foi «eu não indiquei
   * horas».
   *
   * Tira-se a urgência NEGADA antes de procurar a urgência — «não é
   * urgente», «nada urgente», «sem urgência», «não há pressa». O resto da
   * frase segue o caminho de sempre: «esta semana» ainda diz «esta semana».
   */
  const t = semAcentos(texto)
    .replace(
      /\b(?:nao|nada|sem)\s+(?:e\s+|eh\s+|ha\s+|tem\s+|esta\s+|tenho\s+)?(?:muito\s+|nada\s+|tao\s+)?(?:urgen\w*|pressa)\b/g,
      " sem pressa ",
    )
    /*
     * «2ª FEIRA» É SEGUNDA — 10-10-2026. O Emiliano escreveu «2ª feira» e a
     * data ficou por perceber: a regra só conhecia os dias por extenso. E a
     * Miriam escreve «na 4f».
     */
    .replace(/(?<![\d])([2-6])\s*[ªa]?\s*-?\s*f(?:eira)?\b/g, (_, n: string) => {
      return ` ${["segunda", "terca", "quarta", "quinta", "sexta"][Number(n) - 2]} `;
    });
  /*
   * ⚠️ TUDO NA HORA DE LISBOA, e não na do servidor.
   *
   * A Vercel corre em UTC. Esta função fazia `new Date(…, 9, 0)` e
   * `getHours()` — ou seja, «às 9» eram 9 em Londres, que no Verão são 10 em
   * Lisboa, e «daqui a uma hora» contava a partir da hora errada. É o mesmo
   * erro que já tinha empurrado a agenda dos profissionais uma hora para a
   * frente (ver `hora-de-lisboa.ts`).
   *
   * As contas fazem-se num RELÓGIO DE PAREDE: o instante de agora deslocado
   * para a hora de Lisboa, lido e escrito sempre pelos campos UTC — que aqui
   * querem dizer «o que o relógio da parede em Lisboa marca». No fim, a hora
   * de parede converte-se no instante verdadeiro por `instanteEmLisboa`, que
   * sabe da mudança da hora.
   */
  const parede = new Date(agora.getTime() + deslocamentoDeLisboa(agora));
  let dia: Date | null = null;

  /*
   * ⚠️ A PRIMEIRA DATA DA FRASE, E NÃO A PRIMEIRA DO CALENDÁRIO — 28-10-2026
   * (decisão d35). «Idealmente na sexta-feira, 30 de outubro, ou no sábado,
   * 31 de outubro. No máximo, até domingo, 1 de novembro» ficou domingo: os
   * dias da semana procuravam-se de domingo a sábado, e o «30 de outubro»
   * por extenso nem se lia. Agora lêem-se todas pela ordem da frase
   * (`datasDitas`), e o pedido fica com a primeira preferida — o limite («no
   * máximo», «até») nunca passa à frente dela.
   */
  const ditas = datasDitas(texto, agora);
  const escolhida = primeiraPreferida(ditas);
  const escrita = ditas.some((x) => x.tipo === "data");
  if (escolhida && (escrita || !/\b(depois de amanha|amanha|hoje|agora|urgen\w*)\b/.test(t))) {
    const [a, m, dd] = escolhida.dia.split("-").map(Number);
    dia = new Date(Date.UTC(a, m - 1, dd, 9, 0, 0, 0));
  } else if (/depois de amanha/.test(t)) {
    dia = new Date(parede);
    dia.setUTCDate(dia.getUTCDate() + 2);
  } else if (/\bamanha\b/.test(t)) {
    dia = new Date(parede);
    dia.setUTCDate(dia.getUTCDate() + 1);
  } else if (/\bhoje\b|\bagora\b|\burgen\w*/.test(t)) {
    /*
     * «URGENCIA» TAMBEM E URGENTE — a palavra dela nao era a que aqui estava.
     *
     * *«Tenho urgencia estou de mudancas»* — a Elsa, 30-09-2026. O
     * `\burgente\b` nao apanha «urgencia», e por isso o pedido de quem tinha
     * acabado de dizer que tinha pressa saia como «sem pressa».
     *
     * O apagador da urgencia NEGADA, vinte linhas acima, ja escrevia
     * `urgen\w*`: eram duas leituras da mesma palavra a discordar uma da
     * outra no mesmo ficheiro.
     */
    dia = new Date(parede);
  }
  // Os dias da semana sozinhos («sexta») já vieram em `datasDitas`, pela ordem da frase.

  if (dia) {
    let hora = 9;
    let minuto = 0;
    // «às 14h», «pelas 9», «11:30», «9h30». Os dígitos de uma data numérica
    // (14/09) não têm «:» nem «h» a seguir, por isso não se confundem.
    const horaDita = t.match(/(?:\bas\s+|\bpelas\s+|\b)(\d{1,2})(?::(\d{2})|h(\d{2})?)\b/);
    const mesmoDia = (a: Date, b: Date) =>
      a.getUTCFullYear() === b.getUTCFullYear() &&
      a.getUTCMonth() === b.getUTCMonth() &&
      a.getUTCDate() === b.getUTCDate();
    const eHoje = mesmoDia(dia, parede);
    if (horaDita && Number(horaDita[1]) >= 0 && Number(horaDita[1]) <= 23) {
      hora = Number(horaDita[1]);
      minuto = Number(horaDita[2] ?? horaDita[3] ?? 0) || 0;
      if (hora < 7 && /tarde|noite/.test(t)) hora += 12;
    } else if (/tarde/.test(t)) {
      hora = 14;
    } else if (/fim do dia|noite|ao final/.test(t)) {
      hora = 18;
    } else if (/manha/.test(t)) {
      hora = 9;
    } else if (eHoje) {
      /*
       * ⚠️ «HOJE» E «URGENTE» SEM HORA NAO MARCAM HORA NENHUMA — 30-09-2026.
       *
       * *«Tenho urgencia estou de mudancas»* — a Elsa. O resumo devolveu-lhe
       * «Quando: quarta-feira, 30 de setembro as 12:00», uma hora que ela nunca
       * disse e que ja tinha passado quando ela o leu. Ela escreveu «Mas 30 de
       * setembro e hoje» e «E ja sao quase 12h», e tinha razao nas duas.
       *
       * A regra era `parede.getUTCHours() + 1`: uma palavra de urgencia virava
       * um compromisso horario, e o resumo apresentava-o como sendo dela — que
       * e a parte que a fez desconfiar de tudo o resto.
       *
       * Urgencia e urgencia, nao e uma marcacao. Sem hora dita, fica a urgencia
       * «hoje»: a equipa ve «hoje», ve as palavras dela em `quandoTexto`, e
       * liga-lhe a combinar a hora — que e o que ja fazia.
       *
       * ⚠️ E SO PARA HOJE. «Amanha» sem hora continua a dar as nove da manha: e
       * um valor por omissao razoavel para um dia que ainda nao comecou, e nunca
       * fica para tras. O mal aqui era marcar uma hora que ja passou.
       */
      return { data: null, urgency: "today" };
    }
    dia.setUTCHours(hora, minuto, 0, 0);
    if (dia.getTime() < parede.getTime() - 3600_000) {
      // Já passou: uma hora de hoje que ficou para trás vira amanhã.
      dia.setUTCDate(dia.getUTCDate() + 1);
    }
    // A urgência conta DIAS DE CALENDÁRIO: «amanhã de manhã» dito às 10 h de
    // hoje são 23 horas, mas é amanhã — não é hoje.
    const meiaNoite = (x: Date) => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
    const dias = Math.round((meiaNoite(dia) - meiaNoite(parede)) / 86_400_000);
    const urgency = dias <= 0 ? "today" : dias === 1 ? "tomorrow" : dias < 7 ? "this_week" : "flexible";

    // Da parede para o instante verdadeiro.
    const dois = (n: number) => String(n).padStart(2, "0");
    const deParede =
      `${dia.getUTCFullYear()}-${dois(dia.getUTCMonth() + 1)}-${dois(dia.getUTCDate())}` +
      `T${dois(dia.getUTCHours())}:${dois(dia.getUTCMinutes())}`;
    return { data: instanteEmLisboa(deParede) ?? dia, urgency };
  }

  // «Na próxima semana» — 10-10-2026: a mesma janela do «Registar pedido».
  if (/proxima semana|semana que vem|semana seguinte/.test(t)) return { data: null, urgency: "next_week" };
  if (/esta semana|nos proximos dias|o mais rapido|quanto antes/.test(t)) return { data: null, urgency: "this_week" };
  if (/sem pressa|quando der|quando puder|qualquer dia|flexivel/.test(t)) return { data: null, urgency: "flexible" };
  return { data: null, urgency: "flexible" };
}

/**
 * GUARDAR O QUANDO — o texto dele, a data do pedido, a urgência e, quando deu
 * mais do que uma data, todas (28-10-2026, decisão d35). Um sítio só, para os
 * cinco caminhos que leem a data não divergirem.
 */
export function guardarOQuando(d: DadosDaRecolha, texto: string, agora: Date): void {
  const q = interpretarQuando(texto, agora);
  d.quandoTexto = texto.trim().slice(0, 200);
  d.dataDesejada = q.data ? q.data.toISOString() : null;
  d.urgency = q.urgency;
  const todas = quandoComVariasDatas(texto, agora);
  if (todas) d.quandoComTodas = todas;
  else delete d.quandoComTodas;
}

function dataPorExtenso(iso: string | null | undefined, comHora = true): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Na hora de Lisboa: o servidor está em UTC, e «às 10:00» escrito dele era
  // uma hora antes da que o cliente disse.
  const tz = { timeZone: "Europe/Lisbon" } as const;
  const dia = d.toLocaleDateString("pt-PT", { ...tz, weekday: "long", day: "numeric", month: "long" });
  if (!comHora) return dia;
  return `${dia} às ${d.toLocaleTimeString("pt-PT", { ...tz, hour: "2-digit", minute: "2-digit" })}`;
}

const URGENCIA_POR_EXTENSO: Record<string, string> = {
  today: "hoje",
  tomorrow: "amanhã",
  this_week: "esta semana",
  next_week: "na próxima semana",
  flexible: "sem pressa",
};

/** O que se pergunta em cada passo. */
/**
 * A pergunta de um passo.
 *
 * `comLista` é a lista numerada dos serviços. Ela é o plano B: quando o
 * Gemini está de pé, quem lê o que a pessoa escreve é ele, e uma lista de dez
 * números numa mensagem de WhatsApp é um mau princípio de conversa. Sem chave
 * ou com a Google em baixo, a lista volta — mais vale pedir um número do que
 * não perceber ninguém.
 */
/**
 * Bom dia, boa tarde ou boa noite — pela hora de LISBOA.
 *
 * O servidor da Vercel corre em Greenwich, e no Verão está uma hora atrás: às
 * 13:30 de Lisboa ainda dizia "bom dia". A hora do sítio onde o trabalho
 * acontece é a única que interessa a quem está a ler do outro lado.
 */
export function saudacao(agora: Date = new Date()): string {
  const escrita = agora.toLocaleString("pt-PT", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    hour12: false,
  });
  const h = Number(escrita.replace(/\D/g, ""));
  if (!Number.isFinite(h)) return "Olá";
  if (h >= 5 && h < 13) return "Bom dia";
  // A madrugada tem de ser dita: com um simples `h < 20` aqui, as três da
  // manhã caíam no "boa tarde" por não terem chegado ao "bom dia".
  if (h >= 13 && h < 20) return "Boa tarde";
  return "Boa noite";
}

/**
 * COMO SE TRATA A PESSOA: «Bom dia, Dália.»
 *
 * O PRIMEIRO NOME E MAIS NADA. Não «Sra. Dália», por muito que apeteça: o
 * género de quem escreve não está guardado em lado nenhum, e adivinhá-lo pelo
 * nome acerta em Dália e falha em Alex, em Andrea e em toda a gente com um
 * nome estrangeiro. Um «senhor» dito a uma senhora estraga a mensagem inteira,
 * e o primeiro nome não estraga nada.
 *
 * Esta regra já era a do assistente automático — mora aqui agora para ser UMA,
 * e não duas a divergir devagar.
 */
export function comoTratar(nome: string | null | undefined, agora: Date): string {
  const p = primeiroNome(nome);
  return p ? `${saudacao(agora)}, ${p}.` : `${saudacao(agora)}.`;
}

/**
 * O cumprimento da PRIMEIRA resposta desta conversa — e só dela.
 *
 * "O assistente respondeu sem bom dia e sem dizer o nome dela." — 14-09-2026.
 * A Dália escreveu «Bom dia (...) Com os melhores cumprimentos, Dália
 * Quaresma» e levou de volta «Qual é a morada certa?», seco. O nome dela
 * estava na assinatura e o assistente até o tinha lido — usou-o no resumo,
 * seis mensagens depois.
 *
 * QUAL É A PRIMEIRA? Aquela cuja mensagem chegou com o estado ainda por
 * estrear — `passoDeEntrada === "servico"`. Não é preciso marca nenhuma nos
 * dados para saber isto, e é bom que não seja: uma bandeira ali dentro viajava
 * com o pedido, aparecia na comparação dos dois caminhos de extracção, e era
 * mais uma coisa a poder ficar dessincronizada.
 *
 * Devolve o prefixo e nada mais. Vazio a partir da segunda mensagem, e vazio
 * também quando a resposta é a própria pergunta do serviço — essa já diz «Bom
 * dia! Aqui é a CLYON» dentro dela, e dois bons-dias seguidos são piores do
 * que nenhum.
 */
/**
 * ⚠️ `passoDeEntrada === "servico"` DEIXOU DE QUERER DIZER «primeira resposta».
 *
 * 12:22  Bom dia! Aqui e a CLYON. Diga-me o que precisa de levar ou fazer.
 * 12:23  [a cliente responde]
 * 12:24  Bom dia. Aqui e a CLYON. Com quem estou a falar?
 *
 * — a Elsa, 30-09-2026. Dois cumprimentos com dois minutos de intervalo,
 * vindos de dois sitios diferentes: o primeiro de `perguntaDo("servico")`, o
 * segundo daqui.
 *
 * Quando a primeira mensagem nao diz o servico, o estado fica GRAVADO no passo
 * «servico» — ja cumprimentado — e a mensagem seguinte volta a entrar em
 * «servico». A equivalencia entre «entrou em servico» e «e a primeira» caiu
 * nesse dia e ninguem deu por isso.
 *
 * QUEM SABE MESMO E O FIO DA CONVERSA, e nao uma bandeira nos dados: uma
 * bandeira viajava com o pedido e era mais uma coisa a ficar dessincronizada,
 * que e o reparo que o comentario abaixo ja fazia e continua de pe. O chamador
 * ja le as ultimas mensagens para as dar ao modelo; ver se alguma ja disse
 * «Aqui e a CLYON» nao custa uma consulta a mais.
 */
export function aberturaDaResposta(
  dados: DadosDaRecolha,
  passoDeEntrada: PassoDaRecolha,
  passoDeSaida: PassoDaRecolha,
  agora: Date = new Date(),
  jaCumprimentou = false,
): string {
  if (jaCumprimentou) return "";
  if (passoDeEntrada !== "servico") return "";
  if (passoDeSaida === "servico") return "";
  // A Vitória apresenta-se — ver `voz-da-vitoria`.
  return `${apresentacao(saudacao(agora), primeiroNome(dados.contactName))}\n\n`;
}

/**
 * JA SE DISSE «AQUI E A CLYON» A ESTA PESSOA NESTA CONVERSA?
 *
 * Le-se das mensagens que SAIRAM, que e o unico sitio onde isso esta escrito
 * sem sombra de duvida. Sem acentos porque o que fica gravado passou por
 * `paraTeclado`, que lhes mexe.
 *
 * Desde 13-10-2026 quem se apresenta é a Vitória («Aqui é a Vitória,
 * assistente online da CLYON»); as conversas de antes disseram «Aqui é a
 * CLYON», e contam na mesma.
 */
export function jaCumprimentouNesteFio(
  fio: Array<{ direccao?: string; texto?: string }> | null | undefined,
): boolean {
  if (!Array.isArray(fio)) return false;
  return fio.some(
    (m) =>
      m?.direccao === "out" &&
      typeof m.texto === "string" &&
      /aqui e a (clyon|vitoria)/.test(semAcentos(m.texto)),
  );
}

/**
 * O que se pergunta em cada passo.
 *
 * FALA-SE COMO SE FALA AO TELEFONE, e não como um formulário.
 *
 * Abria com "Olá! Sou o assistente da CLYON. Trato do seu pedido por aqui em
 * dois minutos." — uma apresentação de robô, seguida de perguntas secas com
 * "(sim/não)" ao fundo. "Não quero que ele fale que é o assistente com essa
 * mensagem engessada; comece como uma conversa normal" — 10-09-2026.
 *
 * Agora cumprimenta pela hora do dia e vai ao assunto. Ninguém anuncia que é
 * um assistente ao atender um telefone; diz bom dia e pergunta o que é
 * preciso. Cada pergunta diz também PARA QUE serve — o andar e o elevador não
 * são curiosidade, são o que decide quantas pessoas vêm e quanto custa.
 */
export function perguntaDo(
  passo: PassoDaRecolha,
  dados: DadosDaRecolha,
  comLista = true,
  agora: Date = new Date(),
): string {
  switch (passo) {
    case "servico": {
      /*
       * COM O NOME, QUANDO JÁ O DISSE.
       *
       * *«Olá! Falámos agora mesmo. O meu nome é Rute Valadas e aqui estão as
       * fotos.»* — e a resposta foi «Boa tarde! Aqui é a CLYON. Diga-me o que
       * precisa», e duas mensagens depois «Com quem estou a falar?». Ela tinha
       * dito o nome na primeira frase.
       */
      const ola = apresentacao(saudacao(agora), primeiroNome(dados.contactName));
      // Quem mandou imagens não tem de contar o que há para levar: pergunta-se
      // só o serviço (20-10-2026).
      if (mandouImagens(dados)) {
        return comLista
          ? `${ola}\n\nPara registar o pedido, diga-me só que serviço é — se for mais fácil, responda com o número:\n${LISTA_DE_SERVICOS}`
          : `${ola}\n\n${SERVICO_PELAS_IMAGENS}`;
      }
      return comLista
        ? `${ola}\n\nEm que posso ajudar? Diga-me o que precisa — se for mais fácil, responda com o número:\n${LISTA_DE_SERVICOS}`
        : `${ola}\n\nEm que posso ajudar? Diga-me o que precisa de levar ou fazer, à vontade e pelas suas palavras.`;
    }
    case "nome":
      return "Com quem tenho o gosto de falar?";
    /*
     * A MORADA TODA DE UMA VEZ — 10-10-2026.
     *
     * Pedia-se a rua e o número; depois o código postal; depois o andar. Três
     * perguntas para uma coisa que toda a gente escreve numa linha — e o Bento
     * escreveu-a assim, com o «R/C Esq.» lá dentro, e ouviu «Em que andar é?»
     * logo a seguir. A seguir disse que estava «muito complicado».
     *
     * Pede-se tudo junto, e só se volta a perguntar o que faltar.
     */
    case "morada":
      // Sem o andar quando ele já o disse — o Celso escreveu «do sexto
      // andar» na primeira mensagem (20-10-2026).
      return dados.floor != null
        ? "Qual é a morada, por favor? Rua e número, e o código postal se o tiver — é por aí que o parceiro se orienta."
        : "Qual é a morada, por favor? Rua, número e andar, e o código postal se o tiver — é por aí que o parceiro se orienta.";
    case "codigoPostal":
      // Só o que falta: o Simão escreveu «Moscavide» na morada.
      if (dados.postalCode && !dados.city) return "E a localidade?";
      if (dados.city && !dados.postalCode) return "E o código postal?";
      return "E o código postal, com a localidade?";
    case "moradaDestino":
      return "E para onde é a mudança? A rua e o número do destino, por favor.";
    case "codigoPostalDestino":
      if (dados.codigoPostalDestino && !dados.localidadeDestino) return "E a localidade do destino?";
      if (dados.localidadeDestino && !dados.codigoPostalDestino) return "E o código postal do destino?";
      return "E o código postal do destino, com a localidade?";
    case "andar":
      return dados.serviceType === "mudanca"
        ? "Em que andar fica a casa de origem?"
        : "E em que andar é?";
    case "elevador":
      return dados.serviceType === "mudanca"
        ? "Na origem há elevador? Se houver, diga-me por favor se lá cabe o que é para levar."
        : "E há elevador no prédio? Se houver, diga-me por favor se lá cabe o que é para levar.";
    case "estacionamento":
      return dados.serviceType === "mudanca"
        ? "Na origem, a carrinha consegue encostar à porta, ou fica um bocadinho longe?"
        : "E a carrinha consegue encostar à porta, ou fica um bocadinho longe?";
    case "andarDestino":
      return "E no destino, em que andar fica? Se houver elevador, diga-me também.";
    case "elevadorDestino":
      return "No destino há elevador?";
    case "estacionamentoDestino":
      return "E no destino, a carrinha consegue parar à porta?";
    case "entulhoQuantidade":
      return "E mais ou menos quanto entulho é? Em sacos ou em m³ — um número aproximado chega.";
    case "quando":
      return "Para quando precisa? Se não houver pressa nenhuma, diga-me também.";
    case "descricao":
      return "Conte-me o que há para levar ou fazer: quantas peças, o tamanho, e o que houver de especial.";
    case "fatura":
      return DESEJA_FACTURA;
    case "nif":
      return "Qual é o NIF para a fatura? Se não o tiver à mão, não faz mal: diga-me e pedimo-lo depois.";
    case "confirmar":
      // A quem já tem pedido não se mostra resumo nenhum: fica tudo nele (26-10-2026).
      return dados.pedidoAberto != null ? fechoDoPedidoAberto(dados.pedidoAberto) : resumo(dados);
  }
}

/**
 * O FIM DA CONVERSA DE QUEM JÁ TINHA PEDIDO — 26-10-2026 (decisão d30). Sem
 * resumo e sem SIM: o pedido já existe, e o que ele disse ficou nele.
 */
export function fechoDoPedidoAberto(pedidoId: number): string {
  return `Muito obrigada! Fica tudo anotado no seu pedido #${pedidoId}, e a CLYON está a tratar dele.`;
}

/**
 * COMO CHEGA O PREÇO — dito a quem pergunta, em vez de lhe dar uma ordem.
 *
 *   CLIENTE: Primeiro quero saber o valor do orçamento
 *   CLYON:   Para registar responda SIM. Se houver algo errado, diga-me o quê.
 *
 * — o Emiliano, 09-10-2026. Fez uma pergunta e levou uma instrução. O que é
 * verdade, e é o que o site diz em todas as páginas: o preço vem das
 * propostas dos profissionais, depois de o pedido estar registado, sem custo
 * e sem compromisso. Dizê-lo tira-lhe o medo de dizer SIM.
 */
export const COMO_CHEGA_O_PRECO =
  "O valor é dado pelos parceiros da sua zona: com o pedido registado, as propostas " +
  `chegam-lhe por aqui em menos de ${PRAZO_DE_RESPOSTA.porExtenso}, grátis e sem compromisso — ` +
  "só avança se quiser.";

/** A segunda vez que pergunta: a mesma verdade, sem a repetir inteira. */
export const LEMBRETE_DO_PRECO =
  "Como lhe disse, o valor chega com as propostas dos parceiros, assim que o pedido ficar registado.";

/** E o IVA, a quem perguntou por ele — como diz a pergunta da factura. */
export const O_IVA_ESTA_INCLUIDO = `E os preços já vêm com IVA incluído (${Math.round(TAXA_IVA * 100)} %).`;

/**
 * A NOTA DO PREÇO para pôr à frente da resposta — ou nada.
 *
 * Na primeira mensagem só responde a uma pergunta DIRECTA («indicar o preço
 * total fechado», «quanto custa»): aí «gostava de pedir um orçamento» é o
 * pedido, e a conversa toda lhe responde. Daí para a frente, qualquer pergunta
 * pelo preço. E quem perguntou pelo IVA leva a resposta — o Gaspar pediu
 * «a confirmação de que o IVA está incluído» e não a teve.
 */
export function notaDoPrecoPara(
  texto: string,
  passo: PassoDaRecolha,
  jaExplicado: boolean,
  /** O serviço, quando já se sabe — numa mudança diz-se a tabela à hora. */
  servico?: string | null,
): string {
  const pergunta = passo === "servico" ? perguntaDirectaPeloPreco(texto) : perguntaPeloPreco(texto);
  if (!pergunta) return "";
  const nota = jaExplicado ? LEMBRETE_DO_PRECO : COMO_CHEGA_O_PRECO;
  /*
   * NUMA MUDANÇA HÁ TABELA, E É PÚBLICA — 13-10-2026. Não é uma estimativa
   * (essas continuam a não se dizer antes do registo, decisão de 11-10-2026):
   * é o preço da hora que o site publica.
   */
  const daMudanca = servico === "mudanca" ? ` Nas mudanças, a tabela é ${PRECO_DA_MUDANCA_CURTO}.` : "";
  return `${nota}${daMudanca}${falaDoIva(texto) ? ` ${O_IVA_ESTA_INCLUIDO}` : ""}\n\n`;
}

/** Já se lhe explicou como chega o preço, nesta conversa? Lê-se do fio. */
export function jaExplicouOPreco(
  fio: Array<{ direccao?: string; texto?: string }> | null | undefined,
): boolean {
  if (!Array.isArray(fio)) return false;
  return fio.some(
    (m) =>
      m?.direccao === "out" &&
      typeof m.texto === "string" &&
      /o valor e dado pelos (parceiros|profissionais)/.test(semAcentos(m.texto)),
  );
}

/** Quantas fotografias ele mandou, pelas marcas que a ponte deixa no fio. */
export function fotosNoFio(
  fio: Array<{ direccao?: string; texto?: string }> | null | undefined,
): number {
  if (!Array.isArray(fio)) return 0;
  // E os vídeos (20-10-2026): mostram o que é para levar como as fotografias.
  // E a fotografia com o que se viu nela a seguir à marca (21-10-2026).
  return fio.filter((m) => m?.direccao === "in" && eMarcaDeImagem(m.texto ?? "")).length;
}

/**
 * QUEM DESISTE A MEIO — o Bento, 10-10-2026.
 *
 *   CLIENTE: Obrigado, está muito complicado. Prefiro desistir.
 *   CLYON:   Para registar responda SIM. Se houver algo errado, diga-me o quê.
 *
 * Quem desiste não pode levar mais uma instrução. Pede-se desculpa, diz-se
 * que não fica nada marcado, e a conversa passa a uma pessoa da CLYON — foi o
 * que a Miriam fez à mão um minuto depois, e é a única hipótese de o cliente
 * não se perder. O que ele já disse fica guardado: não se apaga nada.
 */
export function entregarQuemDesiste(estado: EstadoDaRecolha): RespostaDaRecolha {
  return {
    estado,
    resposta:
      "Compreendo perfeitamente, e peço desculpa pelas perguntas todas. Não fica nada marcado, nem tem compromisso nenhum. " +
      "Se quiser, uma pessoa da CLYON trata do resto consigo por aqui, sem mais perguntas.",
    pedirPessoa: true,
    motivoDaEntrega: "Desistiu a meio da recolha — ver a conversa",
  };
}

/**
 * PEDE UMA PESSOA — «falar com alguém», «é um robô?». «Pessoa» sozinha não
 * chega: «sofá para uma pessoa» é uma descrição. Também o lê a conversa de
 * quem já tem pedido (26-10-2026).
 */
export function pedeUmaPessoa(texto: string): boolean {
  const chave = semAcentos(texto.trim()).replace(/[.!,]+$/, "");
  // E em inglês (28-10-2026, d35): a tradução fixa diz «write "talk to someone"».
  return /(falar com (alguem|uma pessoa|um humano)|quero uma pessoa|\bhumano\b|atendente|operador|nao (e|es|sou) um bot|nao quero (um |falar com um )?bot|\brobot\b|\b(e|es|sera)\s+(um\s+)?(robo|bot)\s*\?|\b(talk|speak) (to|with) (someone|somebody|a person|a human|a real person|an agent)\b|\breal person\b|parler a quelqu'?un|hablar con alguien)/.test(
    chave,
  );
}

/** Quem pede uma pessoa — e tem-na, com gosto. */
export const PASSO_A_ALGUEM_DA_EQUIPA =
  "Com todo o gosto! Vou passar a conversa a uma pessoa da CLYON, que lhe responde por aqui assim que puder.";

/** Quem cancela sem nada recolhido. A porta fica aberta. */
export const FICA_SEM_EFEITO =
  "Está bem, fica sem efeito. Sempre que precisar, é só escrever-nos por aqui — terei todo o gosto em ajudar.";

/**
 * QUEM SE QUEIXA DO ATENDIMENTO — o Abílio, 06-10-2026 (ver `voz-da-vitoria`).
 *
 *   CLIENTE: Sim da, mas com esse atendimento fica difícil
 *   CLIENTE: Pode deixar vou arrumar outra empresa. Passar bem!
 *   CLYON:   Para quando precisa? Se não houver pressa, diga-me também.
 *
 * Uma queixa não é uma resposta à pergunta em cima: pede-se desculpa, e a
 * conversa passa logo a uma pessoa, com a etiqueta no painel a dizer que é
 * para responder já. O que ele já disse fica guardado.
 */
export function entregarQuemSeQueixa(estado: EstadoDaRecolha, texto: string): RespostaDaRecolha | null {
  if (!reclamaDoAtendimento(texto)) return null;
  return {
    estado,
    resposta: desculpasPeloAtendimento(primeiroNome(estado.dados.contactName)),
    pedirPessoa: true,
    motivoDaEntrega: "Cliente insatisfeito com o atendimento — responder já",
  };
}

/**
 * A MORADA NUMA LINHA, sem repetir a localidade que já vem escrita na rua.
 *
 * «Destino: Rua dos jacarandás 218 olivais lisboa, 1800-904, olivais lisboa» — o
 * Gaspar escreveu a localidade na rua e outra vez com o código postal.
 */
function moradaNumaLinha(
  rua: string | null | undefined,
  codigoPostal: string | null | undefined,
  localidade: string | null | undefined,
): string {
  const r = (rua ?? "").trim().replace(/[\s,.;]+$/, "");
  const l = (localidade ?? "").trim();
  const repetida = Boolean(l) && semAcentos(r).includes(semAcentos(l));
  return [r || null, codigoPostal || null, repetida ? null : l || null].filter(Boolean).join(", ");
}

/** Ele disse a hora? «às 9», «15h», «10:30». Sem isso, a hora não se escreve. */
function disseAHora(texto: string | null | undefined): boolean {
  const t = semAcentos(texto ?? "");
  return /(?<!\d)\d{1,2}\s*(h\b|h\d{2}|:\d{2})|\b(as|pelas|por volta das)\s+\d{1,2}\b/.test(t);
}

/**
 * O DIA COMO ELE O DISSE — sem uma hora que ele não disse.
 *
 * «Quando: sábado, 31 de outubro às 09:00» — o Gaspar escreveu «sábado
 * 31/10», e as nove horas eram nossas. Por dentro o pedido precisa de uma
 * hora (a agenda arruma por horas); no resumo que ele lê, só aparece a que
 * ele deu — ou a parte do dia, se foi isso que disse.
 */
function quandoNoResumo(d: DadosDaRecolha): string {
  // Mais do que uma data: todas, pela ordem — nunca só a última (28-10-2026, d35).
  if (d.quandoComTodas) return d.quandoComTodas;
  if (d.dataDesejada) {
    const comHora = disseAHora(d.quandoTexto);
    const dia = dataPorExtenso(d.dataDesejada, comHora);
    if (dia) {
      if (comHora) return dia;
      const t = semAcentos(d.quandoTexto ?? "");
      const parte = /manha/.test(t) ? ", de manhã" : /tarde/.test(t) ? ", à tarde" : /noite|fim do dia/.test(t) ? ", ao fim do dia" : "";
      return dia + parte;
    }
  }
  return d.quandoTexto ?? URGENCIA_POR_EXTENSO[d.urgency ?? "flexible"];
}

/** O princípio de um texto comprido, cortado numa palavra. */
function encurtar(texto: string | null | undefined, max = 220): string | null {
  if (!texto) return null;
  const t = texto.replace(/\s*\n\s*/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

/**
 * A DESCRIÇÃO, DITA A QUEM A DEU — 17-10-2026.
 *
 * O resumo vai para o cliente, e a Judite leu «Descrição: Ver as fotografias
 * enviadas pelo cliente.» — a falar dela na terceira pessoa. No pedido fica
 * `DESCRICAO_DAS_FOTOS`, que é para a equipa e para o profissional; aqui
 * diz-se-lhe a ela.
 */
function descricaoNoResumo(descricao: string | null | undefined): string {
  if (descricao === DESCRICAO_DAS_FOTOS) return "as fotografias que enviou";
  return encurtar(descricao) ?? "—";
}

/**
 * A descrição que é só o nome do serviço — «Recolha de móveis», escrito a
 * responder à pergunta do serviço — não é descrição nenhuma: a linha de cima
 * já o diz. A Benedita mandou as fotografias e leu «Descrição: Recolha de
 * móveis» (20-10-2026).
 */
function descricaoESoOServico(d: DadosDaRecolha): boolean {
  if (!d.description || !d.serviceType) return false;
  const limpo = (s: string) => semAcentos(s).replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  return limpo(d.description) === limpo(ETIQUETAS[d.serviceType] ?? d.serviceType);
}

export function resumo(d: DadosDaRecolha): string {
  /*
   * O ACESSO NUMA LINHA, E SEM O QUE NÃO INTERESSA — 10-10-2026.
   *
   * Num r/c o elevador não se pergunta (ver `respondido`) e por isso também
   * não se lista: «elevador: —» ao Bento, que tinha dito «R/C», era o resumo
   * a fazer-lhe a pergunta outra vez. E o estacionamento por saber diz-se «a
   * confirmar», e não com um travessão que o envio transformava em hífen e
   * colava à linha seguinte («estacionar à porta: - Quando: Sim»).
   */
  const mudanca = d.serviceType === "mudanca";
  /*
   * NUMA MUDANÇA, AS DUAS PONTAS — 10-10-2026, o Gaspar. O resumo só
   * mostrava o acesso da origem, e o do destino nem se perguntava.
   */
  const acessoDe = (
    floor: string | null | undefined,
    elev: string | null | undefined,
    estac: string | null | undefined,
    rotulo: string,
    lado?: string | null,
    metros?: number | null,
  ) => {
    // O lado da porta com o andar — «r/c Esq» (26-10-2026): a morada já não o leva.
    const semLado = floor === "0" ? "r/c" : floor === "-1" ? "cave" : (floor ?? "—");
    const andar = lado && floor != null ? `${semLado} ${lado}` : semLado;
    const elevador = elev === "yes" ? "sim" : elev === "small" ? "sim, pequeno" : elev === "no" ? "não" : "—";
    // Os metros que ele disse, e não só «não» (28-10-2026, d35).
    const estacionar =
      metros != null ? aCarrinhaFicaA(metros) : estac === "near" ? "sim" : estac === "far" ? "não" : "a confirmar";
    return [
      `${rotulo}${andar}`,
      floor === "0" && elev !== "yes" ? null : `elevador: ${elevador}`,
      `estacionar à porta: ${estacionar}`,
    ]
      .filter(Boolean)
      .join(" · ");
  };
  // A factura como se perguntou — sim ou não, e o NIF só se ele o deu
  // (13-10-2026, ver `DESEJA_FACTURA`). Com o IVA ao lado do sim, como na
  // pergunta (17-10-2026).
  // Por dizer, quando a pergunta ficou saltada (23-10-2026) — e não «não».
  const factura =
    d.precisaFatura === undefined
      ? "—"
      : d.precisaFatura
        ? `${d.nifFactura ? `sim, NIF ${d.nifFactura}` : "sim"} (com IVA de ${PERCENTAGEM_DO_IVA})`
        : "não";
  const linhas = [
    `Serviço: ${ETIQUETAS[d.serviceType ?? ""] ?? d.serviceType ?? "—"}`,
    `Nome: ${d.contactName ?? "—"}`,
    `Morada: ${moradaNumaLinha(d.address, d.postalCode, d.city) || "—"}`,
    mudanca ? `Destino: ${moradaNumaLinha(d.moradaDestino, d.codigoPostalDestino, d.localidadeDestino) || "—"}` : null,
    acessoDe(d.floor, d.hasElevator, d.parkingDistance, mudanca ? "Na origem: andar " : "Andar: ", d.lado, d.metrosAtePorta),
    mudanca
      ? acessoDe(d.andarDestino, d.elevadorDestino, d.estacionamentoDestino, "No destino: andar ", null, d.metrosAtePortaDestino)
      : null,
    d.serviceType === "recolha_entulho" ? `Entulho: ${d.entulhoQuantidade ?? "—"}` : null,
    // O volume dito, nos outros serviços — e quem carrega (26-10-2026).
    d.serviceType !== "recolha_entulho" && d.volumeDito ? `Volume: ${d.volumeDito}` : null,
    d.clienteCarrega ? "Carregar para a viatura: fica por sua conta" : null,
    `Quando: ${quandoNoResumo(d)}`,
    // Num entulho sem descrição, a linha do entulho já diz tudo. E uma
    // descrição comprida não se devolve inteira a quem a escreveu: fica toda
    // no pedido, e aqui só o princípio. Nem quando é a própria quantidade: a
    // Judite leu «Entulho: Aproximadamente 30 sacos» e logo a seguir
    // «Descrição: Aproximadamente 30 sacos» (17-10-2026).
    // E quando é só o nome do serviço: a quem mandou imagens diz-se que são
    // elas a descrição; aos outros, a linha sai (ver `descricaoESoOServico`).
    descricaoESoOServico(d)
      ? mandouImagens(d)
        ? `Descrição: ${descricaoNoResumo(DESCRICAO_DAS_FOTOS)}`
        : null
      : d.serviceType === "recolha_entulho" && (!d.description || d.description.trim() === d.entulhoQuantidade?.trim())
        ? null
        : `Descrição: ${descricaoNoResumo(d.description)}`,
    `Fatura: ${factura}`,
  ].filter((l): l is string => l != null);
  return (
    `Já tenho tudo, muito obrigada! Confirme, por favor:\n\n${linhas.join("\n")}\n\n` +
    "Se estiver tudo certo, responda SIM e fica registado. Se alguma coisa estiver mal, diga-me e eu corrijo."
  );
}

export function recolhaNova(): EstadoDaRecolha {
  return { passo: "servico", dados: {} };
}

/** A ordem dos passos, com os que só alguns serviços têm. */
function ordemDosPassos(dados: DadosDaRecolha): PassoDaRecolha[] {
  return [
    "servico",
    "nome",
    "morada",
    "codigoPostal",
    ...(dados.serviceType === "mudanca" ? (["moradaDestino", "codigoPostalDestino"] as PassoDaRecolha[]) : []),
    "andar",
    "elevador",
    "estacionamento",
    // A outra ponta da mudança — o acesso no destino (10-10-2026).
    ...(dados.serviceType === "mudanca"
      ? (["andarDestino", "elevadorDestino", "estacionamentoDestino"] as PassoDaRecolha[])
      : []),
    ...(dados.serviceType === "recolha_entulho" ? (["entulhoQuantidade"] as PassoDaRecolha[]) : []),
    "quando",
    "descricao",
    /*
     * PERGUNTA-SE SE QUER FACTURA, E O NIF NÃO SE PEDE — 13-10-2026.
     *
     *   CLIENTE: Prefiro disponibilizar o meu NIF apenas se avançarmos.
     *            Dados pessoais não se transmitem assim
     *   CLYON:   Desculpe, não apanhei. Qual é o NIF para a factura?
     *
     * — a Rosana. «Ele não pode pedir isso agora na colecta de dados: o
     * cliente ainda não aceitou o orçamento, nem o enviámos.» E: «Ele deve
     * perguntar se deseja factura, mas não pedir já o NIF.» — o dono. O passo
     * «nif» saiu da ordem; quem o disser por si fica com ele no pedido
     * (`fundirCampos` e a leitura da factura continuam a lê-lo), e o passo
     * fica no tipo para as conversas gravadas a meio dele.
     */
    "fatura",
    "confirmar",
  ];
}

/** Os passos que se dão por arrumados à segunda pergunta sem resposta. */
const PASSOS_QUE_SE_DEIXAM: PassoDaRecolha[] = [
  "codigoPostal",
  "codigoPostalDestino",
  "andar",
  "elevador",
  "estacionamento",
  "andarDestino",
  "elevadorDestino",
  "estacionamentoDestino",
  "quando",
  "descricao",
  "nif",
];

/** Já se perguntou duas vezes sem proveito? Então segue-se em frente. */
function desistiuDePerguntar(passo: PassoDaRecolha, d: DadosDaRecolha): boolean {
  return PASSOS_QUE_SE_DEIXAM.includes(passo) && (d.tentativas?.[passo] ?? 0) >= 2;
}

function passoSeguinte(passo: PassoDaRecolha, dados: DadosDaRecolha): PassoDaRecolha {
  const ordem = ordemDosPassos(dados);
  const i = ordem.indexOf(passo);
  return ordem[Math.min(i + 1, ordem.length - 1)];
}

/**
 * O QUE SE PERGUNTA A QUEM JÁ TEM PEDIDO — 26-10-2026 (decisão d30).
 *
 * Só o que falta e o profissional precisa para ir lá: o nome, a morada e o
 * acesso. O serviço, o dia, a descrição e a factura já estão no pedido (ou
 * são da equipa), e perguntá-los era recomeçar do zero — que é o que o dono
 * não quer.
 */
export const PASSOS_DO_PEDIDO_ABERTO: readonly PassoDaRecolha[] = ["nome", "morada", "codigoPostal", "andar", "elevador"];

/** Este passo já tem resposta? É isto que decide o que ainda falta perguntar. */
function respondido(passo: PassoDaRecolha, d: DadosDaRecolha): boolean {
  if (desistiuDePerguntar(passo, d)) return true;
  // Saltado por falta de resposta em 10 minutos — ver `saltarAPergunta`. O
  // serviço não se salta: é ele que decide as perguntas seguintes.
  if (passo !== "servico" && passo !== "confirmar" && d.saltados?.includes(passo)) return true;
  // Um pedido que já existe só pergunta o que lhe falta — ver `PASSOS_DO_PEDIDO_ABERTO`.
  if (d.pedidoAberto != null && passo !== "confirmar") {
    if (!PASSOS_DO_PEDIDO_ABERTO.includes(passo)) return true;
    // A localidade OU o código postal chegam: o pedido já foi localizado assim.
    if (passo === "codigoPostal") return Boolean(d.postalCode || d.city);
  }
  switch (passo) {
    case "servico":
      return Boolean(d.serviceType);
    case "nome":
      return Boolean(d.contactName);
    case "morada":
      return Boolean(d.address);
    case "codigoPostal":
      return Boolean(d.postalCode && d.city);
    case "moradaDestino":
      return Boolean(d.moradaDestino);
    case "codigoPostalDestino":
      return Boolean(d.codigoPostalDestino && d.localidadeDestino);
    /*
     * QUEM CARREGA É ELE — 26-10-2026. «Nós próprios carregamos tudo, os
     * profissionais nem precisam de sair da viatura»: o andar e o elevador já
     * não são do profissional, e não se perguntam (`clienteCarrega`).
     */
    case "andar":
      return d.floor != null || d.clienteCarrega === true;
    /*
     * NUM R/C O ELEVADOR NÃO SE PERGUNTA — 10-10-2026.
     *
     *   CLYON:   Há elevador no prédio?
     *   CLIENTE: Como está escrito acima é R/C ou seja só tem os degraus da entrada
     *
     * — o Bento. Ao nível da rua não há nada para subir nem descer, e a
     * pergunta só serve para mostrar que não se leu a morada. Não se grava
     * «não há elevador» (pode haver, e não interessa): fica por responder, e o
     * resumo não o lista.
     */
    case "elevador":
      return d.hasElevator != null || d.floor === "0" || d.clienteCarrega === true;
    // O «não sei» do estacionamento guarda-se como null, e é uma resposta:
    // por isso a pergunta aqui é se o campo existe, não se tem valor.
    case "estacionamento":
      return d.parkingDistance !== undefined;
    case "andarDestino":
      return d.andarDestino != null;
    case "elevadorDestino":
      return d.elevadorDestino != null || d.andarDestino === "0";
    case "estacionamentoDestino":
      return d.estacionamentoDestino !== undefined;
    case "entulhoQuantidade":
      return Boolean(d.entulhoQuantidade);
    case "quando":
      return Boolean(d.quandoTexto);
    case "descricao":
      /*
       * NUM ENTULHO, A QUANTIDADE É A DESCRIÇÃO — 06-10-2026.
       *
       *   CLYON:   Mais ou menos quanto entulho? Em sacos ou em m³…
       *   CLIENTE: 22 BIG BAGS
       *   CLYON:   Conte-me o que há para levar ou fazer: quantas peças…
       *   CLIENTE: levar 22 bigbags com entulho
       *
       * O Dinis escreveu os 22 big bags três vezes. Num entulho, o que há
       * para levar é entulho, e quanto já foi perguntado.
       */
      return (
        Boolean(d.description) ||
        (d.serviceType === "recolha_entulho" && Boolean(d.entulhoQuantidade))
      );
    case "fatura":
      return d.precisaFatura !== undefined;
    case "nif":
      return d.precisaFatura !== true || d.nifFactura !== undefined;
    case "confirmar":
      return false;
  }
}

/**
 * O primeiro campo que ainda falta — ou "confirmar", quando não falta nenhum.
 *
 * A máquina antiga andava um passo de cada vez porque perguntava um de cada
 * vez. Quem escreve à vontade dá três ou quatro campos numa frase só, e salta
 * por cima de meia conversa; o que interessa então não é qual era o passo
 * seguinte, é qual é o primeiro que continua por responder.
 */
export function primeiroPassoEmFalta(dados: DadosDaRecolha): PassoDaRecolha {
  return passosEmFalta(dados)[0] ?? "confirmar";
}

/**
 * TODOS OS QUE AINDA FALTAM, pela ordem das perguntas — 26-10-2026 (d31).
 *
 * A mesma regra (`respondido`) que decide a próxima pergunta da Vitória
 * decide o que o «Pedir o que falta» da Mesa pede ao cliente — ver
 * `o-que-falta-no-pedido.ts`. As duas não podem dizer coisas diferentes do
 * mesmo pedido. O «confirmar» não é uma falta: é o fim.
 */
export function passosEmFalta(dados: DadosDaRecolha): PassoDaRecolha[] {
  return ordemDosPassos(dados).filter((p) => p !== "confirmar" && !respondido(p, dados));
}

/**
 * As palavras que fazem de uma frase uma morada.
 *
 * Sem número e sem nenhuma destas, o que veio não é uma morada — é conversa a
 * responder a outra pergunta. Sem acentos porque é assim que se compara aqui.
 */
const PALAVRAS_DE_MORADA =
  /\b(rua|avenida|av|estrada|travessa|largo|praceta|praca|beco|caminho|quinta|urbanizacao|bairro|lote|azinhaga|calcada|alameda|rotunda|zona|edificio)\b/;

/**
 * Isto parece uma morada, EM RESPOSTA À PERGUNTA DA MORADA?
 *
 * Aqui um número sozinho chega, porque a pergunta acabou de ser feita: quem
 * responde «91» a «qual é a morada?» está a dar a morada.
 */
/**
 * ISTO E UMA MORADIA — e, por isso, nao ha elevador para perguntar.
 *
 *   CLYON:   Em que andar e?
 *   CLIENTE: E uma moradia, / Esta tudo no piso zero
 *   CLYON:   Ha elevador no predio? Se houver, diga-me se la cabe o que e
 *            para levar.
 *
 * — a Elsa, 30-09-2026. Ela tinha acabado de dizer que e uma casa terrea, e
 * a pergunta seguinte foi sobre o predio dela. E o assistente a parecer um
 * formulario que nao ouve.
 *
 * ⚠️ SO A MORADIA, E NUNCA O ANDAR ZERO. `andarDoTexto` devolve "0" tanto
 * para «moradia» como para «r/c» — e um r/c pode ser a loja do res-do-chao de
 * um predio de seis andares, que tem elevador e pode ate ser preciso para
 * descer alguma coisa de uma arrecadacao. Deduzir dai que nao ha elevador era
 * trocar uma pergunta a mais por um dado errado, que e pior.
 */
export function eUmaMoradia(texto: string): boolean {
  return /\b(moradia|vivenda|casa\s+t[eé]rrea|terrea)\b/.test(semAcentos(texto));
}

/**
 * O QUE É PARA LEVAR ESTÁ NA RUA — e então não há andar nem elevador.
 *
 *   CLYON:   Em que andar é?
 *   CLIENTE: NA RUA
 *   CLYON:   Há elevador no prédio? Se houver, diga-me se lá cabe o que é para levar.
 *   CLIENTE: o entulho encontra-se na rua
 *
 * — o Dinis, 06-10-2026, com 22 big bags de entulho à porta. Não é a moradia
 * da Elsa (ver `eUmaMoradia`), mas dá no mesmo: o que está cá fora não sobe
 * nem desce, e o elevador não interessa a ninguém.
 *
 * ⚠️ «NA RUA» SÓ CONTA COMO LUGAR, E NUNCA COMO MORADA. «Moro na Rua Ilídio
 * Fontes» começa uma morada; «está na rua», «na rua, pelo que…» e «NA RUA»
 * dizem onde as coisas estão. Por isso, a seguir a «na rua» só pode vir o
 * fim, uma pontuação ou uma palavra de ligação — nunca o nome de uma rua.
 */
export function estaNaRua(texto: string): boolean {
  const t = semAcentos(texto);
  if (/\b(ca fora|no passeio|na via publica|no exterior|do lado de fora)\b/.test(t)) return true;
  return /\bna rua(?=\s*$|\s*[,.;:!?)]|\s+(e|a|ao|pelo|pela|por|porque|portanto|entao|nao|ja|junto|mesmo|tambem|em|onde|que|ok)\b)/.test(
    t,
  );
}

/** O que se pode saber do acesso sem se ter perguntado. */
export type FactosSoltos = Pick<DadosDaRecolha, "floor" | "hasElevator" | "parkingDistance">;

/**
 * O QUE ELE CONTOU SEM SE LHE PERGUNTAR — 06-10-2026.
 *
 *   CLIENTE: Local é na rua, pelo que não precisa de elevador. Tem
 *            estacionamento no local
 *
 * O Dinis disse isto às 12:51, antes de qualquer pergunta sobre o acesso. Sem
 * o Gemini, a frase caiu na gaveta da pergunta que estava em cima — e numa
 * conversa ensaiada ficou a ser a MORADA dele. Depois perguntou-se-lhe o
 * andar, o elevador e o estacionamento, um de cada vez, como se ele não
 * tivesse dito nada.
 *
 * Três coisas só, as do acesso, porque são as que se dizem de passagem e as
 * que se perguntam a seguir. Lê-se em qualquer passo e só preenche o que
 * ainda estiver vazio: uma frase de passagem nunca desdiz uma resposta.
 */
export function factosSoltos(texto: string): FactosSoltos {
  const t = semAcentos(texto);
  const f: FactosSoltos = {};
  if (estaNaRua(texto)) {
    f.floor = "0";
    f.hasElevator = "no";
  }
  if (
    // «sem escadas nem elevador» — 26-10-2026.
    /\b(nao (precisa|e preciso|e necessario)( de)? (usar )?(o )?elevador|sem elevador|nao (tem|ha) elevador|(sem|nao (tem|ha)) [^.,;!?]{1,30} nem elevador)\b/.test(t)
  ) {
    f.hasElevator = "no";
    // «Temos elevador, mas é pequeno» — a Rosana, 13-10-2026, a quem se
    // perguntou o elevador duas vezes.
  } else if (/\b(tem|ha|com|temos|existe|possui) (um )?elevador\b/.test(t) && f.hasElevator == null) {
    f.hasElevator = "yes";
  }
  if (
    /\b(sem estacionamento|nao (tem|ha) (estacionamento|onde estacionar)|nao da para (estacionar|encostar)|(estacionamento|estacionar) (e |fica )?(longe|dificil)|dificil (de )?estacionar)\b/.test(t)
  ) {
    f.parkingDistance = "far";
  } else if (
    /\b((tem|ha) (estacionamento|lugar para estacionar|onde estacionar)|estacionamento (no local|a porta|a frente|em frente)|da para (estacionar|encostar)|(pode|consegue) (estacionar|encostar)|estacionar a porta)\b/.test(t)
  ) {
    f.parkingDistance = "near";
  }
  return f;
}

/** Junta os factos soltos ao que ainda está vazio — e só a isso. */
function juntarFactos(d: DadosDaRecolha, f: FactosSoltos): void {
  if (f.floor != null && d.floor == null) d.floor = f.floor;
  if (f.hasElevator != null && d.hasElevator == null) d.hasElevator = f.hasElevator;
  if (f.parkingDistance !== undefined && d.parkingDistance === undefined) {
    d.parkingDistance = f.parkingDistance;
  }
}

export function pareceMorada(texto: string): boolean {
  const t = texto.trim();
  if (t.length < 6) return false;
  return /\d/.test(t) || PALAVRAS_DE_MORADA.test(semAcentos(t));
}

/**
 * E a mesma pergunta, SEM a pergunta — a varrer um fio inteiro.
 *
 * Aqui o número não chega, e o teste apanhou-o à primeira: «Ok.Ligarei entao
 * depois das 14h» tem um dígito e ia ser gravado como a morada do cliente. Sem
 * uma pergunta a estreitar o que se procura, só a palavra de rua distingue uma
 * morada de uma frase qualquer com um número lá dentro.
 */
export function temPalavraDeRua(texto: string): boolean {
  const t = texto.trim();
  return t.length >= 6 && PALAVRAS_DE_MORADA.test(semAcentos(t));
}

/** O código postal escrito com espaço («1300 316») passa a ter o hífen. */
function comHifenNoCodigoPostal(texto: string): string {
  return texto.replace(/(?<!\d)(\d{4})[ \t]*[-–][ \t]*(\d{3})(?!\d)|(?<!\d)(\d{4})[ \t]+(\d{3})(?!\d)/g, (_, a, b, c, d) =>
    a ? `${a}-${b}` : `${c}-${d}`,
  );
}

/**
 * A LOCALIDADE NO FIM DE UMA MORADA SEM CÓDIGO POSTAL.
 *
 * «Rua Abel Faria 12 -4dto Moscavide» — o Simão. A localidade é o que
 * vem depois do último número ou do lado do andar. Só serve quando não há
 * código postal: com ele, a localidade é o que vem a seguir ao código.
 */
export function localidadeNoFimDaMorada(morada: string): string | null {
  const m = morada.match(
    /(?:\d[\wº°ª]*\.?|\b(?:[Ee]sq|[Ee]sqo|[Dd]to|[Dd]t|[Dd]ir|[Ff]rente|[Ff]te|andar|[Rr]\/[Cc])\.?)\s*[,.]?\s*([A-ZÀ-Ý][a-zà-ÿ'’]+(?:(?:\s+(?:d[aeo]s?\s+)?|\s*[/-]\s*)[A-ZÀ-Ý][a-zà-ÿ'’]+){0,3})[\s.]*$/,
  );
  if (!m) return null;
  const nome = m[1].trim();
  if (/^(esq|esquerdo|dto|direito|dir|frente|bloco|lote|porta|cave|loja|andar|apartamento|casa|fracao|fração|portugal)\b/i.test(nome)) {
    return null;
  }
  return nome;
}

/**
 * A LOCALIDADE DITA DE PASSAGEM — «em Moscavide», «O local é Ajuda/Lisboa»,
 * «na zona da Baixa da Banheira». Pelas maiúsculas: «em frente», «em que
 * andar» e «em outubro» não são sítios.
 */
export function localidadeDita(texto: string): string | null {
  // O nome não passa de uma linha para a outra: «Resido em Lisboa\nVou
  // renovar a casa» dava «Lisboa Vou» — a Rosana, 13-10-2026.
  const m = texto.match(
    /(?:\b[Oo] local (?:é|e)|\b[Ll]ocalidade:?|\b[Zz]ona d[aeo]s?|\b[Ff]ica (?:em|n[ao]s?)|\b[Mm]oro (?:em|n[ao]s?)|\b[Ee]m)\s+([A-ZÀ-Ý][a-zà-ÿ'’]+(?:(?:[ \t]+(?:d[aeo]s?[ \t]+)?|[ \t]*[/-][ \t]*)[A-ZÀ-Ý][a-zà-ÿ'’]+){0,3})/,
  );
  if (!m) return null;
  const nome = m[1].trim();
  return /^(portugal|clyon)$/i.test(nome) ? null : nome;
}

/**
 * AS PALAVRAS DE RUA à frente de uma morada, escritas como as pessoas as
 * escrevem — por extenso ou abreviadas.
 */
const INICIO_DE_RUA =
  "rua|r\\.|avenida|av\\.?|travessa|trav\\.?|tv\\.?|largo|lgo\\.?|praceta|pct\\.?|pra[cç]a|estrada|estr\\.?|beco|cal[cç]ada|alameda|caminho|urbaniza[cç][aã]o|urb\\.?|bairro|quinta|qta\\.?|rotunda|azinhaga|p[aá]tio";

const CODIGO_POSTAL_SOLTO = /(?<!\d)\d{4}\s*-\s*\d{3}(?!\d)/;

/**
 * A MORADA ACABA ONDE ACABA — 26-10-2026.
 *
 * Ia da palavra de rua até ao fim da linha: numa mensagem escrita de seguida,
 * a morada do Teodoro (nome inventado) levou o resto da mensagem — o acesso,
 * o volume e as perguntas — e o formulário abriu com tudo isso na localidade.
 * Com código postal, acaba na localidade (até à vírgula, ao parêntese ou ao
 * fim da frase) — e leva o parêntese colado a ela, que `guardarMorada` separa
 * para o acesso. Sem código postal, acaba no fim da frase.
 */
function cortarNoFimDaMorada(morada: string): string {
  const cp = CODIGO_POSTAL_SOLTO.exec(morada);
  if (cp) {
    const depois = cp.index + cp[0].length;
    const aFrente = /^[\s,;-]*/.exec(morada.slice(depois))?.[0].length ?? 0;
    let fim = fimDaFrase(morada, depois + aFrente, { naVirgula: true, noParentese: true });
    const parentese = /^\s*\([^()]*\)/.exec(morada.slice(fim));
    if (parentese) fim += parentese[0].length;
    return morada.slice(0, fim).trim();
  }
  const numero = morada.search(/\d/);
  return morada.slice(0, fimDaFrase(morada, Math.max(0, numero))).trim();
}

/**
 * A MORADA ESCRITA NUMA FRASE QUE NÃO RESPONDIA À PERGUNTA DA MORADA.
 *
 *   «A morada é Rua Tomás de Lemos, N24, 1°esq. 1495-903 Algés»
 *
 * — o Emiliano, na primeira mensagem, e a seguir perguntaram-lhe «Qual é a
 * morada?». Procura-se a linha que começa numa palavra de rua e tem um número;
 * se o código postal vier na linha de baixo, junta-se.
 *
 * ⚠️ «Está na rua desde as 9h» não é uma morada: a seguir à palavra de rua tem
 * de vir um nome (com maiúscula), um número, ou «da/de/do». E «quinta-feira» é
 * um dia.
 */
export function moradaNaFrase(texto: string): string | null {
  const linhas = texto.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const procura = new RegExp(`(?:^|[\\s,:;(])((?:${INICIO_DE_RUA})\\s+\\S[^\\n]*)`, "i");
  const palavra = new RegExp(`^(?:${INICIO_DE_RUA})\\s+`, "i");
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(procura);
    if (!m) continue;
    let morada = m[1].trim();
    if (/^quinta[\s-]+feira/i.test(morada)) continue;
    const depois = morada.replace(palavra, "");
    if (!/^[A-ZÀ-Ý]/.test(morada) && !/^(?:[A-ZÀ-Ý0-9]|d[aeo]s?\s)/.test(depois)) continue;
    const seguinte = linhas[i + 1] ?? "";
    const cpEmBaixo = /^\d{4}\s*-\s*\d{3}(?!\d)/.test(seguinte);
    if (!/\d/.test(morada) && !cpEmBaixo) continue;
    morada = cortarNoFimDaMorada(morada);
    if (!CODIGO_POSTAL_SOLTO.test(morada) && cpEmBaixo) {
      morada = `${morada.replace(/[,\s]+$/, "")}, ${seguinte}`;
    }
    return morada.slice(0, 300);
  }
  return null;
}

/**
 * GUARDAR UMA MORADA — a rua, o código postal, a localidade e o andar.
 *
 * Era guardada inteira como rua, e a localidade era «o que sobra» depois de
 * tirar o código: no resumo do Bento ficou
 *
 *   Morada: Travessa Abel Correia, 9, R/C Esq., 1300-904, Travessa Abel Correia 9 R/C Esq. Lisboa
 *
 * — a rua duas vezes. A localidade é o que vem DEPOIS do código postal
 * (`partirMorada`, o mesmo que o backoffice usa). E o andar que vier escrito
 * na morada («R/C», «1°esq», «4dto») fica a ser o andar: não se pergunta.
 */
/**
 * A MORADA SEM O RÓTULO À FRENTE — «Apartamento sito em:», «Morada:», «Fica
 * na Rua…». A Rosana, 13-10-2026, ficou com «Apartamento sito em:, Rua Gil
 * Vasques» no pedido.
 */
function semRotuloAFrente(texto: string): string {
  return texto
    .split("\n")
    .map((l) => l.trim())
    // «Apartamento sito em:», e «Nossa morada» sem os dois pontos (o Josué).
    .filter(
      (l) =>
        l &&
        !/^[^\d]{0,40}:$/.test(l) &&
        !/^(a\s+|nossa\s+|minha\s+|o\s+|meu\s+)?(morada|endere[cç]o)(\s+(e|é|de origem|de recolha|completa|atual|actual))?\s*:?$/i.test(l),
    )
    .join("\n")
    .replace(
      /^(?:(?:o|a|o meu|a minha)\s+)?(?:apartamento|casa|moradia|vivenda|im[oó]vel|pr[eé]dio|escrit[oó]rio|loja|armaz[eé]m)?\s*(?:sit[ao]|situad[ao]|localizad[ao]|fica)\s+(?:em|no|na)\b\s*:?\s*/i,
      "",
    );
}

/**
 * A RUA E O NÚMERO, SEM O ANDAR — 26-10-2026.
 *
 * «Av. … 43, R/C Esq» ia inteira para a morada, com o «R/C» que já estava no
 * andar. O dono: a morada fica só com a rua e o número; o andar e o lado vão
 * para o andar. O sinal do andar só conta DEPOIS do número da porta: «Rua 1º
 * de Maio 12» não perde o nome. O que vier a seguir ao andar e for da morada
 * («Bloco B», «Lote 3») fica.
 */
export function separarOAndarDaMorada(morada: string): { rua: string; lado: string | null } {
  const ANDAR =
    /(?:^|[\s,])-?\s*(\d{1,2}\s*[º°ª]\s*-?\s*(?:esq\w*|dto|dta|dt|dir\w*|frente|fte|frt)|r\/c|r\.c\.|r[eé]s[\s-]+do[\s-]+ch[aã]o|cave|\d{1,2}\s*\.?\s*[º°ª]\s*(?:andar)?|\d{1,2}\s*-?\s*(?:esq\w*|dto|dta|dt|dir\w*|frente)|\d{1,2}\s*o?\s*andar)(?=[\s,.;]|$)/gi;
  for (const m of morada.matchAll(ANDAR)) {
    const antes = morada.slice(0, m.index);
    if (!/\d/.test(antes)) continue;
    const depois = morada.slice((m.index ?? 0) + m[0].length);
    const lado = ladoNaFrase(`${m[1]}${depois.slice(0, 12)}`);
    // O lado a seguir ao andar sai com ele; o que é da morada fica.
    const semLado = depois.replace(/^[\s,.-]*(esq\w*|dto|dta|dt|dir\w*|frente|fte|frt)\b\.?/i, "");
    const daMorada = /\b(bloco|lote|torre|edif\w*|entrada|fra[cç][aã]o|porta)\b/i.test(semLado)
      ? `, ${semLado.replace(/^[\s,.;-]+/, "").replace(/[\s,.;]+$/, "")}`
      : "";
    return { rua: `${antes.replace(/[\s,.;-]+$/, "")}${daMorada}`, lado };
  }
  return { rua: morada, lado: null };
}

export function guardarMorada(d: DadosDaRecolha, texto: string): void {
  texto = semRotuloAFrente(texto);
  const junto = comHifenNoCodigoPostal(texto.trim()).replace(/\s*\n+\s*/g, ", ");
  const p = partirMorada(junto);
  // O que vem depois do andar, quando é conversa, é o acesso — ver `separarAcessoDaMorada`.
  const { morada, acesso } = separarAcessoDaMorada(p.rua || junto);
  // A localidade é só a localidade; o parêntese a seguir é o acesso (26-10-2026).
  const local = localidadeEResto(p.localidade);
  const acessos = [acesso, local.resto].filter((a): a is string => Boolean(a));
  // A morada só com a rua e o número; o lado vai com o andar (26-10-2026).
  const { rua, lado } = separarOAndarDaMorada(morada);
  d.address = rua.replace(/[\s,.;]+$/, "").slice(0, 300);
  for (const a of acessos) {
    if (!(d.acessoDito ?? "").includes(a)) d.acessoDito = (d.acessoDito ? `${d.acessoDito}\n${a}` : a).slice(0, 600);
    // «pátio ao nível do chão, sem escadas nem elevador» diz o andar e o elevador.
    juntarFactos(d, { ...factosSoltos(a), ...(andarNaFrase(a) != null ? { floor: andarNaFrase(a) } : {}) });
  }
  if (p.codigoPostal) d.postalCode = p.codigoPostal;
  if (local.localidade) d.city = local.localidade.slice(0, 120);
  else if (!d.city) {
    const fim = localidadeNoFimDaMorada(morada.replace(/[\s,.;]+$/, ""));
    if (fim) d.city = fim;
  }
  if (d.floor == null) {
    const andar = andarNaFrase(texto);
    if (andar != null) d.floor = andar;
  }
  if (lado && d.lado == null) d.lado = lado;
}

/**
 * A MORADA DO DESTINO DE UMA MUDANÇA — guardada como a da origem: a rua, o
 * código postal, a localidade e o andar de lá.
 */
export function guardarMoradaDestino(d: DadosDaRecolha, texto: string): void {
  texto = semRotuloAFrente(texto);
  const junto = comHifenNoCodigoPostal(texto.trim()).replace(/\s*\n+\s*/g, ", ");
  const p = partirMorada(junto);
  const { morada } = separarAcessoDaMorada(p.rua || junto);
  d.moradaDestino = morada.replace(/[\s,.;]+$/, "").slice(0, 300);
  if (p.codigoPostal) d.codigoPostalDestino = p.codigoPostal;
  const localidade = p.localidade?.replace(/\s*,?\s*portugal\s*$/i, "").trim();
  if (localidade) d.localidadeDestino = localidade.slice(0, 120);
  else if (!d.localidadeDestino) {
    const fim = localidadeNoFimDaMorada(d.moradaDestino);
    if (fim) d.localidadeDestino = fim;
  }
  if (d.andarDestino == null) {
    const andar = andarNaFrase(texto);
    if (andar != null) d.andarDestino = andar;
  }
}

/** O andar como o modelo o escreveria — para os campos crus. */
function andarEscrito(andar: string): string {
  return andar === "0" ? "r/c" : andar === "-1" ? "cave" : `${andar}º`;
}

/*
 * AS MORADAS COM RÓTULO — «Morada de origem: …», «Morada de destino: …».
 *
 * O Gaspar escreveu as duas assim, numa mudança, e a de destino foi-lhe
 * perguntada outra vez: só se procurava UMA morada, e a primeira que
 * aparecesse.
 */
const ROTULO_DA_ORIGEM =
  /^\s*(?:a\s+)?(?:morada\s+(?:de\s+|da\s+)?(?:origem|partida|recolha)|origem|partida|de\s+onde\s+sai)\s*[:\-–]\s*(.+)$/i;
const ROTULO_DO_DESTINO =
  /^\s*(?:a\s+)?(?:morada\s+(?:de\s+|do\s+|da\s+)?(?:destino|entrega|chegada)|destino|para\s+onde\s+vai|nova\s+morada|morada\s+nova)\s*[:\-–]\s*(.+)$/i;

// Sem `\b` depois do «á»: para o JavaScript o «á» não é letra, e «Olá!» escapava.
const SAUDACAO_SOZINHA =
  /^(ol[aá]|oi|bom dia|boa tarde|boa noite|boas)(?![a-zà-ÿ])[\s,!.]*(tudo bem|como est[aá]|espero que esteja bem)?[\s?!.,]*$/i;
const SAUDACAO_A_FRENTE = /^(ol[aá]|oi|bom dia|boa tarde|boa noite|boas)[\s,!.]+(?=\S)/i;
const SO_O_PEDIDO_DE_ORCAMENTO =
  /^(gostaria|gostava|queria|quero|venho|vinha)\s+(de\s+)?(pedir|solicitar)\s+(um\s+)?(or[cç]amento|valores?|pre[cç]o)(\s+(à|a|para\s+a)\s+clyon)?[\s.!]*$/i;
// Com o ponto ou o «!» do fim: «Obrigado!» ficava na descrição (26-10-2026).
const DESPEDIDA =
  /^(muito\s+)?(obrigad[oa]|cumprimentos|com os melhores cumprimentos|melhores cumprimentos|atenciosamente|abra[cç]os?|obg|bjs|beijinhos)\b[^.!?]{0,40}[.!]*$/i;

/**
 * A DESCRIÇÃO DE UMA MENSAGEM COMPRIDA — tudo o que ela diz do trabalho.
 *
 * Era só as frases com nomes de móveis. Do Gaspar ficou a lista das coisas,
 * e perdeu-se o que mais pesa numa mudança: «Preciso de um serviço que inclua
 * embalagem dos meus pertences», «Nao é necessário desembalar e arrumar»,
 * «Gostaria de receber duas opções de orçamento». Agora fica tudo, menos o
 * que já tem campo próprio ou não diz nada do trabalho: os cumprimentos, o
 * «gostava de pedir um orçamento», as moradas, o código postal, o nome da
 * assinatura e a pergunta do IVA (que se responde).
 *
 * Só há descrição se alguma frase falar mesmo de coisas ou do trabalho — senão
 * «Gostaria de saber o valor primeiro» passava a ser a descrição de alguém.
 */
function descricaoDaMensagem(texto: string, nome: string | undefined, morada?: string | null): string | null {
  const linhas: string[] = [];
  let falaDoTrabalho = false;
  /*
   * SEM A MORADA NO MEIO — 26-10-2026. Numa mensagem escrita de seguida, a
   * morada está a meio de uma frase («…na quinta-feira (29/10), Av. … 43, R/C
   * Esq, 1700-123 Lisboa (…). Vamos compactar…»), e a descrição ficava com
   * pedaços dela. Tira-se a morada inteira primeiro, e o resto lê-se direito.
   */
  const semMorada =
    morada && texto.includes(morada)
      ? texto
          .replace(morada, " ")
          .replace(/[ \t]*,[ \t]*(?=[.!?]|$)/gm, "")
          .replace(/[ \t]+([.!?,])/g, "$1")
          .replace(/[ \t]{2,}/g, " ")
      : texto;
  for (const linha of semMorada.split(/\n+/)) {
    const l = linha.trim();
    if (!l || ROTULO_DA_ORIGEM.test(l) || ROTULO_DO_DESTINO.test(l)) continue;
    const ficam = frasesDe(l)
      .map((f) => f.replace(SAUDACAO_A_FRENTE, "").trim())
      .filter((f) => {
        if (!f || SAUDACAO_SOZINHA.test(f) || SO_O_PEDIDO_DE_ORCAMENTO.test(f) || DESPEDIDA.test(f)) return false;
        if (nome && semAcentos(f).replace(/[.!,]+$/, "") === semAcentos(nome)) return false;
        if (CODIGO_POSTAL_SOLTO.test(comHifenNoCodigoPostal(f))) return false;
        if (falaDoIva(f)) return false;
        if (moradaNaFrase(f) && !falaDeCoisas(f)) return false;
        // As perguntas que a Vitória responde logo não são o trabalho (26-10-2026).
        if (/\?\s*$/.test(f) && (perguntaSeAceitam(f) || perguntaPelaHora(f))) return false;
        return true;
      });
    if (ficam.length === 0) continue;
    if (ficam.some((f) => falaDeCoisas(f))) falaDoTrabalho = true;
    linhas.push(ficam.join(" "));
  }
  return falaDoTrabalho ? linhas.join("\n").slice(0, 2000) : null;
}

/**
 * A FRASE DA DATA, e só a parte dela que diz quando.
 *
 * «Gostaria de pedir um orçamento para uma pequena mudança dentro dos Olivais,
 * em Lisboa, preferencialmente num sábado 31/10 ou domingo 01/11» — o
 * Gaspar. A frase inteira era cortada aos 120 caracteres ANTES de se ler a
 * data, e o corte caiu em «31/1»: o resumo disse «domingo, 31 de janeiro».
 * Agora escolhe-se a frase que tem uma data de verdade (um dia, um número) e
 * não a pergunta do «suplemento de fim de semana», e fica só a oração dela.
 */
function quandoDaMensagem(frases: string[]): string | null {
  const candidatas = frases.filter((f) => pareceQuando(f) && !perguntaPeloPreco(f));
  const concretas = candidatas.filter((f) =>
    /(?<!\d)\d{1,2}\s*[\/.-]\s*\d{1,2}(?![\d-])|\b(hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo)\b|(?<![\d])[2-6]\s*[ªa]?\s*-?\s*f(eira)?\b/.test(
      semAcentos(f),
    ),
  );
  /*
   * TODAS AS FRASES COM DATA, E NÃO SÓ A PRIMEIRA — 28-10-2026 (decisão d35).
   * «Idealmente na sexta-feira, 30 de outubro, ou no sábado, 31 de outubro.
   * No máximo, até domingo, 1 de novembro.» são duas frases, e a segunda (o
   * limite) perdia-se. Juntam-se pela ordem, com o «no máximo» de cada uma.
   */
  if (concretas.length > 1) {
    return concretas
      .map((f) => quandoDaFrase(f).replace(/[\s.!?]+$/, ""))
      .join("; ")
      .slice(0, 200);
  }
  const concreta = concretas[0] ?? candidatas[0];
  if (!concreta) return null;
  return quandoDaFrase(concreta).slice(0, 200);
}

/** O que diz QUANDO numa frase: as orações com data (e o «no máximo» à frente delas). */
function quandoDaFrase(concreta: string): string {
  const oracoes = concreta.split(/[,;]/).map((o) => o.trim()).filter(Boolean);
  const comData = oracoes.filter(
    (o) => pareceQuando(o) || /^(no maximo|o mais tardar|idealmente|de preferencia|preferencialmente)$/.test(semAcentos(o)),
  );
  let dito = comData.length > 0 ? comData.join(", ") : concreta;
  /*
   * O PARÊNTESE QUE FECHA SEM TER ABERTO — 26-10-2026. «(cartão, …; não é
   * entulho de obras) na quinta-feira (29/10)» partido nas vírgulas deu
   * «Quando: não é entulho de obras) na quinta-feira (29/10)». O que vem antes
   * desse «)» é de outra oração.
   */
  const fecho = dito.indexOf(")");
  if (fecho >= 0 && !dito.slice(0, fecho).includes("(")) dito = dito.slice(fecho + 1).trim() || dito;
  return dito;
}

/**
 * As frases de uma mensagem: as linhas, e os pontos finais seguidos de
 * maiúscula — menos os das abreviaturas («Av. da Liberdade», «S. Domingos»):
 * ver `ABREVIATURA_NO_FIM` (26-10-2026).
 */
function frasesDe(texto: string): string[] {
  const frases: string[] = [];
  for (const linha of texto.split(/\n+/)) {
    let inicio = 0;
    const corte = /(?<=[.!?])\s+(?=[A-ZÀ-Ý«"(])/g;
    for (const m of linha.matchAll(corte)) {
      const fim = m.index ?? 0;
      if (linha[fim - 1] === "." && ABREVIATURA_NO_FIM.test(linha.slice(0, fim - 1))) continue;
      frases.push(linha.slice(inicio, fim));
      inicio = fim + m[0].length;
    }
    frases.push(linha.slice(inicio));
  }
  return frases.map((f) => f.trim()).filter(Boolean);
}

/**
 * TUDO O QUE UMA MENSAGEM SOLTA DIZ — sem modelo nenhum.
 *
 * *«Olá! Gostava de pedir um orçamento à CLYON. Aqui está o sofá. Tirei duas
 * fotos porque é um sofa com chaise longue (...) A morada é Rua Tomás de
 * Lemos, N24, 1°esq. 1495-903 Algés. As medidas 2,35m x 0,89m x 0,68 m»*
 *
 * — o Emiliano, 09-10-2026. Sem o Gemini, desta mensagem só se aproveitou o
 * serviço, e perguntaram-lhe a seguir a morada, o andar e o que era para
 * levar — tudo o que lá estava.
 *
 * Devolve os campos crus, como o modelo os devolveria, para passarem pelos
 * MESMOS validadores (`fundirCampos`). Lê-se a primeira mensagem inteira, e
 * qualquer mensagem que não seja a resposta à pergunta que estava feita.
 */
export function lerMensagemLivre(texto: string): CamposCrus {
  const t = texto.trim();
  const k: CamposCrus = {};
  if (!t) return k;
  const servico = servicoPorPalavras(t);
  if (servico) k.servico = servico;
  const nome = nomeDoTexto(t);
  if (nome) k.nome = nome;

  // As moradas com rótulo primeiro — a de destino nunca é a da origem.
  const linhas = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const linhaDoDestino = linhas.find((l) => ROTULO_DO_DESTINO.test(l));
  const linhaDaOrigem = linhas.find((l) => ROTULO_DA_ORIGEM.test(l));
  if (linhaDoDestino) {
    const destino = linhaDoDestino.match(ROTULO_DO_DESTINO)![1].trim();
    if (destino.length >= 5) {
      k.moradaDestino = destino;
      const andarDestino = andarNaFrase(destino);
      if (andarDestino != null) k.andarDestino = andarEscrito(andarDestino);
    }
  }
  const semDestino = linhas.filter((l) => l !== linhaDoDestino).join("\n");
  const morada = linhaDaOrigem ? linhaDaOrigem.match(ROTULO_DA_ORIGEM)![1].trim() : moradaNaFrase(semDestino);
  if (morada) k.morada = morada;
  if (!morada || !CODIGO_POSTAL_SOLTO.test(comHifenNoCodigoPostal(morada))) {
    const cp = comHifenNoCodigoPostal(semDestino).match(/(?<!\d)(\d{4})-(\d{3})(?!\d)[ \t,]*([^\n,.;]*)/);
    // Também quando a morada veio noutra linha — a do Paço de Arcos escreveu a
    // rua numa e «2770-917 Paço de Arcos» duas linhas abaixo, e o código
    // postal perdia-se (20-10-2026).
    if (cp) k.codigoPostal = `${cp[1]}-${cp[2]} ${cp[3]}`.trim();
    else if (!cp) {
      // A localidade dita de passagem — «dentro dos Olivais, em Lisboa».
      const local = localidadeDita(semDestino);
      if (local) k.codigoPostal = local;
    }
  }
  const andar = andarNaFrase(morada ?? "") ?? andarNaFrase(semDestino);
  if (andar != null) k.andar = andarEscrito(andar);

  /*
   * «AMBOS OS PRÉDIOS TÊM ELEVADOR» — vale para a origem e para o destino.
   * O elevador e o estacionamento ditos assim, numa mudança, respondem às
   * duas perguntas de uma vez (ver `valeParaAmbos`).
   */
  for (const f of frasesDe(semDestino)) {
    if (!valeParaAmbos(f)) continue;
    const factos = factosSoltos(f);
    if (factos.hasElevator) {
      k.elevador = factos.hasElevator === "yes" ? "sim" : "não";
      k.elevadorDestino = k.elevador;
    }
    if (factos.parkingDistance) {
      k.estacionamento = factos.parkingDistance === "near" ? "sim" : "não";
      k.estacionamentoDestino = k.estacionamento;
    }
  }

  // A quantidade de entulho dita logo: «Recolha de 22 bigbags» — o Dinis. E
  // com o intervalo inteiro: «0,5 a 0,7 m³» ficava «0,7 m³» (26-10-2026).
  if (servico === "recolha_entulho") {
    const qt = volumeNaFrase(t);
    if (qt) k.entulho = qt;
  }
  const quando = quandoDaMensagem(frasesDe(t));
  if (quando) k.quando = quando;
  const descricao = descricaoDaMensagem(t, nome ?? undefined, linhaDaOrigem ? null : morada);
  if (descricao) k.descricao = descricao;
  return k;
}

/** As correcções no resumo: «morada …», «nome …», «andar …», «quando …», «descrição …». */
function corrigir(dados: DadosDaRecolha, texto: string, agora: Date): DadosDaRecolha | null {
  // [\s\S] em vez da flag /s: o alvo do TypeScript do projecto não a aceita.
  const m = texto.trim().match(/^([A-Za-zÀ-ú]+)[:\s]+([\s\S]+)$/);
  if (!m) return null;
  const campo = semAcentos(m[1]);
  const valor = m[2].trim();
  const d = { ...dados };
  if (campo === "nome") d.contactName = valor.slice(0, 120);
  else if (campo === "morada") {
    /*
     * O CÓDIGO POSTAL VEM NO MESMO SACO — 14-09-2026.
     *
     * Ela escreveu «Morada: Estrada do Vale do Lumiar, n47, 6D, 1600-913
     * Lisboa» e foi-lhe perguntado o código postal a seguir, duas vezes. E
     * desde 10-10-2026 a localidade é a que vem DEPOIS do código, e o andar
     * escrito na morada fica a ser o andar — ver `guardarMorada`.
     */
    guardarMorada(d, valor);
  } else if (campo === "destino") d.moradaDestino = valor.slice(0, 300);
  else if (/^(codigo|cp|postal|localidade)$/.test(campo)) {
    const { postalCode, city } = codigoPostalELocalidade(valor);
    if (postalCode) d.postalCode = postalCode;
    if (city) d.city = city;
  } else if (campo === "andar") d.floor = andarDaResposta(valor) ?? andarDoTexto(valor);
  else if (campo === "nif") {
    const nif = nifDaFactura(valor);
    if (!nif) return null;
    d.precisaFatura = true;
    d.nifFactura = nif;
  } else if (campo === "elevador") d.hasElevator = simOuNao(valor) === "sim" ? "yes" : "no";
  else if (/^(estacionar|estacionamento)$/.test(campo)) d.parkingDistance = simOuNao(valor) === "sim" ? "near" : "far";
  else if (campo === "quando" || campo === "data") {
    guardarOQuando(d, valor, agora);
  } else if (/^(descricao|descri)/.test(campo)) d.description = valor.slice(0, 4000);
  else if (/^(factura|fatura)$/.test(campo)) d.precisaFatura = simOuNao(valor) === "sim";
  else if (/^(servico|serviço)$/.test(campo)) {
    const s = servicoDoTexto(valor);
    if (!s) return null;
    d.serviceType = s;
  } else if (campo === "entulho") d.entulhoQuantidade = valor.slice(0, 60);
  else return null;
  return d;
}

/** O que o chamador lê do fio e a função pura não pode ler sozinha. */
export type ContextoDaRecolha = {
  /** Quantas fotografias ele já mandou nesta conversa. Ver `fotosNoFio`. */
  fotos?: number;
  /** Já se lhe explicou como chega o preço? Ver `jaExplicouOPreco`. */
  jaExplicouOPreco?: boolean;
  /** O que se viu nas fotografias desta rajada — ver `aplicarOQueSeViu` (21-10-2026). */
  visto?: string[];
  /** A lista numerada que ele viu, para ler o número dele — ver `servicosDaListaNoFio` (25-10-2026). */
  lista?: readonly string[] | null;
  /**
   * A PERGUNTA EM CIMA AINDA NÃO SAIU — 27-10-2026 (decisão d2). Ou a rajada
   * respondeu à que estava feita e passou à seguinte (`lerAsPartesDaRajada`),
   * ou a pergunta de antes calou-se porque ele ainda estava a escrever (ver
   * `rajada-em-curso.ts`). Nesse caso não há «Peço desculpa, não apanhei»:
   * ninguém lha fez — faz-se agora, pela primeira vez.
   */
  perguntaPorFazer?: boolean;
};

/** As perguntas que se respondem com sim ou não. */
const DE_SIM_OU_NAO: PassoDaRecolha[] = [
  "elevador",
  "estacionamento",
  "elevadorDestino",
  "estacionamentoDestino",
  "fatura",
];

/** Um sim ou um não CURTO — «Sim», «Não», «ok». Uma frase comprida não conta. */
function simOuNaoCurto(texto: string): "sim" | "nao" | null {
  if (texto.trim().split(/\s+/).length > 3) return null;
  return simOuNao(texto);
}

/**
 * A RESPOSTA ATRASADA — 10-10-2026.
 *
 *   CLYON:   Dá para estacionar à porta? Responda sim ou não.
 *   CLIENTE: Depende de como estiver no momento os lugares
 *   CLYON:   Para quando precisa?
 *   CLIENTE: Sim
 *   CLYON:   Conte-me o que há para levar ou fazer
 *   CLIENTE: 2ª feira
 *
 * — o Emiliano. Escrevia ao mesmo tempo que o assistente: o «Sim» era o do
 * estacionamento e ficou a ser a DATA dele; o «2ª feira» era a data e ficou a
 * ser a descrição. No resumo: «Quando: Sim», «Descrição: 2ª feira».
 *
 * Um sim ou um não sozinho, a uma pergunta que não é de sim ou não, pertence
 * à pergunta de sim ou não de ANTES — se essa tiver ficado por fechar.
 */
function passoDoSimAtrasado(passo: PassoDaRecolha, d: DadosDaRecolha): PassoDaRecolha | null {
  const ordem = ordemDosPassos(d);
  for (let i = ordem.indexOf(passo) - 1; i >= 0; i--) {
    const p = ordem[i];
    if (!DE_SIM_OU_NAO.includes(p)) continue;
    if (p === "estacionamento" && (d.parkingDistance === null || d.parkingDistance === undefined)) return p;
    if (p === "elevador" && d.hasElevator == null && d.floor !== "0" && !d.clienteCarrega) return p;
    if (p === "estacionamentoDestino" && d.estacionamentoDestino == null) return p;
    if (p === "elevadorDestino" && d.elevadorDestino == null && d.andarDestino !== "0") return p;
    if (p === "fatura" && d.precisaFatura === undefined) return p;
    return null;
  }
  return null;
}

function aplicarSimOuNao(passo: PassoDaRecolha, r: "sim" | "nao", d: DadosDaRecolha): void {
  if (passo === "elevador") d.hasElevator = r === "sim" ? "yes" : "no";
  else if (passo === "estacionamento") d.parkingDistance = r === "sim" ? "near" : "far";
  else if (passo === "elevadorDestino") d.elevadorDestino = r === "sim" ? "yes" : "no";
  else if (passo === "estacionamentoDestino") d.estacionamentoDestino = r === "sim" ? "near" : "far";
  else if (passo === "fatura") d.precisaFatura = r === "sim";
}

/**
 * O ESTACIONAMENTO POR SABER — «depende», «às vezes», «é uma rua chata».
 *
 *   CLIENTE: É uma rua chata para estacionar. Pode dar para parar em frente ou nao.
 *   CLYON:   Dá para estacionar à porta? Responda sim ou não.
 *
 * — o Emiliano. Ele respondeu, e com mais verdade do que um sim: depende. A
 * ordem de responder como uma máquina era o assistente a não ouvir. Fica «a
 * confirmar», e o profissional vê-o.
 */
function estacionamentoIncerto(texto: string): boolean {
  return /\b(depende|talvez|nao sei|as vezes|nem sempre|ou nao|chata|complicad\w*|apertad\w*|nao garanto|conforme)\b/.test(
    semAcentos(texto),
  );
}

/**
 * O ELEVADOR NUMA RESPOSTA — "yes", "no", "rc" (disse que é r/c: o elevador
 * deixa de interessar), ou `null` quando a resposta não é sobre isto.
 */
function elevadorDaResposta(t: string, factos: FactosSoltos): "yes" | "small" | "no" | "rc" | null {
  const chave = semAcentos(t).replace(/[.!,]+$/, "");
  const lido = ((): "yes" | "no" | "rc" | null => {
    const r = simOuNao(t);
    if (r) return r === "sim" ? "yes" : "no";
    // «o entulho encontra-se na rua», «não é preciso elevador», «ambos têm elevador».
    if (factos.hasElevator === "yes" || factos.hasElevator === "no") return factos.hasElevator;
    if (andarNaFrase(t) === "0") return "rc";
    if (/\bnao\s+(e\s+|eh\s+)?(preciso|necessario|precisa)\b|\bnao faz falta\b/.test(chave)) return "no";
    return null;
  })();
  /*
   * O ELEVADOR PEQUENO — «Temos elevador, mas é pequeno, móveis grandes não
   * passam» (a Rosana, 13-10-2026). O pedido tem o valor para isto («small»,
   * como no simulador), e é o que muda a conta: o que não cabe desce a pé.
   */
  if (lido === "yes" && /\b(pequen\w*|apertad\w*|estreit\w*|nao (cabe|cabem|passa|passam))\b/.test(chave)) return "small";
  return lido;
}

/**
 * A uma pergunta que não é do formulário: a disponibilidade, a hora e o
 * material têm resposta (26-10-2026); depois, o que o site diz e as lições
 * aprovadas pela equipa, e a resposta livre do modelo, já guardada
 * (27-10-2026, decisão d11). Só o resto fica anotado para uma pessoa da CLYON.
 */
function respostaAUmaPergunta(t: string, d: DadosDaRecolha, livre?: string | null): string {
  return respostasAsPerguntas(t, d) || respostaDoSiteOuDasLicoes(t) || livre || PERGUNTA_ANOTADA;
}

/** Fala de doar ou de vender o que é para levar — ver o Josué, 13-10-2026. */
function falaDeDoarOuVender(texto: string): boolean {
  return /\b(doar|doacao|doa-l[oa]s?|oferecer|vender|venda)\b/.test(semAcentos(texto));
}

/** Junta uma frase à descrição, sem a repetir e sem a marca das fotografias. */
function juntarADescricao(atual: string | undefined, t: string): string {
  if (!atual || atual === DESCRICAO_DAS_FOTOS) return t.slice(0, 4000);
  return atual.includes(t) ? atual : `${atual}\n${t}`.slice(0, 4000);
}

/**
 * O QUE ELE CONTOU DO ACESSO, para lá do sim ou do não — «mas é pequeno,
 * móveis grandes não passam», «implica que esteja desocupado». Vai para o
 * pedido, para o profissional ler (ver `descricaoParaOPedido`).
 */
function anotarOAcesso(d: DadosDaRecolha, rotulo: string, t: string): void {
  const dito = t.replace(/\s*\n+\s*/g, " ").trim();
  if (dito.split(/\s+/).length < 5) return;
  const linha = `${rotulo}: ${dito}`;
  if ((d.acessoDito ?? "").includes(dito)) return;
  d.acessoDito = (d.acessoDito ? `${d.acessoDito}\n${linha}` : linha).slice(0, 600);
}

/**
 * O ESTACIONAMENTO NUMA RESPOSTA — "near", "far", `null` (por saber), ou
 * `undefined` quando a resposta não é sobre isto.
 *
 *   CLYON:   Dá para encostar a carrinha à porta, ou fica longe?
 *   CLIENTE: A porta de ambos
 *   CLYON:   Desculpe, não percebi: a carrinha consegue parar perto da porta?
 *
 * — o Gaspar, 10-10-2026. «À porta» é a resposta inteira, com a palavra da
 * própria pergunta.
 */
/**
 * OS METROS ATÉ À PORTA — «uns 50 metros», «like 50 meters», «à 30 mètres»
 * (28-10-2026, decisão d35). Null quando não disse um número de metros.
 */
export function metrosNaFrase(texto: string | null | undefined): number | null {
  const m = semAcentos(texto ?? "").match(/(?<![\d,.])(\d{1,4})\s*(m|mt|mts|metros?|meters?|metres?)(?![a-z0-9²³])/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 && n <= 2000 ? n : null;
}

/** «a carrinha fica a cerca de 50 m» — como o resumo e a descrição o dizem. */
export function aCarrinhaFicaA(metros: number): string {
  return `a carrinha fica a cerca de ${metros} m`;
}

function estacionamentoDaResposta(t: string, factos: FactosSoltos): "near" | "far" | null | undefined {
  const chave = semAcentos(t).replace(/[.!,]+$/, "");
  // «Não sei bem, às vezes há lugar» começa por «não», e não é um não.
  if (/^nao sei\b|^talvez\b|^depende\b|\b(as vezes|nem sempre)\b/.test(chave)) return null;
  if (
    /^(sim,?\s*)?(mesmo\s+|logo\s+)?(a|na|junto a|junto da|em frente a|em frente da|em frente ao)\s+(porta|entrada|predio)\b/.test(chave) ||
    /^(sim,?\s*)?(mesmo\s+)?em frente\b/.test(chave)
  ) {
    return "near";
  }
  /*
   * A DISTÂNCIA EM METROS — «20 metros da porta» (o Josué, 13-10-2026), que
   * acabava na descrição como se fosse a medida de um móvel. Como no
   * simulador: até 20 metros é perto; mais de 30 é longe. E ANTES do sim ou
   * do não (28-10-2026, d35): «Yes like 50 meters» é «fica a 50 m», e não
   * «à porta». O número fica em `metrosAtePorta`.
   */
  const metros = metrosNaFrase(t);
  if (metros != null) return metros <= 25 ? "near" : "far";
  const r = simOuNao(t);
  if (r) return r === "sim" ? "near" : "far";
  // «Tem estacionamento no local», «é difícil estacionar».
  if (factos.parkingDistance !== undefined) return factos.parkingDistance as "near" | "far" | null;
  if (estacionamentoIncerto(t)) return null;
  return undefined;
}

/** O NIF escrito na mesma frase, com ou sem espaços. */
function nifNaFrase(texto: string): string | null {
  const m = texto.match(/(?<!\d)\d(?:[\s.]?\d){8}(?![\d])/);
  return m ? nifDaFactura(m[0]) : null;
}

/**
 * O algarismo de controlo do NIF bate certo? Só para o NIF apanhado no MEIO
 * de outra resposta («Sim, o NIF é …»): aí um número de telefone também tem
 * nove algarismos. À pergunta do NIF vale a regra do site — nove algarismos.
 */
function nifComControloCerto(nif: string): boolean {
  const a = nif.split("").map(Number);
  let soma = 0;
  for (let i = 0; i < 8; i++) soma += a[i] * (9 - i);
  const resto = soma % 11;
  return (resto < 2 ? 0 : 11 - resto) === a[8];
}

/**
 * O QUE SE APROVEITA de uma mensagem, para lá da resposta à pergunta.
 *
 * Junta-se só ao que está VAZIO — uma frase de passagem nunca desdiz uma
 * resposta. Excepto o nome DITO como nome («Sou o Bento»): esse corrige o que
 * lá estiver, porque é assim que o «Obrigado Bento» se teria corrigido.
 *
 * Devolve se mudou alguma coisa.
 */
function aproveitarOResto(d: DadosDaRecolha, texto: string, agora: Date): boolean {
  const antes = JSON.stringify(d);
  /*
   * A 2.ª MORADA DE RECOLHA PRIMEIRO — 29-10-2026. Lida como o resto, o
   * «6.º C» dela ia para o andar da morada principal. Fica à parte, e o resto
   * da mensagem lê-se como sempre.
   */
  const { segunda, resto } = separarASegundaMorada(texto, d.serviceType);
  if (segunda) {
    d.segundaMorada = segunda;
    texto = resto;
    if (!texto) return JSON.stringify(d) !== antes;
  }
  const lido = lerMensagemLivre(texto);
  const vazios: CamposCrus = {};
  if (lido.servico && !d.serviceType) vazios.servico = lido.servico;
  if (lido.morada && !d.address) vazios.morada = lido.morada;
  if (lido.codigoPostal && !(d.postalCode && d.city)) vazios.codigoPostal = lido.codigoPostal;
  if (lido.andar && d.floor == null) vazios.andar = lido.andar;
  if (lido.elevador && d.hasElevator == null) vazios.elevador = lido.elevador;
  if (lido.estacionamento && d.parkingDistance == null) vazios.estacionamento = lido.estacionamento;
  if (lido.moradaDestino && !d.moradaDestino) vazios.moradaDestino = lido.moradaDestino;
  if (lido.andarDestino && d.andarDestino == null) vazios.andarDestino = lido.andarDestino;
  if (lido.elevadorDestino && d.elevadorDestino == null) vazios.elevadorDestino = lido.elevadorDestino;
  if (lido.estacionamentoDestino && d.estacionamentoDestino == null) {
    vazios.estacionamentoDestino = lido.estacionamentoDestino;
  }
  if (lido.quando && !d.quandoTexto) vazios.quando = lido.quando;
  if (lido.entulho && !d.entulhoQuantidade) vazios.entulho = lido.entulho;
  if (lido.descricao && (!d.description || d.description === DESCRICAO_DAS_FOTOS)) {
    vazios.descricao = lido.descricao;
  }
  Object.assign(d, fundirCampos(d, vazios, agora));
  if (lido.nome) d.contactName = lido.nome;
  juntarFactos(d, factosSoltos(texto));
  lerOVolumeEQuemCarrega(d, texto);
  return JSON.stringify(d) !== antes;
}

/**
 * O QUE ELE DIZ A UM PEDIDO QUE JÁ EXISTE — 26-10-2026 (decisão d30).
 *
 * Junta-se só ao que está vazio: o que o pedido já tem não se desdiz por uma
 * frase de passagem (a equipa vê a conversa). O que ele conta do trabalho
 * junta-se à descrição desta conversa, que a Vitória arruma para o
 * profissional (`descricao-do-pedido.ts`). Os campos do modelo, quando os
 * há, passam pelos validadores de sempre (`fundirCampos`). Devolve se mudou.
 */
export function juntarAoPedidoOQueDisse(
  d: DadosDaRecolha,
  texto: string,
  agora: Date,
  campos?: CamposCrus | null,
): boolean {
  let t = texto.trim();
  if (!t) return false;
  const antes = JSON.stringify(d);
  // A 2.ª morada fica à parte, e a frase dela não vai para a descrição (a rua não sai para os profissionais).
  const { segunda, resto } = separarASegundaMorada(t, d.serviceType);
  if (segunda) {
    d.segundaMorada = segunda;
    t = resto;
    if (!t) return JSON.stringify(d) !== antes;
    campos = null;
  }
  if (campos) {
    const vazios: CamposCrus = {};
    if (campos.nome && !d.contactName) vazios.nome = campos.nome;
    if (campos.morada && !d.address) vazios.morada = campos.morada;
    if (campos.codigoPostal && !(d.postalCode || d.city)) vazios.codigoPostal = campos.codigoPostal;
    if (campos.andar && d.floor == null) vazios.andar = campos.andar;
    if (campos.elevador && d.hasElevator == null) vazios.elevador = campos.elevador;
    if (campos.estacionamento && d.parkingDistance === undefined) vazios.estacionamento = campos.estacionamento;
    if (campos.quando && !d.quandoTexto) vazios.quando = campos.quando;
    if (campos.entulho && !d.entulhoQuantidade) vazios.entulho = campos.entulho;
    Object.assign(d, fundirCampos(d, vazios, agora));
  }
  /*
   * O QUE NÃO É PARA FAZER vai tal e qual para as notas — 27-10-2026 (d2).
   * «Só não é preciso tirar o frigorífico» lido como as outras coisas punha o
   * frigorífico no «Para levar».
   */
  const partes = t.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const excluidas = partes.filter((p) => excluiDoTrabalho(p));
  if (excluidas.length > 0) {
    for (const p of excluidas) juntarNota(d, p);
    const resto = partes.filter((p) => !excluiDoTrabalho(p)).join("\n");
    if (resto) juntarAoPedidoOQueDisse(d, resto, agora, null);
    return JSON.stringify(d) !== antes;
  }
  const descricaoAntes = d.description;
  aproveitarOResto(d, t, agora);
  const meta = fugiuAoNome(t) || jaFezOPedido(t);
  const contaAlgo =
    !meta &&
    (falaDeCoisas(t) || falaDoAcesso(t) || falaDeDoarOuVender(t) || clienteCarrega(t) || volumeNaFrase(t) != null);
  // `aproveitarOResto` só escreve a descrição vazia; aqui o que ele conta junta-se sempre.
  if (contaAlgo && d.description === descricaoAntes) {
    d.description = juntarADescricao(d.description, lerMensagemLivre(t).descricao ?? t);
  }
  if (remeteParaAsFotos(t)) d.fotosDitas = true;
  return JSON.stringify(d) !== antes;
}

/** Junta uma nota dele, tal e qual, sem a repetir — ver `notas`. */
export function juntarNota(d: DadosDaRecolha, nota: string): void {
  const n = nota.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!n) return;
  const antes = d.notas ?? [];
  if (antes.includes(n)) return;
  d.notas = [...antes, n].slice(-10);
}

/**
 * UMA LOCALIDADE SOZINHA — «Algés», «Vila Franca de Xira» — 27-10-2026.
 *
 * A cliente do #853 escreveu o código postal e, no mesmo minuto, a
 * localidade, em duas mensagens. Uma palavra ou três, sem algarismos, que se
 * lê como um nome — e não um sim, uma data, coisas, nem o acesso.
 */
export function localidadeSolta(texto: string): boolean {
  const t = texto.trim().replace(/[.!]+$/, "");
  if (!t || t.length < 2 || t.length > 40 || /\d|\?/.test(t)) return false;
  if (t.split(/\s+/).length > 4) return false;
  if (simOuNao(t) || pareceQuando(t) || falaDeCoisas(t) || falaDoAcesso(t) || perguntaPeloPreco(t)) return false;
  if (soQuerOOrcamento(t) || excluiDoTrabalho(t)) return false;
  return nomeDoTexto(t.replace(/[\/-]/g, " "), true) != null;
}

/** «Consegue se tiver vaga», «há lugar à porta» — a resposta à carrinha, dita fora da vez. */
function falaDaVagaAPorta(texto: string): boolean {
  return /\b(vagas?|estaciona\w*|lugar(es)?|encostar|a porta|na porta|em frente)\b/.test(semAcentos(texto));
}

/**
 * A RESPOSTA A UMA PERGUNTA DE ANTES — 27-10-2026 (decisão d2, o #853).
 *
 * «Algés» chegou depois do código postal, quando a pergunta em cima já era
 * outra; «Consegue se tiver vaga» chegou depois da descrição, a citar a
 * pergunta da carrinha. As duas ficam no campo delas, e não se perguntam
 * outra vez. Só o que está vazio. Devolve se mudou.
 */
export function aproveitarRespostaAtrasada(d: DadosDaRecolha, texto: string): boolean {
  const t = texto.trim();
  if (!t) return false;
  if (d.postalCode && !d.city && localidadeSolta(t)) {
    d.city = t.replace(/[.!]+$/, "").trim();
    return true;
  }
  if (d.parkingDistance === undefined && falaDaVagaAPorta(t)) {
    const e = estacionamentoDaResposta(t, factosSoltos(t));
    if (e !== undefined) {
      d.parkingDistance = e;
      anotarOAcesso(d, "Estacionamento", t);
      return true;
    }
  }
  return false;
}

/**
 * O QUE NÃO RESPONDE À PERGUNTA, MAS FICA — as coisas para levar, a data, o
 * que não é para fazer, a resposta a uma pergunta de antes. Devolve se mudou.
 */
function anotarOQueNaoResponde(d: DadosDaRecolha, t: string, agora: Date): boolean {
  const antes = JSON.stringify(d);
  if (excluiDoTrabalho(t)) {
    juntarNota(d, t);
    return true;
  }
  if (aproveitarRespostaAtrasada(d, t)) return true;
  if (!d.quandoTexto && pareceQuando(t) && !falaDeCoisas(t) && t.length <= 60) {
    guardarOQuando(d, t, agora);
  }
  if (falaDeCoisas(t) && !moradaNaFrase(t)) d.description = juntarADescricao(d.description, t);
  if (remeteParaAsFotos(t)) d.fotosDitas = true;
  aproveitarOResto(d, t, agora);
  return JSON.stringify(d) !== antes;
}

/** Esta mensagem já está no que se sabe, tal e qual — a descrição, a data, a morada, as notas. */
function jaSeSabe(d: DadosDaRecolha, parte: string): boolean {
  const p = parte.trim();
  if (p.length < 2) return false;
  return (
    (d.description ?? "").includes(p) ||
    d.quandoTexto === p ||
    d.address === p ||
    d.city === p ||
    (d.postalCode != null && p.replace(/\s/g, "") === d.postalCode) ||
    (d.notas ?? []).includes(p) ||
    (d.acessoDito ?? "").includes(p)
  );
}

/** As frases que mandam sobre a conversa: lêem-se no fim, com a resposta inteira. */
function eParaOFim(t: string): boolean {
  const chave = semAcentos(t).replace(/[.!,]+$/, "");
  return (
    reclamaDoAtendimento(t) ||
    pedeUmaPessoa(t) ||
    naoPercebeu(t) ||
    desisteDoPedido(t) ||
    soQuerOOrcamento(t) ||
    eUmaPergunta(t) ||
    perguntaPeloPreco(t) ||
    /^(recomecar|reiniciar|comecar de novo|do inicio|cancelar|parar|deixa|deixa estar|esquece|nao quero)$/.test(chave)
  );
}

export type PartesDaRajada = {
  /** O que se sabe depois das mensagens que já se leram. */
  estado: EstadoDaRecolha;
  /** O que fica para ler como sempre: a última mensagem, e as que não se perceberam. */
  texto: string;
  /** A pergunta em cima ainda não saiu — ver `ContextoDaRecolha.perguntaPorFazer`. */
  perguntaPorFazer: boolean;
};

/**
 * A RAJADA, MENSAGEM A MENSAGEM — 27-10-2026 (decisão d2, o pedido #853).
 *
 * *«Antes de escolher a próxima pergunta, recalcular o que já se sabe com
 * TODAS as mensagens do cliente desde a última resposta da Vitória.»* A
 * rajada juntava-as numa linha cada, e o texto todo era lido como UMA
 * resposta à pergunta em cima: «retirar toda a mobília…» + «Consegue se
 * tiver vaga» não era resposta à carrinha (a primeira linha é a descrição), e
 * a pergunta repetia-se; «O quanto antes» + «Só preciso do orçamento» a
 * seguir à pergunta da data dava a data e, logo, «não apanhei» à factura que
 * nunca se tinha perguntado.
 *
 * Lê-se cada mensagem pela ordem, contra a pergunta que está em cima NAQUELE
 * momento: a que responde fica no campo e a pergunta avança; a que não
 * responde mas conta alguma coisa (as coisas, a data, a vaga, a localidade)
 * fica anotada. A última, e as que não se perceberam, seguem para a leitura
 * de sempre (com o modelo ou sem ele) — que já não volta a ler o que ficou.
 *
 * Pura. Uma mensagem só, o serviço por saber ou o resumo à espera: devolve
 * tudo como veio.
 */
export function lerAsPartesDaRajada(
  estado: EstadoDaRecolha,
  texto: string,
  agora: Date = new Date(),
  /** A pergunta em cima saiu mesmo para ele? Ver `aPerguntaFoiFeita`. */
  perguntaFeita = true,
): PartesDaRajada {
  const partes = texto
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const fora = estado.passo === "servico" || estado.passo === "confirmar" || estado.dados.aConfirmarDesistencia === true;
  if (partes.length < 2 || fora) return { estado, texto, perguntaPorFazer: !perguntaFeita };
  let atual = estado;
  const ficam: string[] = [];
  for (const parte of partes.slice(0, -1)) {
    if (atual.passo === "servico" || atual.passo === "confirmar" || eParaOFim(parte)) {
      ficam.push(parte);
      continue;
    }
    const d: DadosDaRecolha = { ...atual.dados };
    const factos = factosSoltos(parte);
    if (lerAResposta(atual.passo, parte, d, agora, factos)) {
      juntarFactos(d, factos);
      lerOVolumeEQuemCarrega(d, parte);
      atual = { passo: primeiroPassoEmFalta(d), dados: d };
      continue;
    }
    const anotado: DadosDaRecolha = { ...atual.dados };
    if (anotarOQueNaoResponde(anotado, parte, agora)) {
      atual = { passo: primeiroPassoEmFalta(anotado), dados: anotado };
      continue;
    }
    // Já se sabe — foi lida pela execução de antes, cuja pergunta se calou (ver `rajada-em-curso.ts`).
    if (jaSeSabe(atual.dados, parte)) continue;
    ficam.push(parte);
  }
  ficam.push(partes[partes.length - 1]);
  return { estado: atual, texto: ficam.join("\n"), perguntaPorFazer: !perguntaFeita || atual.passo !== estado.passo };
}

/** A nota do preço a quem disse que só quer o orçamento: grátis e sem compromisso. */
function notaDeQuemSoQuerOOrcamento(jaExplicado: boolean): string {
  return `Claro! ${jaExplicado ? LEMBRETE_DO_PRECO : COMO_CHEGA_O_PRECO}\n\n`;
}

/**
 * «SÓ PRECISO DO ORÇAMENTO», numa das mensagens da rajada — 27-10-2026 (d2).
 * Fica nas notas, e devolve-se o resto da mensagem para se ler como sempre;
 * ou `null`, quando não o disse (ou ainda não se sabe o serviço, ou é o
 * resumo — aí a conversa inteira responde).
 */
function soOrcamentoNaRajada(estado: EstadoDaRecolha, t: string): { dados: DadosDaRecolha; resto: string } | null {
  if (estado.passo === "servico" || estado.passo === "confirmar") return null;
  const partes = t.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const ditas = partes.filter((p) => soQuerOOrcamento(p));
  if (ditas.length === 0) return null;
  const dados: DadosDaRecolha = { ...estado.dados };
  for (const p of ditas) juntarNota(dados, p);
  return { dados, resto: partes.filter((p) => !soQuerOOrcamento(p)).join("\n") };
}

/**
 * O VOLUME E QUEM CARREGA, DITOS EM QUALQUER MENSAGEM — 26-10-2026.
 *
 * «Vamos compactar tudo, ficará cerca de 0,5 a 0,7 m³» e, mais à frente,
 * «Nós próprios carregamos tudo». Lê-se em todas as mensagens, pelos dois
 * caminhos, e só preenche o que está vazio. Num entulho, o volume é a
 * quantidade — e não se volta a perguntar.
 */
export function lerOVolumeEQuemCarrega(d: DadosDaRecolha, texto: string): void {
  const volume = volumeNaFrase(texto);
  if (volume && !d.volumeDito) d.volumeDito = volume.slice(0, 60);
  if (d.serviceType === "recolha_entulho" && !d.entulhoQuantidade && d.volumeDito) {
    d.entulhoQuantidade = d.volumeDito;
  }
  if (d.clienteCarrega !== true && clienteCarrega(texto)) d.clienteCarrega = true;
}

/**
 * AS PERGUNTAS DIRECTAS, RESPONDIDAS — a disponibilidade, a hora e o
 * material (26-10-2026: «Aceitam este tipo de material? […] a janela horária
 * na quinta?»). Vazio quando não perguntou nada disto.
 */
export function respostasAsPerguntas(
  texto: string,
  d: DadosDaRecolha,
  /** Já se disse «Fazemos, sim!» — o sim ao material seria o mesmo sim outra vez. */
  jaDisseQueFazemos = false,
): string {
  if (!texto) return "";
  const temData = Boolean(d.quandoTexto);
  const hora = perguntaPelaHora(texto);
  // Com a hora e o dia dito, a frase da hora já diz que o dia fica anotado.
  const disponibilidade = perguntaPelaDisponibilidade(texto) && !(hora && temData);
  const material = perguntaSeAceitam(texto) ? respostaAoMaterial(texto) : null;
  return [
    material && !(jaDisseQueFazemos && material.startsWith("Sim")) ? material : null,
    disponibilidade ? respostaADisponibilidade(temData) : null,
    hora ? respostaAHora(temData) : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * À SEGUNDA VEZ SEM SE PERCEBER, oferece-se uma pessoa — e a frase fica
 * diferente da primeira, que o envio calaria por repetida (`jaFoiDito`).
 */
/** Ele disse alguma coisa da morada, e falta a rua: diz-se o que falta, sem desculpas. */
const SO_FALTA_A_RUA =
  "Só me falta a rua e o número da porta, por favor — é por aí que o parceiro se orienta.";

const OFERECER_UMA_PESSOA =
  "\n\nSe preferir, escreva «falar com alguém» e passo a conversa a uma pessoa da CLYON.";

/**
 * A PERGUNTA OUTRA VEZ, por outras palavras.
 *
 * O envio cala uma mensagem igual a outra recente (`jaFoiDito`), e quem não
 * percebeu a pergunta da primeira vez também não a percebe igual. E nada de
 * «Responda sim ou não» onde se pode perguntar como gente.
 *
 * E COM DELICADEZA — 13-10-2026. «Preciso da rua e do número» foi o que o
 * Abílio leu depois de escrever a morada inteira; na avaliação chamou-lhe
 * arrogância. Quem não percebeu fomos nós: pede-se desculpa, e pede-se por
 * favor (ver `voz-da-vitoria`).
 */
function outraVez(passo: PassoDaRecolha, d: DadosDaRecolha): string {
  switch (passo) {
    case "nome":
      return "Peço desculpa, não apanhei bem o seu nome. Como se chama?";
    case "morada":
      return "Peço desculpa, não apanhei bem a rua e o número da porta. Pode escrevê-los outra vez, por favor? É por aí que o parceiro se orienta.";
    case "codigoPostal":
      return d.postalCode
        ? "Peço desculpa, não apanhei bem. Qual é a localidade?"
        : "Peço desculpa, não apanhei bem o código postal. Pode escrevê-lo outra vez, por favor?";
    case "moradaDestino":
      return "A rua e o número do destino, por favor.";
    case "codigoPostalDestino":
      return "O código postal e a localidade do destino, por favor.";
    case "andar":
      return "Peço desculpa, não percebi bem o andar. É rés-do-chão, ou que andar é?";
    case "elevador":
      return "Peço desculpa, não percebi bem: o prédio tem elevador?";
    case "estacionamento":
      return "Peço desculpa, não percebi bem: a carrinha consegue parar perto da porta?";
    case "andarDestino":
      return "Peço desculpa, não percebi bem o andar no destino. É rés-do-chão, ou que andar é?";
    case "elevadorDestino":
      return "Peço desculpa, não percebi bem: no destino o prédio tem elevador?";
    case "estacionamentoDestino":
      return "Peço desculpa, não percebi bem: no destino, a carrinha consegue parar perto da porta?";
    case "entulhoQuantidade":
      return "Mais ou menos quantos sacos, ou quantos metros cúbicos? Uma ideia chega.";
    case "quando":
      return "Para que dia, mais ou menos? Se não houver pressa, diga-me também.";
    case "descricao":
      return "Diga-me, por palavras suas, o que é para levar ou fazer.";
    case "fatura":
      return `Peço desculpa, não percebi bem: deseja fatura? (aplica-se IVA de ${PERCENTAGEM_DO_IVA})`;
    case "nif":
      return "Peço desculpa, não consegui ler o NIF. São 9 algarismos — ou, se preferir, dá-mo depois.";
    case "servico":
      return `Peço desculpa, não percebi bem o que precisa. Diga-me por palavras suas — ou, se for mais fácil, responda com o número:\n${LISTA_DE_SERVICOS}`;
    case "confirmar":
      return "Se estiver tudo certo, é só responder SIM e fica registado. Se alguma coisa estiver mal, diga-me e eu corrijo.";
  }
}

/** A segunda maneira de perguntar o nome — a única outra vez que se pergunta (26-10-2026). */
export const NOME_DE_OUTRA_FORMA = "Só para o pedido ficar em seu nome: como se chama?";

/**
 * O NOME QUE NÃO VEIO — perguntado UMA vez de outra forma, e depois segue-se.
 * 26-10-2026 (decisão d30).
 *
 *   CLIENTE: Está a falar com a pessoa que pediu o orçamento!
 *   CLYON:   Peço desculpa, não apanhei bem. Com quem tenho o gosto de falar?
 *   CLIENTE: Consulte o pedido de orçamento. Está lá tudo. Fotos também.
 *
 * «Nunca pode levar a repetir a mesma pergunta» — o dono. À primeira, a
 * pergunta de outra forma; à segunda, o nome fica para depois (`saltados`) e
 * a conversa segue com o que falta. O pedido nasce com «Cliente WhatsApp», e a
 * equipa vê-o.
 */
function oNomeQueNaoVeio(d: DadosDaRecolha, texto: string): RespostaDaRecolha {
  const vezes = (d.tentativas?.nome ?? 0) + 1;
  if (vezes === 1) {
    const dd: DadosDaRecolha = { ...d, tentativas: { ...d.tentativas, nome: 1 } };
    const aFrente = fugiuAoNome(texto) || jaFezOPedido(texto) ? "Claro!" : "Peço desculpa!";
    return { estado: { passo: "nome", dados: dd }, resposta: `${aFrente} ${NOME_DE_OUTRA_FORMA}` };
  }
  const dd: DadosDaRecolha = {
    ...d,
    tentativas: { ...d.tentativas, nome: vezes },
    saltados: [...new Set([...(d.saltados ?? []), "nome" as PassoDaRecolha])],
  };
  const passo = primeiroPassoEmFalta(dd);
  return { estado: { passo, dados: dd }, resposta: `Sem problema, seguimos. ${perguntaParaContinuar(passo, dd)}` };
}

/**
 * A RESPOSTA À PERGUNTA QUE ESTAVA FEITA — e só ela.
 *
 * Devolve `true` quando o texto respondeu (e `d` ficou com a resposta), e
 * `false` quando não respondeu: aí quem chama vê se é outra coisa — um sim
 * atrasado, o nome dito tarde, uma pergunta pelo preço — antes de repetir.
 *
 * Cada passo aceita SÓ o que é dele. Era o contrário: qualquer texto ia para a
 * gaveta da pergunta em cima, e assim «Obrigado Bento» foi o nome, «Sou o
 * Bento» o andar, «Sim» a data e «2ª feira» a descrição.
 */
function lerAResposta(
  passo: PassoDaRecolha,
  t: string,
  d: DadosDaRecolha,
  agora: Date,
  factos: FactosSoltos,
): boolean {
  const chave = semAcentos(t).replace(/[.!,]+$/, "");
  switch (passo) {
    case "servico":
    case "confirmar":
      return false;
    case "nome": {
      const nome = nomeDoTexto(t, true);
      if (!nome) return false;
      d.contactName = nome;
      return true;
    }
    case "morada": {
      if (t.length < 5) return false;
      if (!/\d/.test(t) && !PALAVRAS_DE_MORADA.test(semAcentos(t))) return false;
      // Só o acesso, sem número nenhum: «tem rua estreita», não é a morada.
      if (Object.keys(factos).length > 0 && !/\d/.test(t)) return false;
      if (perguntaPeloPreco(t) && !temPalavraDeRua(t)) return false;
      guardarMorada(d, t);
      return true;
    }
    case "codigoPostal": {
      const { postalCode, city } = codigoPostalELocalidade(comHifenNoCodigoPostal(t));
      const localidade = city && nomeDoTexto(city.replace(/[\/-]/g, " "), true) ? city : null;
      if (!postalCode && !localidade) return false;
      if (postalCode) d.postalCode = postalCode;
      if (localidade) d.city = localidade;
      return true;
    }
    case "moradaDestino": {
      if (t.length < 5) return false;
      if (!/\d/.test(t) && !PALAVRAS_DE_MORADA.test(semAcentos(t))) return false;
      guardarMoradaDestino(d, t);
      return true;
    }
    case "codigoPostalDestino": {
      const { postalCode, city } = codigoPostalELocalidade(comHifenNoCodigoPostal(t));
      if (!postalCode && !city) return false;
      d.codigoPostalDestino = postalCode ?? d.codigoPostalDestino ?? null;
      d.localidadeDestino = city ?? d.localidadeDestino ?? null;
      return true;
    }
    case "andar": {
      const andar = andarDaResposta(t) ?? (estaNaRua(t) ? "0" : null);
      if (andar == null) return false;
      d.floor = andar;
      // «2º sem elevador» responde às duas de uma vez.
      if (/sem elevador/.test(chave)) d.hasElevator = "no";
      else if (/com elevador/.test(chave)) d.hasElevator = "yes";
      // E uma moradia responde sozinha — ver `eUmaMoradia`. O que está na rua
      // também — ver `estaNaRua`.
      else if (eUmaMoradia(t) || estaNaRua(t)) d.hasElevator = "no";
      return true;
    }
    case "elevador": {
      const e = elevadorDaResposta(t, factos);
      if (e == null) return false;
      // «Como está escrito acima é R/C» — o Bento. Ao nível da rua, o
      // elevador deixa de se perguntar (ver `respondido`).
      if (e === "rc") d.floor = "0";
      else {
        d.hasElevator = e;
        // «Ambos os prédios têm elevador» — numa mudança, vale para o destino.
        if (d.serviceType === "mudanca" && valeParaAmbos(t) && d.elevadorDestino == null) d.elevadorDestino = e;
      }
      anotarOAcesso(d, "Elevador", t);
      return true;
    }
    case "estacionamento": {
      const e = estacionamentoDaResposta(t, factos);
      if (e === undefined) return false;
      d.parkingDistance = e;
      const metros = metrosNaFrase(t);
      if (metros != null) d.metrosAtePorta = metros;
      anotarOAcesso(d, "Estacionamento", t);
      // «A porta de ambos» — o Gaspar, numa mudança: vale para as duas pontas.
      if (d.serviceType === "mudanca" && valeParaAmbos(t) && d.estacionamentoDestino === undefined) {
        d.estacionamentoDestino = e;
      }
      return true;
    }
    case "andarDestino": {
      const andar = andarDaResposta(t) ?? (estaNaRua(t) ? "0" : null);
      if (andar == null) return false;
      d.andarDestino = andar;
      if (/sem elevador/.test(chave)) d.elevadorDestino = "no";
      else if (/com elevador|tem elevador|ha elevador/.test(chave)) d.elevadorDestino = "yes";
      else if (eUmaMoradia(t)) d.elevadorDestino = "no";
      return true;
    }
    case "elevadorDestino": {
      const e = elevadorDaResposta(t, factos);
      if (e == null) return false;
      if (e === "rc") d.andarDestino = "0";
      else d.elevadorDestino = e;
      return true;
    }
    case "estacionamentoDestino": {
      const e = estacionamentoDaResposta(t, factos);
      if (e === undefined) return false;
      d.estacionamentoDestino = e;
      const metros = metrosNaFrase(t);
      if (metros != null) d.metrosAtePortaDestino = metros;
      return true;
    }
    case "entulhoQuantidade": {
      // Um «sim» sozinho não é uma quantidade — é a resposta atrasada de antes.
      if (simOuNaoCurto(t) && !/\d/.test(t)) return false;
      d.entulhoQuantidade = t.slice(0, 60);
      return true;
    }
    case "quando": {
      const curto = simOuNaoCurto(t);
      if (curto === "sim") return false;
      if (curto === "nao" && passoDoSimAtrasado("quando", d)) return false;
      if (
        !pareceQuando(t) &&
        (falaDoAcesso(t) || remeteParaAsFotos(t) || falaDeCoisas(t) || nomeDoTexto(t) != null || perguntaPeloPreco(t))
      ) {
        return false;
      }
      // «Não», à pergunta «Se não houver pressa, diga-me também», é sem pressa.
      const dito = curto === "nao" ? "sem pressa" : t;
      guardarOQuando(d, dito, agora);
      return true;
    }
    case "descricao": {
      if (remeteParaAsFotos(t)) {
        d.description = DESCRICAO_DAS_FOTOS;
        d.fotosDitas = true;
        return true;
      }
      if (t.length < 3 || simOuNaoCurto(t)) return false;
      if (pareceQuando(t) && !falaDeCoisas(t) && t.length <= 60) return false;
      if ((perguntaPeloPreco(t) || nomeDoTexto(t) != null) && !falaDeCoisas(t)) return false;
      d.description = t.slice(0, 4000);
      return true;
    }
    case "fatura": {
      // «Não quero vender só doar» não é um não à factura — o Josué.
      if (falaDeDoarOuVender(t) && !/factur|fatur|\bnif\b/.test(chave)) return false;
      const r = simOuNaoNaFactura(t);
      const lido = nifNaFrase(t);
      const nif = lido && nifComControloCerto(lido) ? lido : null;
      if (!r && !nif) return false;
      d.precisaFatura = r ? r === "sim" : true;
      if (nif && d.precisaFatura) d.nifFactura = nif;
      return true;
    }
    case "nif": {
      const nif = nifNaFrase(t);
      if (nif) {
        d.nifFactura = nif;
        return true;
      }
      if (/\d/.test(t)) return false;
      if (
        simOuNaoCurto(t) === "nao" ||
        /\b(depois|mais tarde|nao (sei|tenho|sei de cor|me lembro|preciso)|agora nao|outra altura|logo)\b/.test(chave)
      ) {
        d.nifFactura = null;
        return true;
      }
      return false;
    }
  }
}

/**
 * Um passo da conversa: o que a pessoa escreveu, dado o passo em que está.
 *
 * Três palavras funcionam em qualquer passo: «recomeçar» volta ao início,
 * «cancelar» desiste, e «falar com alguém» (ou «pessoa», «humano») entrega a
 * conversa a uma pessoa da CLYON.
 */
export function responderNaRecolha(
  estado: EstadoDaRecolha,
  texto: string,
  agora: Date = new Date(),
  /** Ja se disse «Aqui e a CLYON» nesta conversa? Ver `aberturaDaResposta`. */
  jaCumprimentou = false,
  /** Ja se disse que a CLYON nao compra? Ver `NAO_COMPRAMOS`. */
  jaDisseQueNaoCompra = false,
  /** As fotografias que ele mandou, e se já se lhe disse como chega o preço. */
  contexto: ContextoDaRecolha = {},
): RespostaDaRecolha {
  const t = texto.trim();
  const chave = semAcentos(t).replace(/[.!,]+$/, "");

  // Uma conversa gravada a meio de um passo que já não se faz — a factura e o
  // NIF, 13-10-2026 — segue para o que falta, sem repetir a pergunta.
  // A resposta que ainda vale aproveita-se: o NIF dado, ou o «depois».
  const passoQueJaNaoSeFaz = !ordemDosPassos(estado.dados).includes(estado.passo);
  if (passoQueJaNaoSeFaz) {
    const dados = { ...estado.dados };
    lerAResposta(estado.passo, t, dados, agora, factosSoltos(t));
    estado = { passo: primeiroPassoEmFalta(dados), dados };
  }

  const queixa = entregarQuemSeQueixa(estado, t);
  if (queixa) return queixa;

  // «Do you speak English?» e «como funciona?» — ver `antesDaResposta` (28-10-2026, d35).
  const antes = antesDaResposta(estado, t, agora, jaCumprimentou, true, (e, resto) =>
    responderNaRecolha(e, resto, agora, jaCumprimentou, jaDisseQueNaoCompra, contexto),
  );
  if (antes) return antes;

  // «Não entendi» não é uma resposta — ver `naoPercebeu` (23-10-2026).
  if (naoPercebeu(t)) return { estado, resposta: explicarDeNovo(estado.passo, estado.dados) };

  // «Só preciso do orçamento» não responde a pergunta nenhuma — ver `soOrcamentoNaRajada` (27-10-2026).
  const soOrcamento = soOrcamentoNaRajada(estado, t);
  if (soOrcamento) {
    const comNota: EstadoDaRecolha = { passo: estado.passo, dados: soOrcamento.dados };
    const nota = notaDeQuemSoQuerOOrcamento(contexto.jaExplicouOPreco === true);
    if (!soOrcamento.resto) {
      return { estado: comNota, resposta: nota + perguntaDo(estado.passo, comNota.dados, false, agora) };
    }
    const r = responderNaRecolha(comNota, soOrcamento.resto, agora, jaCumprimentou, jaDisseQueNaoCompra, {
      ...contexto,
      jaExplicouOPreco: true,
    });
    return r.registar || r.pedirPessoa || r.desistir || !r.resposta ? r : { ...r, resposta: nota + r.resposta };
  }

  if (/^(recomecar|reiniciar|comecar de novo|do inicio)$/.test(chave)) {
    const novo = recolhaNova();
    return { estado: novo, resposta: `Claro, vamos recomeçar.\n\n${perguntaDo("servico", {})}` };
  }
  if (/^(cancelar|parar|deixa|deixa estar|esquece|nao quero)$/.test(chave)) {
    return { estado, resposta: FICA_SEM_EFEITO, desistir: true };
  }
  if (pedeUmaPessoa(t)) {
    return { estado, resposta: PASSO_A_ALGUEM_DA_EQUIPA, pedirPessoa: true };
  }

  /*
   * A DESISTÊNCIA POR PALAVRAS — ver `entregarQuemDesiste`. Só depois das
   * perguntas de sim ou não: «não preciso» à pergunta da factura é a resposta
   * dela, e não a desistência do pedido.
   */
  const respondeSimOuNao =
    (estado.passo === "fatura" && simOuNaoNaFactura(t) != null) ||
    ((estado.passo === "elevador" || estado.passo === "estacionamento") && simOuNao(t) != null);
  if (!respondeSimOuNao && desisteDoPedido(t)) return entregarQuemDesiste(estado);

  // A resposta à pergunta que já não se faz não se aproveita: mostra-se o que
  // falta — quase sempre o resumo, que ele ainda não viu.
  if (passoQueJaNaoSeFaz) {
    const preco = notaDoPrecoPara(t, estado.passo, contexto.jaExplicouOPreco === true, estado.dados.serviceType);
    return { estado, resposta: preco + perguntaDo(estado.passo, estado.dados, false, agora) };
  }

  /*
   * QUANDO ELA DIZ O CAMPO, É ESSE QUE SE PREENCHE — 14-09-2026.
   *
   * A conversa da Eva Raquel Pestana, às 16:07. Ela escreveu «Morada:
   * Estrada do Vale do Lumiar, n47, 6D, 1600-913 Lisboa» enquanto a pergunta
   * pendente era «Com quem estou a falar?» — e a morada inteira foi gravada
   * como o NOME dela. A seguir, «É um apartamento e tem elevador» virou a
   * morada.
   *
   * A causa não era não perceber: era perguntar e depois arrumar a mensagem
   * SEGUINTE na gaveta da pergunta, fosse ela qual fosse. Num WhatsApp
   * ninguém responde por ordem — responde-se à terceira pergunta atrás, com o
   * campo escrito à frente, como ela fez seis vezes.
   *
   * O leitor de rótulos corre SEMPRE, e devolve `null` quando o rótulo não é
   * um campo conhecido — por isso «Está acima» continua a ser tratado como
   * resposta à pergunta em cima. No passo do resumo não se intercepta: ali a
   * resposta certa é mostrar o resumo outra vez, e isso é do caso «confirmar».
   */
  if (estado.passo !== "confirmar") {
    const dito = corrigir(estado.dados, t, agora);
    if (dito) {
      const passo = primeiroPassoEmFalta(dito);
      const abertura = aberturaDaResposta(dito, estado.passo, passo, agora, jaCumprimentou);
      return {
        estado: { passo, dados: dito },
        resposta: abertura + perguntaDo(passo, dito, false),
      };
    }
  }

  const d: DadosDaRecolha = { ...estado.dados };
  const fotos = contexto.fotos ?? 0;

  /*
   * A PERGUNTA PELO PREÇO — ver `COMO_CHEGA_O_PRECO`. Não no princípio:
   * «queria um orçamento» na primeira mensagem é o pedido, e a conversa
   * inteira responde-lhe.
   */
  const notaDoPreco = notaDoPrecoPara(
    t,
    estado.passo,
    contexto.jaExplicouOPreco === true,
    estado.dados.serviceType ?? servicoPorPalavras(t),
  );

  /*
   * O QUE ELE CONTOU DO ACESSO SEM SE LHE PERGUNTAR — ver `factosSoltos`.
   */
  const factos = factosSoltos(t);
  // O serviço adivinhado pelo que se viu nas fotografias — ver `aplicarOQueSeViu`.
  let pelasImagens = false;

  /* ── O SERVIÇO: a primeira mensagem, lida inteira ─────────────────────── */
  if (estado.passo === "servico") {
    /*
     * A PRIMEIRA MENSAGEM DIZ MUITAS VEZES TUDO — 10-10-2026.
     *
     * O Emiliano mandou o sofá, as medidas, a morada e o andar; o Simão o
     * serviço, a localidade, o andar, o elevador e o nome. Lia-se SÓ o
     * serviço, e o resto perguntava-se a seguir, uma coisa de cada vez. Agora
     * lê-se tudo (`lerMensagemLivre`) e pergunta-se só o que falta.
     */
    const lido = lerMensagemLivre(t);
    const s = servicoDoTexto(t, contexto.lista);
    if (s) lido.servico = s;
    const vazios: CamposCrus = { ...lido };
    if (d.contactName) delete vazios.nome;
    Object.assign(d, fundirCampos(d, vazios, agora));
    juntarFactos(d, factos);
    lerOVolumeEQuemCarrega(d, t);
    if (!d.description && fotos > 0) d.description = DESCRICAO_DAS_FOTOS;
    // Pediu o que a CLYON não faz: diz-se-lhe já — ver `recusarOServico`. O
    // que ele escreveu manda sobre o que se vê nas fotografias.
    const fora = d.serviceType ? null : servicoForaDoPlano(t, contexto.lista);
    if (fora) {
      aplicarOQueSeViu(d, contexto.visto, false);
      return recusarOServico(fora, d, jaCumprimentou, agora, true);
    }
    if (aplicarOQueSeViu(d, contexto.visto)) pelasImagens = true;
    if (!d.serviceType) {
      const aprendeu = JSON.stringify(d) !== JSON.stringify(estado.dados);
      /*
       * «Olá! Gostava de pedir um orçamento à CLYON.» — a Rosana, 13-10-2026,
       * levou «Peço desculpa, não percebi bem o que precisa». A primeira
       * mensagem é o princípio da conversa, e não uma resposta que falhou:
       * cumprimenta-se e pergunta-se.
       */
      if (aprendeu || !jaCumprimentou) {
        /*
         * E A QUEM MANDOU IMAGENS NÃO SE PERGUNTA O QUE É PARA LEVAR — está
         * nelas. A do Paço de Arcos mandou a fotografia e depois a morada, e
         * ouvia «E o que é para levar ou fazer?» (20-10-2026). A morada
         * diz-se que ficou.
         */
        return {
          estado: { passo: "servico", dados: d },
          resposta: jaCumprimentou ? servicoDeNovo(d, estado.dados, true) : perguntaDo("servico", d, true, agora),
        };
      }
      const vezes = (d.tentativas?.servico ?? 0) + 1;
      d.tentativas = { ...d.tentativas, servico: vezes };
      return {
        estado: { passo: "servico", dados: d },
        resposta: outraVez("servico", d) + (vezes >= 2 ? OFERECER_UMA_PESSOA : ""),
      };
    }
  } else if (estado.passo === "confirmar") {
    /* ── O RESUMO ─────────────────────────────────────────────────────────── */
    const confirma =
      simOuNao(t) === "sim" ||
      /^(confirmo|confirmar|registar|pode registar|esta certo|esta tudo certo|correcto|correto)$/.test(chave);
    // Um SIM curto regista já. «Sim, mas o andar é o 2º» corrige primeiro.
    if (confirma && t.split(/\s+/).length <= 4) {
      return { estado: { passo: "confirmar", dados: d }, resposta: "", registar: true };
    }
    const corrigido = corrigir(d, t, agora);
    if (corrigido) {
      return { estado: { passo: "confirmar", dados: corrigido }, resposta: resumo(corrigido) };
    }
    /*
     * A CORRECÇÃO SEM RÓTULO — «o andar é o 2º», «a morada é Rua X 12»,
     * «falta um colchão». Aqui o que ele diz SUBSTITUI o que lá estava: é para
     * isso que se mostra o resumo.
     */
    const lido = lerMensagemLivre(t);
    const mudancas: CamposCrus = {};
    if (lido.morada) mudancas.morada = lido.morada;
    if (lido.codigoPostal) mudancas.codigoPostal = lido.codigoPostal;
    if (lido.andar) mudancas.andar = lido.andar;
    if (lido.quando) mudancas.quando = lido.quando;
    if (lido.moradaDestino) mudancas.moradaDestino = lido.moradaDestino;
    const novo = fundirCampos(d, mudancas, agora);
    if (lido.nome) novo.contactName = lido.nome;
    if (JSON.stringify(novo) !== JSON.stringify(d)) {
      return { estado: { passo: "confirmar", dados: novo }, resposta: resumo(novo) };
    }
    /*
     * O QUE ELE ACRESCENTA AO TRABALHO, no resumo — 10-10-2026.
     *
     *   CLIENTE: E quero que embale as roupas e a mudança
     *   CLYON:   Para registar responda SIM. Se houver algo errado, diga-me o quê.
     *
     * — o Gaspar. Não é um erro no resumo, é mais trabalho: fica no pedido,
     * di-lo-á em duas linhas, e não se lhe devolve o resumo inteiro outra vez.
     */
    if (falaDeCoisas(t) && !confirma) {
      const descricao =
        d.description && d.description !== DESCRICAO_DAS_FOTOS ? `${d.description}\n${t}`.slice(0, 4000) : t.slice(0, 4000);
      return {
        estado: { passo: "confirmar", dados: { ...d, description: descricao } },
        resposta: `Obrigada, fica anotado no pedido: «${t.slice(0, 200)}».\n\nSe estiver tudo certo, responda SIM e fica registado.`,
      };
    }
    if (confirma) {
      return { estado: { passo: "confirmar", dados: d }, resposta: "", registar: true };
    }
    if (notaDoPreco) {
      return {
        estado,
        resposta: `${notaDoPreco}Se estiver tudo certo, responda SIM e fica registado.`,
      };
    }
    if (simOuNao(t) === "nao") {
      return { estado, resposta: "Claro! Diga-me o que está errado, e eu corrijo já." };
    }
    return {
      estado,
      resposta:
        "Se estiver tudo certo, é só responder SIM e fica registado. Se alguma coisa estiver mal, diga-me o quê e eu corrijo — ou escreva «recomeçar».",
    };
  } else if (!lerAResposta(estado.passo, t, d, agora, factos)) {
    /* ── NÃO RESPONDEU À PERGUNTA: o que é, então? ───────────────────────── */
    let aprendeu = false;
    // Um sim ou um não atrasado — ver `passoDoSimAtrasado`.
    const curto = simOuNaoCurto(t);
    const alvo = curto ? passoDoSimAtrasado(estado.passo, d) : null;
    if (curto && alvo) {
      aplicarSimOuNao(alvo, curto, d);
      aprendeu = true;
    }
    // O acesso, dito fora do passo dele: «Depende de como estiver… os lugares».
    // Fica anotado — está no fio, e a equipa lê-o —, e a pergunta repete-se.
    const passoDoAcesso = ["estacionamento", "elevador", "andarDestino", "elevadorDestino", "estacionamentoDestino"];
    if (!passoDoAcesso.includes(estado.passo) && falaDoAcesso(t)) {
      if (estacionamentoIncerto(t) && d.parkingDistance === undefined) d.parkingDistance = null;
      aprendeu = true;
    }
    // A data, dita na pergunta da descrição (ou corrigida depois).
    if (estado.passo !== "quando" && pareceQuando(t) && !falaDeCoisas(t) && t.length <= 60) {
      guardarOQuando(d, t, agora);
      aprendeu = true;
    }
    // As coisas para levar, ditas noutra pergunta: juntam-se à descrição.
    if (estado.passo !== "descricao" && falaDeCoisas(t) && !moradaNaFrase(t)) {
      d.description =
        d.description && d.description !== DESCRICAO_DAS_FOTOS
          ? d.description.includes(t)
            ? d.description
            : `${d.description}\n${t}`.slice(0, 4000)
          : t.slice(0, 4000);
      aprendeu = true;
    }
    // A resposta a uma pergunta de antes: a localidade depois do código
    // postal, a vaga à porta — ver `aproveitarRespostaAtrasada` (27-10-2026).
    if (aproveitarRespostaAtrasada(d, t)) aprendeu = true;
    // Que as mandou fica dito mesmo quando já há descrição — ver `fotosDitas`.
    if (remeteParaAsFotos(t)) d.fotosDitas = true;
    if (remeteParaAsFotos(t) && !d.description) {
      d.description = DESCRICAO_DAS_FOTOS;
      aprendeu = true;
    }
    // «Não quero vender, só doar» — o Josué, 13-10-2026. Fica no pedido, para
    // quem lá for saber que o que está em bom estado é para doar.
    if (falaDeDoarOuVender(t) && !eUmaPergunta(t)) {
      d.description = juntarADescricao(d.description, t);
      aprendeu = true;
    }
    if (aproveitarOResto(d, t, agora)) aprendeu = true;
    const nomeDito = nomeDoTexto(t);

    if (!respondido(estado.passo, d)) {
      // Disse que o nome já está dado («a pessoa que pediu o orçamento») —
      // ver `oNomeQueNaoVeio` (26-10-2026).
      if (estado.passo === "nome" && (fugiuAoNome(t) || jaFezOPedido(t))) return oNomeQueNaoVeio(d, t);
      // Uma pergunta que ela não sabe responder fica para a equipa, e a
      // conversa segue — ver `eUmaPergunta`. Uma pelo preço já tem resposta.
      if (eUmaPergunta(t) && !notaDoPreco) {
        return {
          estado: { passo: estado.passo, dados: d },
          resposta: `${respostaAUmaPergunta(t, d)}\n\n${perguntaDo(estado.passo, d, false)}`,
        };
      }
      if (aprendeu || nomeDito || notaDoPreco) {
        const p = primeiroNome(d.contactName);
        const anotado = nomeDito && p ? `Obrigada, ${p}! ` : aprendeu ? "Obrigada, fica anotado. " : "";
        // Na morada, o que falta diz-se: a rua e o número.
        // A mesma pergunta, de outra forma — a de cima já a leu (27-10-2026, ver `deOutraForma`).
        const pergunta =
          estado.passo === "morada"
            ? SO_FALTA_A_RUA
            : contexto.perguntaPorFazer
              ? perguntaDo(estado.passo, d, false)
              : deOutraForma(estado.passo, d);
        return {
          estado: { passo: estado.passo, dados: d },
          resposta: notaDoPreco + anotado + pergunta,
        };
      }
      // O nome pergunta-se UMA vez de outra forma, e depois segue-se (26-10-2026).
      if (estado.passo === "nome") return oNomeQueNaoVeio(d, t);
      // A pergunta ainda não saiu: faz-se agora, sem «não percebi» — ver `perguntaPorFazer`.
      if (contexto.perguntaPorFazer) {
        return { estado: { passo: estado.passo, dados: d }, resposta: perguntaDo(estado.passo, d, false, agora) };
      }
      /*
       * NÃO SE PERCEBEU NADA. Repete-se por outras palavras — e à segunda vez
       * segue-se em frente com o que houver: ver `PASSOS_QUE_SE_DEIXAM`.
       */
      const n = (d.tentativas?.[estado.passo] ?? 0) + 1;
      d.tentativas = { ...d.tentativas, [estado.passo]: n };
      const curtoDeMais = t.length < 2;
      if (n >= 2 && !curtoDeMais) {
        // O nome já não chega aqui: pergunta-se uma vez de outra forma e segue-se (`oNomeQueNaoVeio`).
        if (estado.passo === "andar") d.floor = t.slice(0, 40);
        else if (estado.passo === "descricao") d.description = t.slice(0, 4000);
      }
      if (!respondido(estado.passo, d)) {
        return {
          estado: { passo: estado.passo, dados: d },
          resposta: outraVez(estado.passo, d) + (n >= 2 ? OFERECER_UMA_PESSOA : ""),
        };
      }
    }
  }

  // O que disse do acesso de passagem também conta — ver `factosSoltos`. E o
  // que mais a mensagem trouxer, ao que está vazio — ver `aproveitarOResto`.
  juntarFactos(d, factos);
  if (estado.passo !== "servico") aproveitarOResto(d, t, agora);
  // Quem mandou fotografias já mostrou o que é para levar — e o que se viu
  // nelas fica dito (21-10-2026).
  if (!d.description && fotos > 0) d.description = DESCRICAO_DAS_FOTOS;
  if (aplicarOQueSeViu(d, contexto.visto)) pelasImagens = true;

  /*
   * Passos que já ficaram respondidos de caminho saltam-se — TODOS.
   *
   * Eram três, escritos à mão: o código postal, o do destino, e o elevador
   * quando vinha no andar. Tudo o resto perguntava-se pela ordem, mesmo
   * respondido: o Dinis disse «Tem estacionamento no local» e ouviu «Dá para
   * encostar a carrinha à porta?» oito minutos depois (06-10-2026). Quem
   * decide se um passo tem resposta é `respondido`, o mesmo que o caminho do
   * Gemini usa.
   */
  /*
   * O CÓDIGO POSTAL SEM A LOCALIDADE NÃO PASSA À FRENTE — 27-10-2026 (d2).
   * Pergunta-se só a localidade, como o caminho do modelo já fazia; seguir
   * deixava a localidade por perguntar, e o «Algés» que vinha a seguir caía
   * na pergunta do elevador.
   */
  let proximo =
    estado.passo === "codigoPostal" && d.postalCode && !d.city && !desistiuDePerguntar("codigoPostal", d)
      ? estado.passo
      : passoSeguinte(estado.passo, d);
  while (proximo !== "confirmar" && respondido(proximo, d)) {
    proximo = passoSeguinte(proximo, d);
  }
  // O cumprimento também por aqui: este é o caminho de quando o Gemini está em
  // baixo, e uma pessoa que apanhe esse dia merece os mesmos modos.
  const abertura = aberturaDaResposta(d, estado.passo, proximo, agora, jaCumprimentou);
  const voz = vozAntesDaPergunta(t, estado, d, proximo, abertura !== "", pelasImagens);
  // A verdade primeiro, e a pergunta logo a baixo — ver o caminho do Gemini.
  const naoCompramos = !jaDisseQueNaoCompra && querVenderBens(t) ? NAO_COMPRAMOS : "";
  return {
    estado: { passo: proximo, dados: d },
    resposta: abertura + naoCompramos + voz + notaDoPreco + perguntaDo(proximo, d),
  };
}

/**
 * O QUE A VITÓRIA DIZ ANTES DA PERGUNTA SEGUINTE — 13-10-2026.
 *
 * Era a pergunta, e mais nada: «Recolha de móveis — certo. Com quem estou a
 * falar?», «Qual é a morada?», «Dá para estacionar à porta?». Cada resposta
 * do cliente era recebida com a pergunta seguinte, como num formulário — e o
 * Abílio, que tinha perguntado se fazíamos e dito que já era cliente, chamou-
 * -lhe arrogância.
 *
 * Por ordem, e só uma destas coisas:
 *   1. quem volta: «Que bom voltar a falar consigo, Abílio!»;
 *   2. o serviço, na primeira resposta: «Fazemos, sim!» a quem perguntou, ou
 *      «Com todo o gosto!» — e o que se percebeu, para ele poder corrigir;
 *   3. o nome, quando chegou agora: «Muito prazer, Abílio!»;
 *   4. a resposta à pergunta que estava feita: um agradecimento curto, que
 *      muda com o passo (ver `agradecimento`).
 * Antes do resumo não se agradece: o resumo abre com o seu próprio obrigada.
 */
export function vozAntesDaPergunta(
  texto: string,
  antes: EstadoDaRecolha,
  d: DadosDaRecolha,
  proximo: PassoDaRecolha,
  jaSeApresentou: boolean,
  /** O serviço veio do que se viu nas fotografias, e não das palavras dele (21-10-2026). */
  servicoPelasImagens = false,
): string {
  const p = primeiroNome(d.contactName);
  // «Têm disponibilidade para sexta?» — a Rosana. Responde-se a seguir ao resto.
  // E «Aceitam este tipo de material?», «a janela horária?» — o Teodoro (26-10-2026).
  const fazemos = antes.passo === "servico" && Boolean(d.serviceType) && !servicoPelasImagens && Boolean(texto) && perguntaSeFazemos(texto);
  const respostas = respostasAsPerguntas(texto, d, fazemos);
  const disponibilidade = respostas ? `${respostas}\n\n` : "";
  if (texto && eClienteDeVolta(texto)) {
    return `${boasVindasDeVolta(jaSeApresentou ? null : p)}\n\n${disponibilidade}`;
  }
  if (antes.passo === "servico" && d.serviceType && servicoPelasImagens) {
    return `${servicoVistoNasImagens(d.serviceType)}\n\n${disponibilidade}`;
  }
  if (antes.passo === "servico" && d.serviceType) {
    const etiqueta = (ETIQUETAS[d.serviceType] ?? d.serviceType).toLowerCase();
    const sim = texto && perguntaSeFazemos(texto) ? "Fazemos, sim!" : "Com todo o gosto!";
    return `${sim} Fica anotado: ${etiqueta}.\n\n${disponibilidade}`;
  }
  if (disponibilidade) return disponibilidade;
  if (proximo === "confirmar") return "";
  /*
   * A MESMA PERGUNTA, MAS COM O QUE ELE DISSE ANOTADO — 23-10-2026. A Olga
   * respondeu ao «Com quem tenho o gosto de falar?» com «Não é uma casa
   * completa»: ficou na descrição, e a pergunta voltou seca, igual, como se
   * não tivesse lido. Quando alguma coisa mudou, agradece-se primeiro.
   */
  // No serviço não: a pergunta dele já traz o seu «fica anotada a morada»
  // (`servicoDeNovo`).
  if (proximo === antes.passo) {
    return antes.passo !== "servico" && JSON.stringify(antes.dados) !== JSON.stringify(d)
      ? "Obrigada, fica anotado. "
      : "";
  }
  if (p && !antes.dados.contactName && !jaSeApresentou) return `${agradecimento("nome", p)} `;
  const obrigada = agradecimento(antes.passo, p);
  // «Nós próprios carregamos tudo» — diz-se que ficou, para ele o saber (26-10-2026).
  const carrega =
    d.clienteCarrega && !antes.dados.clienteCarrega ? "Fica anotado que o carregamento até à viatura fica por sua conta. " : "";
  return `${obrigada ? `${obrigada} ` : ""}${carrega}`;
}

/**
 * Quando a mensagem não trouxe dados nenhuns.
 *
 * Não é a mesma coisa que não perceber. «Olá, gostaria de pedir um orçamento»
 * percebe-se muito bem — só não diz o que é para levar. Responder «não
 * apanhei» a isso é o assistente a portar-se mal com quem foi claro. No
 * primeiro passo acolhe-se e pergunta-se o que falta; daí para a frente, onde
 * a pergunta era concreta, aí sim, admite-se que não se apanhou.
 *
 * O que nunca se faz é repetir a saudação inteira, que era o que mandava dois
 * «Olá! Sou o assistente da CLYON» seguidos.
 */
function reperguntar(passo: PassoDaRecolha, dados: DadosDaRecolha): string {
  if (passo === "servico") {
    return "Com todo o gosto! Diga-me o que precisa de levar ou fazer, e em que zona — por exemplo «tenho um sofá e um colchão para tirar, em Cascais».";
  }
  return `Peço desculpa, não apanhei bem. ${perguntaDo(passo, dados, false)}`;
}


/**
 * FUNDIR OS CAMPOS CRUS NOS DADOS — o único sítio onde isso acontece.
 *
 * Este bloco vivia dentro de `responderComCompreensao`. Saiu para aqui quando
 * a releitura do fio precisou de fazer exactamente o mesmo: pegar nos campos
 * que o Gemini percebeu e passá-los pelos validadores de sempre.
 *
 * Não é «passar pelos mesmos validadores» — é literalmente o mesmo código. Uma
 * cópia divergia no dia em que alguém corrigisse um dos lados, e o lado velho
 * passava a aceitar o que o novo recusa. O Gemini alarga o que se PERCEBE;
 * nunca alarga o que se ACEITA, e é aqui que isso se garante.
 *
 * O `agora` importa: `interpretarQuando` lê «sexta de manhã» em relação a um
 * instante. Na conversa viva é o momento da mensagem; na releitura tem de ser
 * o instante em que a frase foi ESCRITA, senão uma data de há três semanas é
 * remarcada para esta sexta sem ninguém dar por isso.
 */
export function fundirCampos(
  dados: DadosDaRecolha,
  k: CamposCrus,
  agora: Date = new Date(),
): DadosDaRecolha {
  const d: DadosDaRecolha = { ...dados };

  if (k.servico) {
    /*
     * O identificador exacto primeiro. As PISTAS foram escritas para ler
     * gente, não identificadores: «esvaziamento_apartamento» não tem o espaço
     * que a pista do apartamento exige, e ia cair na do esvaziamento de casa —
     * o serviço errado, com o preço errado, sem ninguém dar por isso.
     */
    const id = k.servico.trim().toLowerCase();
    /*
     * E SÓ UM DOS QUE A CLYON FAZ — 25-10-2026. O identificador de um serviço
     * fora do plano não se aceita, nem se deixa cair nas pistas: em
     * «montagem_moveis» a pista dos móveis lê «moveis», e a montagem passava
     * a recolha de móveis sem ninguém dar por isso.
     */
    const exacto = IDS_DA_LISTA.includes(id) ? id : null;
    const s = exacto ?? (SERVICE_CATEGORIES.some((c) => c.id === id) ? null : servicoDoTexto(k.servico));
    if (s) d.serviceType = s;
  }
  /*
   * O NOME PASSA PELO LEITOR DE NOMES — 10-10-2026. «Obrigado Bento» não é
   * um nome, é um agradecimento com um nome dentro; e «Já mandei as fotos»
   * não é nome nenhum. Vale para o que o modelo devolve e para o que as
   * regras lêem.
   */
  if (k.nome && k.nome.trim().length >= 2) {
    const nome = nomeDoTexto(k.nome, true);
    if (nome) d.contactName = nome.slice(0, 120);
  }
  if (k.morada && k.morada.trim().length >= 3) {
    // Com o código postal, a localidade a seguir a ele e o andar — ver `guardarMorada`.
    const andarAntes = d.floor;
    guardarMorada(d, k.morada);
    // O andar que o modelo der em separado manda sobre o que vinha na morada.
    if (k.andar) d.floor = andarAntes;
  }
  if (k.codigoPostal) {
    const { postalCode, city } = codigoPostalELocalidade(k.codigoPostal);
    if (postalCode) d.postalCode = postalCode;
    if (city) d.city = city;
  }
  if (k.moradaDestino && k.moradaDestino.trim().length >= 3) {
    // Como a da origem: código postal, localidade e andar — ver `guardarMoradaDestino`.
    const andarAntes = d.andarDestino;
    guardarMoradaDestino(d, k.moradaDestino);
    if (k.andarDestino) d.andarDestino = andarAntes;
  }
  if (k.codigoPostalDestino) {
    const { postalCode, city } = codigoPostalELocalidade(k.codigoPostalDestino);
    if (postalCode) d.codigoPostalDestino = postalCode;
    if (city) d.localidadeDestino = city;
  }
  // O acesso no destino de uma mudança (10-10-2026), com os mesmos validadores da origem.
  if (k.andarDestino && !nomeDoTexto(k.andarDestino)) {
    d.andarDestino = andarDaResposta(k.andarDestino) ?? andarDoTexto(k.andarDestino);
  }
  if (k.elevadorDestino) {
    const r = simOuNao(k.elevadorDestino) ?? (factosSoltos(k.elevadorDestino).hasElevator === "no" ? "nao" : null);
    if (r) d.elevadorDestino = r === "sim" ? "yes" : "no";
  }
  if (k.estacionamentoDestino) {
    const r = simOuNao(k.estacionamentoDestino);
    if (r) d.estacionamentoDestino = r === "sim" ? "near" : "far";
    else {
      const f = factosSoltos(k.estacionamentoDestino).parkingDistance;
      if (f !== undefined) d.estacionamentoDestino = f;
    }
    const metros = metrosNaFrase(k.estacionamentoDestino);
    if (metros != null) {
      d.metrosAtePortaDestino = metros;
      d.estacionamentoDestino = metros <= 25 ? "near" : "far";
    }
  }
  // «Sou o Bento» não é um andar — foi o andar do Bento no resumo.
  if (k.andar && !nomeDoTexto(k.andar)) {
    d.floor = andarDaResposta(k.andar) ?? andarDoTexto(k.andar);
    // O que está na rua não precisa de elevador — ver `estaNaRua`.
    if (!k.elevador && d.hasElevator == null && estaNaRua(k.andar)) d.hasElevator = "no";
  }
  if (k.elevador) {
    const r = simOuNao(k.elevador);
    if (r) d.hasElevator = r === "sim" ? "yes" : "no";
    else {
      // «não é preciso, está tudo na rua» — ver `factosSoltos`.
      const f = factosSoltos(k.elevador).hasElevator;
      if (f) d.hasElevator = f;
    }
  }
  if (k.estacionamento) {
    const r = simOuNao(k.estacionamento);
    if (r) d.parkingDistance = r === "sim" ? "near" : "far";
    else {
      const f = factosSoltos(k.estacionamento).parkingDistance;
      if (f !== undefined) d.parkingDistance = f;
    }
    // Os metros que o modelo escreveu manda sobre o sim/não (28-10-2026, d35).
    const metros = metrosNaFrase(k.estacionamento);
    if (metros != null) {
      d.metrosAtePorta = metros;
      d.parkingDistance = metros <= 25 ? "near" : "far";
    }
  }
  if (k.entulho) {
    d.entulhoQuantidade = k.entulho.trim().slice(0, 60);
    // O volume é o mesmo, seja qual for o serviço — ver `volumeDito` (26-10-2026).
    if (!d.volumeDito) d.volumeDito = d.entulhoQuantidade;
  }
  if (k.quando) {
    guardarOQuando(d, k.quando, agora);
  }
  if (k.descricao && k.descricao.trim().length >= 3) {
    // «Já mandei as fotos» não é a descrição — é dizer que ela está nas fotografias.
    if (remeteParaAsFotos(k.descricao)) d.fotosDitas = true;
    d.description = remeteParaAsFotos(k.descricao) ? DESCRICAO_DAS_FOTOS : k.descricao.trim().slice(0, 4000);
  }
  if (k.fatura) {
    const r = simOuNaoNaFactura(k.fatura);
    if (r) d.precisaFatura = r === "sim";
  }
  if (k.nif) {
    const nif = nifDaFactura(k.nif);
    if (nif) {
      d.precisaFatura = true;
      d.nifFactura = nif;
    } else if (d.precisaFatura && /\b(depois|mais tarde|nao (sei|tenho))\b/.test(semAcentos(k.nif))) {
      d.nifFactura = null;
    }
  }
  return d;
}
/**
 * A conversa depois de o Gemini ter lido a mensagem.
 *
 * Irmã de `responderNaRecolha` e com o mesmo contrato — estado a entrar,
 * estado e resposta a sair, sem base de dados e sem envio. A diferença é a
 * fonte: em vez de ler o texto com expressões regulares, recebe os campos já
 * separados por quem os percebeu.
 *
 * O que NÃO muda é a garantia. Cada campo que vem do Gemini passa pelo mesmo
 * validador de sempre: o serviço tem de ser um dos da lista, o código postal
 * tem de ter quatro dígitos e três, a data passa por `interpretarQuando`, o
 * sim e o não por `simOuNao`. O que não passar é deitado fora em silêncio, e
 * o campo fica por responder — que é como se pergunta outra vez.
 */
/**
 * A PERGUNTA QUE ESTÁ EM CIMA DA MESA, numa linha.
 *
 * Vai no aviso ao Gemini. Sem ela, ele lê «Não preciso» a flutuar no vazio e
 * casa-a com o exemplo de desistir — e foi assim que a recolha da Sra. Ilda
 * desapareceu. Uma resposta curta só quer dizer alguma coisa ao lado da
 * pergunta a que responde.
 *
 * É a versão curta de `perguntaDo`: no passo do serviço aquela abre com o bom
 * dia e um exemplo, que num aviso ao modelo é ruído.
 */
export function perguntaPendente(passo: PassoDaRecolha, dados: DadosDaRecolha): string {
  if (passo === "servico") return "O que precisa de levar ou fazer?";
  if (passo === "confirmar") return "Está tudo certo? (à espera de um SIM para registar)";
  return perguntaDo(passo, dados, false).split("\n")[0];
}

/**
 * AS PERGUNTAS FECHADAS LÊEM-SE SEM MODELO NENHUM.
 *
 * Sabendo qual é a pergunta, uma resposta curta tem uma leitura só: a «Há
 * elevador?» responde-se sim ou não, e `simOuNao` faz isso desde sempre. Era
 * o caminho antigo, que existia e nunca era tentado — o Gemini passava-lhe à
 * frente e, quando não percebia, ninguém ia atrás dele.
 *
 * Só as FECHADAS. O nome, a morada, a descrição e a data ficam de fora de
 * propósito: aí uma leitura à letra transformava «Qual o valor?» no nome do
 * cliente, que é pior do que não perceber.
 */
export function leituraDirecta(
  passo: PassoDaRecolha,
  texto: string,
  /** A lista numerada que ele viu — ver `servicoDoTexto`. */
  lista?: readonly string[] | null,
  /** O que já se sabe — a localidade sozinha completa o código postal que veio antes (27-10-2026). */
  dados?: DadosDaRecolha,
): CamposCrus | null {
  const t = texto.trim();
  if (!t) return null;

  switch (passo) {
    case "servico": {
      const s = servicoDoTexto(t, lista);
      return s ? { servico: s } : null;
    }
    case "elevador": {
      const r = simOuNao(t);
      return r ? { elevador: r } : null;
    }
    case "fatura": {
      // «Não quero vender só doar» não é um não à factura — o Josué.
      if (falaDeDoarOuVender(t) && !/factur|fatur|\bnif\b/.test(semAcentos(t))) return null;
      const r = simOuNaoNaFactura(t);
      return r ? { fatura: r } : null;
    }
    case "codigoPostal": {
      const { postalCode } = codigoPostalELocalidade(t);
      if (postalCode) return { codigoPostal: t };
      // «1495-123» e, a seguir, «Algés»: a localidade do código que já cá está.
      if (dados?.postalCode && !dados.city && localidadeSolta(t)) return { codigoPostal: `${dados.postalCode} ${t}` };
      return null;
    }
    case "codigoPostalDestino": {
      const { postalCode } = codigoPostalELocalidade(t);
      return postalCode ? { codigoPostalDestino: t } : null;
    }
    case "andar": {
      // Só o que se parece mesmo com um andar: «2», «r/c», «cave», «3º», «4
      // andar». Uma frase inteira não é um andar — «Sou o Bento» foi.
      return andarDaResposta(t) != null ? { andar: t } : null;
    }
    case "nif": {
      return nifDaFactura(t) ? { nif: t } : null;
    }
    // O destino de uma mudança lê-se como a origem (10-10-2026).
    case "andarDestino": {
      return andarDaResposta(t) != null ? { andarDestino: t } : null;
    }
    case "elevadorDestino": {
      const r = simOuNao(t);
      return r ? { elevadorDestino: r } : null;
    }
    case "estacionamentoDestino": {
      const e = estacionamentoDaResposta(t, factosSoltos(t));
      // Com os metros que ele disse — ver `metrosNaFrase` (28-10-2026, d35).
      const metros = metrosNaFrase(t);
      if (metros != null) return { estacionamentoDestino: `a ${metros} metros` };
      return e === "near" || e === "far" ? { estacionamentoDestino: e === "near" ? "sim" : "não" } : null;
    }
    case "estacionamento": {
      // «A porta de ambos» — e numa mudança, o destino também.
      const e = estacionamentoDaResposta(t, factosSoltos(t));
      if (e !== "near" && e !== "far") return null;
      const metros = metrosNaFrase(t);
      const dito = metros != null ? `a ${metros} metros` : e === "near" ? "sim" : "não";
      return valeParaAmbos(t) ? { estacionamento: dito, estacionamentoDestino: dito } : { estacionamento: dito };
    }
    default:
      return null;
  }
}

/** Já há trabalho feito nesta conversa que se perca ao desistir? */
function temTrabalhoFeito(d: DadosDaRecolha): boolean {
  return Boolean(
    d.serviceType || d.contactName || d.address || d.description || d.quandoTexto || d.postalCode,
  );
}

/** O que já se sabe, em meia dúzia de palavras, para a pergunta da desistência. */
function oQueJaTenho(d: DadosDaRecolha): string {
  const partes = [
    d.serviceType ? (ETIQUETAS[d.serviceType] ?? d.serviceType).toLowerCase() : null,
    d.contactName ?? null,
    [d.address, d.city].filter(Boolean).join(", ") || null,
  ].filter((x): x is string => Boolean(x));
  return partes.length > 0 ? partes.join(", ") : "o que já me disse";
}

export function responderComCompreensao(
  estado: EstadoDaRecolha,
  compreensao: { intencao: Intencao; campos: CamposCrus; resposta?: string },
  agora: Date = new Date(),
  contexto: {
    texto?: string;
    jaCumprimentou?: boolean;
    jaDisseQueNaoCompra?: boolean;
    /** As fotografias que ele já mandou — ver `fotosNoFio`. */
    fotos?: number;
    /** Já se lhe disse como chega o preço? Ver `jaExplicouOPreco`. */
    jaExplicouOPreco?: boolean;
    /** O que se viu nas fotografias desta rajada — ver `aplicarOQueSeViu`. */
    visto?: string[];
    /** A lista numerada que ele viu — ver `servicosDaListaNoFio` (25-10-2026). */
    lista?: readonly string[] | null;
    /** A pergunta em cima ainda não saiu — ver `ContextoDaRecolha.perguntaPorFazer` (27-10-2026). */
    perguntaPorFazer?: boolean;
  } = {},
): RespostaDaRecolha {
  const { intencao, campos: k } = compreensao;
  const cru = (contexto.texto ?? "").trim();

  /*
   * «Do you speak English?» e «so how does it work now?» — o modelo pode lê-los
   * como uma pergunta para a equipa ou como um «sim» ao resumo; respondem-se
   * antes. Ver `antesDaResposta` (28-10-2026, decisão d35).
   */
  if (cru && !estado.dados.aConfirmarDesistencia && !reclamaDoAtendimento(cru)) {
    const antes = antesDaResposta(estado, cru, agora, contexto.jaCumprimentou === true, false, (e, resto) =>
      responderComCompreensao(
        e,
        { ...compreensao, intencao: intencao === "confirmar" && simOuNao(resto) !== "sim" ? "informar" : intencao },
        agora,
        { ...contexto, texto: resto },
      ),
    );
    if (antes) return antes;
  }

  /*
   * A LEITURA DIRECTA MANDA — e é o plano B que faltava.
   *
   * O Gemini lia «Não» a uma pergunta de sim/não e devolvia campos vazios,
   * e a conversa respondia «Desculpe, não apanhei. Precisa de factura com
   * NIF?» — à frente de um `simOuNao("Não")` que teria acertado sem hesitar.
   * O caminho antigo existia e nunca era tentado, porque esta função nem
   * sequer recebia o texto cru.
   *
   * Agora recebe. Sabendo qual é a pergunta em cima da mesa, uma resposta
   * curta lê-se com os validadores de sempre, e o que daí sair vale MAIS do
   * que o silêncio do modelo.
   */
  /*
   * «SÓ PRECISO DO ORÇAMENTO» NÃO É A RESPOSTA À FACTURA — 27-10-2026 (d2).
   * O modelo pode tê-la lido assim; sai daqui com a nota do preço à frente, e
   * o resto da mensagem (se houver) lê-se como sempre.
   */
  const soOrcamento = cru && !estado.dados.aConfirmarDesistencia ? soOrcamentoNaRajada(estado, cru) : null;
  if (soOrcamento) {
    const semFactura: CamposCrus = { ...k };
    if (!soOrcamento.resto || simOuNaoNaFactura(soOrcamento.resto) == null) delete semFactura.fatura;
    const nota = notaDeQuemSoQuerOOrcamento(contexto.jaExplicouOPreco === true);
    const comNota: EstadoDaRecolha = { passo: estado.passo, dados: soOrcamento.dados };
    if (!soOrcamento.resto) {
      const dd = fundirCampos(comNota.dados, semFactura, agora);
      const p = primeiroPassoEmFalta(dd);
      return { estado: { passo: p, dados: dd }, resposta: nota + perguntaDo(p, dd, false, agora) };
    }
    const r = responderComCompreensao(
      comNota,
      { intencao: intencao === "confirmar" || intencao === "cancelar" ? "informar" : intencao, campos: semFactura },
      agora,
      { ...contexto, texto: soOrcamento.resto, jaExplicouOPreco: true },
    );
    return r.registar || r.pedirPessoa || r.desistir || !r.resposta ? r : { ...r, resposta: nota + r.resposta };
  }

  const directa = cru ? leituraDirecta(estado.passo, cru, contexto.lista, estado.dados) : null;
  const kk: CamposCrus = directa ? { ...k, ...directa } : { ...k };
  /*
   * AS DATAS TODAS, MESMO QUE O MODELO DÊ SÓ UMA — 28-10-2026 (decisão d35).
   * Se ele escreveu duas ou mais e o modelo devolveu menos, ficam as dele.
   */
  if (cru) {
    const doTexto = quandoDaMensagem(frasesDe(cru));
    const ditas = doTexto ? datasDitas(doTexto, agora).length : 0;
    if (doTexto && ditas >= 2 && ditas > datasDitas(kk.quando ?? "", agora).length) kk.quando = doTexto;
  }
  /*
   * «NÃO É ENTULHO» NUNCA É ENTULHO — 26-10-2026. Diga o modelo o que disser:
   * o que ele negou não é o serviço. Fica o que as palavras dele dizem, e
   * quem quer levar embalagens ou outras coisas pede uma recolha de monos.
   */
  if (cru && kk.servico === "recolha_entulho" && !estado.dados.serviceType && negaOEntulho(cru)) {
    // Se, sem a negação, ainda há entulho a sério na frase, fica o entulho.
    const pelasPalavras = servicoPorPalavras(cru);
    if (pelasPalavras !== "recolha_entulho") kk.servico = pelasPalavras ?? "recolha_monos";
  }

  /*
   * A CONFIRMAÇÃO ANTES DO APAGAR.
   *
   * «Não preciso», a responder a «Precisa de factura com NIF?», foi lido
   * como desistência — e apagou a recolha inteira da Sra. Ilda: serviço,
   * nome, morada, andar, data, tudo. Sem confirmação, sem arquivo, sem
   * volta. O exemplo que o modelo tinha para «cancelar» era, literalmente,
   * «já não preciso».
   *
   * Com trabalho feito, desistir passa a PERGUNTAR. E quem lê a resposta a
   * essa pergunta é o código — `simOuNao` — e não outra etiqueta do modelo:
   * um DELETE irreversível não pode ficar do outro lado de um palpite.
   */
  if (estado.dados.aConfirmarDesistencia) {
    const resposta = cru ? simOuNao(cru) : null;
    const { aConfirmarDesistencia: _, ...limpos } = estado.dados;
    if (resposta === "sim" || /^cancelar$/i.test(cru)) {
      return { estado: { passo: estado.passo, dados: limpos }, resposta: FICA_SEM_EFEITO, desistir: true };
    }
    // Não era desistência: limpa-se a bandeira e a conversa segue com o que
    // ele acabou de dizer, como se nada tivesse acontecido.
    return responderComCompreensao(
      { passo: estado.passo, dados: limpos },
      { intencao: intencao === "cancelar" ? "informar" : intencao, campos: kk },
      agora,
      contexto,
    );
  }

  // A queixa antes de tudo — ver `entregarQuemSeQueixa`. Lê-se das palavras
  // dele, e não da etiqueta do modelo.
  const queixa = cru ? entregarQuemSeQueixa(estado, cru) : null;
  if (queixa) return queixa;

  // «Não entendi» não é uma resposta, diga o modelo o que disser — ver
  // `naoPercebeu` (23-10-2026). O «Não» da Olga passou a «Fatura: não».
  if (cru && naoPercebeu(cru)) return { estado, resposta: explicarDeNovo(estado.passo, estado.dados) };

  if (intencao === "falar_com_pessoa") {
    return { estado, resposta: PASSO_A_ALGUEM_DA_EQUIPA, pedirPessoa: true };
  }
  /*
   * QUEM DESISTE A MEIO PASSA A UMA PESSOA — ver `entregarQuemDesiste`.
   *
   * «Obrigado, está muito complicado. Prefiro desistir.» — o Bento. Pedir-lhe
   * «Responda SIM para deitar fora» era mais uma ordem a quem já estava farto
   * delas. Lê-se pelas palavras, e não pela etiqueta do modelo; e só com
   * trabalho feito, que sem nada recolhido desistir é o que sempre foi.
   * Depois das perguntas de sim ou não: «não preciso» à factura é um não.
   */
  const respondeSimOuNao =
    directa != null && (estado.passo === "fatura" || estado.passo === "elevador" || estado.passo === "estacionamento");
  if (cru && !respondeSimOuNao && temTrabalhoFeito(estado.dados) && desisteDoPedido(cru)) {
    return entregarQuemDesiste(estado);
  }

  if (intencao === "cancelar") {
    // Sem nada recolhido não há o que perder: é o «deixa estar» de quem ainda
    // não disse nada, e obrigá-lo a confirmar seria ficar-lhe com a conversa.
    if (!temTrabalhoFeito(estado.dados)) {
      return { estado, resposta: FICA_SEM_EFEITO, desistir: true };
    }
    return {
      estado: { passo: estado.passo, dados: { ...estado.dados, aConfirmarDesistencia: true } },
      resposta:
        `Só para não apagar nada por engano: quer mesmo desistir do pedido?\n\n` +
        `Já tenho ${oQueJaTenho(estado.dados)}. Se quiser mesmo desistir, diga-me «sim»; ` +
        `se não, diga-me o que falta e seguimos daqui, com todo o gosto.`,
    };
  }
  if (intencao === "recomecar") {
    const novo = recolhaNova();
    /*
     * Sem a saudação. Já se disse bom dia no princípio desta conversa, e um
     * segundo «Bom dia! Aqui é a CLYON» a meio dela é o mesmo defeito que
     * `reperguntar` existe para evitar.
     */
    return {
      estado: novo,
      resposta:
        "Claro, sem problema! Vamos do princípio. Diga-me o que precisa de levar ou fazer, e em que zona.",
    };
  }

  const d = fundirCampos(estado.dados, kk, agora);

  /*
   * A MORADIA, LIDA DO TEXTO CRU — e nao dos campos.
   *
   * O modelo normaliza «e uma moradia» para um andar «0» e a palavra
   * perde-se pelo caminho: `fundirCampos` so ve o andar. Aqui ainda ha a
   * frase dela, e e nela que esta a resposta a pergunta seguinte.
   *
   * So preenche o que esta por responder: se ele ja disse que tem elevador,
   * e ele que sabe da casa dele.
   */
  if (cru && d.hasElevator == null && eUmaMoradia(cru)) d.hasElevator = "no";

  // O volume e quem carrega, pelas palavras dele — ver `lerOVolumeEQuemCarrega` (26-10-2026).
  if (cru) lerOVolumeEQuemCarrega(d, cru);

  // A localidade depois do código postal, a vaga à porta — respostas a perguntas
  // de antes, que o modelo pode não ter posto no sítio (27-10-2026).
  if (cru) for (const parte of cru.split(/\n+/)) aproveitarRespostaAtrasada(d, parte.trim());

  // Quem mandou fotografias já mostrou o que é para levar — ver `DESCRICAO_DAS_FOTOS`.
  if (!d.description && (contexto.fotos ?? 0) > 0) d.description = DESCRICAO_DAS_FOTOS;

  /*
   * PEDIU O QUE A CLYON NÃO FAZ — ver `recusarOServico` (25-10-2026). Pelas
   * palavras dele, e não pelo palpite do modelo: a «montar um roupeiro» o
   * Gemini pode responder «recolha_moveis», por causa do roupeiro. O resto do
   * que ele disse (o nome, a morada) fica.
   */
  const fora = cru && !estado.dados.serviceType ? servicoForaDoPlano(cru, contexto.lista) : null;
  if (fora) {
    delete d.serviceType;
    aplicarOQueSeViu(d, contexto.visto, false);
    return recusarOServico(fora, d, contexto.jaCumprimentou === true, agora, false);
  }

  // E o que se viu nelas: a descrição, e o serviço quando ainda não se sabe.
  const pelasImagens = aplicarOQueSeViu(d, contexto.visto) != null;

  const passo = primeiroPassoEmFalta(d);

  /*
   * A PERGUNTA PELO PREÇO tem resposta — ver `COMO_CHEGA_O_PRECO`. Não na
   * primeira mensagem: aí «queria um orçamento» é o pedido.
   */
  const notaDoPreco = cru ? notaDoPrecoPara(cru, estado.passo, contexto.jaExplicouOPreco === true, d.serviceType) : "";

  // O SIM só vale com tudo preenchido. Com um campo por responder, o «sim» é
  // conversa e não confirmação — pergunta-se o que falta.
  if (intencao === "confirmar" && passo === "confirmar") {
    return { estado: { passo, dados: d }, resposta: "", registar: true };
  }

  const mudouAlgo = JSON.stringify(d) !== JSON.stringify(estado.dados);
  // Disse que o nome já está dado («a pessoa que pediu o orçamento») — ver
  // `oNomeQueNaoVeio` (26-10-2026). Nunca a mesma pergunta outra vez.
  if (estado.passo === "nome" && passo === "nome" && cru && (fugiuAoNome(cru) || jaFezOPedido(cru))) {
    return oNomeQueNaoVeio(d, cru);
  }
  if (!mudouAlgo && passo === estado.passo) {
    // Quem perguntou o preço não «não foi apanhado»: responde-se, e segue. E
    // quem disse que volta também não — ver `vozAntesDaPergunta`.
    const deVolta = cru && eClienteDeVolta(cru) ? `${boasVindasDeVolta(primeiroNome(d.contactName))}\n\n` : "";
    if (notaDoPreco || deVolta) {
      return { estado: { passo, dados: d }, resposta: deVolta + notaDoPreco + perguntaDo(passo, d, false) };
    }
    // «Vocês também vendem?» — o Josué levou «não apanhei». Ver `eUmaPergunta`.
    if (cru && eUmaPergunta(cru) && passo !== "servico") {
      return {
        estado: { passo, dados: d },
        resposta: `${respostaAUmaPergunta(cru, d, compreensao.resposta)}\n\n${perguntaDo(passo, d, false)}`,
      };
    }
    // «Não quero vender só doar» — fica no pedido, e a pergunta segue.
    if (cru && falaDeDoarOuVender(cru)) {
      const comNota = { ...d, description: juntarADescricao(d.description, cru) };
      return { estado: { passo, dados: comNota }, resposta: `Obrigada, fica anotado. ${perguntaDo(passo, comNota, false)}` };
    }
    // O nome não se pergunta pela terceira vez igual — ver `oNomeQueNaoVeio`.
    if (passo === "nome" && cru) return oNomeQueNaoVeio(d, cru);
    // A pergunta ainda não saiu: faz-se agora, sem «não apanhei» — ver `perguntaPorFazer`.
    if (contexto.perguntaPorFazer && passo !== "servico") {
      return { estado: { passo, dados: d }, resposta: perguntaDo(passo, d, false, agora) };
    }
    return { estado: { passo, dados: d }, resposta: reperguntar(passo, d) };
  }

  /*
   * O BOM DIA, E O NOME DELA.
   *
   * "O assistente respondeu sem bom dia e sem dizer o nome dela."
   *
   * Quando a primeira mensagem já traz o serviço — «tenho uma mesa grande, 5
   * cadeiras (...) que precisava que viessem buscar» — o passo `servico` é
   * saltado, e com ele o único sítio onde havia um cumprimento. A conversa
   * abria com uma pergunta seca a quem tinha acabado de escrever «Bom dia» e
   * de assinar o nome.
   *
   * Sai UMA vez porque só sai quando a mensagem chegou com o estado por
   * estrear — não é preciso guardar nada nos dados para isso.
   */
  const abertura = aberturaDaResposta(d, estado.passo, passo, agora, contexto.jaCumprimentou === true);
  /*
   * ⚠️ A VERDADE PRIMEIRO, E A PERGUNTA LOGO A BAIXO.
   *
   * Quem escreve «tenho artigos para venda» tem de saber que a CLYON nao
   * compra ANTES de responder a mais alguma coisa — ver `NAO_COMPRAMOS`. Sai
   * colado a pergunta que se seguia, e nao em lugar dela: o formulario nao se
   * interrompe, e a decisao de continuar ou nao continua a ser dela.
   *
   * Uma vez por conversa. A segunda copia desta frase era o defeito de ontem.
   */
  const naoCompramos =
    cru && !contexto.jaDisseQueNaoCompra && querVenderBens(cru) ? NAO_COMPRAMOS : "";
  // O agradecimento, o «fazemos, sim» e o «que bom voltar» — os mesmos modos
  // do plano B. Ver `vozAntesDaPergunta`.
  const voz = vozAntesDaPergunta(cru, estado, d, passo, abertura !== "", pelasImagens);
  return {
    estado: { passo, dados: d },
    // O serviço ainda por saber, a quem já foi cumprimentado: sem a
    // apresentação outra vez — ver `servicoDeNovo` (20-10-2026).
    resposta:
      abertura +
      naoCompramos +
      voz +
      notaDoPreco +
      (passo === "servico" && contexto.jaCumprimentou === true
        ? servicoDeNovo(d, estado.dados, false)
        : passo === estado.passo && !contexto.perguntaPorFazer && passo !== "servico"
          ? deOutraForma(passo, d)
          : perguntaDo(passo, d, false)),
  };
}

/**
 * A MESMA PERGUNTA, POR OUTRAS PALAVRAS E SEM DESCULPAS — 27-10-2026 (d2).
 *
 * Quando ele respondeu outra coisa (a descrição à pergunta da carrinha), a
 * Vitória anota e volta à pergunta — mas não com as mesmas palavras, que já
 * leu e saltou: «E a carrinha consegue encostar à porta…?» saiu duas vezes
 * seguidas no #853. Não há «não percebi»: percebeu-se, era outra coisa. A
 * factura fica como o dono a escreveu, sempre.
 */
export function deOutraForma(passo: PassoDaRecolha, d: DadosDaRecolha): string {
  switch (passo) {
    case "codigoPostal":
      if (d.postalCode && !d.city) return "Qual é a localidade?";
      if (d.city && !d.postalCode) return "Qual é o código postal?";
      return "Qual é o código postal, com a localidade?";
    case "andar":
      return "Em que andar fica? Se for rés-do-chão, diga-me também.";
    case "elevador":
      return "O prédio tem elevador?";
    case "estacionamento":
      return "A carrinha consegue parar perto da porta?";
    case "entulhoQuantidade":
    case "quando":
    case "descricao":
      return outraVez(passo, d);
    default:
      // A factura como o dono a escreveu; o resto, como sempre.
      return perguntaDo(passo, d, false);
  }
}

/**
 * QUEM DISSE QUE MANDOU AS FOTOGRAFIAS NÃO AS VOLTA A OUVIR PEDIR — 17-10-2026.
 *
 * A Judite abriu a conversa com duas fotografias e «envio abaixo as fotos do
 * entulho». Nenhuma chegou ao pedido — só a legenda —, e no fim ouviu «Se
 * tiver fotografias do que é para levar, envie-as agora». Ela já as tinha
 * enviado, e a equipa vê-as no telemóvel. `fotosDitas` é a marca de que ela
 * as mandou, chegassem ou não; a `DESCRICAO_DAS_FOTOS` também, enquanto não
 * for substituída por uma descrição a sério.
 */
export function disseQueMandouFotografias(d: DadosDaRecolha): boolean {
  return d.fotosDitas === true || d.description === DESCRICAO_DAS_FOTOS;
}

/** Mandou imagens, ou disse que as mandou — o mesmo para a Vitória. */
function mandouImagens(d: DadosDaRecolha): boolean {
  return disseQueMandouFotografias(d);
}

/**
 * A PERGUNTA DO PASSO, SEM SE APRESENTAR OUTRA VEZ — 23-10-2026.
 *
 * Para retomar uma conversa que já teve o «Bom dia! Aqui é a Vitória». O
 * «Reler e continuar» da Olga ia mandar a apresentação inteira de novo, a
 * meio da conversa — `perguntaDo("servico")` abre sempre com ela. Nos outros
 * passos a pergunta é a de sempre.
 */
export function perguntaParaContinuar(passo: PassoDaRecolha, dados: DadosDaRecolha): string {
  if (passo !== "servico") return perguntaDo(passo, dados, false);
  return mandouImagens(dados)
    ? SERVICO_PELAS_IMAGENS
    : "Diga-me o que precisa de levar ou fazer, à vontade e pelas suas palavras.";
}

/** O que falta para registar, quando o resumo já está lá em cima (28-10-2026, d35). */
export const LEMBRETE_DO_RESUMO = "Para registar, responda SIM ao resumo acima.";

/**
 * O QUE FALTA, DITO A SEGUIR A UMA RESPOSTA — sem repetir o resumo inteiro
 * (28-10-2026, decisão d35). No resumo, o SIM; com o pedido aberto, o fecho;
 * no serviço, o pedido de o dizer; nos outros, a pergunta em cima.
 */
export function lembreteDoQueFalta(passo: PassoDaRecolha, dados: DadosDaRecolha, agora: Date = new Date()): string {
  if (passo === "confirmar") return dados.pedidoAberto != null ? fechoDoPedidoAberto(dados.pedidoAberto) : LEMBRETE_DO_RESUMO;
  if (passo === "servico") return perguntaParaContinuar(passo, dados);
  return perguntaDo(passo, dados, false, agora);
}

/** «Claro que sim!» à frente da resposta — a seguir à apresentação, se ela vier. */
function comClaroQueSim(resposta: string): string {
  if (!resposta) return CLARO_QUE_SIM;
  const i = resposta.indexOf("\n\n");
  if (i > 0 && resposta.slice(0, i).includes(QUEM_FALA)) {
    return `${resposta.slice(0, i + 2)}${CLARO_QUE_SIM} ${resposta.slice(i + 2)}`;
  }
  return `${CLARO_QUE_SIM} ${resposta}`;
}

/** A pergunta da vez, para quem só pediu a língua — com a apresentação, se ainda não a teve. */
function perguntaDaVez(estado: EstadoDaRecolha, agora: Date, jaCumprimentou: boolean, comLista: boolean): string {
  const { passo, dados } = estado;
  if (passo === "servico") {
    return jaCumprimentou ? `${EM_QUE_POSSO_AJUDAR} ${perguntaParaContinuar(passo, dados)}` : perguntaDo(passo, dados, comLista, agora);
  }
  return perguntaDo(passo, dados, false, agora);
}

/**
 * ANTES DE RESPONDER: O PEDIDO DE LÍNGUA E O «COMO FUNCIONA» — 28-10-2026
 * (decisão d35). Os dois caminhos (com e sem o modelo) passam por aqui.
 *
 *   CLIENTE: Do you speak English?
 *   VITÓRIA: Boa pergunta! Deixo-a anotada para uma pessoa da CLYON…   ← antes
 *   VITÓRIA: Claro que sim! E em que andar é?                           ← agora
 *
 * (e sai «Yes, of course! And what floor is it on?»: a língua já mudou ao
 * registar a mensagem, ver `linguaDepoisDaMensagem`.)
 *
 *   CLIENTE: so how does it work now?
 *   VITÓRIA: [o resumo inteiro outra vez]                               ← antes
 *   VITÓRIA: Funciona assim: … Para registar, responda SIM ao resumo acima. ← agora
 *
 * O resto da mensagem, se houver, lê-se como sempre (`continuar`), e a
 * resposta vem a seguir. Null quando não há nada disto.
 */
function antesDaResposta(
  estado: EstadoDaRecolha,
  texto: string,
  agora: Date,
  jaCumprimentou: boolean,
  comLista: boolean,
  continuar: (estado: EstadoDaRecolha, resto: string) => RespostaDaRecolha,
): RespostaDaRecolha | null {
  if (!texto || reclamaDoAtendimento(texto) || pedeUmaPessoa(texto)) return null;
  if (estado.dados.aConfirmarDesistencia) return null;
  const pediuALingua = linguaPedida(texto) != null;
  const semLingua = pediuALingua ? semPedidoDeLingua(texto) : texto;
  const frases = semLingua
    .split(/\n+/)
    .flatMap((l) => l.split(/(?<=[?!.])\s+/))
    .map((f) => f.trim())
    .filter(Boolean);
  const sobreOCaminho = frases.filter((f) => perguntaOQueAconteceAgora(f));
  if (!pediuALingua && sobreOCaminho.length === 0) return null;

  const terminal = (r: RespostaDaRecolha) => r.registar || r.pedirPessoa || r.desistir || !r.resposta;
  let r: RespostaDaRecolha;
  if (sobreOCaminho.length > 0) {
    const resto = frases.filter((f) => !perguntaOQueAconteceAgora(f)).join("\n");
    if (resto) {
      const seguinte = continuar(estado, resto);
      if (terminal(seguinte)) return seguinte;
      r = { ...seguinte, resposta: `${COMO_FUNCIONA}\n\n${seguinte.resposta}` };
    } else {
      const ola =
        estado.passo === "servico" && !jaCumprimentou
          ? `${apresentacao(saudacao(agora), primeiroNome(estado.dados.contactName))}\n\n`
          : "";
      r = { estado, resposta: `${ola}${COMO_FUNCIONA}\n\n${lembreteDoQueFalta(estado.passo, estado.dados, agora)}` };
    }
  } else if (semLingua) {
    const seguinte = continuar(estado, semLingua);
    if (terminal(seguinte)) return seguinte;
    r = seguinte;
  } else {
    r = { estado, resposta: perguntaDaVez(estado, agora, jaCumprimentou, comLista) };
  }
  return { ...r, resposta: pediuALingua ? comClaroQueSim(r.resposta) : r.resposta, respondidaAntes: true };
}

/**
 * «NÃO ENTENDI» NÃO É «NÃO» — 23-10-2026.
 *
 *   CLYON:   Perfeito, fica anotado. O valor é dado pelos profissionais…
 *            Deseja fatura? (aplica-se IVA de 23%)
 *   CLIENTE: Não entendi,
 *   CLYON:   Já tenho tudo… Fatura: não
 *
 * — a Olga. Leu-se o «Não» e respondeu-se por ela. Quem diz que não
 * percebeu não respondeu: explica-se a pergunta outra vez, e não se grava
 * nada.
 */
export function naoPercebeu(texto: string): boolean {
  const t = semAcentos(texto).replace(/[.,;:!]+$/, "").trim();
  return (
    /^(nao|n)\s+(entendi|percebi|compreendi|estou\s+a\s+(perceber|entender)|estou\s+entendendo|sei\s+o\s+que\s+(e|quer\s+dizer))\b/.test(t) ||
    /^(como\s+assim|o\s+que\s+(e|quer\s+dizer)\s+isso)\b/.test(t)
  );
}

/** A pergunta outra vez, mais clara — a quem disse que não percebeu. */
export function explicarDeNovo(passo: PassoDaRecolha, dados: DadosDaRecolha): string {
  if (passo === "fatura") {
    return (
      `Peço desculpa, não fui clara! Pergunto se quer fatura: com fatura, ao valor aplica-se IVA de ${PERCENTAGEM_DO_IVA}; ` +
      "sem fatura, não. Deseja fatura?"
    );
  }
  return `Peço desculpa, não fui clara! ${perguntaParaContinuar(passo, dados)}`;
}

/**
 * PASSAR À PERGUNTA SEGUINTE — 23-10-2026.
 *
 * *«Se o cliente demorar mais de 10 minutos a responder a uma pergunta, que
 * ela passe para a próxima — já faça o que seria a próxima pergunta.»* — o
 * dono. A pergunta fica em `saltados` (conta como respondida, e se ele a
 * responder depois, fica), e faz-se a seguinte, com esta frase à frente. É
 * também a marca de que já se saltou uma: com o cliente calado, não se salta
 * outra — ver `recolhas-paradas.ts`.
 */
export const SALTO_DA_PERGUNTA = "Sem problema, essa pode ficar para depois.";

export function saltarAPergunta(estado: EstadoDaRecolha): RespostaDaRecolha {
  // Sem morada não se pergunta o código postal dela — vão as duas juntas.
  const juntos: Partial<Record<PassoDaRecolha, PassoDaRecolha[]>> = {
    morada: ["codigoPostal"],
    moradaDestino: ["codigoPostalDestino"],
  };
  const d: DadosDaRecolha = {
    ...estado.dados,
    saltados: [...new Set([...(estado.dados.saltados ?? []), estado.passo, ...(juntos[estado.passo] ?? [])])],
  };
  const passo = primeiroPassoEmFalta(d);
  return { estado: { passo, dados: d }, resposta: `${SALTO_DA_PERGUNTA} ${perguntaParaContinuar(passo, d)}` };
}

/**
 * O SERVIÇO PERGUNTADO OUTRA VEZ, SEM SE APRESENTAR OUTRA VEZ — 20-10-2026.
 *
 * Pelo caminho do Gemini, quem dava a morada antes de dizer o serviço ouvia a
 * apresentação inteira de novo e «Em que posso ajudar?» — o Horácio escreveu a
 * morada a seguir ao «Boa tarde» e foi isso que levou. Diz-se o que ficou
 * anotado, e pergunta-se só o serviço; a quem mandou imagens, sem lhe pedir
 * que conte o que é para levar.
 */
function servicoDeNovo(d: DadosDaRecolha, antes: DadosDaRecolha, comLista: boolean): string {
  const anotado = d.address && !antes.address ? "Obrigada, fica anotada a morada." : "Obrigada, fica anotado.";
  if (comLista) {
    const pergunta = mandouImagens(d)
      ? "Para registar o pedido, diga-me só que serviço é — se for mais fácil, responda com o número:"
      : "E o que é para levar ou fazer? Se for mais fácil, responda com o número:";
    return `${anotado} ${pergunta}\n${LISTA_DE_SERVICOS}`;
  }
  return mandouImagens(d)
    ? `${anotado} ${SERVICO_PELAS_IMAGENS}`
    : `${anotado} E o que é para levar ou fazer? Diga-me à vontade, pelas suas palavras.`;
}

/**
 * O SERVIÇO QUE A CLYON NÃO FAZ, DITO COM DELICADEZA — 25-10-2026.
 *
 * A montagem de móveis e a jardinagem e limpeza de quintais saíram do site e
 * do simulador, e a Vitória deixou de as oferecer. Quem as pede por palavras
 * (ou pelo número de uma lista antiga) ouve que de momento a CLYON não as faz,
 * e logo a seguir se precisa de outra coisa — o passo fica no serviço, sem
 * pedido registado para um trabalho que ninguém lhe vai fazer.
 *
 * Com a apresentação quando ainda não se fez (a primeira mensagem), e à
 * segunda vez com a oferta de uma pessoa — que é também o que faz a frase
 * diferente da primeira, que o envio calaria por repetida (`jaFoiDito`).
 */
function recusarOServico(
  servico: string,
  dados: DadosDaRecolha,
  jaCumprimentou: boolean,
  agora: Date,
  comLista: boolean,
): RespostaDaRecolha {
  const d: DadosDaRecolha = { ...dados };
  delete d.serviceType;
  const vezes = (d.tentativas?.servico ?? 0) + 1;
  d.tentativas = { ...d.tentativas, servico: vezes };
  const ola = jaCumprimentou ? "" : `${apresentacao(saudacao(agora), primeiroNome(d.contactName))}\n\n`;
  return {
    estado: { passo: "servico", dados: d },
    resposta:
      `${ola}${naoFazemosEsseServico(servico)} ${precisaDeOutraCoisa(comLista ? LISTA_DE_SERVICOS : null)}` +
      (vezes >= 2 ? OFERECER_UMA_PESSOA : ""),
    foraDoPlano: servico,
  };
}

/**
 * O «OBRIGADA PELAS IMAGENS!» NA RESPOSTA — 20-10-2026.
 *
 * Depois da apresentação, quando a há, e antes de tudo o resto. E toma o
 * lugar do «Obrigada» que a resposta já trouxesse: «Obrigada pelas imagens!
 * Obrigada, Judite!» lia-se como um engano.
 */
export function comAgradecimentoDasImagens(resposta: string): string {
  const i = resposta.indexOf("\n\n");
  const temApresentacao = i > 0 && resposta.slice(0, i).includes(QUEM_FALA);
  const cabeca = temApresentacao ? resposta.slice(0, i + 2) : "";
  let resto = temApresentacao ? resposta.slice(i + 2) : resposta;
  if (resto.startsWith("Obrigada pelas imagens")) return resposta;
  const comNome = /^Obrigada, ([A-ZÀ-Ý][\p{L}-]*)!\s*/u.exec(resto);
  if (comNome) return `${cabeca}Obrigada pelas imagens, ${comNome[1]}! ${resto.slice(comNome[0].length)}`;
  const comVirgula = /^Obrigada, /.exec(resto);
  if (comVirgula) return `${cabeca}Obrigada pelas imagens, ${resto.slice(comVirgula[0].length)}`;
  const sozinho = /^Obrigada[!.]\s*/.exec(resto);
  if (sozinho) resto = resto.slice(sozinho[0].length);
  return `${cabeca}${OBRIGADA_PELAS_IMAGENS} ${resto}`;
}

/**
 * O QUE SE VIU NAS FOTOGRAFIAS, NA RECOLHA — 21-10-2026.
 *
 * *«Se o cliente enviou as imagens, elas mostram o que é para recolher.»* — e
 * desde hoje a Vitória vê-as (`whatsapp-imagem.ts`). O que se viu é a
 * descrição do pedido — «Nas imagens: cerca de 30 sacos de entulho numa
 * sala» —, no lugar do «Ver as fotografias enviadas pelo cliente» ou a
 * seguir ao que ele escreveu. E quando ainda não se sabe o serviço,
 * adivinha-se pelo que se viu, com as mesmas pistas das palavras
 * (`servicoDoTexto`).
 *
 * Devolve o serviço adivinhado — para a Vitória dizer que foi pelas imagens
 * (`servicoVistoNasImagens`), e o cliente poder corrigir — ou `null`.
 * Mexe em `d`. Pode correr duas vezes: a descrição não se repete.
 */
export function aplicarOQueSeViu(
  d: DadosDaRecolha,
  visto: string[] | undefined,
  /** Sem adivinhar o serviço — quando ele pediu um que a CLYON não faz (25-10-2026). */
  adivinhar = true,
): string | null {
  if (!visto || visto.length === 0) return null;
  d.fotosDitas = true;
  const nasImagens = `Nas imagens: ${visto.join("; ")}.`.slice(0, 2000);
  if (!d.description || d.description === DESCRICAO_DAS_FOTOS) d.description = nasImagens;
  else if (!d.description.includes(nasImagens)) d.description = `${d.description}\n${nasImagens}`.slice(0, 4000);
  if (d.serviceType || !adivinhar) return null;
  const s = servicoDoTexto(visto.join(". "));
  if (!s) return null;
  d.serviceType = s;
  return s;
}

/** O serviço adivinhado, dito como adivinhado — para ele corrigir se for outro. */
export function servicoVistoNasImagens(servico: string): string {
  const etiqueta = (ETIQUETAS[servico] ?? servico).toLowerCase();
  return `Pelo que vejo, é ${etiqueta} — fica anotado; se for outra coisa, diga-me.`;
}

/**
 * SÓ IMAGENS, SEM UMA PALAVRA — a Benedita mandou duas fotografias, o cliente
 * do saco de roupa um vídeo, e nenhum levou resposta (20-10-2026).
 *
 * As imagens são a descrição: o passo de contar o que há para levar salta-se.
 * Agradece-se, e pergunta-se o que falta a seguir — o serviço, a morada, o
 * elevador. Pura, como o resto da recolha.
 */
export function responderAsImagens(
  estado: EstadoDaRecolha,
  agora: Date = new Date(),
  contexto: { jaCumprimentou?: boolean; visto?: string[] } = {},
): RespostaDaRecolha {
  const d: DadosDaRecolha = { ...estado.dados, fotosDitas: true };
  // O que se viu nelas (21-10-2026) — ver `aplicarOQueSeViu`.
  const adivinhado = aplicarOQueSeViu(d, contexto.visto);
  if (!d.description) d.description = DESCRICAO_DAS_FOTOS;
  const passo = primeiroPassoEmFalta(d);
  if (passo === "servico") {
    // A primeira pergunta já leva a apresentação, quando ainda não se fez.
    const pergunta = contexto.jaCumprimentou ? SERVICO_PELAS_IMAGENS : perguntaDo("servico", d, false, agora);
    return {
      estado: { passo, dados: d },
      resposta: comAgradecimentoDasImagens(pergunta),
    };
  }
  const ola = contexto.jaCumprimentou ? "" : `${apresentacao(saudacao(agora), primeiroNome(d.contactName))}\n\n`;
  // O serviço que se adivinhou diz-se, para ele corrigir — e a pergunta a seguir.
  const visto = adivinhado ? `${servicoVistoNasImagens(adivinhado)}\n\n` : "";
  return {
    estado: { passo, dados: d },
    resposta: `${ola}${OBRIGADA_PELAS_IMAGENS} ${visto}${perguntaDo(passo, d, false, agora)}`,
  };
}

/**
 * A PRIMEIRA RESPOSTA QUANDO AINDA NÃO SE SABE O SERVIÇO — com o que já se
 * sabe dito. A do Paço de Arcos mandou a fotografia dos big bags e a morada,
 * e ouviu «Em que posso ajudar? Diga-me o que precisa de levar ou fazer»
 * (20-10-2026). Agora: as imagens agradecidas, a morada anotada, e só a
 * pergunta do serviço.
 */
export function primeiraPerguntaDoServico(
  d: DadosDaRecolha,
  imagensNovas: number,
  comLista: boolean,
  agora: Date = new Date(),
): string {
  let r = perguntaDo("servico", d, comLista, agora);
  if (d.address) {
    const i = r.indexOf("\n\n");
    r = i > 0 ? `${r.slice(0, i + 2)}Fica anotada a morada. ${r.slice(i + 2)}` : `Fica anotada a morada. ${r}`;
  }
  return imagensNovas > 0 ? comAgradecimentoDasImagens(r) : r;
}

/**
 * A mensagem quando o pedido ficou registado.
 *
 * Começa SEMPRE por «Pedido #N registado» — é a marca que a releitura procura
 * no fio (`MARCA_DE_PEDIDO_REGISTADO`). E acaba com o agradecimento da
 * Vitória, que é o sítio do emoji (ver `voz-da-vitoria`).
 */
export function mensagemDePedidoRegistado(
  pedidoId: number,
  comFotos: boolean,
  nome?: string | null,
  /** Registado sem o SIM dele, 30 minutos depois do resumo — ver `recolhas-paradas.ts`. */
  sozinho = false,
): string {
  const p = primeiroNome(nome);
  /*
   * COM O PRAZO — 23-10-2026. A Olga perguntou «Quanto tempo para enviar o
   * orçamento?» no mesmo minuto em que confirmou, e a resposta foi só «as
   * propostas chegam-lhe por aqui». Agora diz-se quando.
   */
  return (
    `Pedido #${pedidoId} registado! Muito obrigada${p ? `, ${p}` : ""}.\n\n` +
    (sozinho
      ? "Como não recebi resposta ao resumo, registei-o com os dados que me deu — se alguma coisa estiver mal, é só dizer-me e corrigimos.\n\n"
      : "") +
    `A CLYON vai conferi-lo e enviá-lo aos parceiros verificados da sua zona, e as propostas chegam-lhe por aqui em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.` +
    (comFotos
      ? ""
      : "\n\nSe tiver fotografias do que é para levar, envie-as agora por aqui: ficam no pedido e ajudam a acertar o preço.") +
    "\n\nQualquer dúvida, estou por aqui 😊"
  );
}
