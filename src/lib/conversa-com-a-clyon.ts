import { appendOrderHistory, getSimulatorOrderById, updateSimulatorOrder } from "./db";
import { urlDeAnexoDaConversa, urlDeAnexoPermitido } from "./url-externo-seguro";
import { avisarOClienteDoPedido } from "./avisos-ao-cliente";
import { avisarContactoDoPedido } from "./avisar-contacto-do-pedido";
import { PREFIXO_DO_PEDIDO_DE_DETALHES } from "./historico-para-o-cliente";

/**
 * A CONVERSA ENTRE A CLYON E O CLIENTE, NUM SÍTIO SÓ — 29-10-2026 (S18).
 *
 * *«O "pedir mais detalhes" não chega ao cliente.»* — a matriz B3 (BO1–BO3).
 * Havia três portas na equipa: «Pedir info» (gravava a mensagem e o estado,
 * sem avisar ninguém), «Pedir o que falta» (só uma nota interna) e a resposta
 * nas Conversas (sem aviso). Agora todas passam por aqui:
 *
 *   · `pedirMaisDetalhes` — o estado «precisa info», a mensagem no pedido e no
 *     histórico (`info_requested`, que a conta, o link e a app mostram), e o
 *     aviso: no telemóvel e por email a quem tem conta; sem email, por
 *     WhatsApp ao telefone do pedido;
 *   · `avisarDaRespostaDaClyon` — uma resposta das Conversas chega com aviso;
 *   · `responderAClyon` — a resposta do cliente (a conta do site e a R14 da
 *     app gravam pela mesma função), com fotografias se as juntar.
 *
 * Nunca o nome de quem escreveu na equipa: para o cliente é «CLYON».
 */

export type QuemNaEquipa = { id: number; nome: string; role: string } | null;

const LIMITE_DA_MENSAGEM = 2000;
/** O tecto de ficheiros num pedido, a contar com os de origem (Segurança, R18). */
export const MAXIMO_DE_FICHEIROS_NO_PEDIDO = 30;
/** Quantas fotografias se juntam de uma vez a uma resposta. */
export const MAXIMO_DE_FOTOGRAFIAS_NUMA_RESPOSTA = 10;

/** O que o aviso por WhatsApp diz, a quem não tem email (G6). */
export function detalhesPorWhatsApp(pedidoId: number, mensagem: string): string {
  return `A CLYON precisa de mais detalhes sobre o pedido #${pedidoId}:\n\n${mensagem}\n\nPode responder a esta mensagem.`;
}

/** O assunto e o texto do email a quem tem conta. */
export function detalhesPorEmail(pedidoId: number, mensagem: string): string {
  return `A CLYON precisa de mais detalhes para enviar o pedido #${pedidoId} aos parceiros: ${mensagem} Pode responder na sua conta em clyon.pt ou na app.`;
}

/**
 * A CLYON PEDE MAIS DETALHES. Grava a mensagem inteira (a conta mostrava só os
 * primeiros 200 caracteres do histórico) e avisa. Nunca lança no aviso.
 */
export async function pedirMaisDetalhes(
  pedidoId: number,
  mensagem: string,
  by: QuemNaEquipa,
  opcoes: { semAvisoPorFora?: boolean } = {},
): Promise<void> {
  const texto = mensagem.trim().slice(0, LIMITE_DA_MENSAGEM);
  if (!texto) throw new Error("Mensagem obrigatória.");
  await updateSimulatorOrder(pedidoId, { status: "precisa_info", mensagemCliente: texto } as Parameters<
    typeof updateSimulatorOrder
  >[1]);
  await appendOrderHistory(pedidoId, {
    type: "info_requested",
    by,
    message: `${PREFIXO_DO_PEDIDO_DE_DETALHES}"${texto}"`,
  });
  if (opcoes.semAvisoPorFora) await avisarOClienteDoPedido(pedidoId, "detalhes");
  else await avisarDosDetalhes(pedidoId, texto);
}

/** O aviso do pedido de detalhes: com email, no telemóvel e por email; sem email, por WhatsApp. */
export async function avisarDosDetalhes(pedidoId: number, texto: string): Promise<void> {
  try {
    const pedido = await getSimulatorOrderById(pedidoId);
    if (!pedido) return;
    const email = (pedido.contactEmail ?? "").trim();
    if (email) {
      await avisarOClienteDoPedido(pedidoId, "detalhes");
      await avisarContactoDoPedido({ id: pedidoId, contactEmail: email }, detalhesPorEmail(pedidoId, texto));
    } else {
      await avisarContactoDoPedido({ id: pedidoId, contactPhone: pedido.contactPhone }, detalhesPorWhatsApp(pedidoId, texto));
    }
  } catch (err) {
    console.error("[conversa-com-a-clyon] aviso dos detalhes:", err instanceof Error ? err.message : err);
  }
}

