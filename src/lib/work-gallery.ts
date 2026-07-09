import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getDb, getGalleryMediaItems, replaceGalleryMediaItems } from "@/lib/db";

export const gallerySections = ["hero", "showcase"] as const;
export const galleryPhases = ["before", "during", "after"] as const;

export type GallerySection = (typeof gallerySections)[number];
export type GalleryPhase = (typeof galleryPhases)[number];

export type GalleryItem = {
  id: string;
  section: GallerySection;
  title: string;
  subtitle?: string;
  description?: string;
  alt: string;
  imageUrl: string;
  order: number;
  isActive: boolean;
  projectKey?: string;
  phase?: GalleryPhase;
};

function resolveGalleryImageUrl(item: GalleryItem) {
  if (item.imageUrl.startsWith("data:image/")) {
    return `/api/media/gallery/render/${item.id}?v=${galleryImageVersion(item.imageUrl)}`;
  }

  return item.imageUrl;
}

function galleryImageVersion(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16);
}

type GalleryData = {
  items: GalleryItem[];
};

type GalleryItemInput = Omit<GalleryItem, "id"> & { id?: string };

const defaultGalleryData: GalleryData = {
  items: [
    {
      id: "hero-entulho",
      section: "hero",
      title: "Recolha de Entulho",
      subtitle: "Exemplo inicial para substituir no painel",
      description: "Imagem inicial enquanto as fotos reais são carregadas no painel.",
      alt: "Recolha de entulho",
      imageUrl: "/images/service-1.webp",
      order: 1,
      isActive: true,
      projectKey: "recolha-entulho",
    },
    {
      id: "hero-moveis",
      section: "hero",
      title: "Recolha de Móveis",
      subtitle: "Exemplo inicial para substituir no painel",
      description: "Imagem inicial enquanto as fotos reais são carregadas no painel.",
      alt: "Recolha de móveis",
      imageUrl: "/images/service-2.webp",
      order: 2,
      isActive: true,
      projectKey: "recolha-moveis",
    },
    {
      id: "hero-mudancas",
      section: "hero",
      title: "Mudanças Completas",
      subtitle: "Exemplo inicial para substituir no painel",
      description: "Imagem inicial enquanto as fotos reais são carregadas no painel.",
      alt: "Mudanças completas",
      imageUrl: "/images/service-3.webp",
      order: 3,
      isActive: true,
      projectKey: "mudancas-completas",
    },
    {
      id: "hero-esvaziamento",
      section: "hero",
      title: "Esvaziamento de Casas",
      subtitle: "Exemplo inicial para substituir no painel",
      description: "Imagem inicial enquanto as fotos reais são carregadas no painel.",
      alt: "Esvaziamento de casa",
      imageUrl: "/images/service-4.webp",
      order: 4,
      isActive: true,
      projectKey: "esvaziamento-casas",
    },
    {
      id: "showcase-entulho",
      section: "showcase",
      title: "Recolha de Entulho",
      subtitle: "Caso inicial",
      description: "Substitua esta imagem por uma foto real de antes ou depois no painel.",
      alt: "Caso inicial de recolha de entulho",
      imageUrl: "/images/service-1.webp",
      order: 1,
      isActive: true,
      projectKey: "recolha-entulho",
    },
    {
      id: "showcase-moveis",
      section: "showcase",
      title: "Recolha de Móveis",
      subtitle: "Caso inicial",
      description: "Substitua esta imagem por uma foto real de antes ou depois no painel.",
      alt: "Caso inicial de recolha de móveis",
      imageUrl: "/images/service-2.webp",
      order: 2,
      isActive: true,
      projectKey: "recolha-moveis",
    },
    {
      id: "showcase-mudancas",
      section: "showcase",
      title: "Mudanças Completas",
      subtitle: "Caso inicial",
      description: "Substitua esta imagem por uma foto real de antes ou depois no painel.",
      alt: "Caso inicial de mudanças",
      imageUrl: "/images/service-3.webp",
      order: 3,
      isActive: true,
      projectKey: "mudancas-completas",
    },
    {
      id: "showcase-esvaziamento",
      section: "showcase",
      title: "Esvaziamento de Casas",
      subtitle: "Caso inicial",
      description: "Substitua esta imagem por uma foto real de antes ou depois no painel.",
      alt: "Caso inicial de esvaziamento de casa",
      imageUrl: "/images/service-4.webp",
      order: 4,
      isActive: true,
      projectKey: "esvaziamento-casas",
    },
  ],
};

