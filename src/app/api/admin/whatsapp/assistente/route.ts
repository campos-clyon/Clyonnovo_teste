import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminGeral } from "@/lib/admin-auth-helper";
import {
  avisosDoAssistente,
  definirInterruptorDoAssistente,
  desfazerFechoDoAssistente,
  fechosDesfaziveis,
  interruptoresDoAssistente,
} from "@/lib/db";
import { correrOAssistente } from "@/lib/assistente-automatico";

export const runtime = "nodejs";

/**
 * O ECRÃ DO ASSISTENTE — o que ele pode fazer, e o que já fez.
 *
 * Vive numa rota à parte da do painel do WhatsApp de propósito. A rota do
 * painel já faz sete consultas em paralelo e é refrescada de trinta em trinta
 * segundos por cada separador aberto; enfiar aqui mais três consultas
 * dobrava-lhe o custo por minuto e por pessoa, para mostrar um separador que
 * quase nunca está aberto. Só é pedida quando alguém abre o separador do
 * assistente.
 *
 * LER é de quem tem a secção do WhatsApp; MEXER é só do administrador. Um
 * interruptor que muda o que a plataforma diz a clientes reais, e um "não era
 * isto" que desfaz um negócio de centenas de euros, são decisões do dono — não
 * de quem está a atender.
 */
export async function GET(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  const [interruptores, avisos, desfaziveis] = await Promise.all([
    interruptoresDoAssistente(),
    avisosDoAssistente(60).catch(() => []),
    fechosDesfaziveis().catch(() => []),
  ]);

  return NextResponse.json({
    interruptores,
    avisos,
    // Só os que ainda estão dentro da janela: mostrar um botão que vai recusar
    // é pior do que não mostrar botão nenhum.
    desfaziveis: desfaziveis.filter((d) => d.aTempo),
    podeMexer: colab.papel === "admin",
  });
}

export async function POST(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: { accao?: unknown; capacidade?: unknown; ligado?: unknown; id?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const accao = typeof corpo.accao === "string" ? corpo.accao : "";

  if (accao === "interruptor") {
    const capacidade = typeof corpo.capacidade === "string" ? corpo.capacidade : "";
    const ligado = corpo.ligado === true;
    try {
      await definirInterruptorDoAssistente(capacidade, ligado, "backoffice");
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Não foi possível." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, interruptores: await interruptoresDoAssistente() });
  }

  /*
   * CORRER AGORA — para não se esperar dez minutos para ver se funciona.
   *
   * É a mesma passagem que o cron faz, com as mesmas guardas: os interruptores
   * mandam na mesma, a chave única impede repetições na mesma, e a hora a que
   * o assistente se cala continua a valer. Carregar duas vezes seguidas não
   * manda nada duas vezes.
   */
  if (accao === "correrAgora") {
    const r = await correrOAssistente();
    return NextResponse.json({ ok: true, passagem: r });
  }

  if (accao === "desfazer") {
    const id = Number(corpo.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Falta dizer qual." }, { status: 400 });
    }
    const r = await desfazerFechoDoAssistente(id);
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 409 });
    return NextResponse.json({ ok: true, pedidoId: r.pedidoId, repostas: r.repostas });
  }

  return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
}
