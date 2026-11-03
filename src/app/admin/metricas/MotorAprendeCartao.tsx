"use client";

import { useEffect, useState } from "react";
import { servicoEmPalavras } from "@/lib/servico-em-palavras";

/*
 * O QUE O MOTOR APRENDEU — 03-11-2026. Lê `/api/admin/motor-aprende`.
 *
 * Uma linha por serviço: trabalhos acordados que contam, quanto o valor real
 * ficou acima ou abaixo do estimado (a meio), e o ajuste que o simulador está
 * a aplicar. «A aprender» quer dizer que ainda há poucos trabalhos para mexer
 * no preço.
 */

type Linha = {
  servico: string;
  amostra: number;
  descartados: number;
  mediana: number | null;
  fator: number;
  diferencaMediaEuros: number | null;
};
type Resposta = {
  servicos: Linha[];
  regras: { amostraMinima: number; fatorMinimo: number; fatorMaximo: number; dias: number };
};

const emPct = (r: number) => {
  const p = Math.round((r - 1) * 100);
  return `${p > 0 ? "+" : ""}${p}%`;
};

export default function MotorAprendeCartao({ authHeader }: { authHeader: Record<string, string> }) {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/admin/motor-aprende", { headers: authHeader })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as Resposta;
      })
      .then((d) => vivo && setDados(d))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Erro"));
    return () => {
      vivo = false;
    };
  }, [authHeader]);

  return (
    <div className="mt-6 rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-6">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.15em] text-slate-300">O motor aprende</h2>
      <p className="mb-5 text-xs text-slate-500">
        Estimativa do simulador comparada com o valor acordado
        {dados ? ` nos últimos ${dados.regras.dias} dias` : ""}. O ajuste move o preço só dentro da faixa
        publicada, e só a partir de {dados?.regras.amostraMinima ?? 5} trabalhos.
      </p>

      {erro && <p className="text-sm text-red-400">Não foi possível ler: {erro}</p>}
      {!erro && !dados && <div className="h-20 animate-pulse rounded-[14px] bg-white/[0.02]" />}
      {dados && dados.servicos.length === 0 && (
        <p className="text-sm text-slate-600">Ainda não há trabalhos acordados com estimativa para comparar.</p>
      )}

      {dados && dados.servicos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-4 font-medium">Serviço</th>
                <th className="pb-2 pr-4 font-medium">Trabalhos</th>
                <th className="pb-2 pr-4 font-medium">Real vs. estimado</th>
                <th className="pb-2 pr-4 font-medium">Diferença média</th>
                <th className="pb-2 font-medium">Ajuste aplicado</th>
              </tr>
            </thead>
            <tbody>
              {dados.servicos.map((l) => (
                <tr key={l.servico} className="border-t border-white/[0.05] text-slate-300">
                  <td className="py-2 pr-4">{servicoEmPalavras(l.servico)}</td>
                  <td className="py-2 pr-4">
                    {l.amostra}
                    {l.descartados > 0 && <span className="text-slate-600"> (+{l.descartados} fora)</span>}
                  </td>
                  <td className="py-2 pr-4">{l.mediana != null ? emPct(l.mediana) : "—"}</td>
                  <td className="py-2 pr-4">
                    {l.diferencaMediaEuros != null ? `${l.diferencaMediaEuros.toFixed(2).replace(".", ",")} €` : "—"}
                  </td>
                  <td className="py-2">
                    {l.fator === 1 ? (
                      <span className="text-slate-500">
                        {l.amostra < dados.regras.amostraMinima ? "A aprender" : "Sem ajuste"}
                      </span>
                    ) : (
                      <span className="font-semibold text-[#00B4D8]">{emPct(l.fator)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
