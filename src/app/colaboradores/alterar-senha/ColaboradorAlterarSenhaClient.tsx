"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { getColaboradorItem } from "@/lib/colaborador-storage";

export default function ColaboradorAlterarSenhaClient() {
  const router = useRouter();
  const [nomeColaborador, setNomeColaborador] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const token = getColaboradorItem("token");
    const nome = getColaboradorItem("nome");

    if (!token) {
      router.push("/colaboradores");
      return;
    }

    setNomeColaborador(nome || "Colaborador");
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!senhaAtual || !novaSenha || !confirmacao) {
      setError("Preencha todos os campos.");
      return;
    }

    if (novaSenha.length < 4) {
      setError("A nova palavra-passe deve ter pelo menos 4 caracteres.");
      return;
    }

    if (novaSenha !== confirmacao) {
      setError("A confirmação da nova palavra-passe não coincide.");
      return;
    }

    const token = getColaboradorItem("token");
    if (!token) {
      router.push("/colaboradores");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/colaboradores/alterar-senha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          senhaAtual,
          novaSenha,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível alterar a palavra-passe.");
      }

      setSuccess("Palavra-passe alterada com sucesso.");
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmacao("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar a palavra-passe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_22%),linear-gradient(180deg,#f8fcff_0%,#eef7fb_100%)] px-4 pb-12 pt-24">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[32px] border border-cyan-100 bg-white/95 p-6 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.18)] backdrop-blur-sm sm:p-8">
          <button
            type="button"
            onClick={() => router.push("/colaboradores/dashboard")}
            className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao painel
          </button>

          <div className="mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
            <KeyRound className="h-6 w-6" />
          </div>

          <div className="mt-5">
            <div className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Segurança da conta
            </div>
            <h1 className="mt-4 text-3xl font-bold text-slate-950">Alterar palavra-passe</h1>
            <p className="mt-3 max-w-2xl text-base leading-8 text-slate-600">
              Atualize a palavra-passe de acesso de {nomeColaborador}. Depois de guardar, a nova palavra-passe
              fica activa de imediato.
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <PasswordField
              label="Palavra-passe actual"
              value={senhaAtual}
              onChange={setSenhaAtual}
              show={mostrarSenhaAtual}
              onToggle={() => setMostrarSenhaAtual((value) => !value)}
              autoComplete="current-password"
            />

            <PasswordField
              label="Nova palavra-passe"
              value={novaSenha}
              onChange={setNovaSenha}
              show={mostrarNovaSenha}
              onToggle={() => setMostrarNovaSenha((value) => !value)}
              autoComplete="new-password"
            />

            <PasswordField
              label="Confirmar nova palavra-passe"
              value={confirmacao}
              onChange={setConfirmacao}
              show={mostrarConfirmacao}
              onToggle={() => setMostrarConfirmacao((value) => !value)}
              autoComplete="new-password"
            />

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                {success}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-cyan-500 px-6 text-base font-semibold text-white shadow-[0_18px_40px_-22px_rgba(6,182,212,0.75)] transition hover:-translate-y-0.5 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  A guardar...
                </>
              ) : (
                "Guardar nova palavra-passe"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-950">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-14 w-full rounded-2xl border border-slate-200 px-4 pr-14 text-base text-slate-950 outline-none transition focus:border-cyan-400"
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
          aria-label={show ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
