"use client";

import { useCallback, useEffect, useState } from "react";
import { CABECALHO_DO_TOKEN_DO_PAGAMENTO } from "@/lib/cabecalho-do-pagamento";

/**
 * PAGAR AO PARCEIRO — d10, o modelo de 15-11-2026 (`novo-modelo.ts`).
 *
 * Depois de contratar, num trabalho do modelo novo: o total (as duas faturas), o
 * tipo de fatura do parceiro, o IBAN e o MB WAY dele, a escolha de como paga e as
 * faturas já juntas. Pergunta tudo a `/api/pagamentos/ao-parceiro`, que decide;
 * fora do modelo novo (antes de 15-11, um trabalho já pago à CLYON, um Trabalho
 * CLYON) a resposta é `pagaAoParceiro: false` e este bloco não desenha nada.
 */

type Visto = {
  pagaAoParceiro: boolean;
  frase?: string;
  parceiro?: string;
  paraPagar?: { iban: string | null; titular: string | null; mbway: string | null } | null;
  perfilFiscal?: { fatura: string; guia: string | null };
  conta?: { semIva: number; total: number | null; faturaDoParceiro: number; faturaDaTaxa: number } | null;
  comoPagar?: string | null;
  opcoes?: Array<{ id: string; curta: string; cliente: string }>;
  faturas?: {
    frase: string;
    daTaxa: { url: string; nome: string | null } | null;
    doTrabalho: { url: string; nome: string | null } | null;
  };
};

const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

export default function PagarAoParceiro({
  pedidoId,
  negociacaoId,
  token,
  soParaVer = false,
}: {
  pedidoId: number;
  negociacaoId: number;
  token?: string | null;
  soParaVer?: boolean;
}) {
  const [visto, setVisto] = useState<Visto | null>(null);
  const [erro, setErro] = useState("");
  const [aGravar, setAGravar] = useState(false);
  const cabecalhos: Record<string, string> = token ? { [CABECALHO_DO_TOKEN_DO_PAGAMENTO]: token } : {};

  const ler = useCallback(async () => {
    try {
      const r = await fetch(`/api/pagamentos/ao-parceiro?pedidoId=${pedidoId}&negociacaoId=${negociacaoId}`, {
        cache: "no-store",
        headers: cabecalhos,
      });
      if (r.ok) setVisto((await r.json()) as Visto);
    } catch {
      // Sem resposta, não se mostra nada: o resto da página continua.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId, negociacaoId, token]);

  useEffect(() => {
    void ler();
  }, [ler]);

  async function escolher(id: string) {
    setAGravar(true);
    setErro("");
    try {
      const r = await fetch("/api/pagamentos/ao-parceiro", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cabecalhos },
        body: JSON.stringify({ pedidoId, negociacaoId, comoPagar: id }),
      });
      const j = (await r.json().catch(() => ({}))) as Visto & { error?: string };
      if (!r.ok) setErro(j.error ?? "Não foi possível guardar. Tente novamente.");
      else setVisto(j);
    } catch {
      setErro("Não foi possível guardar. Tente novamente.");
    } finally {
      setAGravar(false);
    }
  }

  if (!visto?.pagaAoParceiro) return null;
  const p = visto.paraPagar;
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <h3 className="text-base font-semibold text-slate-900">Pagar a {visto.parceiro}</h3>
      {visto.frase && <p className="mt-1">{visto.frase}</p>}
      {visto.conta?.total != null && (
        <p className="mt-3">
          Total: <strong>{euros(visto.conta.total)}</strong> com IVA ({euros(visto.conta.semIva)} sem IVA) — fatura do
          trabalho {euros(visto.conta.faturaDoParceiro)} e fatura da taxa da plataforma {euros(visto.conta.faturaDaTaxa)}.
        </p>
      )}
      {visto.perfilFiscal && (
        <p className="mt-1 text-slate-600">
          {visto.perfilFiscal.fatura}
          {visto.perfilFiscal.guia ? ` · ${visto.perfilFiscal.guia}` : ""}
        </p>
      )}
      {p && (
        <dl className="mt-3 grid gap-1">
          {p.iban && (
            <div>
              <dt className="inline text-slate-500">IBAN: </dt>
              <dd className="inline font-mono">{p.iban}</dd>
              {p.titular && <span className="text-slate-500"> ({p.titular})</span>}
            </div>
          )}
          {p.mbway && (
            <div>
              <dt className="inline text-slate-500">MB WAY: </dt>
              <dd className="inline font-mono">{p.mbway}</dd>
            </div>
          )}
        </dl>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Pague só para estes dados. Se alguém lhe pedir que pague para outra conta ou outro número, não pague e fale connosco.
      </p>
      {!soParaVer && visto.opcoes && visto.opcoes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {visto.opcoes.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={aGravar}
              onClick={() => void escolher(o.id)}
              aria-pressed={visto.comoPagar === o.id}
              className={`rounded-xl border px-3 py-2 text-sm ${
                visto.comoPagar === o.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-800"
              }`}
            >
              {o.curta}
            </button>
          ))}
        </div>
      )}
      {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
      {visto.faturas && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-slate-600">{visto.faturas.frase}</p>
          <ul className="mt-1 list-disc pl-5">
            <li>
              {visto.faturas.doTrabalho ? (
                <a className="underline" href={visto.faturas.doTrabalho.url} target="_blank" rel="noopener noreferrer">
                  Fatura do trabalho
                </a>
              ) : (
                "Fatura do trabalho: ainda não foi junta"
              )}
            </li>
            <li>
              {visto.faturas.daTaxa ? (
                <a className="underline" href={visto.faturas.daTaxa.url} target="_blank" rel="noopener noreferrer">
                  Fatura da taxa da plataforma
                </a>
              ) : (
                "Fatura da taxa da plataforma: ainda não foi junta"
              )}
            </li>
          </ul>
        </div>
      )}
    </section>
  );
}
