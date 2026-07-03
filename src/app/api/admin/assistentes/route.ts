import { NextRequest, NextResponse } from "next/server";
import {
  getActiveAssistants,
  countActiveOrdersByAssistant,
  createColaborador,
  updateColaborador,
  deleteColaborador,
  ensureColaboradoresSchema,
} from "@/lib/db";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

async function requireAdmin(req: NextRequest) {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return { err: NextResponse.json({ error: "Não autorizado" }, { status: 401 }), colab: null };
  if (!colab.isAdmin) return { err: NextResponse.json({ error: "Acesso negado" }, { status: 403 }), colab: null };
  return { err: null, colab };
}

// GET — listar todos com contagem de pedidos activos
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  
  try {
    // Garantir schema actualizado antes de qualquer query
    await ensureColaboradoresSchema();
    
    const [assistants, counts] = await Promise.all([getActiveAssistants(), countActiveOrdersByAssistant()]);
    const enriched = assistants.map((a) => ({ ...a, activePedidos: counts[a.id] ?? 0 }));
    // Retorna ambos os campos para retrocompatibilidade
    return NextResponse.json({ assistants: enriched, assistentes: enriched });
  } catch (error) {
    console.error("[v0] GET assistentes erro:", error);
    return NextResponse.json({ error: "Erro ao carregar assistentes" }, { status: 500 });
  }
}

// POST — criar novo assistente
export async function POST(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  
  try {
    // Garantir schema actualizado antes de qualquer query
    await ensureColaboradoresSchema();
    
    const body = await req.json();
    const { nome, senha, funcao, valorHora, isAdmin, paymentModel, commissionType, commissionPercent } = body;
    if (!nome || !senha || !funcao) return NextResponse.json({ error: "nome, senha e funcao obrigatórios" }, { status: 400 });
    const hash = await bcrypt.hash(senha, 10);
    
    // Para assistente: valorHora pode ser 0, permite comissão
    const defaults: any = { nome, senha: hash, funcao, isAdmin: isAdmin ? 1 : 0 };
    if (funcao === 'assistente') {
      defaults.paymentModel = paymentModel ?? 'commission';
      defaults.canReceiveSimulatorRequests = 1;
      defaults.participatesInTimeTracking = 0;
      defaults.valorHora = '0';
      if (commissionType) defaults.commissionType = commissionType;
      if (commissionPercent) defaults.commissionPercent = commissionPercent;
    } else {
      defaults.valorHora = valorHora ?? '8.00';
      defaults.paymentModel = 'hourly';
      defaults.canReceiveSimulatorRequests = 0;
      defaults.participatesInTimeTracking = 1;
    }
    
    await createColaborador(defaults);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[v0] POST assistentes erro:", error);
    return NextResponse.json({ error: "Erro ao criar colaborador" }, { status: 500 });
  }
}

// PATCH — actualizar assistente
export async function PATCH(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  if (fields.senha) fields.senha = await bcrypt.hash(fields.senha, 10);
  await updateColaborador(Number(id), fields);
  return NextResponse.json({ ok: true });
}

// DELETE — remover assistente
export async function DELETE(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  await deleteColaborador(Number(id));
  return NextResponse.json({ ok: true });
}
