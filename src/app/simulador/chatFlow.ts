import type { OrderData, ChatStep } from "./types";

export interface ChatFlowStep {
  step: ChatStep;
  question: string;
  quickReplies?: string[];
  showContactForm?: boolean;
  showUpload?: boolean;
}

export function getProgressStep(order: OrderData): number {
  if (order.receiver?.name && order.receiver?.phone) return 4;
  if (order.floor && order.hasElevator && order.parkingDistance) return 3;
  if (order.serviceType) return 2;
  return 1;
}

export function getNextChatStep(order: OrderData): ChatFlowStep | null {
  if (!order.serviceType) {
    return {
      step: "service_type",
      question: "Qual é o tipo de serviço que precisa?",
      quickReplies: [
        "Recolha de móveis",
        "Recolha de monos",
        "Recolha de entulho",
        "Esvaziamento de casa",
        "Esvaziamento de apartamento",
        "Mudança",
        "Outro serviço",
      ],
    };
  }

  if (!order.description && (!order.files || order.files.length === 0)) {
    return {
      step: "description",
      question: "O que precisa recolher ou transportar? Pode descrever os objetos ou enviar fotos e vídeos.",
      showUpload: true,
    };
  }

  if (!order.floor) {
    return {
      step: "floor",
      question: "Em que andar está o material?",
      quickReplies: [
        "Rés-do-chão",
        "1.º andar",
        "2.º andar",
        "3.º andar",
        "4.º andar ou superior",
        "Cave",
        "Garagem",
        "Arrecadação",
      ],
    };
  }

  if (!order.hasElevator) {
    return {
      step: "elevator",
      question: "Tem elevador onde os itens caibam?",
      quickReplies: [
        "Sim, funciona",
        "Sim, mas é pequeno",
        "Não tem elevador",
        "Não sei",
      ],
    };
  }

  if (!order.parkingDistance) {
    return {
      step: "parking",
      question: "A carrinha consegue estacionar perto da entrada?",
      quickReplies: [
        "Sim, mesmo à porta",
        "Sim, até 20 metros",
        "Mais de 30 metros",
        "Estacionamento difícil",
        "Não sei",
      ],
    };
  }

  if (!order.needsDismantling) {
    return {
      step: "dismantling",
      question: "O material precisa de desmontagem?",
      quickReplies: [
        "Não",
        "Sim, desmontagem simples",
        "Sim, desmontagem média",
        "Sim, desmontagem demorada",
        "Não sei",
      ],
    };
  }

  if (!order.heavyItems || order.heavyItems.length === 0) {
    return {
      step: "heavy_items",
      question: "Existem objetos pesados ou de grande volume?",
      quickReplies: [
        "Não",
        "Sofá grande",
        "Roupeiro",
        "Frigorífico",
        "Máquina de lavar",
        "Entulho pesado",
        "Outro",
      ],
    };
  }

  if (!order.urgency) {
    return {
      step: "urgency",
      question: "O serviço é urgente?",
      quickReplies: [
        "Não",
        "Sim, hoje",
        "Sim, amanhã",
        "Esta semana",
        "Tenho flexibilidade",
      ],
    };
  }

  if (!order.receiver?.name || !order.receiver?.phone) {
    return {
      step: "receiver",
      question: "Quem vai receber a equipa?",
      showContactForm: true,
    };
  }

  return null; // Completo
}

export function parseServiceType(text: string): string {
  const map: Record<string, string> = {
    "recolha de móveis": "recolha_moveis",
    "recolha de monos": "recolha_monos",
    "recolha de entulho": "recolha_entulho",
    "esvaziamento de casa": "esvaziamento_casa",
    "esvaziamento de apartamento": "esvaziamento_apartamento",
    "mudança": "mudanca",
    "outro serviço": "outro",
    "outro": "outro",
  };
  return map[text.toLowerCase().trim()] ?? "outro";
}

export function parseElevator(text: string): OrderData["hasElevator"] {
  const t = text.toLowerCase();
  if (t.includes("sim, funciona") || t === "sim" || /sim.*funciona|funciona.*sim/.test(t)) return "yes";
  if (t.includes("pequeno") || t.includes("mas é pequeno") || t.includes("cabe pouco")) return "small";
  if (t.includes("não tem") || t.includes("nao tem") || t === "não" || t === "nao") return "no";
  if (t.includes("sim")) return "yes"; // "sim" sozinho → tem elevador
  return "unknown";
}

