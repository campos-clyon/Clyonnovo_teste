import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, Lock } from "lucide-react";
import {
  negociacaoPorTokenHash,
  getSimulatorOrderById,
} from "@/lib/db";
import { hashDeToken, verificarTokenDeAcesso } from "@/lib/pedido-acesso";
import { vistaDoProfissional } from "@/lib/pedido-valores";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";
import type { Proposta } from "@/lib/negociacao";
import Nota from "@/components/Nota";
import NegociacaoProfissional from "./NegociacaoProfissional";

export const metadata: Metadata = {
  title: "Pedido — CLYON profissionais",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * O pedido, do lado de quem o vai fazer.
 *
 * Tudo o que aqui se mostra passa primeiro por `vistaDoProfissional`. Não é
 * zelo a mais: esta página tem acesso à linha inteira do pedido, onde estão o
 * valor máximo do cliente, a morada exacta e o contacto dele. Ler a linha e
 * escolher campos à mão no JSX funcionaria hoje e falharia no dia em que
 * alguém acrescentasse um campo e o passasse sem pensar.
 */

function propostasDe(json: string | null): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

function fotosDe(filesJson: unknown): Array<{ url: string; name?: string }> {
  if (typeof filesJson !== "string") return [];
  try {
    const l = JSON.parse(filesJson);
    return Array.isArray(l) ? l.filter((f) => f && typeof f.url === "string") : [];
  } catch {
    return [];
  }
}

export default async function PaginaDoPedidoProfissional({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const negociacao = await negociacaoPorTokenHash(hashDeToken(token));
  const acesso = verificarTokenDeAcesso(
    token,
    negociacao?.acessoTokenHash ?? null,
    negociacao?.acessoTokenExpiraEm ?? null,
  );

  if (!negociacao || (!acesso.valido && acesso.motivo !== "expirado")) notFound();

  if (!acesso.valido) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md items-center px-4">
        <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <Clock className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-bold text-amber-900">Este link expirou</h1>
          <p className="mt-2 text-sm text-amber-800">
            Os pedidos não ficam abertos para sempre. Se ainda estiver interessado,
            fale connosco.
          </p>
        </div>
      </main>
    );
  }

  const linha = await getSimulatorOrderById(negociacao.pedidoId);
  if (!linha) notFound();

  // A redução acontece aqui, uma vez, e é o que segue para o ecrã.
  const vista = vistaDoProfissional(linha as unknown as Record<string, unknown>);

  const servico =
    SERVICE_CATEGORIES.find((c) => c.id === vista.serviceType)?.label ??
    (vista.serviceType as string) ??
    "Serviço";
  const fotos = fotosDe(vista.filesJson);
  const minimo =
    vista.valorDesejadoCliente != null ? Number(vista.valorDesejadoCliente) : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Pedido #{negociacao.pedidoId}
        </span>
        <h1 className="mt-1 text-2xl font-bold text-[#0B1929] sm:text-3xl">{servico}</h1>
        {vista.city != null && (
          <p className="mt-1 text-sm text-slate-500">{String(vista.city)}</p>
        )}
      </header>

      <section className="rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">O trabalho</h2>

        {vista.description != null && (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {String(vista.description)}
          </p>
        )}

        <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
          {Boolean(vista.precisaFatura) && <li>· O cliente precisa de fatura</li>}
          {Boolean(vista.precisaGuiaTransporte) && (
            <li>· O cliente precisa de guia de transporte</li>
          )}
          {vista.floor != null && <li>· Andar: {String(vista.floor)}</li>}
          {vista.hasElevator != null && <li>· Elevador: {String(vista.hasElevator)}</li>}
        </ul>

        {fotos.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {fotos.length} {fotos.length === 1 ? "fotografia" : "fotografias"}
            </h3>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fotos.map((f, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={f.url}
                  alt={`Fotografia ${i + 1} do pedido`}
                  className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200"
                />
              ))}
            </div>
          </div>
        )}

        <Nota titulo="Morada e contacto: depois de ser contratado" icone={Lock} className="mt-5">
          Vê a zona para saber se lhe serve e quanto custa lá chegar. A morada
          exacta e o telefone do cliente chegam-lhe por email assim que ele o
          contratar — é o que impede que um pedido seja usado como lista de
          contactos.
        </Nota>
      </section>

      <NegociacaoProfissional
        token={token}
        estadoInicial={negociacao.estado}
        propostasIniciais={propostasDe(negociacao.propostasJson)}
        valorAcordado={negociacao.valorAcordado != null ? Number(negociacao.valorAcordado) : null}
        minimoDoCliente={minimo}
        recebeSeAceitar={minimo != null ? quantoOProfissionalRecebe(minimo) : null}
      />
    </main>
  );
}
