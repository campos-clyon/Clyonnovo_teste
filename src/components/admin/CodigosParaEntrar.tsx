"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, PenLine, Sparkles } from "lucide-react";

/**
 * OS CÓDIGOS PARA ENTRAR — d75, 20-11-2026.
 *
 * O backoffice entra com um só campo, «Código para entrar». Cada pessoa tem o
 * seu, e é o administrador quem os cria e troca, aqui — o dele incluído.
 *
 * «Gerar código» pede ao servidor um código forte aleatório, que aparece UMA
 * vez para copiar: depois de fechado, ninguém o volta a ver (guarda-se só o
 * hash). Também se pode escrever um à mão; o servidor confere a regra e que
 * não há outro igual. Trocar o código de alguém fecha as sessões dessa
 * pessoa; trocar o próprio dá logo uma sessão nova, para não sair a meio.
 */

type Conta = {
  id: number;
  nome: string;
  papel: "admin" | "assistente";
  activo: boolean;
  temCodigo: boolean;
  codigoMudadoEm: string | null;
};

type LinhaDoRegisto = { contaNome: string; porNome: string | null; accao: string; em: string };

const CAIXA =
  "w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";

function quando(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-PT", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACCAO: Record<string, string> = { criado: "criou o código de", trocado: "trocou o código de", anulado: "anulou o código de" };

/** O código gerado, mostrado uma vez, com o botão de copiar. */
export function CodigoMostradoUmaVez({
  nome,
  codigo,
  aoFechar,
}: {
  nome: string;
  codigo: string;
  aoFechar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }
  return (
    <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4" role="alert">
      <p className="text-sm font-semibold text-amber-100">Código para entrar de {nome}</p>
      <p className="mt-1 text-xs text-amber-200/80">
        Copie-o agora e entregue-o à pessoa por um meio seguro. Depois de fechar, não se volta a ver.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="select-all break-all rounded-lg bg-slate-950 px-3 py-2 font-mono text-base text-white">
          {codigo}
        </code>
        <button
          type="button"
          onClick={copiar}
          className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
        >
          {copiado ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copiado ? "Copiado" : "Copiar"}
        </button>
        <button
          type="button"
          onClick={aoFechar}
          className="rounded-lg bg-acao px-3 py-2 text-xs font-semibold text-white hover:bg-acao-hover"
        >
          Já o guardei
        </button>
      </div>
    </div>
  );
}

export default function CodigosParaEntrar({
  token,
  meuId,
  versao = 0,
}: {
  token: string | null;
  meuId: number | null;
  /** Muda quando o painel das contas mexeu nalguma (criou, desactivou): relê. */
  versao?: number;
}) {
  const [contas, setContas] = useState<Conta[]>([]);
  const [registo, setRegisto] = useState<LinhaDoRegisto[]>([]);
  const [segredoPosto, setSegredoPosto] = useState(true);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [aEscrever, setAEscrever] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [mostrado, setMostrado] = useState<{ nome: string; codigo: string; propria: boolean } | null>(null);

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/assistentes?codigos=1", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar os códigos.");
        return;
      }
      setContas(dados.contas ?? []);
      setRegisto(dados.registo ?? []);
      setSegredoPosto(dados.segredoPosto !== false);
    } catch {
      setErro("Erro de rede.");
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar, versao]);

  async function definir(conta: Conta, corpo: { gerar: true } | { codigo: string }) {
    if (
      conta.temCodigo &&
      !window.confirm(`Trocar o código de ${conta.nome}? O antigo deixa de servir e as sessões abertas fecham-se.`)
    ) {
      return;
    }
    setOcupado(conta.id);
    setErro("");
    setFeito("");
    try {
      const res = await fetch("/api/admin/assistentes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ codigoDeEntrada: { id: conta.id, ...corpo } }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return;
      }
      // A própria sessão foi trocada por uma nova: guarda-se já, antes de mais nada.
      if (typeof dados.sessaoNova === "string") {
        try {
          localStorage.setItem("colaborador_token", dados.sessaoNova);
        } catch {
          /* sem localStorage, o cookie novo chega */
        }
      }
      setFeito(dados.feito ?? "Feito.");
      setAEscrever(null);
      setRascunho("");
      if (typeof dados.codigoGerado === "string") {
        setMostrado({ nome: conta.nome, codigo: dados.codigoGerado, propria: typeof dados.sessaoNova === "string" });
      } else if (typeof dados.sessaoNova === "string") {
        window.location.reload();
        return;
      }
      await carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  const activas = contas.filter((c) => c.activo);
  const semCodigo = activas.filter((c) => !c.temCodigo).length;

  return (
    <section className="mb-5 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        <KeyRound className="h-4 w-4 text-cyan-400" aria-hidden="true" />
        Códigos para entrar
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Cada pessoa entra em <code className="font-mono">clyon.pt/admin/login</code> só com o seu código. Mínimo 12
        caracteres, com maiúscula, minúscula, número e símbolo. Trocar um código fecha as sessões dessa pessoa.
        {semCodigo > 0
          ? ` Ainda ${semCodigo === 1 ? "há 1 conta" : `há ${semCodigo} contas`} sem código: enquanto houver, o ecrã de entrada mostra «Entrar com utilizador».`
          : activas.length > 0
            ? " Todas as contas ativas têm código."
            : ""}
      </p>

      {!segredoPosto && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          Falta a variável CODIGO_DE_ENTRADA_PEPPER na Vercel. Sem ela não se gravam códigos nem se entra com eles.
        </p>
      )}
      {erro && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{erro}</p>
      )}
      {feito && !mostrado && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {feito}
        </p>
      )}

      <div className="mt-3">
        {mostrado && (
          <CodigoMostradoUmaVez
            nome={mostrado.nome}
            codigo={mostrado.codigo}
            aoFechar={() => {
              const propria = mostrado.propria;
              setMostrado(null);
              // A sessão nova já está guardada; recarregar põe-na em todos os cartões.
              if (propria) window.location.reload();
            }}
          />
        )}
      </div>

      <ul className="mt-2 divide-y divide-slate-800">
        {contas.map((c) => (
          <li key={c.id} className="py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-semibold ${c.activo ? "text-white" : "text-slate-500"}`}>{c.nome}</span>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                {c.papel === "admin" ? "administrador" : "assistente"}
                {meuId === c.id ? " · a sua conta" : ""}
                {!c.activo ? " · desactivada" : ""}
              </span>
              <span className={`text-xs ${c.temCodigo ? "text-emerald-300" : "text-amber-300"}`}>
                {c.temCodigo ? `Tem código desde ${quando(c.codigoMudadoEm)}` : "Sem código"}
              </span>
              {c.activo && (
                <div className="ml-auto flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => definir(c, { gerar: true })}
                    disabled={ocupado === c.id || !segredoPosto}
                    className="flex items-center gap-1.5 rounded-lg bg-acao px-3 py-1.5 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
                  >
                    {ocupado === c.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Gerar código
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAEscrever(aEscrever === c.id ? null : c.id);
                      setRascunho("");
                    }}
                    disabled={ocupado === c.id || !segredoPosto}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                  >
                    <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                    Escrever código
                  </button>
                </div>
              )}
            </div>
            {aEscrever === c.id && (
              <form
                className="mt-2 flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void definir(c, { codigo: rascunho });
                }}
              >
                <input
                  className={`${CAIXA} max-w-sm font-mono`}
                  type="text"
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value)}
                  placeholder="Novo código (12+ caracteres)"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label={`Novo código para ${c.nome}`}
                />
                <button
                  type="submit"
                  disabled={ocupado === c.id || rascunho.trim().length === 0}
                  className="rounded-lg bg-acao px-3 py-2 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
                >
                  Guardar código
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      {registo.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-slate-400">Registo das trocas</summary>
          <ul className="mt-2 space-y-1 text-xs text-slate-400">
            {registo.map((r, i) => (
              <li key={i}>
                {quando(r.em)} · {r.porNome ?? "Sistema"} {ACCAO[r.accao] ?? r.accao} {r.contaNome}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
