import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { COOKIE_SESSAO_PROFISSIONAL } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { gerarReferenciaDaDivida } from "@/lib/cobrar-divida-do-profissional";

export const runtime = "nodejs";

/**
 * O PROFISSIONAL PEDE A REFERÊNCIA DO QUE DEVE À CLYON — 01-10-2026.
 *
 * Em dinheiro com IVA incluído, o cliente pagou-lhe o preço inteiro e ele deve
 * à CLYON o IVA e a comissão. A Multibanco gera-se sozinha na confirmação; se
 * expirou, se falhou, ou se ele prefere MB WAY, pede-a aqui, na carteira.
 *
 * O id do corpo NUNCA é a autorização: a negociação tem de ser dele (é a
 * sessão que o diz). E a conta não vem do ecrã — é a mesma
 * `dividaDoProfissional` de todo o lado, feita no servidor.
 */
export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Cada pedido é uma ida ao euPago (e, no MB WAY, uma notificação no telemóvel).
  const limite = await limitarRotaPublica(req, "profissional-divida", 10, 600);
  if (limite.erro) return limite.erro;

  let corpo: { negociacaoId?: unknown; metodo?: unknown; telemovel?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }
  const metodo = corpo.metodo === "mbway" ? "mbway" : "multibanco";

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });
  const [linhas] = (await pool.execute(
    "SELECT providerId FROM negociacoes WHERE id = ? LIMIT 1",
    [negociacaoId],
  )) as [Array<{ providerId: number }>, unknown];
  // «Não existe» e «não é seu» respondem igual — ver `acesso-ao-pagamento.ts`.
  if (!linhas[0] || Number(linhas[0].providerId) !== sessao.providerId) {
    return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
  }

  const r = await gerarReferenciaDaDivida(negociacaoId, {
    metodo,
    telemovel: typeof corpo.telemovel === "string" ? corpo.telemovel : null,
    autor: { tipo: "profissional", nome: "o profissional, na carteira" },
  });
  if (!r.ok) {
    return NextResponse.json(
      { error: r.jaPaga ? "Esta dívida já está paga." : r.porque },
      { status: r.jaPaga ? 409 : 400 },
    );
  }
  const p = r.pagamento;
  return NextResponse.json({
    ok: true,
    reaproveitada: r.reaproveitada,
    referencia: {
      metodo: p.metodo,
      entidade: p.entidade,
      referencia: p.referencia,
      expiraEm: p.expiraEm,
      valor: p.valor,
    },
  });
}
