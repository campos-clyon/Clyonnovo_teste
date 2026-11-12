import { NextRequest, NextResponse } from "next/server";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { apagarFotosDoBlob, apagarProvaDaGuia } from "@/lib/db";
import { receberProvaDaGuia } from "@/lib/prova-da-guia-no-servidor";

export const runtime = "nodejs";

/**
 * A PROVA DO REGISTO DE TRANSPORTADOR, PELO PAINEL E PELA APP PRO — 12-11-2026 (d5).
 *
 * POST (multipart, campo `file`: imagem ou PDF até 4 MB) troca a prova dele;
 * DELETE tira-a. Exige a sessão do profissional e escreve só na conta DELE.
 * A resposta nunca leva o endereço do ficheiro: só o nome e a data
 * (`provaDaGuia: { nome, em }`). Quem a abre é o administrador.
 */
export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  return receberProvaDaGuia(req, sessao.providerId);
}

export async function DELETE(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const saiu = await apagarProvaDaGuia(sessao.providerId);
    if (saiu) {
      const n = await apagarFotosDoBlob([saiu]).catch(() => 0);
      if (n < 1) console.error(`[prova-da-guia] a prova de #${sessao.providerId} ficou no Blob`);
    }
    return NextResponse.json({ ok: true, provaDaGuia: null });
  } catch (e) {
    console.error("[prova-da-guia DELETE]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível apagar." }, { status: 500 });
  }
}
