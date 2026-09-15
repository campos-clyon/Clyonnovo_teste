"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Mail, RefreshCw, Send, Trash2, X } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { TIPOS_DE_VEICULO, etiquetaDoVeiculo } from "@/lib/convite-profissional";
import AdminCandidaturasPanel from "@/components/admin/AdminCandidaturasPanel";

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
  /*
   * Os que estão marcados para apagar.
   *
   * "Coloque a opção marcar vários aqui, quero poder apagar vários" —
   * 15-09-2026. Anular deixava o convite na lista com outra etiqueta, e a
   * lista só crescia: dos oito que lá estavam, seis eram de gente que já se
   * tinha inscrito havia semanas.
   */
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [aApagar, setAApagar] = useState(false);

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

  function alternar(id: number) {
    setMarcados((antes) => {
      const novo = new Set(antes);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function marcarTodos() {
    setMarcados((antes) =>
      antes.size === convites.length ? new Set() : new Set(convites.map((c) => c.id)),
    );
  }

  /**
   * Apagar os marcados, de vez.
   *
   * O `confirm` é o mesmo da mesa dos pedidos, e diz o que se perde: um
   * convite apagado não se recupera, mas quem já se inscreveu por ele fica
   * onde está. É a pergunta que toda a gente faz antes de carregar, e é a
   * única forma de a responder antes de ser tarde.
   */
  async function apagarMarcados() {
    if (!token || marcados.size === 0) return;
    const quantos = marcados.size;
    if (
      !confirm(
        `Apagar ${quantos} convite${quantos === 1 ? "" : "s"}?\n\n` +
          `Saem da lista para sempre. Quem já se inscreveu continua registado ` +
          `como profissional — o que desaparece é o convite por onde entrou.`,
      )
    ) {
      return;
    }
    setAApagar(true);
    setErro("");
    try {
      const res = await fetch("/api/admin/convites", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accao: "apagar", ids: [...marcados] }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível apagar.");
        return;
      }
      setMarcados(new Set());
      await carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAApagar(false);
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
      {/* Quem se candidatou pelo site vem primeiro: é a fila que se esvazia. */}
      <AdminCandidaturasPanel />

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

      {/*
        MARCAR TODOS — só aparece quando há lista para marcar.

        Fica em cima, alinhado com as caixas das linhas, para se perceber de
        relance que a coluna da esquerda é de selecção e não de estado.
      */}
      {convites.length > 0 && (
        <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 text-xs text-slate-400 hover:text-slate-200">
          <input
            type="checkbox"
            checked={marcados.size === convites.length}
            onChange={marcarTodos}
            className="h-4 w-4 cursor-pointer accent-cyan-500"
          />
          {marcados.size === convites.length ? "Desmarcar todos" : "Marcar todos"}
        </label>
      )}

      {/*
        A barra só existe quando há algo marcado — um botão de apagar sempre à
        vista é um botão de apagar à espera de um clique distraído. É a mesma
        barra da mesa dos pedidos, de propósito: quem aprendeu a usar uma sabe
        usar a outra.
      */}
      {marcados.size > 0 && (
        <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-3 backdrop-blur">
          <p className="text-sm font-semibold text-slate-100">
            {marcados.size} convite{marcados.size === 1 ? "" : "s"} seleccionado
            {marcados.size === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMarcados(new Set())}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60"
            >
              Desmarcar
            </button>
            <button
              onClick={apagarMarcados}
              disabled={aApagar}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {aApagar ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Apagar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {convites.map((c) => (
          <article
            key={c.id}
            className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
              marcados.has(c.id)
                ? "border-cyan-600/60 bg-cyan-500/5"
                : "border-slate-700/60 bg-slate-900/60"
            }`}
          >
            <input
              type="checkbox"
              checked={marcados.has(c.id)}
              onChange={() => alternar(c.id)}
              aria-label={`Marcar o convite de ${c.nome}`}
              className="h-4 w-4 cursor-pointer accent-cyan-500"
            />
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
