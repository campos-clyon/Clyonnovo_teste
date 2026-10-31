import { NextRequest, NextResponse } from "next/server";

import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { primeiroDoMesEmLisboa, inicioDoDiaEmLisboa, somarDiasAoDia } from "@/lib/hora-de-lisboa";
import {
  MINUTOS_SEM_INTERACCAO,
  diasALer,
  mesValido,
  resumoDaPresenca,
} from "@/lib/presenca-do-backoffice";
import {
  agendasEntre,
  assistentesParaAPresenca,
  blocosDePresencaEntre,
  ultimasMarcacoes,
} from "@/lib/presenca-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/presenca?mes=AAAA-MM — 31-10-2026 (ordem do CEO e do dono).
 *
 * SÓ O ADMINISTRADOR (`requireAdminGeral`; nem está na lista das rotas do
 * assistente): por assistente, as horas activas de hoje, desta semana e deste
 * mês, e o mês pedido dia a dia — os blocos, as ausências (vãos de 15 minutos
 * ou mais) e as marcações da agenda dela, «avisou» ou «sem aviso». E as
 * agendas de todas no mesmo mês, para o calendário, com as últimas marcadas
 * (o que o selo de «Assistentes» conta). Hora de Lisboa.
 *
 * Informação interna, sem efeito nenhum — o dono.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  const agora = new Date();
  const pedido = req.nextUrl.searchParams.get("mes");
  const mes = mesValido(pedido) ? pedido : primeiroDoMesEmLisboa(agora).slice(0, 7);

  try {
    const { deDia, ateDia } = diasALer(mes, agora);
    const [assistentes, blocos, agendas, ultimas] = await Promise.all([
      assistentesParaAPresenca(),
      blocosDePresencaEntre(inicioDoDiaEmLisboa(deDia), inicioDoDiaEmLisboa(ateDia)),
      agendasEntre(deDia, somarDiasAoDia(ateDia, -1)),
      ultimasMarcacoes(10),
    ]);

    return NextResponse.json(
      {
        mes,
        agora: agora.toISOString(),
        minutosSemInteraccao: MINUTOS_SEM_INTERACCAO,
        assistentes: assistentes.map((a) => ({
          ...a,
          ...resumoDaPresenca({
            blocos: blocos.filter((b) => b.colaboradorId === a.id),
            marcacoes: agendas.filter((m) => m.colaboradorId === a.id),
            mes,
            agora,
          }),
        })),
        agendas,
        ultimas,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[admin/presenca GET]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível ler a presença." }, { status: 500 });
  }
}
