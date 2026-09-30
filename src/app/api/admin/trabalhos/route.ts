import { NextRequest, NextResponse } from "next/server";
import { listTrabalhos, createTrabalho } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth-helper";

/**
 * Galeria de trabalhos.
 *
 * ⚠️ Estas rotas estavam sob /api/admin e não verificavam nada. Qualquer
 * pessoa na internet podia criar, alterar e apagar trabalhos publicados no
 * site — e o upload aceitava ficheiros sem autenticação, o que é
 * armazenamento aberto a quem o descobrisse.
 *
 * O GET ficava público "porque a galeria do site o consome" — e não consome:
 * a página /trabalhos lê `listTrabalhos({ publicadoOnly: true })` directamente
 * e há /api/trabalhos para o resto. Este devolvia TODOS, incluindo os ainda
 * não publicados (fotografias de casas por rever). Fechado a 30-09-2026.
 */

export async function GET(request: NextRequest) {
  const { err } = await requireAdmin(request);
  if (err) return err;

  try {
    const trabalhos = await listTrabalhos();
    return NextResponse.json({ trabalhos });
  } catch (error) {
    console.error("[api/admin/trabalhos GET]", error);
    return NextResponse.json({ error: "Erro ao listar trabalhos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { err } = await requireAdmin(request);
  if (err) return err;

  try {
    const body = await request.json();
    const { fotos, tipoServico, localidade, descricao, publicado } = body;

    if (!fotos || !Array.isArray(fotos) || fotos.length === 0) {
      return NextResponse.json({ error: "É necessário pelo menos uma foto" }, { status: 400 });
    }
    if (!tipoServico) {
      return NextResponse.json({ error: "Tipo de serviço obrigatório" }, { status: 400 });
    }
    if (!localidade?.trim()) {
      return NextResponse.json({ error: "Localidade obrigatória" }, { status: 400 });
    }

    const id = await createTrabalho({
      fotos,
      tipoServico,
      localidade: localidade.trim(),
      descricao: descricao?.trim() || null,
      publicado: Boolean(publicado),
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("[api/admin/trabalhos POST]", error);
    return NextResponse.json({ error: "Erro ao criar trabalho" }, { status: 500 });
  }
}
