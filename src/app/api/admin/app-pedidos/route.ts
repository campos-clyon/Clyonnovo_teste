import { NextRequest, NextResponse } from "next/server";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!colab.isAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  try {
    // First, discover what columns service_requests has
    let query = getSupabaseAdmin()
      .from("service_requests")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "todos") {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[app-pedidos] supabase error:", error);
      return NextResponse.json({ error: `Erro ao buscar pedidos: ${error.message}` }, { status: 500 });
    }

    const orders = (data ?? []).map((row: any) => ({
      id:              row.id,
      title:           row.title ?? row.service_type ?? "Sem título",
      description:     row.description ?? "",
      location:        row.location ?? row.address ?? "",
      district:        row.district ?? "",
      city:            row.city ?? "",
      urgency:         row.urgency ?? "normal",
      budget_range:    row.budget_range ?? null,
      preferred_date:  row.preferred_date ?? null,
      status:          row.status ?? "open",
      photos:          row.photos ?? [],
      created_at:      row.created_at,
      updated_at:      row.updated_at ?? row.created_at,
      client_name:     row.client_name ?? null,
      client_email:    row.client_email ?? null,
      client_phone:    row.client_phone ?? null,
      category_name:   row.category_name ?? null,
      category_icon:   row.category_icon ?? null,
      responses_count: row.responses_count ?? 0,
    }));

    return NextResponse.json({ orders, total: count ?? orders.length });
  } catch (err: any) {
    console.error("[app-pedidos] unexpected error:", err);
    return NextResponse.json({ error: `Erro inesperado: ${err.message}` }, { status: 500 });
  }
}
