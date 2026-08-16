"use client";

import { Lock, FileText, Truck, Info } from "lucide-react";
import type { ErroDeValor } from "@/lib/pedido-valores";

/**
 * Quanto o cliente quer pagar, e o que precisa em papel.
 *
 * Duas coisas que este ecrã tem de comunicar bem, ou o modelo não se percebe:
 *
 * **O máximo é privado.** É contra-intuitivo dizer a alguém "escreva aqui o
 * máximo que aceita pagar" — a reacção natural é achar que vai passar a pagar
 * isso. Por isso o cadeado e a frase estão ao lado do campo e não numa nota de
 * rodapé: se a pessoa não acreditar que ninguém o vê, escreve um número baixo
 * e a negociação perde a folga que devia ter.
 *
 * **A guia de transporte não é papelada.** Transportar entulho ou monos em
 * Portugal exige transportador registado e e-GAR, e quem responde pelo destino
 * do resíduo é o cliente. Pedir isto aqui não é burocracia nossa: é o que
 * permite não mostrar o pedido a quem não pode legalmente aceitá-lo.
 */

const CATEGORIAS_COM_RESIDUOS = [
  "recolha_entulho",
  "recolha_monos",
  "recolha_moveis",
  "esvaziamento_casa",
  "esvaziamento_apartamento",
];

function campoCls(temErro: boolean) {
  return `w-full rounded-xl border-2 bg-white px-4 py-2.5 pl-9 text-base text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 ${
    temErro ? "border-red-400" : "border-gray-400"
  }`;
}

export default function ValoresEFaturacao({
  serviceType,
  valorMinimoCliente,
  valorMaximoCliente,
  precisaFatura,
  precisaGuiaTransporte,
  erros,
  onChange,
}: {
  serviceType?: string;
  valorMinimoCliente?: string;
  valorMaximoCliente?: string;
  precisaFatura?: boolean;
  precisaGuiaTransporte?: boolean;
  erros: ErroDeValor[];
  onChange: (campo: string, valor: unknown) => void;
}) {
  const erroMin = erros.find((e) => e.campo === "valorMinimoCliente")?.mensagem;
  const erroMax = erros.find((e) => e.campo === "valorMaximoCliente")?.mensagem;
  const mostrarGuia = CATEGORIAS_COM_RESIDUOS.includes(serviceType ?? "");

  return (
    <div className="space-y-6">
      {/* ── Quanto quer pagar ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-base font-bold text-slate-900">Quanto quer pagar?</h3>
        <p className="mt-1 text-sm text-slate-600">
          É a partir daqui que os profissionais respondem. Não é um compromisso —
          pode aceitar ou recusar qualquer proposta.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="valor-minimo" className="block text-sm font-medium text-gray-900">
              Quero pagar a partir de *
            </label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                €
              </span>
              <input
                id="valor-minimo"
                type="text"
                inputMode="decimal"
                value={valorMinimoCliente ?? ""}
                onChange={(e) => onChange("valorMinimoCliente", e.target.value)}
                placeholder="80"
                aria-invalid={!!erroMin}
                aria-describedby={erroMin ? "erro-valor-minimo" : "ajuda-valor-minimo"}
                className={campoCls(!!erroMin)}
              />
            </div>
            {erroMin ? (
              <p id="erro-valor-minimo" className="mt-1 text-xs text-red-600">
                {erroMin}
              </p>
            ) : (
              <p id="ajuda-valor-minimo" className="mt-1 text-xs text-slate-500">
                É este o valor que os profissionais vêem.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="valor-maximo" className="block text-sm font-medium text-gray-900">
              Até ao máximo de *
            </label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                €
              </span>
              <input
                id="valor-maximo"
                type="text"
                inputMode="decimal"
                value={valorMaximoCliente ?? ""}
                onChange={(e) => onChange("valorMaximoCliente", e.target.value)}
                placeholder="150"
                aria-invalid={!!erroMax}
                aria-describedby={erroMax ? "erro-valor-maximo" : "ajuda-valor-maximo"}
                className={campoCls(!!erroMax)}
              />
            </div>
            {erroMax ? (
              <p id="erro-valor-maximo" className="mt-1 text-xs text-red-600">
                {erroMax}
              </p>
            ) : (
              <p
                id="ajuda-valor-maximo"
                className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-700"
              >
                <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                Só nós vemos. Nenhum profissional.
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-emerald-900">
            O máximo fica guardado do nosso lado e serve só para percebermos a que
            profissionais faz sentido mostrar o seu pedido. Se fosse visível,
            ninguém proporia abaixo dele.
          </p>
        </div>
      </div>

      {/* ── Faturação ─────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-base font-bold text-slate-900">Precisa de documentos?</h3>
        <p className="mt-1 text-sm text-slate-600">
          Só mostramos o pedido a profissionais que os emitam — para não descobrir
          ao fim de cinco propostas que afinal não dá.
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-gray-300 bg-white p-4 transition hover:border-cyan-400 has-[:checked]:border-cyan-600 has-[:checked]:bg-cyan-50">
            <input
              type="checkbox"
              checked={precisaFatura ?? false}
              onChange={(e) => onChange("precisaFatura", e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-600"
            />
            <span className="flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FileText className="h-4 w-4 text-slate-500" aria-hidden="true" />
                Preciso de fatura
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                A fatura é emitida pelo profissional, que é quem presta o serviço. O
                IVA depende do regime dele.
              </span>
            </span>
          </label>

          {mostrarGuia && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-gray-300 bg-white p-4 transition hover:border-cyan-400 has-[:checked]:border-cyan-600 has-[:checked]:bg-cyan-50">
              <input
                type="checkbox"
                checked={precisaGuiaTransporte ?? false}
                onChange={(e) => onChange("precisaGuiaTransporte", e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-600"
              />
              <span className="flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Truck className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  Preciso de guia de transporte (e-GAR)
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                  Transportar resíduos exige transportador registado. Quem responde
                  pelo destino do resíduo é quem o produz — ou seja, você.
                </span>
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
