import { notFound } from "next/navigation";
import { getOrderByToken } from "@/lib/db";
import OrcamentoClient from "./OrcamentoClient";
import type { Metadata } from "next";
import { BUSINESS_PHONE } from "@/lib/seo-data";

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) return { title: "Orçamento não encontrado | CLYON" };
  return {
    title: `Orçamento CLYON #${order.id}`,
    description: "Consulte e confirme o seu orçamento personalizado CLYON.",
    robots: { index: false, follow: false },
  };
}

export default async function OrcamentoPage(
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) notFound();

  const o = order as any;

  const orderData = {
    id:                    order.id,
    serviceType:           order.serviceType ?? null,
    address:               order.address ?? null,
    city:                  order.city ?? null,
    description:           order.description ?? null,
    precoFinalIva:         o.precoFinalIva ? Number(o.precoFinalIva) : null,
    dataAgendada:          o.scheduledDate ?? o.dataAgendada ?? null,
    mensagemCliente:       o.mensagemCliente ?? null,
    status:                order.status ?? "aprovado",
    confirmadoPeloCliente: Boolean(o.confirmadoPeloCliente),
    canceladoPeloCliente:  Boolean(o.canceladoPeloCliente),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Header minimalista */}
      <header className="bg-white border-b border-slate-100 py-4 px-6">
        <div className="mx-auto max-w-lg flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-[#0077B6] tracking-tight">CLYON</span>
            <span className="ml-2 text-xs text-slate-400">Recolha &middot; Mudanca &middot; Esvaziamento</span>
          </div>
          <a
            href={`tel:${BUSINESS_PHONE}`}
            className="text-sm text-[#0077B6] font-medium hover:underline"
          >
            {BUSINESS_PHONE}
          </a>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="flex-1 flex items-start justify-center py-10 px-4">
        <div className="w-full max-w-lg">
          {/* Título */}
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0077B6] mb-2">
              O seu orçamento
            </p>
            <h1 className="text-3xl font-bold text-slate-900 text-balance">
              Confirme ou cancele o seu pedido
            </h1>
            <p className="mt-3 text-slate-500 text-base leading-relaxed max-w-md mx-auto">
              Analisámos o seu pedido e preparámos uma proposta. Confirme para avançar ou cancele se mudou de ideias.
            </p>
          </div>

          <OrcamentoClient token={token} order={orderData} />

          {/* Contactos */}
          <div className="mt-8 rounded-xl border border-slate-200 bg-white px-5 py-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Precisa de ajuda?</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={`https://wa.me/${BUSINESS_PHONE.replace(/[^\d]/g, "")}?text=${encodeURIComponent("Olá, tenho uma dúvida sobre o meu orçamento CLYON.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <svg className="h-4 w-4 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
              <a
                href={`tel:${BUSINESS_PHONE}`}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <svg className="h-4 w-4 text-[#0077B6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 7V5z" />
                </svg>
                Telefonar
              </a>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-slate-400">
        CLYON &copy; {new Date().getFullYear()} &mdash; Todos os direitos reservados
      </footer>
    </div>
  );
}
