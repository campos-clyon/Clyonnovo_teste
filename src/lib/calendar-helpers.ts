/**
 * calendar-helpers.ts
 * Shared utilities for building Google Calendar event descriptions.
 * Must NOT be imported into client components (uses Node-only APIs via GoogleGenerativeAI).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export const GEMINI_TIMEOUT_MS = 4000;

// ── rawOrderJson helpers ──────────────────────────────────────────────────────

export function safeParseRaw(json?: string | null): Record<string, any> {
  try { return json ? JSON.parse(json) : {}; } catch { return {}; }
}

export function isMudancaType(serviceType?: string | null): boolean {
  if (!serviceType) return false;
  const v = serviceType.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return v === "mudanca" || v === "moving";
}

export function getMovingAddresses(order: Record<string, any>) {
  const raw = safeParseRaw(order.rawOrderJson);
  const originAddress: string =
    raw?.originAddress?.formattedAddress ||
    raw?.originAddress?.address ||
    (typeof raw?.originAddress === "string" ? raw.originAddress : "") ||
    order.address || "";
  const destinationAddress: string =
    raw?.destinationAddress?.formattedAddress ||
    raw?.destinationAddress?.address ||
    (typeof raw?.destinationAddress === "string" ? raw.destinationAddress : "") ||
    order.destinationAddress || "";
  const originAccess: Record<string, any>      = raw?.originAccess ?? {};
  const destinationAccess: Record<string, any> = raw?.destinationAccess ?? {};
  const movingDistance: Record<string, any>    = raw?.movingDistance ?? {};
  return { originAddress, destinationAddress, originAccess, destinationAccess, movingDistance };
}

export function formatAccess(access: Record<string, any>, floor?: string | null): string {
  const lines: string[] = [];
  const f = access.floor ?? floor;
  if (f)                          lines.push(`Andar: ${f}`);
  if (access.hasElevator != null) lines.push(`Elevador: ${access.hasElevator}`);
  if (access.parkingDistance)     lines.push(`Estacionamento: ${access.parkingDistance}`);
  if (access.difficultAccess != null)
    lines.push(`Acesso difícil: ${access.difficultAccess ? "Sim" : "Não"}`);
  if (access.observations)        lines.push(`Observações: ${access.observations}`);
  return lines.join("\n");
}

// ── Description builders ──────────────────────────────────────────────────────

/** Full structured description — used as Gemini fallback */
export function buildStructuredDescription(
  order: Record<string, any>,
  calendarNotes?: string | null,
  orderId?: number
): string {
  const isMov = isMudancaType(order.serviceType);
  const id = orderId ?? order.id;
  const lines: string[] = [];

  lines.push(`Pedido #${id}`);
  lines.push("");
  lines.push("CLIENTE");
  lines.push(`Nome: ${order.contactName || "—"}`);
  lines.push(`Telefone: ${order.contactPhone || "—"}`);
  if (order.contactEmail) lines.push(`Email: ${order.contactEmail}`);
  lines.push("");
  lines.push("SERVICO");
  lines.push(`Tipo: ${order.serviceType || "—"}`);

  if (isMov) {
    const { originAddress, destinationAddress, originAccess, destinationAccess, movingDistance } =
      getMovingAddresses(order);
    lines.push("");
    lines.push("MORADAS DA MUDANÇA");
    lines.push("");
    lines.push("ORIGEM");
    lines.push(`Morada: ${originAddress || "—"}`);
    const oA = formatAccess(originAccess, order.floor);
    if (oA) lines.push(oA);
    lines.push("");
    lines.push("DESTINO");
    lines.push(`Morada: ${destinationAddress || "—"}`);
    const dA = formatAccess(destinationAccess);
    if (dA) lines.push(dA);
    const distText = movingDistance?.distanceText ?? (order.distanceKm ? `${order.distanceKm} km` : null);
    const durText  = movingDistance?.durationText ?? null;
    if (distText || durText) {
      lines.push("");
      lines.push("PERCURSO");
      if (distText) lines.push(`Distância: ${distText}`);
      if (durText)  lines.push(`Duração: ${durText}`);
    }
  } else {
    lines.push("");
    lines.push("MORADA");
    lines.push(`Morada: ${order.address || "—"}`);
    if (order.city)            lines.push(`Localidade: ${order.city}`);
    if (order.floor)           lines.push(`Andar: ${order.floor}`);
    if (order.hasElevator)     lines.push(`Elevador: ${order.hasElevator}`);
    if (order.parkingDistance) lines.push(`Estacionamento: ${order.parkingDistance}`);
  }

  if (order.precoFinal || order.precoFinalIva) {
    lines.push("");
    lines.push("VALORES");
    if (order.precoFinal)    lines.push(`Sem IVA: €${order.precoFinal}`);
    if (order.precoFinalIva) lines.push(`Total c/ IVA: €${order.precoFinalIva}`);
  }

  if (order.assignedToName) lines.push("", `Assistente: ${order.assignedToName}`);
  if (calendarNotes)        lines.push("", `OBSERVACOES\n${calendarNotes}`);

  if (order.description) {
    lines.push("");
    lines.push("DESCRIÇÃO ORIGINAL DO CLIENTE");
    lines.push(order.description);
  }

  return lines.join("\n");
}

