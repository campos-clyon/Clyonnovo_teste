import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { dividasDosProfissionais } from "@/lib/cobrancas-na-base";
import { getPool } from "@/lib/db";
import { dinheiroDoInicio } from "@/lib/dinheiro-do-inicio";
import { gastosDaClyon } from "@/lib/financas-gastos-na-base";
import { entradasDaPlataforma, pagamentosAosAssistentes, tudoDaGestora } from "@/lib/financas-na-base";
import { lerGanhosDosTrabalhos } from "@/lib/ganhos-dos-trabalhos";
import { diaEmLisboa } from "@/lib/hora-de-lisboa";
import { agoraDoModelo } from "@/lib/relogio-do-modelo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O DINHEIRO DO INÍCIO — d56, 17-11-2026; bruto e líquido desde a d139
 * (27-11-2026).
 *
 * Debaixo de /api/admin/financas de propósito: quem vê as Finanças (o
 * administrador, e o assistente com as Carteiras) vê isto, pela mesma regra
 * (`SECCOES_QUE_ABREM`). O bruto é o ganho de cada trabalho feito
 * (`lerGanhosDosTrabalhos`, a conta das comissões); as despesas são as das
 * Finanças (`despesasNoIntervalo`), com os mesmos dados (sem contas nem
 * pagamentos de teste) e as comissões das assistentes só para o
 * administrador. Vão só os totais: nem pagamentos, nem nomes.
 */
export async function GET(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const eAdmin = colab?.papel === "admin";
  try {
    const hoje = diaEmLisboa(new Date());
    const [tudo, entradas, gastos, assistentes, trabalhos, aReceber] = await Promise.all([
      tudoDaGestora(),
      entradasDaPlataforma(),
      gastosDaClyon(),
      eAdmin ? pagamentosAosAssistentes() : Promise.resolve(null),
      lerGanhosDosTrabalhos(hoje),
      aReceberDosProfissionais(),
    ]);
    const periodos = dinheiroDoInicio({
      trabalhos: trabalhos ?? [],
      contas: { entradas: entradas ?? [], movimentos: tudo.movimentos, categorias: tudo.categorias, gastos, assistentes },
      hoje,
    });
    return NextResponse.json(
      {
        hoje,
        eAdmin,
        semEntradas: entradas == null,
        semTrabalhos: trabalhos == null,
        periodos,
        aReceberDosProfissionais: aReceber,
      },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (e) {
    console.error("[admin/financas/inicio]", e);
    return NextResponse.json({ error: "Não foi possível fazer as contas do dinheiro." }, { status: 500 });
  }
}

/**
 * O que os profissionais ainda têm de passar à CLYON — o `porPagar` das
 * dívidas (`dividasDe`, a conta de Pagamentos › A receber dos profissionais),
 * sem as contas de teste. Se falhar, `null`.
 */
async function aReceberDosProfissionais(): Promise<number | null> {
  try {
    const porProfissional = await dividasDosProfissionais(undefined, agoraDoModelo());
    const ids = [...porProfissional.keys()];
    const deTeste = new Set<number>();
    const pool = await getPool();
    if (pool && ids.length > 0) {
      const [linhas] = (await pool.query(`SELECT id FROM providers WHERE id IN (?) AND COALESCE(contaDeTeste, 0) = 1`, [
        ids,
      ])) as [Array<{ id: number }>, unknown];
      for (const l of linhas) deTeste.add(Number(l.id));
    }
    let s = 0;
    for (const [pid, ds] of porProfissional) {
      if (deTeste.has(pid)) continue;
      for (const d of ds) s += d.paga ? 0 : d.porPagar;
    }
    return Math.round(s * 100) / 100;
  } catch (e) {
    console.error("[admin/financas/inicio] a receber", e);
    return null;
  }
}
