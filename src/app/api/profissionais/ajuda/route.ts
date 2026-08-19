import { NextRequest, NextResponse } from "next/server";
import { criarPedidoDeAjuda, ajudasDoProfissional, perfilDoProfissional } from "@/lib/db";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";
import { validarPedidoDeAjuda } from "@/lib/ajuda-plataforma";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/**
 * Pedir ajuda, de dentro da conta.
 *
 * O nome e o email não vêm do formulário — vêm da sessão. Quem escreve já está
 * identificado, e pedir-lhos outra vez era dar-lhe a hipótese de escrever um
 * email errado no momento em que precisa de resposta.
 */
export async function GET(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const linhas = await ajudasDoProfissional(sessao.providerId);
    return NextResponse.json({
      pedidos: linhas.map((p) => {
        let respostas: Array<{ texto: string; em: string; por: string }> = [];
        try {
          const l = JSON.parse(p.respostaJson ?? "[]");
          if (Array.isArray(l)) respostas = l;
        } catch {
          /* uma resposta corrompida não pode esconder o pedido todo */
        }
        return {
          id: p.id,
          assunto: p.assunto,
          mensagem: p.mensagem,
          estado: p.estado,
          respostas,
          createdAt: p.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error("[profissionais/ajuda GET]", error);
    return NextResponse.json({ error: "Erro ao carregar" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Um travão largo: quem tem um problema a sério escreve duas ou três vezes
  // no mesmo dia, e isso não pode ser tratado como abuso.
  const limite = await limitarRotaPublica(req, "profissional-ajuda", 10, 3600);
  if (limite.erro) return limite.erro;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const validacao = validarPedidoDeAjuda(corpo);
  if (!validacao.ok) {
    return NextResponse.json(
      { error: validacao.erros[0].mensagem, erros: validacao.erros },
      { status: 400 },
    );
  }

  try {
    const perfil = await perfilDoProfissional(sessao.providerId);
    const id = await criarPedidoDeAjuda({
      origem: "profissional",
      providerId: sessao.providerId,
      nome: String(perfil?.name ?? sessao.nome),
      email: typeof perfil?.email === "string" ? perfil.email : null,
      assunto: validacao.dados.assunto,
      mensagem: validacao.dados.mensagem,
    });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("[profissionais/ajuda POST]", error);
    return NextResponse.json({ error: "Não foi possível enviar" }, { status: 500 });
  }
}