const GALLERY_DATA_PATH = path.join(process.cwd(), "data", "work-gallery.json");
const GALLERY_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "work-gallery");

function sortItems(items: GalleryItem[]) {
  return [...items].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

async function ensureGalleryStorage() {
  await fs.mkdir(path.dirname(GALLERY_DATA_PATH), { recursive: true });
  await fs.mkdir(GALLERY_UPLOAD_DIR, { recursive: true });

  try {
    await fs.access(GALLERY_DATA_PATH);
  } catch {
    await fs.writeFile(GALLERY_DATA_PATH, JSON.stringify({ items: [] }, null, 2), "utf8");
  }
}

async function ensureGalleryUploadStorage() {
  await fs.mkdir(path.dirname(GALLERY_DATA_PATH), { recursive: true });
  await fs.mkdir(GALLERY_UPLOAD_DIR, { recursive: true });
}

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function normalizeItems(items: GalleryItem[]) {
  return sortItems(
    (items || []).map((item) => ({
      ...item,
      subtitle: item.subtitle || "",
      description: item.description || "",
      projectKey: item.projectKey || "",
    })),
  );
}

export async function readGalleryData() {
  const db = await getDb();

  if (db) {
    try {
      const items = await getGalleryMediaItems();

      if (items.length === 0) {
        await replaceGalleryMediaItems(defaultGalleryData.items);
        return {
          items: normalizeItems(defaultGalleryData.items),
        };
      }

      return {
        items: normalizeItems(
          items.map((item) => ({
            id: item.id,
            section: item.section as GallerySection,
            title: item.title,
            subtitle: item.subtitle || "",
            description: item.description || "",
            alt: item.alt,
            imageUrl: item.imageUrl,
            order: Number(item.order || 1),
            isActive: Boolean(item.isActive),
            projectKey: item.projectKey || "",
            phase: (item.phase as GalleryPhase | null) || undefined,
          })),
        ),
      };
    } catch {
      return {
        items: normalizeItems(defaultGalleryData.items),
      };
    }
  }

  try {
    const content = await fs.readFile(GALLERY_DATA_PATH, "utf8");
    const parsed = JSON.parse(content) as GalleryData;

    return {
      items: normalizeItems(parsed.items || []),
    };
  } catch {
    return {
      items: normalizeItems(defaultGalleryData.items),
    };
  }
}

export async function writeGalleryData(data: GalleryData) {
  const db = await getDb();
  const normalized = {
    items: sortItems(data.items).map((item) => ({
      ...item,
      subtitle: item.subtitle || "",
      description: item.description || "",
      projectKey: item.projectKey || "",
    })),
  };

  if (db) {
    await replaceGalleryMediaItems(normalized.items);
    return normalized;
  }

  await ensureGalleryStorage();
  await fs.writeFile(GALLERY_DATA_PATH, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

export function normalizeGalleryItem(input: GalleryItemInput) {
  return {
    id: input.id || randomUUID(),
    section: input.section,
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || "",
    description: input.description?.trim() || "",
    alt: input.alt.trim(),
    imageUrl: input.imageUrl.trim(),
    order: Number.isFinite(input.order) ? input.order : 1,
    isActive: Boolean(input.isActive),
    projectKey: input.projectKey?.trim() || "",
    phase: input.phase || undefined,
  } satisfies GalleryItem;
}

export async function listGalleryItems(section?: GallerySection) {
  const data = await readGalleryData();
  return section ? data.items.filter((item) => item.section === section) : data.items;
}

export async function listPublicGalleryItems(section?: GallerySection) {
  const items = await listGalleryItems(section);
  return items.filter((item) => item.isActive);
}

export async function createGalleryItem(input: GalleryItemInput) {
  const data = await readGalleryData();
  const item = normalizeGalleryItem(input);
  data.items.push(item);
  await writeGalleryData(data);
  return item;
}

export async function updateGalleryItem(id: string, input: Partial<GalleryItemInput>) {
  const data = await readGalleryData();
  const index = data.items.findIndex((item) => item.id === id);

  if (index < 0) {
    throw new Error("Imagem não encontrada");
  }

  const current = data.items[index];
  const next = normalizeGalleryItem({
    ...current,
    ...input,
    id,
  });

  data.items[index] = next;
  await writeGalleryData(data);
  return next;
}

export async function deleteGalleryItem(id: string) {
  const data = await readGalleryData();
  const item = data.items.find((entry) => entry.id === id);

  if (!item) {
    throw new Error("Imagem não encontrada");
  }

  data.items = data.items.filter((entry) => entry.id !== id);
  await writeGalleryData(data);

  if (item.imageUrl.startsWith("/uploads/work-gallery/")) {
    const filePath = path.join(process.cwd(), "public", item.imageUrl.replace(/^\//, ""));
    await fs.unlink(filePath).catch(() => undefined);
  }

  return item;
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function extensionFromFileName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  return ext || ".jpg";
}

export async function saveGalleryFile(file: File, hint?: string) {
  // 1. Blob upload desativado temporariamente (store privada, access: "public" incompatível)
  // if (process.env.BLOB_READ_WRITE_TOKEN) {
  //   const baseName = sanitizeFileName(hint || file.name || "imagem");
  //   const fileName = `${Date.now()}-${baseName || "imagem"}${extensionFromFileName(file.name)}`;
  //   const blob = await put(`work-gallery/${fileName}`, file, { access: "public" });
  //   return blob.url;
  // }

  // 2. Se a DB estiver ligada mas sem Blob, guardar como data URL na BD
  const db = await getDb();
  if (db) {
    return fileToDataUrl(file);
  }

  // 3. Fallback: disco local (não persistente em Vercel, só para dev)
  await ensureGalleryUploadStorage();
  const buffer = Buffer.from(await file.arrayBuffer());
  const baseName = sanitizeFileName(hint || file.name || "imagem");
  const fileName = `${Date.now()}-${baseName || "imagem"}${extensionFromFileName(file.name)}`;
  const filePath = path.join(GALLERY_UPLOAD_DIR, fileName);
  await fs.writeFile(filePath, buffer);
  return `/uploads/work-gallery/${fileName}`;
}

export async function replaceGalleryFile(previousUrl: string, file: File, hint?: string) {
  const nextUrl = await saveGalleryFile(file, hint);

  // Limpar ficheiro antigo se aplicável
  // if (previousUrl.startsWith("https://") && previousUrl.includes(".blob.vercel-storage.com")) {
  //   // URL do Blob — apagar via API (Blob desativado)
  //   // try { await del(previousUrl); } catch { /* silencioso */ }
  // } else if (previousUrl.startsWith("/uploads/work-gallery/")) {
  if (previousUrl.startsWith("/uploads/work-gallery/")) {
    // Ficheiro local
    const previousPath = path.join(process.cwd(), "public", previousUrl.replace(/^\//, ""));
    await fs.unlink(previousPath).catch(() => undefined);
  }

  return nextUrl;
}

export async function getHeroCarouselImages() {
  const items = await listPublicGalleryItems("hero");
  return items.map((item) => ({
    url: resolveGalleryImageUrl(item),
    alt: item.alt,
    title: item.title,
    subtitle:
      item.subtitle || (item.phase ? `${phaseLabel(item.phase)} · Trabalhos reais` : "Trabalhos reais"),
  }));
}

export async function getShowcaseProjects() {
  const items = await listPublicGalleryItems("showcase");
  const groups = new Map<string, GalleryItem[]>();

  for (const item of items) {
    const key = item.projectKey || item.id;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, group]) => {
    const orderedItems = sortItems(group);
    const first = orderedItems[0];

    return {
      id: key,
      title: first?.title || "Trabalho real",
      subtitle: first?.subtitle || "",
      description: first?.description || "",
      items: orderedItems.map((item) => ({
        ...item,
        imageUrl: resolveGalleryImageUrl(item),
      })),
    };
  });
}

export function phaseLabel(phase?: GalleryPhase) {
  if (phase === "before") return "Antes";
  if (phase === "during") return "Durante";
  if (phase === "after") return "Depois";
  return "";
}
