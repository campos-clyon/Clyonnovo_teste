import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import {
  ENVIOS_POR_LOTE,
  INTERVALO_ENTRE_ENVIOS_MS,
  csvParaAPlay,
  linkDeAdesaoValido,
  primeiroNome,
} from "@/lib/convite-app-cliente";
import {
  estadoDosConvites,
  guardarLinkDeAdesao,
  libertarConvite,
  linkDeAdesaoGuardado,
  marcarConviteEnviado,
  reservarConvite,
} from "@/lib/convite-app-cliente-na-base";
import { enviarConviteDaApp } from "@/lib/convite-app-cliente-envio";

export const runtime = "nodejs";
export const maxDuration = 60;

/*
 * O CONVITE PARA TESTAR A APP DE CLIENTE — 01-11-2026. Só o administrador
 * (`requireAdminGeral`): é um email a todas as contas de cliente.
 *
 * GET              → o link guardado, quantos recebem, quantos já receberam,
 *                    quem ficou de fora e o primeiro nome para a pré-visualização
 * GET ?csv=1       → os emails, um por linha, para a lista de testadores da Play
 * POST guardar-link   { link }
 * POST so-para-mim    { email }  — um envio de prova; não regista nem conta
 * POST enviar-lote    {}         — até ENVIOS_POR_LOTE contas ainda por convidar;
 *                                  o painel repete até não sobrar nenhuma
 */

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  try {
    const estado = await estadoDosConvites();

    if (req.nextUrl.searchParams.get("csv") === "1") {
      return new NextResponse(csvParaAPlay(estado.destinatarios.map((d) => d.email)), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="testadores-app-cliente.csv"',
          "Cache-Control": "no-store",
        },
      });
    }

    const link = await linkDeAdesaoGuardado();
    return NextResponse.json({
      link,
      destinatarios: estado.destinatarios.length,
      porEnviar: estado.destinatarios.filter((d) => !d.registado).length,
      jaReceberam: estado.destinatarios.filter((d) => d.enviadoEm).length,
      enviadosNoTotal: estado.enviados,
      deFora: estado.deFora,
      // Só o primeiro nome, para a pré-visualização — nunca o email.
      nomeDaPrimeira: primeiroNome(estado.destinatarios[0]?.nome ?? null),
    });
  } catch (error) {
    console.error("[admin/convite-app-cliente GET]", error);
    return NextResponse.json({ error: "Não foi possível ler as contas." }, { status: 500 });
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
    if (corpo.accao === "guardar-link") {
      const link = linkDeAdesaoValido(corpo.link);
      if (!link) {
        return NextResponse.json(
          { error: "O link tem de ser da Google Play (https://play.google.com/…)." },
          { status: 400 },
        );
      }
      await guardarLinkDeAdesao(link, porQuem);
      return NextResponse.json({ ok: true, link });
    }

    const link = await linkDeAdesaoGuardado();
    if (!link) {
      return NextResponse.json({ error: "Guarde primeiro o link de adesão da Play." }, { status: 400 });
    }

    if (corpo.accao === "so-para-mim") {
      const email = typeof corpo.email === "string" ? corpo.email.trim() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Escreva o seu email." }, { status: 400 });
      }
      const ok = await enviarConviteDaApp({ para: email, nome: porQuem, link });
      return ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: "O serviço de email recusou o envio." }, { status: 502 });
    }

    if (corpo.accao === "enviar-lote") {
      const estado = await estadoDosConvites();
      const lote = estado.destinatarios.filter((d) => !d.registado).slice(0, ENVIOS_POR_LOTE);
      let enviados = 0;
      let falhados = 0;
      for (const [i, d] of lote.entries()) {
        if (i > 0) await espera(INTERVALO_ENTRE_ENVIOS_MS);
        // Reservar ANTES: se outra chamada já a tem, esta não envia.
        if (!(await reservarConvite(d.id, d.email, porQuem))) continue;
        const ok = await enviarConviteDaApp({ para: d.email, nome: d.nome, link });
        if (ok) {
          await marcarConviteEnviado(d.id);
          enviados++;
        } else {
          await libertarConvite(d.id);
          falhados++;
        }
      }
      const restantes = Math.max(0, estado.destinatarios.filter((d) => !d.registado).length - lote.length);
      return NextResponse.json({ ok: true, enviados, falhados, restantes });
    }

    return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
  } catch (error) {
    console.error("[admin/convite-app-cliente POST]", error);
    return NextResponse.json({ error: "Não foi possível concluir." }, { status: 500 });
  }
}
