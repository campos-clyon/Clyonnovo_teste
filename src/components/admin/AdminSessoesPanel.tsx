"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { dataEHoraEmLisboa, diaMesEHoraEmLisboa } from "@/lib/hora-de-lisboa";
import {
  CHAVE_DO_NAVEGADOR,
  haQuantoTempo,
  localLegivel,
  marcaValida,
  type PessoaComSessoes,
} from "@/lib/sessoes-do-backoffice";

type Entrada = {
  colaboradorId: number;
  nome: string;
  papel: string;
  em: string;
  navegador: string;
  sistema: string;
  cidade: string | null;
  pais: string | null;
};

const ROTULO_DO_PAPEL: Record<string, string> = { admin: "Administrador", assistente: "Assistente" };

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

function meuNavegador(): string | null {
  try {
    const m = window.localStorage.getItem(CHAVE_DO_NAVEGADOR);
    return marcaValida(m) ? m : null;
  } catch {
    return null;
  }
}

/**
 * CONFIGS → «SESSÕES ABERTAS NO BACKOFFICE» — 27-10-2026 (decisão d15).
 *
 * Só o administrador vê este cartão (e só ele chama as rotas). Por pessoa:
 * quantos computadores (navegadores) têm a sessão de pé e quantas janelas
 * estão abertas agora; por navegador, de onde e desde quando, com «Terminar
 * esta sessão». Por baixo, o registo das entradas (90 dias). As horas são
 * sempre as de Lisboa.
 */
export default function AdminSessoesPanel() {
  const { token } = useAdminAuth();
  const [pessoas, setPessoas] = useState<PessoaComSessoes[] | null>(null);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aTerminar, setATerminar] = useState<string | null>(null);

  // `silencioso` vem do ciclo do backoffice: não há "a carregar" a acender.
  const carregar = useCallback(async (_silencioso = false) => {
    if (!token) return;
    try {
      const meu = meuNavegador();
      const r = await fetch(`/api/admin/sessoes${meu ? `?navegador=${meu}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as {
        pessoas?: PessoaComSessoes[];
        entradas?: Entrada[];
        error?: string;
      };
      if (!r.ok) {
        setAviso(j.error ?? "Não foi possível ler as sessões.");
        return;
      }
      setPessoas(Array.isArray(j.pessoas) ? j.pessoas : []);
      setEntradas(Array.isArray(j.entradas) ? j.entradas : []);
      setAviso(null);
    } catch {
      setAviso("Não foi possível ler as sessões.");
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);
  useAutoRefresh(() => carregar(true), { enabled: Boolean(token) });

  const terminar = async (pessoa: PessoaComSessoes, navegadorId: string, descricao: string) => {
    if (!token) return;
    if (!window.confirm(`Terminar a sessão de ${pessoa.nome} em ${descricao}? Esse navegador vai ter de entrar de novo.`)) {
      return;
    }
    setATerminar(navegadorId);
    try {
      const r = await fetch("/api/admin/sessoes/terminar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ colaboradorId: pessoa.colaboradorId, navegadorId }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setAviso(
        r.ok
          ? "Sessão terminada. Esse navegador volta ao ecrã de entrada dentro de um minuto."
          : (j.error ?? "Não foi possível terminar a sessão."),
      );
      await carregar();
    } catch {
      setAviso("Não foi possível terminar a sessão.");
    } finally {
      setATerminar(null);
    }
  };

  if (pessoas === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        {aviso ? (
          aviso
        ) : (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> A ler as sessões…
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {aviso && <p className="text-sm text-amber-200">{aviso}</p>}

      {pessoas.length === 0 ? (
        <p className="text-sm text-slate-400">Ninguém tem o backoffice aberto neste momento.</p>
      ) : (
        <ul className="space-y-3">
          {pessoas.map((p) => (
            <li key={p.colaboradorId} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-white">
                  {p.nome}{" "}
                  <span className="text-xs font-normal text-slate-400">{ROTULO_DO_PAPEL[p.papel] ?? p.papel}</span>
                </p>
                <p className="text-sm text-slate-300">
                  {plural(p.computadores, "computador", "computadores")} ·{" "}
                  {plural(p.janelas, "janela aberta", "janelas abertas")}
                </p>
              </div>
              <ul className="mt-2 space-y-2">
                {p.navegadores.map((n) => {
                  const descricao = `${n.navegador} · ${n.sistema}`;
                  return (
                    <li
                      key={n.navegadorId}
                      className="flex flex-col gap-2 rounded-lg border border-white/5 bg-slate-950/40 p-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-slate-100">
                          {descricao} · {localLegivel(n.cidade, n.pais)}
                          {n.esteNavegador && <span className="ml-2 text-xs text-cyan-200">(este navegador)</span>}
                        </p>
                        <p className="text-xs text-slate-400">
                          Entrou {diaMesEHoraEmLisboa(new Date(n.inicioEm))} · última actividade{" "}
                          {diaMesEHoraEmLisboa(new Date(n.ultimaEm))} ·{" "}
                          <span className={n.activaAgora ? "text-emerald-300" : ""}>
                            {haQuantoTempo(n.minutosDesde, n.activaAgora)}
                          </span>{" "}
                          · {plural(n.janelas, "janela", "janelas")}
                        </p>
                      </div>
                      {!n.esteNavegador && (
                        <button
                          type="button"
                          onClick={() => void terminar(p, n.navegadorId, descricao)}
                          disabled={aTerminar === n.navegadorId}
                          className="shrink-0 rounded-lg border border-rose-300/30 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-400/10 disabled:opacity-50"
                        >
                          {aTerminar === n.navegadorId ? "A terminar…" : "Terminar esta sessão"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <details className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-200">
          Registo de entradas ({entradas.length})
        </summary>
        {entradas.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Ainda não há entradas registadas.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {entradas.map((e, i) => (
              <li key={`${e.em}-${i}`}>
                {dataEHoraEmLisboa(new Date(e.em))} · {e.nome} · {e.navegador} · {e.sistema} ·{" "}
                {localLegivel(e.cidade, e.pais)}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Guardam-se as entradas dos últimos 90 dias. O endereço IP não é guardado.
        </p>
      </details>
    </div>
  );
}
