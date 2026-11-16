"use client";

import { useEffect, useState } from "react";
import { MOTIVOS_DO_FECHO, type MotivosPorServico } from "@/lib/motivo-do-fecho";
import { servicoEmPalavras } from "@/lib/servico-em-palavras";

/**
 * PORQUE SE FECHARAM, NA SEMANA — d54, 16-11-2026.
 *
 * Os pedidos cancelados ou arquivados nos últimos 7 dias, por serviço, com a
 * contagem de cada motivo (`motivo-do-fecho.ts`). Só leitura; sem nada para
 * contar, não ocupa lugar. Os fechados antes de 16-11 não têm motivo e não
 * entram.
 */
export default function MotivosDaSemana({ token }: { token: string | null }) {
  const [porServico, setPorServico] = useState<MotivosPorServico[] | null>(null);

  useEffect(() => {
    if (!token) return;
    let vivo = true;
    fetch("/api/admin/motivos-do-fecho", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vivo && d && Array.isArray(d.porServico)) setPorServico(d.porServico);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [token]);

  if (!porServico || porServico.length === 0) return null;
  const total = porServico.reduce((n, s) => n + s.total, 0);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-sm font-bold text-white">
        Fechados nos últimos 7 dias: {total} {total === 1 ? "pedido" : "pedidos"}
      </h3>
      <ul className="mt-2 space-y-1.5">
        {porServico.map((s) => (
          <li key={s.servico ?? "-"} className="text-xs text-slate-300">
            <span className="font-semibold text-slate-100">
              {s.servico ? servicoEmPalavras(s.servico) : "sem serviço"} · {s.total}
            </span>
            <span className="text-slate-400">
              {" — "}
              {MOTIVOS_DO_FECHO.filter((m) => (s.porMotivo[m.chave] ?? 0) > 0)
                .map((m) => `${m.rotulo.toLowerCase()} ${s.porMotivo[m.chave]}`)
                .join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
