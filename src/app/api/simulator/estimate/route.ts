import { NextRequest, NextResponse } from "next/server";
import { calculateFastEstimate } from "@/lib/pricing-helper";
import type { OrderData } from "@/app/simulador/types";

export const runtime = "nodejs";

// Motor C foi unificado com Motor B (calculateFastEstimate).
// Este endpoint delega directamente para o motor activo.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const order: OrderData = body.order ?? {};

    const result = await calculateFastEstimate(order as Parameters<typeof calculateFastEstimate>[0]);
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
