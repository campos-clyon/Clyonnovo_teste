"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, PenLine, Sparkles } from "lucide-react";

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
 *
 * d81, 21-11-2026: o bloco à parte «Códigos para entrar» saiu. O estado e os
 * dois botões passam para o cartão de cada pessoa na secção Assistentes
 * (`EstadoDoCodigo`), o registo das trocas para o «Gerir» de cada uma
 * (`RegistoDasTrocas`), e o texto da regra para um «?» (`TextoDosCodigos`).
 * O comportamento é o mesmo: `useCodigosParaEntrar` é o que o bloco fazia.
 */

export type ContaDoPainel = {
  id: number;
  nome: string;
  papel: "admin" | "assistente";
  activo: boolean;
  temCodigo: boolean;
  codigoMudadoEm: string | null;
};

export type LinhaDoRegisto = { contaNome: string; porNome: string | null; accao: string; em: string };

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

/** O texto da regra, para o «?» ao lado de «Código para entrar». */
export function TextoDosCodigos() {
  return (
    <>
      <p>
        Cada pessoa entra em <code className="font-mono">clyon.pt/admin/login</code> só com o seu código. Mínimo 12
        caracteres, com maiúscula, minúscula, número e símbolo.
      </p>
      <p className="mt-1.5">
        «Gerar código» mostra-o uma vez, para copiar; também se pode escrever um à mão. Trocar um código fecha as
        sessões dessa pessoa. Enquanto houver uma conta ativa sem código, o ecrã de entrada mostra «Entrar com
        utilizador».
      </p>
    </>
  );
}

export type CodigosParaEntrar = ReturnType<typeof useCodigosParaEntrar>;

/**
 * As contas do painel com o estado do código, o registo das trocas e a acção
 * de gerar ou escrever um — o que o bloco «Códigos para entrar» fazia.
 */
export function useCodigosParaEntrar(token: string | null, versao = 0) {
  const [contas, setContas] = useState<ContaDoPainel[]>([]);
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

  async function definir(conta: ContaDoPainel, corpo: { gerar: true } | { codigo: string }) {
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

  function fecharMostrado() {
    const propria = mostrado?.propria ?? false;
    setMostrado(null);
    // A sessão nova já está guardada; recarregar põe-na em todos os cartões.
    if (propria) window.location.reload();
  }

  return {
    contas,
    registo,
    segredoPosto,
    erro,
    feito,
    ocupado,
    aEscrever,
    setAEscrever,
    rascunho,
    setRascunho,
    mostrado,
    fecharMostrado,
    definir,
  };
}

/** No cartão de uma pessoa: «Tem código desde …» ou «Sem código», e os dois botões da d75. */
export function EstadoDoCodigo({ conta, codigos }: { conta: ContaDoPainel; codigos: CodigosParaEntrar }) {
  const { ocupado, segredoPosto, aEscrever, setAEscrever, rascunho, setRascunho, definir } = codigos;
  return (
    <div className="min-w-0">
      <p className={`text-xs ${conta.temCodigo ? "text-emerald-300" : "text-amber-300"}`}>
        {conta.temCodigo ? `Tem código desde ${quando(conta.codigoMudadoEm)}` : "Sem código"}
      </p>
      {conta.activo && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => definir(conta, { gerar: true })}
            disabled={ocupado === conta.id || !segredoPosto}
            className="flex items-center gap-1.5 rounded-lg bg-acao px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
          >
            {ocupado === conta.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Gerar código
          </button>
          <button
            type="button"
            onClick={() => {
              setAEscrever(aEscrever === conta.id ? null : conta.id);
              setRascunho("");
            }}
            disabled={ocupado === conta.id || !segredoPosto}
            aria-expanded={aEscrever === conta.id}
            className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
            Escrever código
          </button>
        </div>
      )}
      {aEscrever === conta.id && (
        <form
          className="mt-2 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void definir(conta, { codigo: rascunho });
          }}
        >
          <input
            className={`${CAIXA} max-w-xs font-mono`}
            type="text"
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            placeholder="Novo código (12+ caracteres)"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={`Novo código para ${conta.nome}`}
          />
          <button
            type="submit"
            disabled={ocupado === conta.id || rascunho.trim().length === 0}
            className="rounded-lg bg-acao px-3 py-2 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
          >
            Guardar código
          </button>
        </form>
      )}
    </div>
  );
}

/** As trocas do código de uma pessoa — dentro do «Gerir» dela (ou recolhidas no cartão do administrador). */
export function RegistoDasTrocas({ nome, registo }: { nome: string; registo: LinhaDoRegisto[] }) {
  const dela = registo.filter((r) => r.contaNome === nome);
  if (dela.length === 0) return null;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-slate-400 hover:text-slate-200">Registo das trocas ({dela.length})</summary>
      <ul className="mt-1.5 space-y-1 text-slate-400">
        {dela.map((r, i) => (
          <li key={i}>
            {quando(r.em)} · {r.porNome ?? "Sistema"} {ACCAO[r.accao] ?? r.accao} {r.contaNome}
          </li>
        ))}
      </ul>
    </details>
  );
}
