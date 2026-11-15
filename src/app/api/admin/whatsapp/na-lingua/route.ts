import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * A MENSAGEM NA LÍNGUA DO CLIENTE, PARA OS LINKS DO WHATSAPP — 15-11-2026 (d47).
 *
 * O #623: o cliente fala inglês; o «Enviar proposta ao cliente» (o link, que
 * abre o WhatsApp de quem está ao backoffice) levou a mensagem em PORTUGUÊS,
 * e a mesma proposta saiu a seguir em inglês pelo número da CLYON — duas
 * mensagens, uma em cada língua. O canal da CLYON já traduz; os links não.
 *
 * Aqui traduz-se o texto para a língua gravada para o número — a mesma do
 * canal (`traduzirParaOCliente`: o Gemini, as traduções fixas, e só em último
 * caso o português). Português fica igual. NÃO ENVIA NADA: devolve o texto,
 * e quem carrega no botão é que o manda, do WhatsApp dele.
 */
export async function POST(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }
  const telefone = typeof corpo.telefone === "string" ? corpo.telefone : "";
  const texto = typeof corpo.texto === "string" ? corpo.texto.slice(0, 4000) : "";
  if (!texto.trim()) return NextResponse.json({ error: "Sem texto." }, { status: 400 });
  try {
    const { linguaDoNumero } = await import("@/lib/db");
    const lingua = telefone.replace(/\D/g, "").length >= 9 ? await linguaDoNumero(telefone) : null;
    if (!lingua || lingua === "pt") return NextResponse.json({ ok: true, texto, lingua: "pt" });
    const { traduzirParaOCliente } = await import("@/lib/traduzir-para-o-cliente");
    const traduzido = await traduzirParaOCliente(texto, lingua);
    return NextResponse.json({ ok: true, texto: traduzido, lingua, traduzido: traduzido !== texto });
  } catch (e) {
    console.error("[admin/whatsapp/na-lingua]", e);
    // Sem tradução, o texto como está — o botão abre na mesma.
    return NextResponse.json({ ok: true, texto, lingua: null });
  }
}
