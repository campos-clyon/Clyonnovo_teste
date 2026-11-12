/**
 * O RELÓGIO DO MODELO DE 15-11-2026 — d10 (`novo-modelo.ts`). Só para o servidor.
 *
 * Para ver o site inteiro como a 15-11 numa pré-visualização da Vercel, ou em
 * local, há `NOVO_MODELO_DATA_SIMULADA` (ex. «2026-11-15T10:00:00Z»). EM PRODUÇÃO
 * É IGNORADA: com `VERCEL_ENV` igual a «production» lê-se sempre o relógio
 * verdadeiro — ninguém liga o modelo no ar com uma variável esquecida.
 */
function dataSimulada(): Date | null {
  if (typeof process === "undefined" || !process.env) return null;
  if (process.env.VERCEL_ENV === "production") return null;
  const v = process.env.NOVO_MODELO_DATA_SIMULADA;
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** O «agora» do modelo: o relógio, ou a data simulada fora da produção. */
export function agoraDoModelo(): Date {
  return dataSimulada() ?? new Date();
}
