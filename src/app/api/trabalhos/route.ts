import { NextResponse } from "next/server";
import { listTrabalhos } from "@/lib/db";

export const revalidate = 60; // revalidar a cada 60 segundos

export async function GET() {
  try {
    const trabalhos = await listTrabalhos({ publicadoOnly: true });
    return NextResponse.json({ trabalhos });
  } catch (error) {
    console.error("[api/trabalhos GET]", error);
    return NextResponse.json({ error: "Erro ao listar trabalhos" }, { status: 500 });
  }
}
