import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLead, createLeadEvent, getAllLeads, updateLeadStatus } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const LeadSchema = z.object({
  nome:                z.string().min(2).max(160),
  telefone:            z.string().min(9).max(30),
  email:               z.string().email().max(320),
  localidade:          z.string().min(2).max(120),
  tipoServico:         z.string().min(2).max(80),
  preferenciaContacto: z.string().min(1).max(30),
  mensagem:            z.string().max(2000).optional(),
  pagePath:            z.string().max(255).optional(),
  pageUrl:             z.string().max(512).optional(),
  utmSource:           z.string().max(120).optional(),
  utmMedium:           z.string().max(120).optional(),
  utmCampaign:         z.string().max(120).optional(),
  gclid:               z.string().max(255).optional(),
});

// POST /api/leads — criar novo lead
export async function POST(request: NextRequest) {
  // Rate limit: 10 submissões por IP por 60 segundos
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`leads:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Aguarde um momento e tente novamente." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  try {
    const raw = await request.json();
    const parsed = LeadSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const { nome, telefone, email, localidade, tipoServico, preferenciaContacto,
            mensagem, pagePath, pageUrl, utmSource, utmMedium, utmCampaign, gclid } = parsed.data;

    await createLead({
      nome,
      telefone,
      email,
      localidade,
      tipoServico,
      preferenciaContacto,
      mensagem: mensagem ?? null,
      pagePath: pagePath ?? null,
      pageUrl: pageUrl ?? null,
      utmSource: utmSource ?? null,
      utmMedium: utmMedium ?? null,
      utmCampaign: utmCampaign ?? null,
      gclid: gclid ?? null,
    });

    // Gravar evento de formulário submetido (garante contagem no dashboard mesmo que o cliente falhe)
    void createLeadEvent({
      eventType: "form_submit_quero_contratar",
      pagePath: pagePath ? String(pagePath).slice(0, 255) : null,
      serviceType: tipoServico ? String(tipoServico).slice(0, 80) : null,
      location: localidade ? String(localidade).slice(0, 120) : null,
      contactPreference: preferenciaContacto ? String(preferenciaContacto).slice(0, 30) : null,
      utmSource: utmSource ? String(utmSource).slice(0, 120) : null,
      utmMedium: utmMedium ? String(utmMedium).slice(0, 120) : null,
      utmCampaign: utmCampaign ? String(utmCampaign).slice(0, 120) : null,
      gclid: gclid ? String(gclid).slice(0, 255) : null,
    }).catch((e) => console.error("[api/leads] Erro ao criar evento form_submit:", e));

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[api/leads] POST error:", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}

// GET /api/leads — listar leads (apenas para uso interno/admin)
export async function GET() {
  try {
    const items = await getAllLeads();
    return NextResponse.json({ leads: items });
  } catch (error) {
    console.error("[api/leads] GET error:", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}

// PATCH /api/leads — atualizar status de um lead
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, notasInternas } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "id e status são obrigatórios." }, { status: 400 });
    }

    const validStatuses = ["novo", "contactado", "fechado", "perdido"] as const;
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }

    await updateLeadStatus(Number(id), status, notasInternas);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/leads] PATCH error:", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
