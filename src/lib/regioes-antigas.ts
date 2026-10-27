/*
 * AS URLs ANTIGAS /Regiões/* — 27-10-2026 (d9).
 *
 * O site antigo tinha /Regiões/Lisboa/, /Regiões/Margem-Sul/… O Google ainda
 * as mostra (posição 6 para «móveis usados almada», 17 para «recolha de monos
 * lisboa») e davam 404. Uma regra para a família inteira, e não URL a URL:
 * maiúsculas ou não, com ou sem acento, codificado ou não, com ou sem barra
 * final, «Margem Sul» em várias grafias — 301 directo para /regioes/<região>.
 * Qualquer outra /Regiões/* vai para /regioes.
 *
 * O que já está na forma certa (/regioes, /regioes/lisboa…) não se toca.
 */

const REGIOES: Record<string, string> = {
  lisboa: "lisboa",
  "margem-sul": "margem-sul",
  margemsul: "margem-sul",
  margem: "margem-sul",
  setubal: "setubal",
};

function normalizar(segmento: string): string {
  let s = segmento;
  try {
    s = decodeURIComponent(s);
  } catch {
    /* Um % solto fica como está. */
  }
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_+]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Para onde vai uma /Regiões/* antiga, ou null se não é dessa família (ou já está certa). */
export function destinoDasRegioesAntigas(pathname: string): string | null {
  const partes = pathname.split("/").filter(Boolean);
  if (partes.length === 0 || normalizar(partes[0]) !== "regioes") return null;
  const regiao = partes[1] ? REGIOES[normalizar(partes[1])] : undefined;
  const destino = regiao ? `/regioes/${regiao}` : "/regioes";
  // Já na forma certa: é a página, não um redireccionamento.
  if (pathname === destino) return null;
  // /regioes/<outra> em minúsculas e sem acento é a rota da página (que dá o seu 404).
  if (partes[0] === "regioes" && partes.length === 2 && !pathname.endsWith("/") && partes[1] === partes[1].toLowerCase() && !regiao && /^[a-z0-9-]+$/.test(partes[1])) {
    return null;
  }
  return destino;
}
