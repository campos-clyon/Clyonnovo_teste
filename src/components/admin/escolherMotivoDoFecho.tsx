"use client";

import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MOTIVOS_DO_FECHO, fechaOPedido, type ChaveDoMotivo } from "@/lib/motivo-do-fecho";

/**
 * A ESCOLHA DO MOTIVO, ANTES DE CANCELAR OU ARQUIVAR — d54, 16-11-2026.
 *
 * Uma janela pequena com os seis motivos (`MOTIVOS_DO_FECHO`). Devolve o que
 * vai no corpo do pedido ao servidor — `{ motivoDoFecho, quantoQueriaPagar? }`
 * — ou `null` se a pessoa desistiu. É uma função, e não um componente, para
 * servir os vários sítios que cancelam ou arquivam (a Mesa, os Trabalhos
 * CLYON, a lista dos Pedidos, a ficha do pedido) com uma linha cada: o servidor
 * recusa sem motivo, e esta é a forma de o dar.
 */

export type MotivoEscolhido = { motivoDoFecho: ChaveDoMotivo; quantoQueriaPagar?: string };

type Opcoes = { accao: "cancelar" | "arquivar" | "rejeitar"; quantos?: number };

function JanelaDoMotivo({ accao, quantos, onFim }: Opcoes & { onFim: (m: MotivoEscolhido | null) => void }) {
  const [motivo, setMotivo] = useState<ChaveDoMotivo | null>(null);
  const [quanto, setQuanto] = useState("");
  const alvo = quantos && quantos > 1 ? `${quantos} pedidos` : "o pedido";
  const verbo = accao === "arquivar" ? "Arquivar" : accao === "rejeitar" ? "Rejeitar" : "Cancelar";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="motivo-do-fecho-titulo"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
      onClick={() => onFim(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") onFim(null);
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="motivo-do-fecho-titulo" className="text-base font-bold text-white">
          {verbo} {alvo}: porquê?
        </h2>
        <p className="mt-1 text-xs text-slate-400">O motivo é obrigatório e conta para o resumo da semana na Mesa.</p>
        <div className="mt-3 grid gap-1.5">
          {MOTIVOS_DO_FECHO.map((m) => (
            <label
              key={m.chave}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                motivo === m.chave ? "border-sky-400 bg-sky-400/10 text-white" : "border-slate-700 hover:bg-slate-800/60"
              }`}
            >
              <input
                type="radio"
                name="motivo-do-fecho"
                value={m.chave}
                checked={motivo === m.chave}
                onChange={() => setMotivo(m.chave)}
                className="accent-sky-400"
              />
              {m.rotulo}
            </label>
          ))}
        </div>
        {motivo === "preco" && (
          <label className="mt-3 block text-xs text-slate-400">
            Quanto queria pagar (opcional, em euros)
            <input
              value={quanto}
              onChange={(e) => setQuanto(e.target.value)}
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </label>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onFim(null)}
            className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800/60"
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={!motivo}
            onClick={() =>
              motivo &&
              onFim({ motivoDoFecho: motivo, ...(motivo === "preco" && quanto.trim() ? { quantoQueriaPagar: quanto.trim() } : {}) })
            }
            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
          >
            {verbo}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Abre a janela e espera pela escolha. `null` = desistiu (não se cancela nem arquiva nada). */
export function escolherMotivoDoFecho(opcoes: Opcoes): Promise<MotivoEscolhido | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolver) => {
    const lugar = document.createElement("div");
    document.body.appendChild(lugar);
    const raiz = createRoot(lugar);
    const fim = (m: MotivoEscolhido | null) => {
      raiz.unmount();
      lugar.remove();
      resolver(m);
    };
    raiz.render(<JanelaDoMotivo {...opcoes} onFim={fim} />);
  });
}

/**
 * Para uma mudança de estado: `{}` se não fecha o pedido (não se pergunta
 * nada), o motivo se fecha, ou `null` se a pessoa desistiu.
 */
export async function motivoSeFechar(
  antes: string | null | undefined,
  depois: string | null | undefined,
): Promise<MotivoEscolhido | Record<string, never> | null> {
  if (!fechaOPedido(antes, depois)) return {};
  return escolherMotivoDoFecho({ accao: depois === "arquivado" ? "arquivar" : depois === "rejeitado" ? "rejeitar" : "cancelar" });
}
