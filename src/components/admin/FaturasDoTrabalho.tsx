"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * AS DUAS FATURAS DO TRABALHO, NO BACKOFFICE — d10, o modelo de 15-11-2026.
 *
 * A equipa junta aqui a fatura da taxa da plataforma (feita à mão pela empresa
 * parceira) e vê a do parceiro. Pergunta a `/api/admin/negociacoes/fatura`; fora
 * do modelo novo (antes de 15-11, ou num trabalho do modelo antigo) não desenha
 * nada.
 */
type Fatura = { url: string; nome: string | null } | null;

export default function FaturasDoTrabalho({ negociacaoId, token }: { negociacaoId: number; token: string | null }) {
  const [dados, setDados] = useState<{ novoModelo: boolean; daTaxa: Fatura; doTrabalho: Fatura } | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");

  const ler = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/negociacoes/fatura?negociacaoId=${negociacaoId}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setDados(await r.json());
    } catch {
      // Sem resposta, nada a mostrar.
    }
  }, [negociacaoId, token]);

  useEffect(() => {
    void ler();
  }, [ler]);

  async function enviar(ficheiro: File | undefined, deQuem: "clyon" | "parceiro") {
    if (!ficheiro) return;
    setAEnviar(true);
    setErro("");
    try {
      const fd = new FormData();
      fd.append("file", ficheiro);
      const r = await fetch(`/api/admin/negociacoes/fatura?negociacaoId=${negociacaoId}&deQuem=${deQuem}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) setErro(j.error ?? "Não foi possível guardar a fatura.");
      await ler();
    } finally {
      setAEnviar(false);
    }
  }

  if (!token || !dados?.novoModelo) return null;
  const linha = (rotulo: string, f: Fatura, deQuem: "clyon" | "parceiro") => (
    <li className="flex flex-wrap items-center gap-2">
      <span className="font-medium">{rotulo}:</span>
      {f ? (
        <a className="underline" href={f.url} target="_blank" rel="noopener noreferrer">
          {f.nome ?? "abrir"}
        </a>
      ) : (
        <span className="text-slate-500">por juntar</span>
      )}
      <label className="cursor-pointer rounded-lg border border-slate-300 px-2 py-1 text-xs">
        {f ? "Substituir" : "Juntar"}
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={aEnviar}
          onChange={(e) => void enviar(e.target.files?.[0], deQuem)}
        />
      </label>
    </li>
  );
  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-sm sm:max-w-xl">
      <p className="font-semibold text-slate-900">Faturas do trabalho (o cliente pagou ao profissional)</p>
      <ul className="mt-2 space-y-1">
        {linha("Fatura da taxa da plataforma", dados.daTaxa, "clyon")}
        {linha("Fatura do profissional", dados.doTrabalho, "parceiro")}
      </ul>
      {erro && <p className="mt-2 text-red-700">{erro}</p>}
    </div>
  );
}
