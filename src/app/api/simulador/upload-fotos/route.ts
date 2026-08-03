import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { tipoDoFicheiro } from "@/lib/tipo-ficheiro";
import { obterTokenDoBlob } from "@/lib/blob-token";

export const runtime = "nodejs";
export const maxDuration = 60;

// A lista de tipos aceites vive em src/lib/tipo-ficheiro.ts, que também
// sabe deduzir pela extensão quando o browser não declara nada.
const MAX_SIZE = 30 * 1024 * 1024; // 30 MB por ficheiro
const MAX_FICHEIROS = 20; // por pedido — um cliente não envia mais que isto

/**
 * A mensagem de erro do SDK, sem nada que se pareça com uma credencial.
 *
 * Isto sai numa resposta HTTP de uma rota pública. Um token do Vercel Blob
 * começa por `vercel_blob_rw_`; qualquer coisa com essa forma é apagada antes
 * de sair daqui, aconteça o que acontecer à mensagem do SDK no futuro.
 */
function limparSegredos(err: unknown): string {
  const bruto = err instanceof Error ? err.message : String(err);
  return bruto
    .replace(/vercel_blob_rw_[A-Za-z0-9_-]+/g, "[token]")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[valor removido]")
    .slice(0, 200);
}

/**
 * POST /api/simulador/upload-fotos
 * multipart/form-data — aceita campos "fotos" (múltiplos) ou "file" (single).
 * Devolve { urls: string[], files: Array<{ url, name, size, type }> }.
 */
export async function POST(request: NextRequest) {
  try {
    // Rota aberta por necessidade — quem preenche o simulador ainda não tem
    // conta. Sem limite, era gravar ficheiros de 30 MB num bucket público em
    // ciclo, à nossa conta. 10 lotes por IP a cada 5 minutos chega para quem
    // está mesmo a pedir um orçamento.
    const rl = await checkRateLimit(`upload-fotos:${getClientIp(request)}`, 10, 300);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Demasiados envios. Aguarde um momento e tente novamente." },
        { status: 429, headers: { "Retry-After": "300" } },
      );
    }

    // O nome da variável depende do prefixo com que o store foi ligado — ver
    // blob-token.ts. Procurar só por BLOB_READ_WRITE_TOKEN dava "não
    // configurado" com o store ligado ali ao lado, e nenhuma foto era gravada.
    const tokenBlob = obterTokenDoBlob();
    if (!tokenBlob.ok) {
      console.error("[upload-fotos] sem token de escrita:", tokenBlob.motivo);
      return NextResponse.json(
        {
          error: "UPLOAD_DISABLED",
          message: "O armazenamento de fotos não está configurado neste ambiente.",
          motivoTecnico: tokenBlob.motivo,
          falhados: [], recebidos: 0, files: [], urls: [],
        },
        { status: 501 }
      );
    }

    const form = await request.formData();
    const raw = [...form.getAll("fotos"), ...form.getAll("file")];
    const files = raw.filter((v): v is File => v instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "Nenhum ficheiro recebido." }, { status: 400 });
    }
    if (files.length > MAX_FICHEIROS) {
      return NextResponse.json(
        { error: `Máximo de ${MAX_FICHEIROS} ficheiros por envio.` },
        { status: 400 },
      );
    }

    const uploaded: Array<{ url: string; name: string; size: number; type: string }> = [];
    const falhados: Array<{ name: string; motivo: string }> = [];

    // Um ficheiro a mais de 30MB, ou um formato que o telemóvel gravou de
    // forma estranha, derrubava o lote inteiro — e o cliente ficava sem
    // NENHUMA foto, sem aviso nenhum. Cada ficheiro passa a valer por si.
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        falhados.push({ name: file.name, motivo: "maior que 30 MB" });
        continue;
      }
      // O tipo continua a sair de uma lista fechada, mas se o browser não o
      // declarar olhamos para a extensão em vez de recusar. Exigir o tipo
      // declarado recusava fotos legítimas — o `type` de um File vem do
      // browser e nem sempre vem preenchido (ver tipo-ficheiro.ts).
      const veredicto = tipoDoFicheiro(file.name, file.type);
      if (!veredicto.ok) {
        falhados.push({ name: file.name, motivo: veredicto.motivo });
        continue;
      }
      const tipo = veredicto.tipo;

      const safeName = file.name.replace(/[^\w.\-]/g, "_").slice(-80);
      const key = `simulador/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

      try {
        const blob = await put(key, file, {
          access: "public",
          contentType: tipo,
          addRandomSuffix: false,
          // Explícito: sem isto o SDK só olha para BLOB_READ_WRITE_TOKEN, e o
          // nosso pode chamar-se outra coisa.
          token: tokenBlob.token,
        });
        uploaded.push({ url: blob.url, name: file.name, size: file.size, type: file.type });
      } catch (err) {
        console.error("[upload-fotos] falhou um ficheiro:", file.name, err);
        // "erro ao guardar" e mais nada obrigava a adivinhar de que lado
        // estava o problema — token errado, store errado, sem permissão de
        // escrita. A frase do SDK diz qual é. Vai sem o token lá dentro: as
        // mensagens do Vercel Blob às vezes ecoam o que receberam, e isto sai
        // numa resposta HTTP pública.
        falhados.push({ name: file.name, motivo: `erro ao guardar: ${limparSegredos(err)}` });
      }
    }

    // Sem isto, uma falha só se via no pedido do cliente — e só se alguém
    // abrisse esse pedido. Nos registos aparece assim que acontece.
    if (falhados.length > 0) {
      console.error("[upload-fotos] ficheiros recusados:", falhados.map((f) => f.motivo).join(" | "));
    }

    return NextResponse.json({
      ok: uploaded.length > 0,
      urls: uploaded.map((f) => f.url),
      files: uploaded,
      // Quem chama tem de poder dizer ao cliente o que não passou
      falhados,
      recebidos: files.length,
    });
  } catch (err) {
    console.error("[upload-fotos] erro:", err);
    // Sem a mensagem crua: numa rota pública ela só serve para descrever a
    // nossa infraestrutura a quem estiver a sondá-la.
    return NextResponse.json({ error: "Erro no upload." }, { status: 500 });
  }
}
