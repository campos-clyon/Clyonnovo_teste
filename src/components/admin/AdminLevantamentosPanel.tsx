"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { Check, Copy, Loader2, RefreshCw, X } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  AGRUPAMENTOS,
  PERIODOS,
  agrupamentoValido,
  agrupar,
  dentroDoIntervalo,
  intervaloDoPeriodo,
  type Agrupamento,
  type Periodo,
} from "@/lib/filtros-dos-pagamentos";

/**
 * OS LEVANTAMENTOS — os profissionais pedem o saldo, e a CLYON transfere.
 *
 * *«Organize também a tela dos levantamentos.»* — 01-10-2026.
 *
 * Era uma lista só, pela ordem de chegada, com os pedidos por transferir
 * misturados com os já pagos e os recusados, e cada um com uma caixa grande de
 * IBAN — o pedido de hoje, à espera de dinheiro, a meio de levantamentos de há
 * três semanas que já não pediam nada.
 *
 * AGORA é como as Carteiras e os Pagamentos:
 *  - três SEPARADORES pelo estado, com quantos são e quanto somam — e abre nos
 *    que estão por transferir, que é o único que pede um gesto;
 *  - FILTROS por profissional e por período, e a lista SEPARADA por
 *    profissional ou por dia, com o total de cada grupo (as contas são as de
 *    `filtros-dos-pagamentos.ts`, as mesmas dos Pagamentos);
 *  - cada levantamento numa LINHA: quem e quando, o IBAN para copiar, o valor,
 *    e o botão. Um pedido com dois dias ou mais diz há quantos está à espera.
 */

type Levantamento = {
  id: number;
  providerId: number;
  profissionalNome: string | null;
  valor: number;
  iban: string;
  titular: string | null;
  estado: string;
  nota: string | null;
  processadoPor: string | null;
  processadoEm: string | null;
  createdAt: string;
};

type Separador = "pedido" | "pago" | "recusado";

const SEPARADORES: Array<{ id: Separador; rotulo: string; cor: string; vazio: string; data: string }> = [
  {
    id: "pedido",
    rotulo: "Por transferir",
    cor: "text-amber-300",
    vazio: "Nada por transferir.",
    data: "pela data do pedido",
  },
  {
    id: "pago",
    rotulo: "Transferidos",
    cor: "text-emerald-300",
    vazio: "Ainda não se transferiu nenhum levantamento.",
    data: "pela data da transferência",
  },
  {
    id: "recusado",
    rotulo: "Recusados",
    cor: "text-rose-300",
    vazio: "Nenhum levantamento recusado.",
    data: "pela data da recusa",
  },
];

/** A data que conta em cada separador: a do pedido, ou a de quando se tratou. */
function dataDe(l: Levantamento, s: Separador): string {
  return s === "pedido" ? l.createdAt : (l.processadoEm ?? l.createdAt);
}

function euros(v: number): string {
  return v.toFixed(2).replace(".", ",") + " €";
}

const somar = (ls: Levantamento[]) => Math.round(ls.reduce((s, l) => s + l.valor, 0) * 100) / 100;

