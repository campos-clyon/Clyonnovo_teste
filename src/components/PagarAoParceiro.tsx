"use client";

import { useCallback, useEffect, useState } from "react";
import { CABECALHO_DO_TOKEN_DO_PAGAMENTO } from "@/lib/cabecalho-do-pagamento";
import { CRIAR_CONTA_PARA_PAGAR } from "@/lib/pagar-so-com-o-link";

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
  /** d4: quem só tem o link vê este cartão em vez dos dados de pagamento. */
  convidado?: boolean;
  cartao?: { titulo: string; texto: string };
  frase?: string;
  parceiro?: string;
  paraPagar?: { iban: string | null; titular: string | null; mbway: string | null } | null;
  /** O parceiro ainda sem IBAN nem MB WAY (d17): a frase em vez dos dados. */
  semDados?: string | null;
  /** Os dados de pagamento mudaram depois de o contratar (d28): a frase pronta, antes de transferir. */
  dadosMudaram?: string | null;
  perfilFiscal?: { fatura: string; guia: string | null };
  conta?: { semIva: number; total: number | null; faturaDoParceiro: number; faturaDaTaxa: number } | null;
  /** d6 (19-11-2026): a frase do total, escrita no servidor pelo regime do parceiro — a mesma da app de cliente. */
  totalEmTexto?: string | null;
  comoPagar?: string | null;
  opcoes?: Array<{ id: string; curta: string; cliente: string }>;
  faturas?: {
    frase: string;
    daTaxa: { url: string; nome: string | null } | null;
    doTrabalho: { url: string; nome: string | null } | null;
  };
};

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
  const [copiado, setCopiado] = useState<string | null>(null);
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

  async function copiar(valor: string) {
    try {
      await navigator.clipboard.writeText(valor.replaceAll(" ", ""));
      setCopiado(valor);
      setTimeout(() => setCopiado((c) => (c === valor ? null : c)), 2000);
    } catch {
      // Sem acesso à área de transferência, o número fica à vista para copiar à mão.
    }
  }

  if (!visto?.pagaAoParceiro) return null;
  if (visto.convidado && visto.cartao) {
    return (
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <h3 className="text-base font-semibold text-slate-900">{visto.cartao.titulo}</h3>
        <p className="mt-1">{visto.cartao.texto}</p>
        <a href="/entrar" className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
          {CRIAR_CONTA_PARA_PAGAR}
        </a>
      </section>
    );
  }
  const p = visto.paraPagar;
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <h3 className="text-base font-semibold text-slate-900">Pagar a {visto.parceiro}</h3>
      {visto.frase && <p className="mt-1">{visto.frase}</p>}
      {visto.totalEmTexto && <p className="mt-3 font-semibold text-slate-900">{visto.totalEmTexto}</p>}
      {visto.perfilFiscal && (
        <p className="mt-1 text-slate-600">
          {visto.perfilFiscal.fatura}
          {visto.perfilFiscal.guia ? ` · ${visto.perfilFiscal.guia}` : ""}
        </p>
      )}
      {visto.dadosMudaram && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-800">
          {visto.dadosMudaram}
        </p>
      )}
      {p && (
        <dl className="mt-3 grid gap-1">
          {p.iban && (
            <div>
              <dt className="inline text-slate-500">IBAN: </dt>
              <dd className="inline font-mono">{p.iban}</dd>
              <BotaoCopiar valor={p.iban} copiado={copiado} aoCopiar={copiar} />
              {p.titular && <span className="text-slate-500"> ({p.titular})</span>}
            </div>
          )}
          {p.mbway && (
            <div>
              <dt className="inline text-slate-500">MB WAY: </dt>
              <dd className="inline font-mono">{p.mbway}</dd>
              <BotaoCopiar valor={p.mbway} copiado={copiado} aoCopiar={copiar} />
            </div>
          )}
        </dl>
      )}
      {visto.semDados && <p className="mt-3 text-slate-700">{visto.semDados}</p>}
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

function BotaoCopiar({ valor, copiado, aoCopiar }: { valor: string; copiado: string | null; aoCopiar: (v: string) => void }) {
  return (
    <button type="button" onClick={() => aoCopiar(valor)} className="ml-2 rounded-lg border border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-700">
      {copiado === valor ? "Copiado" : "Copiar"}
    </button>
  );
}
