import {
  appendOrderHistory,
  getSimulatorOrderById,
  guardarAlteracaoPendente,
  juntarPormenoresDoCliente,
  negociacoesDoPedido,
  tirarAlteracaoPendente,
  updateSimulatorOrder,
} from "./db";
import {
  MAXIMO_DE_FOTOGRAFIAS,
  MAXIMO_DE_VIDEOS,
  TEXTOS_DA_ALTERACAO,
  avisoDaAlteracaoAoContacto,
  contratadoTexto,
  faseDaAlteracao,
  oQueMudou,
  type AlteracaoLida,
} from "./alteracoes-do-cliente";
import { lerDataPreferida, urgenciaDoDia } from "./pedido-da-app-de-cliente";
import { avisarContactoDoPedido } from "./avisar-contacto-do-pedido";
import { avisarOClienteDoPedido } from "./avisos-ao-cliente";
import { limitarPorConta } from "./limite-rota-publica";
import { retratoDoPedido, oQueMudou as oQueMudouNoRetrato, recomecarDoZero } from "./recomecar-do-zero";

/**
 * AS ALTERAÇÕES DO CLIENTE NA BASE — 29-10-2026 (S17). Ver
 * `alteracoes-do-cliente.ts` para as regras.
 */

export type PorOnde = "app" | "conta" | "link" | "convidado";
const POR_ONDE_NO_HISTORICO: Record<PorOnde, string> = {
  app: "pela app",
  conta: "pela conta do site",
  link: "pelo link, no site",
  convidado: "pelo link, na app",
};

type Pedido = NonNullable<Awaited<ReturnType<typeof getSimulatorOrderById>>>;

const EXTENSOES_DE_VIDEO = /\.(mp4|mov|m4v|webm|3gp|avi)(\?|$)/i;

/** Aplica a alteração ao pedido. As fotografias com tecto (R18); os pormenores à parte (R17). */
export async function aplicarAlteracao(pedido: Pedido, a: AlteracaoLida): Promise<void> {
  const dados: Record<string, unknown> = {};
  if (a.dataPreferida) {
    const d = lerDataPreferida(a.dataPreferida);
    if (d.ok && d.inicio && d.dia) {
      dados.dataAgendada = d.inicio;
      dados.urgency = urgenciaDoDia(d.dia);
    }
  } else if (a.quando) {
    dados.urgency = a.quando;
  }
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(pedido.rawOrderJson ?? "{}") ?? {};
  } catch {
    raw = {};
  }
  let rawMudou = false;
  const mudanca = pedido.serviceType === "mudanca";
  if (a.acesso) {
    if (mudanca) {
      raw.originAccess = { ...((raw.originAccess as object) ?? {}), ...a.acesso };
      rawMudou = true;
    }
    if (a.acesso.floor !== undefined) dados.floor = a.acesso.floor;
    if (a.acesso.hasElevator !== undefined) dados.hasElevator = a.acesso.hasElevator;
    if (a.acesso.parkingDistance !== undefined) dados.parkingDistance = a.acesso.parkingDistance;
  }
  if (a.acessoDestino && mudanca) {
    raw.destinationAccess = { ...((raw.destinationAccess as object) ?? {}), ...a.acessoDestino };
    rawMudou = true;
  }
  if (a.desmontagem !== undefined) {
    raw.needsDismantling = a.desmontagem;
    rawMudou = true;
  }
  if (rawMudou) dados.rawOrderJson = JSON.stringify(raw);
  if (a.fotografias?.length) {
    let ficheiros: Array<{ url?: string; type?: string } | string> = [];
    try {
      const l = JSON.parse(pedido.filesJson ?? "[]");
      if (Array.isArray(l)) ficheiros = l;
    } catch {
      ficheiros = [];
    }
    const eVideo = (f: { url?: string; type?: string } | string) => {
      const url = typeof f === "string" ? f : f.url ?? "";
      const tipo = typeof f === "string" ? "" : f.type ?? "";
      return tipo.startsWith("video/") || EXTENSOES_DE_VIDEO.test(url);
    };
    let fotos = ficheiros.filter((f) => !eVideo(f)).length;
    let videos = ficheiros.filter(eVideo).length;
    for (const url of a.fotografias) {
      const video = EXTENSOES_DE_VIDEO.test(url);
      if (video ? videos >= MAXIMO_DE_VIDEOS : fotos >= MAXIMO_DE_FOTOGRAFIAS) continue;
      ficheiros.push({ url, type: video ? "video/mp4" : "image/jpeg" });
      if (video) videos += 1;
      else fotos += 1;
    }
    dados.filesJson = JSON.stringify(ficheiros);
  }
  if (Object.keys(dados).length > 0) {
    await updateSimulatorOrder(pedido.id, dados as Parameters<typeof updateSimulatorOrder>[1]);
  }
  if (a.pormenores) await juntarPormenoresDoCliente(pedido.id, a.pormenores);
}

export type RespostaDaAlteracao =
  | { status: 200; corpo: { ok: true; estado: "aplicada" | "pedida"; mensagem: string } }
  | { status: 404 | 409 | 422; corpo: { ok: false; error: string } };

