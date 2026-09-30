import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { resetSimulatorTableEnsuredFlag, ensureSimulatorSettingsTable, getSimulatorSettings } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/admin/settings/reseed
 *
 * Força o re-seed dos defaults de simulatorSettings na DB.
 * Útil para propagar alterações de código (ex: custo_km, overhead_por_servico)
 * sem precisar de deploy ou intervênção manual nos campos da UI.
 *
 * Protegido por token de admin.
 */
export async function POST(req: NextRequest) {
  // Confirmado na base, e não só pela assinatura — ver `conta-do-painel.ts`.
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  try {
    // Reset do flag para forçar re-execução do upsert de defaults
    resetSimulatorTableEnsuredFlag();
    await ensureSimulatorSettingsTable();

    // Retornar os valores actuais para confirmar
    const settings = await getSimulatorSettings();
    const relevant = settings
      .filter((s) => ["custo_km", "overhead_por_servico"].includes(s.key))
      .map((s) => ({ key: s.key, value: s.value }));

    return NextResponse.json({
      ok: true,
      message: "Defaults de simulatorSettings actualizados com sucesso.",
      values: relevant,
    });
  } catch (err) {
    console.error("[admin/settings/reseed] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao re-seed dos settings.", detail: String(err) },
      { status: 500 }
    );
  }
}