export function parseParking(text: string): OrderData["parkingDistance"] {
  const t = text.toLowerCase();
  if (t.includes("mesmo à porta") || t.includes("mesmo a porta") || t.includes("porta")) return "door";
  if (t.includes("até 20") || t.includes("ate 20") || t.includes("20 metro") || t.includes("sim, até 20") || t.includes("sim ate 20")) return "under_20m";
  if (t.includes("30 metro") || t.includes("mais de 30") || t.includes("mais 30")) return "over_30m";
  if (t.includes("difícil") || t.includes("dificil") || t.includes("complicado") || t.includes("não há") || t.includes("nao ha")) return "difficult";
  // Resposta afirmativa genérica — qualquer frase com "sim" + indicação positiva,
  // ou "sim" isolado, ou "tem local", "há lugar", "consegue", etc.
  if (
    /^sim[.! ]?$/.test(t.trim()) ||
    t.includes("tem local") ||
    t.includes("há lugar") ||
    t.includes("ha lugar") ||
    t.includes("tem lugar") ||
    t.includes("consegue") ||
    t.includes("dá para") ||
    t.includes("da para") ||
    t.includes("tem estacionamento") ||
    t.includes("tem parque") ||
    (t.startsWith("sim") && !t.includes("não") && !t.includes("nao") && !t.includes("difícil") && !t.includes("dificil"))
  ) return "under_20m";
  return "unknown";
}

export function parseUrgency(text: string): OrderData["urgency"] {
  if (text.toLowerCase().includes("hoje")) return "today";
  if (text.toLowerCase().includes("amanhã")) return "tomorrow";
  if (text.toLowerCase().includes("semana")) return "this_week";
  if (text.toLowerCase().includes("flexibilidade") || text.toLowerCase().includes("não")) return "flexible";
  return "flexible";
}

export function parseDismantling(text: string): OrderData["needsDismantling"] {
  if (text.toLowerCase() === "não") return "no";
  if (text.toLowerCase().includes("simples")) return "simple";
  if (text.toLowerCase().includes("média")) return "medium";
  if (text.toLowerCase().includes("demorada")) return "complex";
  return "unknown";
}

export function parseFloor(text: string): string | undefined {
  const t = text.toLowerCase().trim();

  // Rés-do-chão / cave / garagem
  if (/rés.do.chão|res.do.chao|r\/c|térreo|terreo|piso\s*0|andar\s*0/.test(t)) return "Rés-do-chão";
  if (/\bcave\b/.test(t)) return "Cave";
  if (/\bgaragem\b/.test(t)) return "Garagem";

  // Ordinais por extenso
  if (/\bprimeiro\b|\b1[ºo°]?\s*andar\b|piso\s*1/.test(t)) return "1.º andar";
  if (/\bsegundo\b|\b2[ºo°]?\s*andar\b|piso\s*2/.test(t)) return "2.º andar";
  if (/\bterceiro\b|\b3[ºo°]?\s*andar\b|piso\s*3/.test(t)) return "3.º andar";
  if (/\bquarto\b|\b4[ºo°]?\s*andar\b|piso\s*4/.test(t)) return "4.º andar";
  if (/\bquinto\b|\bsexto\b|\bsétimo\b|\bsetimo\b|\b[56789][ºo°]?\s*andar\b|piso\s*[56789]/.test(t)) return "4.º andar ou superior";

  // Número sozinho (ex: "2", "3", "1") — só se o texto for curto (resposta directa)
  if (/^\s*\d+\s*$/.test(t)) {
    const n = parseInt(t, 10);
    if (n === 0) return "Rés-do-chão";
    if (n === 1) return "1.º andar";
    if (n === 2) return "2.º andar";
    if (n === 3) return "3.º andar";
    if (n === 4) return "4.º andar";
    if (n >= 5) return "4.º andar ou superior";
  }

  // "N andar" sem ordinal (ex: "3 andar", "2 andar")
  const mAndar = t.match(/\b(\d+)\s*[ºo°]?\s*andar/);
  if (mAndar) {
    const n = parseInt(mAndar[1], 10);
    if (n === 0) return "Rés-do-chão";
    if (n === 1) return "1.º andar";
    if (n === 2) return "2.º andar";
    if (n === 3) return "3.º andar";
    if (n === 4) return "4.º andar";
    if (n >= 5) return "4.º andar ou superior";
  }

  return undefined;
}
