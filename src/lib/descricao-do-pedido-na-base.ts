import type { DadosDaRecolha } from "./whatsapp-recolha";
import {
  comAEscrita,
  comTextoDaEquipa,
  descricaoPelasRegras,
  equipaMexeu,
  fontesDeUmaDescricao,
  fontesVazias,
  juntarAConversa,
  juntarOQueSeViu,
  lerFontes,
  textoNormal,
  type FontesDaDescricao,
} from "./fontes-da-descricao";
import { escreverADescricao, type PedidoParaADescricao } from "./descricao-pelo-modelo";

/**
 * A DESCRIÇÃO DO PEDIDO NA BASE — quem lê e grava as fontes, e quem chama o
 * modelo. 29-10-2026. As regras estão em `fontes-da-descricao.ts` e o modelo
 * em `descricao-pelo-modelo.ts`; aqui só se lê, decide a ordem e grava.
 *
 * A ORDEM, numa mensagem do cliente que muda o pedido:
 *   1. as fontes ganham o que ele disse, e a descrição escreve-se logo PELAS
 *      REGRAS (é rápido, e já não repete blocos) — `juntarAConversaNaDescricao`;
 *   2. a Vitória responde-lhe;
 *   3. DEPOIS da resposta, o modelo reescreve-a a partir das fontes
 *      (`reescreverADescricao`). Se falhar, fica a das regras, e a falha fica
 *      no termómetro do painel e no histórico do pedido.
 */

/** O que interessa de um pedido da base. */
export type PedidoComDescricao = {
  id: number;
  description?: string | null;
  fontesDaDescricao?: string | null;
  serviceType?: string | null;
  city?: string | null;
  postalCode?: string | null;
  floor?: string | null;
  hasElevator?: string | null;
  parkingDistance?: string | null;
  dataAgendada?: Date | string | null;
  filesJson?: string | null;
  rawOrderJson?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  address?: string | null;
};

/** As fotografias do pedido — os endereços e o tipo. */
export function fotografiasDoPedido(filesJson: string | null | undefined): Array<{ url: string; tipo: string }> {
  try {
    const l = JSON.parse(filesJson ?? "[]");
    if (!Array.isArray(l)) return [];
    return l
      .filter((f) => f && typeof f.url === "string")
      .map((f) => ({ url: String(f.url), tipo: String(f.type ?? f.mimeType ?? "") }));
  } catch {
    return [];
  }
}

/** «Todas as que o pedido tiver já foram vistas» — o pedido que a Vitória registou viu-as na conversa. */
const TODAS_VISTAS = "*";

const eImagem = (f: { url: string; tipo: string }) =>
  f.tipo ? f.tipo.startsWith("image/") : /\.(jpe?g|png|webp|gif|heic|heif)(\?|$)/i.test(f.url);

/** O pedido como o gerador o lê. Puro. */
export function pedidoParaADescricao(p: PedidoComDescricao): PedidoParaADescricao {
  let raw: Record<string, unknown> = {};
  try {
    raw = p.rawOrderJson ? (JSON.parse(p.rawOrderJson) as Record<string, unknown>) : {};
  } catch {
    raw = {};
  }
  const destino = (raw.destinationAddress ?? null) as Record<string, unknown> | null;
  const acesso = (raw.destinationAccess ?? null) as Record<string, unknown> | null;
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    serviceType: p.serviceType ?? null,
    city: p.city ?? null,
    postalCode: p.postalCode ?? null,
    floor: p.floor ?? null,
    hasElevator: p.hasElevator ?? null,
    parkingDistance: p.parkingDistance ?? null,
    dataAgendada: p.dataAgendada ?? null,
    fotos: fotografiasDoPedido(p.filesJson).length,
    destino:
      destino || acesso
        ? {
            localidade: s(destino?.city),
            codigoPostal: s(destino?.postalCode),
            andar: s(acesso?.floor),
            elevador: s(acesso?.hasElevator),
          }
        : null,
    contactName: p.contactName ?? null,
    contactPhone: p.contactPhone ?? null,
    contactEmail: p.contactEmail ?? null,
    address: p.address ?? null,
  };
}

