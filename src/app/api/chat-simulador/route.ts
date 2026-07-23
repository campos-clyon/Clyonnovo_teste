import { generateText } from "ai";
import type { ModelMessage } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { calculateFastEstimate } from "@/lib/pricing-helper";
import type { OrderData } from "@/app/simulador/types";

const MODEL = process.env.GEMINI_MODEL || "google/gemini-2.0-flash";

interface GeminiResponse {
  assistantMessage: string;
  orderPatch: {
    serviceType?: string;
    description?: string;
    floor?: string;
    hasElevator?: "yes" | "small" | "no" | "unknown";
    parkingDistance?: "door" | "under_20m" | "over_30m" | "difficult" | "unknown";
    urgency?: "no" | "today" | "tomorrow" | "this_week" | "flexible";
    needsDismantling?: "no" | "simple" | "medium" | "complex" | "unknown";
    receiver?: {
      name?: string;
      phone?: string;
      email?: string;
    };
    address?: {
      city?: string;
      formattedAddress?: string;
    };
    heavyItems?: string[];
  };
  nextQuestion: string | null;
  quickReplies: string[];
  shouldOpenContactForm: boolean;
  shouldAskForPhotos: boolean;
  shouldAskForAddress: boolean;
  canGenerateEstimate: boolean;
  status: "collecting" | "ready_to_estimate" | "needs_photos" | "onsite_recommended";
  internalNotes: string[];
  liveEstimate?: {
    minWithVat: number;
    maxWithVat: number;
    confidence: "high" | "medium" | "low";
    label: string;
  } | null;
  photoAnalysis?: {
    detectedItems: string[];
    materialNotes: string;
  } | null;
}

const SYSTEM_INSTRUCTION = `Tu és o Orçamentista CLYON — especializado EM RECOLHA DE MÓVEIS, MONOS, ENTULHO, ESVAZIAMENTOS E MUDANÇAS EM PORTUGAL.

== IDENTIDADE ==
- Função ÚNICA: recolher dados estruturados para orçamento CLYON.
- Se pergunta for fora do âmbito: "Sou o Orçamentista CLYON e só posso ajudar com recolha, esvaziamento ou mudança. Vamos continuar?"
- Sem conversas gerais. Sem opiniões. Sem emojis excessivos.

== RESPONDER SEMPRE EM JSON VÁLIDO ==
\`\`\`json
{
  "assistantMessage": "texto natural para o cliente",
  "orderPatch": { "serviceType": "recolha_moveis", "description": "..." },
  "nextQuestion": "próxima pergunta ou null",
  "quickReplies": ["opção 1", "opção 2"],
  "shouldOpenContactForm": false,
  "shouldAskForPhotos": false,
  "shouldAskForAddress": false,
  "canGenerateEstimate": false,
  "status": "collecting",
  "internalNotes": ["nota 1"],
  "photoAnalysis": null
}
\`\`\`

== CAMPOS A EXTRAIR ==
1. serviceType: "recolha_moveis" | "recolha_monos" | "recolha_entulho" | "esvaziamento_casa" | "esvaziamento_apartamento" | "mudanca"
2. description: texto detalhado
3. floor: "Rés-do-chão" | "1.º andar" | "2.º andar" | "3.º andar" | "4.º andar" | "4.º andar ou superior" | "Cave" | "Garagem"
4. hasElevator: "yes" | "small" | "no" | "unknown"
5. parkingDistance: "door" | "under_20m" | "over_30m" | "difficult" | "unknown"
6. urgency: "no" | "today" | "tomorrow" | "this_week" | "flexible"
7. needsDismantling: "no" | "simple" | "medium" | "complex" | "unknown"
8. heavyItems: lista de itens pesados identificados (ex: ["sofá", "armário", "frigorífico"])
9. receiver: { name, phone, email }
10. address: { city, formattedAddress }

== ANÁLISE DE FOTOS ==
Quando receberes imagens do cliente:
- Identifica TODOS os objetos/materiais visíveis nas fotos
- Conta cada tipo de item (ex: 2 sofás, 1 armário, 3 caixas)
- Avalia o estado do material (bom, danificado, volumoso)
- Descreve materiais especiais (madeira, metal, entulho, plástico)
- Preenche heavyItems com os itens identificados
- Preenche a description com base nas fotos se ainda não existir
- Devolve photoAnalysis com:
  - detectedItems: lista de cada item detectado (ex: ["sofá 3 lugares", "armário de 2 portas"])
  - materialNotes: notas sobre materiais especiais ou condições de acesso visíveis

== REGRAS ==
- Extrai TUDO o que o cliente escreveu. NÃO REPITAS perguntas já respondidas.
- Se cliente enviou fotos: analisa o conteúdo, confirma recepção com descrição do que vês, continua com próximo campo.
- Nunca inventes dados.
- Uma pergunta por vez.
- assistantMessage: linguagem natural, frases curtas, tom profissional.
- Quando tiveres serviceType + description + floor + hasElevator + parkingDistance + urgency + receiver: readyToEstimate.
- NÃO dês valores de preço no chat — o motor de preços calcula automaticamente.

== EXEMPLO COM FOTO ==
Cliente: [envia foto de sala com sofá e mesa] "Preciso recolher isto"
\`\`\`json
{
  "assistantMessage": "Recebi a foto! Consigo ver um sofá de 3 lugares e uma mesa de jantar. Mais algum item para recolher?",
  "orderPatch": {
    "serviceType": "recolha_moveis",
    "description": "1 sofá de 3 lugares, 1 mesa de jantar",
    "heavyItems": ["sofá 3 lugares", "mesa de jantar"]
  },
  "photoAnalysis": {
    "detectedItems": ["sofá 3 lugares", "mesa de jantar"],
    "materialNotes": "Sofá em tecido, mesa em madeira maciça. Ambos em bom estado."
  },
  "nextQuestion": "Em que andar se encontra o material?",
  "quickReplies": ["Rés-do-chão", "1.º andar", "2.º andar", "3.º andar"],
  "status": "collecting"
}
\`\`\``;

type MsgPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type IncomingMessage = {
  role: "user" | "assistant";
  content: string | MsgPart[];
};

export const runtime = "nodejs";

function parseGeminiResponse(text: string): GeminiResponse {
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text;
    const parsed = JSON.parse(jsonStr);

    return {
      assistantMessage: (parsed.assistantMessage || "").trim(),
      orderPatch: parsed.orderPatch || {},
      nextQuestion: parsed.nextQuestion ?? null,
      quickReplies: Array.isArray(parsed.quickReplies) ? parsed.quickReplies : [],
      shouldOpenContactForm: parsed.shouldOpenContactForm ?? false,
      shouldAskForPhotos: parsed.shouldAskForPhotos ?? false,
      shouldAskForAddress: parsed.shouldAskForAddress ?? false,
      canGenerateEstimate: parsed.canGenerateEstimate ?? false,
      status: parsed.status ?? "collecting",
      internalNotes: Array.isArray(parsed.internalNotes) ? parsed.internalNotes : [],
      photoAnalysis: parsed.photoAnalysis ?? null,
    };
  } catch (err) {
    console.error("[chat-simulador] Parse error:", err, "Text:", text);
    return {
      assistantMessage: text.substring(0, 200),
      orderPatch: {},
      nextQuestion: "Qual é o tipo de serviço que precisa?",
      quickReplies: [],
      shouldOpenContactForm: false,
      shouldAskForPhotos: false,
      shouldAskForAddress: false,
      canGenerateEstimate: false,
      status: "collecting",
      internalNotes: ["Fallback parse. Raw: " + text.substring(0, 100)],
    };
  }
}

