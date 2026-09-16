"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { AlertTriangle, BookOpen, CheckCircle2, Loader2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * O LIVRO DE MOVIMENTOS DA CARTEIRA — Fase 1 dos pagamentos.
 *
 * A carteira de cada profissional é hoje CALCULADA a partir das negociações.
 * Vai passar a ser a soma de linhas de um livro, porque uma soma derivada não
 * se reconcilia com o extracto do euPago e não tem onde escrever um reembolso
 * parcial. Ver `docs/plano-pagamentos-eupago.md`.
 *
 * ESTE ECRÃ É A PASSAGEM DE UM PARA O OUTRO, e existe para ela poder ser feita
 * sem ninguém ver o saldo mexer: corre os dois caminhos sobre os dados reais e
 * mostra onde discordam. Enquanto houver uma divergência, não se avança.
 *
 * Construir o livro NÃO MUDA UM NÚMERO EM ECRÃ NENHUM. Escreve à parte aquilo
 * que já era verdade — e é isso que permite compará-lo à vontade antes de
 * confiar nele.
 */

type Divergencia = {
  providerId: number;
  campo: string;
  carteiraDeHoje: number;
  livro: number;
};

type Estado = {
  profissionais: number;
  movimentosEsperados: number;
  movimentosGravados: number;
  porLancar: number;
  divergencias: Divergencia[];
  podeAvancar: boolean;
};

const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

export default function AdminLivroPanel() {
  const { token, ready } = useAdminAuth();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [aConstruir, setAConstruir] = useState(false);
  const [feito, setFeito] = useState("");

  const [aCarregar, setACarregar] = useState(false);

  /*
   * A convenção dos outros painéis, e vale aqui pela mesma razão: o ciclo
   * automático não pode acender o estado de carregamento, senão o ecrã pisca
   * de vinte em vinte segundos enquanto alguém está a ler uma divergência.
   */
  const carregar = useCallback(async (silencioso = false) => {
    if (!token) return;
    if (!silencioso) setACarregar(true);
    try {
      const r = await fetch("/api/admin/livro", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível conferir.");
        return;
      }
      setEstado(d);
      setErro("");
    } catch {
      if (!silencioso) setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);

  // O ciclo partilhado do backoffice. Pausado enquanto se constrói: a
  // conferência a meio da escrita mostraria um número que não é nenhum dos dois.
  useAutoRefresh(() => carregar(true), {
    enabled: ready && Boolean(token),
    paused: aConstruir,
  });

  async function construir() {
    setAConstruir(true);
    setErro("");
    setFeito("");
    try {
      const r = await fetch("/api/admin/livro", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível construir.");
        return;
      }
      setEstado(d.conferencia ? { ...d.conferencia, podeAvancar: d.podeAvancar } : null);
      setFeito(
        d.lancados > 0
          ? `${d.lancados} movimento(s) lançado(s). Nenhum saldo mudou.`
          : "Já estava tudo lançado — não havia nada a escrever.",
      );
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAConstruir(false);
    }
  }

  if (!estado && (aCarregar || !erro)) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A comparar os dois
        caminhos…
      </p>
    );
  }
  if (erro && !estado) return <p className="text-sm text-red-300">{erro}</p>;
  if (!estado) return null;

  const temDivergencias = estado.divergencias.length > 0;

  return (
    <div className="space-y-4">
      {/*
        A RESPOSTA PRIMEIRO. Quem abre isto quer saber uma coisa só: os dois
        caminhos dão o mesmo número? O resto são detalhes de quem já sabe que
        não dão.
      */}
      <div
        className={`rounded-xl border p-4 ${
          temDivergencias
            ? "border-red-500/40 bg-red-500/[0.08]"
            : "border-emerald-500/30 bg-emerald-500/[0.06]"
        }`}
      >
        <p className="flex items-center gap-2 text-sm font-bold text-white">
          {temDivergencias ? (
            <>
              <AlertTriangle className="h-4 w-4 text-red-400" aria-hidden="true" />
              {estado.divergencias.length} carteira(s) dariam um número diferente
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />O livro dá
              exactamente o mesmo que a carteira de hoje
            </>
          )}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          {temDivergencias
            ? "Não se constrói o livro assim: seria gravar um saldo errado, e um livro não se reescreve. Diga-me e vou ver."
            : `Comparados os cinco números de ${estado.profissionais} profissional(is), ao cêntimo. Construir o livro não muda nada do que está nos ecrãs.`}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-2xl font-bold text-white">{estado.profissionais}</p>
          <p className="mt-1 text-xs text-slate-400">carteiras comparadas</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="flex items-center gap-2 text-2xl font-bold text-white">
            <BookOpen className="h-5 w-5 text-slate-400" aria-hidden="true" />
            {estado.movimentosGravados}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            movimentos no livro
            <span className="mt-1 block text-[11px] text-slate-500">
              de {estado.movimentosEsperados} que deveria ter
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-2xl font-bold text-white">{estado.porLancar}</p>
          <p className="mt-1 text-xs text-slate-400">por lançar</p>
        </div>
      </div>

      {temDivergencias && (
        <div className="rounded-xl border border-red-500/30 bg-slate-950/40 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-300">
            Onde discordam
          </p>
          <div className="space-y-1 text-xs text-slate-300">
            {estado.divergencias.slice(0, 20).map((d, i) => (
              <p key={`${d.providerId}-${d.campo}-${i}`}>
                profissional <strong className="text-white">#{d.providerId}</strong> · {d.campo}:
                hoje {euros(d.carteiraDeHoje)} · livro {euros(d.livro)}
              </p>
            ))}
            {estado.divergencias.length > 20 && (
              <p className="text-slate-500">e mais {estado.divergencias.length - 20}…</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void construir()}
          disabled={aConstruir || temDivergencias || estado.porLancar === 0}
          className="rounded-[14px] bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40"
        >
          {aConstruir
            ? "A escrever…"
            : estado.porLancar === 0
              ? "Nada por lançar"
              : `Escrever ${estado.porLancar} movimento(s)`}
        </button>
        {/*
          Sem confirmação, de propósito: cada movimento tem uma chave única na
          base, por isso carregar duas vezes não lança nada na segunda. Não há
          nada que possa correr mal duas vezes.
        */}
        <p className="text-xs text-slate-500">
          Pode carregar as vezes que quiser — o que já está lançado não se repete.
        </p>
      </div>

      {feito && <p className="text-xs text-emerald-300">{feito}</p>}
      {erro && <p className="text-xs text-red-300">{erro}</p>}
    </div>
  );
}
