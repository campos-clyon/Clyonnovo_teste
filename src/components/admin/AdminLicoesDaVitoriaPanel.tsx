"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Check, Loader2, Pencil, RefreshCw, X } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import {
  ESTADO_POR_EXTENSO,
  ORIGEM_POR_EXTENSO,
  type EstadoDaLicao,
  type OrigemDaLicao,
} from "@/lib/licoes-da-vitoria-rotulos";

/**
 * AS LIÇÕES DA VITÓRIA — 27-10-2026 (decisão d11).
 *
 * Cada vez que a equipa teve de entrar numa conversa, a rotina diária propõe
 * uma lição: a pergunta (sem dados de pessoas) e a resposta que a Vitória
 * deve dar da próxima vez. Aqui uma pessoa da CLYON aprova, corrige ou
 * recusa — e a aprovada entra na conversa seguinte, sem deploy. Em cima, a
 * semana contra a anterior: se a Vitória está a precisar menos da equipa.
 */

type Licao = {
  id: number;
  criadaEm: string;
  origem: OrigemDaLicao;
  pergunta: string;
  respostaDaEquipa: string | null;
  respostaProposta: string;
  estado: EstadoDaLicao;
  revistaPor: string | null;
  revistaEm: string | null;
  usos: number;
  bloqueadaPor: string | null;
};

type Numeros = {
  conversas: number;
  pedidosSemEquipa: number;
  percentagem: number | null;
  anotadas: number;
  repetidas: number;
  licoesAprovadas: number;
};

type Dados = {
  licoes: Licao[];
  porRever: number;
  painel: { actual: Numeros; anterior: Numeros; desde: string };
  passagens: Array<{ comecouEm: string; ok: boolean; motivo: string | null }>;
};

type Vista = "por_rever" | "em_uso" | "recusadas";

const VISTAS: Array<{ id: Vista; titulo: string; vazio: string }> = [
  { id: "por_rever", titulo: "Por rever", vazio: "Nenhuma lição à espera. A rotina propõe as novas uma vez por dia." },
  { id: "em_uso", titulo: "Em uso", vazio: "Ainda nenhuma lição aprovada." },
  { id: "recusadas", titulo: "Recusadas", vazio: "Nenhuma lição recusada." },
];

function naVista(l: Licao, v: Vista): boolean {
  if (v === "por_rever") return l.estado === "por_rever";
  if (v === "em_uso") return (l.estado === "aprovada" || l.estado === "corrigida") && !l.bloqueadaPor;
  return l.estado === "recusada";
}

function quando(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-PT", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** «+3», «−2», «=» — a diferença para a semana anterior. */
function diferenca(agora: number | null, antes: number | null, sufixo = ""): string {
  if (agora == null || antes == null) return "";
  const d = agora - antes;
  if (d === 0) return "igual à semana anterior";
  return `${d > 0 ? "+" : "−"}${Math.abs(d)}${sufixo} que na semana anterior`;
}

function Cartao({
  titulo,
  valor,
  antes,
  sufixo = "",
  bomSobe,
  nota,
}: {
  titulo: string;
  valor: number | null;
  antes: number | null;
  sufixo?: string;
  bomSobe: boolean;
  nota?: string;
}) {
  const d = valor != null && antes != null ? valor - antes : 0;
  const cor = d === 0 ? "text-slate-500" : d > 0 === bomSobe ? "text-emerald-300" : "text-amber-300";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-white">{valor == null ? "—" : `${valor}${sufixo}`}</p>
      <p className={`text-[11px] ${cor}`}>{diferenca(valor, antes, sufixo === " %" ? " pp" : "") || "sem dados da semana anterior"}</p>
      {nota && <p className="mt-1 text-[11px] text-slate-500">{nota}</p>}
    </div>
  );
}

