import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { calculateLocalEstimate, detectZone } from "@/app/simulador/pricingRules";
import type { OrderData, EstimateResult } from "@/app/simulador/types";

export const runtime = "nodejs";

const MODEL = process.env.CHAT_MODEL || "google/gemini-2.0-flash";

async function generateEstimateWithAI(
  order: OrderData
): Promise<EstimateResult | null> {
  try {
    const prompt = `És um orçamentista sénior da CLYON em Portugal. Calcula uma estimativa de preço para o pedido abaixo.

DADOS DO PEDIDO:
${JSON.stringify(order, null, 2)}

PREÇÁRIO CLYON (valores sem IVA, IVA = 23%):

ENTULHO (sacos ~50 L):
- Preço: 3 € por saco. Mínimo 90 €.
- Exemplo: 50 sacos = 150 € s/IVA = 184,50 € c/IVA

MÓVEIS / MONOS (por item):
- Sofá: 60 € | Cama: 50 € | Colchão: 40 € | Arca/Frigorifico: 50-55 €
- Armário: 70 € | Mesa: 45 € | Cadeira: 20 € | Mono genérico: 25-35 €
- Mínimo: 80 €

DESLOCAÇÃO (incluída):
- Zona A (Amora, Fernão Ferro, Seixal): 0 € extra
- Zona B (Lisboa, Oeiras, Amadora): +20 €
- Zona C (Cascais, Sintra, Almada, Setúbal): +40 €

ACESSO:
- Sem elevador + andar: +25 € (normal) a +60 € (pesado/alto)
- Estacionamento difícil: +30 €

URGÊNCIA:
- Hoje: +40 € | Amanhã: +20 €

Responde APENAS com JSON válido neste formato (sem markdown, sem explicações):
{
  "status": "estimated",
  "estimatedPriceWithoutVat": 150,
  "vatAmount": 34.5,
  "estimatedPriceWithVat": 184.5,
  "difficultyLevel": 1,
  "summary": "50 sacos de entulho, rés-do-chão.",
  "assumptions": ["50 sacos × 3 €/saco = 150 €", "Sem acesso difícil"],
  "missingFields": [],
  "customerMessage": "A estimativa para este pedido é entre 140 € e 160 € + IVA (23%). Sujeito a confirmação pela equipa CLYON.",
  "internalNotes": ["50 sacos de entulho"]
}`;

    const { text } = await generateText({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
    });

    const jsonMatch = text.trim().match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as EstimateResult;
  } catch (err) {
    console.error("[simulator/estimate] AI error:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const order: OrderData = body.order ?? {};

    if (!order.locationZone && (order.city || order.address?.city)) {
      order.locationZone = detectZone(order.city ?? order.address?.city);
    }

    const aiResult = await generateEstimateWithAI(order);
    const result = aiResult ?? (await calculateLocalEstimate(order));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[simulator/estimate] Error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "ESTIMATE_FAILED",
        customerMessage:
          "Não consegui calcular a estimativa agora. Pode continuar a enviar os detalhes e a equipa CLYON confirma o valor.",
      },
      { status: 500 }
    );
  }
}
