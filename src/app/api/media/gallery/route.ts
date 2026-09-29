import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { requireAdminGeral } from "@/lib/admin-auth-helper";
import {
  createGalleryItem,
  galleryPhases,
  gallerySections,
  listGalleryItems,
  saveGalleryFile,
  imagemDataUrlPermitida,
} from "@/lib/work-gallery";

export const runtime = "nodejs";

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// Pelo `requireAdminGeral`, que confirma a conta na base em cada chamada: a
// assinatura do token sozinha deixava entrar uma conta já desactivada, ou um
// token de antes de a palavra-passe mudar. Ver `conta-do-painel.ts`.
async function requireAdmin(request: NextRequest) {
  const { err, colab } = await requireAdminGeral(request);
  if (err) return { error: err };
  return { colaborador: colab };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const items = await listGalleryItems();
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return jsonError("Selecione uma imagem para enviar");
    }

    const section = String(formData.get("section") || "");
    const phase = String(formData.get("phase") || "");
    const title = String(formData.get("title") || "");
    const alt = String(formData.get("alt") || "");

    if (!gallerySections.includes(section as (typeof gallerySections)[number])) {
      return jsonError("Secção inválida");
    }

    if (phase && !galleryPhases.includes(phase as (typeof galleryPhases)[number])) {
      return jsonError("Fase inválida");
    }

    if (!title.trim() || !alt.trim()) {
      return jsonError("Título e texto alternativo são obrigatórios");
    }

    const imageUrl = await saveGalleryFile(file, title);

    const item = await createGalleryItem({
      section: section as (typeof gallerySections)[number],
      title,
      subtitle: String(formData.get("subtitle") || ""),
      description: String(formData.get("description") || ""),
      alt,
      imageUrl,
      order: Number(formData.get("order") || 1),
      isActive: String(formData.get("isActive") || "true") === "true",
      projectKey: String(formData.get("projectKey") || ""),
      phase: phase ? (phase as (typeof galleryPhases)[number]) : undefined,
    });

    revalidatePath("/");
    revalidatePath("/trabalhos");

    return NextResponse.json({ item }, { status: 201 });
  }

  const body = await request.json();
  const section = String(body.section || "");
  const phase = String(body.phase || "");
  const title = String(body.title || "");
  const alt = String(body.alt || "");

  if (!gallerySections.includes(section as (typeof gallerySections)[number])) {
    return jsonError("Secção inválida");
  }

  if (phase && !galleryPhases.includes(phase as (typeof galleryPhases)[number])) {
    return jsonError("Fase inválida");
  }

  if (!title.trim() || !alt.trim() || !String(body.imageUrl || "").trim()) {
    return jsonError("Título, texto alternativo e URL da imagem são obrigatórios");
  }

  // Um data: URL de SVG entrava aqui e ficava alojado em clyon.pt como
  // documento com script. Recusa-se à entrada, com mensagem, em vez de rebentar
  // lá dentro no normalizeGalleryItem.
  if (!imagemDataUrlPermitida(String(body.imageUrl).trim())) {
    return jsonError("Formato de imagem não suportado. Use PNG, JPEG, WebP, GIF ou AVIF.");
  }

  const item = await createGalleryItem({
    section: section as (typeof gallerySections)[number],
    title,
    subtitle: String(body.subtitle || ""),
    description: String(body.description || ""),
    alt,
    imageUrl: String(body.imageUrl),
    order: Number(body.order || 1),
    isActive: Boolean(body.isActive),
    projectKey: String(body.projectKey || ""),
    phase: phase ? (phase as (typeof galleryPhases)[number]) : undefined,
  });

  revalidatePath("/");
  revalidatePath("/trabalhos");

  return NextResponse.json({ item }, { status: 201 });
}
