import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth-helper";
import { resumoDoAssistente, trabalhosDoAssistente } from "@/lib/assistentes";
import { SECCOES_DO_ASSISTENTE } from "@/lib/papel-do-painel";

export const runtime = "nodejs";

/**
 * GET /api/admin/sessao/eu
 *
 * Quem sou eu, para o painel: o papel, e — no caso do assistente — as
 * secções que o administrador me deu e os meus números. O painel chama isto
 * ao abrir, em vez de confiar no que o token trazia à hora do login: um
 * acesso retirado às 10h tem de desaparecer do menu às 10h01, não no login
 * do dia seguinte.
 *
 * O administrador recebe a lista completa e nenhum número: os dele não são
 * comissão de ninguém. (A lista completa é a das secções que se podem dar a
 * um assistente; o painel do administrador não a usa para decidir nada — ele
 * vê tudo, «Assistentes» incluída.)
 *
 * `?periodos=1` — OS MEUS PERÍODOS, com os trabalhos (08-10-2026). *«Sim,
 * mostra os períodos no painel dela.»* É o mesmo detalhe que o administrador
 * vê em «Assistentes», só de leitura, e SEMPRE da conta de quem chama: o id
 * sai da sessão, nunca do endereço — mudar um número na barra não pode dar a
 * comissão de outra pessoa.
 */
export async function GET(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  if (req.nextUrl.searchParams.has("periodos")) {
    if (colab.papel !== "assistente") {
      return NextResponse.json(
        { error: "O administrador vê as comissões em «Assistentes»." },
        { status: 400 },
      );
    }
    try {
      const r = await trabalhosDoAssistente(colab.id);
      if (!r) {
        return NextResponse.json({ error: "Conta de assistente não encontrada." }, { status: 404 });
      }
      return NextResponse.json({ nome: r.nome, periodos: r.periodos, totais: r.totais });
    } catch (error) {
      console.error("[admin/sessao/eu periodos]", error);
      return NextResponse.json({ error: "Não foi possível ler a comissão." }, { status: 500 });
    }
  }

  if (colab.papel === "admin") {
    return NextResponse.json({
      papel: "admin",
      nome: colab.nome,
      seccoes: [...SECCOES_DO_ASSISTENTE],
      estatisticas: null,
    });
  }

  try {
    const resumo = await resumoDoAssistente(colab.id);
    if (!resumo) {
      return NextResponse.json({ error: "Conta de assistente não encontrada." }, { status: 404 });
    }
    return NextResponse.json({ papel: "assistente", nome: colab.nome, ...resumo });
  } catch (error) {
    console.error("[admin/sessao/eu]", error);
    return NextResponse.json({ error: "Não foi possível ler a sessão." }, { status: 500 });
  }
}
