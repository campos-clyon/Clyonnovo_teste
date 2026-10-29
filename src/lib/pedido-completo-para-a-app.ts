import { diaCurtoEmLisboa } from "./pedido-para-a-app";
import { QUEM_FACTURA_EM_PALAVRAS } from "./identificacao-legal";
import { QUEM_FAZ_O_TRABALHO } from "./textos-do-pedido";

/**
 * O QUE FALTAVA NA R5 E NA R4 — 29-10-2026 (S22, E5 v3 c–f).
 *
 * Puro: os ficheiros do pedido separados em fotografias e vídeos, o acesso e
 * a repetição em palavras, o dia preferido em Lisboa, o rodapé do site, o
 * «N profissionais responderam» e os atalhos da contraproposta — tudo já
 * escrito, para a app não fazer contas nem traduzir códigos.
 */

const EXTENSOES_DE_VIDEO = /\.(mp4|mov|m4v|webm|3gp|avi)(\?|$)/i;

type Ficheiro = { url: string; video: boolean };

function ficheirosDoPedido(filesJson: unknown): Ficheiro[] {
  if (typeof filesJson !== "string") return [];
  try {
    const lista = JSON.parse(filesJson);
    if (!Array.isArray(lista)) return [];
    const saida: Ficheiro[] = [];
    for (const f of lista) {
      const url = typeof f === "string" ? f : f && typeof f.url === "string" ? f.url : null;
      if (!url) continue;
      const tipo = f && typeof f === "object" && typeof f.type === "string" ? f.type : "";
      saida.push({ url, video: tipo.startsWith("video/") || EXTENSOES_DE_VIDEO.test(url) });
    }
    return saida;
  } catch {
    return [];
  }
}

export const fotografiasDoPedido = (filesJson: unknown) => ficheirosDoPedido(filesJson).filter((f) => !f.video).map((f) => f.url);
export const videosDoPedido = (filesJson: unknown) => ficheirosDoPedido(filesJson).filter((f) => f.video).map((f) => f.url);

const ELEVADOR: Record<string, string> = {
  yes: "com elevador",
  sim: "com elevador",
  small: "com elevador pequeno",
  pequeno: "com elevador pequeno",
  no: "sem elevador",
  nao: "sem elevador",
  "não": "sem elevador",
};

function andarEmPalavras(floor: unknown): string | null {
  const f = typeof floor === "number" ? String(floor) : typeof floor === "string" ? floor.trim() : "";
  if (!f) return null;
  if (/^r[ée]s/i.test(f) || f === "0") return "rés-do-chão";
  if (/moradia/i.test(f)) return "moradia";
  if (/^\d+$/.test(f)) return `${f}.º andar`;
  return f;
}

/** «3.º andar, sem elevador» — o acesso de um lado, ou nada. */
export function acessoEmPalavras(p: { floor?: unknown; hasElevator?: unknown }): string | null {
  const andar = andarEmPalavras(p.floor);
  const elevador = typeof p.hasElevator === "string" ? ELEVADOR[p.hasElevator.trim().toLowerCase()] ?? null : null;
  const precisaDeElevador = andar && andar !== "rés-do-chão" && andar !== "moradia";
  return [andar, precisaDeElevador ? elevador : null].filter(Boolean).join(", ") || null;
}

/** O acesso do pedido, numa mudança dos dois lados. */
export function acessoDoPedido(
  pedido: { serviceType?: unknown; floor?: unknown; hasElevator?: unknown; rawOrderJson?: unknown },
): string | null {
  let raw: Record<string, unknown> = {};
  try {
    raw = typeof pedido.rawOrderJson === "string" ? JSON.parse(pedido.rawOrderJson) ?? {} : {};
  } catch {
    raw = {};
  }
  if (pedido.serviceType === "mudanca") {
    const o = acessoEmPalavras((raw.originAccess as Record<string, unknown>) ?? { floor: pedido.floor, hasElevator: pedido.hasElevator });
    const d = acessoEmPalavras((raw.destinationAccess as Record<string, unknown>) ?? {});
    const partes = [o ? `Origem: ${o}` : null, d ? `Destino: ${d}` : null].filter(Boolean);
    return partes.length ? partes.join(" · ") : null;
  }
  return acessoEmPalavras({ floor: pedido.floor, hasElevator: pedido.hasElevator });
}

export function repeticaoEmPalavras(v: unknown): string | null {
  if (v === "semanal") return "Todas as semanas";
  if (v === "quinzenal") return "De 15 em 15 dias";
  return null;
}

export const dataPreferidaTexto = (v: Date | string | null | undefined) => diaCurtoEmLisboa(v ?? null);

/** O rodapé do pedido no site: quem faz o trabalho e quem passa a fatura. */
export const RODAPE_DO_PEDIDO = `${QUEM_FAZ_O_TRABALHO} ${QUEM_FACTURA_EM_PALAVRAS}`;

/** «3 profissionais responderam», ou nada. */
export function responderamEmPalavras(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  return n === 1 ? "1 profissional respondeu" : `${n} profissionais responderam`;
}

/**
 * Os atalhos da contraproposta do cliente — os do site (`EscolherValor`, que
 * os importa daqui): 5 % e 10 % abaixo do que está em cima da mesa, no que
 * ELE paga (com IVA). A app mostra-os e manda o valor escolhido.
 */
export const PASSOS_DA_CONTRAPROPOSTA_DO_CLIENTE = [0.05, 0.1] as const;

const aosCentimos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const emEuros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

export function atalhosDaContraproposta(referencia: number | null | undefined): Array<{ valor: number; texto: string }> {
  if (referencia == null || !(referencia > 0)) return [];
  return PASSOS_DA_CONTRAPROPOSTA_DO_CLIENTE.map((passo) => {
    const valor = aosCentimos(referencia * (1 - passo));
    return { valor, texto: emEuros(valor) };
  });
}
