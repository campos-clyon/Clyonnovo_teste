import { NextRequest, NextResponse } from "next/server";
import { upsertWandersonAdmin, ensureColaboradoresSchema, ensureSimulatorSettingsTable, resetSimulatorTableEnsuredFlag, ensureGalleryMediaTable, ensureSimulatorOrdersTable, getEffectiveRole, getPool } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/admin/setup
 *
 * Rota protegida por ADMIN_SETUP_SECRET.
 * Executa migração completa de schema da BD:
 * - Garante colunas na tabela colaboradores
 * - Configura assistentes, motoristas, admins com valores corretos
 * - Garante WANDERSON com isAdmin=1
 *
 * Uso:
 *   curl -X POST https://<dominio>/api/admin/setup \
 *     -H "x-admin-setup-secret: <ADMIN_SETUP_SECRET>"
 */
export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SETUP_SECRET;

  // Se a variável não estiver definida, a rota está desactivada
  if (!secret || secret.trim() === "") {
    return NextResponse.json(
      { error: "Setup não configurado. Defina ADMIN_SETUP_SECRET nas variáveis de ambiente." },
      { status: 503 }
    );
  }

  const provided = req.headers.get("x-admin-setup-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {

    // 1. Garantir schema de colaboradores (adiciona colunas em falta)
    await ensureColaboradoresSchema();

    // 2. Garantir tabelas auxiliares (incluindo colunas novas de simulatorOrders)
    await ensureSimulatorOrdersTable();

    // Forçar re-seed dos defaults mesmo que a tabela já exista, para propagar
    // alterações de valor (ex: custo_km 0.33→0.50, overhead 15.30→17.00)
    resetSimulatorTableEnsuredFlag();
    await ensureSimulatorSettingsTable();

    await ensureGalleryMediaTable();

    // 3. Configurar valores por função
    const pool = await getPool();
    if (pool) {
      // Assistentes: commission, sem horas, recebem pedidos
      await pool.execute(
        `UPDATE colaboradores 
         SET paymentModel = 'commission', 
             canReceiveSimulatorRequests = 1, 
             participatesInTimeTracking = 0,
             active = 1
         WHERE funcao = 'assistente'`
      ).catch(() => {});

      // Motoristas/Ajudantes: hourly, com horas, sem pedidos
      await pool.execute(
        `UPDATE colaboradores 
         SET paymentModel = 'hourly', 
             canReceiveSimulatorRequests = 0, 
             participatesInTimeTracking = 1,
             active = 1
         WHERE funcao IN ('motorista', 'ajudante')`
      ).catch(() => {});

      // Admin: none, sem horas, sem pedidos
      await pool.execute(
        `UPDATE colaboradores 
         SET paymentModel = 'none', 
             canReceiveSimulatorRequests = 0, 
             participatesInTimeTracking = 0,
             active = 1
         WHERE funcao = 'admin' AND isAdmin = 0`
      ).catch(() => {});
    }

    // 4. Garantir que WANDERSON existe e tem isAdmin=1
    const admin = await upsertWandersonAdmin();
    const effectiveRole = getEffectiveRole({ isAdmin: admin.isAdmin, funcao: admin.funcao });

    return NextResponse.json({
      ok: true,
      message: "Setup de admin concluído com sucesso.",
      timestamp: new Date().toISOString(),
      migrations: [
        "Schema colaboradores",
        "Tabela simulatorOrders (postalCode, city, parkingDistance, priority, ...)",
        "Tabela simulatorSettings (defaults actualizados: custo_km=0.50, overhead=17.00)",
        "Tabela galleryMedia",
        "Configuração de funções",
        "Admin WANDERSON",
      ],
      admin: {
        nome: admin.nome,
        isAdmin: admin.isAdmin === 1,
        effectiveRole,
      },
    });
  } catch (err) {
    console.error("[setup] Erro:", err);
    return NextResponse.json(
      { error: "Erro interno ao executar setup.", detail: String(err) },
      { status: 500 }
    );
  }
}

// Bloquear todos os outros métodos
export async function GET() {
  return NextResponse.json({ error: "Método não permitido. Use POST." }, { status: 405 });
}
