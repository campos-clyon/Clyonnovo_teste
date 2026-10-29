"use client";

import { PERGUNTAS_DO_ESPACO, RESPOSTAS_DA_QUANTIDADE, avisosDasCoisas } from "@/lib/perguntas-do-espaco";

/**
 * As perguntas da garagem, do sótão e da cave (29-10-2026): a quantidade, o
 * acesso e, na garagem e na cave, o que lá está que pede cuidado. As regras e
 * as frases vivem em `perguntas-do-espaco.ts`; isto só as mostra.
 */
type Props = {
  servico: string;
  volume?: string;
  acesso?: string;
  coisas?: string[];
  onVolume: (v: string) => void;
  onAcesso: (v: string) => void;
  onCoisas: (v: string[]) => void;
};

const pilula = (activa: boolean) =>
  `min-h-[44px] rounded-xl border-2 px-3 py-2 text-left text-xs font-semibold transition ${
    activa ? "border-cyan-500 bg-cyan-50 text-cyan-900" : "border-slate-200 bg-white text-slate-800 hover:border-cyan-300"
  }`;

export default function PerguntasDoEspaco({ servico, volume, acesso, coisas = [], onVolume, onAcesso, onCoisas }: Props) {
  const p = PERGUNTAS_DO_ESPACO[servico];
  if (!p) return null;
  const avisos = avisosDasCoisas(servico, coisas);

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-900">Quanto há para levar?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RESPOSTAS_DA_QUANTIDADE.map((r) => (
            <button key={r.valor} type="button" aria-pressed={volume === r.valor} onClick={() => onVolume(r.valor)} className={pilula(volume === r.valor)}>
              {r.texto}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-900">{p.acesso.titulo}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {p.acesso.opcoes.map((o) => (
            <button key={o.valor} type="button" aria-pressed={acesso === o.valor} onClick={() => onAcesso(o.valor)} className={pilula(acesso === o.valor)}>
              {o.texto}
            </button>
          ))}
        </div>
      </fieldset>

      {p.coisas && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-900">
            Há alguma destas coisas? <span className="font-normal text-slate-500">(pode escolher várias)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {p.coisas.map((o) => {
              const activa = coisas.includes(o.valor);
              return (
                <button
                  key={o.valor}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => {
                    if (o.valor === "nenhuma") onCoisas(activa ? [] : ["nenhuma"]);
                    else {
                      const sem = coisas.filter((c) => c !== "nenhuma" && c !== o.valor);
                      onCoisas(activa ? sem : [...sem, o.valor]);
                    }
                  }}
                  className={pilula(activa)}
                >
                  {o.texto}
                </button>
              );
            })}
          </div>
          {avisos.map((a) => (
            <p key={a} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {a}
            </p>
          ))}
        </fieldset>
      )}
    </div>
  );
}
