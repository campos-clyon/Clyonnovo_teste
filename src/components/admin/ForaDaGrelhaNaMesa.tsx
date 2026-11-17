"use client";

import { linhaDoForaDaGrelha, type ForaDaGrelhaNaMesa } from "@/lib/custo-do-trabalho";
import { euros } from "@/lib/sugestao-ajustada";

/**
 * «FORA DA GRELHA» NO CARTÃO DA MESA — d61 fase (a), modo sombra.
 *
 * O custo real do trabalho (custo-do-trabalho.ts) saiu da grelha publicada:
 * vermelho quando o motor passa o tecto (o parceiro perderia), cinzento quando
 * fica abaixo do chão. Por baixo, o custo em degraus: km, portagens, pessoas ×
 * horas, deposição, saída. Só a equipa o vê; o cliente continua com a grelha.
 * Valores sem IVA, para a conta interna.
 */
export function ForaDaGrelhaNaMesa({ estado }: { estado: ForaDaGrelhaNaMesa }) {
  const acima = estado.sentido === "acima_do_tecto";
  return (
    <details
      className={`rounded-lg border p-3 ${acima ? "border-red-500/40 bg-red-500/10" : "border-slate-600 bg-slate-800/40"}`}
    >
      <summary className={`cursor-pointer text-xs font-semibold ${acima ? "text-red-200" : "text-slate-300"}`}>
        Fora da grelha — {linhaDoForaDaGrelha(estado)}
      </summary>
      <ul className="mt-2 space-y-0.5 text-xs text-slate-300">
        {estado.degraus.map((d) => (
          <li key={d.rotulo} className="flex justify-between gap-3">
            <span>{d.rotulo}</span>
            <span className="tabular-nums">{euros(d.valor)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-3 border-t border-slate-700 pt-1 font-semibold text-slate-200">
          <span>Custo</span>
          <span className="tabular-nums">{euros(estado.custo)}</span>
        </li>
      </ul>
      <p className="mt-2 text-[11px] text-slate-500">
        Em ensaio: o cliente vê a grelha de sempre. Valores da conta interna, antes do IVA.
      </p>
    </details>
  );
}
