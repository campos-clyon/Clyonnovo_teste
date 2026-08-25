import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  bloquearNumeroWhatsApp,
  definirWhatsappLigado,
  desbloquearNumeroWhatsApp,
  filaWhatsAppPorEnviar,
  interromperNumeroWhatsApp,
  listarNumerosBloqueadosWhatsApp,
  listarNumerosInterrompidosWhatsApp,
  retomarNumeroWhatsApp,
  whatsappLigado,
} from "@/lib/db";
import { ponteConfigurada, whatsappConfigurado } from "@/lib/whatsapp-cloud";

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

  const [ligado, interrompidos, bloqueados, fila] = await Promise.all([
    whatsappLigado(),
    listarNumerosInterrompidosWhatsApp(),
    listarNumerosBloqueadosWhatsApp(),
    filaWhatsAppPorEnviar(50),
  ]);
  return NextResponse.json({
    ligado,
    canal: whatsappConfigurado() ? "meta" : ponteConfigurada() ? "ponte" : "nenhum",
    interrompidos,
    bloqueados,
    fila,
  });
}

export async function POST(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  let corpo: { accao?: unknown; telefone?: unknown; nota?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const accao = typeof corpo.accao === "string" ? corpo.accao : "";
  const telefone = typeof corpo.telefone === "string" ? corpo.telefone : "";
  const nota = typeof corpo.nota === "string" ? corpo.nota : undefined;

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
