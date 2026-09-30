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
  | "entulhoQuantidade"
  | "quando"
  | "descricao"
  | "fatura"
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
  entulhoQuantidade?: string | null;
  /** O que a pessoa escreveu sobre a data, tal e qual. */
  quandoTexto?: string | null;
  /** A data interpretada, em ISO, quando se percebeu uma. */
  dataDesejada?: string | null;
  urgency?: string | null;
  description?: string;
  precisaFatura?: boolean;
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
  /** A pessoa desistiu: apaga-se a recolha. */
  desistir?: boolean;
};

const ETIQUETAS: Record<string, string> = Object.fromEntries(
  SERVICE_CATEGORIES.map((c) => [c.id, c.label]),
);

/** A lista numerada, como se escreve numa mensagem. */
const LISTA_DE_SERVICOS = SERVICE_CATEGORIES.map((c, i) => `${i + 1}. ${c.label}`).join("\n");

/** Palavras que denunciam o serviço, para quem escreve em vez de escolher o número. */
const PISTAS: Array<[string, RegExp]> = [
  ["mudanca", /\bmudan[cç]a|mudar\s+de\s+casa|mudar-me\b/],
  ["recolha_entulho", /\bentulho|obra\b|obras\b|escombro/],
  ["recolha_monos", /\bmonos?\b|electrodom[eé]stic|eletrodom[eé]stic|frigor[ií]fico|m[aá]quina de lavar|colch[aã]o/],
  ["esvaziamento_apartamento", /esvazia\w*\s+(o\s+|um\s+|de\s+)?apartamento|apartamento\s+(todo|inteiro)/],
  ["esvaziamento_casa", /esvazia\w*|casa\s+(toda|inteira)|limpar\s+(a\s+)?casa\s+toda/],
  ["montagem_moveis", /\bmontagem|montar|desmontar|desmontagem|\bikea\b/],
  ["jardinagem", /jardi[mn]|relva|quintal|sebe|poda/],
  ["manutencao_casa", /manuten[cç][aã]o|pintura|pintar|canaliza|torneira|repara[cç]/],
  ["recolha_moveis", /m[oó]ve(l|is)|sof[aá]|cama\b|arm[aá]rio|mesa\b|cadeira|estante|guarda-?roupa|recolh/],
  ["outro", /\boutro\b/],
];

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
  if (/\b(dispenso|dispensa|nao (e |eh )?(preciso|necessario)|sem factura|sem fatura|nao quero factura|nao quero fatura)\b/.test(t)) {
    return "nao";
  }
  if (/\b(podemos|pode|da para|prefiro|preferia|queria|quero)\s+(evitar|dispensar|passar sem|ficar sem)\b/.test(t)) {
    return "nao";
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
    );
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

  if (/esta semana|nos proximos dias|o mais rapido|quanto antes/.test(t)) return { data: null, urgency: "this_week" };
  if (/sem pressa|quando der|quando puder|qualquer dia|flexivel/.test(t)) return { data: null, urgency: "flexible" };
  return { data: null, urgency: "flexible" };
}

function dataPorExtenso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Na hora de Lisboa: o servidor está em UTC, e «às 10:00» escrito dele era
  // uma hora antes da que o cliente disse.
  const tz = { timeZone: "Europe/Lisbon" } as const;
  return `${d.toLocaleDateString("pt-PT", { ...tz, weekday: "long", day: "numeric", month: "long" })} às ${d.toLocaleTimeString("pt-PT", { ...tz, hour: "2-digit", minute: "2-digit" })}`;
}

const URGENCIA_POR_EXTENSO: Record<string, string> = {
  today: "hoje",
  tomorrow: "amanhã",
  this_week: "esta semana",
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
  return `${comoTratar(dados.contactName, agora)} Aqui é a CLYON.\n\n`;
}

/**
 * JA SE DISSE «AQUI E A CLYON» A ESTA PESSOA NESTA CONVERSA?
 *
 * Le-se das mensagens que SAIRAM, que e o unico sitio onde isso esta escrito
 * sem sombra de duvida. Sem acentos porque o que fica gravado passou por
 * `paraTeclado`, que lhes mexe.
 */
