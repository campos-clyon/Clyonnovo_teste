import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  bloquearNumeroWhatsApp,
  conversasWhatsApp,
  definirWhatsappLigado,
  desbloquearNumeroWhatsApp,
  filaWhatsAppPorEnviar,
  interromperNumeroWhatsApp,
  listarNumerosBloqueadosWhatsApp,
  listarNumerosInterrompidosWhatsApp,
  marcarFilaWhatsAppEnviadas,
  mensagemDaFilaWhatsApp,
  mensagensDoNumeroWhatsApp,
  registarMensagemWhatsApp,
  retomarNumeroWhatsApp,
  whatsappLigado,
} from "@/lib/db";
import {
  canalWhatsApp,
  enviarTextoManualWhatsApp,
  linkParaEnviarAMao,
  linkParaEnviarNoWhatsAppWeb,
  numeroManualWhatsApp,
} from "@/lib/whatsapp-cloud";
import { tratarMensagemDoCliente } from "@/lib/whatsapp-negociacao";

export const runtime = "nodejs";

/**
 * O painel de controlo do WhatsApp da plataforma.
 *
 * O mesmo poder que o dono tem no Winapp, mas sobre o cérebro DAQUI:
 * desligar tudo com um gesto, entregar uma conversa a uma pessoa (e
 * devolvê-la), bloquear um contacto pessoal para sempre. O estado vive na
 * base — a Meta e a ponte do Winapp respeitam-no os dois, porque todos os
 * envios e todas as respostas perguntam primeiro ao mesmo sítio.
 */

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  // Com ?telefone= devolve-se a conversa desse número — o fio inteiro.
  const telefone = req.nextUrl.searchParams.get("telefone");
  if (telefone) {
    return NextResponse.json({ mensagens: await mensagensDoNumeroWhatsApp(telefone) });
  }

  const [ligado, interrompidos, bloqueados, fila, conversas] = await Promise.all([
    whatsappLigado(),
    listarNumerosInterrompidosWhatsApp(),
    listarNumerosBloqueadosWhatsApp(),
    filaWhatsAppPorEnviar(50),
    conversasWhatsApp(),
  ]);
  return NextResponse.json({
    ligado,
    // "meta", "ponte", "manual" (o número da CLYON à mão, sem API) ou "nenhum".
    canal: canalWhatsApp(),
    numeroManual: numeroManualWhatsApp(),
    interrompidos,
    bloqueados,
    fila,
    conversas,
  });
}

export async function POST(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  let corpo: { accao?: unknown; telefone?: unknown; nota?: unknown; id?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const accao = typeof corpo.accao === "string" ? corpo.accao : "";
  const telefone = typeof corpo.telefone === "string" ? corpo.telefone : "";
  const nota = typeof corpo.nota === "string" ? corpo.nota : undefined;

  // Responder à mão. Passa por cima do interruptor e das entregas de
  // propósito — quem escreve aqui É a pessoa. Se não sair, a razão mais
  // comum é a janela de 24 h do WhatsApp estar fechada.
  if (accao === "responder") {
    const texto = typeof corpo.nota === "string" ? corpo.nota.trim() : "";
    if (!texto || telefone.replace(/\D/g, "").length < 9) {
      return NextResponse.json({ error: "Falta o número ou o texto." }, { status: 400 });
    }
    // À mão, sem API: a resposta não sai daqui — devolve-se o link que abre
    // o WhatsApp do número da CLYON com o texto pronto, e regista-se no fio
    // porque quem carregou vai enviá-la.
    if (canalWhatsApp() === "manual") {
      await registarMensagemWhatsApp(telefone, "out", texto);
      return NextResponse.json({
        ok: true,
        manual: true,
        link: linkParaEnviarAMao(telefone, texto),
        linkWeb: linkParaEnviarNoWhatsAppWeb(telefone, texto),
      });
    }
    const saiu = await enviarTextoManualWhatsApp(telefone, texto);
    if (!saiu) {
      return NextResponse.json(
        {
          error:
            "Não saiu. Ou não há canal configurado, ou a janela de 24 horas " +
            "desde a última mensagem dele já fechou — nesse caso só um template aprovado passa.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  /*
   * CHEGOU UMA RESPOSTA — lida no WhatsApp Web e colada aqui.
   *
   * Sem API não há webhook; este é o webhook à mão. O texto entra pelo
   * mesmo caminho da Meta e da ponte: regista-se no fio como recebido e o
   * cérebro trata-o (é ele que decide se pode falar com este número — ligado,
   * não bloqueado, não entregue, com pedido activo). O que ele responder
   * fica na fila, para sair pelo WhatsApp Web com um clique.
   */
  if (accao === "recebida") {
    const texto = typeof corpo.nota === "string" ? corpo.nota.trim() : "";
    if (!texto || telefone.replace(/\D/g, "").length < 9) {
      return NextResponse.json({ error: "Falta o número ou o texto." }, { status: 400 });
    }
    await registarMensagemWhatsApp(telefone, "in", texto).catch(() => {});
    try {
      await tratarMensagemDoCliente(telefone, { tipo: "texto", texto });
    } catch (e) {
      console.error("[admin/whatsapp recebida]", e);
      return NextResponse.json(
        { error: "Ficou registada, mas o cérebro não conseguiu tratá-la. Responda à mão." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, fila: await filaWhatsAppPorEnviar(50) });
  }

  // A fila, à mão: "enviada" risca a mensagem e põe-na no fio da conversa
  // como saída; "descartar" risca-a sem a registar — não chegou a sair.
  if (accao === "enviada" || accao === "descartar") {
    const id = Number(corpo.id);
    const mensagem = await mensagemDaFilaWhatsApp(id);
    if (!mensagem) {
      return NextResponse.json({ error: "Essa mensagem já não está na fila." }, { status: 404 });
    }
    await marcarFilaWhatsAppEnviadas([mensagem.id]);
    if (accao === "enviada") {
      await registarMensagemWhatsApp(mensagem.telefone, "out", mensagem.texto);
    }
    return NextResponse.json({ ok: true });
  }

  try {
    switch (accao) {
      case "ligar":
        await definirWhatsappLigado(true);
        break;
      case "desligar":
        await definirWhatsappLigado(false);
        break;
      case "bloquear":
        await bloquearNumeroWhatsApp(telefone, nota);
        break;
      case "desbloquear":
        await desbloquearNumeroWhatsApp(telefone);
        break;
      case "interromper":
        await interromperNumeroWhatsApp(telefone, nota ?? "Pelo backoffice");
        break;
      case "retomar":
        await retomarNumeroWhatsApp(telefone);
        break;
      default:
        return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
