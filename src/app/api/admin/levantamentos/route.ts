import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { levantamentosParaAdmin, marcarLevantamento } from "@/lib/db";
import { formatarIban } from "@/lib/iban";

export const runtime = "nodejs";

/**
 * Os pedidos de transferência dos profissionais.
 *
 * Enquanto não houver ligação ao banco, é aqui que a transferência acontece:
 * alguém vê o pedido, faz a transferência no banco e marca como paga. O
 * profissional vê "a caminho" desde que pede — é honesto, e é melhor do que um
 * botão que promete instantâneo e depois demora dois dias.
 *
 * O IBAN sai INTEIRO nesta rota, ao contrário do que acontece do lado do
 * profissional: quem está aqui é para copiar para o banco. Daí exigir sessão de
 * administrador.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    const linhas = await levantamentosParaAdmin();
    return NextResponse.json({
      levantamentos: linhas.map((l) => ({
        id: l.id,
        providerId: l.providerId,
        profissionalNome: l.profissionalNome,
        valor: Number(l.valor),
        iban: formatarIban(l.iban),
        titular: l.titular,
        estado: l.estado,
        nota: l.nota,
        processadoPor: l.processadoPor,
        processadoEm: l.processadoEm,
        createdAt: l.createdAt,
      })),
    });
  } catch (error) {
    console.error("[admin/levantamentos GET]", error);
    return NextResponse.json({ error: "Erro ao listar" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { id?: unknown; estado?: unknown; nota?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const id = Number(corpo.id);
  const estado = corpo.estado;
  if (!Number.isInteger(id) || (estado !== "pago" && estado !== "recusado")) {
    return NextResponse.json({ error: "Dados em falta." }, { status: 400 });
  }

  // Recusar sem dizer porquê deixa o profissional a ver o saldo voltar sem
  // explicação nenhuma — e a escrever para o apoio a perguntar o que se passou.
  const nota = typeof corpo.nota === "string" ? corpo.nota.trim().slice(0, 255) : "";
  if (estado === "recusado" && !nota) {
    return NextResponse.json({ error: "Escreva o motivo da recusa." }, { status: 400 });
  }

  try {
    const feito = await marcarLevantamento(
      id,
      estado,
      String(colab?.nome ?? "admin"),
      nota || undefined,
    );
    if (!feito) {
      return NextResponse.json(
        { error: "Este pedido já tinha sido processado." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/levantamentos POST]", error);
    return NextResponse.json({ error: "Não foi possível processar" }, { status: 500 });
  }
}
