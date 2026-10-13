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

import { SERVICE_CATEGORIES } from "./service-categories";
import { primeiroNome } from "./mensagem-whatsapp";
import { deslocamentoDeLisboa, instanteEmLisboa } from "./hora-de-lisboa";
import type { CamposCrus, Intencao } from "./whatsapp-compreensao";
import { ENTIDADE_QUE_FACTURA } from "./identificacao-legal";
import { TAXA_IVA } from "./taxas-plataforma";
import { partirMorada } from "./morada-partida";
import { nifDaFactura } from "./pedido-valores";
import { PRAZO_DE_RESPOSTA } from "./seo-data";
import { PRECO_DA_MUDANCA_CURTO } from "./tabela-das-mudancas";
import {
  andarDaResposta,
  andarNaFrase,
  DESCRICAO_DAS_FOTOS,
  desisteDoPedido,
  falaDeCoisas,
  falaDoAcesso,
  falaDoIva,
  nomeDoTexto,
  pareceQuando,
  perguntaDirectaPeloPreco,
  perguntaPeloPreco,
  remeteParaAsFotos,
  separarAcessoDaMorada,
  valeParaAmbos,
} from "./leitor-da-recolha";
import {
  agradecimento,
  apresentacao,
  boasVindasDeVolta,
  desculpasPeloAtendimento,
  eClienteDeVolta,
  perguntaPelaDisponibilidade,
  perguntaSeFazemos,
  reclamaDoAtendimento,
  respostaADisponibilidade,
} from "./voz-da-vitoria";

/*
 * QUEM FACTURA E QUANTO ACRESCE, na pergunta da factura — 29-09-2026.
 *
 * «Precisa de factura com NIF?» sozinha deixava a pessoa responder sem saber
 * que a factura vem de uma empresa com outro nome e que o valor sobe 23 %.
 * Dito na pergunta, não há surpresa no fim.
 */
/*
 * E DESDE 01-10-2026, COM IVA INCLUÍDO: há factura em todas as vendas e o
 * preço não muda com ela. Dizia «se sim… acrescem 23 % de IVA». A pergunta
 * passou a ser só se a factura leva o NIF — o «sim» guarda-se em
 * `precisaFatura`, e o NIF pede-se a seguir, no backoffice.
 */
const SE_PEDIR_FACTURA =
  `Há factura em todas as vendas, emitida pela ${ENTIDADE_QUE_FACTURA.nomeCurto}, nossa parceira, ` +
  `e os preços já vêm com IVA incluído (${Math.round(TAXA_IVA * 100)} %).`;

/** O NIF não se pede na recolha — 13-10-2026, ver `ordemDosPassos`. E diz-se. */
const O_NIF_SO_SE_AVANCAR = "Não precisa de o dar agora: só lho pedimos se avançar com uma proposta.";

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
   * O ACESSO NO DESTINO DE UMA MUDANÇA — 10-10-2026, o Vinicius.
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
   * O que ele escreveu do acesso a seguir à morada — «saída para rua a porta
   * ja e na calcada Olivais». Sai da morada (ver `separarAcessoDaMorada`) e
   * vai para a descrição do pedido.
   */
  acessoDito?: string | null;
  entulhoQuantidade?: string | null;
  /** O que a pessoa escreveu sobre a data, tal e qual. */
  quandoTexto?: string | null;
  /** A data interpretada, em ISO, quando se percebeu uma. */
  dataDesejada?: string | null;
  urgency?: string | null;
  description?: string;
  precisaFatura?: boolean;
  /**
   * O NIF para a factura — 10-10-2026. O Cristiano disse «Sim, pode colocar
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
};

const ETIQUETAS: Record<string, string> = Object.fromEntries(
  SERVICE_CATEGORIES.map((c) => [c.id, c.label]),
);

/** A lista numerada, como se escreve numa mensagem. */
const LISTA_DE_SERVICOS = SERVICE_CATEGORIES.map((c, i) => `${i + 1}. ${c.label}`).join("\n");

/**
 * Palavras que denunciam o serviço, para quem escreve em vez de escolher o número.
 *
 * OS BIG BAGS SÃO ENTULHO — 06-10-2026. «Recolha de 22 bigbags de 1T na zona
 * da Baixa da Banheira» caía na pista dos móveis, pela palavra «recolha», e o
 * David levou «Recolha de móveis — certo». Quem fala em big bags (os sacos de
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
 * — o João. Duas frases claras, e uma lista de dez números no fim. «Vagar»,
 * «despejar», «desocupar» e «retirar o mobiliário de um apartamento» são
 * esvaziar; e «mobiliário» e «mobília» são móveis, que a pista dos móveis só
 * conhecia como «móvel» e «móveis».
 */
