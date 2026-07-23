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
  const days = Math.min(parseInt(searchParams.get("days") ?? "30", 10), 365);

  try {
    const sb = getSupabaseAdmin();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await sb
      .from("service_requests")
      .select("id, status, urgency, category_slug, city, created_at, estimated_price")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data ?? [];

    // Volume por estado
    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byCity: Record<string, number> = {};

    // Série temporal diária (últimos N dias)
    const dailyCounts: Record<string, number> = {};

    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.category_slug) byCategory[r.category_slug] = (byCategory[r.category_slug] ?? 0) + 1;
      if (r.city) byCity[r.city] = (byCity[r.city] ?? 0) + 1;
      const day = String(r.created_at).slice(0, 10);
      dailyCounts[day] = (dailyCounts[day] ?? 0) + 1;
    }

    const total = rows.length;
    const completed = rows.filter((r) => r.status === "completed").length;
    const cancelled = rows.filter((r) => ["canceled", "rejected"].includes(r.status)).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : null;
    const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : null;

    // Top categorias (ordenado por volume desc)
    const topCategories = Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([slug, count]) => ({ slug, count }));

    // Top cidades
    const topCities = Object.entries(byCity)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([city, count]) => ({ city, count }));

    // Série temporal como array ordenado
    const timeSeries = Object.entries(dailyCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return NextResponse.json({
      period: { days, since },
      summary: { total, completed, cancelled, completionRate, cancellationRate },
      byStatus,
      topCategories,
      topCities,
      timeSeries,
    });
  } catch (e: any) {
    console.error("[app-clyon/metricas]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
