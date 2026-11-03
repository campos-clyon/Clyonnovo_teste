import { NextRequest, NextResponse } from "next/server";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { checkRateLimit } from "@/lib/rate-limit";
import { lerOPedido, lerPedidoParaOLeitor } from "@/lib/ler-pedido-pelo-modelo";

export const runtime = "nodejs";
// O modelo tem 15 s e, fora do formato, mais 10; as fotografias abrem-se em 5.
export const maxDuration = 40;

/**
 * O LEITOR DO PEDIDO PARA A APP DE CLIENTE — 03-11-2026 (decisão d1 v1).
 *
 * Pública (o simulador da app abre sem conta) e com travão por endereço,
 * como a R12. Recebe o serviço, a descrição, as respostas já dadas e até 6
 * fotografias do nosso armazenamento, e devolve sugestões para os campos da
 * categoria, cada uma com a confiança e a frase que a justifica. Nunca um
 * preço: esse é da R12, pelas respostas que o cliente confirmar. Ver
 * `ler-pedido-pelo-modelo.ts`.
 *
 * Cada chamada é uma chamada ao Gemini: 20 por endereço a cada 10 minutos, e
 * um tecto do dia para a plataforma toda — passado o tecto, a resposta vem
 * vazia (a app segue com as perguntas) e fica anotado na consola.
 */
const POR_ENDERECO = 20;
const JANELA_DO_ENDERECO = 10 * 60;
const POR_DIA = 600;

export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "cliente-ler-pedido", POR_ENDERECO, JANELA_DO_ENDERECO);
  if (limite.erro) return limite.erro;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  const pedido = lerPedidoParaOLeitor(corpo);
  if (!pedido) return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });

  const doDia = await checkRateLimit("cliente-ler-pedido:plataforma", POR_DIA, 24 * 60 * 60);
  if (!doDia.allowed) {
    console.error(`[ler-pedido] tecto do dia (${POR_DIA}) atingido — a app segue sem sugestões`);
    return NextResponse.json(
      { ok: true, sugestoes: [], nasFotografias: null, fotografias: { recebidas: pedido.fotografiasRecebidas, vistas: 0 } },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const { leitura, uso } = await lerOPedido(pedido);
  const cabecalhos: Record<string, string> = { "Cache-Control": "no-store" };
  // Diagnóstico do custo (não faz parte do contrato): o que a chamada gastou.
  if (uso) cabecalhos["x-leitura-tokens"] = `entrada=${uso.entrada}; saida=${uso.saida}; pensamento=${uso.pensamento}; ms=${uso.ms}`;
  return NextResponse.json(leitura, { headers: cabecalhos });
}
