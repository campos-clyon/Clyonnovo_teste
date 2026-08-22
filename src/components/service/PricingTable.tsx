import { Info } from "lucide-react";

import { NOTA_DE_PRECO } from "@/lib/seo-data";

/**
 * Reduz um valor a número, seja como for que ele chegue.
 *
 * As páginas passam o preço em formatos diferentes — "110", "110€", "110 €",
 * "80EUR" — porque durante muito tempo cada uma escreveu o seu. Aqui tira-se
 * o símbolo e os espaços para a grelha voltar a compor tudo da mesma maneira.
 *
 * Devolve `null` quando o que sobra não é um número limpo ("—", "orçamento
 * personalizado", "110€/m³"). Nesse caso o valor original passa intacto: mais
 * vale mostrar o que a página escreveu do que inventar um "€" no fim de uma
 * frase.
 */
function apenasONumero(valor: string): string | null {
  const limpo = valor.replace(/\s|€|EUR/gi, "");
  return /^\d+(?:[.,]\d+)?$/.test(limpo) ? limpo : null;
}

/**
 * A forma única de escrever um preço na grelha: travessão com espaços e o
 * símbolo uma só vez, no fim — "110 – 150 €", "desde 110 €".
 *
 * Antes era `${priceFrom} - ${priceTo}`, com hífen ASCII e o símbolo colado a
 * cada número ("80€ - 120€"), porque vinha embebido nos dados de cada página.
 * Como este é o único componente de grelhas do site, corrigir aqui alinha
 * /recolha-de-entulho e qualquer página que passe a usá-lo.
 */
function faixaFormatada(de: string, ate?: string): string {
  const inicio = apenasONumero(de);
  const fim = ate ? apenasONumero(ate) : null;

  if (inicio) {
    // `ate` sem número — o "—" da linha "acima de 5m³" — lê-se como sem tecto.
    return fim ? `${inicio} – ${fim} €` : `desde ${inicio} €`;
  }

  return ate ? `${de} – ${ate}` : de;
}

export interface PricingRow {
  service: string;
  description?: string;
  priceFrom: string;
  priceTo?: string;
  note?: string;
}

interface PricingTableProps {
  title?: string;
  subtitle?: string;
  rows: PricingRow[];
  footnote?: string;
  className?: string;
}

export default function PricingTable({
  title = "Preços Orientativos",
  subtitle,
  rows,
  /*
   * A nota do IVA por baixo da grelha, e importada de seo-data em vez de
   * escrita à mão — para não voltar a existir uma segunda versão do texto.
   *
   * Os valores da grelha são orientativos e SEM IVA, e isso tem de estar dito
   * onde eles aparecem: quem executa é que emite a factura, e cada
   * profissional tem o seu regime. Quem passar `footnote` substitui esta
   * linha inteira — não acrescenta uma segunda.
   */
  footnote = `${NOTA_DE_PRECO.curta} O que faz variar: volume, acesso e localização.`,
  className = "",
}: PricingTableProps) {
  return (
    <div className={`rounded-3xl border border-cyan-100 bg-white p-6 shadow-[0_20px_50px_-20px_rgba(14,116,144,0.12)] sm:p-8 ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        {subtitle && (
          <p className="mt-2 text-slate-600">{subtitle}</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px]">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="pb-4 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
                Serviço
              </th>
              <th className="pb-4 text-right text-sm font-semibold uppercase tracking-wide text-slate-500">
                Preço
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={index} className="group">
                <td className="py-4 pr-4">
                  <div className="font-medium text-slate-900">{row.service}</div>
                  {row.description && (
                    <div className="mt-1 text-sm text-slate-500">
                      {row.description}
                    </div>
                  )}
                </td>
                <td className="py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-lg font-bold text-acao">
                      {faixaFormatada(row.priceFrom, row.priceTo)}
                    </span>
                    {row.note && (
                      <span
                        className="group relative cursor-help"
                        title={row.note}
                      >
                        <Info className="h-4 w-4 text-tinta-fraca" />
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {footnote && (
        <p className="mt-6 flex items-start gap-2 text-sm text-slate-500">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {footnote}
        </p>
      )}
    </div>
  );
}
