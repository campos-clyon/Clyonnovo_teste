"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Loader2, RefreshCw, UserPlus } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * As contas de assistente, geridas pelo administrador.
 *
 * Um assistente entra em clyon.pt/admin/login com o nome e a palavra-passe
 * daqui e cai num painel só dele: pedidos, profissionais, negociações, agenda
 * e WhatsApp. Não vê o resto e não apaga nada.
 *
 * Cria-se a conta aqui e entrega-se a palavra-passe à pessoa por fora — o
 * sistema nunca a volta a mostrar, porque nunca a guarda: guarda o hash.
 * Desactivar fecha a porta no acto: a sessão dela deixa de valer na chamada
 * seguinte.
 */

type Assistente = {
  id: number;
  nome: string;
  activo: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

const CAIXA =
  "w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";

function dataCurta(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-PT");
}

export default function AdminAssistentesPanel() {
  const { token, ready } = useAdminAuth();
  const [assistentes, setAssistentes] = useState<Assistente[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [ocupado, setOcupado] = useState<number | "novo" | null>(null);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");

  const [nome, setNome] = useState("");
  const [palavraPasse, setPalavraPasse] = useState("");
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  const carregar = useCallback(async () => {
    if (!token) return;
    setACarregar(true);
    try {
      const res = await fetch("/api/admin/assistentes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar.");
        return;
      }
      setAssistentes(dados.assistentes ?? []);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    if (ready) carregar();
  }, [ready, carregar]);

  async function agir(corpo: Record<string, unknown>, quem: number | "novo") {
    setOcupado(quem);
    setErro("");
    setFeito("");
    try {
      const res = await fetch("/api/admin/assistentes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return false;
      }
      setFeito(dados.feito ?? "Feito.");
      await carregar();
      return true;
    } catch {
      setErro("Erro de rede.");
      return false;
    } finally {
      setOcupado(null);
    }
  }

  async function criar() {
    const certo = await agir({ nome, palavraPasse }, "novo");
    if (certo) {
      setNome("");
      setPalavraPasse("");
      setSenhaVisivel(false);
    }
  }

  function reporSenha(a: Assistente) {
    const nova = window.prompt(
      `Nova palavra-passe para ${a.nome} (mínimo 8 caracteres, com letra e número):`,
    );
    if (nova) agir({ id: a.id, palavraPasse: nova }, a.id);
  }

  function alternarEstado(a: Assistente) {
    if (
      a.activo &&
      !window.confirm(`Desactivar ${a.nome}? Deixa de conseguir entrar no painel de imediato.`)
    ) {
      return;
    }
    agir({ id: a.id, activo: !a.activo }, a.id);
  }

  if (!ready || aCarregar) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  const activos = assistentes.filter((a) => a.activo).length;

  return (
    <div>
      {erro && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}
      {feito && (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          <Check className="h-4 w-4" aria-hidden="true" />
          {feito}
        </p>
      )}

      {/* ── Criar ─────────────────────────────────────────────────────────── */}
      <section className="mb-5 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <UserPlus className="h-4 w-4 text-cyan-400" aria-hidden="true" />
          Nova conta de assistente
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className={`${CAIXA} uppercase`}
            placeholder="NOME (sem espaços)"
            value={nome}
            onChange={(e) => setNome(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
          />
          <div className="relative">
            <input
              className={`${CAIXA} pr-10`}
              type={senhaVisivel ? "text" : "password"}
              placeholder="palavra-passe (8+, letra e número)"
              value={palavraPasse}
              onChange={(e) => setPalavraPasse(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setSenhaVisivel((v) => !v)}
              aria-label={senhaVisivel ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              {senhaVisivel ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
        <button
          onClick={criar}
          disabled={ocupado === "novo" || nome.trim().length < 3 || palavraPasse.length < 8}
          className="mt-3 flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
        >
          {ocupado === "novo" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Criar assistente
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Entrega a palavra-passe à pessoa por fora — não voltamos a mostrá-la. Ela entra em{" "}
          <code className="font-mono">clyon.pt/admin/login</code> com este nome e vê só pedidos,
          profissionais, negociações, agenda e WhatsApp.
        </p>
      </section>

      {/* ── Lista ─────────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {assistentes.length} conta{assistentes.length === 1 ? "" : "s"}
          {assistentes.length > 0 ? ` · ${activos} activa${activos === 1 ? "" : "s"}` : ""}
        </p>
        <button
          onClick={carregar}
          className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Actualizar
        </button>
      </div>

      <div className="space-y-2">
        {assistentes.map((a) => (
          <article
            key={a.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-white">{a.nome}</span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                  assistente
                </span>
                {!a.activo && (
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">
                    desactivado
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                criado a {dataCurta(a.createdAt)}
                {a.updatedAt && a.updatedAt !== a.createdAt ? ` · alterado a ${dataCurta(a.updatedAt)}` : ""}
              </p>
            </div>

            <button
              onClick={() => reporSenha(a)}
              disabled={ocupado === a.id}
              className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              Repor senha
            </button>

            <button
              onClick={() => alternarEstado(a)}
              disabled={ocupado === a.id}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                a.activo
                  ? "border border-slate-600 text-slate-300 hover:bg-slate-800"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
              }`}
            >
              {ocupado === a.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : a.activo ? (
                "Desactivar"
              ) : (
                "Reactivar"
              )}
            </button>
          </article>
        ))}

        {assistentes.length === 0 && (
          <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
            Ainda não há assistentes. Crie a primeira conta acima.
          </p>
        )}
      </div>
    </div>
  );
}
