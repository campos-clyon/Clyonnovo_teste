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
import {
  estadoDoConviteNovo,
  libertarConviteNovo,
  marcarConviteNovoEnviado,
  porWhatsAppDaAppNaFila,
  reservarConviteNovo,
  whatsappsDaAppPorSair,
} from "@/lib/convite-novo-da-app-na-base";
import { ENVIOS_AO_GRUPO_DE_17_11_LIGADOS, TEXTO_DO_CONVITE_QUE_PEDE_O_GMAIL } from "@/lib/textos-do-seguimento-da-app";
import { linkNossoDoConvite } from "@/lib/percurso-da-app-cliente-na-base";
import { linkDoConviteDaApp } from "@/lib/percurso-da-app-cliente";
import { naoContactarNaApp } from "@/lib/nao-contactar-na-app";
import { urlDeAccao } from "@/lib/url-do-site";

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
 *
 * d59 (17-11-2026): só um Gmail vai para a Play. Uma conta com outro email fica
 * «falta o Gmail do telemóvel»: fora da lista e, enquanto o texto que pede o
 * Gmail não estiver aprovado (`TEXTO_DO_CONVITE_QUE_PEDE_O_GMAIL`), fora do
 * envio. Quem já está no programa da app segue por lá (não recebe dois convites).
 *
 * d59, parte 2 (17-11-2026, textos aprovados pelo dono):
 * POST enviar-convite-novo {} — o CONVITE NOVO (email + WhatsApp a quem tem
 *   telemóvel) a até ENVIOS_POR_LOTE contas com Gmail que ainda não aderiram,
 *   também as do convite de 01-11; cada email recebe-o uma vez
 *   (`conviteNovoDaApp`). O WhatsApp entra na fila própria e sai espaçado
 *   pela ponte (`convite-novo-da-app-na-base.ts`). O painel repete até acabar.
 * POST enviar-lote {} — agora só as contas SEM Gmail ainda não convidadas:
 *   o mesmo convite, que lhes pede o Gmail do telemóvel. As com Gmail vão
 *   pelo convite novo (nunca pelos dois caminhos).
 *
 * d106 (24-11-2026): o link do convite é o NOSSO, um por pessoa
 * (`linkNossoDoConvite` → /app-cliente?c=<código>), que mostra o caminho
 * certo para o aparelho e leva à Play; a ligação da Play continua a ter de
 * estar guardada (é para lá que a página manda). O envio de prova vai sem
 * código. Ficam de fora (e não entopem o lote) quem está no «não contactar»
 * ou tem um pedido cancelado (`naoContactarNaApp`, Jurídico).
 */

type Destinatario = Awaited<ReturnType<typeof estadoDosConvites>>["destinatarios"][number];