/** «01/10 14:20» — o dia e a hora chegam para conferir com o banco. */
function quandoCurto(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function diasDesde(iso: string): number {
  const d = new Date(iso);
  const meiaNoite = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.max(0, Math.round((meiaNoite(new Date()) - meiaNoite(d)) / 86_400_000));
}

const CHAVE_DO_AGRUPAMENTO = "clyon:levantamentos:separar-por";

const CAMPO =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500";

/* As colunas da linha — iguais no cabeçalho e em cada levantamento. */
const COLUNAS =
  "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_7rem_12rem] md:items-center md:gap-4";

export default function AdminLevantamentosPanel() {
  const { token, ready } = useAdminAuth();
  const [linhas, setLinhas] = useState<Levantamento[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState<number | null>(null);
  const [aRecusar, setARecusar] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");

  const [separador, setSeparador] = useState<Separador>("pedido");
  const [profissional, setProfissional] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("todos");
  const [entreDe, setEntreDe] = useState("");
  const [entreAte, setEntreAte] = useState("");
  const [agrupamento, setAgrupamentoCru] = useState<Agrupamento>("profissional");

  useEffect(() => {
    try {
      const g = window.localStorage.getItem(CHAVE_DO_AGRUPAMENTO);
      if (agrupamentoValido(g)) setAgrupamentoCru(g);
    } catch {
      /* sem armazenamento: fica por profissional */
    }
  }, []);

  function mudarAgrupamento(g: Agrupamento) {
    setAgrupamentoCru(g);
    try {
      window.localStorage.setItem(CHAVE_DO_AGRUPAMENTO, g);
    } catch {
      /* a escolha vale só para esta visita */
    }
  }

  const carregar = useCallback(async (silencioso = false) => {
    if (!token) return;
    if (!silencioso) setACarregar(true);
    try {
      const res = await fetch("/api/admin/levantamentos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar.");
        return;
      }
      setLinhas(dados.levantamentos ?? []);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    if (ready) carregar();
  }, [ready, carregar]);

  useAutoRefresh(() => carregar(true), { enabled: ready && Boolean(token) });

  async function processar(l: Levantamento, estado: "pago" | "recusado", nota?: string) {
    /*
     * CONFIRMAR ANTES DE DAR POR TRANSFERIDO — como o «Já paguei» das Carteiras.
     *
     * Marcar como pago tira o saldo do painel dele: é o registo de que o
     * dinheiro saiu. Um toque ao lado, na linha de cima, dava por pago o
     * levantamento errado — e ele ficava a ver o dinheiro como recebido sem o
     * ter.
     */
    if (
      estado === "pago" &&
      !window.confirm(
        `Marcar como transferido: ${euros(l.valor)} para ${l.profissionalNome ?? `#${l.providerId}`}?\n\n` +
          `IBAN ${l.iban}\n\n` +
          `Faça a transferência PRIMEIRO no banco. Isto só regista que ela saiu.`,
      )
    ) {
      return;
    }
    setOcupado(l.id);
    setErro("");
    try {
      const res = await fetch("/api/admin/levantamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: l.id, estado, nota }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return;
      }
      setARecusar(null);
      setMotivo("");
      await carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  if (aCarregar && linhas.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  /* ── Os filtros ─────────────────────────────────────────────────────────── */
  const agora = new Date();
  const intervalo = intervaloDoPeriodo(periodo, agora, { de: entreDe, ate: entreAte });
  const aFiltrar = Boolean(profissional || intervalo);

  const doProfissional = linhas.filter((l) => !profissional || String(l.providerId) === profissional);
  const contas = SEPARADORES.map((s) => {
    const ls = doProfissional.filter(
      (l) => l.estado === s.id && dentroDoIntervalo(dataDe(l, s.id), intervalo),
    );
    return { ...s, linhas: ls, soma: somar(ls) };
  });
  const actual = contas.find((c) => c.id === separador) ?? contas[0];

  /* Os mais antigos primeiro nos por transferir — são os que esperam há mais tempo. */
  const ordenadas = [...actual.linhas].sort((a, b) =>
    separador === "pedido"
      ? a.createdAt.localeCompare(b.createdAt)
      : dataDe(b, separador).localeCompare(dataDe(a, separador)),
  );
  const grupos = agrupar(
    ordenadas,
    agrupamento,
    {
      profissional: (l) => ({ id: l.providerId, nome: l.profissionalNome ?? `Profissional #${l.providerId}` }),
      data: (l) => dataDe(l, separador),
    },
    agora,
  );

  const profissionais = (() => {
    const m = new Map<number, { nome: string; n: number }>();
    for (const l of linhas) {
      const a = m.get(l.providerId);
      m.set(l.providerId, { nome: l.profissionalNome ?? `#${l.providerId}`, n: (a?.n ?? 0) + 1 });
    }
    return [...m.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  })();

  function limparFiltros() {
    setProfissional("");
    setPeriodo("todos");
    setEntreDe("");
    setEntreAte("");
  }

  return (
    <div>
      {erro && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/* ── Os três estados, cada um com quantos e quanto ──────────────────── */}
      <div role="tablist" aria-label="Levantamentos por estado" className="grid grid-cols-3 gap-2">
        {contas.map((c) => {
          const activo = c.id === separador;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={activo}
              onClick={() => {
                setSeparador(c.id);
                setARecusar(null);
              }}
              className={`min-w-0 rounded-xl border px-2.5 py-2 text-left transition sm:px-4 sm:py-2.5 ${
                activo ? "border-cyan-500/60 bg-[#06B6D4]/10" : "border-slate-800 bg-slate-900/60 hover:border-slate-600"
              }`}
            >
              <span className={`block text-[10px] font-semibold uppercase leading-tight tracking-wide sm:text-[11px] ${c.cor}`}>
                {c.rotulo} · {c.linhas.length}
              </span>
              <span className="mt-0.5 block text-base font-bold tabular-nums text-white sm:text-lg">{euros(c.soma)}</span>
            </button>
          );
        })}
      </div>

      {/* ── Os filtros ─────────────────────────────────────────────────────── */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
        <select
          value={profissional}
          onChange={(e) => setProfissional(e.target.value)}
          aria-label="Filtrar por profissional"
          className={`${CAMPO} ${profissional ? "border-cyan-500 text-cyan-100" : ""}`}
        >
          <option value="">Todos os profissionais</option>
          {profissionais.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.nome} ({p.n})
            </option>
          ))}
        </select>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as Periodo)}
          aria-label="Filtrar por período"
          className={`${CAMPO} ${periodo !== "todos" ? "border-cyan-500 text-cyan-100" : ""}`}
        >
          {PERIODOS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.rotulo}
            </option>
          ))}
        </select>
        <div
          role="group"
          aria-label="Separar a lista por"
          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 p-0.5"
        >
          <span className="px-1.5 text-[11px] text-slate-500">Separar por</span>
          {AGRUPAMENTOS.map((g) => (
            <button
              key={g.id}
              onClick={() => mudarAgrupamento(g.id)}
              aria-pressed={agrupamento === g.id}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                agrupamento === g.id ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {g.rotulo}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {aFiltrar && (
            <button
              onClick={limparFiltros}
              className="flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Limpar
            </button>
          )}
          <button
            onClick={() => carregar()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Actualizar
          </button>
        </div>
      </div>

      {periodo === "entre" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <label className="flex items-center gap-1.5">
            De
            <input type="date" value={entreDe} onChange={(e) => setEntreDe(e.target.value)} className={`${CAMPO} w-auto [color-scheme:dark]`} />
          </label>
          <label className="flex items-center gap-1.5">
            até
            <input type="date" value={entreAte} onChange={(e) => setEntreAte(e.target.value)} className={`${CAMPO} w-auto [color-scheme:dark]`} />
          </label>
          <span className="text-slate-500">(o último dia conta inteiro)</span>
        </div>
      )}
      {intervalo && (
        <p className="mt-2 text-[11px] text-slate-500">
          Em «{actual.rotulo}», o período conta {actual.data}.
        </p>
      )}

      {/* ── A lista ────────────────────────────────────────────────────────── */}
      {actual.linhas.length === 0 ? (
        <p className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
          {aFiltrar ? "Nada com estes filtros." : linhas.length === 0 ? "Ainda ninguém pediu para levantar saldo." : actual.vazio}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div
            className={`hidden px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${COLUNAS}`}
            aria-hidden="true"
          >
            <span>Profissional e pedido</span>
            <span>Para onde</span>
            <span className="text-right">Valor</span>
            <span />
          </div>

          {grupos.map((g) => (
            <section key={g.chave}>
              {agrupamento !== "nada" && (
                <p className="mb-1.5 flex items-center justify-between gap-3 border-b border-slate-800 pb-1 text-xs font-semibold text-slate-200">
                  <span>
                    {g.titulo}
                    <span className="font-normal text-slate-500">
                      {" "}· {g.linhas.length} {g.linhas.length === 1 ? "levantamento" : "levantamentos"}
                    </span>
                  </span>
                  <span className="tabular-nums">{euros(somar(g.linhas))}</span>
                </p>
              )}
              <div className="space-y-1.5">
                {g.linhas.map((l) => {
                  const espera = l.estado === "pedido" ? diasDesde(l.createdAt) : 0;
                  return (
                    <article key={l.id} className={`rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 ${COLUNAS}`}>
                      {/* Quem e quando */}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{l.profissionalNome ?? `#${l.providerId}`}</p>
                        <p className="text-[11px] text-slate-400">
                          pedido a {quandoCurto(l.createdAt)}
                          {espera >= 1 && (
                            <span className={espera >= 2 ? "font-semibold text-amber-300" : "text-slate-500"}>
                              {" "}· à espera há {espera} {espera === 1 ? "dia" : "dias"}
                            </span>
                          )}
                        </p>
                        {l.processadoEm && (
                          <p className="text-[11px] text-slate-500">
                            {l.estado === "pago" ? "transferido" : "recusado"} a {quandoCurto(l.processadoEm)}
                            {l.processadoPor ? ` por ${l.processadoPor}` : ""}
                          </p>
                        )}
                      </div>

                      {/* Para onde */}
                      <div className="mt-2 flex min-w-0 items-center gap-2 md:mt-0">
                        <div className="min-w-0 flex-1">
                          <p className="break-all font-mono text-xs text-slate-200">{l.iban}</p>
                          {l.titular && <p className="text-[11px] text-slate-400">{l.titular}</p>}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(l.iban.replace(/\s/g, ""));
                            setCopiado(l.id);
                            setTimeout(() => setCopiado((c) => (c === l.id ? null : c)), 2000);
                          }}
                          className="flex shrink-0 items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-800"
                        >
                          {copiado === l.id ? (
                            <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                          ) : (
                            <Copy className="h-3 w-3" aria-hidden="true" />
                          )}
                          {copiado === l.id ? "Copiado" : "IBAN"}
                        </button>
                      </div>

                      {/* Valor */}
                      <p
                        className={`mt-2 text-lg font-bold tabular-nums md:mt-0 md:text-right ${
                          l.estado === "pedido" ? "text-emerald-300" : l.estado === "recusado" ? "text-slate-500 line-through" : "text-slate-300"
                        }`}
                      >
                        {euros(l.valor)}
                      </p>

                      {/* Acção */}
                      <div className="mt-2 md:mt-0">
                        {l.estado === "pedido" ? (
                          aRecusar === l.id ? (
                            <div className="space-y-1.5">
                              <input
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                                placeholder="Motivo — o profissional vê isto"
                                autoFocus
                                className={CAMPO}
                              />
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => processar(l, "recusado", motivo)}
                                  disabled={ocupado === l.id || !motivo.trim()}
                                  className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                                >
                                  Recusar
                                </button>
                                <button
                                  onClick={() => {
                                    setARecusar(null);
                                    setMotivo("");
                                  }}
                                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-1.5 md:justify-end">
                              <button
                                onClick={() => processar(l, "pago")}
                                disabled={ocupado === l.id}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-40 md:flex-none"
                              >
                                {ocupado === l.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                                Já transferi
                              </button>
                              <button
                                onClick={() => setARecusar(l.id)}
                                disabled={ocupado === l.id}
                                className="flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                              >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                                Recusar
                              </button>
                            </div>
                          )
                        ) : (
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold md:float-right ${
                              l.estado === "pago" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
                            }`}
                          >
                            {l.estado === "pago" ? "transferido" : "recusado"}
                          </span>
                        )}
                      </div>

                      {/* A nota — o motivo de uma recusa, ou o que ficou dito — por baixo da linha toda. */}
                      {l.nota && (
                        <p className="mt-2 rounded-md bg-slate-950/60 px-2.5 py-1.5 text-[11px] text-slate-300 md:col-span-4 md:mt-0">
                          {l.nota}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
