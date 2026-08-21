import { NextRequest, NextResponse } from "next/server";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import { withConnection, ensureUsersSchema } from "@/lib/db";

export const runtime = "nodejs";

async function requireAdmin(request: NextRequest) {
  const colaborador = await verifyColaboradorAuthHeader(request.headers.get("authorization"));
  if (!colaborador) return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  if (!colaborador.isAdmin) return { error: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) };
  return { colaborador };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    await ensureUsersSchema();
    const rows = await withConnection(async (conn) => {
      // Se o utilizador ainda não preencheu telefone/cidade no perfil, cair
      // para o telefone/cidade do último pedido que fez (contactPhone / city).
      const [r] = await conn.execute(
        `SELECT
           u.id, u.name, u.email,
           COALESCE(NULLIF(TRIM(u.phone), ''), lastOrder.contactPhone) AS phone,
           COALESCE(NULLIF(TRIM(u.addressCity), ''), lastOrder.city) AS addressCity,
           u.loginMethod, u.role, u.nif, u.createdAt, u.lastSignedIn, u.deletedAt
         FROM users u
         LEFT JOIN (
           SELECT o1.contactEmail,
                  SUBSTRING_INDEX(GROUP_CONCAT(o1.contactPhone ORDER BY o1.createdAt DESC SEPARATOR '||'), '||', 1) AS contactPhone,
                  SUBSTRING_INDEX(GROUP_CONCAT(o1.city         ORDER BY o1.createdAt DESC SEPARATOR '||'), '||', 1) AS city
           FROM simulatorOrders o1
           WHERE o1.contactEmail IS NOT NULL AND TRIM(o1.contactEmail) <> ''
           GROUP BY o1.contactEmail
         ) lastOrder
           ON LOWER(TRIM(lastOrder.contactEmail)) = LOWER(TRIM(u.email))
         ORDER BY u.createdAt DESC
         LIMIT 500`
      );
      return r;
    });

    /*
     * Quantos clientes pediram orçamento e não têm conta.
     *
     * O painel dizia "13 contas ativas" e ficava por aí. Só que conta não é o
     * mesmo que cliente: quem usa o simulador sem entrar com o Google deixa
     * um pedido com email e nunca aparece nesta tabela. Eram quinze pessoas
     * invisíveis num painel chamado "Contas de Clientes".
     */
    const semConta = await withConnection(async (conn) => {
      const [r] = await conn.execute(
        `SELECT COUNT(DISTINCT LOWER(TRIM(o.contactEmail))) AS n
           FROM simulatorOrders o
           LEFT JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(o.contactEmail))
          WHERE o.contactEmail IS NOT NULL AND TRIM(o.contactEmail) <> ''
            AND u.id IS NULL`,
      ) as [Array<{ n: number }>, unknown];
      return Number(r[0]?.n ?? 0);
    });

    return NextResponse.json({ users: rows, semConta });
  } catch (err) {
    console.error("[api/admin/users] GET error:", err);
    return NextResponse.json({ error: "Erro ao carregar utilizadores" }, { status: 500 });
  }
}

/**
 * Apaga uma conta, a sério.
 *
 * O painel só tinha "desativar", que escrevia uma data em `deletedAt` e
 * escondia a linha. Isso não é apagar: os dados continuavam todos lá, e quem
 * pede para ser apagado tem o direito de o ser. A linha sai da tabela.
 *
 * O QUE FICA: os pedidos que a pessoa fez. Não estão ligados a esta linha por
 * chave nenhuma — guardam o email, o nome e a morada por si — e são o registo
 * de um serviço prestado, com as obrigações de facturação que isso traz.
 * Apagá-los aqui, de passagem, era destruir a contabilidade a partir de um
 * botão que diz "excluir conta".
 *
 * Se um dia for preciso apagar também o rasto nos pedidos, é uma operação
 * própria e com esse nome — não um efeito secundário desta.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    await ensureUsersSchema();
    const apagadas = await withConnection(async (conn) => {
      const [r] = await conn.execute("DELETE FROM users WHERE id = ?", [id]) as [
        { affectedRows?: number },
        unknown,
      ];
      return Number(r.affectedRows ?? 0);
    });

    if (apagadas === 0) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/users DELETE]", err);
    return NextResponse.json({ error: "Erro ao excluir conta" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { id, role, deletedAt } = body;
    if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

    await ensureUsersSchema();
    await withConnection(async (conn) => {
      const updates: string[] = [];
      const params: unknown[] = [];

      if (role !== undefined) {
        updates.push("role = ?");
        params.push(role);
      }
      if (deletedAt !== undefined) {
        updates.push("deletedAt = ?");
        params.push(deletedAt);
      }

      if (updates.length === 0) return;
      params.push(id);
      await conn.execute(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
        params
      );
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/users] PATCH error:", err);
    return NextResponse.json({ error: "Erro ao atualizar utilizador" }, { status: 500 });
  }
}
