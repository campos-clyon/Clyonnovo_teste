import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { obterTokenDoBlob } from "@/lib/blob-token";
import { tipoDoFicheiro } from "@/lib/tipo-ficheiro";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { limitarPorConta } from "@/lib/limite-rota-publica";
import { negociacoesDoProfissional } from "@/lib/db";
import { podeEnviarProva } from "@/lib/trabalho";

export const runtime = "nodejs";

/**
 * AS FOTOGRAFIAS DO TRABALHO, PELA APP — 18-10-2026.
 *
 * A prova («está feito») e o ajuste no local pedem fotografias. O painel no
 * navegador carrega-as por rotas públicas, sem sessão; a app usa esta, que
 * sabe de quem é o trabalho: só o profissional dele, e só enquanto há alguma
 * coisa para provar (fase `a_executar`). As fotografias ficam numa pasta do
 * trabalho, com um nome que não se adivinha.
 *
 * A app reduz cada fotografia antes de a enviar (≈ 1600 px, JPEG): o corpo de
 * um pedido na Vercel não passa dos 4,5 MB.
 *
 * Responde `{url, name, size, type}` — a URL entra depois na prova
 * (`POST /api/profissionais/trabalho`) ou no ajuste (`…/trabalho/ajuste`).
 */
const TAMANHO_MAXIMO = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Por conta e não por IP: os telemóveis na rede móvel partilham IPs.
  const limite = await limitarPorConta("profissional-fotos-do-trabalho", String(sessao.providerId), 60, 600);
  if (limite.erro) return limite.erro;

  let ficheiro: File | null = null;
  let negociacaoId = 0;
  try {
    const fd = await req.formData();
    const f = fd.get("file");
    if (f instanceof File) ficheiro = f;
    negociacaoId = Number(fd.get("negociacaoId"));
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }
  if (!ficheiro) return NextResponse.json({ error: "Escolha uma fotografia." }, { status: 400 });
  if (ficheiro.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ error: "A fotografia é grande de mais (máximo 4 MB)." }, { status: 413 });
  }
  const veredicto = tipoDoFicheiro(ficheiro.name, ficheiro.type);
  if (!veredicto.ok || !veredicto.tipo.startsWith("image/")) {
    return NextResponse.json({ error: "Só fotografias (JPG, PNG, WEBP ou HEIC)." }, { status: 415 });
  }

  const trabalho = (await negociacoesDoProfissional(sessao.providerId)).find((n) => Number(n.id) === negociacaoId);
  if (!trabalho) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
  if (!podeEnviarProva(trabalho as never)) {
    return NextResponse.json({ error: "Este trabalho já não aceita fotografias." }, { status: 409 });
  }

  const tokenBlob = await obterTokenDoBlob();
  if (!tokenBlob.ok) {
    console.error("[trabalho/fotos] sem token do Blob:", tokenBlob.motivo);
    return NextResponse.json({ error: "O armazenamento de fotografias não está configurado." }, { status: 503 });
  }

  const extensao = veredicto.tipo.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const chave = `trabalhos/${negociacaoId}/${randomUUID()}.${extensao}`;
  try {
    const blob = await put(chave, ficheiro, {
      access: "public",
      contentType: veredicto.tipo,
      addRandomSuffix: false,
      ...(tokenBlob.modo === "token" ? { token: tokenBlob.token } : { storeId: tokenBlob.storeId }),
    });
    return NextResponse.json({ url: blob.url, name: ficheiro.name, size: ficheiro.size, type: veredicto.tipo });
  } catch (e) {
    console.error("[trabalho/fotos] falhou:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível guardar a fotografia." }, { status: 500 });
  }
}
