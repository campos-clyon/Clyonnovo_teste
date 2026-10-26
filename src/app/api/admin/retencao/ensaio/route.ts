import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { interruptorDasRegrasNovas } from "@/lib/db";
import { purgaArmada } from "@/lib/retencao";
import { regrasNovasDaNoite } from "@/lib/regras-novas-na-base";
import {
  DIAS_ATE_ANONIMIZAR_OS_TRABALHOS,
  DIAS_DO_TELEMOVEL_NAS_REGRAS_NOVAS,
  DIAS_DOS_CONTACTOS,
  DIAS_DOS_FICHEIROS_ORFAOS,
  DIAS_DOS_REJEITADOS,
} from "@/lib/regras-novas-da-retencao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Lê o Blob inteiro e o texto da base: pode levar umas dezenas de segundos.
export const maxDuration = 120;

/**
 * O MODO SECO DAS REGRAS NOVAS — 26-10-2026 (d32).
 *
 * *«No fim, corre o MODO SECO (só leitura) e diz-me os números que as regras
 * novas dariam hoje, por categoria.»*
 *
 * ESTA ROTA NÃO MUDA NADA, E NÃO PODE: chama `regrasNovasDaNoite` com
 * `aSerio: false` escrito aqui, à letra — não lê o interruptor para decidir.
 * Ligado ou desligado, o que o painel mostra é sempre a contagem.
 *
 * À parte do GET da retenção porque é pesada (lista o Blob e procura cada
 * ficheiro no texto da base) e esse refresca-se sozinho de minuto a minuto.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    const [ensaio, interruptor] = await Promise.all([
      regrasNovasDaNoite({ aSerio: false }),
      interruptorDasRegrasNovas(),
    ]);
    return NextResponse.json({
      armada: purgaArmada(),
      interruptor,
      prazos: {
        anonimizar: DIAS_ATE_ANONIMIZAR_OS_TRABALHOS,
        orfaos: DIAS_DOS_FICHEIROS_ORFAOS,
        contactos: DIAS_DOS_CONTACTOS,
        rejeitados: DIAS_DOS_REJEITADOS,
        telemovel: DIAS_DO_TELEMOVEL_NAS_REGRAS_NOVAS,
      },
      ensaio,
    });
  } catch (error) {
    console.error("[admin/retencao/ensaio]", error);
    return NextResponse.json({ error: "Não foi possível contar as regras novas." }, { status: 500 });
  }
}
