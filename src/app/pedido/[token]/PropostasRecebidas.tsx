"use client";

import { useState } from "react";
import { BadgeCheck, CheckCircle2, FileText, HandCoins, Loader2 } from "lucide-react";
import {
  accoesDisponiveis,
  propostasRestantes,
  propostaPendente,
  MAX_PROPOSTAS_POR_LADO,
  type Negociacao,
  type Proposta,
} from "@/lib/negociacao";
import { quantoOClientePaga, decomporIva, TAXA_IVA } from "@/lib/taxas-plataforma";
import EscolherValor from "@/components/EscolherValor";

/**
 * As propostas que o cliente recebeu.
 *
 * Vários profissionais podem estar a negociar o mesmo pedido ao mesmo tempo, e
 * é por isso que isto é uma lista e não um ecrã só. O cliente escolhe quem lhe
 * entra em casa — e é esse o segundo passo do aperto de mão duplo: um
 * profissional aceitar não fecha nada.
 *
 * Os valores da negociação são CRUS — o que foi proposto, sem taxa. É como a
 * Vinted faz: na conversa vêem-se as propostas tal como foram feitas, e a taxa
 * aparece onde se compra.
 *
 * Somá-la em cada proposta fazia o número dançar a cada contraproposta por uma
 * razão que não é a negociação, e o cliente deixava de saber sobre que valor
 * estava a discutir com o profissional.
 *
 * No fecho é ao contrário: aí é o momento de pagar, e mostra-se a conta toda —
 * acordado, taxa e total.
 */

export type NegociacaoDoCliente = {
  id: number;
  estado: string;
  valorAcordado: number | null;
  propostas: Proposta[];
  profissionalNome: string;
  emiteFatura: boolean;
  /** "isento" ou "normal" — decide se há linha de IVA na confirmação. */
  regimeIva: string;
  guiaVerificada: boolean;
};

function euros(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2).replace(".", ",") + " €";
}