/** Generate Gemini operational summary with GEMINI_TIMEOUT_MS timeout */
export async function generateOperationalSummary(order: Record<string, any>): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

  const isMov = isMudancaType(order.serviceType);
  const { originAddress, destinationAddress, originAccess, destinationAccess, movingDistance } =
    isMov
      ? getMovingAddresses(order)
      : { originAddress: "", destinationAddress: "", originAccess: {}, destinationAccess: {}, movingDistance: {} };

  const parts: string[] = [
    `Cliente: ${order.contactName || "—"}`,
    `Serviço: ${order.serviceType || "—"}`,
    `Descrição original: ${order.description || "—"}`,
  ];

  if (isMov) {
    parts.push(`Origem: ${originAddress || "—"}`);
    parts.push(`Destino: ${destinationAddress || "—"}`);
    const oA = formatAccess(originAccess, order.floor);
    if (oA) parts.push(`Acesso origem:\n${oA}`);
    const dA = formatAccess(destinationAccess);
    if (dA) parts.push(`Acesso destino:\n${dA}`);
    const dist = movingDistance?.distanceText ?? (order.distanceKm ? `${order.distanceKm} km` : null);
    const dur  = movingDistance?.durationText ?? null;
    if (dist) parts.push(`Distância: ${dist}`);
    if (dur)  parts.push(`Duração estimada: ${dur}`);
  } else {
    parts.push(`Morada: ${order.address || "—"}`);
    if (order.city)            parts.push(`Localidade: ${order.city}`);
    if (order.floor)           parts.push(`Andar: ${order.floor}`);
    if (order.hasElevator)     parts.push(`Elevador: ${order.hasElevator}`);
    if (order.parkingDistance) parts.push(`Estacionamento: ${order.parkingDistance}`);
  }

  if (order.precoFinal || order.precoFinalIva) {
    parts.push(
      `Estimativa: ${order.precoFinal ? `€${order.precoFinal} s/ IVA` : ""} ${order.precoFinalIva ? `/ €${order.precoFinalIva} c/ IVA` : ""}`.trim()
    );
  }

  const prompt = `És um assistente operacional da empresa de mudanças e serviços domésticos CLYON.
Cria um RESUMO OPERACIONAL claro e conciso em PT-PT para a equipa que vai executar o trabalho.
O resumo deve ter no máximo 200 palavras. Usa linguagem directa e prática.
Inclui: o que fazer, moradas, itens a transportar/recolher (se mencionados), avisos de acesso.
Não inventes informação. Não uses markdown. Usa texto simples.

Dados do pedido:
${parts.join("\n")}`;

  const client = new GoogleGenerativeAI(apiKey);
  const model  = client.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });

  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini timeout")), GEMINI_TIMEOUT_MS)
    ),
  ]);

  return (result as Awaited<ReturnType<typeof model.generateContent>>).response.text().trim();
}

/** Build full calendar description: Gemini summary (if available) + structured data */
export function buildFullCalendarDescription(
  operationalSummary: string,
  structuredPart: string
): string {
  if (operationalSummary) {
    return `RESUMO OPERACIONAL\n${operationalSummary}\n\n${structuredPart}`;
  }
  return structuredPart;
}
