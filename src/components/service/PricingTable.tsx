import { Info } from "lucide-react";

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
  footnote = "Valores indicativos. O preço final depende do volume, acesso e localização.",
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
                    <span className="text-lg font-bold text-cyan-600">
                      {row.priceTo
                        ? `${row.priceFrom} - ${row.priceTo}`
                        : `desde ${row.priceFrom}`}
                    </span>
                    {row.note && (
                      <span
                        className="group relative cursor-help"
                        title={row.note}
                      >
                        <Info className="h-4 w-4 text-slate-400" />
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
