import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { O_QUE_PODE_FAZER } from "@/lib/voz-da-vitoria";

/*
 * UM SERVIÇO QUE A CLYON NÃO FAZ DE MOMENTO — 27-10-2026.
 *
 * A montagem de móveis e a limpeza de quintais saíram do plano a 25-10-2026
 * (FORA_DO_PLANO): as páginas continuam a abrir para quem lá chega por um
 * link antigo, mas já não vendem nada. Dizem-no no topo, com as mesmas
 * palavras da Vitória, e dizem o que se pode pedir — sem preço e sem botão
 * para o simulador.
 */

export const NAO_FAZ_ESTE_SERVICO = "De momento a CLYON não faz este serviço.";

export default function ServicoForaDoPlano({ titulo }: { titulo: string }) {
  return (
    <div className="min-h-screen bg-white">
      <section className="secao bg-[#F4F8FB]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold leading-tight text-tinta sm:text-4xl">{titulo}</h1>
          <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-base font-semibold text-amber-900">
            {NAO_FAZ_ESTE_SERVICO}
          </p>
          <p className="mt-6 text-base leading-relaxed text-tinta-fraca sm:text-lg">
            Na CLYON pode pedir {O_QUE_PODE_FAZER}. Descreve o que precisa, os profissionais da
            zona enviam propostas e escolhe com quem quer trabalhar — a CLYON organiza o pedido e
            guarda o acordo e o pagamento.
          </p>
          <Link
            href="/servicos"
            className="mt-8 inline-flex items-center gap-2 text-base font-semibold text-acao underline-offset-2 hover:underline"
          >
            Ver os serviços
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
