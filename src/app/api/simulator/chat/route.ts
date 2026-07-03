import { generateText } from "ai";
import type { ModelMessage } from "ai";
import { NextRequest, NextResponse } from "next/server";
import type { OrderData } from "@/app/simulador/types";

export const runtime = "nodejs";

const MODEL = process.env.CHAT_MODEL || "google/gemini-2.0-flash";

// ─── Resposta estruturada que a rota devolve ─────────────────────────────────
export interface ChatResponse {
  assistantMessage: string;
  orderPatch: Partial<OrderData>;
  nextQuestion: string | null;
  quickReplies: string[];
  shouldOpenContactForm: boolean;
  shouldAskForPhotos: boolean;
  shouldAskForAddress: boolean;
  canGenerateEstimate: boolean;
  status: "collecting" | "ready_to_estimate" | "needs_photos" | "onsite_recommended";
  internalNotes: string[];
}

// ─── Fallback local quando a IA falha ────────────────────────────────────────
function buildFallback(order: OrderData): ChatResponse {
  const msgs = [
    !order.serviceType && "Que tipo de serviço precisa? Recolha de móveis, monos, entulho, esvaziamento ou mudança?",
    order.serviceType && !order.description && !order.files?.length && "O que precisa de recolher? Pode descrever os objetos ou enviar fotos.",
    order.serviceType && (order.description || order.files?.length) && !order.floor && "Em que andar se encontra o material?",
    order.floor && (!order.hasElevator || order.hasElevator === "unknown") && "Existe elevador? Se sim, os itens cabem?",
    order.hasElevator && order.hasElevator !== "unknown" && (!order.parkingDistance || order.parkingDistance === "unknown") && "A carrinha consegue estacionar perto da entrada?",
  ].find(Boolean) as string | undefined;

  return {
    assistantMessage: msgs ?? "Obrigado. Para avançar, preciso da morada e dos seus dados de contacto.",
    orderPatch: {},
    nextQuestion: null,
    quickReplies: [],
    shouldOpenContactForm: !msgs,
    shouldAskForPhotos: false,
    shouldAskForAddress: false,
    canGenerateEstimate: false,
    status: "collecting",
    internalNotes: ["fallback_local"],
  };
}

function extractJson(text: string): ChatResponse | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as ChatResponse;
  } catch {
    return null;
  }
}

// ─── Prompt ───────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `És o Orçamentista CLYON, um assistente profissional de atendimento e triagem para serviços de recolha, esvaziamento, entulho, monos, móveis e mudanças em Portugal.

A tua função é conversar com clientes da CLYON, entender o pedido, recolher os dados necessários e preparar uma estimativa com base no preçário interno.

Fala sempre em português de Portugal.
Sê direto, educado, prático e profissional.
Não faças apresentações longas.
Não digas "sou uma IA".
Não uses linguagem robótica.
Não repitas perguntas já respondidas.
Não inventes dados.
Não confirmes valores definitivos quando houver incerteza.
Usa sempre "estimativa", "valor previsto" ou "sujeito a confirmação" quando adequado.

A CLYON faz principalmente:
- Recolha de móveis, monos, eletrodomésticos
- Recolha de entulho
- Esvaziamento de casa ou apartamento
- Mudanças pequenas e médias
- Limpeza de arrecadações, garagens, caves, sótãos, lojas e escritórios

Deves extrair automaticamente da mensagem do cliente:
- tipo de serviço, descrição dos objetos/material, quantidade aproximada
- localidade, morada, andar, elevador, estacionamento
- desmontagem, objetos pesados, urgência
- nome, telefone, email
- necessidade de visita presencial

