import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { obterTokenDoBlob } from "@/lib/blob-token";
import { tamanhoMaximoDoTipo, tipoDoFicheiro } from "@/lib/tipo-ficheiro";
import { PREFIXO_DAS_FOTOGRAFIAS_DA_CANDIDATURA } from "@/lib/fotografias-da-carrinha";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * AS FOTOGRAFIAS DA CARRINHA DE QUEM SE CANDIDATA — 04-11-2026 (decisão d17).
 *
 * Quem se candidata ainda não tem conta, e por isso esta rota é aberta, como a
 * das fotografias dos pedidos (`/api/simulador/upload-fotos`). Segue as mesmas
 * guardas dela: o mesmo armazenamento (o Blob), a mesma lista de tipos
 * (`tipo-ficheiro.ts`, aqui só as imagens), o mesmo tecto por tipo, e os mesmos
 * dez envios por endereço a cada cinco minutos.
 *
 * O QUE MUDA É A PASTA: `candidaturas/`, e não `simulador/`. Uma fotografia de
 * carrinha tem a matrícula à vista, e a candidatura só aceita endereços desta
 * pasta (`fotografiaDaCandidatura`) — ninguém junta à candidatura a fotografia
 * de um pedido, nem uma imagem de outro servidor. E a limpeza dos órfãos dos
 * pedidos, que só lê `simulador/` e `trabalhos/`, não lhes toca.
 *
 * Um ficheiro por envio: o formulário manda-os um a um, e cada um vale por si.
 * Devolve só o endereço do que acabou de subir, a quem o subiu.
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "candidatura-fotografias", 10, 300);
  if (limite.erro) return limite.erro;

  let ficheiro: File | null = null;
  try {
    const fd = await req.formData();
    const f = fd.get("file") ?? fd.get("fotos");
    if (f instanceof File) ficheiro = f;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (!ficheiro || ficheiro.size === 0) {
    return NextResponse.json({ error: "Escolha uma fotografia." }, { status: 400 });
  }

  // O tipo pelo declarado E pela extensão, como nos pedidos — e só imagens.
  const veredicto = tipoDoFicheiro(ficheiro.name, ficheiro.type);
  // O GIF fica de fora: é animação, e não fotografia de carrinha nenhuma.
  if (!veredicto.ok || !veredicto.tipo.startsWith("image/") || veredicto.tipo === "image/gif") {
    return NextResponse.json({ error: "Só fotografias (JPG, PNG, WEBP ou HEIC)." }, { status: 415 });
  }

  if (ficheiro.size > tamanhoMaximoDoTipo(veredicto.tipo)) {
    return NextResponse.json(
      { error: "A fotografia é grande de mais. Tire-a com menos qualidade ou escolha outra." },
      { status: 413 },
    );
  }

  const tokenBlob = obterTokenDoBlob();
  if (!tokenBlob.ok) {
    console.error("[candidatura/fotografias] sem token do Blob:", tokenBlob.motivo);
    return NextResponse.json(
      { error: "Não foi possível guardar a fotografia agora. Tente outra vez daqui a pouco." },
      { status: 503 },
    );
  }

  /*
   * Um nome que não se adivinha: o endereço é público, e é o nome que o
   * esconde. Sem o nome original do ficheiro — às vezes traz o de quem o tirou.
   */
  const extensao = veredicto.tipo.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const chave = `${PREFIXO_DAS_FOTOGRAFIAS_DA_CANDIDATURA}${randomUUID()}.${extensao}`;

  try {
    const blob = await put(chave, ficheiro, {
      access: "public",
      contentType: veredicto.tipo,
      addRandomSuffix: false,
      ...(tokenBlob.modo === "token" ? { token: tokenBlob.token } : { storeId: tokenBlob.storeId }),
    });
    return NextResponse.json({ ok: true, url: blob.url });
  } catch (e) {
    // Sem a mensagem crua: numa rota pública ela só descreve a infraestrutura.
    console.error("[candidatura/fotografias] falhou:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível guardar a fotografia." }, { status: 500 });
  }
}
