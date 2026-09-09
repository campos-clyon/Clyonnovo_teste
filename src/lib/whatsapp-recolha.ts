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
export function perguntaDo(passo: PassoDaRecolha, dados: DadosDaRecolha): string {
  switch (passo) {
    case "servico":
      return `Olá! Sou o assistente da CLYON. Trato do seu pedido por aqui em dois minutos.\n\nQue serviço precisa? Responda com o número:\n${LISTA_DE_SERVICOS}`;
    case "nome":
      return "Como se chama?";
    case "morada":
      return "Qual é a morada do serviço? Rua e número (ex.: Rua Sousa Viterbo 29).";
    case "codigoPostal":
      return "Código postal e localidade? (ex.: 2845-513 Amora)";
    case "moradaDestino":
      return "E a morada de destino da mudança? Rua e número.";
    case "codigoPostalDestino":
      return "Código postal e localidade do destino?";
    case "andar":
      return dados.serviceType === "mudanca"
        ? "Em que andar está a casa de origem? (ex.: r/c, 2º)"
        : "Em que andar? (ex.: r/c, 2º)";
    case "elevador":
      return "Há elevador? (sim/não)";
    case "estacionamento":
      return "Dá para estacionar à porta? (sim/não)";
    case "entulhoQuantidade":
      return "Quanto entulho, mais ou menos? Em sacos ou em m³ (ex.: 20 sacos).";
    case "quando":
      return "Para quando? (ex.: amanhã de manhã, sexta às 9, 14/09 11:30, sem pressa)";
    case "descricao":
      return "Descreva o que é preciso levar ou fazer: quantidade, tamanho, o que houver de especial.";
    case "fatura":
      return "Precisa de factura? (sim/não)";
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
function passoSeguinte(passo: PassoDaRecolha, dados: DadosDaRecolha): PassoDaRecolha {
  const ordem: PassoDaRecolha[] = [
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
  const i = ordem.indexOf(passo);
  return ordem[Math.min(i + 1, ordem.length - 1)];
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

/** A mensagem quando o pedido ficou registado. */
export function mensagemDePedidoRegistado(pedidoId: number, comFotos: boolean): string {
  return (
    `Pedido #${pedidoId} registado. A equipa CLYON vai conferi-lo e enviá-lo aos profissionais da sua zona — recebe as propostas por aqui.` +
    (comFotos
      ? ""
      : "\n\nSe tiver fotografias do que é para levar, envie-as agora por aqui: ficam no pedido e ajudam a acertar o preço.")
  );
}
