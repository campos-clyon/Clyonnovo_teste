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

/** "sim"/"não" em todas as formas que um teclado escreve; null se não é nenhuma. */
export function simOuNao(texto: string): "sim" | "nao" | null {
  const t = semAcentos(texto).replace(/[.!,]+$/, "");
  if (/^(s|sim|yes|claro|ha|tem|com certeza|sim tem|sim ha|exacto|exato|ok|certo|isso)$/.test(t)) return "sim";
  if (/^(n|nao|nope|nem|nao tem|nao ha|sem|negativo)$/.test(t)) return "nao";
  if (/^sim\b/.test(t)) return "sim";
  if (/^nao\b/.test(t)) return "nao";
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
  const t = semAcentos(texto);
  let dia: Date | null = null;

  const numerica = t.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
  if (numerica) {
    const ano = numerica[3]
      ? Number(numerica[3].length === 2 ? `20${numerica[3]}` : numerica[3])
      : agora.getFullYear();
    dia = new Date(ano, Number(numerica[2]) - 1, Number(numerica[1]), 9, 0, 0, 0);
    if (!numerica[3] && dia.getTime() < agora.getTime() - 86_400_000) dia.setFullYear(ano + 1);
  } else if (/depois de amanha/.test(t)) {
    dia = new Date(agora);
    dia.setDate(dia.getDate() + 2);
  } else if (/\bamanha\b/.test(t)) {
    dia = new Date(agora);
    dia.setDate(dia.getDate() + 1);
  } else if (/\bhoje\b|\bagora\b|\burgente\b/.test(t)) {
    dia = new Date(agora);
  } else {
    for (let i = 0; i < DIAS_DA_SEMANA.length; i++) {
      if (new RegExp(`\\b${DIAS_DA_SEMANA[i]}(-feira)?\\b`).test(t)) {
        dia = new Date(agora);
        let salto = (i - agora.getDay() + 7) % 7;
        if (salto === 0) salto = 7; // «sexta» dito numa sexta é a próxima
        if (/proxima|que vem/.test(t) && salto < 7) salto += 0;
        dia.setDate(dia.getDate() + salto);
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
    const eHoje = dia.toDateString() === agora.toDateString();
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
      // «hoje», «urgente», sem hora: daqui a uma hora, não às nove de manhã já passadas.
      hora = Math.min(20, agora.getHours() + 1);
    }
    dia.setHours(hora, minuto, 0, 0);
    if (dia.getTime() < agora.getTime() - 3600_000) {
      // Já passou: uma hora de hoje que ficou para trás vira amanhã.
      dia.setDate(dia.getDate() + 1);
    }
    // A urgência conta DIAS DE CALENDÁRIO: «amanhã de manhã» dito às 10 h de
    // hoje são 23 horas, mas é amanhã — não é hoje.
    const meiaNoite = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const dias = Math.round((meiaNoite(dia) - meiaNoite(agora)) / 86_400_000);
    const urgency = dias <= 0 ? "today" : dias === 1 ? "tomorrow" : dias < 7 ? "this_week" : "flexible";
    return { data: dia, urgency };
  }

  if (/esta semana|nos proximos dias|o mais rapido|quanto antes/.test(t)) return { data: null, urgency: "this_week" };
  if (/sem pressa|quando der|quando puder|qualquer dia|flexivel/.test(t)) return { data: null, urgency: "flexible" };
  return { data: null, urgency: "flexible" };
}

function dataPorExtenso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })} às ${d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`;
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
    case "servico":
      return comLista
        ? `${saudacao(agora)}! Aqui é a CLYON.\n\nDiga-me o que precisa — se for mais fácil, responda com o número:\n${LISTA_DE_SERVICOS}`
        : `${saudacao(agora)}! Aqui é a CLYON.\n\nDiga-me o que precisa de levar ou fazer, à vontade e pelas suas palavras. Por exemplo: «tenho um sofá e um colchão para tirar de um 3º andar em Cascais, se puder ser sexta de manhã».`;
    case "nome":
      return "Com quem estou a falar?";
    case "morada":
      return "Qual é a morada certa? Rua e número — é por aí que o profissional se orienta (ex.: Rua Sousa Viterbo 29).";
    case "codigoPostal":
      return "E o código postal, com a localidade? (ex.: 2845-513 Amora)";
    case "moradaDestino":
      return "Para onde é a mudança? Rua e número do destino.";
    case "codigoPostalDestino":
      return "E o código postal do destino, com a localidade?";
    case "andar":
      return dados.serviceType === "mudanca"
        ? "Em que andar fica a casa de origem? (r/c, 2º, cave…)"
        : "Em que andar é? (r/c, 2º, cave…)";
    case "elevador":
      return "Há elevador no prédio? Se houver, diga-me se lá cabe o que é para levar.";
    case "estacionamento":
      return "Dá para encostar a carrinha à porta, ou fica longe?";
    case "entulhoQuantidade":
      return "Mais ou menos quanto entulho? Em sacos ou em m³ — um número aproximado chega (ex.: 20 sacos).";
    case "quando":
      return "Para quando precisa? Pode ser «amanhã de manhã», «sexta às 9», «14/09 às 11:30» — ou sem pressa, se for o caso.";
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
  return `Confirme, por favor:\n\n${linhas.join("\n")}\n\nEstá tudo certo? Responda SIM para registar. Para corrigir, escreva o campo e o valor novo (ex.: «morada Rua Nova 5», «nome Ana Silva»).`;
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

/** As correcções no resumo: «morada …», «nome …», «andar …», «quando …», «descrição …». */
function corrigir(dados: DadosDaRecolha, texto: string, agora: Date): DadosDaRecolha | null {
  // [\s\S] em vez da flag /s: o alvo do TypeScript do projecto não a aceita.
  const m = texto.trim().match(/^([A-Za-zÀ-ú]+)[:\s]+([\s\S]+)$/);
  if (!m) return null;
  const campo = semAcentos(m[1]);
  const valor = m[2].trim();
  const d = { ...dados };
  if (campo === "nome") d.contactName = valor.slice(0, 120);
  else if (campo === "morada") d.address = valor.slice(0, 300);
  else if (campo === "destino") d.moradaDestino = valor.slice(0, 300);
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
      if (t.length < 2 || /\d{6,}/.test(t)) {
        return { estado, resposta: "Diga-me o seu nome, por favor." };
      }
      d.contactName = t.slice(0, 120);
      break;
    }
    case "morada": {
      if (t.length < 5) {
        return { estado, resposta: "Preciso da rua e do número (ex.: Rua Sousa Viterbo 29)." };
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
      const r = simOuNao(t);
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
          "Para registar responda SIM. Para corrigir, escreva o campo e o valor novo (ex.: «morada Rua Nova 5»). Ou escreva «recomeçar».",
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
  return { estado: { passo: proximo, dados: d }, resposta: confirmacao + perguntaDo(proximo, d) };
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
    const r = simOuNao(k.fatura);
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
export function responderComCompreensao(
  estado: EstadoDaRecolha,
  compreensao: { intencao: Intencao; campos: CamposCrus },
  agora: Date = new Date(),
): RespostaDaRecolha {
  const { intencao, campos: k } = compreensao;

  if (intencao === "falar_com_pessoa") {
    return {
      estado,
      resposta:
        "Com certeza. Vou passar a conversa a uma pessoa da CLYON, que lhe responde por aqui assim que puder.",
      pedirPessoa: true,
    };
  }
  if (intencao === "cancelar") {
    return {
      estado,
      resposta: "Está bem, fica sem efeito. Se precisar, é só escrever aqui outra vez.",
      desistir: true,
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

  const d = fundirCampos(estado.dados, k, agora);

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

  return { estado: { passo, dados: d }, resposta: perguntaDo(passo, d, false) };
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