const PISTAS: Array<[string, RegExp]> = [
  ["mudanca", /\bmudan[cç]a|mudar\s+de\s+casa|mudar-me\b/],
  ["recolha_entulho", /\bentulho|obra\b|obras\b|escombro|\bbig[\s-]?bags?\b|\bcali[cç]a\b/],
  /*
   * JANELAS, VIDROS E CAIXILHARIA SÃO MONOS — 13-10-2026. «Vocês fazem
   * recolha de janelas?» — o Lázaro — levou «Recolha de móveis», pela palavra
   * «recolha». «Porta» fica de fora: «estacionar à porta» diz-se todos os dias.
   */
  [
    "recolha_monos",
    /\bmonos?\b|electrodom[eé]stic|eletrodom[eé]stic|frigor[ií]fico|m[aá]quina de lavar|colch[aã]o|\bjanela|caixilh|\bvidros?\b|alum[ií]nio|\bestores?\b/,
  ],
  [
    "esvaziamento_apartamento",
    /esvazia\w*\s+(o\s+|um\s+|de\s+)?apartamento|apartamento\s+(todo|inteiro)|\b(vagar|despejar|desocupar|libertar)\s+(o\s+|um\s+|uma\s+|do\s+)?(apartamento|t[0-6]\b)|\b(retirar|tirar|levar)\s+(o\s+|todo\s+o\s+|a\s+)?(mobiliario|mobilia|recheio|moveis|tudo)\s+(de|do|dum)\s+(um\s+|o\s+)?apartamento|\brecheio\s+(de|do|dum)\s+(um\s+)?apartamento/,
  ],
  [
    "esvaziamento_casa",
    /esvazia\w*|casa\s+(toda|inteira)|limpar\s+(a\s+)?casa\s+toda|\b(vagar|despejar|desocupar)\s+(a\s+|uma\s+)?(casa|moradia|vivenda)\b|\brecheio\s+(de|da|duma)\s+(uma\s+)?casa\b/,
  ],
  ["montagem_moveis", /\bmontagem|montar|desmontar|desmontagem|\bikea\b/],
  ["jardinagem", /jardi[mn]|relva|quintal|sebe|poda/],
  ["manutencao_casa", /manuten[cç][aã]o|pintura|pintar|canaliza|torneira|repara[cç]/],
  [
    "recolha_moveis",
    /m[oó]ve(l|is)|mobili[aá]rio|mob[ií]lia|sof[aá]|chaise|cama\b|arm[aá]rio|roupeiro|c[oó]moda|cristaleira|aparador|mesa\b|cadeira|estante|guarda-?roupa|recolh/,
  ],
  ["outro", /\boutro\b/],
];

/** O serviço pelas PALAVRAS, sem o número da lista — para ler frases soltas. */
export function servicoPorPalavras(texto: string): string | null {
  const t = semAcentos(texto);
  for (const [id, re] of PISTAS) {
    if (id === "outro") continue;
    if (re.test(t)) return id;
  }
  return null;
}

function semAcentos(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function servicoDoTexto(texto: string): string | null {
  const t = semAcentos(texto).replace(/[.!]+$/, "");
  const numero = t.match(/^\s*(\d{1,2})\s*[.)]?\s*$/);
  if (numero) {
    const c = SERVICE_CATEGORIES[Number(numero[1]) - 1];
    return c ? c.id : null;
  }
  for (const [id, re] of PISTAS) {
    if (re.test(t)) return id;
  }
  return null;
}

/**
 * ⚠️ A CLYON NAO COMPRA NADA — e quem quer vender tem de o saber ao minuto.
 *
 * 12:21  CLIENTE: «Bom dia tenho alguns artigos para venda.»
 * 12:23  CLIENTE: «Quero vender estes artigos semi-novos e preciso de recolha»
 * 12:49  CLIENTE: «E qual o valor para compra para os artigos que eu enviei»
 *
 * — a Carla, 30-09-2026. Disse-o tres vezes. O assistente registou-lhe uma
 * «Recolha de moveis» sem uma palavra, e ela ia receber propostas de
 * profissionais a COBRAR-LHE para levar as coisas que ela julgava estar a
 * vender. Vinte e cinco minutos de formulario para acabar num desencontro.
 *
 * O que a CLYON faz esta escrito na propria pagina «recolha gratuita de
 * moveis usados»: vender no OLX ou no Facebook aparece la como ALTERNATIVA
 * ao nosso servico. Nos levamos, e e o cliente que paga.
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
  "O que fazemos é a recolha — vamos buscar e levamos, e é um serviço que o cliente paga.\n\n" +
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
 * — a Carla, 30-09-2026. «Podemos evitar isso» e um nao sem sombra de
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
   * O NIF PARA DEPOIS É UM SIM — 13-10-2026, a Susana: «Prefiro disponibilizar
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
  const resto = texto
    .replace(m ? m[0] : "", "")
    .replace(/[,;]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*,?\s*portugal\s*$/i, "")
    .trim();
  const city = resto.length >= 2 ? resto.slice(0, 120) : null;
  return { postalCode, city };
}

const DIAS_DA_SEMANA = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

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
   * *«preferencialmente esta semana — mas não é urgente»* — a Catarina, a
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
     * «2ª FEIRA» É SEGUNDA — 10-10-2026. O Cristiano escreveu «2ª feira» e a
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

  const numerica = t.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
  if (numerica) {
    const ano = numerica[3]
      ? Number(numerica[3].length === 2 ? `20${numerica[3]}` : numerica[3])
      : parede.getUTCFullYear();
    dia = new Date(Date.UTC(ano, Number(numerica[2]) - 1, Number(numerica[1]), 9, 0, 0, 0));
    if (!numerica[3] && dia.getTime() < parede.getTime() - 86_400_000) dia.setUTCFullYear(ano + 1);
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
     * *«Tenho urgencia estou de mudancas»* — a Carla, 30-09-2026. O
     * `\burgente\b` nao apanha «urgencia», e por isso o pedido de quem tinha
     * acabado de dizer que tinha pressa saia como «sem pressa».
     *
     * O apagador da urgencia NEGADA, vinte linhas acima, ja escrevia
     * `urgen\w*`: eram duas leituras da mesma palavra a discordar uma da
     * outra no mesmo ficheiro.
     */
    dia = new Date(parede);
  } else {
    for (let i = 0; i < DIAS_DA_SEMANA.length; i++) {
      if (new RegExp(`\\b${DIAS_DA_SEMANA[i]}(-feira)?\\b`).test(t)) {
        dia = new Date(parede);
        let salto = (i - parede.getUTCDay() + 7) % 7;
        if (salto === 0) salto = 7; // «sexta» dito numa sexta é a próxima
        dia.setUTCDate(dia.getUTCDate() + salto);
        break;
      }
    }
  }

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
       * *«Tenho urgencia estou de mudancas»* — a Carla. O resumo devolveu-lhe
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
 * COMO SE TRATA A PESSOA: «Bom dia, Sónia.»
 *
 * O PRIMEIRO NOME E MAIS NADA. Não «Sra. Sónia», por muito que apeteça: o
 * género de quem escreve não está guardado em lado nenhum, e adivinhá-lo pelo
 * nome acerta em Sónia e falha em Alex, em Andrea e em toda a gente com um
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
 * A Sónia escreveu «Bom dia (...) Com os melhores cumprimentos, Sónia
 * Agostinho» e levou de volta «Qual é a morada certa?», seco. O nome dela
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
 * — a Carla, 30-09-2026. Dois cumprimentos com dois minutos de intervalo,
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
       * *«Olá! Falámos agora mesmo. O meu nome é Ana Ferreira e aqui estão as
       * fotos.»* — e a resposta foi «Boa tarde! Aqui é a CLYON. Diga-me o que
       * precisa», e duas mensagens depois «Com quem estou a falar?». Ela tinha
       * dito o nome na primeira frase.
       */
      const ola = apresentacao(saudacao(agora), primeiroNome(dados.contactName));
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
     * perguntas para uma coisa que toda a gente escreve numa linha — e o Marco
     * escreveu-a assim, com o «R/C Esq.» lá dentro, e ouviu «Em que andar é?»
     * logo a seguir. A seguir disse que estava «muito complicado».
     *
     * Pede-se tudo junto, e só se volta a perguntar o que faltar.
     */
    case "morada":
      return "Qual é a morada, por favor? Rua, número e andar, e o código postal se o tiver — é por aí que o profissional se orienta.";
    case "codigoPostal":
      // Só o que falta: o João escreveu «Moscavide» na morada.
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
      return `Deseja factura com o seu NIF? ${O_NIF_SO_SE_AVANCAR} ${SE_PEDIR_FACTURA}`;
    case "nif":
      return "Qual é o NIF para a factura? Se não o tiver à mão, não faz mal: diga-me e pedimo-lo depois.";
    case "confirmar":
      return resumo(dados);
  }
}

