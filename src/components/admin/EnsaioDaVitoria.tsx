"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * O ENSAIO DA VITÓRIA — d85, fase 0 (22-11-2026).
 *
 * Com o interruptor «Vitória agente — ensaio» ligado (Configs), cada mensagem
 * de um cliente ganha aqui uma linha: o que ele escreveu (sem dados de
 * pessoas), o que a Vitória de hoje respondeu e o que o agente teria
 * respondido e feito, com o custo. A equipa diz se a do agente estava melhor
 * ou pior — é com isto que se decide ligá-lo a sério. Só leitura: nada daqui
 * chega ao cliente.
 */
type Ensaio = {
  id: number;
  em: string;
  telefone: string;
  pedidoId: number | null;
  mensagemDoCliente: string | null;
  respostaReal: string | null;
  respostaDoAgente: string | null;
  teriaFeito: string[];
  estado: string;
  motivo: string | null;
  custoUsd: number;
  tokensCacheLidos: number;
  avaliacao: "melhor" | "pior" | null;
  avaliadoPor: string | null;
};
type Resposta = { ensaios: Ensaio[]; melhor: number; pior: number; porAvaliar: number; ligado: boolean };
type Accao = { em: string; ferramenta: string; entrada: string | null; resultado: string | null; texto: string | null; custoUsd: number; erro: string | null };

const ROTA = "/api/admin/whatsapp/ensaio-da-vitoria";

const ESTADO: Record<string, string> = {
  ok: "respondeu",
  equipa: "passaria à equipa",
  bloqueado: "bloqueada pela revisão",
  tecto: "tecto do dia",
  erro: "erro",
  recusou: "recusou",
  inactivo: "sem chave",
  a_correr: "a correr",
};

const quando = (iso: string) =>
  iso ? new Date(iso).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" }) : "";

export default function EnsaioDaVitoria() {
  const { token, ready } = useAdminAuth();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [accoes, setAccoes] = useState<Accao[] | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(ROTA, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (r.ok) setDados((await r.json()) as Resposta);
    } catch {
      /* fica o que se tinha */
    }
  }, [token]);

  useEffect(() => {
    if (ready) void ler();
  }, [ready, ler]);

  async function abrir(id: number) {
    if (aberto === id) {
      setAberto(null);
      return;
    }
    setAberto(id);
    setAccoes(null);
    if (!token) return;
    try {
      const r = await fetch(`${ROTA}?ensaio=${id}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (r.ok) setAccoes(((await r.json()) as { accoes: Accao[] }).accoes);
    } catch {
      setAccoes([]);
    }
  }

  async function avaliar(id: number, avaliacao: "melhor" | "pior" | null) {
    if (!token) return;
    setOcupado(id);
    try {
      const r = await fetch(ROTA, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id, avaliacao }),
      });
      if (r.ok) await ler();
    } finally {
      setOcupado(null);
    }
  }

  if (!dados) return null;

  return (
    <div className="mt-8 border-t border-slate-800 pt-5">
      <h3 className="text-base font-semibold text-slate-100">Ensaio da Vitória</h3>
      <p className="mt-1 text-sm leading-6 text-slate-400">
        {dados.ligado
          ? "O agente corre ao lado da Vitória e grava o que teria respondido. Nada daqui chegou ao cliente."
          : "O ensaio está desligado (Configs › «Vitória agente — ensaio»)."}{" "}
        Melhor: {dados.melhor} · Pior: {dados.pior} · Por avaliar: {dados.porAvaliar}
      </p>
      {dados.ensaios.length > 0 && (
        <ul className="mt-4 space-y-3">
          {dados.ensaios.map((e) => (
            <li key={e.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm">
              <p className="text-xs text-slate-400">
                {quando(e.em)} · {e.telefone}
                {e.pedidoId ? ` · pedido #${e.pedidoId}` : ""} · {ESTADO[e.estado] ?? e.estado}
                {e.motivo ? ` (${e.motivo})` : ""} · {e.custoUsd.toFixed(4)} USD · cache {new Intl.NumberFormat("pt-PT").format(e.tokensCacheLidos)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-slate-200">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cliente </span>
                {e.mensagemDoCliente}
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg bg-slate-900/70 p-2">
                  <p className="text-xs font-semibold text-slate-400">A Vitória de hoje</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-200">{e.respostaReal || "(não respondeu)"}</p>
                </div>
                <div className="rounded-lg bg-slate-900/70 p-2">
                  <p className="text-xs font-semibold text-slate-400">O agente teria dito</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-200">{e.respostaDoAgente || "(nada)"}</p>
                  {e.teriaFeito.length > 0 && <p className="mt-1 text-xs text-slate-400">E teria feito: {e.teriaFeito.join(" · ")}</p>}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={ocupado === e.id}
                  onClick={() => void avaliar(e.id, e.avaliacao === "melhor" ? null : "melhor")}
                  className={`flex min-h-[32px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-40 ${
                    e.avaliacao === "melhor" ? "bg-emerald-500/20 text-emerald-200" : "border border-slate-700 text-slate-200"
                  }`}
                >
                  <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                  Esta estava melhor
                </button>
                <button
                  type="button"
                  disabled={ocupado === e.id}
                  onClick={() => void avaliar(e.id, e.avaliacao === "pior" ? null : "pior")}
                  className={`flex min-h-[32px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-40 ${
                    e.avaliacao === "pior" ? "bg-red-500/20 text-red-200" : "border border-slate-700 text-slate-200"
                  }`}
                >
                  <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                  Esta estava pior
                </button>
                <button type="button" onClick={() => void abrir(e.id)} className="text-xs text-slate-400 underline">
                  {aberto === e.id ? "Fechar os passos" : "Ver os passos"}
                </button>
                {ocupado === e.id && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />}
                {e.avaliadoPor && <span className="text-xs text-slate-500">avaliado por {e.avaliadoPor}</span>}
              </div>
              {aberto === e.id && (
                <ol className="mt-2 space-y-1 text-xs text-slate-400">
                  {accoes == null ? (
                    <li>A ler…</li>
                  ) : (
                    accoes.map((a, i) => (
                      <li key={i} className="break-words">
                        <span className="font-semibold text-slate-300">{a.ferramenta}</span>
                        {a.entrada ? ` ${a.entrada}` : ""}
                        {a.texto ? ` — ${a.texto}` : ""}
                        {a.custoUsd ? ` · ${a.custoUsd.toFixed(4)} USD` : ""}
                        {a.erro ? <span className="text-red-300"> · {a.erro}</span> : null}
                      </li>
                    ))
                  )}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
