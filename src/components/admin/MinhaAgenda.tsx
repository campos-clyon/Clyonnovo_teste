"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  TIPOS_DE_AUSENCIA,
  descricaoDaMarcacao,
  type Marcacao,
  type TipoDeAusencia,
} from "@/lib/agenda-das-assistentes";
import { diaEmLisboa } from "@/lib/hora-de-lisboa";

type Rascunho = {
  tipo: TipoDeAusencia;
  deDia: string;
  ateDia: string;
  deHora: string;
  ateHora: string;
  nota: string;
};

const vazio = (hoje: string): Rascunho => ({ tipo: "dia", deDia: hoje, ateDia: hoje, deHora: "", ateHora: "", nota: "" });

const CAMPO =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white [color-scheme:dark] focus:border-sky-400 focus:outline-none";

/**
 * A MINHA AGENDA — 31-10-2026 (ordem do CEO e do dono).
 *
 * A assistente marca quando não vai estar: um dia inteiro (folga), parte de um
 * dia, ou vários dias seguidos, com uma nota se quiser. Cria, altera e apaga as
 * dela — e só as dela (a rota tira a conta do token). O administrador vê-as no
 * calendário de «Assistentes». As horas de presença NÃO aparecem aqui.
 *
 * Uma janela por cima do painel, como «A minha comissão»: é dela sempre, e não
 * uma secção que o administrador dá.
 */
