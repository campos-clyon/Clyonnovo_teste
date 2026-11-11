import { NextRequest, NextResponse } from "next/server";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { marcarHorasPeloProfissional } from "@/lib/horas-no-servidor";

export const runtime = "nodejs";

/**
 * AS HORAS DO TRABALHO — 31-10-2026 (ordem do CEO com o sim do dono).
 *
 * Num trabalho por hora, depois do «Cheguei» confirmado, o profissional marca
 * a hora de início e a de fim (hora de Lisboa, «HH:MM»; `dia` é o dia do
 * início, AAAA-MM-DD — sem ele, o da chegada) e, se os materiais estavam à
 * parte, as quantidades usadas (`materiais: { caixa: 4, filme: 1 }`). O site
 * conta as horas (ao quarto de hora, para cima, mínimo 3) e o total.
 *
 * Só no trabalho DELE (a sessão diz quem é; o trabalho procura-se entre os
 * dele), fechado e ainda por confirmar, e com as horas ainda por confirmar —
 * marcar outra vez é corrigir, e limpa um «Não concordo» do cliente. Avisa o
 * cliente (push e WhatsApp). Ver `horas-no-servidor.ts`.
 *
 * O RASCUNHO DA FOLHA (11-11-2026): numa mudança com a lista de parceiros,
 * `rascunho: true` guarda só o que ele tem escrito (`dia`, `inicio`, `fim`,
 * `pausas`, `pessoas`, `km`, `materiais` — só horas e quantidades, podem
 * estar a meio), sem enviar a folha e SEM AVISAR O CLIENTE. Responde
 * `{ ok, rascunho: true, folhaRascunho }`; o mesmo rascunho volta em
 * `meus-pedidos` (`folha.rascunho`) e apaga-se quando a folha é enviada.
 *
 * Responde `{ ok, primeiraVez, horas, mensagem }` — `horas` é o resumo
 * (`resumoDasHoras`), o mesmo que o painel e a app mostram.
 */
export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let corpo: {
    negociacaoId?: unknown;
    dia?: unknown;
    inicio?: unknown;
    fim?: unknown;
    materiais?: unknown;
    pausas?: unknown;
    pessoas?: unknown;
    km?: unknown;
    motivoDosKm?: unknown;
    rascunho?: unknown;
  };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  try {
    const r = await marcarHorasPeloProfissional({
      providerId: sessao.providerId,
      nome: sessao.nome ?? null,
      corpo,
    });
    return NextResponse.json(r.corpo, { status: r.status });
  } catch (e) {
    console.error("[profissionais/trabalho/horas]", e);
    return NextResponse.json({ error: "Não foi possível gravar as horas." }, { status: 500 });
  }
}
