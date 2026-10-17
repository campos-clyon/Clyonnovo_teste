"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, Search } from "lucide-react";

import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import {
  ROTULO_DA_ORIGEM,
  ROTULO_DA_SECCAO_DO_PEDIDO,
  termoQueProcura,
  type ResultadoDaProcura,
} from "@/lib/procurar-em-todo-o-lado";
import { servicoEmPalavras } from "@/lib/servico-em-palavras";

/**
 * O QUE A PROCURA ENCONTRA NOUTROS SÍTIOS — 17-10-2026.
 *
 * *«As barras de pesquisa de toda a backoffice devem mostrar qualquer
 * trabalho, independente de onde foi gerado.»* — o dono. Por baixo da caixa
 * de cada ecrã de trabalhos: os pedidos que a mesma procura encontra fora da
 * lista deste ecrã, com a origem (Trabalho CLYON, Negociação, Pedido do site)
 * e um botão que abre o ecrã onde ele se trata, já procurado pelo número.
 */

/** O painel diz como se vai a outra secção, e que secções esta conta vê. */
export type ProcuraGlobal = {
  ir: (seccao: string, procura: string, estado?: string | null) => void;
  podeVer: (seccao: string) => boolean;
};

export const ProcuraGlobalContext = createContext<ProcuraGlobal | null>(null);

const ESPERA_MS = 350;

export default function NoutrosSitios({
  procura,
  jaAqui,
  seccao,
  tema = "escuro",
}: {
  /** O que está escrito na caixa deste ecrã. */
  procura: string;
  /** Os pedidos que este ecrã já mostra — não se repetem aqui. */
  jaAqui: number[];
  /** A secção deste ecrã, para não oferecer «abrir» onde já se está. */
  seccao: string;
  /** «claro» na gestão dos pedidos do Início, que tem fundo claro. */
  tema?: "escuro" | "claro";
}) {
  const claro = tema === "claro";
  const { token } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const global = useContext(ProcuraGlobalContext);
  const [resultados, setResultados] = useState<ResultadoDaProcura[]>([]);
  const [aProcurar, setAProcurar] = useState(false);
  const termo = procura.trim();

  useEffect(() => {
    if (!token || !termoQueProcura(termo)) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    const espera = setTimeout(async () => {
      setAProcurar(true);
      try {
        const r = await fetch(`/api/admin/procurar?q=${encodeURIComponent(termo)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const d = r.ok ? await r.json() : null;
        if (!cancelado) setResultados((d?.resultados ?? []) as ResultadoDaProcura[]);
      } catch {
        if (!cancelado) setResultados([]);
      } finally {
        if (!cancelado) setAProcurar(false);
      }
    }, ESPERA_MS);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [termo, token]);

  const aqui = useMemo(() => new Set(jaAqui), [jaAqui]);
  const fora = resultados.filter((r) => !aqui.has(r.pedidoId));

  if (!termoQueProcura(termo)) return null;
  if (fora.length === 0) {
    return aProcurar ? (
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> A procurar no resto do backoffice…
      </p>
    ) : null;
  }

  return (
    <div
      className={`mt-2 rounded-xl border p-3 ${claro ? "border-[#ccccff] bg-white/80" : "border-slate-700/70 bg-slate-950/50"}`}
      aria-live="polite"
    >
      <p className={`flex items-center gap-1.5 text-xs font-semibold ${claro ? "text-slate-700" : "text-slate-300"}`}>
        <Search className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
        Noutros sítios do backoffice · {fora.length}
      </p>
      <ul className={`mt-2 divide-y ${claro ? "divide-slate-200" : "divide-slate-800/80"}`}>
        {fora.map((r) => {
          const podeAbrir = global != null && r.seccao !== seccao && global.podeVer(r.seccao);
          return (
            <li key={r.pedidoId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0 text-xs">
                <p className={`font-semibold ${claro ? "text-slate-900" : "text-white"}`}>
                  #{r.pedidoId} · {servicoEmPalavras(r.servico)}
                  {r.cidade ? <span className="font-normal text-slate-400"> · {r.cidade}</span> : null}
                </p>
                <p className="mt-0.5 text-slate-400">
                  {[r.cliente, r.telefone, r.profissional ? `com ${r.profissional}` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                  {ROTULO_DA_ORIGEM[r.origem]}
                </span>
                {r.estado && (
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{r.estado.replace(/_/g, " ")}</span>
                )}
                {podeAbrir ? (
                  <button
                    type="button"
                    onClick={() => global!.ir(r.seccao, `#${r.pedidoId}`, r.estado)}
                    className="flex items-center gap-1 rounded-lg border border-cyan-500/40 px-2 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/10"
                  >
                    {r.seccao === "pedidos" && seccao === "overview"
                      ? "Mostrar na lista"
                      : `Abrir em ${ROTULO_DA_SECCAO_DO_PEDIDO[r.seccao]}`}{" "}
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </button>
                ) : eAdministrador ? (
                  <a
                    href={`/admin/pedidos/${r.pedidoId}`}
                    className="rounded-lg border border-slate-600 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Ver o pedido
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