export function jaCumprimentouNesteFio(
  fio: Array<{ direccao?: string; texto?: string }> | null | undefined,
): boolean {
  if (!Array.isArray(fio)) return false;
  return fio.some(
    (m) =>
      m?.direccao === "out" &&
      typeof m.texto === "string" &&
      /aqui e a clyon/.test(semAcentos(m.texto)),
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
      const p = primeiroNome(dados.contactName);
      const ola = p ? `${saudacao(agora)}, ${p}! Aqui é a CLYON.` : `${saudacao(agora)}! Aqui é a CLYON.`;
      return comLista
        ? `${ola}\n\nDiga-me o que precisa — se for mais fácil, responda com o número:\n${LISTA_DE_SERVICOS}`
        : `${ola}\n\nDiga-me o que precisa de levar ou fazer, à vontade e pelas suas palavras.`;
    }
    case "nome":
      return "Com quem estou a falar?";
    case "morada":
      return "Qual é a morada? Rua e número — é por aí que o profissional se orienta.";
    case "codigoPostal":
      return "E o código postal, com a localidade?";
    case "moradaDestino":
      return "Para onde é a mudança? Rua e número do destino.";
    case "codigoPostalDestino":
      return "E o código postal do destino, com a localidade?";
    case "andar":
      return dados.serviceType === "mudanca"
        ? "Em que andar fica a casa de origem?"
        : "Em que andar é?";
    case "elevador":
      return "Há elevador no prédio? Se houver, diga-me se lá cabe o que é para levar.";
    case "estacionamento":
      return "Dá para encostar a carrinha à porta, ou fica longe?";
    case "entulhoQuantidade":
      return "Mais ou menos quanto entulho? Em sacos ou em m³, um número aproximado chega.";
    case "quando":
      return "Para quando precisa? Se não houver pressa, diga-me também.";
    case "descricao":
      return "Conte-me o que há para levar ou fazer: quantas peças, o tamanho, e o que houver de especial.";
    case "fatura":
      return "Precisa de factura com NIF?";
    case "confirmar":
      return resumo(dados);
  }
}

export function resumo(d: DadosDaRecolha): string {
  const linhas = [
    `Serviço: ${ETIQUETAS[d.serviceType ?? ""] ?? d.serviceType ?? "—"}`,
    `Nome: ${d.contactName ?? "—"}`,
    `Morada: ${[d.address, d.postalCode, d.city].filter(Boolean).join(", ") || "—"}`,
    d.serviceType === "mudanca"
      ? `Destino: ${[d.moradaDestino, d.codigoPostalDestino, d.localidadeDestino].filter(Boolean).join(", ") || "—"}`
      : null,
    `Andar: ${d.floor === "0" ? "r/c" : d.floor === "-1" ? "cave" : (d.floor ?? "—")} · elevador: ${d.hasElevator === "yes" ? "sim" : d.hasElevator === "no" ? "não" : "—"} · estacionar à porta: ${d.parkingDistance === "near" ? "sim" : d.parkingDistance === "far" ? "não" : "—"}`,
    d.serviceType === "recolha_entulho" ? `Entulho: ${d.entulhoQuantidade ?? "—"}` : null,
    `Quando: ${dataPorExtenso(d.dataDesejada) ?? d.quandoTexto ?? URGENCIA_POR_EXTENSO[d.urgency ?? "flexible"]}`,
    `Descrição: ${d.description ?? "—"}`,
    `Factura: ${d.precisaFatura ? "sim" : "não"}`,
  ].filter((l): l is string => l != null);
  return `Confirme, por favor:\n\n${linhas.join("\n")}\n\nEstá tudo certo? Responda SIM para registar, ou diga-me o que está errado.`;
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
    ...(dados.serviceType === "recolha_entulho" ? (["entulhoQuantidade"] as PassoDaRecolha[]) : []),
    "quando",
    "descricao",
    "fatura",
    "confirmar",
  ];
}

function passoSeguinte(passo: PassoDaRecolha, dados: DadosDaRecolha): PassoDaRecolha {
  const ordem = ordemDosPassos(dados);
  const i = ordem.indexOf(passo);
  return ordem[Math.min(i + 1, ordem.length - 1)];
}

