import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, Link2, MapPin, Clock, FileText, Truck } from "lucide-react";
import { getSimulatorOrderByAcessoTokenHash, negociacoesDoPedido } from "@/lib/db";
import { hashDeToken, verificarTokenDeAcesso } from "@/lib/pedido-acesso";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import type { Proposta } from "@/lib/negociacao";
import { faseDoTrabalho, diasAteLibertar } from "@/lib/trabalho";
import Nota from "@/components/Nota";
import PropostasRecebidas from "./PropostasRecebidas";

/**
 * O pedido, aberto pelo link.
 *
 * Sem conta e sem palavra-passe — obrigar alguém a registar-se antes de ver o
 * próprio pedido é onde se perdem clientes. Convida-se a criar conta em todos
 * os ecrãs, nunca se obriga.
 *
 * O que esta página NÃO faz, de propósito:
 *
 *   · não é indexável. Um pedido no Google com morada e telefone dentro seria
 *     uma fuga de dados pessoais feita por nós;
 *   · não explica a plataforma em caixas fixas. As explicações estão em notas
 *     que se abrem — num telemóvel, cada parágrafo permanente empurra os
 *     botões para fora do ecrã.
 */

export const metadata: Metadata = {
  title: "O seu pedido — CLYON",
  robots: { index: false, follow: false },
};

// O token muda a cada pedido: nada aqui pode ser gerado à partida nem servido
// de cache partilhada.
export const dynamic = "force-dynamic";

const URGENCIA: Record<string, string> = {
  today: "Hoje",
  tomorrow: "Amanhã",
  this_week: "Esta semana",
  flexible: "Sem pressa",
};

function euros(valor: unknown): string | null {
  const n = typeof valor === "string" ? Number(valor) : typeof valor === "number" ? valor : NaN;
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2).replace(".", ",") + " €";
}

function propostasDe(json: string | null): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

function fotosDoPedido(filesJson: unknown): Array<{ url: string; name?: string }> {
  if (typeof filesJson !== "string") return [];
  try {
    const lista = JSON.parse(filesJson);
    if (!Array.isArray(lista)) return [];
    return lista.filter((f) => f && typeof f.url === "string");
  } catch {
    return [];
  }
}

