"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Pencil, RefreshCw, UserCheck, Users } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import RegistarPedido from "@/components/admin/RegistarPedido";
import { FormularioDaOferta } from "@/components/admin/FormularioDaOferta";
import { servicoEmPalavras } from "@/lib/servico-em-palavras";
import {
  ROTULO_DA_FASE,
  type FaseDaOferta,
  type ModoDaOferta,
} from "@/lib/oferta-clyon";

/**
 * OS TRABALHOS CLYON DE VALOR FIXO — a página do backoffice.
 *
 * *«Quero criar uma função no site para gerar trabalhos nas contas dos
 * profissionais (…) são trabalhos que nós já negociámos e já temos os valores,
 * só precisamos de alguém para realizar.»* — 02-10-2026.
 *
 * Três coisas, por esta ordem, que é a ordem em que acontecem:
 *   1. registar o trabalho e oferecê-lo — o «Registar pedido» de sempre, com o
 *      passo do envio trocado pela oferta a valor fixo;
 *   2. escolher quem o faz, entre os que aceitaram;
 *   3. confirmar que está feito — aqui é a CLYON que confirma, e não o cliente.
 *
 * As regras e as decisões do dono estão em `oferta-clyon.ts`.
 */

type NegociacaoDoTrabalho = {
  negociacaoId: number;
  providerId: number;
  profissional: string;
  estado: string;
  modo: ModoDaOferta | null;
  dataCombinada: string | null;
  atribuidaEm: string | null;
  execucaoEnviadaEm: string | null;
  confirmadoEm: string | null;
  pagoEm: string | null;
};

type TrabalhoClyon = {
  pedidoId: number;
  servico: string | null;
  localidade: string | null;
  morada: string | null;
  dataAgendada: string | null;
  valorFixo: number;
  cliente: string | null;
  telefone: string | null;
  estadoDoPedido: string | null;
  criadoEm: string | null;
  negociacoes: NegociacaoDoTrabalho[];
  /** O mesmo que `resumoDaOferta` devolve no servidor. */
  resumo: {
    fase: FaseDaOferta;
    enviados: number;
    recusaram: number;
    interessados: NegociacaoDoTrabalho[];
    atribuida: NegociacaoDoTrabalho | null;
  };
};

type Separador = "atribuir" | "curso" | "feitos" | "cancelados";

const SEPARADORES: Array<{ id: Separador; rotulo: string; fases: FaseDaOferta[]; vazio: string }> = [
  {
    id: "atribuir",
    rotulo: "Por atribuir",
    fases: ["escolher", "a_espera", "sem_ninguem"],
    vazio: "Nenhum trabalho à espera de profissional.",
  },
  {
    id: "curso",
    rotulo: "Em curso",
    fases: ["por_confirmar", "atribuida"],
    vazio: "Nenhum trabalho em curso.",
  },
  {
    id: "feitos",
    rotulo: "Concluídos",
    fases: ["confirmada", "paga"],
    vazio: "Ainda nenhum trabalho concluído.",
  },
  // Arquivados ou cancelados antes de feitos: saíram dos profissionais (08-10-2026).
  {
    id: "cancelados",
    rotulo: "Cancelados",
    fases: ["cancelada"],
    vazio: "Nenhum trabalho cancelado.",
  },
];

