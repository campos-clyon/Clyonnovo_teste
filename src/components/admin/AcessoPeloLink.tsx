"use client";

import { useEffect, useState } from "react";

/**
 * «ABERTO PELO LINK EM N TELEMÓVEIS» E «CORTAR O ACESSO PELO LINK» — 29-10-2026
 * (S16, R11 e R24 da Segurança). Um link que se suspeite reencaminhado trata-se
 * só daqui: as sessões de convidado morrem e o link roda. O link novo aparece
 * para a equipa o mandar a quem é o dono do pedido.
 */
export default function AcessoPeloLink({ pedidoId, authHeader }: { pedidoId: number; authHeader: Record<string, string> }) {
  const [telemoveis, setTelemoveis] = useState<Array<{ prova: string; abertoEmTexto: string | null }>>([]);
  const [linkNovo, setLinkNovo] = useState<string | null>(null);
  const [aCortar, setACortar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cabecalho = JSON.stringify(authHeader);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/admin/pedidos/${pedidoId}/link`, { headers: JSON.parse(cabecalho) })
      .then((r) => r.json())
      .then((d) => {
        if (vivo && Array.isArray(d?.telemoveis)) setTelemoveis(d.telemoveis);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [pedidoId, cabecalho]);

  async function cortar() {
    if (!window.confirm("Cortar o acesso pelo link?\n\nOs telemóveis que o abriram deixam de ver o pedido, e o link antigo deixa de abrir também no site. Fica um link novo para enviar ao cliente.")) return;
    setACortar(true);
    setErro(null);
    try {
      const r = await fetch(`/api/admin/pedidos/${pedidoId}/link`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ accao: "cortar" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Não foi possível cortar o acesso.");
      setTelemoveis([]);
      setLinkNovo(d.link ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cortar o acesso.");
    } finally {
      setACortar(false);
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 space-y-2">
      <p>
        {telemoveis.length === 0
          ? "O link do pedido não está aberto na app em nenhum telemóvel."
          : `Aberto pelo link em ${telemoveis.length} ${telemoveis.length === 1 ? "telemóvel" : "telemóveis"}: ${telemoveis
              .map((t) => `${t.prova}… (${t.abertoEmTexto ?? "—"})`)
              .join(", ")}.`}
      </p>
      <p className="text-slate-500">Se suspeitar que o link foi reencaminhado, corte o acesso aqui (reenviar o link não desliga os telemóveis).</p>
      <button type="button" disabled={aCortar} onClick={() => void cortar()}
        className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-800 disabled:opacity-50">
        Cortar o acesso pelo link
      </button>
      {linkNovo && (
        <p className="break-all">
          Link novo: <span className="font-mono">{linkNovo}</span>
        </p>
      )}
      {erro && <p className="text-red-600">{erro}</p>}
    </div>
  );
}
