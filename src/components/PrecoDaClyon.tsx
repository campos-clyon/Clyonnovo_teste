"use client";

import { useState } from "react";
import { aceitouOPrecoNaData } from "@/lib/frases-do-pedido";
import type { PrecoClyonNoEcra } from "@/lib/preco-clyon-para-o-cliente";

/**
 * O PREÇO DE UM TRABALHO CLYON, NO SITE — 29-10-2026 (S20, P8 (a)).
 *
 * O mesmo preço e o mesmo «Aceito este preço» que a app de cliente já tinha
 * (S7), agora também no link do pedido e na conta. A acção vai pela mesma
 * `agirComoCliente` (`aceitar_preco_clyon`), com a versão do preço que se viu:
 * se a CLYON o mudou entretanto, o aceite não passa.
 */
export default function PrecoDaClyon({
  preco,
  enviarPara,
  podeAceitar,
  pedidoId,
}: {
  preco: PrecoClyonNoEcra;
  /** A rota da acção: `/api/negociacao/<token>` no link, `/api/users/me/negociacao` na conta. */
  enviarPara: string | null;
  podeAceitar: boolean;
  /** Na conta, o pedido. */
  pedidoId?: number;
}) {
  const [aceiteEm, setAceiteEm] = useState(preco.aceiteEmTexto);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aceitar() {
    if (!enviarPara) return;
    setAEnviar(true);
    setErro(null);
    try {
      const r = await fetch(enviarPara, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accao: "aceitar_preco_clyon", versao: preco.versao, ...(pedidoId ? { pedidoId } : {}) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Não foi possível guardar. Tente outra vez.");
      setAceiteEm("agora");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível guardar. Tente outra vez.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-tinta-fraca">O preço da CLYON</p>
      <p className="mt-1 text-2xl font-bold text-tinta">{preco.principal}</p>
      <p className="mt-1 text-sm text-slate-600">{preco.detalhe}</p>
      {preco.nota && <p className="mt-1 text-xs text-slate-500">{preco.nota}</p>}
      {aceiteEm ? (
        <p className="mt-4 text-sm font-semibold text-emerald-700">
          {aceitouOPrecoNaData(aceiteEm)} A CLYON escolhe o parceiro que vai fazer o trabalho.
        </p>
      ) : podeAceitar && enviarPara ? (
        <button
          type="button"
          disabled={aEnviar}
          onClick={() => void aceitar()}
          className="mt-4 w-full rounded-xl bg-acao px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {aEnviar ? "A guardar…" : "Aceito este preço"}
        </button>
      ) : null}
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </section>
  );
}
