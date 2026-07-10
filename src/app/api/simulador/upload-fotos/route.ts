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
        { error: "UPLOAD_DISABLED", message: "Vercel Blob não está configurado." },
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

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: `Ficheiro "${file.name}" maior que 30MB.` }, { status: 413 });
      }
      if (file.type && !ALLOWED_MIME.has(file.type)) {
        return NextResponse.json({ error: `Tipo não permitido: ${file.type}` }, { status: 415 });
      }

      const safeName = file.name.replace(/[^\w.\-]/g, "_").slice(-80);
      const key = `simulador/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

      const blob = await put(key, file, {
        access: "public",
        contentType: file.type || "application/octet-stream",
        addRandomSuffix: false,
      });

      uploaded.push({
        url: blob.url,
        name: file.name,
        size: file.size,
        type: file.type,
      });
    }

    return NextResponse.json({
      ok: true,
      urls: uploaded.map((f) => f.url),
      files: uploaded,
    });
  } catch (err) {
    console.error("[upload-fotos] erro:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro no upload." },
      { status: 500 }
    );
  }
}
