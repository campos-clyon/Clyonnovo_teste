"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { MENSAGENS_DA_FATURA, TAMANHO_MAXIMO_DA_FATURA, tipoDaFaturaAceite } from "@/lib/faturas-do-trabalho";

/**
 * A FATURA DO TRABALHO, NO PAINEL — d10, o modelo de 15-11-2026 (paridade com a
 * app CLYON Pro, `FaturaDoTrabalho.tsx`).
 *
 * Num trabalho contratado do modelo novo, o parceiro emite ao cliente a fatura do
 * trabalho e junta-a aqui (POST /api/profissionais/trabalho/fatura); a da taxa da
 * plataforma junta-a a CLYON. Quem diz se o trabalho é do modelo novo é o
 * servidor (`novoModelo` da mesma rota): antes da data, nada se desenha.
 */
type Faturas = {
  novoModelo: boolean;
  daTaxa: { url: string; nome: string | null } | null;
  doTrabalho: { url: string; nome: string | null } | null;
};

export default function FaturaDoTrabalho({ negociacaoId }: { negociacaoId: number }) {
  const [faturas, setFaturas] = useState<Faturas | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState(false);

  const ler = useCallback(async () => {
    try {
      const r = await fetch(`/api/profissionais/trabalho/fatura?negociacaoId=${negociacaoId}`, { cache: "no-store" });
      if (r.ok) setFaturas((await r.json()) as Faturas);
    } catch {
      // Sem resposta, não se desenha nada: o resto do trabalho continua.
    }
  }, [negociacaoId]);

  useEffect(() => {
    void ler();
  }, [ler]);

  async function enviar(f: File | null) {
    setErro("");
    setFeito(false);
    if (!f) return setErro(MENSAGENS_DA_FATURA.semFicheiro);
    if (f.size > TAMANHO_MAXIMO_DA_FATURA) return setErro(MENSAGENS_DA_FATURA.grande);
    if (!tipoDaFaturaAceite(f.type)) return setErro(MENSAGENS_DA_FATURA.tipo);
    setAEnviar(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`/api/profissionais/trabalho/fatura?negociacaoId=${negociacaoId}`, { method: "POST", body: fd });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) return setErro(j.error ?? MENSAGENS_DA_FATURA.falhou);
      setFeito(true);
      await ler();
    } catch {
      setErro(MENSAGENS_DA_FATURA.falhou);
    } finally {
      setAEnviar(false);
    }
  }

  if (!faturas?.novoModelo) return null;
  return (
    <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
      <p className="font-semibold text-slate-900">As duas faturas deste trabalho</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        A do trabalho é sua: emita-a ao cliente e junte-a aqui. A da taxa da plataforma junta-a a CLYON.
      </p>
      <ul className="mt-2 space-y-1 text-xs">
        <li>
          A do trabalho:{" "}
          {faturas.doTrabalho ? (
            <a href={faturas.doTrabalho.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-acao underline">
              ver
            </a>
          ) : (
            <span className="font-semibold text-amber-700">por juntar</span>
          )}
        </li>
        <li>
          A da taxa da plataforma:{" "}
          {faturas.daTaxa ? (
            <a href={faturas.daTaxa.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-acao underline">
              ver
            </a>
          ) : (
            <span className="text-slate-500">a CLYON junta-a ao pedido</span>
          )}
        </li>
      </ul>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:border-cyan-500">
        {aEnviar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {faturas.doTrabalho ? "Trocar a fatura do trabalho" : "Juntar a fatura do trabalho"}
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={aEnviar}
          onChange={(e) => void enviar(e.target.files?.[0] ?? null)}
        />
      </label>
      {feito && <p className="mt-2 text-xs text-emerald-700">Fatura junta ao pedido. O cliente já a pode ver.</p>}
      {erro && <p className="mt-2 text-xs text-red-700">{erro}</p>}
    </section>
  );
}
