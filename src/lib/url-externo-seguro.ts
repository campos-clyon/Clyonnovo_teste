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
