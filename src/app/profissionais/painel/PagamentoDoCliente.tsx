"use client";

import { useState } from "react";
import type { PagamentoParaOParceiro } from "@/lib/pagamento-registado-para-o-parceiro";
import { diaMesEmLisboa } from "@/lib/hora-de-lisboa";

/**
 * «O CLIENTE PAGOU-LHE?» — d3 (CEO e dono, 23-11-2026). No trabalho contratado do
 * modelo de 15-11: o que o cliente disse («O cliente diz que lhe pagou … por ….
 * Recebeu?») com «Sim, recebi» / «Ainda não recebi», ou «O cliente já me pagou»
 * quando ele ainda não disse nada. A CLYON só regista: o dinheiro vai
 * diretamente para o parceiro. A frase e os botões vêm do servidor
 * (`pagamentoRegistado` de /api/profissionais/meus-pedidos); a app CLYON Pro lê o
 * mesmo objecto.
 */
export function PagamentoDoCliente({ negociacaoId, pagamento }: { negociacaoId: number; pagamento: PagamentoParaOParceiro }) {
  const [atual, setAtual] = useState(pagamento);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState("");

  async function responder(accao: "recebi" | "nao_recebi") {
    setAGravar(true);
    setErro("");
    try {
      const r = await fetch("/api/profissionais/trabalho/pagamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negociacaoId, accao }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; registo?: PagamentoParaOParceiro["registo"] };
      if (!r.ok || !j.registo) {
        setErro(j.error ?? "Não foi possível registar. Tente novamente.");
        return;
      }
      const registo = j.registo;
      setAtual(
        registo.pago
          ? { registo, texto: `Pago${registo.parceiroConfirmouEm ? ` · ${diaMesEmLisboa(new Date(registo.parceiroConfirmouEm))}` : ""}`, botoes: [] }
          : { registo, texto: "Disse que ainda não recebeu. Avisámos a equipa.", botoes: atual.botoes.filter((b) => b.accao === "recebi") },
      );
    } catch {
      setErro("Não foi possível registar. Tente novamente.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <h2 className="text-base font-bold text-slate-800">Pagamento do cliente</h2>
      {atual.texto && <p className="mt-1 leading-relaxed text-slate-700">{atual.texto}</p>}
      {atual.botoes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {atual.botoes.map((b) => (
            <button
              key={b.accao}
              type="button"
              disabled={aGravar}
              onClick={() => void responder(b.accao)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                b.accao === "recebi" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-800"
              }`}
            >
              {b.texto}
            </button>
          ))}
        </div>
      )}
      {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
      <p className="mt-2 text-xs text-slate-500">A CLYON só regista: o dinheiro vai diretamente para si, e a taxa da plataforma não muda.</p>
    </section>
  );
}
