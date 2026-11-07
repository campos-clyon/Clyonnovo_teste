"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";

import { ProcuraGlobalContext } from "@/components/admin/NoutrosSitios";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import {
  doNossoLado,
  haQuantoEspera,
  type ConversaParaOLado,
  type LinhaDoNossoLado,
  type PedidoParaOLado,
  type TrabalhoClyonParaOLado,
} from "@/lib/do-nosso-lado";
import { telefoneLegivel } from "@/lib/telefone-legivel";

/**
 * «DO NOSSO LADO» — o cartão do topo da Mesa (d14, 03-11-2026). Só leitura:
 * diz o que espera pela CLYON, com o n.º do pedido e há quanto tempo, e cada
 * linha abre o pedido (ou a conversa, quando ainda não há pedido). As regras
 * estão em `do-nosso-lado.ts`.
 *
 * As conversas vêm da mesa do WhatsApp (`/api/admin/whatsapp?so=mesa`), de 2
 * em 2 minutos e com o separador à vista; o resto é o que a Mesa já carregou.
 * Uma conta sem a secção WhatsApp não vê o grupo das conversas.
 */

/** As conversas lêem-se de 2 em 2 minutos: a mesa delas é a leitura mais pesada. */
const CONVERSAS_DE_MS = 120_000;
/** Quantas linhas de cada grupo se vêem antes do «Ver mais». */
const LINHAS_A_VISTA = 5;

export default function DoNossoLado({
  token,
  pedidos,
  trabalhosClyon,
  onAbrirPedido,
}: {
  token: string | null;
  pedidos: PedidoParaOLado[];
  trabalhosClyon: TrabalhoClyonParaOLado[];
  /** Abre o pedido na Mesa (procura-o pelo número). */
  onAbrirPedido: (pedidoId: number) => void;
}) {
  const global = useContext(ProcuraGlobalContext);
  const podeVerConversas = global ? global.podeVer("whatsapp") : true;
  const [conversas, setConversas] = useState<ConversaParaOLado[] | null>(null);
  const [conversasFalharam, setConversasFalharam] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [fechado, setFechado] = useState(false);
  const lidasEm = useRef(0);
  const [agora, setAgora] = useState(() => new Date());

  const lerConversas = useCallback(
    async (forcar = false) => {
      if (!token || !podeVerConversas) return;
      if (!forcar && Date.now() - lidasEm.current < CONVERSAS_DE_MS) return;
      lidasEm.current = Date.now();
      try {
        const r = await fetch("/api/admin/whatsapp?so=mesa", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!r.ok) {
          setConversasFalharam(true);
          return;
        }
        const d = await r.json();
        setConversas(Array.isArray(d?.mesa) ? (d.mesa as ConversaParaOLado[]) : []);
        setConversasFalharam(false);
      } catch {
        setConversasFalharam(true);
      }
    },
    [token, podeVerConversas],
  );

  useEffect(() => {
    void lerConversas(true);
  }, [lerConversas]);
  // O relógio anda com a Mesa (a batida de 20 s); as conversas, de 2 em 2 min.
  useAutoRefresh(() => {
    setAgora(new Date());
    return lerConversas();
  });

  const grupos = doNossoLado({ conversas: podeVerConversas ? conversas : null, pedidos, trabalhosClyon, agora });
  const total = grupos.reduce((s, g) => s + g.linhas.length, 0);
  const visiveis = grupos.filter((g) => g.linhas.length > 0 || (g.tipo === "conversa" && podeVerConversas && conversasFalharam));

  const abrir = (l: LinhaDoNossoLado) => {
    if (l.pedidoId != null) onAbrirPedido(l.pedidoId);
    else if (l.telefone && global) global.ir("whatsapp", l.telefone);
  };

  return (
    <section aria-label="Do nosso lado" className="mb-3 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2">
      <button
        type="button"
        onClick={() => setFechado((f) => !f)}
        aria-expanded={!fechado}
        className="flex w-full items-baseline justify-between gap-3 text-left"
      >
        <span className="text-[13px] font-semibold text-slate-100">
          Do nosso lado{" "}
          <span className={total > 0 ? "text-ciano-texto" : "text-slate-500"}>· {total}</span>
        </span>
        <span className="text-[11px] text-slate-500">{fechado ? "Mostrar" : "Esconder"}</span>
      </button>
      {!fechado && (
        <div className="mt-1">
          <p className="text-[11px] text-slate-500">
            O que está à espera de nós. Carregue numa linha para abrir o pedido.
          </p>
          {visiveis.length === 0 ? (
            <p className="mt-1.5 text-xs text-slate-400">Nada à espera de nós.</p>
          ) : (
            visiveis.map((g) => {
              const aberto = abertos.has(g.tipo);
              const linhas = aberto ? g.linhas : g.linhas.slice(0, LINHAS_A_VISTA);
              return (
                <div key={g.tipo} className="mt-2">
                  <p className="text-[11px] font-semibold text-slate-300">
                    {g.titulo} <span className="text-slate-500">· {g.linhas.length}</span>
                  </p>
                  {g.tipo === "conversa" && conversasFalharam && (
                    <p className="text-[11px] text-amber-300">As conversas não se leram agora; volta a tentar daqui a 2 minutos.</p>
                  )}
                  <ul className="mt-0.5 divide-y divide-slate-800">
                    {linhas.map((l) => (
                      <li key={`${l.tipo}-${l.pedidoId ?? l.telefone}`}>
                        <button
                          type="button"
                          onClick={() => abrir(l)}
                          disabled={l.pedidoId == null && !global}
                          className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-3 py-1 text-left text-xs transition hover:bg-slate-900"
                        >
                          <span className="font-semibold text-cyan-300">
                            {l.pedidoId != null ? `#${l.pedidoId}` : telefoneLegivel(l.telefone) || "—"}
                          </span>
                          <span className="truncate text-slate-300">{l.oQue}</span>
                          <span className="whitespace-nowrap text-slate-400">{haQuantoEspera(l.esperaS)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {g.linhas.length > LINHAS_A_VISTA && (
                    <button
                      type="button"
                      onClick={() =>
                        setAbertos((s) => {
                          const n = new Set(s);
                          if (n.has(g.tipo)) n.delete(g.tipo);
                          else n.add(g.tipo);
                          return n;
                        })
                      }
                      className="mt-0.5 text-[11px] font-semibold text-cyan-400 hover:underline"
                    >
                      {aberto ? "Ver menos" : `Ver mais ${g.linhas.length - LINHAS_A_VISTA}`}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