export default function MinhaAgenda({ token, onFechar }: { token: string | null; onFechar: () => void }) {
  const hoje = diaEmLisboa(new Date());
  const [marcacoes, setMarcacoes] = useState<Marcacao[] | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho>(() => vazio(hoje));
  const [aAlterar, setAAlterar] = useState<number | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const [verPassadas, setVerPassadas] = useState(false);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/sessao/agenda", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as { marcacoes?: Marcacao[]; error?: string };
      if (!r.ok) {
        setAviso({ texto: j.error ?? "Não foi possível ler a agenda.", erro: true });
        setMarcacoes([]);
        return;
      }
      setMarcacoes(Array.isArray(j.marcacoes) ? j.marcacoes : []);
    } catch {
      setAviso({ texto: "Não foi possível ligar ao servidor.", erro: true });
      setMarcacoes([]);
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const pedir = async (corpo: Record<string, unknown>, feito: string) => {
    if (!token) return false;
    setAGravar(true);
    setAviso(null);
    try {
      const r = await fetch("/api/admin/sessao/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setAviso({ texto: j.error ?? "Não foi possível gravar.", erro: true });
        return false;
      }
      setAviso({ texto: feito, erro: false });
      await carregar();
      return true;
    } catch {
      setAviso({ texto: "Não foi possível ligar ao servidor.", erro: true });
      return false;
    } finally {
      setAGravar(false);
    }
  };

  const gravar = async () => {
    const corpo = {
      accao: aAlterar ? "alterar" : "criar",
      id: aAlterar ?? undefined,
      tipo: rascunho.tipo,
      deDia: rascunho.deDia,
      ateDia: rascunho.tipo === "dias" ? rascunho.ateDia : rascunho.deDia,
      deHora: rascunho.tipo === "parte" ? rascunho.deHora : null,
      ateHora: rascunho.tipo === "parte" ? rascunho.ateHora || null : null,
      nota: rascunho.nota,
    };
    const ok = await pedir(corpo, aAlterar ? "Marcação alterada." : "Marcado na agenda.");
    if (ok) {
      setAAlterar(null);
      setRascunho(vazio(hoje));
    }
  };

  const alterar = (m: Marcacao) => {
    setAAlterar(m.id);
    setAviso(null);
    setRascunho({
      tipo: m.tipo,
      deDia: m.deDia,
      ateDia: m.ateDia,
      deHora: m.deHora ?? "",
      ateHora: m.ateHora ?? "",
      nota: m.nota ?? "",
    });
  };

  const apagar = async (m: Marcacao) => {
    if (!window.confirm(`Apagar «${descricaoDaMarcacao(m)}» da sua agenda?`)) return;
    await pedir({ accao: "apagar", id: m.id }, "Marcação apagada.");
    if (aAlterar === m.id) {
      setAAlterar(null);
      setRascunho(vazio(hoje));
    }
  };

  const proximas = (marcacoes ?? []).filter((m) => m.ateDia >= hoje).sort((a, b) => a.deDia.localeCompare(b.deDia));
  const passadas = (marcacoes ?? []).filter((m) => m.ateDia < hoje);

  const linha = (m: Marcacao) => (
    <li
      key={m.id}
      className={`flex flex-wrap items-start justify-between gap-2 rounded-xl border px-3 py-2 ${
        aAlterar === m.id ? "border-sky-400/60 bg-sky-400/10" : "border-slate-700/60 bg-slate-950/40"
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{descricaoDaMarcacao(m)}</p>
        {m.nota && <p className="mt-0.5 break-words text-xs text-slate-400">{m.nota}</p>}
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => alterar(m)}
          disabled={aGravar}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-sky-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Alterar
        </button>
        <button
          type="button"
          onClick={() => void apagar(m)}
          disabled={aGravar}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-coral-texto hover:bg-slate-800 disabled:opacity-50"
        >
          Apagar
        </button>
      </div>
    </li>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="minha-agenda-titulo"
        className="w-full max-w-xl rounded-2xl border border-slate-700/60 bg-slate-900 p-4 shadow-2xl sm:p-5"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="minha-agenda-titulo" className="text-base font-semibold text-white">
              A minha agenda
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Marque quando não vai estar: um dia de folga, parte de um dia ou vários dias seguidos. O administrador
              vê as suas marcações. Horas de Lisboa.
            </p>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form
          className="space-y-3 rounded-xl border border-slate-700/60 bg-slate-950/40 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void gravar();
          }}
        >
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-700 bg-slate-950 p-1" role="radiogroup">
            {TIPOS_DE_AUSENCIA.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={rascunho.tipo === t.id}
                onClick={() => setRascunho((r) => ({ ...r, tipo: t.id }))}
                className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                  rascunho.tipo === t.id ? "bg-sky-500 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {t.rotulo}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-300">
              {rascunho.tipo === "dias" ? "Do dia" : "Dia"}
              <input
                type="date"
                required
                value={rascunho.deDia}
                onChange={(e) => setRascunho((r) => ({ ...r, deDia: e.target.value }))}
                className={`mt-1 ${CAMPO}`}
              />
            </label>
            {rascunho.tipo === "dias" && (
              <label className="block text-xs font-medium text-slate-300">
                Até ao dia (inclusive)
                <input
                  type="date"
                  required
                  value={rascunho.ateDia}
                  min={rascunho.deDia}
                  onChange={(e) => setRascunho((r) => ({ ...r, ateDia: e.target.value }))}
                  className={`mt-1 ${CAMPO}`}
                />
              </label>
            )}
          </div>

          {rascunho.tipo === "parte" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-300">
                A partir das
                <input
                  type="time"
                  required
                  value={rascunho.deHora}
                  onChange={(e) => setRascunho((r) => ({ ...r, deHora: e.target.value }))}
                  className={`mt-1 ${CAMPO}`}
                />
              </label>
              <label className="block text-xs font-medium text-slate-300">
                Até às (opcional)
                <input
                  type="time"
                  value={rascunho.ateHora}
                  onChange={(e) => setRascunho((r) => ({ ...r, ateHora: e.target.value }))}
                  className={`mt-1 ${CAMPO}`}
                />
              </label>
            </div>
          )}

          <label className="block text-xs font-medium text-slate-300">
            Nota (opcional)
            <input
              type="text"
              maxLength={300}
              value={rascunho.nota}
              onChange={(e) => setRascunho((r) => ({ ...r, nota: e.target.value }))}
              placeholder="Ex.: consulta médica"
              className={`mt-1 ${CAMPO}`}
            />
          </label>

          {aviso && (
            <p className={`text-xs ${aviso.erro ? "text-coral-texto" : "text-esmeralda-texto"}`} role="status">
              {aviso.texto}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={aGravar || !token}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
            >
              {aGravar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {aAlterar ? "Guardar a alteração" : "Marcar na agenda"}
            </button>
            {aAlterar && (
              <button
                type="button"
                onClick={() => {
                  setAAlterar(null);
                  setRascunho(vazio(hoje));
                  setAviso(null);
                }}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold text-white">Próximas</h3>
          {marcacoes === null ? (
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A carregar…
            </p>
          ) : proximas.length === 0 ? (
            <p className="text-sm text-slate-400">Nada marcado daqui para a frente.</p>
          ) : (
            <ul className="space-y-1.5">{proximas.map(linha)}</ul>
          )}

          {passadas.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setVerPassadas((v) => !v)}
                className="text-xs font-semibold text-slate-400 hover:text-white"
              >
                {verPassadas ? "Esconder as passadas" : `Ver as passadas (${passadas.length})`}
              </button>
              {verPassadas && <ul className="mt-2 space-y-1.5">{passadas.slice(0, 30).map(linha)}</ul>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