/**
 * COMO CHEGA O PREÇO — dito a quem pergunta, em vez de lhe dar uma ordem.
 *
 *   CLIENTE: Primeiro quero saber o valor do orçamento
 *   CLYON:   Para registar responda SIM. Se houver algo errado, diga-me o quê.
 *
 * — o Cristiano, 09-10-2026. Fez uma pergunta e levou uma instrução. O que é
 * verdade, e é o que o site diz em todas as páginas: o preço vem das
 * propostas dos profissionais, depois de o pedido estar registado, sem custo
 * e sem compromisso. Dizê-lo tira-lhe o medo de dizer SIM.
 */
export const COMO_CHEGA_O_PRECO =
  "O valor é dado pelos profissionais da sua zona: com o pedido registado, as propostas " +
  `chegam-lhe por aqui em menos de ${PRAZO_DE_RESPOSTA.porExtenso}, grátis e sem compromisso — ` +
  "só avança se quiser.";

/** A segunda vez que pergunta: a mesma verdade, sem a repetir inteira. */
export const LEMBRETE_DO_PRECO =
  "Como lhe disse, o valor chega com as propostas dos profissionais, assim que o pedido ficar registado.";

/** E o IVA, a quem perguntou por ele — como diz a pergunta da factura. */
export const O_IVA_ESTA_INCLUIDO = `E os preços já vêm com IVA incluído (${Math.round(TAXA_IVA * 100)} %).`;

/**
 * A NOTA DO PREÇO para pôr à frente da resposta — ou nada.
 *
 * Na primeira mensagem só responde a uma pergunta DIRECTA («indicar o preço
 * total fechado», «quanto custa»): aí «gostava de pedir um orçamento» é o
 * pedido, e a conversa toda lhe responde. Daí para a frente, qualquer pergunta
 * pelo preço. E quem perguntou pelo IVA leva a resposta — o Vinicius pediu
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
      /o valor e dado pelos profissionais/.test(semAcentos(m.texto)),
  );
}

/** Quantas fotografias ele mandou, pelas marcas que a ponte deixa no fio. */
export function fotosNoFio(
  fio: Array<{ direccao?: string; texto?: string }> | null | undefined,
): number {
  if (!Array.isArray(fio)) return 0;
  return fio.filter((m) => m?.direccao === "in" && (m.texto ?? "").trim() === "[fotografia]").length;
}

/**
 * QUEM DESISTE A MEIO — o Marco, 10-10-2026.
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
      "Se quiser, alguém da nossa equipa trata do resto consigo por aqui, sem mais perguntas.",
    pedirPessoa: true,
    motivoDaEntrega: "Desistiu a meio da recolha — ver a conversa",
  };
}

/** Quem pede uma pessoa — e tem-na, com gosto. */
export const PASSO_A_ALGUEM_DA_EQUIPA =
  "Com todo o gosto! Vou passar a conversa a alguém da nossa equipa, que lhe responde por aqui assim que puder.";

/** Quem cancela sem nada recolhido. A porta fica aberta. */
export const FICA_SEM_EFEITO =
  "Está bem, fica sem efeito. Sempre que precisar, é só escrever-nos por aqui — terei todo o gosto em ajudar.";

/**
 * QUEM SE QUEIXA DO ATENDIMENTO — o Lázaro, 06-10-2026 (ver `voz-da-vitoria`).
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
 * «Destino: Rua de chibuto 395 olivais lisboa, 1800-057, olivais lisboa» — o
 * Vinicius escreveu a localidade na rua e outra vez com o código postal.
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
 * «Quando: sábado, 31 de outubro às 09:00» — o Vinicius escreveu «sábado
 * 31/10», e as nove horas eram nossas. Por dentro o pedido precisa de uma
 * hora (a agenda arruma por horas); no resumo que ele lê, só aparece a que
 * ele deu — ou a parte do dia, se foi isso que disse.
 */
