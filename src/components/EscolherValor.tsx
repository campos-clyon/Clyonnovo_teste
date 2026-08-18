"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Escolher um valor para propor — com atalhos, não com um campo vazio.
 *
 * Um campo de texto em branco obriga a pessoa a inventar um número. É o momento
 * em que ela hesita, faz contas de cabeça e muitas vezes desiste da
 * contraproposta e fecha o separador. Dois atalhos calculados a partir do que
 * está em cima da mesa transformam isso num toque.
 *
 * É como a Vinted faz na janela "fazer uma oferta": duas percentagens prontas e
 * um "outro" para quem quer escrever. Os atalhos não são um limite — só um
 * ponto de partida.
 *
 * A direcção muda conforme quem propõe: o cliente contrapropõe ABAIXO do que o
 * profissional pediu, o profissional contrapropõe ACIMA do que o cliente quer
 * pagar. Os atalhos seguem esse sentido, senão sugeriam a alguém uma proposta
 * contra o seu próprio interesse.
 */

export type DireccaoDaProposta = "abaixo" | "acima";

/** Quanto os atalhos se afastam da referência, por direcção. */
const PASSOS: Record<DireccaoDaProposta, number[]> = {
  // O cliente quer pagar menos.
  abaixo: [0.05, 0.1],
  // O profissional quer receber mais. Passos maiores: um trabalho mal pago
  // recusa-se por 5 %, não se negoceia.
  acima: [0.1, 0.2],
};

function aosCentimos(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function euros(v: number): string {
  return v.toFixed(2).replace(".", ",") + " €";
}

export default function EscolherValor({
  referencia,
  direccao,
  aEnviar,
  rotuloDoBotao = "Propor",
  legendaDoValor,
  onPropor,
}: {
  /** O valor em cima da mesa, sobre o qual os atalhos são calculados. */
  referencia: number | null;
  direccao: DireccaoDaProposta;
  aEnviar: boolean;
  rotuloDoBotao?: string;
  /** Uma linha por baixo do valor escolhido — o líquido, o total, o que fizer sentido. */
  legendaDoValor?: (valor: number) => string;
  onPropor: (valor: string) => void;
}) {
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const [outro, setOutro] = useState("");
  const [aEscrever, setAEscrever] = useState(false);

  const atalhos =
    referencia != null && referencia > 0
      ? PASSOS[direccao].map((passo) => ({
          passo,
          valor: aosCentimos(
            direccao === "abaixo" ? referencia * (1 - passo) : referencia * (1 + passo),
          ),
        }))
      : [];

  const valorEscrito = Number(outro.replace(",", "."));
  const valorFinal = aEscrever
    ? Number.isFinite(valorEscrito) && valorEscrito > 0
      ? aosCentimos(valorEscrito)
      : null
    : escolhido;

  return (
    <div>
      {atalhos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {atalhos.map((a) => {
            const activo = !aEscrever && escolhido === a.valor;
            return (
              <button
                key={a.passo}
                type="button"
                onClick={() => {
                  setEscolhido(a.valor);
                  setAEscrever(false);
                }}
                aria-pressed={activo}
                className={`flex min-h-[72px] flex-col items-start justify-center rounded-xl border-2 px-3 py-2 text-left transition ${
                  activo
                    ? "border-cyan-600 bg-cyan-50"
                    : "border-slate-300 bg-white hover:border-cyan-400"
                }`}
              >
                <span className="text-base font-bold text-slate-900">{euros(a.valor)}</span>
                <span className="text-xs leading-tight text-cyan-700">
                  {direccao === "abaixo" ? "−" : "+"}
                  {Math.round(a.passo * 100)}%
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setAEscrever(true);
              setEscolhido(null);
            }}
            aria-pressed={aEscrever}
            className={`flex min-h-[72px] flex-col items-start justify-center rounded-xl border-2 px-3 py-2 text-left transition ${
              aEscrever
                ? "border-cyan-600 bg-cyan-50"
                : "border-slate-300 bg-white hover:border-cyan-400"
            }`}
          >
            <span className="text-base font-bold text-slate-900">Outro</span>
            <span className="text-xs leading-tight text-cyan-700">Escrever</span>
          </button>
        </div>
      )}

      {/* O campo aparece quando se escolhe "Outro", ou quando não há referência
          para calcular atalhos — nesse caso é a única forma de propor. */}
      {(aEscrever || atalhos.length === 0) && (
        <div className="relative mt-3">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">
            €
          </span>
          <input
            type="text"
            inputMode="decimal"
            autoFocus={aEscrever}
            value={outro}
            onChange={(e) => setOutro(e.target.value)}
            placeholder={referencia != null ? String(Math.round(referencia)) : "120"}
            aria-label="Valor a propor"
            className="w-full rounded-xl border-2 border-gray-300 bg-white py-3 pl-10 pr-4 text-lg font-semibold text-slate-900 outline-none transition focus:border-cyan-600"
          />
        </div>
      )}

      {valorFinal != null && legendaDoValor && (
        <p className="mt-2 text-sm text-slate-600">{legendaDoValor(valorFinal)}</p>
      )}

      <button
        type="button"
        disabled={aEnviar || valorFinal == null}
        onClick={() => valorFinal != null && onPropor(String(valorFinal))}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3.5 text-base font-bold text-white transition hover:bg-cyan-400 disabled:opacity-40"
      >
        {aEnviar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {valorFinal != null ? `${rotuloDoBotao} ${euros(valorFinal)}` : rotuloDoBotao}
      </button>
    </div>
  );
}
