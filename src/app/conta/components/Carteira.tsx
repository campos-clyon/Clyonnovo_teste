"use client";

import { Lock, CheckCircle2 } from "lucide-react";
import Nota from "@/components/Nota";
import { carteiraDoCliente, type TrabalhoDoCliente } from "@/lib/carteira-do-cliente";
import { tService } from "@/lib/translations";
import { PROMESSA } from "@/lib/pagamento-na-plataforma";
import { TAXA_IVA } from "@/lib/taxas-plataforma";
import type { Order } from "./types";

function euros(v: number): string {
  return v.toFixed(2).replace(".", ",") + " €";
}

/**
 * A carteira do cliente.
 *
 * O profissional tinha uma desde o princípio; o cliente via o valor dentro de
 * cada pedido, um a um, e para saber quanto tinha em jogo abria-os todos e
 * somava de cabeça.
 *
 * O número grande ao centro é o que ainda está em aberto — o único sobre o qual
 * ele pode agir hoje. O que já pagou fica ao lado, mais pequeno: é história,
 * e não é sobre isso que se vem aqui.
 *
 * O QUE ESSE NÚMERO É chama-se `pagamento-na-plataforma.ts` e não se escreve
 * aqui. E é «em curso», não «retido» — 29-09-2026: a carteira junta trabalhos
 * pagos pela plataforma e trabalhos pagos em notas ao profissional, e só dos
 * primeiros a CLYON chega a ter o dinheiro.
 */
export default function Carteira({ orders }: { orders: Order[] }) {
  const trabalhos: TrabalhoDoCliente[] = orders.flatMap((o) =>
    (o.negociacoes ?? []).map((n) => ({
      negociacaoId: n.id,
      pedidoId: n.pedidoId,
      estado: n.estado,
      valorAcordado: n.valorAcordado,
      // As taxas deste trabalho: em dinheiro a do cliente é outra.
      taxaCliente: n.taxaCliente ?? null,
      taxaProfissional: n.taxaProfissional ?? null,
      confirmadoEm: n.confirmadoEm,
      pagoEm: n.pagoEm,
      profissionalNome: n.profissionalNome,
      serviceType: o.serviceType,
    })),
  );

  const c = carteiraDoCliente(trabalhos);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900">A minha carteira</h1>
        <p className="text-sm text-slate-500">O dinheiro dos seus trabalhos.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {PROMESSA.clienteRotuloDoTotal}
        </p>
        <p className="mt-1 text-4xl font-bold leading-none text-tinta">
          {euros(c.retido)}
        </p>
        <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
          {c.retido > 0 ? PROMESSA.clienteTotalComValor : PROMESSA.clienteTotalVazio}
        </p>

        <div className="mt-5 border-t border-slate-100 pt-4">
          {/*
            «CONCLUÍDO», e não «Já pago». Um trabalho dado por concluído não
            quer dizer que a referência foi paga — e em dinheiro quem recebeu
            foi o profissional, não a CLYON.
          */}
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Concluído
          </p>
          <p className="mt-0.5 text-lg font-bold text-slate-700">{euros(c.pago)}</p>
        </div>
      </section>

      {c.linhas.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {c.linhas.map((l) => (
            <article
              key={l.negociacaoId}
              className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-b-0"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  l.fase === "retido"
                    ? "bg-cyan-50 text-[#00B4CC]"
                    : "bg-emerald-50 text-emerald-600"
                }`}
              >
                {l.fase === "retido" ? (
                  <Lock className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {tService(l.serviceType) ?? "Trabalho"} · #{l.pedidoId}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {l.profissionalNome ?? "Profissional"}
                  {l.quando && ` · ${new Date(l.quando).toLocaleDateString("pt-PT")}`}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-slate-900">{euros(l.total)}</p>
                <p className="text-xs text-tinta-fraca">
                  {l.fase === "retido" ? "em curso" : "concluído"}
                </p>
              </div>
            </article>
          ))}
        </section>
      )}

      {c.linhas.length === 0 && (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Ainda não fechou nenhum trabalho. Assim que aceitar uma proposta, o
          valor aparece aqui.
        </p>
      )}

      <Nota titulo={PROMESSA.clienteTitulo} comecaAberta>
        {PROMESSA.clienteCorpo}
      </Nota>

      {/*
        O PREÇO JÁ LEVA A TAXA — 29-09-2026. Dizia «o que combinou com o
        profissional mais a taxa da CLYON», e desde que as propostas lhe chegam
        já com a taxa dentro não há soma nenhuma para ele fazer: o número desta
        página é o mesmo que leu na proposta. Ver `preco-do-cliente.ts`.
      */}
      <Nota titulo="O que é a taxa da plataforma">
        O preço de cada trabalho já inclui a taxa da plataforma — é o mesmo número
        que leu na proposta, e o que sai da sua conta. Valores sem IVA; se pedir
        factura, acrescem {Math.round(TAXA_IVA * 100)} %.
      </Nota>
    </div>
  );
}
