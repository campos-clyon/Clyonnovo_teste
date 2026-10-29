"use client";

import { useCallback, useEffect, useState } from "react";

type Alteracao = {
  pedidoId: number;
  servico: string;
  cidade: string | null;
  pedidaEmTexto: string | null;
  oQue: string;
  pormenores: string | null;
  fotografias: string[];
  porOnde: string | null;
};

const POR_ONDE: Record<string, string> = {
  app: "pela app",
  conta: "pela conta do site",
  link: "pelo link, no site",
  convidado: "pelo link, na app",
};

/**
 * «ALTERAÇÕES DO CLIENTE», NA MESA — 29-10-2026 (S17, P11 (a)). Nasce com
 * selo: o número de alterações à espera está no título. Só aparece quando há.
 * «Aplicar» passa pela edição (recomeça se o que os profissionais vêem mudou);
 * «Não aplicar» pede a frase que chega ao cliente.
 */
export default function AlteracoesDoCliente({ token }: { token: string | null }) {
  const [lista, setLista] = useState<Alteracao[]>([]);
  const [aEnviar, setAEnviar] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/alteracoes-do-cliente", { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(d.alteracoes)) setLista(d.alteracoes);
    } catch {
      /* sem rede: fica o que havia */
    }
  }, [token]);

  useEffect(() => {
    void ler();
    const t = setInterval(() => void ler(), 60_000);
    return () => clearInterval(t);
  }, [ler]);

  async function decidir(a: Alteracao, aplicar: boolean) {
    if (!token) return;
    let motivo: string | null = null;
    if (!aplicar) {
      motivo = window.prompt(`Porque não se aplica a alteração do #${a.pedidoId}? A frase chega ao cliente.`) ?? null;
      if (motivo === null) return;
    } else if (!window.confirm(`Aplicar a alteração do #${a.pedidoId}?\n\n${a.oQue}\n\nSe mudar o que os profissionais vêem, o pedido recomeça.`)) {
      return;
    }
    setAEnviar(a.pedidoId);
    try {
      const r = await fetch("/api/admin/alteracoes-do-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId: a.pedidoId, aplicar, motivo }),
      });
      const d = await r.json().catch(() => ({}));
      setAviso(r.ok ? `#${a.pedidoId}: ${aplicar ? "alteração aplicada" : "alteração não aplicada"}${d.recomecou ? " — o pedido recomeçou" : ""}.` : d.error ?? "Não foi possível.");
      await ler();
    } finally {
      setAEnviar(null);
    }
  }

  if (lista.length === 0 && !aviso) return null;
  return (
    <section className="mb-4 rounded-2xl border border-amber-300/40 bg-amber-500/5 p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-amber-200">
        Alterações do cliente
        {lista.length > 0 && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-slate-950">{lista.length}</span>
        )}
      </h3>
      {aviso && <p className="mt-2 text-xs text-amber-100">{aviso}</p>}
      <ul className="mt-3 space-y-2">
        {lista.map((a) => (
          <li key={a.pedidoId} className="rounded-xl border border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-200">
            <p className="font-semibold">
              #{a.pedidoId} · {a.servico}
              {a.cidade ? ` · ${a.cidade}` : ""}
              <span className="font-normal text-slate-400">
                {" "}
                · pedida {a.porOnde ? POR_ONDE[a.porOnde] ?? "" : ""} {a.pedidaEmTexto ? `a ${a.pedidaEmTexto}` : ""}
              </span>
            </p>
            <p className="mt-1">{a.oQue}</p>
            {a.pormenores && <p className="mt-1 whitespace-pre-line text-slate-300">«{a.pormenores}»</p>}
            {a.fotografias.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {a.fotografias.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="underline">
                    ver ficheiro
                  </a>
                ))}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={aEnviar === a.pedidoId} onClick={() => void decidir(a, true)}
                className="rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-slate-950 disabled:opacity-40">Aplicar</button>
              <button type="button" disabled={aEnviar === a.pedidoId} onClick={() => void decidir(a, false)}
                className="rounded-lg border border-slate-600 px-3 py-1.5 font-semibold text-slate-200 disabled:opacity-40">Não aplicar</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
