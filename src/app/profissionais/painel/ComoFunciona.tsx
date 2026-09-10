"use client";

import { AlertTriangle, ChevronRight, MinusCircle } from "lucide-react";
import { CabecalhoDeEcra } from "@/components/portal/Portal";
import {
  PASSOS_DO_PROFISSIONAL,
  O_QUE_A_CLYON_NAO_FAZ,
} from "@/lib/como-funciona-para-o-profissional";
import type { Falta, SeccaoComFalta } from "@/lib/perfil-por-completar";
import { faltasDaSeccao } from "@/lib/perfil-por-completar";

/**
 * COMO FUNCIONA — o ecrã que nunca existiu.
 *
 * Um profissional entra por convite, preenche o registo e fica à espera. Nunca
 * lhe dissemos como chegam os pedidos, de onde sai o valor sugerido, quantas
 * vezes pode contrapropor, quando vê a morada, nem quem lhe paga. Descobre-o
 * ao terceiro pedido — ou desiste ao primeiro, convencido de que a plataforma
 * não dá trabalho nenhum. As perguntas frequentes respondem a quem já sabe o
 * que perguntar; isto é para quem ainda não sabe.
 *
 * O QUE FAZ DESTE ECRÃ MAIS DO QUE UM TEXTO: cada passo que depende de um
 * campo do perfil mostra ali mesmo o que lhe falta, com o triângulo, e abre a
 * secção com um toque. Explicar que a sugestão usa os custos dele e não dizer
 * que os custos dele estão vazios seria contar metade.
 */

export default function ComoFunciona({
  faltas,
  onVoltar,
  onAbrir,
}: {
  /** O que falta no perfil, para ligar cada passo ao campo por preencher. */
  faltas: Falta[];
  onVoltar: () => void;
  onAbrir: (seccao: SeccaoComFalta) => void;
}) {
  return (
    <>
      <CabecalhoDeEcra titulo="Como funciona" onVoltar={onVoltar} />

      <section className="rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm">
        <p className="text-sm leading-relaxed text-slate-600">
          A CLYON não é uma empresa de mudanças com carrinhas: é o sítio onde um cliente
          descreve o trabalho e onde você lhe responde com o seu valor. Em seis passos, o
          que acontece do princípio ao fim.
        </p>

        <ol className="mt-5 space-y-5">
          {PASSOS_DO_PROFISSIONAL.map((passo, i) => {
            const emFalta = passo.seccao ? faltasDaSeccao(faltas, passo.seccao) : [];
            return (
              <li key={passo.chave} className="flex gap-3">
                {/* O número do passo, e não um ícone: o que interessa aqui é a
                    ordem — o que vem antes do quê. */}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-sm font-bold text-cyan-700">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-[#0B1929]">{passo.titulo}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{passo.texto}</p>

                  {passo.seccao && emFalta.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onAbrir(passo.seccao as SeccaoComFalta)}
                      className="mt-2 flex w-full items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-left transition active:bg-amber-100"
                    >
                      <AlertTriangle
                        className="h-4 w-4 shrink-0 text-amber-600"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 text-xs leading-relaxed text-amber-900">
                        {emFalta.length === 1
                          ? `Falta preencher: ${emFalta[0].rotulo}.`
                          : `Faltam ${emFalta.length} campos: ${emFalta
                              .map((f) => f.rotulo.toLowerCase())
                              .join(", ")}.`}
                      </span>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-amber-600"
                        aria-hidden="true"
                      />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-4 rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-[#0B1929]">O que a CLYON não faz</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Metade das dúvidas que nos chegam são sobre coisas que a plataforma nunca
          prometeu. Fica dito.
        </p>
        <ul className="mt-3 space-y-2">
          {O_QUE_A_CLYON_NAO_FAZ.map((linha) => (
            <li key={linha} className="flex items-start gap-2.5">
              <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="text-sm leading-relaxed text-slate-600">{linha}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
