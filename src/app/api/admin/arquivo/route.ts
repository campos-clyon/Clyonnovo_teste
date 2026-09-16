import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { arquivosDePedidos } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O ARQUIVO DOS PEDIDOS APAGADOS — a lista.
 *
 * "leve os arquivos dos nossos históricos de pedidos que foram apagados para
 * as configs, assim o admin pode baixar e visualizar quando necessário."
 * — 16-09-2026.
 *
 * Sai a lista, nunca o conteúdo: cada arquivo pode ter dezenas de kilobytes e
 * trazê-los todos para desenhar uma tabela era arrastar o arquivo inteiro a
 * cada abertura do ecrã. O conteúdo sai um a um, por `/api/admin/arquivo/[id]`.
 *
 * ATRÁS DE SESSÃO, e isto não é formalidade: cada linha leva nome, email,
 * telefone e morada de um cliente. É a razão de o arquivo viver na base e não
 * num Blob público como as fotografias.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    return NextResponse.json({ arquivos: await arquivosDePedidos(200) });
  } catch (e) {
    console.error("[admin/arquivo]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível ler o arquivo." }, { status: 500 });
  }
}