const COR_DA_FASE: Record<FaseDaOferta, string> = {
  escolher: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  a_espera: "border-slate-600 bg-slate-800/60 text-slate-300",
  sem_ninguem: "border-red-500/40 bg-red-500/10 text-red-300",
  atribuida: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  por_confirmar: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  confirmada: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  paga: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  cancelada: "border-slate-600 bg-slate-800/60 text-slate-400",
};

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const euros = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(2).replace(".", ",")} €`;

/** «sex., 2 out., 09:00» — em Lisboa, onde o trabalho acontece. */
function quando(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-PT", {
    timeZone: "Europe/Lisbon",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminTrabalhosClyonPanel() {
  const { token, ready } = useAdminAuth();
  const [trabalhos, setTrabalhos] = useState<TrabalhoClyon[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [separador, setSeparador] = useState<Separador>("atribuir");
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [aEditar, setAEditar] = useState<number | null>(null);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!token) return;
      if (!silencioso) setACarregar(true);
      try {
        const res = await fetch("/api/admin/trabalhos-clyon", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const dados = await res.json();
        if (!res.ok) {
          setErro(dados.error ?? "Não foi possível ler os trabalhos CLYON.");
          return;
        }
        setTrabalhos(dados.trabalhos ?? []);
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

  async function agir(
    url: string,
    corpo: Record<string, unknown>,
    negociacaoId: number,
    feito: string,
  ) {
    if (!token) return;
    setOcupado(negociacaoId);
    setErro("");
    setAviso("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return;
      }
      setAviso(feito);
      await carregar(true);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  function escolher(t: TrabalhoClyon, n: NegociacaoDoTrabalho) {
    const outros = t.resumo.interessados.length - 1;
    if (
      !window.confirm(
        `Dar o trabalho #${t.pedidoId} a ${n.profissional}, por ${euros(t.valorFixo)}?` +
          (outros > 0 ? `\n\n${outros === 1 ? "O outro que aceitou fica" : `Os outros ${outros} que aceitaram ficam`} de fora.` : ""),
      )
    ) {
      return;
    }
    void agir(
      "/api/admin/trabalhos-clyon/escolher",
      { negociacaoId: n.negociacaoId },
      n.negociacaoId,
      `#${t.pedidoId} atribuído a ${n.profissional}. Foi avisado por email e WhatsApp.`,
    );
  }

  function confirmar(t: TrabalhoClyon, n: NegociacaoDoTrabalho, semProva: boolean) {
    if (
      !window.confirm(
        semProva
          ? `${n.profissional} ainda não deu o #${t.pedidoId} por feito. Confirmar mesmo assim?\n\nO valor (${euros(t.valorFixo)}) fica disponível na carteira dele.`
          : `Confirmar que o #${t.pedidoId} está feito?\n\nO valor (${euros(t.valorFixo)}) fica disponível na carteira de ${n.profissional}.`,
      )
    ) {
      return;
    }
    void agir(
      "/api/admin/trabalhos-clyon/confirmar",
      { negociacaoId: n.negociacaoId, semProva },
      n.negociacaoId,
      `#${t.pedidoId} confirmado. O valor está na carteira de ${n.profissional}.`,
    );
  }

  const porSeparador = useMemo(() => {
    const m = new Map<Separador, TrabalhoClyon[]>();
    for (const s of SEPARADORES) {
      m.set(
        s.id,
        trabalhos.filter((t) => s.fases.includes(t.resumo.fase)),
      );
    }
    return m;
  }, [trabalhos]);
  const actual = porSeparador.get(separador) ?? [];
  const def = SEPARADORES.find((s) => s.id === separador)!;

  return (
    <div className="space-y-4">
      <RegistarPedido
        onCriado={() => void carregar(true)}
        oferta={(r) => (
          <FormularioDaOferta
            token={token}
            pedidoId={r.id}
            alcance={r.alcance}
            referencia={r.valorDePartida}
            onOferecido={(msg) => {
              setAviso(msg);
              setSeparador("atribuir");
              void carregar(true);
            }}
          />
        )}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Trabalhos CLYON por fase" className="grid grid-cols-3 gap-2 sm:flex">
          {SEPARADORES.map((s) => {
            const activo = s.id === separador;
            const n = porSeparador.get(s.id)?.length ?? 0;
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={activo}
                onClick={() => setSeparador(s.id)}
                className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition sm:px-4 ${
                  activo
                    ? "border-cyan-500/60 bg-[#06B6D4]/10 text-cyan-200"
                    : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600"
                }`}
              >
                {s.rotulo} <span className="tabular-nums text-slate-400">· {n}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => void carregar()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Actualizar
        </button>
      </div>

      {erro && (
        <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{erro}</p>
      )}
      {aviso && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {aviso}
        </p>
      )}

      {aCarregar && trabalhos.length === 0 ? (
        <p className="flex items-center gap-2 py-8 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A carregar…
        </p>
      ) : actual.length === 0 ? (
        <p className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-400">
          {def.vazio}
        </p>
      ) : (
        <ul className="space-y-3">
          {actual.map((t) => (
            <CartaoDoTrabalho
              key={t.pedidoId}
              t={t}
              ocupado={ocupado}
              onEscolher={(n) => escolher(t, n)}
              onConfirmar={(n, semProva) => confirmar(t, n, semProva)}
              onEditar={() => setAEditar(t.pedidoId)}
            />
          ))}
        </ul>
      )}

      {/*
        EDITAR O PEDIDO — 07-10-2026, «deixe a opção de editar o pedido».

        O mesmo editor da Agenda e das Negociações, por cima da lista. Num
        Trabalho CLYON gravar não recomeça nada: a oferta segue com quem a
        recebeu, com o mesmo valor fixo (`recomecar-do-zero.ts`).

        Fecha pelo botão, e só pelo botão: são catorze campos e fotografias, e
        um clique ao lado não pode deitá-los fora.
      */}
      {aEditar != null && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#0B1220] p-4 sm:p-8">
          <div className="mx-auto max-w-5xl">
            <RegistarPedido
              editarId={aEditar}
              onCriado={() => void carregar(true)}
              onFechar={() => {
                setAEditar(null);
                void carregar(true);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CartaoDoTrabalho({
  t,
  ocupado,
  onEscolher,
  onConfirmar,
  onEditar,
}: {
  t: TrabalhoClyon;
  ocupado: number | null;
  onEscolher: (n: NegociacaoDoTrabalho) => void;
  onConfirmar: (n: NegociacaoDoTrabalho, semProva: boolean) => void;
  onEditar: () => void;
}) {
  const r = t.resumo;
  const a = r.atribuida;
  const dia = quando(a?.dataCombinada ?? t.dataAgendada);

  return (
    <li className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">
            #{t.pedidoId} · {maiuscula(servicoEmPalavras(t.servico))}
            {t.localidade ? <span className="font-normal text-slate-400"> · {t.localidade}</span> : null}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {[dia ? `${a?.dataCombinada ? "Dia marcado" : "Dia pedido"}: ${dia}` : "Sem dia", t.cliente, t.telefone]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${COR_DA_FASE[r.fase]}`}>
            {ROTULO_DA_FASE[r.fase]}
          </span>
          <p className="mt-1 text-lg font-bold tabular-nums text-emerald-300">{euros(t.valorFixo)}</p>
          <p className="text-[10px] text-slate-500">valor fixo · o que o pro recebe</p>
        </div>
      </div>

      {!a && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          Oferecido a {r.enviados} {r.enviados === 1 ? "profissional" : "profissionais"}
          {r.recusaram > 0 ? ` · ${r.recusaram} recusaram` : ""}
          {r.enviados === 1 && t.negociacoes[0]?.modo === "directa" ? " · se aceitar, fica com ele" : ""}
        </p>
      )}

      {r.fase === "escolher" && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold text-amber-200">
            Aceitaram — escolha quem o faz:
          </p>
          <ul className="mt-2 space-y-1.5">
            {r.interessados.map((n) => (
              <li key={n.negociacaoId} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-white">{n.profissional}</span>
                <button
                  onClick={() => onEscolher(n)}
                  disabled={ocupado != null}
                  className="flex items-center gap-1.5 rounded-lg bg-acao px-3 py-1.5 text-xs font-bold text-white transition hover:bg-acao-hover disabled:opacity-50"
                >
                  {ocupado === n.negociacaoId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Escolher
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.fase === "sem_ninguem" && (
        <p className="mt-2 text-xs text-red-300">
          Todos os que o receberam recusaram. Pode registá-lo outra vez com outro valor, ou oferecê-lo
          a outro profissional.
        </p>
      )}

      {a && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-sm text-slate-200">
            <span className="text-slate-400">Profissional:</span> <strong className="text-white">{a.profissional}</strong>
            {a.confirmadoEm ? (
              <span className="text-slate-400"> · confirmado {quando(a.confirmadoEm)}</span>
            ) : a.execucaoEnviadaEm ? (
              <span className="text-amber-300"> · diz que está feito ({quando(a.execucaoEnviadaEm)})</span>
            ) : null}
            {a.pagoEm ? <span className="text-emerald-300"> · pago {quando(a.pagoEm)}</span> : null}
          </p>
          {!a.confirmadoEm && (
            <div className="flex flex-wrap gap-2">
              {a.execucaoEnviadaEm ? (
                <button
                  onClick={() => onConfirmar(a, false)}
                  disabled={ocupado != null}
                  className="flex items-center gap-1.5 rounded-lg bg-acao px-3 py-1.5 text-xs font-bold text-white transition hover:bg-acao-hover disabled:opacity-50"
                >
                  {ocupado === a.negociacaoId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Confirmar trabalho feito
                </button>
              ) : (
                <button
                  onClick={() => onConfirmar(a, true)}
                  disabled={ocupado != null}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Já está feito — confirmar
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
        <button
          onClick={onEditar}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Editar pedido
        </button>
      </div>
    </li>
  );
}
