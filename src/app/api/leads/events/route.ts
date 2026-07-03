import { NextRequest, NextResponse } from "next/server";
import { createLeadEvent } from "@/lib/db";

// POST /api/leads/events — registar evento de tracking de contacto
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      eventType,
      action,
      pagePath,
      pageUrl,
      label,
      phone,
      email,
      name,
      serviceType,
      location,
      message,
      simulatorData,
      contactPreference,
      utmSource,
      utmMedium,
      utmCampaign,
      gclid,
    } = body;

    if (!eventType || typeof eventType !== "string") {
      return NextResponse.json({ error: "eventType é obrigatório." }, { status: 400 });
    }

    const sanitizedType = String(eventType).slice(0, 80);

    await createLeadEvent({
      eventType: sanitizedType,
      action: action ? String(action).slice(0, 160) : null,
      pagePath: pagePath ? String(pagePath).slice(0, 255) : null,
      pageUrl: pageUrl ? String(pageUrl).slice(0, 500) : null,
      label: label ? String(label).slice(0, 160) : null,
      phone: phone ? String(phone).slice(0, 30) : null,
      email: email ? String(email).slice(0, 320) : null,
      name: name ? String(name).slice(0, 160) : null,
      serviceType: serviceType ? String(serviceType).slice(0, 80) : null,
      location: location ? String(location).slice(0, 120) : null,
      message: message ? String(message) : null,
      simulatorData: simulatorData ? (typeof simulatorData === "string" ? simulatorData : JSON.stringify(simulatorData)) : null,
      contactPreference: contactPreference ? String(contactPreference).slice(0, 30) : null,
      utmSource: utmSource ? String(utmSource).slice(0, 120) : null,
      utmMedium: utmMedium ? String(utmMedium).slice(0, 120) : null,
      utmCampaign: utmCampaign ? String(utmCampaign).slice(0, 120) : null,
      gclid: gclid ? String(gclid).slice(0, 255) : null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/leads/events] POST error:", error);
    // Retornar 200 para não bloquear o utilizador
    return NextResponse.json({ success: true });
  }
}
