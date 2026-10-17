"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { trackCTAClick } from "@/lib/analytics";

/*
 * «QUAL É O SEU CASO?» — 17-10-2026, decisão do dono (opção 2).
 *
 * Por baixo da grelha, as mesmas linhas como escolha: toca-se na que se
 * parece com a obra e aparece a referência dessa linha e o pedido logo ao
 * lado, com o simulador já em «Recolha de entulho».
 *
 * NÃO É UMA CALCULADORA, e de propósito. A 18-09 ficou que o cliente não vê
 * um preço calculado — vê referências e recebe a proposta. Por isso aqui não
 * se faz conta nenhuma: as linhas chegam da página, que as tira de
 * `precos-publicos.ts`, e saem tal e qual. Um número que não esteja na grelha
 * não pode aparecer aqui.
 */

export type LinhaDeEntulho = {
  service: string;
  priceFrom: string;
  priceTo?: string;
  description: string;
};

/** «110 – 120 € + IVA», «desde 330 € + IVA» ou o texto da linha, se não for preço. */
export function referenciaDaLinha(l: LinhaDeEntulho): string {
  if (!/\d/.test(l.priceFrom)) return l.priceFrom;
  if (l.priceTo) return `${l.priceFrom.replace(/\s*€$/, "")} – ${l.priceTo} + IVA`;
  return `desde ${l.priceFrom} + IVA`;
}

export const PEDIR_ENTULHO = "/simulador?servico=recolha_entulho";

export default function EscolhaDoCaso({ linhas }: { linhas: LinhaDeEntulho[] }) {
  const [escolhida, setEscolhida] = useState(0);
  const linha = linhas[escolhida];

  return (
    <div className="mt-8 rounded-[24px] border border-slate-200 bg-white p-5 sm:p-7">
      <h3 className="text-lg font-bold text-tinta">Qual é o seu caso?</h3>
      <p className="mt-1 text-sm text-slate-600">Toque no que mais se parece com a sua obra.</p>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Quantidade de entulho">
        {linhas.map((l, i) => (
          <button
            key={l.service}
            type="button"
            aria-pressed={i === escolhida}
            onClick={() => setEscolhida(i)}
            className={`min-h-[44px] rounded-full border px-4 text-sm font-medium transition ${
              i === escolhida
                ? "border-acao bg-acao text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-acao"
            }`}
          >
            {l.service}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-4 rounded-[18px] bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite">
          <p className="text-sm text-slate-600">{linha.description}</p>
          <p className="mt-1 text-xl font-bold text-tinta">{referenciaDaLinha(linha)}</p>
          <p className="mt-1 text-xs text-slate-500">
            Referência. O preço certo vem na proposta, já com IVA, antes de começar.
          </p>
        </div>
        <Link
          href={PEDIR_ENTULHO}
          onClick={() => trackCTAClick("Pedir proposta de entulho", `escolha:${linha.service}`)}
          className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl bg-acao px-5 text-sm font-semibold text-white hover:bg-acao-hover"
        >
          Pedir proposta
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
