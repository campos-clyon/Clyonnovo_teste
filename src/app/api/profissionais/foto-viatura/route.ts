import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { obterTokenDoBlob } from "@/lib/blob-token";
import { tipoDoFicheiro } from "@/lib/tipo-ficheiro";
import {
  COOKIE_SESSAO_PROFISSIONAL,
  verificarSessaoDoProfissional,
} from "@/lib/profissional-auth";
import { actualizarPerfilDoProfissional } from "@/lib/db";

export const runtime = "nodejs";

/**
 * A FOTOGRAFIA DA VIATURA DELE.
 *
 * "Vamos adicionar a opção de colocar a foto do camião no perfil, para nós
 * sabermos qual é o camião/carrinha." — 14-09-2026.
 *
 * O `tipoVeiculo` já existia e diz «carrinha» ou «camião» — uma palavra que
 * não distingue uma carrinha de caixa aberta de uma fechada, e é essa
 * diferença que decide se um sofá apanha chuva a caminho. A fotografia diz
 * numa vez o que a palavra nunca disse.
 *
 * Rota própria, e não o upload do simulador: aquele é público e aceita
 * ficheiros de quem passar por lá. Este exige a sessão do profissional, grava
 * UMA fotografia, e escreve o endereço no perfil DELE — ninguém pode pôr uma
 * viatura no perfil de outro.
 */

/** Dois megabytes. Uma fotografia de telemóvel cabe; um vídeo não. */
const TAMANHO_MAXIMO = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let ficheiro: File | null = null;
  try {
    const fd = await req.formData();
    const f = fd.get("file");
    if (f instanceof File) ficheiro = f;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (!ficheiro) return NextResponse.json({ error: "Escolha uma fotografia." }, { status: 400 });

  if (ficheiro.size > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { error: "A fotografia é grande de mais (máximo 2 MB). Tire-a com menos qualidade." },
      { status: 413 },
    );
  }

  /*
   * O tipo decide-se pelo conteúdo declarado E pela extensão, como no upload
   * do simulador — não se aceita «imagem» por o nome acabar em .jpg.
   */
  const veredicto = tipoDoFicheiro(ficheiro.name, ficheiro.type);
  if (!veredicto.ok || !veredicto.tipo.startsWith("image/")) {
    return NextResponse.json(
      { error: "Só fotografias (JPG, PNG ou WEBP)." },
      { status: 415 },
    );
  }

  const tokenBlob = await obterTokenDoBlob();
  if (!tokenBlob.ok) {
    console.error("[foto-viatura] sem token do Blob:", tokenBlob.motivo);
    return NextResponse.json(
      { error: "O armazenamento de fotografias não está configurado." },
      { status: 503 },
    );
  }

  /*
   * O id do profissional no nome, e a hora a seguir. O id diz de quem é sem
   * abrir a base; a hora faz de cada envio um ficheiro novo, para a
   * fotografia antiga não ficar em cache no telemóvel de ninguém.
   */
  const chave = `viaturas/${sessao.providerId}-${Date.now()}.${veredicto.tipo.split("/")[1] ?? "jpg"}`;

  try {
    const blob = await put(chave, ficheiro, {
      access: "public",
      contentType: veredicto.tipo,
      addRandomSuffix: false,
      ...(tokenBlob.modo === "token"
        ? { token: tokenBlob.token }
        : { storeId: tokenBlob.storeId }),
    });

    // Grava-se aqui e não no ecrã seguinte: uma fotografia que sobe e não fica
    // no perfil é o pior dos dois mundos — ocupa espaço e não serve a ninguém.
    await actualizarPerfilDoProfissional(sessao.providerId, { fotoViaturaUrl: blob.url });

    return NextResponse.json({ ok: true, url: blob.url });
  } catch (e) {
    console.error("[foto-viatura] falhou:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível guardar a fotografia." }, { status: 500 });
  }
}
