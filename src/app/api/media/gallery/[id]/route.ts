import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import {
  deleteGalleryItem,
  galleryPhases,
  gallerySections,
  listGalleryItems,
  replaceGalleryFile,
  updateGalleryItem,
} from "@/lib/work-gallery";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

async function requireAdmin(request: NextRequest) {
  const colaborador = await verifyColaboradorAuthHeader(request.headers.get("authorization"));

  if (!colaborador) {
    return { error: jsonError("Não autorizado", 401) };
  }

  if (!colaborador.isAdmin) {
    return { error: jsonError("Acesso negado", 403) };
  }

  return { colaborador };
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const existing = (await listGalleryItems()).find((item) => item.id === id);

  if (!existing) {
    return jsonError("Imagem não encontrada", 404);
  }

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const section = String(formData.get("section") || existing.section);
    const phase = String(formData.get("phase") || existing.phase || "");
    const title = String(formData.get("title") || existing.title);
    const alt = String(formData.get("alt") || existing.alt);

    if (!gallerySections.includes(section as (typeof gallerySections)[number])) {
      return jsonError("Secção inválida");
    }

    if (phase && !galleryPhases.includes(phase as (typeof galleryPhases)[number])) {
      return jsonError("Fase inválida");
    }

    let imageUrl = existing.imageUrl;
    const file = formData.get("file");

    if (file instanceof File && file.size > 0) {
      imageUrl = await replaceGalleryFile(existing.imageUrl, file, title);
    }

    const item = await updateGalleryItem(id, {
      section: section as (typeof gallerySections)[number],
      title,
      subtitle: String(formData.get("subtitle") || ""),
      description: String(formData.get("description") || ""),
      alt,
      imageUrl,
      order: Number(formData.get("order") || existing.order),
      isActive: String(formData.get("isActive") || String(existing.isActive)) === "true",
      projectKey: String(formData.get("projectKey") || ""),
      phase: phase ? (phase as (typeof galleryPhases)[number]) : undefined,
    });

    revalidatePath("/");
    revalidatePath("/trabalhos");

    return NextResponse.json({ item });
  }

  const body = await request.json();
  const section = String(body.section || existing.section);
  const phase = String(body.phase || existing.phase || "");
  const title = String(body.title || existing.title);
  const alt = String(body.alt || existing.alt);

  if (!gallerySections.includes(section as (typeof gallerySections)[number])) {
    return jsonError("Secção inválida");
  }

  if (phase && !galleryPhases.includes(phase as (typeof galleryPhases)[number])) {
    return jsonError("Fase inválida");
  }

  const item = await updateGalleryItem(id, {
    section: section as (typeof gallerySections)[number],
    title,
    subtitle: String(body.subtitle ?? existing.subtitle ?? ""),
    description: String(body.description ?? existing.description ?? ""),
    alt,
    imageUrl: String(body.imageUrl || existing.imageUrl),
    order: Number(body.order ?? existing.order),
    isActive: typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
    projectKey: String(body.projectKey ?? existing.projectKey ?? ""),
    phase: phase ? (phase as (typeof galleryPhases)[number]) : undefined,
  });

  revalidatePath("/");
  revalidatePath("/trabalhos");

  return NextResponse.json({ item });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  await deleteGalleryItem(id);

  revalidatePath("/");
  revalidatePath("/trabalhos");

  return NextResponse.json({ success: true });
}