/** O pedido de uma alteração pelo cliente (R13), já com o pedido confirmado como dele. */
export async function pedirAlteracao(c: {
  pedidoId: number;
  alteracao: AlteracaoLida;
  porOnde: PorOnde;
  /** Os 8 primeiros da prova do aparelho, quando é um convidado (D3.6). */
  prova8?: string | null;
}): Promise<RespostaDaAlteracao> {
  const pedido = await getSimulatorOrderById(c.pedidoId);
  if (!pedido) return { status: 404, corpo: { ok: false, error: "Pedido não encontrado." } };
  const o = pedido as Pedido & {
    canceladoPeloCliente?: unknown;
    precoAceiteEm?: unknown;
    alteracaoPendenteEm?: unknown;
  };
  const negs = await negociacoesDoPedido(pedido.id);
  const acordada = negs.find((n) => n.estado === "acordada");
  const fase = faseDaAlteracao({
    status: pedido.status,
    canceladoPeloCliente: o.canceladoPeloCliente,
    trabalhoClyon: pedido.valorFixoClyon != null,
    precoAceite: !!o.precoAceiteEm,
    contratado: !!acordada,
    enviado: negs.length > 0,
  });
  if (fase === "fechado") return { status: 409, corpo: { ok: false, error: TEXTOS_DA_ALTERACAO.fechado } };
  if (fase === "contratado") {
    const nome = (acordada as { profissionalNome?: string } | undefined)?.profissionalNome ?? null;
    return { status: 409, corpo: { ok: false, error: pedido.valorFixoClyon != null && !acordada ? TEXTOS_DA_ALTERACAO.sempre : contratadoTexto(nome) } };
  }
  if (o.alteracaoPendenteEm) return { status: 409, corpo: { ok: false, error: TEXTOS_DA_ALTERACAO.jaHaUma } };

  const oQue = oQueMudou(c.alteracao);
  const onde = POR_ONDE_NO_HISTORICO[c.porOnde] + (c.prova8 ? ` (telemóvel ${c.prova8})` : "");
  let estado: "aplicada" | "pedida";
  if (fase === "analise") {
    await aplicarAlteracao(pedido, c.alteracao);
    estado = "aplicada";
    await appendOrderHistory(pedido.id, { type: "created", by: null, message: `Alterado pelo cliente ${onde}: ${oQue}.` });
  } else {
    if (!(await guardarAlteracaoPendente(pedido.id, JSON.stringify({ alteracao: c.alteracao, porOnde: c.porOnde, prova8: c.prova8 ?? null })))) {
      return { status: 409, corpo: { ok: false, error: TEXTOS_DA_ALTERACAO.jaHaUma } };
    }
    estado = "pedida";
    await appendOrderHistory(pedido.id, {
      type: "created",
      by: null,
      message: `Pedido de alteração do cliente ${onde}: ${oQue}. Aplique ou não na Mesa (Alterações do cliente).`,
    });
  }
  // O que o cliente vê no histórico dele.
  await appendOrderHistory(pedido.id, {
    type: "alteracao_do_cliente",
    by: null,
    message: estado === "aplicada" ? `Alterou ${oQue}.` : `Pediu para alterar ${oQue}.`,
  });

  // Pelo link (no site ou na app sem conta): o contacto do pedido fica a saber (R23), no máximo de 30 em 30 min (R21).
  if (c.porOnde === "link" || c.porOnde === "convidado") {
    const travao = await limitarPorConta("aviso-ao-contacto", `pedido:${pedido.id}`, 1, 1800);
    if (!travao.erro) await avisarContactoDoPedido(pedido, avisoDaAlteracaoAoContacto(pedido.id, oQue));
  }
  return {
    status: 200,
    corpo: { ok: true, estado, mensagem: estado === "aplicada" ? TEXTOS_DA_ALTERACAO.aplicada : TEXTOS_DA_ALTERACAO.pedida },
  };
}

/** A Mesa decide uma alteração pendente: «Aplicar» (pela edição, que recomeça se o retrato mudar) ou «Não aplicar». */
export async function decidirAlteracao(c: {
  pedidoId: number;
  aplicar: boolean;
  motivo: string | null;
  by: { id: number; nome: string; role: string } | null;
  baseUrl: string;
}): Promise<{ ok: true; recomecou: boolean } | { ok: false; error: string }> {
  const pedido = await getSimulatorOrderById(c.pedidoId);
  if (!pedido) return { ok: false, error: "Pedido não encontrado." };
  const json = await tirarAlteracaoPendente(c.pedidoId);
  if (json == null) return { ok: false, error: "Já não há nenhuma alteração à espera." };
  let alteracao: AlteracaoLida = {};
  try {
    alteracao = (JSON.parse(json) as { alteracao?: AlteracaoLida }).alteracao ?? {};
  } catch {
    alteracao = {};
  }
  const oQue = oQueMudou(alteracao);
  if (!c.aplicar) {
    const motivo = (c.motivo ?? "").trim().slice(0, 500);
    await appendOrderHistory(c.pedidoId, { type: "created", by: c.by, message: `Alteração do cliente não aplicada: ${oQue}.${motivo ? ` Motivo: ${motivo}` : ""}` });
    await appendOrderHistory(c.pedidoId, {
      type: "message_to_client",
      by: c.by,
      message: `A CLYON não aplicou a alteração que pediu (${oQue}).${motivo ? ` ${motivo}` : ""}`,
    });
    await avisarOClienteDoPedido(c.pedidoId, "alteracao_recusada");
    return { ok: true, recomecou: false };
  }
  const antes = retratoDoPedido(pedido);
  await aplicarAlteracao(pedido, alteracao);
  const depois = await getSimulatorOrderById(c.pedidoId);
  const mudou = depois ? oQueMudouNoRetrato(antes, retratoDoPedido(depois)) : [];
  await appendOrderHistory(c.pedidoId, { type: "created", by: c.by, message: `Alteração do cliente aplicada pela CLYON: ${oQue}.` });
  let recomecou = false;
  if (mudou.length > 0 && depois) {
    try {
      await recomecarDoZero(depois, c.baseUrl);
      recomecou = true;
    } catch (e) {
      console.error("[alteracoes] recomeço falhou:", e);
    }
  }
  await avisarOClienteDoPedido(c.pedidoId, "alteracao_aplicada");
  return { ok: true, recomecou };
}
