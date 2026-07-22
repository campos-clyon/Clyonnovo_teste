import { NextRequest, NextResponse } from "next/server";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Mesma proteção usada nos outros endpoints admin
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!colab.isAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  // Busca service_requests com dados do cliente e da categoria
  let query = getSupabaseAdmin()
    .from("service_requests")
    .select(`
      id,
      title,
      description,
      location,
      district,
      city,
      urgency,
      budget_range,
      preferred_date,
      status,
      photos,
      created_at,
      updated_at,
      profiles:client_id ( name, email, phone ),
      categories:category_id ( name, icon ),
      provider_responses ( count )
    `)
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

  // Normaliza a resposta para o formato esperado pelo frontend
  const orders = (data ?? []).map((row: any) => ({
    id:              row.id as string,
    title:           row.title as string,
    description:     row.description as string,
    location:        row.location as string,
    district:        row.district as string,
    city:            row.city as string,
    urgency:         row.urgency as string,
    budget_range:    row.budget_range as string | null,
    preferred_date:  row.preferred_date as string | null,
    status:          row.status as string,
    photos:          (row.photos ?? []) as string[],
    created_at:      row.created_at as string,
    updated_at:      row.updated_at as string,
    client_name:     (row.profiles as any)?.name ?? null,
    client_email:    (row.profiles as any)?.email ?? null,
    client_phone:    (row.profiles as any)?.phone ?? null,
    category_name:   (row.categories as any)?.name ?? null,
    category_icon:   (row.categories as any)?.icon ?? null,
    responses_count: Array.isArray(row.provider_responses)
      ? (row.provider_responses[0] as any)?.count ?? 0
      : 0,
  }));

  return NextResponse.json({ orders, total: count ?? orders.length });
}
