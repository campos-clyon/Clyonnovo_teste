"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, Lock } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * O QUE ENTROU PELO euPAGO.
 *
 * O número grande deste painel não é o total recebido — é o dos AVISOS POR
 * APLICAR. Cada um é dinheiro que se moveu do lado deles e não se moveu do
 * nosso: um pagamento em duplicado por devolver, um valor que não bate certo.
 * Nenhum deles dá erro em lado nenhum, e é por isso que precisam de um sítio
 * onde se vejam.
 *
 * O resto do ecrã é conferência. Enquanto a porta estiver fechada, diz-se
 * porquê, em vez de mostrar zeros que parecem uma avaria.
 */

type Ligacao = {
  configurado: boolean;
  falta?: string;
  ambiente?: "sandbox" | "producao";
  temSegredoDoWebhook?: boolean;
  aberta?: boolean;
  plataformaCobra: boolean;
  testadores?: number;
};

type Pagamento = {
  id: number;
  metodo: string;
  estado: string;
  valor: number;
  valorPago: number | null;
  comissaoEupago: number | null;
  referencia: string | null;
  entidade: string | null;
  pedidoId: number;
  criadoEm: string;
};

type Aviso = {
  id: number;
  trid: string;
  estado: string;
  pagamentoId: number | null;
  valor: number | null;
  nota: string | null;
  recebidoEm: string;
};

type Estado = {
  ligacao: Ligacao;
  resumo: {
    pendentes: number;
    pagos: number;
    falhados: number;
    avisosPorAplicar: number;
    totalPago: number;
    comissaoDoEupago: number;
  };
  ultimos: Pagamento[];
  avisos: Aviso[];
};

const euros = (n: number | null) => (n == null ? "—" : `${n.toFixed(2).replace(".", ",")} €`);

const CORES: Record<string, string> = {
  pago: "text-emerald-300",
  pendente: "text-amber-300",
  falhado: "text-red-300",
  expirado: "text-slate-400",
  cancelado: "text-slate-400",
  substituido: "text-slate-400",
  reembolsado: "text-cyan-300",
};

type Prova = {
  ok: boolean;
  temSegredoDoWebhook?: boolean;
  ambiente?: string;
  base?: string;
  entidade?: string | null;
  referencia?: string | null;
  codigo?: string | null;
  porque?: string;
  pista?: string | null;
};

