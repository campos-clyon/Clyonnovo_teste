import type { RegimeDoProfissional } from "./pagamento-directo";
import { totalAoClienteDaNegociacao, type LinhaParaOTotal } from "./total-ao-cliente";

/**
 * O REGIME CONGELADO ACERTA-SE QUANDO O PARCEIRO O CONFIRMA — d2, 19-11-2026.
 *
 * Ao contratar, um parceiro com o regime «a confirmar» fica com «normal» na
 * negociação (`db.ts`, o congelar do contratar): a conta faz-se como com IVA.
 * Se depois ele confirmar que é isento, o cliente desse trabalho ficava a pagar
 * 23 % de IVA que nenhuma fatura tem. Agora, quando o regime se confirma (no
 * perfil dele ou na ficha do backoffice), as negociações contratadas e ainda
 * sem pagamento desse parceiro recalculam-se com o regime novo — e a regra é
 * uma só: fica o MENOR dos dois totais. O preço que o cliente viu só desce,
 * nunca sobe.
 *
 * Pura: a base vive em `regime-acertado-na-base.ts`.
 */

export type AcertoDoRegime = {
  regimeAntes: RegimeDoProfissional;
  regimeDepois: RegimeDoProfissional;
  totalAntes: number;
  totalDepois: number;
  /** O total desceu: grava-se o regime novo e avisa-se o cliente. */
  desceu: boolean;
};

/**
 * Compara o total com o regime congelado e com o do perfil, pelo valor
 * acordado. `null` quando não há regime congelado ou valor para contar — aí
 * não se mexe em nada.
 */
export function acertoDoRegime(
  linha: LinhaParaOTotal & { valorAcordado?: unknown },
  regimeDoPerfil: RegimeDoProfissional,
): AcertoDoRegime | null {
  const antes = linha.regimeDoProfissional;
  if (antes !== "normal" && antes !== "isento") return null;
  const valor = Number(linha.valorAcordado);
  if (linha.valorAcordado == null || !Number.isFinite(valor) || valor <= 0) return null;
  const tAntes = totalAoClienteDaNegociacao(linha, valor);
  const tDepois = totalAoClienteDaNegociacao({ ...linha, regimeDoProfissional: regimeDoPerfil }, valor);
  if (!tAntes || !tDepois) return null;
  // min(antigo, novo): só desce. Igual ou a subir, fica o que estava.
  const desceu = regimeDoPerfil !== antes && tDepois.total < tAntes.total;
  return {
    regimeAntes: antes,
    regimeDepois: desceu ? regimeDoPerfil : antes,
    totalAntes: tAntes.total,
    totalDepois: desceu ? tDepois.total : tAntes.total,
    desceu,
  };
}

const emEuros = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2).replace(".", ",")} €`;

/** A frase do aviso ao cliente (email), quando o total desce. */
export function fraseDoTotalQueDesceu(pedidoId: number, a: Pick<AcertoDoRegime, "totalAntes" | "totalDepois">): string {
  return (
    `O parceiro do pedido #${pedidoId} confirmou que é isento de IVA (art. 53.º). ` +
    `O total a pagar desceu de ${emEuros(a.totalAntes)} para ${emEuros(a.totalDepois)}.`
  );
}

/**
 * AS NEGOCIAÇÕES QUE SE PODEM ACERTAR — contratadas no modelo de 15-11, com o
 * regime congelado, e sem nada pago nem feito: sem pagamento declarado ou dado
 * por pago, sem o trabalho enviado ou feito, sem fatura carregada e sem parte
 * da taxa já passada à CLYON. Um trabalho já pago (o #618, à espera do
 * contabilista) nunca muda daqui.
 */
export const ONDE_O_REGIME_SE_PODE_ACERTAR = `n.providerId = ?
     AND n.estado = 'acordada'
     AND n.contratadaEm IS NOT NULL
     AND n.ofertaClyon IS NULL
     AND n.regimeDoProfissional IN ('normal', 'isento')
     AND n.pagoEm IS NULL
     AND n.pagamentoDeclaradoEm IS NULL
     AND n.execucaoEnviadaEm IS NULL
     AND n.feitoEm IS NULL
     AND n.confirmadoEm IS NULL`;
