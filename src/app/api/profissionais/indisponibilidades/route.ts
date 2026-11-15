import { NextRequest, NextResponse } from "next/server";
import { sessaoVemDaApp, tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import {
  PERGUNTA_COM_TRABALHO_MARCADO,
  indisponibilidadeParaAApi,
  lerIndisponibilidade,
  trabalhosEmCima,
  DURACAO_DO_TRABALHO_MIN,
} from "@/lib/indisponibilidade";
import {
  desmarcarIndisponibilidade,
  indisponibilidadesDoProfissional,
  marcarIndisponibilidade,
  trabalhosMarcadosNoPeriodo,
} from "@/lib/indisponibilidades-na-base";
import { diaEmLisboa, instanteEmLisboa, pecasEmLisboa, somarDiasAoDia } from "@/lib/hora-de-lisboa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AS INDISPONIBILIDADES DO PROFISSIONAL — d35, 15-11-2026. O painel (cookie) e
 * a app Pro (token no cabeçalho) usam esta rota. As regras estão em
 * `indisponibilidade.ts`; tudo em hora de Lisboa.
 *
 *   GET    → { indisponibilidades: [...] } — as que ainda não acabaram
 *   POST   { dia, ate?, inicio?, fim?, nota?, confirmar? } → marca
 *          · em cima de um trabalho marcado e sem `confirmar: true` → 409
 *            { precisaConfirmar: true, pergunta, trabalhos: [{ pedidoId, quando }] }
 *   DELETE ?id=N (ou { id }) → desmarca uma marcação dele
 *
 * O providerId sai SEMPRE da sessão: um id no corpo não chega a outra conta.
 */
async function sessao(req: NextRequest) {
  return sessaoActivaDoProfissional(tokenDoProfissional(req));
}

export async function GET(req: NextRequest) {
  const s = await sessao(req);
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const lista = await indisponibilidadesDoProfissional(s.providerId);
    return NextResponse.json({ indisponibilidades: lista.map(indisponibilidadeParaAApi) });
  } catch (e) {
    console.error("[profissionais/indisponibilidades] GET", e);
    return NextResponse.json({ error: "Não foi possível ler a agenda." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const s = await sessao(req);
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const lido = lerIndisponibilidade(corpo);
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });

  try {
    /* EM CIMA DE UM TRABALHO MARCADO, PERGUNTA-SE PRIMEIRO. O trabalho fica
       marcado na mesma: indisponível é para os pedidos novos. */
    if (corpo.confirmar !== true) {
      const marcados = await trabalhosMarcadosNoPeriodo(s.providerId, lido.valor.inicioEm, lido.valor.fimEm);
      const comoIntervalo = marcados.map((t) => {
        const p = pecasEmLisboa(t.quando);
        const soODia = p.hora === 0 && p.minuto === 0;
        const dia = diaEmLisboa(t.quando);
        return {
          ...t,
          inicio: soODia ? (instanteEmLisboa(`${dia}T00:00`) as Date) : t.quando,
          fim: soODia
            ? (instanteEmLisboa(`${somarDiasAoDia(dia, 1)}T00:00`) as Date)
            : new Date(t.quando.getTime() + (t.duracaoMinutos ?? DURACAO_DO_TRABALHO_MIN) * 60_000),
        };
      });
      const emCima = trabalhosEmCima(lido.valor, comoIntervalo);
      if (emCima.length > 0) {
        return NextResponse.json(
          {
            error: PERGUNTA_COM_TRABALHO_MARCADO,
            precisaConfirmar: true,
            pergunta: PERGUNTA_COM_TRABALHO_MARCADO,
            trabalhos: emCima.map((t) => ({ pedidoId: t.pedidoId, negociacaoId: t.negociacaoId, quando: t.quando.toISOString() })),
          },
          { status: 409 },
        );
      }
    }
    const id = await marcarIndisponibilidade(s.providerId, lido.valor, sessaoVemDaApp(req) ? "app" : "painel");
    const lista = await indisponibilidadesDoProfissional(s.providerId);
    return NextResponse.json({ ok: true, id, indisponibilidades: lista.map(indisponibilidadeParaAApi) });
  } catch (e) {
    console.error("[profissionais/indisponibilidades] POST", e);
    return NextResponse.json({ error: "Não foi possível marcar." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const s = await sessao(req);
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  let id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    try {
      id = Number(((await req.json()) as { id?: unknown }).id);
    } catch {
      /* sem corpo */
    }
  }
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Indique qual." }, { status: 400 });
  try {
    const tirou = await desmarcarIndisponibilidade(s.providerId, id);
    if (!tirou) return NextResponse.json({ error: "Não encontrada." }, { status: 404 });
    const lista = await indisponibilidadesDoProfissional(s.providerId);
    return NextResponse.json({ ok: true, indisponibilidades: lista.map(indisponibilidadeParaAApi) });
  } catch (e) {
    console.error("[profissionais/indisponibilidades] DELETE", e);
    return NextResponse.json({ error: "Não foi possível desmarcar." }, { status: 500 });
  }
}
