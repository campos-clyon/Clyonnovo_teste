/**
 * O servidor só vai buscar imagens a sítios que nós escolhemos.
 *
 * PORQUÊ ISTO EXISTE
 *
 * A rota de análise recebia um `previewUrl` do corpo do pedido e fazia
 * `fetch(previewUrl)` direto, sem autenticação a montante. Isso transformava
 * o servidor da CLYON num proxy: qualquer pessoa podia pedir-lhe que fosse
 * buscar `http://127.0.0.1:6379`, `http://10.0.0.5:8080` ou qualquer endereço
 * da rede interna, e distinguir "respondeu" de "não respondeu" pela mensagem
 * que voltava na resposta (SSRF com oráculo). Servia também para fazer pedidos
 * a terceiros a partir do nosso IP.
 *
 * No tráfego legítimo este caminho quase não é usado: o formulário envia
 * `blob:` URLs (que só existem no browser) ou o ficheiro em base64. Só um
 * atacante alguma vez põe aqui um http(s). Mesmo assim mantém-se o caminho,
 * restrito ao armazenamento que é nosso.
 */

/** Sufixos de host aceites. O Vercel Blob é onde as fotos do simulador ficam. */
const HOSTS_PERMITIDOS = [".public.blob.vercel-storage.com", ".blob.vercel-storage.com"];

/** 10 MB — uma foto de telemóvel não chega perto disto. */
export const TAMANHO_MAXIMO_IMAGEM = 10 * 1024 * 1024;

export function urlDeImagemPermitido(valor: string): URL | null {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return null; // inclui blob:, data: mal formados e texto solto
  }
  // https apenas: http em claro deixaria passar endereços internos
  if (url.protocol !== "https:") return null;
  if (url.port && url.port !== "443") return null;
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  const ok = HOSTS_PERMITIDOS.some((sufixo) => host.endsWith(sufixo));
  return ok ? url : null;
}

/**
 * O endereço de um ANEXO de pedido, se for do armazenamento público onde os
 * nossos envios ficam; senão null.
 *
 * As rotas públicas do pedido gravavam o `url` que o browser mandasse, sem
 * olhar para ele. Esse endereço vai parar ao backoffice, ao email e ao
 * painel do profissional, que o abrem e o mostram como «a fotografia do
 * cliente»: um `javascript:` num link, uma imagem de um servidor de outra
 * pessoa (que vê quem a abre e a troca depois), ou uma página falsa com o ar
 * de anexo nosso.
 *
 * Todos os caminhos de envio do site (a função, a URL assinada, o envio
 * directo) devolvem um endereço https do Vercel Blob PÚBLICO. É só isso que
 * passa; o resto deita-se fora. O store exacto não se confirma: o nome do
 * anfitrião sai do id do store por uma transformação que não é nossa, e
 * adivinhá-la mal deitava fora as fotografias todas.
 */
export function urlDeAnexoPermitido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  if (!texto || texto.length > 1000) return null;
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.port && url.port !== "443") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.toLowerCase().endsWith(".public.blob.vercel-storage.com")) return null;
  return url.href;
}

/**
 * Vai buscar a imagem com todas as travas: lista branca de host, sem seguir
 * redirects (um 302 para 127.0.0.1 anularia a lista branca), com abortar a
 * sério, e só aceita content-type de imagem dentro do tamanho.
 */
export async function buscarImagemExterna(
  valor: string,
  timeoutMs = 2000,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const url = urlDeImagemPermitido(valor);
  if (!url) return null;

  const abortar = new AbortController();
  const relogio = setTimeout(() => abortar.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "manual", // não deixar o destino escolher o destino
      signal: abortar.signal,
      headers: { accept: "image/*" },
    });
    if (!res.ok) return null;

    const mimeType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!mimeType.startsWith("image/")) return null;

    const declarado = Number(res.headers.get("content-length") ?? 0);
    if (declarado > TAMANHO_MAXIMO_IMAGEM) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > TAMANHO_MAXIMO_IMAGEM) return null;

    return { buffer, mimeType };
  } catch {
    return null;
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * O ANFITRIÃO DO NOSSO STORE no Vercel Blob (Segurança M3, 30-10-2026).
 *
 * Por ordem: `CLYON_BLOB_HOST` (o anfitrião exacto, quando se quer fixar), ou
 * o id do store tirado do token de escrita (`vercel_blob_rw_<id>_…`, também
 * com prefixo) ou do `BLOB_STORE_ID` (`store_<id>`): o endereço público é
 * `<id em minúsculas>.public.blob.vercel-storage.com`. Sem nada: null.
 */
export function anfitriaoDoNossoBlob(env: Record<string, string | undefined> = process.env): string | null {
  const limpo = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
  const fixo = limpo(env.CLYON_BLOB_HOST).toLowerCase();
  if (fixo) return /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(fixo) ? fixo : null;
  const nomes = Object.keys(env).filter((k) => /(^|_)READ_WRITE_TOKEN$/.test(k));
  nomes.sort((a, b) => (a === "BLOB_READ_WRITE_TOKEN" ? -1 : b === "BLOB_READ_WRITE_TOKEN" ? 1 : 0));
  for (const k of nomes) {
    const m = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(limpo(env[k]));
    if (m) return `${m[1].toLowerCase()}.public.blob.vercel-storage.com`;
  }
  const loja = /^store_([A-Za-z0-9]+)$/.exec(limpo(env.BLOB_STORE_ID));
  if (loja) return `${loja[1].toLowerCase()}.public.blob.vercel-storage.com`;
  return null;
}

/** O que um anexo de conversa pode ser: imagem ou PDF. */
const EXTENSOES_DO_ANEXO = /\.(?:jpe?g|png|webp|heic|heif|pdf)$/i;

/**
 * O ANEXO DE UMA CONVERSA: só do NOSSO store (não de qualquer Vercel Blob —
 * um parceiro podia mandar ao cliente uma página de outra pessoa com ar de
 * anexo CLYON) e só imagens ou PDF. Até 500 caracteres (a coluna).
 */
export function urlDeAnexoDaConversa(
  valor: unknown,
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (typeof valor === "string" && valor.trim().length > 500) return null;
  const href = urlDeAnexoPermitido(valor);
  if (!href) return null;
  const nosso = anfitriaoDoNossoBlob(env);
  if (!nosso) return null;
  const url = new URL(href);
  if (url.hostname.toLowerCase() !== nosso) return null;
  if (url.search || url.hash) return null;
  if (!EXTENSOES_DO_ANEXO.test(decodeURIComponent(url.pathname))) return null;
  return href.length > 500 ? null : href;
}
