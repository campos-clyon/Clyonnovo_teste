"use client";

import { useCallback, useEffect, useState } from "react";
import ContaDoPagamento from "@/components/ContaDoPagamento";
import type { ContaDoPagamento as Conta } from "@/lib/conta-do-pagamento";
import type { DeQuemEAFatura } from "@/lib/faturas-do-trabalho";
import { blocoDoTrabalhoFechado, juntaA, type LinhaDaFatura, type RespostaDasFaturas } from "@/lib/faturas-do-trabalho-no-ecra";

/**
 * A CONTA E AS DUAS FATURAS DO TRABALHO FECHADO, NO BACKOFFICE — d10, o modelo
 * de 15-11-2026; d49 (16-11-2026), um modelo só no cartão.
 *
 * Pergunta a `/api/admin/negociacoes/fatura` e é essa resposta que decide as
 * duas coisas (`blocoDoTrabalhoFechado`): no modelo novo, a «Conta do
 * pagamento» do modelo novo e o quadro das faturas; no antigo, a conta antiga
 * (`contaAntiga`, a que a Mesa calcula) e nenhum quadro. Nunca as duas
 * misturadas.
 */
type Fatura = { url: string; nome: string | null; carregadaEm?: string | null } | null;
type Dados = RespostaDasFaturas & { daTaxa: Fatura; doTrabalho: Fatura };

export default function FaturasDoTrabalho({
  negociacaoId,
  token,
  contaAntiga,
  marcadoNovoNaMesa,
}: {
  negociacaoId: number;
  token: string | null;
  contaAntiga: Conta | null;
  marcadoNovoNaMesa: boolean;
}) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [aEnviar, setAEnviar] = useState<DeQuemEAFatura | null>(null);
  const [erro, setErro] = useState("");

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`/api/admin/negociacoes/fatura?negociacaoId=${negociacaoId}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        setDados(await r.json());
        setFalhou(false);
      } else setFalhou(true);
    } catch {
      setFalhou(true);
    }
  }, [negociacaoId, token]);

  useEffect(() => {
    void ler();
  }, [ler]);

  async function enviar(ficheiro: File | undefined, deQuem: DeQuemEAFatura) {
    if (!ficheiro) return;
    setAEnviar(deQuem);
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
      setAEnviar(null);
    }
  }

  const bloco = blocoDoTrabalhoFechado(dados, contaAntiga, marcadoNovoNaMesa);

  if (bloco.aLer) {
    return (
      <p className="mt-2 text-xs text-slate-500">
        {falhou ? "Não foi possível ler a conta deste trabalho. Recarregue a página." : "A ler a conta do pagamento…"}
      </p>
    );
  }

  const linha = (l: LinhaDaFatura) => {
    const f = l.deQuem === "clyon" ? (dados?.daTaxa ?? null) : (dados?.doTrabalho ?? null);
    const quando = f ? juntaA(f.carregadaEm) : null;
    return (
      <li key={l.deQuem} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5 py-2 first:pt-0 last:pb-0">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-200">{l.nome}</p>
          <p className="tabular-nums text-white">{l.valorPorExtenso}</p>
          <p className="text-[11px] leading-4 text-slate-500">{l.quemJunta}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {f ? (
            <span className="text-xs text-esmeralda-texto">
              {quando ?? "Junta"} ·{" "}
              <a className="underline hover:text-white" href={f.url} target="_blank" rel="noopener noreferrer">
                abrir
              </a>
            </span>
          ) : (
            <span className="text-xs font-semibold text-ambar-texto">Por juntar</span>
          )}
          <label
            className={`cursor-pointer rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:text-white ${aEnviar ? "pointer-events-none opacity-60" : ""}`}
          >
            {aEnviar === l.deQuem ? "A enviar…" : f ? "Substituir fatura" : "Juntar fatura"}
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={aEnviar != null}
              onChange={(e) => {
                void enviar(e.target.files?.[0], l.deQuem);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </li>
    );
  };

  return (
    <>
      {bloco.conta ? (
        <div className="mt-2 sm:max-w-xl">
          <ContaDoPagamento conta={bloco.conta} />
        </div>
      ) : null}
      {bloco.faturas && bloco.faturas.length > 0 ? (
        <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2.5 text-sm sm:max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Faturas do trabalho</p>
          <p className="mb-2 text-[11px] leading-4 text-slate-500">
            O cliente paga ao parceiro; cada parte passa a sua fatura ao cliente. PDF ou imagem, até 6 MB.
          </p>
          <ul className="divide-y divide-slate-800">{bloco.faturas.map(linha)}</ul>
          {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}
        </div>
      ) : null}
    </>
  );
}
