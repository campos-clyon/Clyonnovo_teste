import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSimulatorOrder, createLead, createLeadEvent, appendOrderHistory, calculateOrderPriority } from "@/lib/db";
import { calculateFastEstimate } from "@/lib/pricing-helper";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyNewOrder } from "@/lib/whatsapp";
import { SITE_URL } from "@/lib/seo-data";

export const runtime = "nodejs";

const SERVICE_LABELS: Record<string, string> = {
  recolha_moveis:           "Recolha de móveis",
  recolha_monos:            "Recolha de monos",
  recolha_entulho:          "Recolha de entulho",
  esvaziamento_casa:        "Esvaziamento de casa",
  esvaziamento_apartamento: "Esvaziamento de apartamento",
  mudanca:                  "Mudança",
  outro:                    "Outro",
};

const HeroQuoteSchema = z.object({
  primeiroNome:    z.string().min(2).max(60),
  ultimoNome:      z.string().min(2).max(60),
  indicativo:      z.string().min(1).max(6),   // ex: "+351"
  telefone:        z.string().min(6).max(20),
  rua:             z.string().min(2).max(200),
  codigoPostal:    z.string().min(4).max(12),
  numeroPosta:     z.string().max(20),
  andar:           z.string().max(20),
  elevador:        z.enum(["yes", "small", "no", "unknown"]),
  tipoServico:     z.string().min(2).max(80),
  descricao:       z.string().max(300).optional(),
  // UTM / rastreio opcional
  pagePath:        z.string().max(255).optional(),
  utmSource:       z.string().max(120).optional(),
  utmMedium:       z.string().max(120).optional(),
  utmCampaign:     z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`hero-quote:${ip}`, 5, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Aguarde um momento e tente novamente." },
      { status: 429 }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = HeroQuoteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const {
    primeiroNome, ultimoNome, indicativo, telefone,
    rua, codigoPostal, numeroPosta, andar, elevador,
    tipoServico, descricao, pagePath, utmSource, utmMedium, utmCampaign,
  } = parsed.data;

  const nomeCompleto = `${primeiroNome} ${ultimoNome}`.trim();
  const telefoneFull = `${indicativo}${telefone}`.replace(/\s+/g, "");
  const morada = [rua, numeroPosta, codigoPostal].filter(Boolean).join(", ");

  // ── Motor de preços (rápido, sem Gemini) ─────────────────────────────────────
  // Estimar distância km a partir do código postal (sem geocoding).
  // Prefixos PT: 1xxx/2xxx = Lisboa metro ~20km | 28xx = Almada/Barreiro ~25km
  // 29xx/30xx = Setúbal/Palmela ~45km | outros = 35km (genérico)
  function estimateKmFromPostal(cp: string): number {
    const prefix = parseInt(cp.replace(/\D/g, "").slice(0, 4), 10);
    if (isNaN(prefix)) return 30;
    if (prefix >= 1000 && prefix <= 1999) return 20; // Lisboa
    if (prefix >= 2800 && prefix <= 2849) return 25; // Almada / Barreiro
    if (prefix >= 2850 && prefix <= 2899) return 22; // Seixal / Corroios
    if (prefix >= 2900 && prefix <= 2959) return 40; // Setúbal
    if (prefix >= 2960 && prefix <= 2999) return 45; // Palmela / Montijo
    if (prefix >= 2000 && prefix <= 2799) return 30; // Margem Sul genérica
    return 35; // outros
  }

  const estimatedKm = codigoPostal ? estimateKmFromPostal(codigoPostal) : 30;

  let estimate: Awaited<ReturnType<typeof calculateFastEstimate>> | null = null;
  try {
    estimate = await calculateFastEstimate({
      serviceType: tipoServico,
      description: descricao ?? "",
      floor: andar || undefined,
      hasElevator: elevador,
      distanceFromBase: { distanceKm: estimatedKm },
    });
  } catch (e) {
    console.error("[hero-quote] calculateFastEstimate error:", e);
  }

  // ── Criar lead ────────────────────────────────────────────────────────────────
  try {
    await createLead({
      nome:                nomeCompleto,
      telefone:            telefoneFull,
      email:               "",          // email não exigido neste formulário
      localidade:          codigoPostal,
      tipoServico:         SERVICE_LABELS[tipoServico] ?? tipoServico,
      preferenciaContacto: "telefone",
      mensagem:            descricao ?? null,
      pagePath:            pagePath ?? "/",
      pageUrl:             pagePath ? `${SITE_URL}${pagePath}` : SITE_URL,
      utmSource:           utmSource ?? null,
      utmMedium:           utmMedium ?? null,
      utmCampaign:         utmCampaign ?? null,
      gclid:               null,
    });
  } catch (e) {
    console.error("[hero-quote] createLead error:", e);
  }

  void createLeadEvent({
    eventType: "form_submit_hero_quote",
    pagePath: pagePath ?? "/",
    serviceType: tipoServico,
    location: codigoPostal,
    contactPreference: "telefone",
    utmSource: utmSource ?? null,
    utmMedium: utmMedium ?? null,
    utmCampaign: utmCampaign ?? null,
    gclid: null,
  }).catch((e) => console.error("[hero-quote] createLeadEvent error:", e));

  // ── Criar pedido (pedidos backoffice) ─────────────────────────────────────────
  let orderId: number | null = null;
  try {
    const priority = calculateOrderPriority({
      urgency: undefined,
      description: descricao,
      estimateTotal: estimate?.estimatedPriceWithVat?.toString() ?? null,
    });

    const row = {
      serviceType: tipoServico || null,
      description: descricao || null,
      filesJson: null,
      address: morada || null,
      city: null,
      floor: andar || null,
      hasElevator: elevador !== "unknown" ? elevador : null,
      parkingDistance: null,
      contactName: nomeCompleto,
      contactPhone: telefoneFull,
      contactEmail: null,
      urgency: null,
      estimateMin: estimate?.estimatedPriceWithoutVat?.toString() ?? null,
      estimateMax: estimate?.estimatedPriceWithVat?.toString() ?? null,
      estimateTotal: estimate?.estimatedPriceWithVat?.toString() ?? null,
      estimateJson: estimate ? JSON.stringify(estimate) : null,
      recurrenceFrequency: null,
      recurringDiscountPercent: null,
      analysisJsonExtended: null,
      distanceKm: null,
      distanceText: null,
      chatJson: null,
      priority,
      status: "sem_assistente" as const,
      assignedToId: null,
      assignedToName: null,
      assignedAt: null,
      rawOrderJson: JSON.stringify({
        serviceType: tipoServico,
        description: descricao,
        floor: andar,
        hasElevator: elevador,
        address: { formattedAddress: morada },
        receiver: { name: nomeCompleto, phone: telefoneFull },
        _source: "hero_quote_form",
      }),
    };

    orderId = await createSimulatorOrder(row);

    await appendOrderHistory(orderId, {
      type: "created",
      by: null,
      message: `Pedido criado via formulário hero (homepage). Serviço: ${tipoServico}. Prioridade: ${priority}.`,
    });

    notifyNewOrder({
      id: orderId,
      serviceType: tipoServico,
      contactName: nomeCompleto,
      city: null,
      address: morada,
      estimateWithVat: estimate?.estimatedPriceWithVat?.toString() ?? null,
      backofficeUrl: `${SITE_URL}/admin/pedidos/${orderId}`,
    });
  } catch (e) {
    console.error("[hero-quote] createSimulatorOrder error:", e);
  }

  return NextResponse.json({
    ok: true,
    orderId,
    estimate: estimate
      ? {
          estimatedPriceWithVat: estimate.estimatedPriceWithVat,
          estimatedPriceWithoutVat: estimate.estimatedPriceWithoutVat,
          estimateMinWithVat: estimate.estimateMinWithVat,
          estimateMaxWithVat: estimate.estimateMaxWithVat,
          status: estimate.status,
          confidence: estimate.confidence,
          customerMessage: estimate.customerMessage,
        }
      : null,
  });
}
