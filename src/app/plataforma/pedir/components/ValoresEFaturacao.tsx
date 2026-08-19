"use client";

import { FileText, Truck, Info } from "lucide-react";
import type { ErroDeValor } from "@/lib/pedido-valores";

/**
 * Quanto o cliente quer pagar, e o que precisa em papel.
 *
 * **Um valor só.** Eram dois — um mínimo e um máximo, com o máximo privado — e
 * passou a um por decisão de 18-08-2026. Pedir um tecto que depois não se
 * mostra a ninguém obrigava a uma explicação a meio do formulário, e uma
 * explicação a meio de um formulário é uma pessoa a pensar em vez de escrever.
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

export default function ValoresEFaturacao({
  serviceType,
  valorDesejadoCliente,
  precisaFatura,
  precisaGuiaTransporte,
  erros,
  onChange,
}: {
  serviceType?: string;
  valorDesejadoCliente?: string;
  precisaFatura?: boolean;
  precisaGuiaTransporte?: boolean;
  erros: ErroDeValor[];
  onChange: (campo: string, valor: unknown) => void;
}) {
  const erro = erros.find((e) => e.campo === "valorDesejadoCliente")?.mensagem;
  const mostrarGuia = CATEGORIAS_COM_RESIDUOS.includes(serviceType ?? "");

  return (
    <div className="space-y-6">
      {/* ── Valor desejado ────────────────────────────────────────────── */}
      <div>
        <h3 className="text-base font-bold text-slate-900">Quanto quer pagar?</h3>
        <p className="mt-1 text-sm text-slate-600">
          É a partir daqui que os profissionais respondem. Não é um compromisso —
          pode aceitar ou recusar qualquer proposta.
        </p>

        <div className="mt-4">
          <label htmlFor="valor-desejado" className="block text-sm font-medium text-gray-900">
            Valor desejado *
          </label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">
              €
            </span>
            <input
              id="valor-desejado"
              type="text"
              inputMode="decimal"
              value={valorDesejadoCliente ?? ""}
              onChange={(e) => onChange("valorDesejadoCliente", e.target.value)}
              placeholder="100"
              aria-invalid={!!erro}
              aria-describedby={erro ? "erro-valor" : "ajuda-valor"}
              className={`w-full rounded-xl border-2 bg-white py-3.5 pl-10 pr-4 text-xl font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 ${
                erro ? "border-red-400" : "border-gray-400"
              }`}
            />
          </div>
          {erro ? (
            <p id="erro-valor" className="mt-1.5 text-xs text-red-600">
              {erro}
            </p>
          ) : (
            <p id="ajuda-valor" className="mt-1.5 text-xs text-slate-500">
              É este o valor que os profissionais vêem.
            </p>
          )}
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-cyan-900">
            Os profissionais podem aceitar este valor ou propor outro. Só paga se
            contratar alguém — e o total, com a taxa CLYON, aparece antes de confirmar.
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
                A fatura é emitida pelo profissional, que é quem presta o serviço.
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