export default async function PaginaDoPedido({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const pedido = await getSimulatorOrderByAcessoTokenHash(hashDeToken(token));
  const resultado = verificarTokenDeAcesso(
    token,
    pedido?.acessoTokenHash ?? null,
    pedido?.acessoTokenExpiraEm ?? null,
  );

  // Um link errado e um link expirado dão respostas diferentes ao cliente
  // porque a diferença lhe é útil — mas só depois de o token conferir. Quem
  // tenta à sorte cai sempre no notFound.
  if (!pedido || (!resultado.valido && resultado.motivo !== "expirado")) {
    notFound();
  }

  if (!resultado.valido) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md items-center px-4">
        <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <Clock className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-bold text-amber-900">Este link expirou</h1>
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            Os links de acesso duram 30 dias, por segurança. Fale connosco e enviamos
            um novo para o mesmo email.
          </p>
          <Link
            href="/contactos"
            className="mt-4 inline-flex rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Pedir novo link
          </Link>
        </div>
      </main>
    );
  }

  const servico =
    SERVICE_CATEGORIES.find((c) => c.id === pedido.serviceType)?.label ??
    pedido.serviceType ??
    "Serviço";

  // As negociações a decorrer. O cliente pode ter várias — é isso que torna o
  // segundo passo do aperto de mão necessário.
  const agora = new Date();
  const negociacoesDoCliente = (await negociacoesDoPedido(pedido.id)).map((n) => {
    const contratado = n.estado === "acordada";
    return {
      id: n.id,
      estado: n.estado,
      valorAcordado: n.valorAcordado != null ? Number(n.valorAcordado) : null,
      propostas: propostasDe(n.propostasJson),
      profissionalNome: n.profissionalNome,
      // O contacto do profissional só depois de o contratar — a simetria do que
      // fazemos com a morada do cliente do outro lado.
      profissionalTelefone: contratado ? (n.profissionalTelefone ?? null) : null,
      emiteFatura: Number(n.emiteFatura) === 1,
      regimeIva: String(n.regimeIva ?? "isento"),
      guiaVerificada: n.guiaVerificadaEm != null,
      fase: faseDoTrabalho(n),
      provaJson: n.provaJson ?? null,
      diasAteLibertar: diasAteLibertar(n, agora),
    };
  });

  const fotos = fotosDoPedido(pedido.filesJson);
  const desejado = euros(pedido.valorDesejadoCliente);
  const estimativa = euros(pedido.estimateTotal ?? pedido.estimateMax);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Pedido #{pedido.id}
        </span>
        <h1 className="mt-1 text-2xl font-bold text-[#0B1929] sm:text-3xl">{servico}</h1>
      </header>

      <PropostasRecebidas token={token} negociacoesIniciais={negociacoesDoCliente} />

      {/* Criar conta: convida, nunca obriga — e deixa de convidar quando
          fecham a nota. Repetir o convite a cada visita é insistência. */}
      <Nota
        titulo="Guarde este link — é como volta ao pedido"
        icone={Link2}
        tom="info"
        chave="guardar-link"
        className="mb-6 mt-4"
      >
        Não precisa de conta para voltar aqui: basta este endereço. Se preferir
        ter os pedidos todos no mesmo sítio,{" "}
        <Link href="/entrar" className="font-semibold underline">
          entre com a conta Google
        </Link>{" "}
        — leva um toque e não precisa de palavra-passe.
      </Nota>

      <section className="rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
          O que pediu
        </h2>

        {pedido.description && (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {pedido.description}
          </p>
        )}

        <dl className="mt-4 space-y-2 text-sm">
          {pedido.city && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <dt className="sr-only">Zona</dt>
              <dd className="text-slate-700">{pedido.city}</dd>
            </div>
          )}
          {pedido.urgency && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <dt className="sr-only">Quando</dt>
              <dd className="text-slate-700">{URGENCIA[pedido.urgency] ?? pedido.urgency}</dd>
            </div>
          )}
          {Boolean(pedido.precisaFatura) && (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <dd className="text-slate-700">Precisa de fatura</dd>
            </div>
          )}
          {Boolean(pedido.precisaGuiaTransporte) && (
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <dd className="text-slate-700">Precisa de guia de transporte</dd>
            </div>
          )}
        </dl>

        {fotos.length > 0 && (
          <div className="mt-5">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              {fotos.length} {fotos.length === 1 ? "fotografia" : "fotografias"}
            </h3>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fotos.map((f, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={f.url}
                  alt={f.name ?? `Fotografia ${i + 1} do pedido`}
                  className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200"
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
          Os valores
        </h2>

        <div className="mt-3 space-y-3">
          {desejado && (
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-slate-600">O valor que indicou</span>
              <span className="text-lg font-bold text-[#0B1929]">{desejado}</span>
            </div>
          )}

          {estimativa && (
            <div className="flex items-baseline justify-between gap-4 border-t border-slate-100 pt-3">
              <span className="text-sm text-slate-600">A nossa estimativa</span>
              <span className="text-lg font-semibold text-cyan-600">{estimativa}</span>
            </div>
          )}

          <Nota titulo="De onde vêm estes números">
            O valor que indicou é o ponto de partida: é o que os profissionais
            veem quando o pedido lhes chega, e a partir dele fazem propostas. A
            estimativa é nossa, é informativa e não muda nada — serve de
            referência antes das propostas. Quem decide o preço são vocês os
            dois.
          </Nota>
        </div>
      </section>

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
        A CLYON liga clientes a profissionais independentes. Quem executa o trabalho
        e emite a fatura é o profissional que escolher.
      </p>
    </main>
  );
}