async function computeLiveEstimate(order: OrderData): Promise<GeminiResponse["liveEstimate"]> {
  if (!order.serviceType) return null;

  try {
    const result = await calculateFastEstimate({
      serviceType: order.serviceType,
      description: order.description,
      heavyItems: order.heavyItems,
      volumeTier: order.volumeTier,
      floor: order.floor,
      hasElevator: order.hasElevator,
      parkingDistance: order.parkingDistance,
      needsDismantling: order.needsDismantling,
      distanceFromBase: order.distanceFromBase,
      movingDistance: order.movingDistance,
      originAccess: order.originAccess,
      destinationAccess: order.destinationAccess,
      entulhoState: order.entulhoState,
      entulhoQuantidade: order.entulhoQuantidade,
      entulhoQuantidadeEnsacados: order.entulhoQuantidadeEnsacados,
    });

    if (!result.ok || !result.estimatedPriceWithVat) return null;

    const minVat = result.estimateMinWithVat ?? Math.round(result.estimatedPriceWithVat * 0.9 * 100) / 100;
    const maxVat = result.estimateMaxWithVat ?? Math.round(result.estimatedPriceWithVat * 1.1 * 100) / 100;

    const hasAddress = !!order.distanceFromBase?.distanceKm;
    const hasAccess = !!order.floor && order.hasElevator !== "unknown" && order.hasElevator !== undefined;

    let confidence: "high" | "medium" | "low" = "low";
    if (hasAddress && hasAccess) confidence = "high";
    else if (hasAccess || order.description) confidence = "medium";

    return {
      minWithVat: Math.round(minVat),
      maxWithVat: Math.round(maxVat),
      confidence,
      label: `${Math.round(minVat)}€ – ${Math.round(maxVat)}€`,
    };
  } catch (err) {
    console.error("[chat-simulador] Erro liveEstimate:", err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      messages: IncomingMessage[];
      order?: Record<string, unknown>;
    };
    const { messages, order } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
    }

    const orderData = (order ?? {}) as OrderData;

    const knownFields: string[] = [];
    if (orderData.serviceType) knownFields.push(`Serviço: ${orderData.serviceType}`);
    if (orderData.description) knownFields.push(`Descrição: ${orderData.description}`);
    if (orderData.floor) knownFields.push(`Andar: ${orderData.floor}`);
    if (orderData.hasElevator && orderData.hasElevator !== "unknown") {
      knownFields.push(`Elevador: ${orderData.hasElevator}`);
    }
    if (orderData.parkingDistance && orderData.parkingDistance !== "unknown") {
      knownFields.push(`Estacionamento: ${orderData.parkingDistance}`);
    }
    if (orderData.urgency) knownFields.push(`Urgência: ${orderData.urgency}`);
    if (orderData.city) knownFields.push(`Cidade: ${orderData.city}`);
    if (orderData.heavyItems?.length) knownFields.push(`Itens pesados: ${orderData.heavyItems.join(", ")}`);
    const receiver = orderData.receiver;
    if (receiver?.name) knownFields.push(`Nome: ${receiver.name}`);
    if (receiver?.phone) knownFields.push(`Telefone: ${receiver.phone}`);
    if (receiver?.email) knownFields.push(`Email: ${receiver.email}`);

    const systemWithContext =
      knownFields.length > 0
        ? `${SYSTEM_INSTRUCTION}\n\nDADOS JÁ RECOLHIDOS:\n${knownFields.join("\n")}`
        : SYSTEM_INSTRUCTION;

    const rawMessages = messages.map((msg, idx) => {
      const role = msg.role === "assistant" ? "assistant" : "user";
      const isLast = idx === messages.length - 1;

      if (typeof msg.content === "string") {
        return { role, content: msg.content };
      }

      const parts = msg.content as MsgPart[];

      if (isLast) {
        const content = parts.map((part) => {
          if ("inlineData" in part) {
            return {
              type: "image",
              image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            };
          }
          return { type: "text", text: (part as { text: string }).text };
        });
        return { role, content };
      }

      const text = parts
        .filter((p): p is { text: string } => "text" in p)
        .map((p) => p.text)
        .join(" ");
      return { role, content: text || "(imagem)" };
    });

    const firstUserIdx = rawMessages.findIndex((m) => m.role === "user");
    const safeMessages =
      (firstUserIdx >= 0 ? rawMessages.slice(firstUserIdx) : rawMessages) as ModelMessage[];

    console.log(`[chat-simulador] Chamando Gemini model=${MODEL}`);

    const [{ text }, liveEstimate] = await Promise.all([
      generateText({
        model: MODEL,
        system: systemWithContext,
        messages: safeMessages,
      }),
      computeLiveEstimate(orderData),
    ]);

    if (!text) {
      throw new Error("Resposta vazia do Gemini");
    }

    const response = parseGeminiResponse(text);

    // Merge heavyItems from photo analysis into orderPatch
    if (response.photoAnalysis?.detectedItems?.length && !response.orderPatch.heavyItems?.length) {
      response.orderPatch.heavyItems = response.photoAnalysis.detectedItems;
    }

    // After merging Gemini's patch, recalculate live estimate with updated data
    const mergedOrder: OrderData = {
      ...orderData,
      ...(response.orderPatch as Partial<OrderData>),
    };
    const updatedEstimate = await computeLiveEstimate(mergedOrder);

    response.liveEstimate = updatedEstimate ?? liveEstimate;

    return NextResponse.json(response);
  } catch (error) {
    console.error("[chat-simulador] Erro:", error);
    return NextResponse.json(
      {
        assistantMessage: "Não consegui processar agora. Tente novamente ou contacte a CLYON.",
        orderPatch: {},
        nextQuestion: null,
        quickReplies: [],
        shouldOpenContactForm: false,
        shouldAskForPhotos: false,
        shouldAskForAddress: false,
        canGenerateEstimate: false,
        status: "collecting",
        internalNotes: [String(error)],
        liveEstimate: null,
        photoAnalysis: null,
      } as GeminiResponse,
      { status: 500 }
    );
  }
}
