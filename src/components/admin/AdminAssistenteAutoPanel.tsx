"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, Play, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  CAPACIDADES,
  FICHA_DA_CAPACIDADE,
  type Capacidade,
} from "@/lib/assistente-interruptores";

/**
 * O ECRÃ DO ASSISTENTE AUTOMÁTICO.
 *
 * "Cada uma dessas ferramentas deve ter a opção de o admin parar, caso esteja
 * a cometer erros por parte do assistente." — 12-09-2026.
 *
 * Duas coisas, e a segunda é a que faz a primeira valer alguma coisa:
 *
 *   · os SEIS INTERRUPTORES, cada um a dizer o que pára quando se desliga;
 *   · a LISTA DO QUE ELE FEZ, com a frase que saiu e para quem.
 *
 * Sem a lista, "parar caso esteja a cometer erros" obriga alguém a ler
 * conversas uma a uma até encontrar o erro — e o erro descobre-se sempre tarde
 * demais. Com ela, vê-se num relance o que saiu esta manhã.
 *
 * VIVE NUM FICHEIRO PRÓPRIO e é pedido à parte: a rota do painel do WhatsApp
 * já faz sete consultas em paralelo de trinta em trinta segundos, e este
 * separador quase nunca está aberto.
 */

type Aviso = {
  id: number;
  especie: string;
  telefone: string;
  pedidoId: number | null;
  texto: string | null;
  enviadoEm: string;
  toques: number;
  fechadoEm: string | null;
  fechadoPorque: string | null;
};

type Desfazivel = {
  id: number;
  enviadoEm: string;
  retrato: { pedidoId: number; negociacaoId: number; encerradas: number[] };
};

type Estado = {
  interruptores: Record<string, boolean>;
  avisos: Aviso[];
  desfaziveis: Desfazivel[];
  podeMexer: boolean;
};

/** A espécie em palavras de painel. O identificador não vai para o ecrã. */
const ESPECIE_EM_PALAVRAS: Record<string, string> = {
  proposta_nova: "Contou uma proposta nova",
  pro_aceitou: "Contou que o profissional aceitou",
  fechado: "Contou que ficou fechado",
  dia_marcado: "Contou o dia marcado",
  vespera: "Lembrou a véspera",
  trabalho_feito: "Pediu a confirmação do trabalho",
  agradecimento: "Agradeceu",
  avaliacao: "Pediu a avaliação",
  sem_propostas: "Avisou a equipa: sem propostas",
  recolha_parada: "Insistiu numa recolha a meio",
};

/** Porque é que deixou de estar à espera. */
const PORQUE_FECHOU: Record<string, string> = {
  respondeu: "o cliente respondeu",
  resolvido: "resolveu-se sozinho",
  esgotou: "três lembretes sem resposta",
  informado: "era só uma notícia",
  desfeito: "desfeito aqui",
  antes_do_assistente: "já era assim quando ele chegou",
};

