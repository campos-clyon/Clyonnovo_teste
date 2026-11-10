import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { listarAssistentes } from "@/lib/assistentes";
import type { PeriodoDaSocia } from "@/lib/financas-do-mes";
import { gastosDaClyon } from "@/lib/financas-gastos-na-base";
import { entradasDaPlataforma, pagamentosAosAssistentes, tudoDaGestora } from "@/lib/financas-na-base";
import { diaEmLisboa } from "@/lib/hora-de-lisboa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A GESTORA DE CONTAS DA CLYON — tudo o que o ecrã precisa, de uma vez: as
 * contas, as categorias, os movimentos lançados à mão e os da plataforma.
 * Ver `financas.ts`.
 *
 * Quem tiver a secção das Carteiras vê — decisão do dono, 14-10-2026. O `hoje`
 * vai de cá, em Lisboa: o «saldo de hoje» não pode depender do relógio de
 * quem abre o ecrã.
 *
 * AS CONTAS DO MÊS — 07-11-2026 (d21): vêm também os pagamentos divididos em
 * IVA, taxa e parte do profissional (`entradas`), os gastos e — só para o
 * administrador, como a secção dos Assistentes — o que se pagou aos
 * assistentes e os períodos da conta que ganha sobre todos os trabalhos (a
 * sócia). Para os outros vêm `null`, e o ecrã diz porquê.
 */
export async function GET(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const eAdmin = colab?.papel === "admin";
  try {
    const [tudo, entradas, gastos, assistentes, socia] = await Promise.all([
      tudoDaGestora(),
      entradasDaPlataforma(),
      gastosDaClyon(),
      eAdmin ? pagamentosAosAssistentes() : Promise.resolve(null),
      eAdmin ? periodosDaSocia() : Promise.resolve(null),
    ]);
    return NextResponse.json({ ...tudo, entradas, gastos, assistentes, socia, eAdmin, hoje: diaEmLisboa(new Date()) });
  } catch (e) {
    console.error("[admin/financas GET]", e);
    return NextResponse.json({ error: "Não foi possível ler as finanças." }, { status: 500 });
  }
}

/** Os períodos das contas de assistente que ganham sobre todos os trabalhos. Se falhar, nada. */
async function periodosDaSocia(): Promise<PeriodoDaSocia[] | null> {
  try {
    const { assistentes } = await listarAssistentes();
    return assistentes
      .filter((a) => a.activo && a.comissaoSobre === "todos")
      .flatMap((a) =>
        a.comissoes.periodos.map((p) => ({
          nome: a.nome,
          percentagem: p.comissaoPercent,
          inicio: p.inicio,
          fim: p.fim,
          rotulo: p.rotulo,
          estado: p.estado,
          lucro: p.lucro,
          comissao: p.comissaoAssistente,
          pendentes: p.pendentes.length,
        })),
      );
  } catch (e) {
    console.error("[admin/financas GET] sócia", e);
    return null;
  }
}