export default function AdminLicoesDaVitoriaPanel({ onPorRever }: { onPorRever?: (n: number) => void }) {
  const { token, ready } = useAdminAuth();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [vista, setVista] = useState<Vista>("por_rever");
  const [aCorrigir, setACorrigir] = useState<number | null>(null);
  const [textoDaCorreccao, setTextoDaCorreccao] = useState("");
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [aviso, setAviso] = useState<{ id: number; texto: string } | null>(null);

  const carregar = useCallback(
    async (_silencioso = false) => {
      if (!token) return;
      try {
        const res = await fetch("/api/admin/whatsapp/licoes", { headers: { Authorization: `Bearer ${token}` } });
        const d = await res.json();
        if (!res.ok) {
          setErro(d.error ?? "As lições não carregaram.");
          return;
        }
        setDados(d);
        setErro("");
      } catch {
        setErro("Erro de rede.");
      }
    },
    [token],
  );

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);
  useAutoRefresh(() => carregar(true), { enabled: ready && Boolean(token), paused: aCorrigir != null });

  useEffect(() => {
    if (dados) onPorRever?.(dados.porRever);
  }, [dados, onPorRever]);

  const decidir = async (id: number, accao: "aprovar" | "corrigir" | "recusar", resposta?: string) => {
    if (!token) return;
    setOcupado(id);
    setAviso(null);
    try {
      const res = await fetch("/api/admin/whatsapp/licoes", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id, accao, resposta }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAviso({ id, texto: d.error ?? "Não foi possível guardar." });
        return;
      }
      setACorrigir(null);
      setTextoDaCorreccao("");
      await carregar();
    } catch {
      setAviso({ id, texto: "Erro de rede." });
    } finally {
      setOcupado(null);
    }
  };

  if (!dados && !erro) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A ler as lições da Vitória…
      </p>
    );
  }

  const a = dados?.painel.actual;
  const b = dados?.painel.anterior;
  const visiveis = (dados?.licoes ?? []).filter((l) => naVista(l, vista));
  const contagem = (v: Vista) => (dados?.licoes ?? []).filter((l) => naVista(l, v)).length;
  const ultima = dados?.passagens[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white">Lições da Vitória</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Onde a equipa teve de entrar, a Vitória propõe o que dizer da próxima vez. Só entra na conversa depois de
            aprovada — e nunca muda preços, taxas nem promessas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void carregar()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Actualizar
        </button>
      </div>

      {erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{erro}</p>
      )}

      {a && b && (
        <section>
          <p className="mb-2 text-[11px] text-slate-500">
            Esta semana (desde segunda, {dados?.painel.desde.split("-").reverse().join("/")}), em hora de Lisboa, contra a
            anterior.
          </p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Cartao
              titulo="Pedido sem a equipa"
              valor={a.percentagem}
              antes={b.percentagem}
              sufixo=" %"
              bomSobe
              nota={`${a.pedidosSemEquipa} de ${a.conversas} conversas`}
            />
            <Cartao titulo="Anotadas para os colegas" valor={a.anotadas} antes={b.anotadas} bomSobe={false} />
            <Cartao titulo="Perguntas repetidas" valor={a.repetidas} antes={b.repetidas} bomSobe={false} />
            <Cartao titulo="Lições aprovadas" valor={a.licoesAprovadas} antes={b.licoesAprovadas} bomSobe />
          </div>
        </section>
      )}

      {ultima && (
        <p className={`text-[11px] ${ultima.ok ? "text-slate-500" : "text-amber-300"}`}>
          Última passagem da rotina: {quando(ultima.comecouEm)} — {ultima.ok ? "correu bem" : "falhou"}
          {ultima.motivo ? ` (${ultima.motivo})` : ""}.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-3">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setVista(v.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              vista === v.id ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {v.titulo}
            {contagem(v.id) > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  v.id === "por_rever" ? "bg-red-500 text-white" : "bg-slate-800 text-slate-300"
                }`}
              >
                {contagem(v.id)}
              </span>
            )}
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <p className="text-sm text-slate-500">{VISTAS.find((v) => v.id === vista)?.vazio}</p>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((l) => (
            <li key={l.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-semibold text-violet-200">
                  {ORIGEM_POR_EXTENSO[l.origem]}
                </span>
                <span className="text-slate-500">{quando(l.criadaEm)}</span>
                {l.estado !== "por_rever" && (
                  <span className="text-slate-500">
                    · {ESTADO_POR_EXTENSO[l.estado]}
                    {l.revistaPor ? ` por ${l.revistaPor}` : ""} em {quando(l.revistaEm)}
                  </span>
                )}
                {l.usos > 0 && <span className="text-emerald-300">· usada {l.usos}×</span>}
              </div>
              <p className="mt-2 text-sm font-semibold text-white">«{l.pergunta}»</p>
              {l.respostaDaEquipa && (
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  <span className="font-semibold text-slate-300">A equipa respondeu:</span> {l.respostaDaEquipa}
                </p>
              )}
              <p className="mt-2 text-xs leading-relaxed text-slate-200">
                <span className="font-semibold text-cyan-300">A Vitória dirá:</span>{" "}
                {l.respostaProposta || <em className="text-slate-500">(sem resposta — escreva-a em «Corrigir»)</em>}
              </p>
              {l.bloqueadaPor && (
                <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300">
                  Bloqueada: {l.bloqueadaPor}
                </p>
              )}

              {aCorrigir === l.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={textoDaCorreccao}
                    onChange={(e) => setTextoDaCorreccao(e.target.value)}
                    rows={3}
                    aria-label="A resposta que a Vitória deve dar"
                    className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={ocupado === l.id}
                      onClick={() => void decidir(l.id, "corrigir", textoDaCorreccao)}
                      className="flex min-h-[34px] items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-40"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Guardar a correcção
                    </button>
                    <button
                      type="button"
                      onClick={() => setACorrigir(null)}
                      className="flex min-h-[34px] items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {l.estado !== "aprovada" && l.estado !== "corrigida" && (
                    <button
                      type="button"
                      disabled={ocupado === l.id || Boolean(l.bloqueadaPor) || !l.respostaProposta.trim()}
                      onClick={() => void decidir(l.id, "aprovar")}
                      title={l.bloqueadaPor ? "Bloqueada — corrija a resposta primeiro." : undefined}
                      className="flex min-h-[34px] items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Aprovar
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={ocupado === l.id}
                    onClick={() => {
                      setACorrigir(l.id);
                      setTextoDaCorreccao(l.respostaProposta || l.respostaDaEquipa || "");
                    }}
                    className="flex min-h-[34px] items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Corrigir
                  </button>
                  {l.estado !== "recusada" && (
                    <button
                      type="button"
                      disabled={ocupado === l.id}
                      onClick={() => void decidir(l.id, "recusar")}
                      className="flex min-h-[34px] items-center gap-1.5 rounded-lg bg-red-500/10 px-3 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-40"
                    >
                      <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                      Recusar
                    </button>
                  )}
                  {ocupado === l.id && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />}
                </div>
              )}
              {aviso?.id === l.id && <p className="mt-2 text-xs text-amber-300">{aviso.texto}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
