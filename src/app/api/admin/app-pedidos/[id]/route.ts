import { NextRequest, NextResponse } from "next/server";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "draft",
  "received",
  "in_review",
  "awaiting_deposit",
  "assignment_pending",
  "partner_selected",
  "confirmed",
  "in_route",
  "arrived",
  "in_execution",
  "extra_review_requested",
  "awaiting_confirmation",
  "completed",
  "in_dispute",
  "canceled",
  "rejected",
] as const;

async function requireAdmin(req: NextRequest) {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return { err: NextResponse.json({ error: "Não autorizado" }, { status: 401 }), colab: null };
  if (!colab.isAdmin) return { err: NextResponse.json({ error: "Acesso negado" }, { status: 403 }), colab: null };
  return { err: null, colab };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("service_requests").select("*").eq("id", id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ order: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Status inválido: ${body.status}` }, { status: 400 });
    }
    updates.status = body.status;
  }
  if (typeof body.details === "string")        updates.details = body.details;
  if (typeof body.notes === "string")          updates.notes = body.notes;
  if (typeof body.address_line === "string")   updates.address_line = body.address_line;
  if (typeof body.city === "string")           updates.city = body.city;
  if (typeof body.region === "string")         updates.region = body.region;
  if (typeof body.urgency === "string")        updates.urgency = body.urgency;
  if (body.estimated_price !== undefined)      updates.estimated_price = body.estimated_price;
  if (body.scheduled_for !== undefined)        updates.scheduled_for = body.scheduled_for;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("service_requests").update(updates).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ order: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