/** Este passo já tem resposta? É isto que decide o que ainda falta perguntar. */
function respondido(passo: PassoDaRecolha, d: DadosDaRecolha): boolean {
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
    case "elevador":
      return d.hasElevator != null;
    // O «não sei» do estacionamento guarda-se como null, e é uma resposta:
    // por isso a pergunta aqui é se o campo existe, não se tem valor.
    case "estacionamento":
      return d.parkingDistance !== undefined;
    case "entulhoQuantidade":
      return Boolean(d.entulhoQuantidade);
    case "quando":
      return Boolean(d.quandoTexto);
    case "descricao":
      return Boolean(d.description);
    case "fatura":
      return d.precisaFatura !== undefined;
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
    d.address = valor.slice(0, 300);
    /*
     * O CÓDIGO POSTAL VEM NO MESMO SACO — 14-09-2026.
     *
     * Ela escreveu «Morada: Estrada do Paço do Lumiar, n65, 6D, 1600-544
     * Lisboa» e foi-lhe perguntado o código postal a seguir, duas vezes. Aqui
     * guardava-se a linha inteira como morada e mais nada; o caso `morada` do
     * passo a passo já fazia esta extracção, e eram duas leituras da mesma
     * frase a discordar uma da outra.
     */
    const cp = codigoPostalELocalidade(valor);
    if (cp.postalCode) {
      d.postalCode = cp.postalCode;
      d.address =
        valor.replace(/(\d{4})\s*-?\s*(\d{3}).*$/, "").replace(/[,\s]+$/, "").slice(0, 300) ||
        d.address;
      if (cp.city && cp.city !== d.address) d.city = cp.city.replace(d.address, "").trim() || null;
    }
  } else if (campo === "destino") d.moradaDestino = valor.slice(0, 300);
  else if (/^(codigo|cp|postal|localidade)$/.test(campo)) {
    const { postalCode, city } = codigoPostalELocalidade(valor);
    if (postalCode) d.postalCode = postalCode;
    if (city) d.city = city;
  } else if (campo === "andar") d.floor = andarDoTexto(valor);
  else if (campo === "elevador") d.hasElevator = simOuNao(valor) === "sim" ? "yes" : "no";
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
): RespostaDaRecolha {
  const t = texto.trim();
  const chave = semAcentos(t).replace(/[.!,]+$/, "");

  if (/^(recomecar|reiniciar|comecar de novo|do inicio)$/.test(chave)) {
    const novo = recolhaNova();
    return { estado: novo, resposta: `Vamos recomeçar.\n\n${perguntaDo("servico", {})}` };
  }
  if (/^(cancelar|parar|deixa|deixa estar|esquece|nao quero)$/.test(chave)) {
    return {
      estado,
      resposta: "Está bem, fica sem efeito. Se precisar, é só escrever aqui outra vez.",
      desistir: true,
    };
  }
  // «pessoa» sozinha não chega: «sofá para uma pessoa» é uma descrição.
  if (/(falar com (alguem|uma pessoa|um humano)|quero uma pessoa|\bhumano\b|atendente|operador|nao (e|es|sou) um bot|nao quero (um |falar com um )?bot|\brobot\b)/.test(chave)) {
    return {
      estado,
      resposta: "Com certeza. Vou passar a conversa a uma pessoa da CLYON, que lhe responde por aqui assim que puder.",
      pedirPessoa: true,
    };
  }

  /*
   * QUANDO ELA DIZ O CAMPO, É ESSE QUE SE PREENCHE — 14-09-2026.
   *
   * A conversa da Ana Filipa Rodrigues, às 16:07. Ela escreveu «Morada:
   * Estrada do Paço do Lumiar, n65, 6D, 1600-544 Lisboa» enquanto a pergunta
   * pendente era «Com quem estou a falar?» — e a morada inteira foi gravada
   * como o NOME dela. A seguir, «É um apartamento e tem elevador» virou a
   * morada. O resumo que lhe foi mostrado dizia, à letra:
   *
   *   Nome: Morada: Estrada do Paço do Lumiar, n65, 6D, 1600-544 Lisboa
   *   Morada: É um apartamento e tem elevador, O meu nome é Ana Filipa (...)
   *
   * A causa não era não perceber: era perguntar e depois arrumar a mensagem
   * SEGUINTE na gaveta da pergunta, fosse ela qual fosse. Num WhatsApp
   * ninguém responde por ordem — responde-se à terceira pergunta atrás, com o
   * campo escrito à frente, como ela fez seis vezes.
   *
   * O leitor de rótulos já existia; só corria no resumo final. Passa a correr
   * SEMPRE, e devolve `null` quando o rótulo não é um campo conhecido — por
   * isso «Está acima» continua a ser tratado como resposta à pergunta em cima.
   *
   * No passo do resumo não se intercepta: ali a resposta certa é mostrar o
   * resumo outra vez, e isso é do caso «confirmar».
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

  switch (estado.passo) {
    case "servico": {
      const s = servicoDoTexto(t);
      if (!s) {
        return {
          estado,
          resposta: `Não percebi o serviço. Responda com o número:\n${LISTA_DE_SERVICOS}`,
        };
      }
      d.serviceType = s;
      break;
    }
    case "nome": {
      /*
       * Um nome não tem dois pontos nem seis dígitos seguidos. O que ela
       * escreveu — «Morada: Estrada do Paço do Lumiar, n65, 6D, 1600-544
       * Lisboa» — passava por aqui sem uma queixa e ficava a ser o nome dela.
       */
      if (t.length < 2 || /\d{6,}/.test(t) || t.includes(":") || t.length > 80) {
        return { estado, resposta: "Diga-me o seu nome, por favor." };
      }
      d.contactName = t.slice(0, 120);
      break;
    }
    case "morada": {
      if (t.length < 5) {
        return { estado, resposta: "Preciso da rua e do número." };
      }
      /*
       * Uma morada tem um número ou uma palavra de rua. Sem nenhum dos dois,
       * «É um apartamento e tem elevador» era gravado como a morada — e o
       * profissional recebia isso no lugar de onde tem de ir.
       */
      if (!/\d/.test(t) && !PALAVRAS_DE_MORADA.test(semAcentos(t))) {
        return {
          estado,
          resposta: "Preciso da rua e do número — é por aí que o profissional se orienta.",
        };
      }
      d.address = t.slice(0, 300);
      // Se já veio com o código postal, aproveita-se e não se volta a perguntar.
      const cp = codigoPostalELocalidade(t);
      if (cp.postalCode) {
        d.postalCode = cp.postalCode;
        d.address = t.replace(/(\d{4})\s*-?\s*(\d{3}).*$/, "").replace(/[,\s]+$/, "").slice(0, 300) || d.address;
        if (cp.city && cp.city !== d.address) d.city = cp.city.replace(d.address, "").trim() || null;
      }
      break;
    }
    case "codigoPostal": {
      const { postalCode, city } = codigoPostalELocalidade(t);
      if (!postalCode && !city) {
        return { estado, resposta: "Código postal e localidade, por favor (ex.: 2845-513 Amora)." };
      }
      d.postalCode = postalCode ?? d.postalCode ?? null;
      d.city = city ?? d.city ?? null;
      break;
    }
    case "moradaDestino": {
      if (t.length < 5) {
        return { estado, resposta: "A rua e o número do destino, por favor." };
      }
      d.moradaDestino = t.slice(0, 300);
      const cp = codigoPostalELocalidade(t);
      if (cp.postalCode) {
        d.codigoPostalDestino = cp.postalCode;
        d.moradaDestino = t.replace(/(\d{4})\s*-?\s*(\d{3}).*$/, "").replace(/[,\s]+$/, "").slice(0, 300) || d.moradaDestino;
      }
      break;
    }
    case "codigoPostalDestino": {
      const { postalCode, city } = codigoPostalELocalidade(t);
      if (!postalCode && !city) {
        return { estado, resposta: "Código postal e localidade do destino, por favor." };
      }
      d.codigoPostalDestino = postalCode ?? d.codigoPostalDestino ?? null;
      d.localidadeDestino = city ?? d.localidadeDestino ?? null;
      break;
    }
    case "andar": {
      d.floor = andarDoTexto(t);
      // «2º sem elevador» responde às duas de uma vez.
      if (/sem elevador/.test(chave)) d.hasElevator = "no";
      else if (/com elevador/.test(chave)) d.hasElevator = "yes";
      // E uma moradia responde sozinha — ver `eUmaMoradia`.
      else if (eUmaMoradia(t)) d.hasElevator = "no";
      break;
    }
    case "elevador": {
      const r = simOuNao(t);
      if (!r) return { estado, resposta: "Há elevador? Responda sim ou não." };
      d.hasElevator = r === "sim" ? "yes" : "no";
      break;
    }
    case "estacionamento": {
      const r = simOuNao(t);
      if (!r) {
        if (/nao sei|talvez|depende/.test(chave)) {
          d.parkingDistance = null;
          break;
        }
        return { estado, resposta: "Dá para estacionar à porta? Responda sim ou não." };
      }
      d.parkingDistance = r === "sim" ? "near" : "far";
      break;
    }
    case "entulhoQuantidade": {
      d.entulhoQuantidade = t.slice(0, 60);
      break;
    }
    case "quando": {
      const q = interpretarQuando(t, agora);
      d.quandoTexto = t.slice(0, 120);
      d.dataDesejada = q.data ? q.data.toISOString() : null;
      d.urgency = q.urgency;
      break;
    }
    case "descricao": {
      if (t.length < 3) return { estado, resposta: "Descreva em poucas palavras o que é preciso." };
      d.description = t.slice(0, 4000);
      break;
    }
    case "fatura": {
      const r = simOuNaoNaFactura(t);
      if (!r) return { estado, resposta: "Precisa de factura? Responda sim ou não." };
      d.precisaFatura = r === "sim";
      break;
    }
    case "confirmar": {
      if (simOuNao(t) === "sim" || /^(confirmo|confirmar|registar|pode registar|esta certo|esta tudo certo|correcto|correto)$/.test(chave)) {
        return {
          estado: { passo: "confirmar", dados: d },
          resposta: "",
          registar: true,
        };
      }
      const corrigido = corrigir(d, t, agora);
      if (corrigido) {
        return { estado: { passo: "confirmar", dados: corrigido }, resposta: resumo(corrigido) };
      }
      return {
        estado,
        resposta:
          "Para registar responda SIM. Se houver algo errado, diga-me o quê. Ou escreva «recomeçar».",
      };
    }
  }

  // Passos que já ficaram respondidos de caminho saltam-se.
  let proximo = passoSeguinte(estado.passo, d);
  while (
    (proximo === "codigoPostal" && d.postalCode && d.city) ||
    (proximo === "codigoPostalDestino" && d.codigoPostalDestino && d.localidadeDestino) ||
    (proximo === "elevador" && d.hasElevator != null && estado.passo === "andar")
  ) {
    proximo = passoSeguinte(proximo, d);
  }
  const confirmacao =
    estado.passo === "servico" && d.serviceType
      ? `${ETIQUETAS[d.serviceType] ?? d.serviceType} — certo.\n\n`
      : "";
  // O cumprimento também por aqui: este é o caminho de quando o Gemini está em
  // baixo, e uma pessoa que apanhe esse dia merece os mesmos modos.
  const abertura = aberturaDaResposta(d, estado.passo, proximo, agora, jaCumprimentou);
  // A verdade primeiro, e a pergunta logo a baixo — ver o caminho do Gemini.
  const naoCompramos = !jaDisseQueNaoCompra && querVenderBens(t) ? NAO_COMPRAMOS : "";
  return {
    estado: { passo: proximo, dados: d },
    resposta: abertura + naoCompramos + confirmacao + perguntaDo(proximo, d),
  };
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
    return "Com certeza. Diga-me o que precisa de levar ou fazer, e em que zona — por exemplo «tenho um sofá e um colchão para tirar, em Cascais».";
  }
  return `Desculpe, não apanhei. ${perguntaDo(passo, dados, false)}`;
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
  if (k.nome && k.nome.trim().length >= 2) d.contactName = k.nome.trim().slice(0, 120);
  if (k.morada && k.morada.trim().length >= 3) {
    d.address = k.morada.trim().slice(0, 300);
    // Vem muitas vezes com o código postal colado; aproveita-se.
    const cp = codigoPostalELocalidade(k.morada);
    if (cp.postalCode) d.postalCode = cp.postalCode;
  }
  if (k.codigoPostal) {
    const { postalCode, city } = codigoPostalELocalidade(k.codigoPostal);
    if (postalCode) d.postalCode = postalCode;
    if (city) d.city = city;
  }
  if (k.moradaDestino && k.moradaDestino.trim().length >= 3) {
    d.moradaDestino = k.moradaDestino.trim().slice(0, 300);
  }
  if (k.codigoPostalDestino) {
    const { postalCode, city } = codigoPostalELocalidade(k.codigoPostalDestino);
    if (postalCode) d.codigoPostalDestino = postalCode;
    if (city) d.localidadeDestino = city;
  }
  if (k.andar) d.floor = andarDoTexto(k.andar);
  if (k.elevador) {
    const r = simOuNao(k.elevador);
    if (r) d.hasElevator = r === "sim" ? "yes" : "no";
  }
  if (k.estacionamento) {
    const r = simOuNao(k.estacionamento);
    if (r) d.parkingDistance = r === "sim" ? "near" : "far";
  }
  if (k.entulho) d.entulhoQuantidade = k.entulho.trim().slice(0, 60);
  if (k.quando) {
    const q = interpretarQuando(k.quando, agora);
    d.quandoTexto = k.quando.trim().slice(0, 120);
    d.dataDesejada = q.data ? q.data.toISOString() : null;
    d.urgency = q.urgency;
  }
  if (k.descricao && k.descricao.trim().length >= 3) {
    d.description = k.descricao.trim().slice(0, 4000);
  }
  if (k.fatura) {
    const r = simOuNaoNaFactura(k.fatura);
    if (r) d.precisaFatura = r === "sim";
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
    case "estacionamento": {
      const r = simOuNao(t);
      return r ? { estacionamento: r } : null;
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
      // Só o que se parece mesmo com um andar: «2», «r/c», «cave», «3º». Uma
      // frase inteira não é um andar, e `andarDoTexto` devolve-a tal e qual.
      const curto = semAcentos(t).replace(/[.!º°]+/g, "");
      if (!/^(\d{1,2}|r\/?c|cave|terreo|loja|moradia|vivenda|[a-z]{4,8}o)$/.test(curto)) return null;
      return { andar: t };
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
  contexto: { texto?: string; jaCumprimentou?: boolean; jaDisseQueNaoCompra?: boolean } = {},
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
      return {
        estado: { passo: estado.passo, dados: limpos },
        resposta: "Está bem, fica sem efeito. Se precisar, é só escrever aqui outra vez.",
        desistir: true,
      };
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

  if (intencao === "falar_com_pessoa") {
    return {
      estado,
      resposta:
        "Com certeza. Vou passar a conversa a uma pessoa da CLYON, que lhe responde por aqui assim que puder.",
      pedirPessoa: true,
    };
  }
  if (intencao === "cancelar") {
    // Sem nada recolhido não há o que perder: é o «deixa estar» de quem ainda
    // não disse nada, e obrigá-lo a confirmar seria ficar-lhe com a conversa.
    if (!temTrabalhoFeito(estado.dados)) {
      return {
        estado,
        resposta: "Está bem, fica sem efeito. Se precisar, é só escrever aqui outra vez.",
        desistir: true,
      };
    }
    return {
      estado: { passo: estado.passo, dados: { ...estado.dados, aConfirmarDesistencia: true } },
      resposta:
        `Só para eu não apagar nada por engano: quer mesmo desistir do pedido?\n\n` +
        `Já tenho ${oQueJaTenho(estado.dados)}. Responda SIM para deitar fora, ` +
        `ou diga-me o que falta e seguimos daqui.`,
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
        "Sem problema, vamos do princípio. Diga-me o que precisa de levar ou fazer, e em que zona.",
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

  const passo = primeiroPassoEmFalta(d);

  // O SIM só vale com tudo preenchido. Com um campo por responder, o «sim» é
  // conversa e não confirmação — pergunta-se o que falta.
  if (intencao === "confirmar" && passo === "confirmar") {
    return { estado: { passo, dados: d }, resposta: "", registar: true };
  }

  const mudouAlgo = JSON.stringify(d) !== JSON.stringify(estado.dados);
  if (!mudouAlgo && passo === estado.passo) {
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
  return {
    estado: { passo, dados: d },
    resposta: abertura + naoCompramos + perguntaDo(passo, d, false),
  };
}

/** A mensagem quando o pedido ficou registado. */
export function mensagemDePedidoRegistado(pedidoId: number, comFotos: boolean): string {
  return (
    `Pedido #${pedidoId} registado. A equipa CLYON vai conferi-lo e enviá-lo aos profissionais da sua zona — recebe as propostas por aqui.` +
    (comFotos
      ? ""
      : "\n\nSe tiver fotografias do que é para levar, envie-as agora por aqui: ficam no pedido e ajudam a acertar o preço.")
  );
}
