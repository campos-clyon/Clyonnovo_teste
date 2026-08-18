"use client";

import { useState } from "react";
import { CheckCircle2, Clock, HandCoins, Loader2, X } from "lucide-react";
import {
  accoesDisponiveis,
  propostasRestantes,
  propostaPendente,
  horasAteExpirar,
  MAX_PROPOSTAS_POR_LADO,
  type Negociacao,
  type Proposta,
} from "@/lib/negociacao";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";
import EscolherValor from "@/components/EscolherValor";

/**
 * A negociação, do lado do profissional.
 *
 * Os botões vêm de `accoesDisponiveis` e não de condições escritas aqui. A API
 * recusa exactamente o que essa função não devolver — duas listas, uma para
 * desenhar e outra para validar, era garantir que um dia divergiam e que o
 * ecrã oferecia algo que o servidor recusava.
 *
 * Todos os valores mostrados são líquidos. Nunca o bruto: mostrar o acordado e
 * depois um número mais pequeno na carteira levanta a pergunta "onde foi a
 * diferença", e a resposta certa é que nunca foi dele.
 */

function euros(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2).replace(".", ",") + " €";
}

export default function NegociacaoProfissional({
  token,
  estadoInicial,
  propostasIniciais,
  valorAcordado,
  minimoDoCliente,
  recebeSeAceitar,
}: {
  token: string;
  estadoInicial: string;
  propostasIniciais: Proposta[];
  valorAcordado: number | null;
  minimoDoCliente: number | null;
  recebeSeAceitar: number | null;
}) {
  const [negociacao, setNegociacao] = useState<Negociacao>({
    estado: estadoInicial as Negociacao["estado"],
    valorAcordado,
    propostas: propostasIniciais,
  });
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");

  const agora = new Date();
  const accoes = accoesDisponiveis(negociacao, "profissional", agora);
  const pendente = propostaPendente(negociacao, agora);
  const restantes = propostasRestantes(negociacao, "profissional", agora);

  async function agir(accao: string, valorProposto?: string) {
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch(`/api/negociacao/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accao, valor: valorProposto }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return;
      }
      setNegociacao({
        estado: dados.estado,
        valorAcordado: dados.valorAcordado,
        propostas: dados.propostas,
      });
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  // ── Estados terminais ────────────────────────────────────────────────────
  if (negociacao.estado === "acordada") {
    return (
      <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
        <h2 className="mt-2 text-lg font-bold text-emerald-900">O trabalho é seu</h2>
        <p className="mt-1 text-sm text-emerald-800">
          Fechado em {euros(quantoOProfissionalRecebe(negociacao.valorAcordado ?? 0))}, já com a
          taxa CLYON descontada.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-emerald-700">
          O valor fica retido e é libertado quando o cliente confirmar que está feito.
          Vamos enviar-lhe a morada e o contacto por email.
        </p>
      </section>
    );
  }

  if (negociacao.estado === "aguarda_contratacao") {
    return (
      <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-center">
        <Clock className="mx-auto h-8 w-8 text-blue-600" aria-hidden="true" />
        <h2 className="mt-2 text-lg font-bold text-blue-900">À espera do cliente</h2>
        <p className="mt-1 text-sm leading-relaxed text-blue-800">
          Aceitou {euros(quantoOProfissionalRecebe(negociacao.valorAcordado ?? 0))}. Falta o
          cliente confirmar que o contrata — pode estar a falar com mais profissionais.
        </p>
      </section>
    );
  }

  if (negociacao.estado === "desistida" || negociacao.estado === "morta") {
    return (
      <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
        <X className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
        <h2 className="mt-2 text-base font-bold text-slate-700">Negociação terminada</h2>
      </section>
    );
  }

  // ── Negociação a decorrer ────────────────────────────────────────────────
  const podePropor = accoes.includes("propor");
  const podeAceitar = accoes.includes("aceitar");
  const valorEmCima = pendente?.valor ?? minimoDoCliente;
  const recebeSeFechar =
    valorEmCima != null ? quantoOProfissionalRecebe(valorEmCima) : recebeSeAceitar;

  return (
    <section className="mt-4 rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">A negociação</h2>

      {/* O que está em cima da mesa */}
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-slate-600">
            {pendente?.por === "cliente"
              ? "O cliente quer pagar"
              : pendente?.por === "profissional"
                ? "A sua proposta"
                : "O cliente quer pagar"}
          </span>
          <span className="text-2xl font-bold text-[#0B1929]">{euros(valorEmCima)}</span>
        </div>
        {recebeSeFechar != null && (
          <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-slate-200 pt-2">
            <span className="flex items-center gap-1.5 text-sm text-slate-600">
              <HandCoins className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Recebe
            </span>
            <span className="text-xl font-bold text-emerald-600">{euros(recebeSeFechar)}</span>
          </div>
        )}
        {pendente && (
          <p className="mt-2 text-xs text-slate-500">
            {Math.max(0, Math.round(horasAteExpirar(pendente, agora)))} h para responder
          </p>
        )}
      </div>

      {/* Histórico — só valores, é o que existe */}
      {negociacao.propostas.length > 1 && (
        <ol className="mt-4 space-y-1.5">
          {negociacao.propostas.map((p, i) => (
            <li key={i} className="flex items-center justify-between text-xs">
              <span className="text-slate-500">
                {p.por === "cliente" ? "Cliente" : "Você"}
                {p.estado === "expirada" && " (expirou)"}
                {p.estado === "recusada" && " (recusada)"}
              </span>
              <span
                className={
                  p.estado === "pendente"
                    ? "font-bold text-[#0B1929]"
                    : "text-slate-400 line-through"
                }
              >
                {euros(p.valor)}
              </span>
            </li>
          ))}
        </ol>
      )}

      {erro && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      )}

      {/* Acções */}
      <div className="mt-4 space-y-3">
        {podeAceitar && (
          <button
            onClick={() => agir("aceitar")}
            disabled={aEnviar}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-base font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {aEnviar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Aceitar {euros(valorEmCima)} · recebe {euros(recebeSeFechar)}
          </button>
        )}

        {podePropor && (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-900">
              {podeAceitar ? "Ou proponha outro valor" : "Proponha um valor"}
            </p>
            <EscolherValor
              referencia={valorEmCima}
              direccao="acima"
              aEnviar={aEnviar}
              legendaDoValor={(v) => `Recebe ${euros(quantoOProfissionalRecebe(v))}`}
              onPropor={(v) => agir("propor", v)}
            />
            <p className="mt-2 text-xs text-slate-500">
              {restantes} de {MAX_PROPOSTAS_POR_LADO} propostas por usar.
            </p>
          </div>
        )}

        {!podePropor && restantes === 0 && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            Gastou as cinco propostas. Só pode aceitar o que está em cima da mesa ou
            desistir.
          </p>
        )}

        {!podePropor && restantes > 0 && pendente?.por === "profissional" && (
          <p className="text-xs text-slate-500">
            A sua proposta está à espera de resposta. Não pode fazer outra até o cliente
            responder ou o prazo acabar.
          </p>
        )}

        {accoes.includes("desistir") && (
          <button
            onClick={() => agir("desistir")}
            disabled={aEnviar}
            className="w-full rounded-xl border border-slate-200 py-2.5 text-sm text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-50"
          >
            Não estou interessado
          </button>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-400">
        A negociação é só de valores. Não há mensagens — é o que impede combinações
        fora da plataforma, e o que garante que o pagamento fica protegido.
      </p>
    </section>
  );
}
