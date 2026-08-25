import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";

export const runtime = "nodejs";

/**
 * Entregar uma foto do Blob para descarregar — pela NOSSA origem.
 *
 * O QUE ACONTECIA SEM ISTO
 *
 * O botão ia buscar a foto directamente ao Blob com fetch(), e o Blob da
 * Vercel não manda cabeçalhos CORS: o fetch falhava, caía no plano B (abrir
 * num separador), e o bloqueador de popups engolia tudo a partir do segundo.
 * "Descarregar todas (6)" abria duas fotos e não descarregava nenhuma.
 *
 * Pela nossa origem não há CORS nenhum, e o Content-Disposition: attachment
 * diz ao browser que isto é para GUARDAR, não para mostrar.
 *
 * O GUARDA CONTRA SSRF
 *
 * Um proxy que vai buscar "o URL que vier no query" é uma porta para pôr o
 * servidor a bater onde nós nunca bateríamos — endpoints internos, metadados
 * da cloud. Só se aceita o anfitrião do NOSSO armazenamento de fotos, por
 * sufixo do domínio, e só https.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const cru = req.nextUrl.searchParams.get("url") ?? "";
  const nome = (req.nextUrl.searchParams.get("nome") ?? "foto").replace(/[^\w.-]/g, "_");

  let alvo: URL;
  try {
    alvo = new URL(cru);
  } catch {
    return NextResponse.json({ error: "URL inválido" }, { status: 400 });
  }
  if (alvo.protocol !== "https:" || !alvo.hostname.endsWith(".public.blob.vercel-storage.com")) {
    return NextResponse.json({ error: "Só fotos do armazenamento CLYON" }, { status: 400 });
  }

  try {
    const resposta = await fetch(alvo.toString());
    if (!resposta.ok || !resposta.body) {
      return NextResponse.json({ error: "A foto não está acessível" }, { status: 502 });
    }
    const tipo = resposta.headers.get("content-type") ?? "application/octet-stream";
    const extensao =
      alvo.pathname.match(/\.(jpe?g|png|gif|webp|avif|heic|mp4|mov|webm)$/i)?.[1] ??
      (tipo.split("/")[1] || "jpg");
    return new Response(resposta.body, {
      headers: {
        "Content-Type": tipo,
        "Content-Disposition": `attachment; filename="${nome}.${extensao}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[admin/fotos]", error);
    return NextResponse.json({ error: "Erro ao ir buscar a foto" }, { status: 502 });
  }
}
