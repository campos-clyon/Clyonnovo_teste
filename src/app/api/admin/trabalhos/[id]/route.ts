import { NextRequest, NextResponse } from "next/server";
import { getTrabalho, updateTrabalho, deleteTrabalho } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trabalho = await getTrabalho(Number(id));
    if (!trabalho) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json({ trabalho });
  } catch (error) {
    console.error("[api/admin/trabalhos/[id] GET]", error);
    return NextResponse.json({ error: "Erro ao buscar trabalho" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    await updateTrabalho(Number(id), {
      fotos:       body.fotos,
      tipoServico: body.tipoServico,
      localidade:  body.localidade?.trim(),
      descricao:   body.descricao?.trim() || null,
      publicado:   body.publicado !== undefined ? Boolean(body.publicado) : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/admin/trabalhos/[id] PATCH]", error);
    return NextResponse.json({ error: "Erro ao actualizar trabalho" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteTrabalho(Number(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/admin/trabalhos/[id] DELETE]", error);
    return NextResponse.json({ error: "Erro ao eliminar trabalho" }, { status: 500 });
  }
}
