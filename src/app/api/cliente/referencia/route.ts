import { NextRequest, NextResponse } from "next/server";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { lerPedidoParaReferencia, referenciaDoPedido } from "@/lib/preco-de-referencia";

export const runtime = "nodejs";

/**
 * R12 — O PREÇO DE REFERÊNCIA PARA A APP DE CLIENTE (S13, 29-10-2026).
 *
 * Pública (o simulador da app mostra o preço sem conta) e com travão por
 * endereço. Devolve as MESMAS frases que o simulador do site mostra, tiradas
 * de `preco-de-referencia.ts`: a app não tem números, taxas nem IVA no código.
 * Nunca o motor (`/api/simulator/analyze`).
 *
 * Adaptativa desde 03-11-2026 (d1): lê tudo o que o simulador sabe — o
 * entulho pela quantidade, a tipologia do esvaziamento, a manutenção, o andar,
 * o elevador, o estacionamento e a localidade — e devolve também `porque`,
 * as linhas curtas que dizem porque é esta a referência. O corpo antigo
 * continua a valer (há telemóveis com a versão de hoje).
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "cliente-referencia", 60, 300);
  if (limite.erro) return limite.erro;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  const pedido = lerPedidoParaReferencia(corpo);
  if (!pedido) return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });

  const { linhas, nota, conta, porque } = referenciaDoPedido(pedido);
  return NextResponse.json({ ok: true, linhas, nota, conta, porque });
}