/** Pronto para a lista da Play: Gmail e fora do programa. */
const prontoParaAPlay = (d: Destinatario) => d.gmail && !d.noPrograma;
/** Sem Gmail e fora do programa: falta o Gmail do telemóvel. */
const faltaOGmail = (d: Destinatario) => !d.gmail && !d.noPrograma;
/** Pelo «enviar-lote»: só quem não tem Gmail, ainda sem convite (o convite que pede o Gmail). */
const podeReceber = (d: Destinatario) =>
  !d.registado && faltaOGmail(d) && TEXTO_DO_CONVITE_QUE_PEDE_O_GMAIL !== null;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  try {
    const estado = await estadoDosConvites();

    if (req.nextUrl.searchParams.get("csv") === "1") {
      return new NextResponse(csvParaAPlay(estado.destinatarios.filter(prontoParaAPlay).map((d) => d.email)), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="testadores-app-cliente.csv"',
          "Cache-Control": "no-store",
        },
      });
    }

    const link = await linkDeAdesaoGuardado();
    const novo = await estadoDoConviteNovo();
    return NextResponse.json({
      link,
      // O convite novo (d59, 17-11-2026): só contagens, nunca emails nem telefones.
      conviteNovo: {
        emails: novo.emails,
        whatsapps: novo.whatsapps,
        jaReceberam: novo.jaReceberam,
        whatsappsPorSair: await whatsappsDaAppPorSair(),
      },
      destinatarios: estado.destinatarios.length,
      porEnviar: estado.destinatarios.filter(podeReceber).length,
      paraAPlay: estado.destinatarios.filter(prontoParaAPlay).length,
      faltaGmail: estado.destinatarios.filter((d) => !d.registado && faltaOGmail(d)).length,
      noPrograma: estado.destinatarios.filter((d) => d.noPrograma).length,
      conviteQuePedeOGmailPronto: TEXTO_DO_CONVITE_QUE_PEDE_O_GMAIL !== null,
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
          { error: "A ligação tem de ser da Google Play (https://play.google.com/…)." },
          { status: 400 },
        );
      }
      await guardarLinkDeAdesao(link, porQuem);
      return NextResponse.json({ ok: true, link });
    }

    const link = await linkDeAdesaoGuardado();
    if (!link) {
      return NextResponse.json({ error: "Guarde primeiro a ligação de adesão da Play." }, { status: 400 });
    }

    if (corpo.accao === "so-para-mim") {
      const email = typeof corpo.email === "string" ? corpo.email.trim() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Escreva o seu email." }, { status: 400 });
      }
      const ok = await enviarConviteDaApp({ para: email, nome: porQuem, link: linkDoConviteDaApp(urlDeAccao(), null) });
      return ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: "O serviço de email recusou o envio." }, { status: 502 });
    }

    // d106 (24-11-2026): o convite e o lembrete ao grupo de 17/11 esperam pelo advogado — desligados.
    if (["enviar-convite-novo", "enviar-lote"].includes(String(corpo.accao)) && !ENVIOS_AO_GRUPO_DE_17_11_LIGADOS) {
      return NextResponse.json(
        { error: "O convite ao grupo de 17/11 está desligado (à espera do advogado). Não saiu nada." },
        { status: 409 },
      );
    }

    if (corpo.accao === "enviar-convite-novo") {
      const estado = await estadoDoConviteNovo();
      const lote: typeof estado.elegiveis = [];
      let foraPorNaoContactar = 0;
      for (const d of estado.elegiveis) {
        if (lote.length >= ENVIOS_POR_LOTE) break;
        if (await naoContactarNaApp({ email: d.email, telefone: d.telemovel ?? undefined })) {
          foraPorNaoContactar++;
          continue;
        }
        lote.push(d);
      }
      let enviados = 0;
      let falhados = 0;
      let whatsappsNaFila = 0;
      for (const [i, d] of lote.entries()) {
        if (i > 0) await espera(INTERVALO_ENTRE_ENVIOS_MS);
        // Reservar ANTES: se outra chamada já o tem, esta não envia (a chave é o email).
        if (!(await reservarConviteNovo(d.email, d.id, porQuem))) continue;
        // Quem nunca foi convidado fica também no registo de 01-11 (é por lá que o seguimento o vê).
        const registouAgora = !d.registado && (await reservarConvite(d.id, d.email, porQuem));
        const ok = await enviarConviteDaApp({ para: d.email, nome: d.nome, link: await linkNossoDoConvite(d.email, d.id) });
        if (!ok) {
          await libertarConviteNovo(d.email);
          if (registouAgora) await libertarConvite(d.id);
          falhados++;
          continue;
        }
        await marcarConviteNovoEnviado(d.email);
        if (registouAgora) await marcarConviteEnviado(d.id);
        enviados++;
        if (d.telemovel && (await porWhatsAppDaAppNaFila(d.email, "convite"))) whatsappsNaFila++;
      }
      const restantes = Math.max(0, estado.elegiveis.length - lote.length - foraPorNaoContactar);
      return NextResponse.json({ ok: true, enviados, falhados, whatsappsNaFila, restantes, foraPorNaoContactar });
    }

    if (corpo.accao === "enviar-lote") {
      const estado = await estadoDosConvites();
      const porEnviar = estado.destinatarios.filter(podeReceber);
      const lote: typeof porEnviar = [];
      let foraPorNaoContactar = 0;
      for (const d of porEnviar) {
        if (lote.length >= ENVIOS_POR_LOTE) break;
        if (await naoContactarNaApp({ email: d.email })) {
          foraPorNaoContactar++;
          continue;
        }
        lote.push(d);
      }
      let enviados = 0;
      let falhados = 0;
      for (const [i, d] of lote.entries()) {
        if (i > 0) await espera(INTERVALO_ENTRE_ENVIOS_MS);
        // Reservar ANTES: se outra chamada já a tem, esta não envia.
        if (!(await reservarConvite(d.id, d.email, porQuem))) continue;
        // O mesmo convite novo: já traz o parágrafo que pede o Gmail do telemóvel.
        const ok = await enviarConviteDaApp({ para: d.email, nome: d.nome, link: await linkNossoDoConvite(d.email, d.id) });
        if (ok) {
          await marcarConviteEnviado(d.id);
          enviados++;
        } else {
          await libertarConvite(d.id);
          falhados++;
        }
      }
      const restantes = Math.max(0, porEnviar.length - lote.length - foraPorNaoContactar);
      return NextResponse.json({ ok: true, enviados, falhados, restantes, foraPorNaoContactar });
    }

    return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (error) {
    console.error("[admin/convite-app-cliente POST]", error);
    return NextResponse.json({ error: "Não foi possível concluir." }, { status: 500 });
  }
}
