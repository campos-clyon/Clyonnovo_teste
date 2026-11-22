"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { ProcuraGlobalContext, useProcuraDoBackoffice } from "@/components/admin/NoutrosSitios";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  CANAIS_DO_CONTACTO,
  ROTULO_DE_QUEM_RESPONDEU,
  ROTULO_DO_ESTADO,
  type CanalDoContacto,
  type EstadoDoContacto,
  type FiltroDaCaixa,
  type MedidaDaCaixa,
  type QuemRespondeu,
} from "@/lib/caixa-dos-contactos";
import { diaMesEHoraEmLisboa, instanteDaBase } from "@/lib/hora-de-lisboa";
import { haQuanto } from "@/lib/mesa-das-conversas";
import { combinaComOsCampos } from "@/lib/procurar-pedido";
import { telefoneLegivel } from "@/lib/telefone-legivel";

/**
 * «CONTACTOS» — d85, fase 1 (CEO e dono, 22-11-2026).
 *
 * Todos os contactos numa lista, uma linha por pessoa: o WhatsApp, os
 * formulários do site e o Suporte da app (o email geral@ fica por ligar). Abre
 * em «Por responder», com quem espera há mais tempo à frente; a vermelho quem
 * passou das 2 h dentro do horário (seg–sáb, 08h–20h em Lisboa). Cada linha
 * diz por onde escreveu, quem falou por último, quem respondeu e há quanto
 * tempo espera, com os pedidos ligados e um toque para abrir a conversa.
 *
 * «Respondido» é para quando se respondeu por fora (telefone, email, o
 * telemóvel): muda o estado em cada canal — o «Já respondi» do WhatsApp, o
 * lead a «contactado» — e grava quem e quando. Não envia nada a ninguém.
 * Horas sempre de Lisboa.
 */

type Entrada = { canal: CanalDoContacto; ref: string; estado: EstadoDoContacto; porque: string };

type Linha = {
  chave: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  anonimizado: boolean;
  canais: CanalDoContacto[];
  estado: EstadoDoContacto;
  esperaS: number | null;
  esperaUtilS: number | null;
  atrasado: boolean;
  antigo: boolean;
  ultimoEm: string | null;
  quemFalou: "contacto" | "nos" | null;
  quemRespondeu: QuemRespondeu | null;
  respondidoPorNome: string | null;
  respondidoEm: string | null;
  resumo: string | null;
  porque: string;
  pedidos: number[];
  profissional: boolean;
  entradas: Entrada[];
};

type Dia = { dia: string; porResponder: number; maisDeDuasHoras: number; maisDeTresDias: number; picoDuasHoras: number };

const COR_DO_ESTADO: Record<EstadoDoContacto, string> = {
  por_responder: "bg-rose-500/15 text-rose-200 ring-rose-400/30",
  com_pessoa: "bg-amber-500/15 text-amber-200 ring-amber-400/30",
  respondido: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
  fechado: "bg-slate-700/50 text-slate-300 ring-slate-500/30",
};

/** A secção que abre cada canal, e o que se põe na procura dela. */
const SECCAO_DO_CANAL: Record<CanalDoContacto, string> = {
  whatsapp: "whatsapp",
  formulario: "leads",
  suporte: "suporte",
  email: "contactos",
};

function quando(iso: string | null): string {
  const d = instanteDaBase(iso);
  return d ? diaMesEHoraEmLisboa(d) : "";
}

function nomeDaLinha(c: Linha): string {
  if (c.anonimizado) return "anonimizado";
  return c.nome || telefoneLegivel(c.telefone) || c.email || "sem nome";
}

