"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Mail, RefreshCw, Send, X } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { TIPOS_DE_VEICULO, etiquetaDoVeiculo } from "@/lib/convite-profissional";

/**
 * Convidar um profissional.
 *
 * O caminho é: ele fala connosco, alguém toma nota do nome e do email, e daqui
 * sai o link do registo. Nome e email chegam — o telefone e o veículo pedem-se
 * porque quem atende já os tem à frente, e poupam-lhe campos no formulário.
 *
 * Quando o email não sai, o link em claro aparece aqui. É a única forma de lá
 * chegar: na base só existe o hash. Sem isto, um convite criado com o Resend
 * em baixo ficava perdido e ninguém percebia porquê.
 */

type Convite = {
  id: number;
  nome: string;
  email: string;
  telefone: string | null;
  tipoVeiculo: string | null;
  nota: string | null;
  estado: "por usar" | "usado" | "revogado" | "expirado";
  emailEnviado: boolean;
  expiraEm: string;
  usadoEm: string | null;
  criadoPor: string | null;
  createdAt: string;
};

const ESTADO_CLS: Record<string, string> = {
  "por usar": "bg-amber-500/15 text-amber-300",
  usado: "bg-emerald-500/15 text-emerald-300",
  revogado: "bg-slate-700 text-slate-400",
  expirado: "bg-red-500/15 text-red-300",
};

const CAIXA =
  "w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";

export default function AdminConvitesPanel() {
  const { token, ready } = useAdminAuth();
  const [convites, setConvites] = useState<Convite[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [ocupado, setOcupado] = useState<number | "novo" | null>(null);
  const [erro, setErro] = useState("");
  const [linkEmClaro, setLinkEmClaro] = useState("");
  const [linkDeEntrada, setLinkDeEntrada] = useState("");
  const [copiado, setCopiado] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [tipoVeiculo, setTipoVeiculo] = useState("");
  const [nota, setNota] = useState("");

  const carregar = useCallback(async () => {
    if (!token) return;
    setACarregar(true);
    try {
      const res = await fetch("/api/admin/convites", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar.");
        return;
      }
      setConvites(dados.convites ?? []);
      setLinkDeEntrada(dados.linkDeEntrada ?? "");
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
    setLinkEmClaro("");
    try {
      const res = await fetch("/api/admin/convites", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return false;
      }
      if (dados.link) setLinkEmClaro(dados.link);
      await carregar();
      return true;
    } catch {
      setErro("Erro de rede.");
      return false;
    } finally {
      setOcupado(null);
    }
  }

  async function convidar() {
    const certo = await agir({ nome, email, telefone, tipoVeiculo, nota }, "novo");
    if (certo) {
      setNome("");
      setEmail("");
      setTelefone("");
      setTipoVeiculo("");
      setNota("");
    }
  }

  if (!ready || aCarregar) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  const porUsar = convites.filter((c) => c.estado === "por usar").length;

  return (
    <div>
      {erro && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      {linkEmClaro && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-200">
            O email não saiu. Envie este link à pessoa por outro meio.
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-slate-950 px-2 py-1 font-mono text-[11px] text-slate-300">
              {linkEmClaro}
            </code>
            <button
              onClick={() => navigator.clipboard?.writeText(linkEmClaro)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              copiar
            </button>
          </div>
        </div>
      )}

      {/* ── A porta deles ─────────────────────────────────────────────────
          O endereço por onde um profissional entra na conta. Enquanto o MVP
          estiver fechado leva a chave lá dentro — sem ela dá 404, e quem o
          partilha não tem de se lembrar de a colar à mão. */}
      {linkDeEntrada && (
        <section className="mb-4 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <KeyRound className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            Link de entrada dos profissionais
          </h3>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-300">
              {linkDeEntrada}
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(linkDeEntrada);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              {copiado ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {copiado ? "copiado" : "copiar"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Para quem já tem conta. Curto e sem chave — dá para ditar ao telefone
            e não expira.
          </p>
        </section>
      )}

      {/* ── Convidar ──────────────────────────────────────────────────────── */}
      <section className="mb-5 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Send className="h-4 w-4 text-cyan-400" aria-hidden="true" />
          Convidar profissional
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Nome e email chegam. O telefone e o veículo, se os tiver à mão, poupam-lhe
          campos no formulário.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className={CAIXA}
            placeholder="Nome *"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <input
            className={CAIXA}
            placeholder="Email *"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoCapitalize="none"
          />
          <input
            className={CAIXA}
            placeholder="Telefone (opcional)"
            inputMode="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
          />
          <select
            className={CAIXA}
            value={tipoVeiculo}
            onChange={(e) => setTipoVeiculo(e.target.value)}
          >
            <option value="">Veículo (opcional)</option>
            {TIPOS_DE_VEICULO.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <input
          className={`${CAIXA} mt-2`}
          placeholder="Nota interna — quem o indicou, o que combinaram (não vai no email)"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />

        <button
          onClick={convidar}
          disabled={ocupado === "novo" || !nome.trim() || !email.trim()}
          className="mt-3 flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
        >
          {ocupado === "novo" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Mail className="h-4 w-4" aria-hidden="true" />
          )}
          Enviar convite
        </button>
      </section>

      {/* ── Lista ─────────────────────────────────────────────────────────── */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {porUsar > 0
            ? `${porUsar} convite${porUsar === 1 ? "" : "s"} à espera de resposta`
            : "Nenhum convite por usar."}
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
        {convites.map((c) => (
          <article
            key={c.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-white">{c.nome}</span>
                <span className="text-sm text-slate-400">{c.email}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    ESTADO_CLS[c.estado] ?? "bg-slate-700 text-slate-300"
                  }`}
                >
                  {c.estado}
                </span>
                {!c.emailEnviado && c.estado === "por usar" && (
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">
                    email não saiu
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {c.telefone ? `${c.telefone} · ` : ""}
                {c.tipoVeiculo ? `${etiquetaDoVeiculo(c.tipoVeiculo)} · ` : ""}
                {c.estado === "por usar"
                  ? `expira a ${new Date(c.expiraEm).toLocaleDateString("pt-PT")}`
                  : c.usadoEm
                    ? `inscreveu-se a ${new Date(c.usadoEm).toLocaleDateString("pt-PT")}`
                    : ""}
                {c.criadoPor ? ` · por ${c.criadoPor}` : ""}
              </p>
              {c.nota && <p className="mt-1 text-xs italic text-slate-500">{c.nota}</p>}
            </div>

            {c.estado !== "usado" && (
              <div className="flex gap-2">
                <button
                  onClick={() => agir({ accao: "reenviar", id: c.id }, c.id)}
                  disabled={ocupado === c.id}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  {ocupado === c.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Reenviar
                </button>
                {c.estado === "por usar" && (
                  <button
                    onClick={() => agir({ accao: "revogar", id: c.id }, c.id)}
                    disabled={ocupado === c.id}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Anular
                  </button>
                )}
              </div>
            )}

            {c.estado === "usado" && (
              <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            )}
          </article>
        ))}

        {convites.length === 0 && (
          <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
            Ainda não convidou ninguém. A inscrição não está aberta — é por aqui que entra
            um profissional novo.
          </p>
        )}
      </div>
    </div>
  );
}
