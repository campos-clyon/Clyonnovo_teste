import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  filaWhatsAppPorEnviar,
  interromperNumeroWhatsApp,
  marcarFilaWhatsAppEnviadas,
  numeroBloqueadoWhatsApp,
  numeroInterrompidoWhatsApp,
  whatsappLigado,
} from "@/lib/db";
import { ponteConfigurada } from "@/lib/whatsapp-cloud";
import { pedidosDoTelefone, tratarMensagemDoCliente } from "@/lib/whatsapp-negociacao";

export const runtime = "nodejs";

/**
 * A ponte do Winapp — o WhatsApp emparelhado no PC a falar com o cérebro daqui.
 *
 * O servidor não chega ao PC (não tem endereço público): é o Winapp que vem
 * cá, com um segredo partilhado no cabeçalho. Três verbos:
 *
 *   POST  {telefone, texto} — chegou uma mensagem. Se o número TEM pedido
 *         activo, o cérebro trata-a e a resposta fica na fila; devolve-se
 *         {meu: true} e o que houver para enviar. Se NÃO tem, devolve-se
 *         {meu: false} e o site não mexe — a conversa é do bot local, que
 *         faz o trabalho dele: qualificar o contacto novo.
 *   GET   — o que está na fila por enviar.
 *   PATCH {ids} — estas saíram mesmo; risca-as. Só se risca por confirmação:
 *         se o Winapp cair entre buscar e enviar, a mensagem volta a sair na
 *         ronda seguinte em vez de se perder.
 *
 * O segredo compara-se em tempo constante, como a assinatura da Meta ao lado.
 */

function autorizado(req: NextRequest): boolean {
  const segredo = process.env.PONTE_WHATSAPP_SEGREDO;
  const cabecalho = req.headers.get("authorization") ?? "";
  if (!segredo || !cabecalho.startsWith("Bearer ")) return false;
  const dado = Buffer.from(cabecalho.slice("Bearer ".length));
  const esperado = Buffer.from(segredo);
  return dado.length === esperado.length && crypto.timingSafeEqual(dado, esperado);
}

function portao(req: NextRequest): NextResponse | null {
  if (!ponteConfigurada()) {
    return NextResponse.json({ error: "Ponte não configurada" }, { status: 503 });
  }
  if (!autorizado(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const erro = portao(req);
  if (erro) return erro;
  // Desligado no painel = nada sai, nem o que já estava na fila. A fila
  // espera; ligar outra vez solta-a — e o painel mostra o que lá está.
  if (!(await whatsappLigado())) return NextResponse.json({ paraEnviar: [] });
  return NextResponse.json({ paraEnviar: await filaWhatsAppPorEnviar() });
}

export async function POST(req: NextRequest) {
  const erro = portao(req);
  if (erro) return erro;

  let corpo: { telefone?: unknown; texto?: unknown; accao?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }
  const telefone = typeof corpo.telefone === "string" ? corpo.telefone.trim() : "";
  const texto = typeof corpo.texto === "string" ? corpo.texto : "";
  if (!telefone) {
    return NextResponse.json({ error: "Falta o telefone" }, { status: 400 });
  }

  // O Winapp a avisar: o dono respondeu À MÃO a este número. Responder à mão
  // é a forma mais natural de dizer "esta conversa é minha" — o cérebro
  // cala-se até alguém carregar em "Devolver ao site" no backoffice.
  if (corpo.accao === "interromper") {
    await interromperNumeroWhatsApp(telefone, "Respondeu à mão no WhatsApp");
    return NextResponse.json({ ok: true });
  }

  // Bloqueado ou desligado no painel: o site lava as mãos por inteiro — o
  // Winapp fica com a conversa e aplica as regras locais dele.
  if (!(await whatsappLigado()) || (await numeroBloqueadoWhatsApp(telefone))) {
    return NextResponse.json({ meu: false, paraEnviar: [] });
  }

  // A pergunta que decide quem fala: este número tem pedido activo?
  const pedidos = await pedidosDoTelefone(telefone);
  if (pedidos.length === 0) {
    return NextResponse.json({ meu: false, paraEnviar: [] });
  }

  // É cliente do site, mas a conversa está entregue a uma pessoa: o bot
  // local do Winapp também não a pode apanhar — {meu: true} cala-o — e o
  // cérebro daqui fica em silêncio até ser devolvida.
  if (await numeroInterrompidoWhatsApp(telefone)) {
    return NextResponse.json({ meu: true, paraEnviar: [] });
  }

  try {
    await tratarMensagemDoCliente(telefone, { tipo: "texto", texto });
  } catch (e) {
    // A conversa é nossa na mesma — um erro aqui não pode atirar o cliente
    // para o bot de leads, que lhe responderia como a um desconhecido.
    console.error("[whatsapp/ponte]", e);
  }
  return NextResponse.json({ meu: true, paraEnviar: await filaWhatsAppPorEnviar() });
}

export async function PATCH(req: NextRequest) {
  const erro = portao(req);
  if (erro) return erro;

  let corpo: { ids?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }
  const ids = Array.isArray(corpo.ids) ? corpo.ids.map(Number) : [];
  await marcarFilaWhatsAppEnviadas(ids);
  return NextResponse.json({ ok: true });
}
