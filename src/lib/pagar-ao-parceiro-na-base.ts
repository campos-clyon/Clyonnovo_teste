import { getPool, ensureNegociacoesTable } from "./db";
import type { ComoPagarAoParceiro } from "./pagar-ao-parceiro";
import type { RegimeDoProfissional } from "./pagamento-directo";

/**
 * O QUE O MODELO DE 15-11 (d10) GRAVA NA NEGOCIAÇÃO — só as duas colunas novas
 * (v20 de `negociacoes`): como o cliente paga ao parceiro e o regime de IVA do
 * parceiro, congelado na primeira vez que se lê depois de contratado.
 */

/** Grava como o cliente vai pagar ao parceiro. Só numa negociação contratada. */
export async function gravarComoPagarAoParceiro(negociacaoId: number, como: ComoPagarAoParceiro): Promise<boolean> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [r] = (await pool.execute(
    "UPDATE negociacoes SET pagarAoParceiroPor = ? WHERE id = ? AND estado = 'acordada'",
    [como, negociacaoId],
  )) as unknown as [{ affectedRows?: number }, unknown];
  return Number(r?.affectedRows ?? 0) > 0;
}

/**
 * Congela o regime do parceiro nesta negociação, se ainda não estiver. Devolve o
 * que fica (o que já lá estava ganha: um preço que o cliente viu não muda).
 */
export async function congelarRegimeDoProfissional(
  negociacaoId: number,
  regime: RegimeDoProfissional,
): Promise<RegimeDoProfissional> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return regime;
  await pool.execute(
    "UPDATE negociacoes SET regimeDoProfissional = ? WHERE id = ? AND regimeDoProfissional IS NULL AND estado = 'acordada'",
    [regime, negociacaoId],
  );
  const [linhas] = (await pool.execute("SELECT regimeDoProfissional, pagarAoParceiroPor FROM negociacoes WHERE id = ? LIMIT 1", [
    negociacaoId,
  ])) as unknown as [Array<{ regimeDoProfissional: string | null }>, unknown];
  const r = linhas[0]?.regimeDoProfissional;
  return r === "normal" || r === "isento" ? r : regime;
}

/** As duas colunas de uma negociação. */
export async function oQueONovoModeloGravou(
  negociacaoId: number,
): Promise<{ regimeDoProfissional: RegimeDoProfissional | null; pagarAoParceiroPor: string | null }> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return { regimeDoProfissional: null, pagarAoParceiroPor: null };
  const [linhas] = (await pool.execute(
    "SELECT regimeDoProfissional, pagarAoParceiroPor FROM negociacoes WHERE id = ? LIMIT 1",
    [negociacaoId],
  )) as unknown as [Array<{ regimeDoProfissional: string | null; pagarAoParceiroPor: string | null }>, unknown];
  const l = linhas[0];
  const r = l?.regimeDoProfissional;
  return { regimeDoProfissional: r === "normal" || r === "isento" ? r : null, pagarAoParceiroPor: l?.pagarAoParceiroPor ?? null };
}