export default function PropostasRecebidas({
  token,
  negociacoesIniciais,
}: {
  token: string;
  negociacoesIniciais: NegociacaoDoCliente[];
}) {
  const [negociacoes, setNegociacoes] = useState(negociacoesIniciais);
  const [aEnviar, setAEnviar] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  async function agir(id: number, accao: string, valor?: string) {
    setAEnviar(id);
    setErro("");
    try {
      const res = await fetch(`/api/negociacao/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accao, valor, negociacaoId: id }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return;
      }
      setNegociacoes((lista) =>
        lista.map((n) =>
          n.id === id
            ? { ...n, estado: dados.estado, valorAcordado: dados.valorAcordado, propostas: dados.propostas }
            : n,
        ),
      );
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(null);
    }
  }

  const acordada = negociacoes.find((n) => n.estado === "acordada");

  if (acordada) {
    return (
      <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-2 text-lg font-bold text-emerald-900">
          Contratou {acordada.profissionalNome}
        </h2>
        {/* Aqui sim: é o momento de pagar, e o total tem de ser o total —
            com o IVA decomposto do valor acordado, não somado a ele. */}
        <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 text-left">
          {/*
            O IVA só aparece a quem o liquida. O regime é do profissional, não
            nosso: um isento pelo art. 53.º não cobra IVA nenhum, e mostrar uma
            linha de 23% a quem o contrata seria mostrar-lhe um imposto que não
            deve — e que ninguém pode entregar ao Estado.
          */}
          {acordada.regimeIva === "normal" ? (
            <>
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="text-slate-600">Serviço (sem IVA)</span>
                <span className="text-slate-900">
                  {euros(decomporIva(acordada.valorAcordado ?? 0).base)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-4 text-sm">
                <span className="text-slate-600">IVA ({Math.round(TAXA_IVA * 100)}%)</span>
                <span className="text-slate-900">
                  {euros(decomporIva(acordada.valorAcordado ?? 0).iva)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-slate-100 pt-1 text-sm">
                <span className="font-medium text-slate-700">Valor acordado</span>
                <span className="font-semibold text-slate-900">
                  {euros(acordada.valorAcordado)}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-slate-600">
                Valor acordado
                <span className="block text-xs text-slate-400">
                  isento de IVA (art. 53.º)
                </span>
              </span>
              <span className="font-semibold text-slate-900">
                {euros(acordada.valorAcordado)}
              </span>
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between gap-4 text-sm">
            <span className="text-slate-600">Taxa CLYON</span>
            <span className="font-semibold text-slate-900">
              {euros(
                quantoOClientePaga(acordada.valorAcordado ?? 0) -
                  (acordada.valorAcordado ?? 0),
              )}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-slate-200 pt-2">
            <span className="text-sm font-semibold text-slate-900">Total a pagar</span>
            <span className="text-lg font-bold text-emerald-700">
              {euros(quantoOClientePaga(acordada.valorAcordado ?? 0))}
            </span>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-emerald-700">
          O valor fica retido na CLYON e só chega ao profissional depois de confirmar
          que o trabalho está feito.
        </p>
      </section>
    );
  }

  const activas = negociacoes.filter(
    (n) => n.estado === "aberta" || n.estado === "aguarda_contratacao",
  );

  if (activas.length === 0) {
    return (
      <section className="mt-4 rounded-2xl border border-[#E2EEF3] bg-white p-5 text-center shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Propostas</h2>
        <p className="mt-3 text-sm text-slate-500">
          Ainda não há propostas. Assim que um profissional responder, aparece aqui — e
          avisamos por email.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">
        {activas.length} {activas.length === 1 ? "profissional" : "profissionais"} a responder
      </h2>

      {erro && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      )}

      <div className="space-y-3">
        {activas.map((n) => {
          const estado: Negociacao = {
            estado: n.estado as Negociacao["estado"],
            valorAcordado: n.valorAcordado,
            propostas: n.propostas,
          };
          const agora = new Date();
          const accoes = accoesDisponiveis(estado, "cliente", agora);
          const pendente = propostaPendente(estado, agora);
          const restantes = propostasRestantes(estado, "cliente", agora);
          const emCima = pendente?.valor ?? n.valorAcordado;
          const aguarda = n.estado === "aguarda_contratacao";

          return (
            <article
              key={n.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                aguarda ? "border-emerald-300 ring-1 ring-emerald-200" : "border-[#E2EEF3]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[#0B1929]">{n.profissionalNome}</h3>
                  {/* O distintivo está sempre à vista, e não ao fim de cinco
                      propostas — não pode ser uma descoberta tardia. */}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        n.emiteFatura
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <FileText className="mr-1 inline h-3 w-3" aria-hidden="true" />
                      {n.emiteFatura ? "emite fatura" : "não emite fatura"}
                    </span>
                    {n.guiaVerificada && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <BadgeCheck className="mr-1 inline h-3 w-3" aria-hidden="true" />
                        guia verificada
                      </span>
                    )}
                  </div>
                </div>

                {/*
                  O valor CRU do que está em cima da mesa, sem taxa.
                  É como a Vinted faz: na conversa vêem-se os valores das
                  propostas, e a taxa aparece onde se compra. Somá-la aqui
                  fazia o número dançar a cada contraproposta por uma razão
                  que não é a negociação — e o cliente deixava de saber sobre
                  que valor estava a discutir.
                */}
                <div className="text-right">
                  <div className="text-xl font-bold text-[#0B1929]">{euros(emCima)}</div>
                  <div className="text-xs text-slate-400">
                    {pendente?.por === "profissional" ? "proposta dele" : "a sua proposta"}
                  </div>
                </div>
              </div>

              {aguarda && (
                <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <strong>Aceitou o seu valor.</strong> Falta confirmar que o contrata.
                </p>
              )}

              <div className="mt-4 space-y-2">
                {accoes.includes("contratar") && (
                  <button
                    onClick={() => agir(n.id, "contratar")}
                    disabled={aEnviar === n.id}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-base font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {aEnviar === n.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Contratar este profissional
                  </button>
                )}

                {accoes.includes("aceitar") && (
                  <button
                    onClick={() => agir(n.id, "aceitar")}
                    disabled={aEnviar === n.id}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <HandCoins className="h-4 w-4" aria-hidden="true" />
                    Aceitar e contratar
                  </button>
                )}

                {accoes.includes("propor") && (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="mb-2 text-sm font-medium text-slate-700">
                      Ou proponha outro valor
                    </p>
                    <EscolherValor
                      referencia={emCima}
                      direccao="abaixo"
                      aEnviar={aEnviar === n.id}
                      legendaDoValor={(v) =>
                        `Se ele aceitar, paga ${euros(quantoOClientePaga(v))} com a taxa CLYON.`
                      }
                      onPropor={(valor) => agir(n.id, "propor", valor)}
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      {restantes} de {MAX_PROPOSTAS_POR_LADO} propostas por usar.
                    </p>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-slate-400">
        Aceitar ou contratar fecha o trabalho com esse profissional. As outras
        negociações terminam.
      </p>
    </section>
  );
}