Regras comerciais principais:
- Todos os valores são sem IVA. O IVA (23%) deve ser destacado separadamente.
- Serviço dedicado com carrinha/equipa nunca deve começar abaixo do mínimo da zona.
- Zona A (Amora/Fernão Ferro): mínimo 220€ + IVA.
- Zona B (Lisboa com acesso razoável): mínimo 250€ + IVA.
- Zona C (Lisboa difícil ou regiões mais longe): mínimo 270€ + IVA.
- Zona D ou fora da área padrão: orçamento personalizado.
- Entulho em sacos: referência 3€ por saco. Se for deslocação dedicada, aplica-se mínimo da zona.
- Mais de 50 sacos, entulho pesado, obra grande ou acesso difícil: recomendar fotos/vídeo ou orçamento presencial.
- Casa acumulada, T2/T3/T4 cheio, moradia, loja ou escritório grande: recomendar orçamento personalizado.
- Sem elevador, escadas, distância longa, desmontagem, objetos pesados, triagem ou urgência aumentam o valor.
- Não dês o preço concreto no chat. Diz apenas "já é possível calcular uma estimativa" ou "preciso de mais informação".

Como deves conversar:
- Se o cliente escrever tudo de uma vez, extrai tudo e pergunta só o que falta.
- Se faltarem muitos dados, pergunta a informação mais importante primeiro.
- Faz uma pergunta por vez.
- Usa respostas curtas.
- Sempre que fizer sentido, oferece quickReplies com opções rápidas (máximo 5).
- Se o pedido for claramente complexo, recomenda análise por fotos/vídeo ou visita presencial.
- Quando tiveres os campos principais preenchidos (serviço, descrição, andar, elevador, estacionamento), indica shouldOpenContactForm: true.
- Quando já houver dados suficientes para uma estimativa, indica canGenerateEstimate: true.

Quando responderes, devolve APENAS JSON válido neste formato exato (sem markdown, sem texto fora do JSON):

{
  "assistantMessage": "mensagem curta para o cliente",
  "orderPatch": {
    "serviceType": "recolha_entulho",
    "description": "descrição resumida",
    "city": "localidade se identificada",
    "floor": "andar identificado",
    "hasElevator": "yes | small | no | unknown",
    "parkingDistance": "door | under_20m | over_30m | difficult | unknown",
    "needsDismantling": "no | simple | medium | complex | unknown",
    "urgency": "no | today | tomorrow | this_week | flexible",
    "receiver": {
      "name": "",
      "phone": "",
      "email": ""
    }
  },
  "nextQuestion": "próxima pergunta ou null",
  "quickReplies": ["opção 1", "opção 2"],
  "shouldOpenContactForm": false,
  "shouldAskForPhotos": false,
  "shouldAskForAddress": false,
  "canGenerateEstimate": false,
  "status": "collecting",
  "internalNotes": []
}

