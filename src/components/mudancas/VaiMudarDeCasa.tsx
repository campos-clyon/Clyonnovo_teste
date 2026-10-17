import Link from "next/link";
import { ArrowRight, Truck } from "lucide-react";

import { PRECO_DA_MUDANCA_CURTO } from "@/lib/tabela-das-mudancas";

/**
 * «VAI MUDAR DE CASA?» — 17-10-2026.
 *
 * *«Agora faz as mudanças.»* — o dono, no plano feito a partir do raio-X da
 * Fixando. As mudanças estão na posição 31 do Search Console; as páginas de
 * monos, de móveis e de esvaziamento são as mais fortes do site (só os monos
 * tinham 12 mil impressões em 3 meses) e não tinham uma única ligação para
 * /mudancas. Quem deita fora móveis ou esvazia uma casa está, muitas vezes,
 * a mudar-se — e é daqui que a página das mudanças ganha força.
 */
export default function VaiMudarDeCasa() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-10 lg:px-8">
      <div className="flex flex-col gap-5 rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
            <Truck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Vai mudar de casa?</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
              O que fica vai na mudança; o que sai, numa recolha. As mudanças pagam-se à hora, pela tabela da
              CLYON: {PRECO_DA_MUDANCA_CURTO}.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 pl-15 text-sm font-semibold lg:shrink-0 lg:pl-0">
          <Link href="/mudancas" className="inline-flex items-center gap-1.5 text-emerald-700 hover:underline">
            Mudanças em Lisboa, Margem Sul e Setúbal <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/precos/mudancas" className="inline-flex items-center gap-1.5 text-emerald-700 hover:underline">
            Quanto custa uma mudança <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/pequenas-mudancas" className="inline-flex items-center gap-1.5 text-emerald-700 hover:underline">
            Pequenas mudanças <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
