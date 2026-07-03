import { NextRequest, NextResponse } from "next/server";
import { listTrabalhos, createTrabalho } from "@/lib/db";

export async function GET() {
  try {
    const trabalhos = await listTrabalhos();
    return NextResponse.json({ trabalhos });
  } catch (error) {
    console.error("[api/admin/trabalhos GET]", error);
    return NextResponse.json({ error: "Erro ao listar trabalhos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
