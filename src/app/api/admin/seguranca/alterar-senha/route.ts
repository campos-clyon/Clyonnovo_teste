import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";

import { ensureColaboradoresSchema, withConnection } from "@/lib/db";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 8;

function passwordValidationError(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A nova palavra-passe deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "A nova palavra-passe deve incluir pelo menos uma letra e um número.";
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const colaborador = await verifyColaboradorAuthHeader(request.headers.get("authorization"));
    if (!colaborador) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    if (Number(colaborador.isAdmin) !== 1) {
      return NextResponse.json({ error: "Apenas administradores podem alterar esta palavra-passe." }, { status: 403 });
    }

    const body = await request.json();
    const senhaAtual = typeof body.senhaAtual === "string" ? body.senhaAtual : "";
    const novaSenha = typeof body.novaSenha === "string" ? body.novaSenha : "";

    if (!senhaAtual || !novaSenha) {
      return NextResponse.json(
        { error: "Indique a palavra-passe atual e a nova palavra-passe." },
        { status: 400 },
      );
    }

    const validationError = passwordValidationError(novaSenha);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    if (senhaAtual === novaSenha) {
      return NextResponse.json(
        { error: "A nova palavra-passe deve ser diferente da palavra-passe atual." },
        { status: 400 },
      );
    }

    await ensureColaboradoresSchema();
    const outcome = await withConnection(async (connection) => {
      const [rows] = await connection.execute(
        "SELECT id, senha FROM colaboradores WHERE id = ? LIMIT 1",
        [colaborador.id],
      ) as [Array<{ id: number; senha: string }>, unknown];
      const account = rows[0];
      if (!account) return { status: 404, error: "Conta de administrador não encontrada." };

      const matches = await bcrypt.compare(senhaAtual, account.senha);
      if (!matches) return { status: 400, error: "A palavra-passe atual está incorreta." };

      const hash = await bcrypt.hash(novaSenha, 12);
      await connection.execute(
        "UPDATE colaboradores SET senha = ?, updatedAt = NOW() WHERE id = ?",
        [hash, account.id],
      );
      return { status: 200 };
    });

    if (outcome.status !== 200) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }

    return NextResponse.json({
      ok: true,
      message: "Palavra-passe atualizada. Inicie sessão novamente para continuar.",
    });
  } catch (error) {
    console.error("[api/admin/seguranca/alterar-senha] erro:", error);
    return NextResponse.json({ error: "Não foi possível atualizar a palavra-passe." }, { status: 500 });
  }
}
