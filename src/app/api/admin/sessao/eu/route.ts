import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth-helper";
import { resumoDoAssistente } from "@/lib/assistentes";
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
 * comissão de ninguém.
 */
export async function GET(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

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
