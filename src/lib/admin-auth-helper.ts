import { NextRequest, NextResponse } from "next/server";

import { papelDoColaborador, verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import { getColaboradorById } from "@/lib/db";
import { assistentePodeChamar, type PapelDoPainel } from "@/lib/papel-do-painel";

export type AdminColab = {
  id: number;
  nome: string;
  isAdmin: number;
  papel: PapelDoPainel;
};

type AuthResult =
  | { err: NextResponse; colab: null }
  | { err: null; colab: AdminColab };

function naoAutorizado(mensagem = "Não autorizado"): AuthResult {
  return { err: NextResponse.json({ error: mensagem }, { status: 401 }), colab: null };
}

function acessoNegado(mensagem = "Acesso negado"): AuthResult {
  return { err: NextResponse.json({ error: mensagem }, { status: 403 }), colab: null };
}

/**
 * Quem pode chamar uma rota do backoffice.
 *
 * O ADMINISTRADOR passa sempre — é o comportamento que esta função sempre
 * teve, e é por isso que mantém o nome: há sessenta e tal rotas a chamá-la.
 *
 * O ASSISTENTE passa só nas rotas da lista dele (`papel-do-painel.ts`) e só
 * enquanto a conta continuar activa na base. A segunda parte custa uma
 * consulta por chamada, de propósito: um "desactivar" no painel do
 * administrador tem de fechar a porta AGORA, não daqui a oito horas quando o
 * token caducar. Devolve 401 e não 403 para o painel limpar a sessão e voltar
 * ao ecrã de entrada, em vez de ficar a mostrar erros em cada botão.
 *
 * O middleware já faz a primeira metade desta verificação antes de a rota
 * correr. Repete-se aqui porque uma rota que dependa só do middleware fica
 * aberta no dia em que o matcher deixar de a apanhar.
 */
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return naoAutorizado();

  const papel = papelDoColaborador(colab);
  if (!papel) return acessoNegado();

  if (papel === "assistente") {
    if (!assistentePodeChamar(req.nextUrl.pathname, req.method)) {
      return acessoNegado("Esta conta de assistente não tem acesso a esta função.");
    }
    const naBase = await getColaboradorById(colab.id).catch(() => undefined);
    if (!naBase || naBase.funcao !== "assistente" || Number(naBase.active) !== 1) {
      return naoAutorizado("Esta conta de assistente foi desactivada.");
    }
  }

  return { err: null, colab: { id: colab.id, nome: colab.nome, isAdmin: colab.isAdmin, papel } };
}

/**
 * Só o administrador. Para o que um assistente nunca pode fazer, mesmo que
 * um dia a rota vá parar à lista dele por engano: gerir assistentes, mexer
 * em configurações, apagar.
 */
export async function requireAdminGeral(req: NextRequest): Promise<AuthResult> {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return naoAutorizado();
  if (papelDoColaborador(colab) !== "admin") {
    return acessoNegado("Apenas administradores.");
  }
  return { err: null, colab: { id: colab.id, nome: colab.nome, isAdmin: colab.isAdmin, papel: "admin" } };
}