/**
 * AS FONTES DO PEDIDO, COMO ESTÃO AGORA. Um pedido de antes nasce da
 * descrição que tem; se a equipa mexeu à mão desde a última escrita, o texto
 * dela passa a ser a fonte da equipa. Puro.
 */
export function fontesDoPedido(p: PedidoComDescricao, agora: Date): FontesDaDescricao {
  let f = lerFontes(p.fontesDaDescricao) ?? fontesDeUmaDescricao(p.description);
  if (equipaMexeu(f, p.description)) f = comTextoDaEquipa(f, p.description, agora);
  return f;
}

/**
 * O QUE O CLIENTE DISSE NO WHATSAPP ENTRA NAS FONTES, e a descrição
 * escreve-se logo pelas regras — sem blocos repetidos. Devolve a descrição
 * nova, ou null quando não havia pedido.
 */
export async function juntarAConversaNaDescricao(
  pedidoId: number,
  novos: DadosDaRecolha,
  agora: Date = new Date(),
): Promise<{ antes: string; descricao: string; mudou: boolean; fontesMudaram: boolean } | null> {
  const { getSimulatorOrderById, gravarDescricaoEFontes } = await import("./db");
  const p = (await getSimulatorOrderById(pedidoId)) as unknown as PedidoComDescricao | undefined;
  if (!p) return null;
  const antes = textoNormal(p.description);
  const doPedido = fontesDoPedido(p, agora);
  const fontes = juntarAConversa(doPedido, novos, agora);
  // Nada de novo («ok», «obrigada»): a descrição fica como está — também a que o modelo escreveu.
  const fontesMudaram = JSON.stringify(fontes) !== JSON.stringify(doPedido);
  if (!fontesMudaram) return { antes, descricao: antes, mudou: false, fontesMudaram: false };
  const descricao = descricaoPelasRegras(fontes, p.serviceType);
  const mudou = descricao !== antes;
  await gravarDescricaoEFontes(
    pedidoId,
    mudou ? descricao : undefined,
    JSON.stringify(comAEscrita(fontes, descricao, "regras", agora)),
  );
  return { antes, descricao, mudou, fontesMudaram: true };
}

/**
 * AS FOTOGRAFIAS QUE O MODELO AINDA NÃO VIU — no máximo `maximo` de cada
 * vez, só imagens, e só do nosso armazenamento (`buscarImagemExterna`: lista
 * branca de anfitriões, sem redireccionamentos, com tamanho máximo). Cada uma
 * é vista uma vez (`verAImagem`, a mesma da Vitória) e fica nas fontes.
 */
export async function verAsFotografiasNovas(
  fontes: FontesDaDescricao,
  p: PedidoComDescricao,
  agora: Date,
  maximo = 4,
): Promise<FontesDaDescricao> {
  if (fontes.fotosVistas.includes(TODAS_VISTAS)) {
    // Vistas na conversa que deu o pedido: as que lá estão contam como vistas, e as que vierem depois vêem-se.
    return { ...fontes, fotosVistas: fotografiasDoPedido(p.filesJson).map((f) => f.url) };
  }
  const novas = fotografiasDoPedido(p.filesJson)
    .filter((f) => eImagem(f) && !fontes.fotosVistas.includes(f.url))
    .slice(0, maximo);
  if (novas.length === 0) return fontes;
  const { buscarImagemExterna } = await import("./url-externo-seguro");
  const { verAImagem } = await import("./whatsapp-imagem");
  const vistas = await Promise.all(
    novas.map(async (f) => {
      try {
        const img = await buscarImagemExterna(f.url, 5000);
        if (!img) return { url: f.url, visto: null as string | null };
        return { url: f.url, visto: await verAImagem(img.buffer.toString("base64"), img.mimeType) };
      } catch {
        return { url: f.url, visto: null as string | null };
      }
    }),
  );
  let f = fontes;
  for (const v of vistas) f = juntarOQueSeViu(f, v.url, v.visto, agora);
  return f;
}

/**
 * O MODELO REESCREVE A DESCRIÇÃO A PARTIR DAS FONTES. Só grava se a
 * descrição ainda for a que se leu (quem escreveu entretanto, ganha). Falhou:
 * fica a das regras, e diz-se no histórico do pedido (e no termómetro, pelo
 * `escreverADescricao`). Nunca atira.
 */