function quandoNoResumo(d: DadosDaRecolha): string {
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

export function resumo(d: DadosDaRecolha): string {
  /*
   * O ACESSO NUMA LINHA, E SEM O QUE NÃO INTERESSA — 10-10-2026.
   *
   * Num r/c o elevador não se pergunta (ver `respondido`) e por isso também
   * não se lista: «elevador: —» ao Marco, que tinha dito «R/C», era o resumo
   * a fazer-lhe a pergunta outra vez. E o estacionamento por saber diz-se «a
   * confirmar», e não com um travessão que o envio transformava em hífen e
   * colava à linha seguinte («estacionar à porta: - Quando: Sim»).
   */
  const mudanca = d.serviceType === "mudanca";
  /*
   * NUMA MUDANÇA, AS DUAS PONTAS — 10-10-2026, o Vinicius. O resumo só
   * mostrava o acesso da origem, e o do destino nem se perguntava.
   */
  const acessoDe = (
    floor: string | null | undefined,
    elev: string | null | undefined,
    estac: string | null | undefined,
    rotulo: string,
  ) => {
    const andar = floor === "0" ? "r/c" : floor === "-1" ? "cave" : (floor ?? "—");
    const elevador = elev === "yes" ? "sim" : elev === "small" ? "sim, pequeno" : elev === "no" ? "não" : "—";
    const estacionar = estac === "near" ? "sim" : estac === "far" ? "não" : "a confirmar";
    return [
      `${rotulo}${andar}`,
      floor === "0" && elev !== "yes" ? null : `elevador: ${elevador}`,
      `estacionar à porta: ${estacionar}`,
    ]
      .filter(Boolean)
      .join(" · ");
  };
  // O número só se pede se ele avançar (13-10-2026) — ver `ordemDosPassos`.
  const nif = d.precisaFatura ? (d.nifFactura ? d.nifFactura : "sim, pede-se se avançar") : "não";
  const linhas = [
    `Serviço: ${ETIQUETAS[d.serviceType ?? ""] ?? d.serviceType ?? "—"}`,
    `Nome: ${d.contactName ?? "—"}`,
    `Morada: ${moradaNumaLinha(d.address, d.postalCode, d.city) || "—"}`,
    mudanca ? `Destino: ${moradaNumaLinha(d.moradaDestino, d.codigoPostalDestino, d.localidadeDestino) || "—"}` : null,
    acessoDe(d.floor, d.hasElevator, d.parkingDistance, mudanca ? "Na origem: andar " : "Andar: "),
    mudanca ? acessoDe(d.andarDestino, d.elevadorDestino, d.estacionamentoDestino, "No destino: andar ") : null,
    d.serviceType === "recolha_entulho" ? `Entulho: ${d.entulhoQuantidade ?? "—"}` : null,
    `Quando: ${quandoNoResumo(d)}`,
    // Num entulho sem descrição, a linha do entulho já diz tudo. E uma
    // descrição comprida não se devolve inteira a quem a escreveu: fica toda
    // no pedido, e aqui só o princípio.
    d.serviceType === "recolha_entulho" && !d.description ? null : `Descrição: ${encurtar(d.description) ?? "—"}`,
    `NIF na factura: ${nif}`,
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
     * — a Susana. «Ele não pode pedir isso agora na colecta de dados: o
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

/** Este passo já tem resposta? É isto que decide o que ainda falta perguntar. */
function respondido(passo: PassoDaRecolha, d: DadosDaRecolha): boolean {
  if (desistiuDePerguntar(passo, d)) return true;
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
    case "andar":
      return d.floor != null;
    /*
     * NUM R/C O ELEVADOR NÃO SE PERGUNTA — 10-10-2026.
     *
     *   CLYON:   Há elevador no prédio?
     *   CLIENTE: Como está escrito acima é R/C ou seja só tem os degraus da entrada
     *
     * — o Marco. Ao nível da rua não há nada para subir nem descer, e a
     * pergunta só serve para mostrar que não se leu a morada. Não se grava
     * «não há elevador» (pode haver, e não interessa): fica por responder, e o
     * resumo não o lista.
     */
    case "elevador":
      return d.hasElevator != null || d.floor === "0";
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
       * O David escreveu os 22 big bags três vezes. Num entulho, o que há
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
  const ordem = ordemDosPassos(dados);
  return ordem.find((p) => !respondido(p, dados)) ?? "confirmar";
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
 * — a Carla, 30-09-2026. Ela tinha acabado de dizer que e uma casa terrea, e
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
 * — o David, 06-10-2026, com 22 big bags de entulho à porta. Não é a moradia
 * da Carla (ver `eUmaMoradia`), mas dá no mesmo: o que está cá fora não sobe
 * nem desce, e o elevador não interessa a ninguém.
 *
 * ⚠️ «NA RUA» SÓ CONTA COMO LUGAR, E NUNCA COMO MORADA. «Moro na Rua António
 * Aleixo» começa uma morada; «está na rua», «na rua, pelo que…» e «NA RUA»
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
 * O David disse isto às 12:51, antes de qualquer pergunta sobre o acesso. Sem
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
    /\b(nao (precisa|e preciso|e necessario)( de)? (usar )?(o )?elevador|sem elevador|nao (tem|ha) elevador)\b/.test(t)
  ) {
    f.hasElevator = "no";
    // «Temos elevador, mas é pequeno» — a Susana, 13-10-2026, a quem se
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
 * «Rua João Gomes patacão 7 -4dto Moscavide» — o João. A localidade é o que
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
  // renovar a casa» dava «Lisboa Vou» — a Susana, 13-10-2026.
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
 * A MORADA ESCRITA NUMA FRASE QUE NÃO RESPONDIA À PERGUNTA DA MORADA.
 *
 *   «A morada é Rua Rodrigues de Freitas, N18, 1°esq. 1495-116 Algés»
 *
 * — o Cristiano, na primeira mensagem, e a seguir perguntaram-lhe «Qual é a
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
 * tirar o código: no resumo do Marco ficou
 *
 *   Morada: Travessa João Alves, 7, R/C Esq., 1300-316, Travessa João Alves 7 R/C Esq. Lisboa
 *
 * — a rua duas vezes. A localidade é o que vem DEPOIS do código postal
 * (`partirMorada`, o mesmo que o backoffice usa). E o andar que vier escrito
 * na morada («R/C», «1°esq», «4dto») fica a ser o andar: não se pergunta.
 */
/**
 * A MORADA SEM O RÓTULO À FRENTE — «Apartamento sito em:», «Morada:», «Fica
 * na Rua…». A Susana, 13-10-2026, ficou com «Apartamento sito em:, Rua Duarte
 * Galvão» no pedido.
 */
function semRotuloAFrente(texto: string): string {
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^[^\d]{0,40}:$/.test(l))
    .join("\n")
    .replace(
      /^(?:(?:o|a|o meu|a minha)\s+)?(?:apartamento|casa|moradia|vivenda|im[oó]vel|pr[eé]dio|escrit[oó]rio|loja|armaz[eé]m)?\s*(?:sit[ao]|situad[ao]|localizad[ao]|fica)\s+(?:em|no|na)\b\s*:?\s*/i,
      "",
    );
}

export function guardarMorada(d: DadosDaRecolha, texto: string): void {
  texto = semRotuloAFrente(texto);
  const junto = comHifenNoCodigoPostal(texto.trim()).replace(/\s*\n+\s*/g, ", ");
  const p = partirMorada(junto);
  // O que vem depois do andar, quando é conversa, é o acesso — ver `separarAcessoDaMorada`.
  const { morada, acesso } = separarAcessoDaMorada(p.rua || junto);
  d.address = morada.replace(/[\s,.;]+$/, "").slice(0, 300);
  if (acesso) d.acessoDito = acesso.slice(0, 300);
  if (p.codigoPostal) d.postalCode = p.codigoPostal;
  const localidade = p.localidade?.replace(/\s*,?\s*portugal\s*$/i, "").trim();
  if (localidade) d.city = localidade.slice(0, 120);
  else if (!d.city) {
    const fim = localidadeNoFimDaMorada(d.address);
    if (fim) d.city = fim;
  }
  if (d.floor == null) {
    const andar = andarNaFrase(texto);
    if (andar != null) d.floor = andar;
  }
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
 * O Vinicius escreveu as duas assim, numa mudança, e a de destino foi-lhe
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
const DESPEDIDA =
  /^(muito\s+)?(obrigad[oa]|cumprimentos|com os melhores cumprimentos|melhores cumprimentos|atenciosamente|abra[cç]os?|obg|bjs|beijinhos)\b[^.!?]{0,40}$/i;

/**
 * A DESCRIÇÃO DE UMA MENSAGEM COMPRIDA — tudo o que ela diz do trabalho.
 *
 * Era só as frases com nomes de móveis. Do Vinicius ficou a lista das coisas,
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
function descricaoDaMensagem(texto: string, nome: string | undefined): string | null {
  const linhas: string[] = [];
  let falaDoTrabalho = false;
  for (const linha of texto.split(/\n+/)) {
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
 * Vinicius. A frase inteira era cortada aos 120 caracteres ANTES de se ler a
 * data, e o corte caiu em «31/1»: o resumo disse «domingo, 31 de janeiro».
 * Agora escolhe-se a frase que tem uma data de verdade (um dia, um número) e
 * não a pergunta do «suplemento de fim de semana», e fica só a oração dela.
 */
function quandoDaMensagem(frases: string[]): string | null {
  const candidatas = frases.filter((f) => pareceQuando(f) && !perguntaPeloPreco(f));
  const concreta =
    candidatas.find((f) =>
      /(?<!\d)\d{1,2}\s*[\/.-]\s*\d{1,2}(?![\d-])|\b(hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo)\b|(?<![\d])[2-6]\s*[ªa]?\s*-?\s*f(eira)?\b/.test(
        semAcentos(f),
      ),
    ) ?? candidatas[0];
  if (!concreta) return null;
  const oracoes = concreta.split(/[,;]/).map((o) => o.trim()).filter(Boolean);
  const comData = oracoes.filter((o) => pareceQuando(o));
  return (comData.length > 0 ? comData.join(", ") : concreta).slice(0, 200);
}

/** As frases de uma mensagem: as linhas, e os pontos finais seguidos de maiúscula. */
function frasesDe(texto: string): string[] {
  return texto
    .split(/\n+|(?<=[.!?])\s+(?=[A-ZÀ-Ý«"(])/)
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * TUDO O QUE UMA MENSAGEM SOLTA DIZ — sem modelo nenhum.
 *
 * *«Olá! Gostava de pedir um orçamento à CLYON. Aqui está o sofá. Tirei duas
 * fotos porque é um sofa com chaise longue (...) A morada é Rua Rodrigues de
 * Freitas, N18, 1°esq. 1495-116 Algés. As medidas 2,35m x 0,89m x 0,68 m»*
 *
 * — o Cristiano, 09-10-2026. Sem o Gemini, desta mensagem só se aproveitou o
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
    if (cp && !morada) k.codigoPostal = `${cp[1]}-${cp[2]} ${cp[3]}`.trim();
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

  // A quantidade de entulho dita logo: «Recolha de 22 bigbags» — o David.
  if (servico === "recolha_entulho") {
    const qt = t.match(/\d+(?:[.,]\d+)?\s*(?:big[\s-]?bags?|bigbags?|sacos?|m3|m³|metros?\s+c[uú]bicos?)/i);
    if (qt) k.entulho = qt[0];
  }
  const quando = quandoDaMensagem(frasesDe(t));
  if (quando) k.quando = quando;
  const descricao = descricaoDaMensagem(t, nome ?? undefined);
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
     * Ela escreveu «Morada: Estrada do Paço do Lumiar, n65, 6D, 1600-544
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
    const q = interpretarQuando(valor, agora);
    d.quandoTexto = valor.slice(0, 120);
    d.dataDesejada = q.data ? q.data.toISOString() : null;
    d.urgency = q.urgency;
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
 * — o Cristiano. Escrevia ao mesmo tempo que o assistente: o «Sim» era o do
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
    if (p === "elevador" && d.hasElevator == null && d.floor !== "0") return p;
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
 * — o Cristiano. Ele respondeu, e com mais verdade do que um sim: depende. A
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
   * passam» (a Susana, 13-10-2026). O pedido tem o valor para isto («small»,
   * como no simulador), e é o que muda a conta: o que não cabe desce a pé.
   */
  if (lido === "yes" && /\b(pequen\w*|apertad\w*|estreit\w*|nao (cabe|cabem|passa|passam))\b/.test(chave)) return "small";
  return lido;
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
 * — o Vinicius, 10-10-2026. «À porta» é a resposta inteira, com a palavra da
 * própria pergunta.
 */
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
 * resposta. Excepto o nome DITO como nome («Sou o Marco»): esse corrige o que
 * lá estiver, porque é assim que o «Obrigado Marco» se teria corrigido.
 *
 * Devolve se mudou alguma coisa.
 */
function aproveitarOResto(d: DadosDaRecolha, texto: string, agora: Date): boolean {
  const antes = JSON.stringify(d);
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
  return JSON.stringify(d) !== antes;
}

/**
 * À SEGUNDA VEZ SEM SE PERCEBER, oferece-se uma pessoa — e a frase fica
 * diferente da primeira, que o envio calaria por repetida (`jaFoiDito`).
 */
/** Ele disse alguma coisa da morada, e falta a rua: diz-se o que falta, sem desculpas. */
const SO_FALTA_A_RUA =
  "Só me falta a rua e o número da porta, por favor — é por aí que o profissional se orienta.";

const OFERECER_UMA_PESSOA =
  "\n\nSe preferir, escreva «falar com alguém» e passo a conversa a alguém da nossa equipa.";

/**
 * A PERGUNTA OUTRA VEZ, por outras palavras.
 *
 * O envio cala uma mensagem igual a outra recente (`jaFoiDito`), e quem não
 * percebeu a pergunta da primeira vez também não a percebe igual. E nada de
 * «Responda sim ou não» onde se pode perguntar como gente.
 *
 * E COM DELICADEZA — 13-10-2026. «Preciso da rua e do número» foi o que o
 * Lázaro leu depois de escrever a morada inteira; na avaliação chamou-lhe
 * arrogância. Quem não percebeu fomos nós: pede-se desculpa, e pede-se por
 * favor (ver `voz-da-vitoria`).
 */
function outraVez(passo: PassoDaRecolha, d: DadosDaRecolha): string {
  switch (passo) {
    case "nome":
      return "Peço desculpa, não apanhei bem o seu nome. Como se chama?";
    case "morada":
      return "Peço desculpa, não apanhei bem a rua e o número da porta. Pode escrevê-los outra vez, por favor? É por aí que o profissional se orienta.";
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
      return `Peço desculpa, não percebi bem: deseja factura com o seu NIF? ${O_NIF_SO_SE_AVANCAR}`;
    case "nif":
      return "Peço desculpa, não consegui ler o NIF. São 9 algarismos — ou, se preferir, dá-mo depois.";
    case "servico":
      return `Peço desculpa, não percebi bem o que precisa. Diga-me por palavras suas — ou, se for mais fácil, responda com o número:\n${LISTA_DE_SERVICOS}`;
    case "confirmar":
      return "Se estiver tudo certo, é só responder SIM e fica registado. Se alguma coisa estiver mal, diga-me e eu corrijo.";
  }
}

/**
 * A RESPOSTA À PERGUNTA QUE ESTAVA FEITA — e só ela.
 *
 * Devolve `true` quando o texto respondeu (e `d` ficou com a resposta), e
 * `false` quando não respondeu: aí quem chama vê se é outra coisa — um sim
 * atrasado, o nome dito tarde, uma pergunta pelo preço — antes de repetir.
 *
 * Cada passo aceita SÓ o que é dele. Era o contrário: qualquer texto ia para a
 * gaveta da pergunta em cima, e assim «Obrigado Marco» foi o nome, «Sou o
 * Marco» o andar, «Sim» a data e «2ª feira» a descrição.
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
      // «Como está escrito acima é R/C» — o Marco. Ao nível da rua, o
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
      anotarOAcesso(d, "Estacionamento", t);
      // «A porta de ambos» — o Vinicius, numa mudança: vale para as duas pontas.
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
      const q = interpretarQuando(dito, agora);
      d.quandoTexto = dito.slice(0, 120);
      d.dataDesejada = q.data ? q.data.toISOString() : null;
      d.urgency = q.urgency;
      return true;
    }
    case "descricao": {
      if (remeteParaAsFotos(t)) {
        d.description = DESCRICAO_DAS_FOTOS;
        return true;
      }
      if (t.length < 3 || simOuNaoCurto(t)) return false;
      if (pareceQuando(t) && !falaDeCoisas(t) && t.length <= 60) return false;
      if ((perguntaPeloPreco(t) || nomeDoTexto(t) != null) && !falaDeCoisas(t)) return false;
      d.description = t.slice(0, 4000);
      return true;
    }
    case "fatura": {
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

  if (/^(recomecar|reiniciar|comecar de novo|do inicio)$/.test(chave)) {
    const novo = recolhaNova();
    return { estado: novo, resposta: `Claro, vamos recomeçar.\n\n${perguntaDo("servico", {})}` };
  }
  if (/^(cancelar|parar|deixa|deixa estar|esquece|nao quero)$/.test(chave)) {
    return { estado, resposta: FICA_SEM_EFEITO, desistir: true };
  }
  // «pessoa» sozinha não chega: «sofá para uma pessoa» é uma descrição.
  if (/(falar com (alguem|uma pessoa|um humano)|quero uma pessoa|\bhumano\b|atendente|operador|nao (e|es|sou) um bot|nao quero (um |falar com um )?bot|\brobot\b|\b(e|es|sera)\s+(um\s+)?(robo|bot)\s*\?)/.test(chave)) {
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
   * A conversa da Ana Filipa Rodrigues, às 16:07. Ela escreveu «Morada:
   * Estrada do Paço do Lumiar, n65, 6D, 1600-544 Lisboa» enquanto a pergunta
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

  /* ── O SERVIÇO: a primeira mensagem, lida inteira ─────────────────────── */
  if (estado.passo === "servico") {
    /*
     * A PRIMEIRA MENSAGEM DIZ MUITAS VEZES TUDO — 10-10-2026.
     *
     * O Cristiano mandou o sofá, as medidas, a morada e o andar; o João o
     * serviço, a localidade, o andar, o elevador e o nome. Lia-se SÓ o
     * serviço, e o resto perguntava-se a seguir, uma coisa de cada vez. Agora
     * lê-se tudo (`lerMensagemLivre`) e pergunta-se só o que falta.
     */
    const lido = lerMensagemLivre(t);
    const s = servicoDoTexto(t);
    if (s) lido.servico = s;
    const vazios: CamposCrus = { ...lido };
    if (d.contactName) delete vazios.nome;
    Object.assign(d, fundirCampos(d, vazios, agora));
    juntarFactos(d, factos);
    if (!d.description && fotos > 0) d.description = DESCRICAO_DAS_FOTOS;
    if (!d.serviceType) {
      const aprendeu = JSON.stringify(d) !== JSON.stringify(estado.dados);
      /*
       * «Olá! Gostava de pedir um orçamento à CLYON.» — a Susana, 13-10-2026,
       * levou «Peço desculpa, não percebi bem o que precisa». A primeira
       * mensagem é o princípio da conversa, e não uma resposta que falhou:
       * cumprimenta-se e pergunta-se.
       */
      if (aprendeu || !jaCumprimentou) {
        return {
          estado: { passo: "servico", dados: d },
          resposta: jaCumprimentou
            ? `Obrigada, fica anotado. E o que é para levar ou fazer? Se for mais fácil, responda com o número:\n${LISTA_DE_SERVICOS}`
            : perguntaDo("servico", d, true, agora),
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
     * — o Vinicius. Não é um erro no resumo, é mais trabalho: fica no pedido,
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
      const q = interpretarQuando(t, agora);
      d.quandoTexto = t.slice(0, 120);
      d.dataDesejada = q.data ? q.data.toISOString() : null;
      d.urgency = q.urgency;
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
    if (remeteParaAsFotos(t) && !d.description) {
      d.description = DESCRICAO_DAS_FOTOS;
      aprendeu = true;
    }
    if (aproveitarOResto(d, t, agora)) aprendeu = true;
    const nomeDito = nomeDoTexto(t);

    if (!respondido(estado.passo, d)) {
      if (aprendeu || nomeDito || notaDoPreco) {
        const p = primeiroNome(d.contactName);
        const anotado = nomeDito && p ? `Obrigada, ${p}! ` : aprendeu ? "Obrigada, fica anotado. " : "";
        // Na morada, o que falta diz-se: a rua e o número.
        const pergunta = estado.passo === "morada" ? SO_FALTA_A_RUA : perguntaDo(estado.passo, d, false);
        return {
          estado: { passo: estado.passo, dados: d },
          resposta: notaDoPreco + anotado + pergunta,
        };
      }
      /*
       * NÃO SE PERCEBEU NADA. Repete-se por outras palavras — e à segunda vez
       * segue-se em frente com o que houver: ver `PASSOS_QUE_SE_DEIXAM`.
       */
      const n = (d.tentativas?.[estado.passo] ?? 0) + 1;
      d.tentativas = { ...d.tentativas, [estado.passo]: n };
      const curtoDeMais = t.length < 2;
      if (n >= 2 && !curtoDeMais) {
        if (estado.passo === "andar") d.floor = t.slice(0, 40);
        else if (estado.passo === "descricao") d.description = t.slice(0, 4000);
        else if (estado.passo === "nome" && t.length <= 60 && !/\d/.test(t)) d.contactName = t;
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
  // Quem mandou fotografias já mostrou o que é para levar.
  if (!d.description && fotos > 0) d.description = DESCRICAO_DAS_FOTOS;

  /*
   * Passos que já ficaram respondidos de caminho saltam-se — TODOS.
   *
   * Eram três, escritos à mão: o código postal, o do destino, e o elevador
   * quando vinha no andar. Tudo o resto perguntava-se pela ordem, mesmo
   * respondido: o David disse «Tem estacionamento no local» e ouviu «Dá para
   * encostar a carrinha à porta?» oito minutos depois (06-10-2026). Quem
   * decide se um passo tem resposta é `respondido`, o mesmo que o caminho do
   * Gemini usa.
   */
  let proximo = passoSeguinte(estado.passo, d);
  while (proximo !== "confirmar" && respondido(proximo, d)) {
    proximo = passoSeguinte(proximo, d);
  }
  // O cumprimento também por aqui: este é o caminho de quando o Gemini está em
  // baixo, e uma pessoa que apanhe esse dia merece os mesmos modos.
  const abertura = aberturaDaResposta(d, estado.passo, proximo, agora, jaCumprimentou);
  const voz = vozAntesDaPergunta(t, estado, d, proximo, abertura !== "");
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
 * Lázaro, que tinha perguntado se fazíamos e dito que já era cliente, chamou-
 * -lhe arrogância.
 *
 * Por ordem, e só uma destas coisas:
 *   1. quem volta: «Que bom voltar a falar consigo, Lázaro!»;
 *   2. o serviço, na primeira resposta: «Fazemos, sim!» a quem perguntou, ou
 *      «Com todo o gosto!» — e o que se percebeu, para ele poder corrigir;
 *   3. o nome, quando chegou agora: «Muito prazer, Lázaro!»;
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
): string {
  const p = primeiroNome(d.contactName);
  // «Têm disponibilidade para sexta?» — a Susana. Responde-se a seguir ao resto.
  const disponibilidade =
    texto && perguntaPelaDisponibilidade(texto) ? `${respostaADisponibilidade(Boolean(d.quandoTexto))}\n\n` : "";
  if (texto && eClienteDeVolta(texto)) {
    return `${boasVindasDeVolta(jaSeApresentou ? null : p)}\n\n${disponibilidade}`;
  }
  if (antes.passo === "servico" && d.serviceType) {
    const etiqueta = (ETIQUETAS[d.serviceType] ?? d.serviceType).toLowerCase();
    const sim = texto && perguntaSeFazemos(texto) ? "Fazemos, sim!" : "Com todo o gosto!";
    return `${sim} Fica anotado: ${etiqueta}.\n\n${disponibilidade}`;
  }
  if (disponibilidade) return disponibilidade;
  if (proximo === "confirmar" || proximo === antes.passo) return "";
  if (p && !antes.dados.contactName && !jaSeApresentou) return `${agradecimento("nome", p)} `;
  const obrigada = agradecimento(antes.passo, p);
  return obrigada ? `${obrigada} ` : "";
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
    const exacto = SERVICE_CATEGORIES.some((c) => c.id === id) ? id : null;
    const s = exacto ?? servicoDoTexto(k.servico);
    if (s) d.serviceType = s;
  }
  /*
   * O NOME PASSA PELO LEITOR DE NOMES — 10-10-2026. «Obrigado Marco» não é
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
  }
  // «Sou o Marco» não é um andar — foi o andar do Marco no resumo.
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
  }
  if (k.entulho) d.entulhoQuantidade = k.entulho.trim().slice(0, 60);
  if (k.quando) {
    const q = interpretarQuando(k.quando, agora);
    d.quandoTexto = k.quando.trim().slice(0, 120);
    d.dataDesejada = q.data ? q.data.toISOString() : null;
    d.urgency = q.urgency;
  }
  if (k.descricao && k.descricao.trim().length >= 3) {
    // «Já mandei as fotos» não é a descrição — é dizer que ela está nas fotografias.
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
 * casa-a com o exemplo de desistir — e foi assim que a recolha da Sra. Ana
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
export function leituraDirecta(passo: PassoDaRecolha, texto: string): CamposCrus | null {
  const t = texto.trim();
  if (!t) return null;

  switch (passo) {
    case "servico": {
      const s = servicoDoTexto(t);
      return s ? { servico: s } : null;
    }
    case "elevador": {
      const r = simOuNao(t);
      return r ? { elevador: r } : null;
    }
    case "fatura": {
      const r = simOuNaoNaFactura(t);
      return r ? { fatura: r } : null;
    }
    case "codigoPostal": {
      const { postalCode } = codigoPostalELocalidade(t);
      return postalCode ? { codigoPostal: t } : null;
    }
    case "codigoPostalDestino": {
      const { postalCode } = codigoPostalELocalidade(t);
      return postalCode ? { codigoPostalDestino: t } : null;
    }
    case "andar": {
      // Só o que se parece mesmo com um andar: «2», «r/c», «cave», «3º», «4
      // andar». Uma frase inteira não é um andar — «Sou o Marco» foi.
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
      return e === "near" || e === "far" ? { estacionamentoDestino: e === "near" ? "sim" : "não" } : null;
    }
    case "estacionamento": {
      // «A porta de ambos» — e numa mudança, o destino também.
      const e = estacionamentoDaResposta(t, factosSoltos(t));
      if (e !== "near" && e !== "far") return null;
      const dito = e === "near" ? "sim" : "não";
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
  compreensao: { intencao: Intencao; campos: CamposCrus },
  agora: Date = new Date(),
  contexto: {
    texto?: string;
    jaCumprimentou?: boolean;
    jaDisseQueNaoCompra?: boolean;
    /** As fotografias que ele já mandou — ver `fotosNoFio`. */
    fotos?: number;
    /** Já se lhe disse como chega o preço? Ver `jaExplicouOPreco`. */
    jaExplicouOPreco?: boolean;
  } = {},
): RespostaDaRecolha {
  const { intencao, campos: k } = compreensao;
  const cru = (contexto.texto ?? "").trim();

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
  const directa = cru ? leituraDirecta(estado.passo, cru) : null;
  const kk: CamposCrus = directa ? { ...k, ...directa } : k;

  /*
   * A CONFIRMAÇÃO ANTES DO APAGAR.
   *
   * «Não preciso», a responder a «Precisa de factura com NIF?», foi lido
   * como desistência — e apagou a recolha inteira da Sra. Ana: serviço,
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

  if (intencao === "falar_com_pessoa") {
    return { estado, resposta: PASSO_A_ALGUEM_DA_EQUIPA, pedirPessoa: true };
  }
  /*
   * QUEM DESISTE A MEIO PASSA A UMA PESSOA — ver `entregarQuemDesiste`.
   *
   * «Obrigado, está muito complicado. Prefiro desistir.» — o Marco. Pedir-lhe
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

  // Quem mandou fotografias já mostrou o que é para levar — ver `DESCRICAO_DAS_FOTOS`.
  if (!d.description && (contexto.fotos ?? 0) > 0) d.description = DESCRICAO_DAS_FOTOS;

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
  if (!mudouAlgo && passo === estado.passo) {
    // Quem perguntou o preço não «não foi apanhado»: responde-se, e segue. E
    // quem disse que volta também não — ver `vozAntesDaPergunta`.
    const deVolta = cru && eClienteDeVolta(cru) ? `${boasVindasDeVolta(primeiroNome(d.contactName))}\n\n` : "";
    if (notaDoPreco || deVolta) {
      return { estado: { passo, dados: d }, resposta: deVolta + notaDoPreco + perguntaDo(passo, d, false) };
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
  const voz = vozAntesDaPergunta(cru, estado, d, passo, abertura !== "");
  return {
    estado: { passo, dados: d },
    resposta: abertura + naoCompramos + voz + notaDoPreco + perguntaDo(passo, d, false),
  };
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
): string {
  const p = primeiroNome(nome);
  return (
    `Pedido #${pedidoId} registado! Muito obrigada${p ? `, ${p}` : ""}.\n\n` +
    "A nossa equipa vai conferi-lo e enviá-lo aos profissionais da sua zona, e as propostas chegam-lhe por aqui." +
    (comFotos
      ? ""
      : "\n\nSe tiver fotografias do que é para levar, envie-as agora por aqui: ficam no pedido e ajudam a acertar o preço.") +
    "\n\nQualquer dúvida, estou por aqui 😊"
  );
}
