"use client";

import { ESCOLHA_ATRIBUIR_JA, ESCOLHA_RESERVAR, FALTA_O_SIM_DO_CLIENTE, type SimDoCliente } from "@/lib/sim-do-cliente";

/*
 * «O CLIENTE AINDA NÃO ACEITOU ESTE VALOR.» — d130 (26-11-2026, o #652). Ao
 * atribuir ou escolher um parceiro num valor fixo sem o sim do cliente, em
 * vez de atribuir logo: (a) enviar o valor e reservar o parceiro até ao sim,
 * ou (b) atribuir já, com o sim dado por telefone. Ver `sim-do-cliente.ts`.
 */
export default function JanelaDoSimDoCliente({
  pedidoId,
  profissional,
  valor,
  podeEnviar = true,
  onEscolher,
  onFechar,
}: {
  pedidoId: number;
  profissional: string;
  /** O valor ao cliente, como a proposta o diz (com IVA e sem IVA ao lado). */
  valor: string | null;
  /** Sem telemóvel, o valor não sai daqui: a reserva fica, e envia-se no cartão. */
  podeEnviar?: boolean;
  onEscolher: (s: SimDoCliente) => void;
  onFechar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-slate-950 p-4 text-sm text-slate-200 shadow-xl">
        <p className="font-semibold text-amber-300">{FALTA_O_SIM_DO_CLIENTE}</p>
        <p className="mt-1 text-xs text-slate-400">
          #{pedidoId} · {profissional}
          {valor ? ` · ${valor}` : ""}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onEscolher("reservar")}
            className="rounded-lg bg-acao px-3 py-2 text-left text-xs font-semibold text-white hover:bg-acao-hover"
          >
            {ESCOLHA_RESERVAR}
            <span className="mt-0.5 block text-[11px] font-normal text-white/80">
              {podeEnviar ? "Abre a proposta no WhatsApp. " : "Sem telemóvel: envie o valor por outro lado. "}
              {profissional} fica reservado e só é avisado quando o cliente disser que sim.
            </span>
          </button>
          <button
            type="button"
            onClick={() => onEscolher("telefone")}
            className="rounded-lg border border-slate-600 px-3 py-2 text-left text-xs font-semibold text-slate-100 hover:bg-slate-800"
          >
            {ESCOLHA_ATRIBUIR_JA}
            <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
              O sim do cliente fica registado em seu nome, e {profissional} é avisado já.
            </span>
          </button>
          <button
            type="button"
            onClick={onFechar}
            className="self-end rounded-lg px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
