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
import { estadoDosConvites } from "@/lib/convite-app-cliente-na-base";
import { instanteDaBase } from "@/lib/hora-de-lisboa";
import { DIAS_ATE_AO_LEMBRETE, inscritoParado, listaParaAPlay } from "@/lib/seguimento-da-app";
import { convidadosDoSeguimento, marcarInstalou } from "@/lib/seguimento-da-app-na-base";
import { estadoDoLembrete } from "@/lib/lembrete-da-app";

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
 * POST marcar-instalou { email, sim } → a marca «Já instalou» de um convidado (d59)
 *
 * d59 (17-11-2026): o GET leva também a lista pronta para a Play (inscritos +
 * contas novas com Gmail, `listaParaAPlay`), os inscritos parados há mais de
 * 24 h, os convidados (aderiram?) e o estado do lembrete.
 */

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  try {
    const [inscricoes, link, convites, convidados] = await Promise.all([
      listaDoPrograma(),
      linkDeAdesaoGuardado(),
      estadoDosConvites(),
      convidadosDoSeguimento(),
    ]);
    const agora = new Date();
    const parados = inscricoes.filter((l) =>
      inscritoParado({ estado: l.estado, consentimentoEm: instanteDaBase(l.consentimentoEm) }, agora),
    ).length;
    const paraAPlay = listaParaAPlay(
      inscricoes,
      convites.destinatarios.filter((d) => !d.registado && !d.noPrograma),
    );
    return NextResponse.json(
      {
        inscricoes,
        temLink: link !== null,
        parados,
        paraAPlay,
        convidados,
        lembrete: { ...estadoDoLembrete(), dias: DIAS_ATE_AO_LEMBRETE },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
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

    if (corpo.accao === "marcar-instalou") {
      const ok = await marcarInstalou(corpo.email, corpo.sim !== false, porQuem);
      if (!ok) return NextResponse.json({ error: "Esse email não está entre os convidados." }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (corpo.accao === "convidar") {
      const link = await linkDeAdesaoGuardado();
      if (!link) {
        return NextResponse.json(
          {
            error:
              "Falta a ligação de adesão da Play. Escreva-a em Configs → «Ligação do programa da app» e volte a enviar.",
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

    return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (error) {
    console.error("[admin/programa-da-app POST]", error);
    return NextResponse.json({ error: "Não foi possível concluir." }, { status: 500 });
  }
}
