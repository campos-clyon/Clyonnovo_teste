import Link from "next/link";
import { linkDeWhatsApp } from "@/lib/link-de-whatsapp";
import { TELEFONE_DA_CLYON } from "@/lib/telefone-da-clyon";
import { pedirNoSimulador } from "@/lib/servico-na-ligacao";
import { HA_UM_PROBLEMA, mensagemDoProblema } from "@/lib/frases-do-pedido";

/**
 * «HÁ UM PROBLEMA» E «PEDIR OUTRA VEZ», TAMBÉM NO SITE — 29-10-2026 (S21).
 *
 * A app de cliente tinha os dois e o site não (matriz B1, «A MAIS NA APP»).
 * O primeiro abre o WhatsApp da CLYON com o número do pedido; o segundo abre o
 * simulador com o mesmo serviço já escolhido.
 */
export function textoDoProblema(pedidoId: number): string {
  // A mesma frase da app (d8, 31-10-2026): frases-do-pedido.ts.
  return mensagemDoProblema(pedidoId);
}

export default function AjudaDoPedido({ pedidoId, servico }: { pedidoId: number; servico: string | null }) {
  const whatsapp = linkDeWhatsApp(TELEFONE_DA_CLYON, textoDoProblema(pedidoId));
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800"
        >
          {HA_UM_PROBLEMA}
        </a>
      )}
      <Link
        href={pedirNoSimulador(servico)}
        className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800"
      >
        Pedir outra vez
      </Link>
    </div>
  );
}
