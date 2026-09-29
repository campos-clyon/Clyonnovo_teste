import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";

import { ensureColaboradoresSchema, withConnection } from "@/lib/db";
import { requireAdminGeral } from "@/lib/admin-auth-helper";

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
    // Pelo `requireAdminGeral`, que confirma a conta na base: um token já
    // recusado por uma troca anterior não pode fazer outra.
    const { err, colab: colaborador } = await requireAdminGeral(request);
    if (err) return err;

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
      /*
       * A TROCA FECHA AS SESSÕES QUE JÁ ESTAVAM ABERTAS.
       *
       * Até aqui mudava a palavra-passe e mais nada: quem tivesse apanhado um
       * token continuava lá dentro até ele caducar — trinta dias, com «manter
       * sessão». `senhaAlteradaEm` é o que as rotas comparam com o `iat` de
       * cada token (ver `conta-do-painel.ts`); os anteriores deixam de valer.
       *
       * A hora é a DESTE servidor e não o NOW() da base: é com o relógio da
       * aplicação que o `iat` é escrito, e a base pode estar noutro fuso. E vai
       * como Date, que o mysql2 escreve e lê da mesma maneira.
       *
       * Se a coluna ainda não existir (o ALTER falhou algures), a palavra-passe
       * muda na mesma — isso nunca pode depender da coluna nova.
       */
      try {
        await connection.execute(
          "UPDATE colaboradores SET senha = ?, senhaAlteradaEm = ?, updatedAt = NOW() WHERE id = ?",
          [hash, new Date(), account.id],
        );
      } catch (e) {
        if ((e as { code?: string })?.code !== "ER_BAD_FIELD_ERROR") throw e;
        console.error("[alterar-senha] sem a coluna senhaAlteradaEm — as sessões abertas ficam");
        await connection.execute(
          "UPDATE colaboradores SET senha = ?, updatedAt = NOW() WHERE id = ?",
          [hash, account.id],
        );
      }
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
