import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminGeral } from "@/lib/admin-auth-helper";
import { getPool } from "@/lib/db";
import { dividasDosProfissionais, desfazerParte, marcarPartes } from "@/lib/cobrancas-na-base";
import { eParteDaDivida, estadoDaCobranca, type ParteDaDivida } from "@/lib/cobrancas-ao-profissional";
import { eMetodoDoProfissional } from "@/lib/pagamento-da-divida";
import { diaEmLisboa, inicioDoDiaEmLisboa } from "@/lib/hora-de-lisboa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PAGAMENTOS › «A RECEBER DOS PROFISSIONAIS» — 11-11-2026 (dono).
 *
 * *«Não vejo onde marco se está pendente ou se ele já pagou, ou se pagou só o
 * IVA e não a taxa, ou só a taxa e não o IVA.»*
 *
 * GET: por profissional, o que deve à CLYON de trabalhos pagos em mão, cada
 * trabalho com as duas partes (IVA e taxa da plataforma) e o estado de cada
 * uma. A conta é a da carteira dele (`dividasDosProfissionais` → `dividasDe`),
 * a mesma das Carteiras e do bloqueio dos 7 dias.
 *
 * POST: marcar o IVA, a taxa ou os dois como pagos (método, dia, nota), ou
 * desfazer uma marca (com motivo). Só o administrador, como todas as escritas
 * de dinheiro (`ESCRITAS_SO_DO_ADMINISTRADOR`).
 */

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    const agora = new Date();
    const porProfissional = await dividasDosProfissionais(undefined, agora);
    const ids = [...porProfissional.keys()];
    const nomes = new Map<number, { nome: string; contaDeTeste: boolean }>();
    const pool = await getPool();
    if (pool && ids.length > 0) {
      const [linhas] = (await pool.query(
        `SELECT id, name, COALESCE(contaDeTeste, 0) AS contaDeTeste FROM providers WHERE id IN (?)`,
        [ids],
      )) as [Array<{ id: number; name: string | null; contaDeTeste: number }>, unknown];
      for (const l of linhas) {
        nomes.set(Number(l.id), { nome: String(l.name ?? "Profissional"), contaDeTeste: Number(l.contaDeTeste) === 1 });
      }
    }

    const profissionais = ids
      .map((pid) => {
        const ds = porProfissional.get(pid) ?? [];
        const trabalhos = ds
          .map((d) => ({
            negociacaoId: d.negociacaoId,
            pedidoId: d.pedidoId,
            cliente: d.cliente,
            servico: d.servico,
            nasceuEm: d.nasceuEm ? d.nasceuEm.toISOString() : null,
            estado: estadoDaCobranca(d.partes),
            porPagar: d.paga ? 0 : d.porPagar,
            total: d.totalDaDivida,
            partes: d.partes,
          }))
          // Do maior n.º do pedido para o menor (dono, 29-10-2026).
          .sort((a, b) => (b.pedidoId ?? 0) - (a.pedidoId ?? 0) || b.negociacaoId - a.negociacaoId);
        const devido = Math.round(trabalhos.reduce((s, t) => s + t.porPagar, 0) * 100) / 100;
        return {
          providerId: pid,
          nome: nomes.get(pid)?.nome ?? `Profissional #${pid}`,
          contaDeTeste: nomes.get(pid)?.contaDeTeste ?? false,
          devido,
          trabalhos,
        };
      })
      .sort((a, b) => b.devido - a.devido || a.nome.localeCompare(b.nome, "pt"));

    const todos = profissionais.flatMap((p) => p.trabalhos);
    return NextResponse.json({
      profissionais,
      totais: {
        devido: Math.round(profissionais.reduce((s, p) => s + p.devido, 0) * 100) / 100,
        pendentes: todos.filter((t) => t.estado === "pendente").length,
        parciais: todos.filter((t) => t.estado === "parcial").length,
        pagos: todos.filter((t) => t.estado === "pago").length,
      },
    });
  } catch (e) {
    console.error("[admin/pagamentos/a-receber-dos-profissionais]", e);
    return NextResponse.json({ error: "Não foi possível ler o que os profissionais devem." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: {
    accao?: unknown;
    negociacaoId?: unknown;
    partes?: unknown;
    parte?: unknown;
    metodo?: unknown;
    dia?: unknown;
    nota?: unknown;
    motivo?: unknown;
  };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }
  const quem = String(colab?.nome ?? "a CLYON");

  try {
    if (corpo.accao === "desfazer") {
      if (!eParteDaDivida(corpo.parte)) {
        return NextResponse.json({ error: "Diga que parte desfazer: o IVA ou a taxa." }, { status: 400 });
      }
      const motivo = typeof corpo.motivo === "string" ? corpo.motivo.trim() : "";
      if (motivo.length < 3) {
        return NextResponse.json({ error: "Escreva o motivo para desfazer." }, { status: 400 });
      }
      const r = await desfazerParte({ negociacaoId, parte: corpo.parte, motivo, quem });
      return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.porque }, { status: r.status });
    }

    const partes = Array.isArray(corpo.partes) ? corpo.partes.filter(eParteDaDivida) : [];
    if (partes.length === 0) {
      return NextResponse.json({ error: "Diga que parte marcar: o IVA, a taxa ou as duas." }, { status: 400 });
    }
    if (!eMetodoDoProfissional(corpo.metodo)) {
      return NextResponse.json({ error: "Diga como pagou: transferência, MB WAY ou numerário." }, { status: 400 });
    }

    /*
     * O DIA EM QUE ELE PAGOU, EM LISBOA. Hoje (ou nada) = agora; um dia
     * anterior = o meio-dia desse dia em Lisboa. Nunca no futuro.
     */
    const agora = new Date();
    const hoje = diaEmLisboa(agora);
    const dia = typeof corpo.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(corpo.dia) ? corpo.dia : hoje;
    if (dia > hoje) return NextResponse.json({ error: "O dia do pagamento não pode ser no futuro." }, { status: 400 });
    const quando = dia === hoje ? agora : new Date(inicioDoDiaEmLisboa(dia).getTime() + 12 * 3_600_000);

    const nota = typeof corpo.nota === "string" ? corpo.nota.trim().slice(0, 255) : "";
    const r = await marcarPartes({
      negociacaoId,
      partes: [...new Set(partes)] as ParteDaDivida[],
      metodo: corpo.metodo,
      quando,
      nota: nota || null,
      quem,
      agora,
    });
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.porque }, { status: r.status });
  } catch (e) {
    console.error("[admin/pagamentos/a-receber-dos-profissionais] POST", e);
    return NextResponse.json({ error: "Não foi possível gravar." }, { status: 500 });
  }
}
