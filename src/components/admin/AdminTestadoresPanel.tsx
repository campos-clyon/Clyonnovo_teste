"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, KeyRound, Loader2, RefreshCw, ShieldAlert, UserPlus } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * As contas do ambiente de testes.
 *
 * Cria-se a conta aqui e entrega-se a palavra-passe à pessoa por fora — o
 * sistema nunca a volta a mostrar, porque nunca a guarda: guarda o hash.
 *
 * Desactivar é o botão que interessa ter à mão. Quando um teste acaba, ou
 * quando um link chega a quem não devia, tira-se o acesso a uma pessoa sem
 * rodar a chave e sem expulsar as outras.
 */

type Testador = {
  id: number;
  nome: string;
  utilizador: string;
  papel: string;
  activo: boolean;
  ultimoAcesso: string | null;
  criadoPor: string | null;
  createdAt: string;
};

const CAIXA =
  "w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";

export default function AdminTestadoresPanel() {
  const { token, ready } = useAdminAuth();
  const [testadores, setTestadores] = useState<Testador[]>([]);
  const [portaoDePe, setPortaoDePe] = useState(true);
  const [aCarregar, setACarregar] = useState(true);
  const [ocupado, setOcupado] = useState<number | "novo" | null>(null);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");

  const [nome, setNome] = useState("");
  const [utilizador, setUtilizador] = useState("");
  const [palavraPasse, setPalavraPasse] = useState("");
  const [papel, setPapel] = useState("cliente");

  const carregar = useCallback(async () => {
    if (!token) return;
    setACarregar(true);
    try {
      const res = await fetch("/api/admin/testadores", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar.");
        return;
      }
      setTestadores(dados.testadores ?? []);
      setPortaoDePe(Boolean(dados.portaoDePe));
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
      const res = await fetch("/api/admin/testadores", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return false;
      }
      setFeito(dados.feito ?? "criado");
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
    const certo = await agir({ nome, utilizador, palavraPasse, papel }, "novo");
    if (certo) {
      setNome("");
      setUtilizador("");
      setPalavraPasse("");
    }
  }

  if (!ready || aCarregar) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div>
      {!portaoDePe && (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>O portão não está de pé.</strong> Falta a variável{" "}
            <code className="font-mono">CHAVE_MVP</code> (mínimo 16 caracteres) no
            ambiente. Sem ela ninguém entra — nem quem tiver credenciais.
          </span>
        </p>
      )}

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
          Nova conta de teste
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className={CAIXA}
            placeholder="Nome da pessoa"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <input
            className={CAIXA}
            placeholder="utilizador"
            value={utilizador}
            onChange={(e) => setUtilizador(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <input
            className={CAIXA}
            placeholder="palavra-passe (10+ caracteres)"
            value={palavraPasse}
            onChange={(e) => setPalavraPasse(e.target.value)}
          />
          <select className={CAIXA} value={papel} onChange={(e) => setPapel(e.target.value)}>
            <option value="cliente">vai testar como cliente</option>
            <option value="profissional">vai testar como profissional</option>
          </select>
        </div>
        <button
          onClick={criar}
          disabled={ocupado === "novo"}
          className="mt-3 flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
        >
          {ocupado === "novo" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Criar
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Anote a palavra-passe antes de criar: guardamos o hash e não há forma de a
          voltar a ler. Entregue-a à pessoa por fora, com o link que tem a chave.
        </p>
      </section>

      {/* ── Lista ─────────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {testadores.length} conta{testadores.length === 1 ? "" : "s"} de teste
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
        {testadores.map((t) => (
          <article
            key={t.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-white">{t.nome}</span>
                <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-xs text-slate-300">
                  {t.utilizador}
                </code>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                  {t.papel}
                </span>
                {!t.activo && (
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">
                    desactivado
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {t.ultimoAcesso
                  ? `entrou pela última vez a ${new Date(t.ultimoAcesso).toLocaleString("pt-PT")}`
                  : "nunca entrou"}
                {t.criadoPor ? ` · criado por ${t.criadoPor}` : ""}
              </p>
            </div>

            <button
              onClick={() => {
                const nova = window.prompt(`Nova palavra-passe para ${t.nome}:`);
                if (nova) agir({ id: t.id, palavraPasse: nova }, t.id);
              }}
              disabled={ocupado === t.id}
              className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              Trocar senha
            </button>

            <button
              onClick={() => agir({ id: t.id, activo: !t.activo }, t.id)}
              disabled={ocupado === t.id}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                t.activo
                  ? "border border-slate-600 text-slate-300 hover:bg-slate-800"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
              }`}
            >
              {t.activo ? "Desactivar" : "Reactivar"}
            </button>
          </article>
        ))}

        {testadores.length === 0 && (
          <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
            Ainda não há contas de teste. Crie a primeira acima — sem ela ninguém entra
            na plataforma, nem você.
          </p>
        )}
      </div>
    </div>
  );
}
