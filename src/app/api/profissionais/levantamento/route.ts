import { NextRequest, NextResponse } from "next/server";
import {
  negociacoesDoProfissional,
  levantamentosDoProfissional,
  perfilDoProfissional,
  criarLevantamento,
} from "@/lib/db";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";
import {
  carteiraDe,
  recusaDoLevantamento,
  EXPLICACAO_DA_RECUSA,
  type TrabalhoNaCarteira,
} from "@/lib/carteira";

export const runtime = "nodejs";

/**
 * Pedir a transferência do saldo disponível.
 *
 * O saldo é recalculado aqui, a partir da base, e nunca vem do ecrã. Um valor
 * disponível enviado pelo browser é um valor que qualquer pessoa pode escrever
 * — e o que estava em causa era transferir dinheiro.
 *
 * Enquanto não houver ligação ao banco, o pedido fica em espera e é o
 * backoffice que o executa. É honesto: o profissional vê "a caminho" e sabe que
 * há uma pessoa do outro lado, em vez de ver um botão que promete instantâneo.
 */
export async function POST(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let corpo: { valor?: unknown };
  try {
    corpo = (await req.json()) as { valor?: unknown };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const valor =
    typeof corpo.valor === "string"
      ? Number(corpo.valor.replace(",", "."))
      : Number(corpo.valor);

  try {
    const [linhas, levantamentos, perfil] = await Promise.all([
      negociacoesDoProfissional(sessao.providerId),
      levantamentosDoProfissional(sessao.providerId),
      perfilDoProfissional(sessao.providerId),
    ]);

    const agora = new Date();
    const trabalhos: TrabalhoNaCarteira[] = linhas.map((l) => ({
      negociacaoId: l.id,
      estado: l.estado,
      valorAcordado: l.valorAcordado != null ? Number(l.valorAcordado) : null,
      execucaoEnviadaEm: l.execucaoEnviadaEm,
      confirmadoEm: l.confirmadoEm,
      pagoEm: l.pagoEm,
    }));

    const carteira = carteiraDe(
      trabalhos,
      levantamentos.map((l) => ({ id: l.id, valor: Number(l.valor), estado: l.estado })),
      agora,
    );

    const iban = typeof perfil?.iban === "string" ? perfil.iban : "";
    const recusa = recusaDoLevantamento(
      valor,
      carteira,
      Boolean(iban),
      levantamentos.some((l) => l.estado === "pedido"),
    );
    if (recusa) {
      return NextResponse.json({ error: EXPLICACAO_DA_RECUSA[recusa] }, { status: 400 });
    }

    const id = await criarLevantamento({
      providerId: sessao.providerId,
      valor: Math.round(valor * 100) / 100,
      iban,
      titular: typeof perfil?.ibanTitular === "string" ? perfil.ibanTitular : null,
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("[profissionais/levantamento]", error);
    return NextResponse.json({ error: "Não foi possível pedir a transferência" }, { status: 500 });
  }
}
