import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { negociacaoDoLinkDoFecho, perguntaDoFechoNaBase } from "@/lib/fecho-do-modelo-novo-na-base";
import RespostaDoFecho from "@/components/RespostaDoFecho";

/**
 * «O TRABALHO JÁ FOI FEITO?» — a página do link do email (d15, 13-11-2026).
 *
 * Abrir a página não responde nada: a resposta é um toque num dos dois botões
 * (um POST). Não é indexável, e não mostra dados do pedido além do número.
 */
export const metadata: Metadata = {
  title: "O trabalho já foi feito?",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PaginaDoFecho({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const n = await negociacaoDoLinkDoFecho(token).catch(() => null);
  const pergunta = n ? await perguntaDoFechoNaBase({ negociacaoId: n.negociacaoId, pedidoId: n.pedidoId }) : null;

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md items-center px-4">
      <div className="w-full rounded-2xl border border-[#E2EEF3] bg-white p-6 text-center">
        {!n ? (
          <>
            <h1 className="text-lg font-bold text-tinta">Este link já não abre</h1>
            <p className="mt-2 text-sm leading-relaxed text-tinta-fraca">
              Pode ter expirado ou vindo partido do email. Se precisa de nos dizer alguma coisa sobre o trabalho,
              fale connosco.
            </p>
            <Link
              href="/contactos"
              className="mt-4 inline-flex rounded-xl border border-[#E2EEF3] px-5 py-2.5 text-sm font-semibold text-tinta"
            >
              Contactos
            </Link>
          </>
        ) : !pergunta ? (
          <>
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
            <h1 className="mt-3 text-lg font-bold text-tinta">Pedido #{n.pedidoId}</h1>
            <p className="mt-2 text-sm leading-relaxed text-tinta-fraca">
              Este trabalho já não está à espera desta resposta. Obrigado.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xs font-normal text-tinta-fraca">Pedido #{n.pedidoId}</h1>
            <RespostaDoFecho pergunta={pergunta} urlDaResposta={`/api/pedido/fecho/${encodeURIComponent(token)}`} />
          </>
        )}
      </div>
    </main>
  );
}