/** Uma resposta da CLYON nas Conversas: o aviso no telemóvel a quem tem conta. */
export async function avisarDaRespostaDaClyon(pedidoId: number): Promise<void> {
  await avisarOClienteDoPedido(pedidoId, "mensagem");
}

/** O que o cliente juntou: só endereços do nosso armazenamento, nunca um URL qualquer. */
export function fotografiasDaResposta(v: unknown): string[] | null {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > MAXIMO_DE_FOTOGRAFIAS_NUMA_RESPOSTA) return null;
  const urls: string[] = [];
  for (const x of v) {
    const url = urlDeAnexoPermitido(typeof x === "string" ? x : (x as { url?: unknown } | null)?.url);
    if (!url) return null;
    urls.push(url);
  }
  return urls;
}

/** O tamanho máximo de uma mensagem — o mesmo nas Conversas novas (30-10-2026). */
export const LIMITE_DA_MENSAGEM_DA_CONVERSA = LIMITE_DA_MENSAGEM;

/**
 * UMA MENSAGEM NOVA NAS CONVERSAS (30-10-2026, «Conversas» fase 1): a mesma
 * regra desta resposta — texto até 2000 caracteres, e um anexo só do nosso
 * armazenamento (`urlDeAnexoPermitido`), nunca um URL qualquer.
 */
export function lerMensagemNova(corpo: {
  texto?: unknown;
  mensagem?: unknown;
  anexoUrl?: unknown;
}): { ok: true; texto: string; anexoUrl: string | null } | { ok: false; error: string } {
  const bruto = typeof corpo.texto === "string" ? corpo.texto : typeof corpo.mensagem === "string" ? corpo.mensagem : "";
  const texto = bruto.trim();
  let anexoUrl: string | null = null;
  if (corpo.anexoUrl != null && corpo.anexoUrl !== "") {
    anexoUrl = urlDeAnexoDaConversa(corpo.anexoUrl);
    if (!anexoUrl) return { ok: false, error: "Anexo inválido." };
  }
  if (!texto && !anexoUrl) return { ok: false, error: "Mensagem obrigatória." };
  if (texto.length > LIMITE_DA_MENSAGEM) return { ok: false, error: "Mensagem demasiado longa." };
  return { ok: true, texto, anexoUrl };
}

export type RespostaDoCliente =
  | { ok: true }
  | { ok: false; status: 400 | 404 | 409; error: string };

/**
 * O CLIENTE RESPONDE À CLYON — a conta do site e a R14 da app. O pedido tem de
 * ser do email da sessão (quem chama confere). Grava `client_reply` (a Mesa
 * mostra-o com o selo das respostas por ler) e as fotografias no pedido.
 */
export async function responderAClyon(
  pedidoId: number,
  quem: { nome: string },
  corpo: { mensagem?: unknown; fotografias?: unknown },
): Promise<RespostaDoCliente> {
  const mensagem = typeof corpo.mensagem === "string" ? corpo.mensagem.trim() : "";
  const fotografias = fotografiasDaResposta(corpo.fotografias);
  if (fotografias === null) return { ok: false, status: 400, error: "Fotografias inválidas." };
  if (!mensagem && fotografias.length === 0) return { ok: false, status: 400, error: "Mensagem obrigatória." };
  if (mensagem.length > LIMITE_DA_MENSAGEM) return { ok: false, status: 400, error: "Mensagem demasiado longa." };

  if (fotografias.length > 0) {
    const pedido = await getSimulatorOrderById(pedidoId);
    if (!pedido) return { ok: false, status: 404, error: "Pedido não encontrado." };
    let ficheiros: unknown[] = [];
    try {
      const lidos = JSON.parse(pedido.filesJson ?? "[]");
      if (Array.isArray(lidos)) ficheiros = lidos;
    } catch {
      /* ilegível: recomeça */
    }
    if (ficheiros.length + fotografias.length > MAXIMO_DE_FICHEIROS_NO_PEDIDO) {
      return { ok: false, status: 409, error: "Este pedido já tem o número máximo de fotografias." };
    }
    for (const url of fotografias) ficheiros.push({ url, name: url.split("/").pop() ?? "fotografia", type: "image/jpeg" });
    await updateSimulatorOrder(pedidoId, { filesJson: JSON.stringify(ficheiros) } as unknown as Parameters<
      typeof updateSimulatorOrder
    >[1]);
  }

  const juntou =
    fotografias.length === 0 ? "" : fotografias.length === 1 ? " (juntou 1 fotografia)" : ` (juntou ${fotografias.length} fotografias)`;
  await appendOrderHistory(pedidoId, {
    type: "client_reply",
    by: { id: 0, nome: quem.nome, role: "cliente" },
    message: `${mensagem || "Fotografias enviadas."}${juntou}`,
  });
  return { ok: true };
}
