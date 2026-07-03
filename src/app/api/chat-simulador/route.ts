import { generateText } from "ai";
import type { ModelMessage } from "ai";
import { NextRequest, NextResponse } from "next/server";

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
    receiver?: {
      name?: string;
      phone?: string;
      email?: string;
    };
    address?: {
      city?: string;
      formattedAddress?: string;
    };
  };
  nextQuestion: string | null;
  quickReplies: string[];
  shouldOpenContactForm: boolean;
  shouldAskForPhotos: boolean;
  shouldAskForAddress: boolean;
  canGenerateEstimate: boolean;
  status: "collecting" | "ready_to_estimate" | "needs_photos" | "onsite_recommended";
  internalNotes: string[];
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
  "internalNotes": ["nota 1"]
}
\`\`\`

== CAMPOS A EXTRAIR ==
1. serviceType: "recolha_moveis" | "recolha_monos" | "recolha_entulho" | "esvaziamento_casa" | "esvaziamento_apartamento" | "mudanca"
2. description: texto detalhado
3. floor: "Rés-do-chão" | "1.º andar" | "2.º andar" | "3.º andar" | "4.º andar" | "4.º andar ou superior" | "Cave" | "Garagem"
4. hasElevator: "yes" | "small" | "no" | "unknown"
5. parkingDistance: "door" | "under_20m" | "over_30m" | "difficult" | "unknown"
6. urgency: "no" | "today" | "tomorrow" | "this_week" | "flexible"
7. receiver: { name, phone, email }
8. address: { city, formattedAddress }

== REGRAS ==
- Extrai TUDO o que o cliente escreveu. NÃO REPITAS perguntas já respondidas.
- Se cliente enviou fotos: confirma recepção, extrai descrição, continua com próximo campo.
- Nunca inventes dados.
- Uma pergunta por vez.
- assistantMessage: linguagem natural, frases curtas, tom profissional.
- Quando tiveres serviceType + description + floor + hasElevator + parkingDistance + urgency + receiver: readyToEstimate.

== EXEMPLO ==
Cliente: "Oi, preciso recolher monos da garagem. Nome: João Silva, Telefone: 913456789, Email: joao@email.com"
\`\`\`json
{
  "assistantMessage": "Obrigado João! Recebi que vai recolher monos da sua garagem. Pode descrever em mais detalhe o que vai recolher?",
  "orderPatch": {
    "serviceType": "recolha_monos",
    "floor": "Garagem",
    "receiver": {
      "name": "João Silva",
      "phone": "913456789",
      "email": "joao@email.com"
    }
  },
  "nextQuestion": "Pode descrever o que vai recolher? Quantidades, tamanho aproximado?",
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

    const knownFields: string[] = [];
    if (order) {
      if (order.serviceType) knownFields.push(`Serviço: ${order.serviceType}`);
      if (order.description) knownFields.push(`Descrição: ${order.description}`);
      if (order.floor) knownFields.push(`Andar: ${order.floor}`);
      if (order.hasElevator && order.hasElevator !== "unknown") {
        knownFields.push(`Elevador: ${order.hasElevator}`);
      }
      if (order.parkingDistance && order.parkingDistance !== "unknown") {
        knownFields.push(`Estacionamento: ${order.parkingDistance}`);
      }
      if (order.urgency) knownFields.push(`Urgência: ${order.urgency}`);
      if (order.city) knownFields.push(`Cidade: ${order.city}`);
      const receiver = order.receiver as { name?: string; phone?: string; email?: string } | undefined;
      if (receiver?.name) knownFields.push(`Nome: ${receiver.name}`);
      if (receiver?.phone) knownFields.push(`Telefone: ${receiver.phone}`);
      if (receiver?.email) knownFields.push(`Email: ${receiver.email}`);
    }

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
    const { text } = await generateText({
      model: MODEL,
      system: systemWithContext,
      messages: safeMessages,
    });

    if (!text) {
      throw new Error("Resposta vazia do Gemini");
    }

    const response = parseGeminiResponse(text);

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
      } as GeminiResponse,
      { status: 500 }
    );
  }
}
