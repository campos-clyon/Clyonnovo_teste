import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminGeral } from "@/lib/admin-auth-helper";
import {
  atrasoDeRespostaDoAssistente,
  avisosDoAssistente,
  definirConfiguracaoDoAssistente,
  definirInterruptorDoAssistente,
  desfazerFechoDoAssistente,
  fechosDesfaziveis,
  interruptoresDoAssistente,
} from "@/lib/db";
import { correrOAssistente } from "@/lib/assistente-automatico";
import {
  ATRASO_MAXIMO,
  CHAVE_DO_ATRASO,
  canalRespeitaOAtraso,
  lerAtraso,
} from "@/lib/assistente-tempo-de-resposta";
import { canalWhatsApp } from "@/lib/whatsapp-cloud";

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

  const [interruptores, avisos, desfaziveis, atraso] = await Promise.all([
    interruptoresDoAssistente(),
    avisosDoAssistente(60).catch(() => []),
    fechosDesfaziveis().catch(() => []),
    atrasoDeRespostaDoAssistente().catch(() => 0),
  ]);

  const canal = canalWhatsApp();

  return NextResponse.json({
    interruptores,
    atraso,
    /*
     * O painel precisa de saber se o canal em uso respeita o atraso. Pela API
     * da Meta a mensagem sai direta e o campo seria uma promessa por cumprir —
     * e um campo que mente é pior do que um campo que não existe.
     */
    atrasoAplicaSe: canalRespeitaOAtraso(canal),
    canal,
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

  let corpo: {
    accao?: unknown;
    capacidade?: unknown;
    ligado?: unknown;
    id?: unknown;
    segundos?: unknown;
  };
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
   * O TEMPO DE RESPOSTA.
   *
   * Recusa-se o que não se percebe em vez de arredondar: um campo mal
   * preenchido que virasse «dez minutos» calava o assistente durante dez
   * minutos sem ninguém perceber porquê.
   */
  if (accao === "atraso") {
    const segundos = lerAtraso(corpo.segundos);
    if (segundos == null) {
      return NextResponse.json(
        { error: `Diga um número de segundos entre 0 e ${ATRASO_MAXIMO}.` },
        { status: 400 },
      );
    }
    try {
      await definirConfiguracaoDoAssistente(CHAVE_DO_ATRASO, String(segundos), "backoffice");
    } catch {
      return NextResponse.json({ error: "Não foi possível guardar." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, atraso: segundos });
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