export default function AdminContactosPanel() {
  const { token, ready } = useAdminAuth();
  const global = useContext(ProcuraGlobalContext);
  const { termo } = useProcuraDoBackoffice();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [medida, setMedida] = useState<MedidaDaCaixa | null>(null);
  const [dias, setDias] = useState<Dia[]>([]);
  const [falhas, setFalhas] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [aCarregar, setACarregar] = useState(true);
  const [aGravar, setAGravar] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroDaCaixa>("por_responder");
  const [canal, setCanal] = useState<CanalDoContacto | null>(null);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!token) return;
      try {
        const r = await fetch(`/api/admin/contactos?_=${Date.now()}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (!silencioso) setErro(d.error ?? "Não foi possível ler os contactos.");
          return;
        }
        setLinhas(d.contactos ?? []);
        setMedida(d.medida ?? null);
        setDias(d.dias ?? []);
        setFalhas(d.falhas ?? []);
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
  useAutoRefresh(() => carregar(true), { enabled: ready && Boolean(token), paused: aGravar != null });

  const visiveis = useMemo(() => {
    const doCanal = canal ? linhas.filter((c) => c.canais.includes(canal)) : linhas;
    const doFiltro =
      filtro === "por_responder"
        ? doCanal
            .filter((c) => c.estado === "por_responder")
            .sort((a, b) => {
              // A ordem da mesa: os dos últimos 3 dias primeiro, quem espera há mais tempo à frente.
              if (a.antigo !== b.antigo) return a.antigo ? 1 : -1;
              return a.antigo ? (a.esperaS ?? 0) - (b.esperaS ?? 0) : (b.esperaS ?? 0) - (a.esperaS ?? 0);
            })
        : [...doCanal].sort((a, b) => (instanteDaBase(b.ultimoEm)?.getTime() ?? 0) - (instanteDaBase(a.ultimoEm)?.getTime() ?? 0));
    return doFiltro.filter((c) =>
      combinaComOsCampos(
        { ids: c.pedidos, textos: [c.nome, c.email, c.resumo, c.porque, c.respondidoPorNome], digitos: [c.telefone] },
        termo,
      ),
    );
  }, [linhas, filtro, canal, termo]);

  const marcarRespondido = async (c: Linha) => {
    if (!token) return;
    const refs = c.entradas.filter((e) => e.estado === "por_responder").map((e) => e.ref);
    if (refs.length === 0) return;
    setAGravar(c.chave);
    try {
      const r = await fetch("/api/admin/contactos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accao: "respondido", refs }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErro(d.error ?? "Não foi possível marcar como respondido.");
      else await carregar(true);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGravar(null);
    }
  };

  const abrir = (canalDaEntrada: CanalDoContacto, c: Linha) => {
    const seccao = SECCAO_DO_CANAL[canalDaEntrada];
    if (!global || !global.podeVer(seccao)) return;
    global.ir(seccao, canalDaEntrada === "suporte" ? (c.email ?? "") : (c.telefone ?? c.email ?? ""));
  };

  if (aCarregar) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A juntar os contactos…
      </div>
    );
  }

  const porResponder = medida?.porResponder ?? 0;
  const porCanal = medida?.porCanal;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Contactos</h2>
          <p className="text-xs text-slate-400">
            WhatsApp, formulários e Suporte da app numa lista. A vermelho quem espera há mais de 2 h no horário (seg–sáb,
            08h–20h).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 px-3 py-2">
          <p className="text-[11px] text-slate-400">Por responder</p>
          <p className="text-2xl font-semibold text-white">{porResponder}</p>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2">
          <p className="text-[11px] text-rose-200/80">Há mais de 2 h</p>
          <p className="text-2xl font-semibold text-rose-200">{medida?.maisDeDuasHoras ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 px-3 py-2">
          <p className="text-[11px] text-slate-400">Há mais de 3 dias</p>
          <p className="text-2xl font-semibold text-white">{medida?.maisDeTresDias ?? 0}</p>
        </div>
      </div>

      {dias.length > 1 && (
        <p className="text-[11px] text-slate-500">
          Por dia (mais de 2 h, pico):{" "}
          {dias
            .slice(0, 14)
            .map((d) => `${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)} ${d.picoDuasHoras}`)
            .join(" · ")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {(["por_responder", "todos"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filtro === f ? "bg-sky-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {f === "por_responder" ? `Por responder${porResponder > 0 ? ` · ${porResponder}` : ""}` : "Todos"}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-700" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setCanal(null)}
          className={`rounded-full px-2.5 py-1 text-xs transition ${
            canal == null ? "bg-slate-200 text-slate-900" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          Todos os canais
        </button>
        {CANAIS_DO_CONTACTO.map((c) => {
          const porLigar = c.id === "email";
          const n = porCanal?.[c.id] ?? 0;
          return (
            <button
              key={c.id}
              type="button"
              disabled={porLigar}
              title={porLigar ? "A caixa geral@ ainda não está ligada ao backoffice" : undefined}
              onClick={() => setCanal(canal === c.id ? null : c.id)}
              className={`rounded-full px-2.5 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                canal === c.id ? "bg-slate-200 text-slate-900" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {c.titulo}
              {porLigar ? " (por ligar)" : n > 0 ? ` · ${n}` : ""}
            </button>
          );
        })}
      </div>

      {erro && <p className="text-sm text-rose-300">{erro}</p>}
      {falhas.length > 0 && (
        <p className="text-xs text-amber-300">Não se leu desta vez: {falhas.join(", ")}. A lista pode estar incompleta.</p>
      )}

      {visiveis.length === 0 && (
        <p className="rounded-xl border border-slate-700/60 bg-slate-950/30 px-3 py-4 text-sm text-slate-400">
          {termo.trim()
            ? `Nenhum contacto com «${termo.trim()}».`
            : filtro === "por_responder"
              ? "Ninguém à espera de resposta. 👍"
              : "Nenhum contacto."}
        </p>
      )}

      <div className="space-y-1.5">
        {visiveis.map((c, i) => {
          const linhaDasAntigas = filtro === "por_responder" && c.antigo && (i === 0 || !visiveis[i - 1].antigo);
          return (
            <div key={c.chave}>
              {linhaDasAntigas && (
                <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Há mais de 3 dias
                </p>
              )}
              <div
                className={`rounded-xl border px-3 py-2 ${
                  c.atrasado ? "border-rose-500/50 bg-rose-950/25" : "border-slate-700/60 bg-slate-950/30"
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className={`truncate text-sm font-semibold ${c.anonimizado ? "italic text-slate-400" : "text-slate-100"}`}>
                    {nomeDaLinha(c)}
                  </p>
                  {c.nome && c.telefone && <span className="text-xs text-slate-400">{telefoneLegivel(c.telefone)}</span>}
                  {c.profissional && (
                    <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-200">profissional</span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${COR_DO_ESTADO[c.estado]}`}>
                    {ROTULO_DO_ESTADO[c.estado]}
                  </span>
                  {c.estado === "por_responder" && c.esperaS != null && (
                    <span className={`text-xs font-semibold ${c.atrasado ? "text-rose-300" : "text-slate-300"}`}>
                      à espera {haQuanto(c.esperaS)}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-slate-500">{quando(c.ultimoEm)}</span>
                </div>

                <p className="mt-0.5 text-xs text-slate-300">{c.porque}</p>
                {c.resumo && <p className="truncate text-xs text-slate-500">{c.resumo}</p>}

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                  {c.entradas.map((e) => {
                    const seccao = SECCAO_DO_CANAL[e.canal];
                    const pode = Boolean(global?.podeVer(seccao)) && e.canal !== "email";
                    return (
                      <button
                        key={e.ref}
                        type="button"
                        disabled={!pode}
                        onClick={() => abrir(e.canal, c)}
                        title={pode ? `Abrir em ${CANAIS_DO_CONTACTO.find((x) => x.id === e.canal)?.titulo}` : "Sem acesso a essa secção"}
                        className={`rounded-md px-2 py-0.5 ring-1 transition disabled:cursor-default disabled:opacity-60 ${
                          e.estado === "por_responder"
                            ? "bg-rose-500/10 text-rose-200 ring-rose-400/30 hover:bg-rose-500/20"
                            : "bg-slate-800 text-slate-300 ring-slate-600/40 hover:bg-slate-700"
                        }`}
                      >
                        {CANAIS_DO_CONTACTO.find((x) => x.id === e.canal)?.titulo}
                      </button>
                    );
                  })}
                  {c.pedidos.slice(0, 4).map((id) => (
                    <a
                      key={id}
                      href={`/admin/pedido/${id}`}
                      className="rounded-md bg-sky-500/10 px-2 py-0.5 text-sky-200 ring-1 ring-sky-400/30 hover:bg-sky-500/20"
                    >
                      #{id}
                    </a>
                  ))}
                  <span className="text-slate-500">
                    {c.quemFalou === "contacto" ? "Última: o contacto" : c.quemFalou === "nos" ? "Última: nós" : ""}
                    {c.quemRespondeu
                      ? ` · respondeu ${ROTULO_DE_QUEM_RESPONDEU[c.quemRespondeu].toLowerCase()}${
                          c.respondidoPorNome ? ` (${c.respondidoPorNome})` : ""
                        }${c.respondidoEm ? `, ${quando(c.respondidoEm)}` : ""}`
                      : ""}
                  </span>
                  {c.estado === "por_responder" && (
                    <button
                      type="button"
                      onClick={() => void marcarRespondido(c)}
                      disabled={aGravar != null}
                      title="Já lhe respondi (pelo WhatsApp, telefone ou email) — muda o estado em todos os canais"
                      className="ml-auto inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {aGravar === c.chave ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="h-3 w-3" aria-hidden="true" />
                      )}
                      Respondido
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