function quando(iso: string): string {
  const d = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function telefoneBonito(t: string): string {
  const d = t.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("351")) {
    return `+351 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
  }
  return d;
}

export default function AdminAssistenteAutoPanel() {
  const { token, ready } = useAdminAuth();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/whatsapp/assistente", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar.");
        return;
      }
      setEstado(dados);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    }
  }, [token]);

  // Só se pede quando o separador abre. Fechado, não custa nada.
  useEffect(() => {
    if (!ready || !aberto) return;
    void carregar();
  }, [ready, aberto, carregar]);

  const agir = useCallback(
    async (corpo: Record<string, unknown>) => {
      if (!token) return;
      setOcupado(true);
      setErro("");
      setAviso("");
      try {
        const res = await fetch("/api/admin/whatsapp/assistente", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(corpo),
        });
        const dados = await res.json();
        if (!res.ok) {
          setErro(dados.error ?? "Não foi possível.");
          return;
        }
        if (dados.passagem) {
          const p = dados.passagem;
          setAviso(
            p.correu
              ? `Passagem feita: ${p.novidades} novidade(s), ${p.lembretes} lembrete(s), ${p.alertas} alerta(s) à equipa.`
              : "O WhatsApp está desligado, por isso não correu nada.",
          );
        }
        if (dados.repostas != null) {
          setAviso(
            `Desfeito. ${dados.repostas > 0 ? `${dados.repostas} negociação(ões) reposta(s).` : "Não havia outras para repor."} A conversa passou para si.`,
          );
        }
        await carregar();
      } catch {
        setErro("Erro de rede.");
      } finally {
        setOcupado(false);
      }
    },
    [token, carregar],
  );

  const ligados = estado
    ? CAPACIDADES.filter((c) => estado.interruptores[c] === true).length
    : null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-cyan-400" aria-hidden="true" />
          <span className="text-sm font-bold text-white">Assistente automático</span>
          {ligados != null && (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
              {ligados} de {CAPACIDADES.length} ligadas
            </span>
          )}
        </span>
        {aberto ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        )}
      </button>

      {!aberto && (
        <p className="mt-1 text-xs text-slate-500">
          O que ele conta ao cliente sozinho, e o que já contou. Abra para ver.
        </p>
      )}

      {aberto && (
        <div className="mt-4 space-y-4">
          {erro && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {erro}
            </p>
          )}
          {aviso && (
            <p className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
              {aviso}
            </p>
          )}

          {!estado ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A carregar.
            </p>
          ) : (
            <>
              {/* ── Os seis interruptores ─────────────────────────────── */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs leading-relaxed text-slate-400">
                  Cada uma destas pára sozinha, sem calar as outras. O botão vermelho lá de cima
                  continua a mandar sobre todas.
                </p>
                <ul className="mt-3 divide-y divide-slate-800">
                  {CAPACIDADES.map((c: Capacidade) => {
                    const ligado = estado.interruptores[c] === true;
                    const ficha = FICHA_DA_CAPACIDADE[c];
                    return (
                      <li key={c} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{ficha.titulo}</p>
                          <p className="text-xs leading-relaxed text-slate-500">
                            {ligado ? ficha.oQuePara : "Está parada."}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            void agir({ accao: "interruptor", capacidade: c, ligado: !ligado })
                          }
                          disabled={ocupado || !estado.podeMexer}
                          title={
                            estado.podeMexer
                              ? undefined
                              : "Só o administrador mexe nos interruptores."
                          }
                          className={`flex min-h-[34px] shrink-0 items-center rounded-lg px-3 text-xs font-bold transition disabled:opacity-40 ${
                            ligado
                              ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                              : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                          }`}
                        >
                          {ligado ? "Ligada" : "Parada"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button
                  onClick={() => void agir({ accao: "correrAgora" })}
                  disabled={ocupado || !estado.podeMexer}
                  className="mt-3 flex min-h-[38px] items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  Correr agora
                </button>
                <p className="mt-1.5 text-[11px] text-slate-600">
                  Faz a mesma passagem do automático. Carregar duas vezes não manda nada a dobrar.
                </p>
              </div>

              {/* ── Os fechos que ainda dá para desfazer ──────────────── */}
              {estado.desfaziveis.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3">
                  <p className="text-sm font-semibold text-amber-200">
                    Negócios fechados pelo assistente
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Dá para desfazer durante 24 horas. Desfazer repõe as outras propostas e passa a
                    conversa para si.
                  </p>
                  <ul className="mt-2 space-y-2">
                    {estado.desfaziveis.map((d) => (
                      <li
                        key={d.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/60 px-3 py-2"
                      >
                        <span className="text-xs text-slate-300">
                          Pedido #{d.retrato.pedidoId}, negociação #{d.retrato.negociacaoId} —{" "}
                          {quando(d.enviadoEm)}
                        </span>
                        <button
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Desfazer o fecho do pedido #${d.retrato.pedidoId}?\n\nA negociação volta ao que era e as outras propostas voltam à mesa. A conversa passa para si — o assistente cala-se nesse número.`,
                              )
                            ) {
                              return;
                            }
                            void agir({ accao: "desfazer", id: d.id });
                          }}
                          disabled={ocupado || !estado.podeMexer}
                          className="flex min-h-[32px] items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/25 disabled:opacity-40"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          Não era isto
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── O que ele fez ─────────────────────────────────────── */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  O que ele fez
                </p>
                {estado.avisos.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Ainda nada. Ligue uma das capacidades acima e volte aqui.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-800">
                    {estado.avisos.map((a) => (
                      <li key={a.id} className="py-2.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-200">
                            {ESPECIE_EM_PALAVRAS[a.especie] ?? a.especie}
                          </span>
                          <span className="text-[11px] text-slate-500">{quando(a.enviadoEm)}</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {telefoneBonito(a.telefone)}
                          {a.pedidoId ? ` · pedido #${a.pedidoId}` : ""}
                          {a.toques > 0 ? ` · ${a.toques} lembrete(s)` : ""}
                          {a.fechadoPorque
                            ? ` · ${PORQUE_FECHOU[a.fechadoPorque] ?? a.fechadoPorque}`
                            : " · à espera de resposta"}
                        </p>
                        {a.texto && (
                          <p className="mt-1 rounded-lg bg-slate-950/60 px-3 py-2 text-xs leading-relaxed text-slate-400">
                            {a.texto}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
