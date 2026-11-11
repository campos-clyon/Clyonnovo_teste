import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { linkDeAdesaoGuardado } from "@/lib/convite-app-cliente-na-base";
import { CONVITES_POR_LOTE, INTERVALO_ENTRE_CONVITES_MS } from "@/lib/programa-da-app";
import {
  adicionadosParaConvidar,
  adicionadosPorConvidar,
  desfazerConviteDoPrograma,
  listaDoPrograma,
  marcarAdicionados,
  reservarConviteDoPrograma,
} from "@/lib/programa-da-app-na-base";
import { enviarConviteDoPrograma } from "@/lib/programa-da-app-envio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * O PROGRAMA DE ACESSO ANTECIPADO DA APP, NO BACKOFFICE — 11-11-2026.
 * Só o administrador (`requireAdminGeral`): são emails de clientes que vão
 * para a Play e um email que sai em nome da CLYON.
 *
 * GET                               → a lista e se há link de adesão nas Configs
 * POST marcar-adicionados { ids }   → `inscrito` → `adicionado`
 * POST convidar { ids? }            → até CONVITES_POR_LOTE `adicionado` recebem o
 *                                     email e passam a `convidado`; sem ids, todos
 *                                     os adicionados (o painel repete até acabar)
 */

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  try {
    const [inscricoes, link] = await Promise.all([listaDoPrograma(), linkDeAdesaoGuardado()]);
    return NextResponse.json({ inscricoes, temLink: link !== null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[admin/programa-da-app GET]", error);
    return NextResponse.json({ error: "Não foi possível ler o programa." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  const porQuem = String(colab?.nome ?? "admin");

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  try {
    if (corpo.accao === "marcar-adicionados") {
      const mudados = await marcarAdicionados(corpo.ids, porQuem);
      return NextResponse.json({ ok: true, mudados });
    }

    if (corpo.accao === "convidar") {
      const link = await linkDeAdesaoGuardado();
      if (!link) {
        return NextResponse.json(
          {
            error:
              "Falta o link de adesão da Play. Escreva-o em Configs → «Link do programa da app» e volte a enviar.",
          },
          { status: 400 },
        );
      }
      const lote = await adicionadosParaConvidar(corpo.ids, CONVITES_POR_LOTE);
      let enviados = 0;
      let falhados = 0;
      for (const [i, d] of lote.entries()) {
        if (i > 0) await espera(INTERVALO_ENTRE_CONVITES_MS);
        // Reservar ANTES: se outra chamada já o tem, esta não envia.
        if (!(await reservarConviteDoPrograma(d.id, porQuem))) continue;
        const ok = await enviarConviteDoPrograma({ para: d.email, linkDeAdesao: link });
        if (ok) enviados++;
        else {
          await desfazerConviteDoPrograma(d.id);
          falhados++;
        }
      }
      // Os que falharam voltam a `adicionado`: não contam como «restantes» desta volta.
      const restantes = falhados > 0 ? 0 : await adicionadosPorConvidar(corpo.ids);
      return NextResponse.json({ ok: true, enviados, falhados, restantes });
    }

    return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
  } catch (error) {
    console.error("[admin/programa-da-app POST]", error);
    return NextResponse.json({ error: "Não foi possível concluir." }, { status: 500 });
  }
}