export async function reescreverADescricao(pedidoId: number, agora: Date = new Date()): Promise<{ ok: boolean; motivo?: string }> {
  try {
    const { getSimulatorOrderById, gravarDescricaoEFontes, appendOrderHistory } = await import("./db");
    const p = (await getSimulatorOrderById(pedidoId)) as unknown as PedidoComDescricao | undefined;
    if (!p) return { ok: false, motivo: "o pedido já não existe" };
    const lida = p.description ?? "";
    let fontes = fontesDoPedido(p, agora);
    // A equipa escreveu à mão e o cliente não disse nada depois: o texto dela manda tal como está.
    if (fontes.por === "equipa" && textoNormal(lida) === fontes.escrita) return { ok: false, motivo: "a equipa escreveu-a à mão" };
    fontes = await verAsFotografiasNovas(fontes, p, agora);
    const r = await escreverADescricao(fontes, pedidoParaADescricao(p));
    if (r.ok) {
      const gravou = await gravarDescricaoEFontes(pedidoId, r.texto, JSON.stringify(comAEscrita(fontes, r.texto, "modelo", agora)), lida);
      return gravou ? { ok: true } : { ok: false, motivo: "a descrição mudou entretanto" };
    }
    const regras = descricaoPelasRegras(fontes, p.serviceType);
    const gravou = await gravarDescricaoEFontes(
      pedidoId,
      regras,
      JSON.stringify(comAEscrita(fontes, regras, "regras", agora, r.motivo.slice(0, 300))),
      lida,
    );
    if (gravou) {
      await appendOrderHistory(pedidoId, {
        type: "created",
        by: null,
        message: `A descrição ficou arrumada pelas regras: o modelo não a escreveu (${r.motivo.slice(0, 160)}).`,
      }).catch(() => {});
    }
    return { ok: false, motivo: r.motivo };
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    console.error("[descricao] não reescrevi o pedido", pedidoId, motivo);
    return { ok: false, motivo };
  }
}

/**
 * A EQUIPA GRAVOU A DESCRIÇÃO NO «EDITAR PEDIDO» — o texto dela passa a ser a
 * fonte da equipa, e manda (também quando é o que o botão «Arrumar a
 * descrição» escreveu e ela aceitou). Gravar o mesmo texto não muda nada.
 */
export async function guardarOTextoDaEquipa(
  antes: PedidoComDescricao,
  nova: string | null | undefined,
  agora: Date = new Date(),
): Promise<void> {
  if (textoNormal(nova) === textoNormal(antes.description)) return;
  const { gravarDescricaoEFontes } = await import("./db");
  const f = comTextoDaEquipa(lerFontes(antes.fontesDaDescricao) ?? fontesDeUmaDescricao(antes.description), nova, agora);
  await gravarDescricaoEFontes(antes.id, undefined, JSON.stringify(f));
}

/**
 * O PEDIDO QUE A VITÓRIA REGISTOU — as fontes nascem da conversa (as frases
 * dele, o que se viu nas fotografias, os campos), e não do texto que ela
 * arrumou. Depois da resposta, o modelo escreve a descrição a partir delas.
 */
export async function fontesDoPedidoRegistado(
  pedidoId: number,
  dados: DadosDaRecolha,
  descricao: string | null,
  agora: Date = new Date(),
): Promise<void> {
  const { gravarDescricaoEFontes } = await import("./db");
  const f = juntarAConversa(fontesVazias(), dados, agora);
  // As fotografias que ela já viu na conversa não se voltam a mandar ao modelo («*»: as que o pedido tiver agora).
  if (f.visto.length > 0) f.fotosVistas = [TODAS_VISTAS];
  await gravarDescricaoEFontes(pedidoId, undefined, JSON.stringify(comAEscrita(f, descricao ?? "", "regras", agora)));
}

/**
 * DEPOIS DA RESPOSTA — o `after()` do Next mantém a função viva depois de a
 * resposta sair; fora de um pedido (um teste, um cron) corre já.
 */
export async function depoisDaResposta(tarefa: () => Promise<unknown>): Promise<void> {
  try {
    const { after } = await import("next/server");
    after(async () => {
      await tarefa();
    });
  } catch {
    await tarefa();
  }
}
