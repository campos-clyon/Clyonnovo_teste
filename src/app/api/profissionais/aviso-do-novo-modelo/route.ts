import { NextResponse } from "next/server";
import { CAMINHO_DO_SABER_MAIS, FAIXA_DO_PAINEL } from "@/lib/aviso-aos-profissionais";
import { interruptorDoAviso } from "@/lib/aviso-aos-profissionais-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A FAIXA DO AVISO DO NOVO MODELO NO PAINEL — d11 (15-11-2026).
 *
 * Diz só se a faixa aparece (o interruptor «Mostrar o aviso do novo modelo»
 * das Configs, desligado por omissão) e o que ela diz. Não lê nada da conta:
 * é igual para todos.
 */
export async function GET() {
  const { ligado } = await interruptorDoAviso();
  return NextResponse.json(
    ligado ? { mostrar: true, faixa: FAIXA_DO_PAINEL, saberMais: CAMINHO_DO_SABER_MAIS } : { mostrar: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