export default function AdminPagamentosPanel() {
  const { token, ready } = useAdminAuth();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [aCarregar, setACarregar] = useState(false);
  const [prova, setProva] = useState<Prova | null>(null);
  const [aProvar, setAProvar] = useState(false);

  // O ciclo partilhado não pode acender o estado de carregamento: o ecrã
  // piscava de vinte em vinte segundos enquanto alguém lê uma linha.
  const carregar = useCallback(
    async (silencioso = false) => {
      if (!token) return;
      if (!silencioso) setACarregar(true);
      try {
        const r = await fetch("/api/admin/pagamentos", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json();
        if (!r.ok) {
          // O detalhe vem junto, e é ele que diz por onde começar. Ver a nota
          // na rota: isto é backoffice, não um ecrã de cliente.
          setErro([d.error, d.detalhe].filter(Boolean).join(" — ") || "Não foi possível ler.");
          return;
        }
        setEstado(d);
        setErro("");
      } catch {
        if (!silencioso) setErro("Erro de rede.");
      } finally {
        setACarregar(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);

  useAutoRefresh(() => carregar(true), { enabled: ready && Boolean(token) });

  /**
   * A prova de ligação: pede uma referência de 1 € que ninguém paga.
   *
   * Não cobra a ninguém e não escreve nada — serve só para responder à única
   * pergunta que não se consegue responder olhando: **a chave serve?**
   */
  async function provar() {
    setAProvar(true);
    setProva(null);
    try {
      const r = await fetch("/api/admin/pagamentos/testar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setProva((await r.json()) as Prova);
    } catch {
      setProva({ ok: false, porque: "Erro de rede." });
    } finally {
      setAProvar(false);
    }
  }

  if (!estado && (aCarregar || !erro)) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A ler os pagamentos…
      </p>
    );
  }
  if (erro && !estado) return <p className="text-sm text-red-300">{erro}</p>;
  if (!estado) return null;

  const { ligacao, resumo } = estado;
  const alarme = resumo.avisosPorAplicar > 0;

  return (
    <div className="space-y-4">
      {/* ── A resposta primeiro: há alguma coisa por resolver? ───────────── */}
      {alarme ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/[0.08] p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-white">
            <AlertTriangle className="h-4 w-4 text-red-400" aria-hidden="true" />
            {resumo.avisosPorAplicar} aviso(s) do euPago por aplicar
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            Cada um é dinheiro que se moveu do lado deles e não se moveu do nosso. Não se resolvem
            sozinhos. O contrato dá dois dias úteis para comunicar uma operação não autorizada.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-white">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            Tudo o que o euPago disse está aplicado
          </p>
        </div>
      )}

      {/* ── Onde está a ligação ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
          Ligação ao euPago
        </p>
        {!ligacao.configurado ? (
          <p className="mt-2 text-sm text-amber-300">{ligacao.falta}</p>
        ) : (
          <div className="mt-2 space-y-1 text-xs text-slate-300">
            <p>
              Ambiente:{" "}
              <strong className={ligacao.ambiente === "producao" ? "text-red-300" : "text-cyan-300"}>
                {ligacao.ambiente === "producao" ? "PRODUÇÃO — dinheiro a sério" : "sandbox"}
              </strong>
            </p>
            <p>
              Segredo do webhook:{" "}
              {ligacao.temSegredoDoWebhook ? (
                <strong className="text-emerald-300">configurado</strong>
              ) : (
                <strong className="text-red-300">
                  EM FALTA — sem ele o webhook recusa todos os avisos
                </strong>
              )}
            </p>
            {!ligacao.aberta && (
              <p className="flex items-start gap-1.5 text-amber-300">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  A cobrança está fechada: em produção, o cliente só é cobrado com
                  A_PLATAFORMA_COBRA ligado. Os ecrãs dizem-lhe hoje que paga ao profissional no
                  fim.
                </span>
              </p>
            )}
            {/*
              O portão de testador é uma excepção nomeada, e uma excepção que
              se esquece aberta deixa de ser excepção. Por isso aparece sempre
              que existe — e some sozinha quando a variável for apagada.
            */}
            {!ligacao.aberta && (ligacao.testadores ?? 0) > 0 && (
              <p className="text-cyan-300">
                Portão de testador ABERTO para {ligacao.testadores} email(s) — esses pagam a sério,
                até {5} € por pagamento. Apague a EUPAGO_EMAILS_DE_TESTE quando acabar de testar.
              </p>
            )}
          </div>
        )}

        {/*
          A ÚNICA PERGUNTA QUE NÃO SE RESPONDE A OLHAR: a chave serve?
          O erro mais provável é `EUPAGO_AMBIENTE=sandbox` com a chave de
          produção — as duas casas do euPago têm contas separadas.
        */}
        {ligacao.configurado && (
          <div className="mt-3 border-t border-slate-700/60 pt-3">
            <button
              type="button"
              onClick={() => void provar()}
              disabled={aProvar}
              className="rounded-[14px] border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-40"
            >
              {aProvar ? "A perguntar ao euPago…" : "Provar a ligação"}
            </button>
            <span className="ml-2 text-[11px] text-slate-500">
              pede uma referência de 1 € que ninguém paga — não cobra nem grava nada
            </span>

            {prova?.ok && (
              <p className="mt-2 text-xs text-emerald-300">
                A chave serve. Referência de teste {prova.entidade} / {prova.referencia} criada em{" "}
                {prova.base}.
                {prova.temSegredoDoWebhook === false &&
                  " Falta o segredo do webhook — sem ele nenhum pagamento chega a ser dado por pago."}
              </p>
            )}
            {prova && !prova.ok && (
              <div className="mt-2 text-xs text-red-300">
                <p>{prova.porque}</p>
                {prova.pista && <p className="mt-1 text-amber-300">{prova.pista}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { n: resumo.pagos, t: "pagos" },
          { n: resumo.pendentes, t: "por pagar" },
          { n: resumo.falhados, t: "falhados" },
          { n: null, t: "recebido", v: euros(resumo.totalPago) },
        ].map((c) => (
          <div key={c.t} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <p className="text-2xl font-bold text-white">{c.v ?? c.n}</p>
            <p className="mt-1 text-xs text-slate-400">{c.t}</p>
          </div>
        ))}
      </div>

      {resumo.comissaoDoEupago > 0 && (
        <p className="text-xs text-slate-500">
          O euPago levou {euros(resumo.comissaoDoEupago)} — sai da parte da CLYON, não da do
          profissional.
        </p>
      )}

      {estado.avisos.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-slate-950/40 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-300">
            Por aplicar
          </p>
          <div className="space-y-1 text-xs text-slate-300">
            {estado.avisos.map((a) => (
              <p key={a.id}>
                <strong className="text-white">{a.estado}</strong> · trid {a.trid} ·{" "}
                {euros(a.valor)}
                {a.pagamentoId ? ` · pagamento #${a.pagamentoId}` : ""}
                {a.nota ? ` — ${a.nota}` : ""}
              </p>
            ))}
          </div>
        </div>
      )}

      {estado.ultimos.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Últimos pagamentos
          </p>
          <div className="space-y-1 text-xs text-slate-300">
            {estado.ultimos.map((p) => (
              <p key={p.id}>
                <span className={CORES[p.estado] ?? "text-slate-400"}>{p.estado}</span> · pedido #
                {p.pedidoId} · {p.metodo === "mbway" ? "MB WAY" : "Multibanco"} ·{" "}
                {euros(p.valorPago ?? p.valor)}
                {p.entidade && p.referencia ? ` · ${p.entidade} / ${p.referencia}` : ""}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
