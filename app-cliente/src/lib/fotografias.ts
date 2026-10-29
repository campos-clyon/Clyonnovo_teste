import { FileSystemUploadType, getInfoAsync, uploadAsync } from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { CABECALHO_DA_VERSAO, pedir, SITE, versaoDestaApp } from "./api";
import { ErroDaApi } from "./erros";
import { lerToken } from "./sessao";

/**
 * AS FOTOGRAFIAS DO PEDIDO (E3.3).
 *
 * Cada uma é reduzida no telemóvel antes de sair (o lado maior a 1920 px,
 * JPEG — converte também o HEIC do iPhone) e segue sozinha, logo depois de
 * escolhida: uma que falhe pode repetir-se sem perder as outras.
 *
 * O caminho principal é o envio directo para o armazenamento
 * (`POST /api/blob/presign` → `PUT` no endereço assinado), sem o limite de
 * 4,5 MB da Vercel; de recurso, `POST /api/simulador/upload-fotos`.
 */

const LADO_MAXIMO = 1920;
const NAS_DEFINICOES = Platform.OS === "ios" ? "em Definições › CLYON" : "em Definições › Aplicações › CLYON";

export type FotografiaReduzida = { uri: string; nome: string; tipo: string; tamanho: number };

export async function escolherFotografias(
  origem: "camara" | "galeria",
  quantas: number,
): Promise<{ fotografias: ImagePicker.ImagePickerAsset[] } | { erro: string }> {
  let r: ImagePicker.ImagePickerResult;
  try {
    if (origem === "camara") {
      const p = await ImagePicker.requestCameraPermissionsAsync();
      if (!p.granted) return { erro: `A app não tem acesso à câmara. Autorize-o nas definições do telemóvel, ${NAS_DEFINICOES}.` };
      r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
    } else {
      r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: quantas > 1,
        selectionLimit: Math.max(1, quantas),
        quality: 1,
      });
    }
  } catch {
    return { erro: "Não foi possível abrir a câmara ou as fotografias. Tente outra vez." };
  }
  return { fotografias: r.canceled || !r.assets ? [] : r.assets.slice(0, Math.max(0, quantas)) };
}

export async function reduzirFotografia(a: ImagePicker.ImagePickerAsset): Promise<FotografiaReduzida> {
  const contexto = ImageManipulator.manipulate(a.uri);
  try {
    const lado = Math.max(a.width || 0, a.height || 0);
    if (lado > LADO_MAXIMO) contexto.resize(a.width >= a.height ? { width: LADO_MAXIMO } : { height: LADO_MAXIMO });
    const imagem = await contexto.renderAsync();
    try {
      const r = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
      let tamanho = 0;
      try {
        const info = await getInfoAsync(r.uri);
        tamanho = info.exists && typeof info.size === "number" ? info.size : 0;
      } catch {
        tamanho = 0;
      }
      return { uri: r.uri, nome: `fotografia-${Date.now()}.jpg`, tipo: "image/jpeg", tamanho: tamanho || 1 };
    } finally {
      imagem.release();
    }
  } finally {
    contexto.release();
  }
}

/** «Repetir» de uma que se perdeu antes de reduzida: reduz a partir do endereço, medindo-a primeiro. */
export async function reduzirFotografiaDoEndereco(uri: string): Promise<FotografiaReduzida> {
  const contexto = ImageManipulator.manipulate(uri);
  let largura = 0;
  let altura = 0;
  try {
    const imagem = await contexto.renderAsync();
    largura = imagem.width;
    altura = imagem.height;
    imagem.release();
  } finally {
    contexto.release();
  }
  return reduzirFotografia({ uri, width: largura, height: altura } as ImagePicker.ImagePickerAsset);
}

async function pelaUrlAssinada(f: FotografiaReduzida): Promise<string> {
  const a = await pedir<{ url?: string; tipo?: string }>("/api/blob/presign", {
    metodo: "POST",
    corpo: { nome: f.nome, tipo: f.tipo, tamanho: f.tamanho },
  });
  if (!a.url) throw new ErroDaApi("O envio da fotografia não foi autorizado.", 500);
  const r = await uploadAsync(a.url, f.uri, {
    httpMethod: "PUT",
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": a.tipo ?? f.tipo },
  });
  if (r.status < 200 || r.status >= 300) throw new ErroDaApi("O armazenamento recusou a fotografia.", r.status);
  const corpo = JSON.parse(r.body || "{}") as { url?: string };
  if (!corpo.url) throw new ErroDaApi("A fotografia subiu, mas sem endereço.", 500);
  return corpo.url;
}

async function pelaNossaFuncao(f: FotografiaReduzida): Promise<string> {
  const corpo = new FormData();
  // O React Native lê o ficheiro do disco a partir de {uri, name, type}.
  corpo.append("fotos", { uri: f.uri, name: f.nome, type: f.tipo } as unknown as Blob);
  const cabecalhos: Record<string, string> = { Accept: "application/json", [CABECALHO_DA_VERSAO]: versaoDestaApp() };
  const token = await lerToken();
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  const r = await fetch(`${SITE}/api/simulador/upload-fotos`, { method: "POST", headers: cabecalhos, body: corpo });
  const d = (await r.json().catch(() => null)) as { files?: Array<{ url?: string }>; error?: string } | null;
  const url = d?.files?.[0]?.url;
  if (!r.ok || !url) throw new ErroDaApi(d?.error ?? "A fotografia não seguiu. Tente outra vez.", r.status);
  return url;
}

/** Envia uma fotografia já reduzida e devolve o endereço que vai no pedido. */
export async function enviarFotografia(f: FotografiaReduzida): Promise<string> {
  try {
    return await pelaUrlAssinada(f);
  } catch (e) {
    if (e instanceof ErroDaApi && e.estado === 429) throw e;
    try {
      return await pelaNossaFuncao(f);
    } catch {
      throw new ErroDaApi("A fotografia não seguiu. Tente outra vez.", 0);
    }
  }
}

/**
 * UM VÍDEO DA GALERIA (E3 v3) — como no simulador do site: segue tal como
 * está (sem reduzir), pela mesma URL assinada e com o tipo do vídeo. O site
 * confere o tipo e o tamanho (`tipo-ficheiro.ts`, a rota do presign); se o
 * recusar, a frase dele aparece. No pedido, os vídeos abrem no navegador.
 */
export const DURACAO_MAXIMA_DO_VIDEO_S = 60;

export async function escolherVideo(): Promise<{ video: FotografiaReduzida | null } | { erro: string }> {
  let r: ImagePicker.ImagePickerResult;
  try {
    r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], allowsMultipleSelection: false, videoMaxDuration: DURACAO_MAXIMA_DO_VIDEO_S });
  } catch {
    return { erro: "Não foi possível abrir os vídeos. Tente outra vez." };
  }
  const a = r.canceled ? null : r.assets?.[0];
  if (!a) return { video: null };
  const tipo = a.mimeType && a.mimeType.startsWith("video/") ? a.mimeType : "video/mp4";
  const extensao = tipo === "video/quicktime" ? "mov" : tipo === "video/webm" ? "webm" : "mp4";
  return { video: { uri: a.uri, nome: `video-${Date.now()}.${extensao}`, tipo, tamanho: a.fileSize && a.fileSize > 0 ? a.fileSize : 1 } };
}
