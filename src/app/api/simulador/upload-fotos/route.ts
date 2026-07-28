import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);
const MAX_SIZE = 30 * 1024 * 1024; // 30 MB por ficheiro

/**
 * POST /api/simulador/upload-fotos
 * multipart/form-data — aceita campos "fotos" (múltiplos) ou "file" (single).
 * Devolve { urls: string[], files: Array<{ url, name, size, type }> }.
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          error: "UPLOAD_DISABLED",
          message: "O armazenamento de fotos não está configurado neste ambiente.",
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
      if (file.type && !ALLOWED_MIME.has(file.type)) {
        falhados.push({ name: file.name, motivo: `formato não suportado (${file.type})` });
        continue;
      }

      const safeName = file.name.replace(/[^\w.\-]/g, "_").slice(-80);
      const key = `simulador/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

      try {
        const blob = await put(key, file, {
          access: "public",
          contentType: file.type || "application/octet-stream",
          addRandomSuffix: false,
        });
        uploaded.push({ url: blob.url, name: file.name, size: file.size, type: file.type });
      } catch (err) {
        console.error("[upload-fotos] falhou um ficheiro:", file.name, err);
        falhados.push({ name: file.name, motivo: "erro ao guardar" });
      }
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro no upload." },
      { status: 500 }
    );
  }
}
