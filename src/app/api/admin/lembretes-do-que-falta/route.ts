import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import {
  ensaioDoQueFalta,
  interruptorDoQueFalta,
  mudarInterruptorDoQueFalta,
  MOTIVOS_DE_FORA,
} from "@/lib/lembrete-do-que-falta-na-base";
import { FALTAS_DE_EXEMPLO, PEDIDO_DE_EXEMPLO, textoDoPasso } from "@/lib/lembrete-do-que-falta";
import { mensagemDeCancelamento } from "@/lib/mensagens-das-fases";
import { instanteEmLisboa } from "@/lib/hora-de-lisboa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OS LEMBRETES DO QUE FALTA, NAS CONFIGS — d71, 19-11-2026.
 *
 * GET: o interruptor, os textos tal como saem (com um pedido inventado, às 10h
 * de Lisboa) e o ENSAIO — quem entraria agora (só o número do pedido, o canal e
 * quantas faltas), os ciclos a correr e quantos ficam de fora, por motivo. Só lê.
 *
 * POST: liga ou desliga. DESLIGADO POR OMISSÃO: são mensagens automáticas a
 * clientes, cancelamentos e arquivos. Só o administrador, e para LIGAR
 * escreve-se «LIGAR». A mudança e quem a fez ficam no registo permanente.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  const as10 = instanteEmLisboa("2026-11-19T10:00") ?? new Date();
  const textos = {
    lembrete1: textoDoPasso("lembrete1", PEDIDO_DE_EXEMPLO, FALTAS_DE_EXEMPLO, as10),
    lembrete2: textoDoPasso("lembrete2", PEDIDO_DE_EXEMPLO, FALTAS_DE_EXEMPLO, as10),
    lembrete3: textoDoPasso("lembrete3", PEDIDO_DE_EXEMPLO, FALTAS_DE_EXEMPLO, as10),
    arquivo: textoDoPasso("arquivar", PEDIDO_DE_EXEMPLO, FALTAS_DE_EXEMPLO, as10),
    cancelamento: mensagemDeCancelamento(),
  };
  try {
    const ensaio = await ensaioDoQueFalta(new Date());
    return NextResponse.json({ ...(await interruptorDoQueFalta()), textos, ensaio, motivos: MOTIVOS_DE_FORA });
  } catch (e) {
    console.error("[admin/lembretes-do-que-falta]", e);
    return NextResponse.json({ ...(await interruptorDoQueFalta()), textos, ensaio: null, motivos: MOTIVOS_DE_FORA });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  let corpo: { ligar?: unknown; confirmacao?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (typeof corpo.ligar !== "boolean") {
    return NextResponse.json({ error: "Falta dizer se é para ligar ou desligar." }, { status: 400 });
  }
  if (corpo.ligar && String(corpo.confirmacao ?? "").trim().toUpperCase() !== "LIGAR") {
    return NextResponse.json({ error: "Para ligar, escreva LIGAR." }, { status: 400 });
  }
  try {
    return NextResponse.json(await mudarInterruptorDoQueFalta(corpo.ligar, colab?.nome?.trim() || "administrador"));
  } catch (e) {
    console.error("[admin/lembretes-do-que-falta POST]", e);
    return NextResponse.json({ error: "Não foi possível mudar o interruptor." }, { status: 500 });
  }
}
