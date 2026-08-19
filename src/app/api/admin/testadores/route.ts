import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  listarTestadores,
  criarTestador,
  definirEstadoDoTestador,
  definirPalavraPasseDoTestador,
  testadorPorUtilizador,
} from "@/lib/db";
import {
  validarPalavraPasseDeTeste,
  hashDaPalavraPasseDeTeste,
  chaveConfigurada,
} from "@/lib/acesso-mvp";

export const runtime = "nodejs";

/**
 * Quem pode entrar no ambiente de testes.
 *
 * A palavra-passe é escolhida aqui e entregue à pessoa fora do sistema — um
 * WhatsApp, uma chamada. Sem convite por email de propósito: durante o MVP os
 * testadores são pessoas conhecidas, e um email a menos é uma superfície a
 * menos para alguém interceptar.
 *
 * A resposta NUNCA traz o hash da palavra-passe nem a chave do ambiente. Traz
 * apenas se a chave está configurada — quem administra precisa de saber que o
 * portão está de pé, não precisa de a ver outra vez.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    const linhas = await listarTestadores();
    return NextResponse.json({
      portaoDePe: chaveConfigurada() !== null,
      testadores: linhas.map((t) => ({
        id: t.id,
        nome: t.nome,
        utilizador: t.utilizador,
        papel: t.papel,
        activo: Number(t.activo) === 1,
        ultimoAcesso: t.ultimoAcesso,
        criadoPor: t.criadoPor,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.error("[admin/testadores GET]", error);
    return NextResponse.json({ error: "Erro ao listar" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  // ── Activar, desactivar ou trocar a palavra-passe de quem já existe ───────
  if (corpo.id != null) {
    const id = Number(corpo.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Testador inválido." }, { status: 400 });
    }

    if (typeof corpo.palavraPasse === "string") {
      const erroDaSenha = validarPalavraPasseDeTeste(corpo.palavraPasse);
      if (erroDaSenha) return NextResponse.json({ error: erroDaSenha }, { status: 400 });
      await definirPalavraPasseDoTestador(id, await hashDaPalavraPasseDeTeste(corpo.palavraPasse));
      return NextResponse.json({ ok: true, feito: "palavra-passe trocada" });
    }

    if (typeof corpo.activo === "boolean") {
      await definirEstadoDoTestador(id, corpo.activo);
      return NextResponse.json({
        ok: true,
        feito: corpo.activo ? "reactivado" : "desactivado",
      });
    }

    return NextResponse.json({ error: "Nada para alterar." }, { status: 400 });
  }

  // ── Criar ────────────────────────────────────────────────────────────────
  const nome = typeof corpo.nome === "string" ? corpo.nome.trim() : "";
  // Minúsculas e sem espaços: um utilizador que difere só na caixa é um
  // utilizador que ninguém consegue escrever duas vezes da mesma maneira.
  const utilizador =
    typeof corpo.utilizador === "string"
      ? corpo.utilizador.trim().toLowerCase().replace(/\s+/g, "")
      : "";
  const papel = corpo.papel === "profissional" ? "profissional" : "cliente";

  if (nome.length < 2) {
    return NextResponse.json({ error: "Indique o nome." }, { status: 400 });
  }
  if (!/^[a-z0-9._-]{3,60}$/.test(utilizador)) {
    return NextResponse.json(
      { error: "Utilizador: 3 a 60 caracteres, letras minúsculas, números, ponto, hífen." },
      { status: 400 },
    );
  }

  const erroDaSenha = validarPalavraPasseDeTeste(corpo.palavraPasse);
  if (erroDaSenha) return NextResponse.json({ error: erroDaSenha }, { status: 400 });

  try {
    if (await testadorPorUtilizador(utilizador)) {
      return NextResponse.json({ error: "Esse utilizador já existe." }, { status: 409 });
    }

    const id = await criarTestador({
      nome,
      utilizador,
      passwordHash: await hashDaPalavraPasseDeTeste(corpo.palavraPasse as string),
      papel,
      criadoPor: String(colab?.nome ?? "admin"),
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("[admin/testadores POST]", error);
    return NextResponse.json({ error: "Não foi possível criar" }, { status: 500 });
  }
}
