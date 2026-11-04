import { ensureProvidersSchema, getPool } from "./db";
import { guiaImpedeContratar } from "./guia-antes-de-contratar";

/**
 * A GUIA ANTES DE CONTRATAR, LIDA NA BASE — 04-11-2026 (d10.1; transição de 7
 * dias na v2).
 *
 * As portas que fecham um trabalho (o cliente pelo link, pela conta, pela app
 * e pelo WhatsApp; a Mesa em nome dele; a escolha e o «aceitar» directo de um
 * Trabalho CLYON; o «passar a outro») perguntam aqui, no servidor, e nunca ao
 * que o ecrã julgava. A regra é a de `guia-antes-de-contratar.ts`, com a
 * transição dos aprovados antes de 04-11 (o estado e `aprovadoEm` vêm na linha).
 *
 * Sem base, lança: quem chama está dentro de um try e responde 500 — nunca se
 * contrata às cegas por a pergunta não ter resposta.
 */

type Linha = {
  serviceType: string | null;
  precisaGuiaTransporte: number | null;
  emiteGuiaTransporte: number | null;
  guiaVerificadaEm: Date | string | null;
  estado: string | null;
  aprovadoEm: Date | string | null;
};

const COLUNAS = `o.serviceType, o.precisaGuiaTransporte,
            p.emiteGuiaTransporte, p.guiaVerificadaEm, p.estado, p.aprovadoEm`;

/** A negociação `negociacaoId` não pode ser fechada por causa da guia? */
export async function guiaImpedeANegociacao(negociacaoId: number, agora: Date = new Date()): Promise<boolean> {
  // `aprovadoEm` nasceu a 04-11-2026: a coluna tem de existir antes de se ler.
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [linhas] = (await pool.execute(
    `SELECT ${COLUNAS}
       FROM negociacoes n
       JOIN simulatorOrders o ON o.id = n.pedidoId
       JOIN providers p ON p.id = n.providerId
      WHERE n.id = ?
      LIMIT 1`,
    [negociacaoId],
  )) as [Linha[], unknown];
  const l = linhas[0];
  return l ? guiaImpedeContratar(l, l, agora) : false;
}

/** O profissional `providerId` não pode ficar com o pedido `pedidoId` por causa da guia? */
export async function guiaImpedeOProfissional(
  pedidoId: number,
  providerId: number,
  agora: Date = new Date(),
): Promise<boolean> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [linhas] = (await pool.execute(
    `SELECT ${COLUNAS}
       FROM simulatorOrders o
       JOIN providers p ON p.id = ?
      WHERE o.id = ?
      LIMIT 1`,
    [providerId, pedidoId],
  )) as [Linha[], unknown];
  const l = linhas[0];
  return l ? guiaImpedeContratar(l, l, agora) : false;
}
