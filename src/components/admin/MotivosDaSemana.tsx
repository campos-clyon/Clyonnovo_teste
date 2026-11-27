"use client";

import { useEffect, useState } from "react";
import { useAbertosLembrados } from "@/components/admin/useAbertosLembrados";
import { BOTAO_ABERTO, BOTAO_DA_LINHA, BOTAO_NEUTRO, PAINEL_DA_LINHA } from "@/components/admin/linhaDaMesa";
import { MOTIVOS_DO_FECHO, type MotivosPorServico } from "@/lib/motivo-do-fecho";
import { servicoEmPalavras } from "@/lib/servico-em-palavras";

/**
 * PORQUE SE FECHARAM, NA SEMANA — d54, 16-11-2026.
 *
 * Os pedidos cancelados ou arquivados nos últimos 7 dias, por serviço, com a
 * contagem de cada motivo (`motivo-do-fecho.ts`). Só leitura; sem nada para
 * contar, não ocupa lugar. Os fechados antes de 16-11 não têm motivo e não
 * entram.
 *
 * Fechado por omissão (18-11-2026, «mesa-so-pedidos-vivos»): o título e o
 * número; abre-se por opção, e a escolha fica lembrada neste navegador.
 *
 * d142 (27-11-2026, dono): um botão pequeno na linha discreta da Mesa
 * («5 fechados (7 dias)»); a lista abre por baixo da linha.
 */
export default function MotivosDaSemana({ token }: { token: string | null }) {
  const [porServico, setPorServico] = useState<MotivosPorServico[] | null>(null);
  const { aberto, alternar } = useAbertosLembrados("clyon.mesa.motivos-da-semana");
  const abertoAgora = aberto("motivos");

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
    <>
      <button
        type="button"
        onClick={() => alternar("motivos")}
        aria-expanded={abertoAgora}
        title="Fechados nos últimos 7 dias: cancelados e arquivados, por serviço e motivo."
        className={`${BOTAO_DA_LINHA} ${abertoAgora ? BOTAO_ABERTO : BOTAO_NEUTRO}`}
      >
        <span className="font-bold tabular-nums text-slate-400">{total}</span>
        fechados (7 dias)
      </button>
      {abertoAgora && (
      <section className={PAINEL_DA_LINHA}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-slate-100">
          Fechados nos últimos 7 dias <span className="text-slate-400">· {total}</span>
        </h3>
        <button type="button" onClick={() => alternar("motivos")} className="shrink-0 text-[11px] text-slate-500 hover:underline">
          Fechar
        </button>
      </div>
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
      )}
    </>
  );
}
