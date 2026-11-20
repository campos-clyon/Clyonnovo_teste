"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import {
  GRUPOS_DA_PROCURA,
  haOQueProcurar,
  seccaoQueAbre,
  type GrupoDaProcura,
  type GruposDaProcura,
} from "@/lib/procura-do-backoffice";

/**
 * «EM TODO O BACKOFFICE» — d79 (20-11-2026). Era o «Noutros sítios do
 * backoffice» (17-10-2026), por baixo da caixa de procura de cada ecrã de
 * trabalhos. Com a barra única no topo do backoffice passou a ser um bloco só,
 * por baixo da secção aberta, com tudo o que a procura encontra: o pedido, o
 * cliente, o profissional, os pagamentos e as referências, a conversa do
 * WhatsApp, a agenda e as faturas/comprovativos. Cada linha abre o sítio certo,
 * já procurado. O servidor só devolve os grupos das secções desta conta.
 */

/** O painel diz como se vai a outra secção, que secções esta conta vê, e o que está na barra. */
export type ProcuraGlobal = {
  ir: (seccao: string, procura: string, estado?: string | null) => void;
  podeVer: (seccao: string) => boolean;
  /** O que está na barra do topo, já assente (≈ 250 ms depois da última tecla). */
  termo: string;
  /** Muda a barra do topo — o «Ver todos» ou o «Limpar filtros» de uma secção. */
  mudar: (q: string) => void;
};

export const ProcuraGlobalContext = createContext<ProcuraGlobal | null>(null);

/**
 * A procura de uma secção é a da barra do topo (d79). Fora do painel (uma
 * página que monte o ecrã sozinho) fica uma procura local, vazia.
 */
export function useProcuraDoBackoffice(): { termo: string; mudar: (q: string) => void } {
  const global = useContext(ProcuraGlobalContext);
  const [local, setLocal] = useState("");
  return global ? { termo: global.termo, mudar: global.mudar } : { termo: local, mudar: setLocal };
}

const TITULO_DO_GRUPO: Record<GrupoDaProcura, string> = {
  pedidos: "Pedidos",
  clientes: "Clientes",
  profissionais: "Profissionais",
  pagamentos: "Pagamentos e referências",
  whatsapp: "Conversas do WhatsApp",
  agenda: "Agenda",
  documentos: "Faturas e comprovativos",
};

const NOME_DA_SECCAO: Record<string, string> = {
  negociacoes_clyon: "Mesa",
  pedidos: "Todos os pedidos",
  pagamentos: "Pagamentos",
  carteiras: "Finanças",
  agenda: "Agenda",
  whatsapp: "WhatsApp",
  contas: "Contas",
  profissionais: "Profissionais",
};

export default function EmTodoOBackoffice({ seccao }: { seccao: string }) {
  const { token } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const global = useContext(ProcuraGlobalContext);
  const termo = (global?.termo ?? "").trim();
  // Uma conta sem nenhum grupo (só Levantamentos, por exemplo) nem pergunta ao servidor.
  const temGrupos = global != null && GRUPOS_DA_PROCURA.some((g) => g.seccoes.some((s) => global.podeVer(s)));
  const [grupos, setGrupos] = useState<GruposDaProcura>({});
  const [aProcurar, setAProcurar] = useState(false);
  // O mesmo termo não se pede duas vezes ao mudar de secção.
  const jaPedidos = useRef(new Map<string, GruposDaProcura>());

  useEffect(() => {
    if (!token || !temGrupos || !haOQueProcurar(termo)) {
      setGrupos({});
      return;
    }
    const guardado = jaPedidos.current.get(termo);
    if (guardado) {
      setGrupos(guardado);
      return;
    }
    const controlo = new AbortController();
    setAProcurar(true);
    (async () => {
      try {
        const r = await fetch(`/api/admin/procurar?q=${encodeURIComponent(termo)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controlo.signal,
        });
        const d = r.ok ? await r.json() : null;
        const g = (d?.grupos ?? {}) as GruposDaProcura;
        if (r.ok) {
          if (jaPedidos.current.size > 30) jaPedidos.current.clear();
          jaPedidos.current.set(termo, g);
        }
        if (!controlo.signal.aborted) setGrupos(g);
      } catch {
        if (!controlo.signal.aborted) setGrupos({});
      } finally {
        if (!controlo.signal.aborted) setAProcurar(false);
      }
    })();
    return () => controlo.abort();
  }, [termo, token, temGrupos]);

  if (!temGrupos || !haOQueProcurar(termo)) return null;
  const comLinhas = GRUPOS_DA_PROCURA.filter((g) => (grupos[g.id]?.length ?? 0) > 0);
  const total = comLinhas.reduce((n, g) => n + (grupos[g.id]?.length ?? 0), 0);

  return (
    <section
      aria-label="Em todo o backoffice"
      aria-live="polite"
      className="rounded-[22px] border border-slate-700/60 bg-slate-900/80 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.28)] sm:p-4"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        Em todo o backoffice
        <span className="text-xs font-normal text-slate-400">
          {aProcurar && total === 0 ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> a procurar…
            </span>
          ) : (
            `«${termo}» · ${total === 0 ? "nada encontrado" : `${total} resultado${total === 1 ? "" : "s"}`}`
          )}
        </span>
      </h3>
      {comLinhas.length > 0 && (
        <div className="mt-2 space-y-3">
          {comLinhas.map((g) => (
            <div key={g.id}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{TITULO_DO_GRUPO[g.id]}</p>
              <ul className="mt-1 divide-y divide-slate-800/80">
                {(grupos[g.id] ?? []).map((l) => {
                  const destino = global ? seccaoQueAbre(l.abrir, global.podeVer) : null;
                  const aqui = destino === seccao;
                  return (
                    <li key={l.chave} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="break-words font-semibold text-white">{l.titulo}</p>
                        {l.detalhe && <p className="mt-0.5 break-words text-slate-400">{l.detalhe}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {l.etiqueta && <span className="text-[10px] text-slate-500">{l.etiqueta}</span>}
                        {destino && l.abrir ? (
                          <button
                            type="button"
                            onClick={() => global!.ir(destino, l.abrir!.procura, l.abrir!.estado ?? null)}
                            className="flex items-center gap-1 rounded-lg border border-cyan-500/40 px-2 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/10"
                          >
                            {aqui ? "Mostrar aqui" : `Abrir em ${NOME_DA_SECCAO[destino] ?? destino}`}
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </button>
                        ) : eAdministrador && l.pedidoId ? (
                          <a
                            href={`/admin/pedidos/${l.pedidoId}`}
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
          ))}
        </div>
      )}
    </section>
  );
}
