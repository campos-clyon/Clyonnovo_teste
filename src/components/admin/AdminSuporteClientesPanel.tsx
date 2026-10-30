"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { instanteDaBase } from "@/lib/hora-de-lisboa";

/**
 * «SUPORTE — CLIENTES» — 30-10-2026 («Conversas», fase 1).
 *
 * A «Suporte CLYON» que cada cliente tem na conta e na app. A equipa lê e
 * responde aqui; do outro lado aparece «Equipa CLYON», nunca o nome de quem
 * escreveu. O selo conta as mensagens de clientes que a equipa ainda não leu.
 * Horas sempre de Lisboa.
 */

type Linha = {
  id: number;
  estado: string;
  atendidaPor: string;
  ultimaMensagemEm: string | null;
  ultimaMensagem: string | null;
  porLer: number;
  clienteNome: string | null;
  clienteEmail: string | null;
};

type Mensagem = {
  id: number;
  autor: string;
  texto: string;
  textoOriginal: string | null;
  filtrada: boolean;
  anexoUrl: string | null;
  criadaEm: string;
};

const ROTULO: Record<string, string> = {
  cliente: "Cliente",
  equipa: "Equipa CLYON",
  vitoria: "Vitória",
  sistema: "CLYON",
  profissional: "Profissional",
};

function hora(iso: string | null): string {
  const d = instanteDaBase(iso ?? "");
  return d ? d.toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
}

export default function AdminSuporteClientesPanel({ aoMudarPorLer }: { aoMudarPorLer?: (n: number) => void }) {
  const { token, ready } = useAdminAuth();
  const [lista, setLista] = useState<Linha[]>([]);
  const [erro, setErro] = useState("");
  const [aCarregar, setACarregar] = useState(true);
  const [aberta, setAberta] = useState<number | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const abertaRef = useRef<number | null>(null);
  abertaRef.current = aberta;

  const cabecalhos = useCallback(
    (json = false): HeadersInit => ({
      Authorization: `Bearer ${token}`,
      ...(json ? { "Content-Type": "application/json" } : {}),
    }),
    [token],
  );

  const carregar = useCallback(async (silencioso = false) => {
    if (!token) return;
    try {
      const id = abertaRef.current;
      if (id) {
        const rm = await fetch(`/api/admin/suporte/clientes/${id}?_=${Date.now()}`, { cache: "no-store", headers: cabecalhos() });
        if (rm.ok) setMensagens((await rm.json()).mensagens ?? []);
        await fetch(`/api/admin/suporte/clientes/${id}`, { method: "PATCH", headers: cabecalhos() });
      }
      const r = await fetch(`/api/admin/suporte/clientes?_=${Date.now()}`, { cache: "no-store", headers: cabecalhos() });
      const d = await r.json();
      if (!r.ok) return setErro(d.error ?? "Erro ao carregar.");
      setLista(d.conversas ?? []);
      aoMudarPorLer?.(Number(d.porLer ?? 0));
      setErro("");
    } catch {
      if (!silencioso) setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token, cabecalhos, aoMudarPorLer]);

  const abrir = useCallback(
    async (id: number) => {
      if (!token) return;
      setAberta(id);
      try {
        const r = await fetch(`/api/admin/suporte/clientes/${id}?_=${Date.now()}`, { cache: "no-store", headers: cabecalhos() });
        const d = await r.json();
        if (r.ok) setMensagens(d.mensagens ?? []);
        setLista((l) => l.map((c) => (c.id === id ? { ...c, porLer: 0 } : c)));
        await fetch(`/api/admin/suporte/clientes/${id}`, { method: "PATCH", headers: cabecalhos() });
        void carregar();
      } catch {
        setErro("Erro de rede.");
      }
    },
    [token, cabecalhos, carregar],
  );

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);

  // Com uma conversa aberta, o ciclo relê-a (e marca-a lida); senão, a lista.
  useAutoRefresh(() => carregar(true), { enabled: ready && Boolean(token), paused: aEnviar });

  const enviar = async () => {
    const t = texto.trim();
    if (!t || !aberta) return;
    setAEnviar(true);
    try {
      const r = await fetch(`/api/admin/suporte/clientes/${aberta}`, {
        method: "POST",
        headers: cabecalhos(true),
        body: JSON.stringify({ texto: t }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErro(d.error ?? "Não foi possível enviar.");
      else {
        setTexto("");
        await abrir(aberta);
      }
    } finally {
      setAEnviar(false);
    }
  };

  if (aCarregar) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A carregar…
      </div>
    );
  }

  if (aberta) {
    const c = lista.find((x) => x.id === aberta);
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3">
        <button
          onClick={() => {
            setAberta(null);
            setMensagens([]);
          }}
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar
        </button>
        <p className="mb-3 text-sm font-semibold text-slate-200">
          {c?.clienteNome || c?.clienteEmail || `Conversa ${aberta}`}
          {c?.atendidaPor === "equipa" && <span className="ml-2 text-xs font-normal text-amber-300">pediu uma pessoa</span>}
        </p>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {mensagens.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.autor === "cliente" ? "bg-slate-800 text-slate-100" : "ml-auto bg-blue-900/40 text-slate-100"
              }`}
            >
              <p className="mb-1 text-[11px] text-slate-400">
                {ROTULO[m.autor] ?? m.autor} · {hora(m.criadaEm)}
              </p>
              <p className="whitespace-pre-wrap">{m.texto}</p>
              {m.filtrada && m.textoOriginal && (
                <p className="mt-1 text-[11px] text-amber-300">Original (só a equipa vê): {m.textoOriginal}</p>
              )}
              {m.anexoUrl && (
                <a href={m.anexoUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs underline">
                  Anexo
                </a>
              )}
            </div>
          ))}
          {mensagens.length === 0 && <p className="text-sm text-slate-400">Sem mensagens.</p>}
        </div>
        <div className="mt-3 flex gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Responder como Equipa CLYON"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
          <button
            onClick={() => void enviar()}
            disabled={aEnviar || !texto.trim()}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden="true" /> Enviar
          </button>
        </div>
        {erro && <p className="mt-2 text-sm text-red-300">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {erro && <p className="text-sm text-red-300">{erro}</p>}
      {lista.length === 0 && <p className="text-sm text-slate-400">Nenhum cliente escreveu ainda no Suporte CLYON.</p>}
      {lista.map((c) => (
        <button
          key={c.id}
          onClick={() => void abrir(c.id)}
          className="flex w-full items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-left hover:bg-slate-800/60"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-100">{c.clienteNome || c.clienteEmail || `Conversa ${c.id}`}</p>
            <p className="truncate text-xs text-slate-400">{c.ultimaMensagem ?? ""}</p>
          </div>
          <span className="shrink-0 text-[11px] text-slate-500">{hora(c.ultimaMensagemEm)}</span>
          {c.porLer > 0 && (
            <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white" title={`${c.porLer} por ler`}>
              {c.porLer}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
