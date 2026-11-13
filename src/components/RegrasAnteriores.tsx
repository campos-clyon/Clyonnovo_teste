import type { ReactNode } from "react";
import { NOVO_MODELO_DESDE_POR_EXTENSO } from "@/lib/novo-modelo";

/**
 * AS REGRAS ANTERIORES A 15-11-2026 — d10 (`novo-modelo.ts`).
 *
 * Nos Termos e na Privacidade o texto do modelo antigo não se apaga: continua a
 * valer para os trabalhos que o cliente já pagou à CLYON antes da data (o corte
 * `CORTE_DO_MODELO = "ja_pago_a_clyon"`), para os que já estavam concluídos e
 * para os Trabalhos CLYON (`TRABALHOS_CLYON_NO_MODELO_ANTIGO`).
 *
 * Antes da data (`emCaixa` falso) desenha o texto tal e qual, sem nada à volta:
 * a página fica igual à de hoje. A partir da data, mete-o numa caixa com o
 * título que diz a quem vale. O teste da orquestra (regra s) deixa as palavras
 * do modelo antigo só aqui dentro, ou em declarações com «ANTIGO» no nome.
 */
export const TITULO_DAS_REGRAS_ANTIGAS =
  `Regras anteriores a ${NOVO_MODELO_DESDE_POR_EXTENSO} — valem só para os trabalhos já pagos à CLYON antes ` +
  "dessa data, para os que nessa data já estavam concluídos e para os trabalhos de valor fixo combinados com a CLYON.";

export function RegrasAnteriores({ emCaixa, children }: { emCaixa: boolean; children: ReactNode }) {
  if (!emCaixa) return <>{children}</>;
  return (
    <div data-regras-anteriores="" className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <p className="font-semibold text-slate-800">{TITULO_DAS_REGRAS_ANTIGAS}</p>
      {children}
    </div>
  );
}
