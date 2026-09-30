import { NextRequest, NextResponse } from "next/server";

import {
  papelDoColaborador,
  verifyColaboradorAuthHeader,
  type ColaboradorTokenPayload,
} from "@/lib/colaborador-auth";
import { assistentePorId } from "@/lib/assistentes";
import { assistenteComSeccoesPodeChamar, type PapelDoPainel } from "@/lib/papel-do-painel";
import { contaDoPainelPorId, motivoParaRecusarSessao } from "@/lib/conta-do-painel";

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
 * A conta continua a valer, segundo a BASE?
 *
 * O token diz quem era a pessoa quando entrou; a base diz quem ela é agora.
 * Uma conta de administrador desactivada, despromovida ou apagada, ou um
 * token emitido antes de a palavra-passe mudar, deixam de entrar já — e não
 * daqui a oito horas (ou trinta dias) quando o token caducar. Ver
 * `conta-do-painel.ts`.
 *
 * Se a base não responder, 503 e não 401: não se sabe se a sessão vale, e
 * um 401 faria o painel julgar que a pessoa foi posta fora.
 */
async function contaAindaVale(
  colab: ColaboradorTokenPayload,
  papel: PapelDoPainel,
): Promise<AuthResult | null> {
  let conta;
  try {
    conta = await contaDoPainelPorId(colab.id);
  } catch (e) {
    console.error("[admin-auth] não consegui confirmar a conta:", colab.id, e instanceof Error ? e.message : e);
    return {
      err: NextResponse.json(
        { error: "Não foi possível confirmar a sessão. Tente novamente dentro de instantes." },
        { status: 503 },
      ),
      colab: null,
    };
  }
  const motivo = motivoParaRecusarSessao(conta, papel, colab.iat);
  return motivo ? naoAutorizado(motivo) : null;
}

/**
 * Quem pode chamar uma rota do backoffice.
 *
 * O ADMINISTRADOR passa sempre — é o comportamento que esta função sempre
 * teve, e é por isso que mantém o nome: há sessenta e tal rotas a chamá-la.
 * Desde 30-09-2026, passa enquanto a BASE disser que é administrador, que a
 * conta está activa e que o token não é anterior à última troca de
 * palavra-passe. Até aí bastava o token.
 *
 * O ASSISTENTE passa só nas rotas da lista do papel (`papel-do-painel.ts`),
 * só nas secções que o administrador lhe deu, e só enquanto a conta
 * continuar activa na base. Isso custa uma consulta por chamada, de
 * propósito: um "desactivar" ou um "tirar a secção" no painel do
 * administrador tem de fechar a porta AGORA, não daqui a oito horas quando o
 * token caducar. A conta desactivada devolve 401 e não 403 para o painel
 * limpar a sessão e voltar ao ecrã de entrada, em vez de ficar a mostrar
 * erros em cada botão.
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

  const recusa = await contaAindaVale(colab, papel);
  if (recusa) return recusa;

  if (papel === "assistente") {
    const naBase = await assistentePorId(colab.id).catch(() => undefined);
    if (!naBase || !naBase.activo) {
      return naoAutorizado("Esta conta de assistente foi desactivada.");
    }
    if (!assistenteComSeccoesPodeChamar(naBase.seccoes, req.nextUrl.pathname, req.method)) {
      return acessoNegado("Esta conta de assistente não tem acesso a esta função.");
    }
  }

  return { err: null, colab: { id: colab.id, nome: colab.nome, isAdmin: colab.isAdmin, papel } };
}

/**
 * Só o administrador. Para o que um assistente nunca pode fazer, mesmo que
 * um dia a rota vá parar à lista dele por engano: gerir assistentes, mexer
 * em configurações, apagar. Confirmado na base, como em `requireAdmin`.
 */
export async function requireAdminGeral(req: NextRequest): Promise<AuthResult> {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return naoAutorizado();
  if (papelDoColaborador(colab) !== "admin") {
    return acessoNegado("Apenas administradores.");
  }

  const recusa = await contaAindaVale(colab, "admin");
  if (recusa) return recusa;

  return { err: null, colab: { id: colab.id, nome: colab.nome, isAdmin: colab.isAdmin, papel: "admin" } };
}
