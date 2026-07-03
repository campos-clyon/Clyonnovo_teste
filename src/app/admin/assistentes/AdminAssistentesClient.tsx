"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

type Assistant = {
  id: number;
  nome: string;
  funcao: "motorista" | "ajudante" | "admin" | "assistente";
  valorHora: string;
  isAdmin: number;
  activePedidos: number;
};

const FUNCAO_LABELS: Record<string, string> = {
  motorista: "Motorista",
  ajudante: "Ajudante",
  admin: "Admin",
};

// ─── Modal de criação/edição ──────────────────────────────────────────────────

function AssistentModal({
  assistant,
  onClose,
  onSaved,
  authHeader,
}: {
  assistant: Assistant | null;
  onClose: () => void;
  onSaved: () => void;
  authHeader: Record<string, string>;
}) {
  const isEdit = !!assistant;
  const [nome, setNome] = useState(assistant?.nome ?? "");
  const [senha, setSenha] = useState("");
  const [funcao, setFuncao] = useState<"motorista" | "ajudante" | "admin" | "assistente">(assistant?.funcao ?? "ajudante");
  const [valorHora, setValorHora] = useState(assistant?.valorHora ?? "8.00");
  const [isAdmin, setIsAdmin] = useState(assistant?.isAdmin === 1);
  const isAssistente = funcao === "assistente";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = { nome, funcao, valorHora, isAdmin: isAdmin ? 1 : 0 };
      if (!isEdit) body.senha = senha;
      else if (senha) body.senha = senha;
      if (isEdit) body.id = assistant!.id;

      const res = await fetch("/api/admin/assistentes", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao guardar");
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(9,20,37,0.99)_0%,rgba(7,15,28,0.99)_100%)] shadow-[0_40px_100px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
          <h2 className="text-lg font-bold text-white">{isEdit ? "Editar assistente" : "Novo assistente"}</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Nome do colaborador"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/40 focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              {isEdit ? "Nova palavra-passe (deixe vazio para manter)" : "Palavra-passe"}
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required={!isEdit}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/40 focus:outline-none transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Função</label>
              <select
                value={funcao}
                onChange={(e) => setFuncao(e.target.value as "motorista" | "ajudante" | "admin" | "assistente")}
                className="w-full rounded-2xl border border-white/10 bg-[#0A1220] px-4 py-2.5 text-sm text-white focus:border-cyan-400/40 focus:outline-none transition"
              >
                <option value="motorista">Motorista</option>
                <option value="ajudante">Ajudante</option>
                <option value="admin">Admin</option>
                <option value="assistente">Assistente</option>
              </select>
            </div>
            {!isAssistente && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Valor/hora (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorHora}
                  onChange={(e) => setValorHora(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-cyan-400/40 focus:outline-none transition"
                />
              </div>
            )}
            {isAssistente && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Modelo de pagamento</label>
                <div className="w-full rounded-2xl border border-[#00B4D8]/20 bg-[#00B4D8]/[0.05] px-4 py-2.5 text-sm text-[#00B4D8]">
                  Pagamento fixo por trabalho (configurável em Definições)
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsAdmin(!isAdmin)}
              className={`flex h-5 w-9 items-center rounded-full transition ${isAdmin ? "bg-cyan-500" : "bg-slate-700"}`}
            >
              <span className={`block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${isAdmin ? "translate-x-[18px]" : "translate-x-1"}`} />
            </button>
            <label className="text-sm text-slate-300 select-none">Tem acesso ao painel admin</label>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-white/[0.07] px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.07] transition">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !nome || (!senha && !isEdit)}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-60 transition"
          >
            {saving ? "A guardar..." : isEdit ? "Guardar" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminAssistentesClient() {
  const { ready, authHeader } = useAdminAuth();
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editAssistant, setEditAssistant] = useState<Assistant | null>(null);

  const fetchAssistants = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/assistentes", { headers: authHeader });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar");
      setAssistants(data.assistants ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => { if (ready) fetchAssistants(); }, [ready, fetchAssistants]);

  async function handleDelete(id: number, nome: string) {
    if (!confirm(`Remover "${nome}"? Esta acção é permanente.`)) return;
    try {
      const res = await fetch(`/api/admin/assistentes?id=${id}`, { method: "DELETE", headers: authHeader });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAssistants((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (!ready) return null;

  return (
    <div className="min-h-full px-4 py-6 md:px-8 md:py-8">
      {/* Modal */}
      {(showModal || editAssistant) && (
        <AssistentModal
          assistant={editAssistant}
          authHeader={authHeader}
          onClose={() => { setShowModal(false); setEditAssistant(null); }}
          onSaved={() => { setShowModal(false); setEditAssistant(null); fetchAssistants(); }}
        />
      )}

      {/* Header */}
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Assistentes</h1>
          <p className="mt-0.5 text-sm text-slate-500">Gestão da equipa e acessos ao painel</p>
        </div>
        <button
          onClick={() => { setEditAssistant(null); setShowModal(true); }}
          className="flex items-center gap-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo assistente
        </button>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && assistants.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <svg className="w-7 h-7 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assistants.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-4 rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-5"
            >
              {/* Avatar */}
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-base font-bold text-slate-200">
                {a.nome.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-white">{a.nome}</p>
                  {a.isAdmin ? (
                    <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400">Admin</span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-slate-500 capitalize">
                  {FUNCAO_LABELS[a.funcao] ?? a.funcao}
                  {a.funcao === "assistente"
                    ? <span className="text-[#00B4D8]/70"> · Pag. por trabalho</span>
                    : <> · {a.valorHora}€/h</>
                  }
                </p>
                <p className="mt-1 text-[11px] text-sky-400/80">
                  {a.activePedidos > 0 ? `${a.activePedidos} pedido${a.activePedidos !== 1 ? "s" : ""} activo${a.activePedidos !== 1 ? "s" : ""}` : "Sem pedidos activos"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => setEditAssistant(a)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] transition"
                  title="Editar"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button
                  onClick={() => handleDelete(a.id, a.nome)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-500 hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/10 transition"
                  title="Remover"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {assistants.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center rounded-[24px] border border-white/[0.06] bg-white/[0.02] py-20 text-center">
          <svg className="mb-3 w-12 h-12 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm font-medium text-slate-400">Ainda sem assistentes</p>
          <p className="mt-1 text-xs text-slate-600">Crie o primeiro utilizador para começar.</p>
        </div>
      )}
    </div>
  );
}