Regras do JSON:
- Não incluir markdown nem texto fora do JSON.
- Não preencher campos que não foram mencionados pelo cliente.
- Se não tiver certeza, não inventar.
- orderPatch pode vir vazio ou apenas com os campos que foram identificados.
- quickReplies deve ter no máximo 5 opções curtas.
- serviceType só pode ser: recolha_moveis | recolha_monos | recolha_entulho | esvaziamento_casa | esvaziamento_apartamento | mudanca | outro
- hasElevator só pode ser: yes | small | no | unknown
- parkingDistance só pode ser: door | under_20m | over_30m | difficult | unknown
- urgency só pode ser: no | today | tomorrow | this_week | flexible`;

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let order: OrderData = {};

  try {
    const body = (await request.json()) as {
      messages: Array<{ role: "user" | "assistant"; content: string | Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>;
      orderData: OrderData;
      latestUserMessage: string;
      hasUploadedFiles: boolean;
    };

    order = body.orderData ?? {};
    const messages = body.messages ?? [];
    const hasPhotos = body.hasUploadedFiles ?? false;

    // Construir contexto dos campos já recolhidos
    const known: string[] = [];
    if (order.serviceType) known.push(`Serviço: ${order.serviceType}`);
    if (order.description) known.push(`Descrição: ${order.description}`);
    if (order.city) known.push(`Cidade: ${order.city}`);
    if (order.floor) known.push(`Andar: ${order.floor}`);
    if (order.hasElevator && order.hasElevator !== "unknown") known.push(`Elevador: ${order.hasElevator}`);
    if (order.parkingDistance && order.parkingDistance !== "unknown") known.push(`Estacionamento: ${order.parkingDistance}`);
    if (order.urgency && order.urgency !== "no") known.push(`Urgência: ${order.urgency}`);
    if (order.needsDismantling && order.needsDismantling !== "unknown") known.push(`Desmontagem: ${order.needsDismantling}`);
    if (order.receiver?.name) known.push(`Nome: ${order.receiver.name}`);
    if (order.receiver?.phone) known.push(`Telefone: ${order.receiver.phone}`);
    if (hasPhotos) known.push("Fotos: enviadas");

    const systemWithContext = known.length > 0
      ? `${SYSTEM_PROMPT}\n\nDADOS JÁ RECOLHIDOS (não voltes a perguntar sobre estes):\n${known.join("\n")}`
      : SYSTEM_PROMPT;

    // Converter mensagens para ModelMessage[]
    const modelMessages: ModelMessage[] = messages.map((msg, idx) => {
      const role = (msg.role === "assistant" ? "assistant" : "user") as "user" | "assistant";
      const isLast = idx === messages.length - 1;

      if (typeof msg.content === "string") {
        return { role, content: msg.content };
      }

      const parts = msg.content as Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;

      if (isLast) {
        const content = parts.map((p) => {
          if (p.inlineData) {
            return { type: "image" as const, image: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` };
          }
          return { type: "text" as const, text: p.text ?? "" };
        });
        return { role, content };
      }

      const text = parts.filter((p) => p.text).map((p) => p.text).join(" ");
      return { role, content: text || "(imagem)" };
    }) as ModelMessage[];

    const firstUserIdx = modelMessages.findIndex((m) => m.role === "user");
    const safeMessages = firstUserIdx >= 0 ? modelMessages.slice(firstUserIdx) : modelMessages;

    const { text } = await generateText({
      model: MODEL,
      system: systemWithContext,
      messages: safeMessages,
    });

    const parsed = extractJson(text ?? "");
    if (!parsed) {
      console.error("[simulator/chat] JSON inválido do modelo:", text?.slice(0, 300));
      return NextResponse.json(buildFallback(order));
    }

    // Sanitizar orderPatch — remover campos undefined/vazios
    const patch = parsed.orderPatch ?? {};
    const cleanPatch: Partial<OrderData> = {};
    if (patch.serviceType) cleanPatch.serviceType = patch.serviceType;
    if (patch.description) cleanPatch.description = patch.description;
    if (patch.city) cleanPatch.city = patch.city;
    if (patch.floor) cleanPatch.floor = patch.floor;
    if (patch.hasElevator && patch.hasElevator !== "unknown") cleanPatch.hasElevator = patch.hasElevator;
    if (patch.parkingDistance && patch.parkingDistance !== "unknown") cleanPatch.parkingDistance = patch.parkingDistance;
    if (patch.needsDismantling && patch.needsDismantling !== "unknown") cleanPatch.needsDismantling = patch.needsDismantling;
    if (patch.urgency && patch.urgency !== "no") cleanPatch.urgency = patch.urgency;
    if (patch.receiver?.name || patch.receiver?.phone || patch.receiver?.email) {
      cleanPatch.receiver = {
        name: patch.receiver.name || undefined,
        phone: patch.receiver.phone || undefined,
        email: patch.receiver.email || undefined,
      };
    }

    const response: ChatResponse = {
      assistantMessage: parsed.assistantMessage ?? "Pode continuar a descrever o serviço.",
      orderPatch: cleanPatch,
      nextQuestion: parsed.nextQuestion ?? null,
      quickReplies: Array.isArray(parsed.quickReplies) ? parsed.quickReplies.slice(0, 5) : [],
      shouldOpenContactForm: parsed.shouldOpenContactForm === true,
      shouldAskForPhotos: parsed.shouldAskForPhotos === true,
      shouldAskForAddress: parsed.shouldAskForAddress === true,
      canGenerateEstimate: parsed.canGenerateEstimate === true,
      status: parsed.status ?? "collecting",
      internalNotes: Array.isArray(parsed.internalNotes) ? parsed.internalNotes : [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[simulator/chat] Erro:", error);
    return NextResponse.json(buildFallback(order));
  }
}
