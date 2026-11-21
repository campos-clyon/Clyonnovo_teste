"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import EnviarValorFinalAoCliente from "@/components/admin/EnviarValorFinalAoCliente";
import { ROTULO_DO_BOTAO, emEuros } from "@/lib/cliente-paga-a-clyon";
import { isMudancaType } from "@/lib/calendar-helpers";

/**
 * «O CLIENTE PAGA À CLYON» — d82 (CEO e dono, 21-11-2026). Nos Pagamentos e no
 * cartão da Mesa / Trabalhos CLYON, só do administrador, num Trabalho CLYON do
 * modelo de 15-11. Abre um diálogo da própria página (nunca o `confirm()` do
 * navegador): o motivo, com / sem fatura e, num valor «por carga», passar a
 * valor total. «Ver a conta» pergunta ao servidor (a mesma conta que grava) e
 * só «Confirmar» grava. Depois de passado, mostra quando e porquê, o «Enviar o
 * valor final ao cliente» (fora das mudanças, que o têm na folha final) e o
 * «Desfazer», com motivo. Não envia nada a ninguém.
 */

type Passagem = { em: string | Date | null; por: string | null; motivo: string | null } | null;

type Dialogo = { base: "total" | "carga" | "hora"; valor: number | null; taxa: number | null };

type Previa = {
  frase: string;
  depois?: { clientePaga: number; comFatura: boolean; profissionalRecebe: number; clyon: number };
  referenciasCanceladas: { pagamentoId: number; valor: number }[];
};

const QUANDO = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function ClientePagaAClyon({
  pedidoId,
  negociacaoId,
  servico,
  novoModelo,
  passagem,
  onMudou,
}: {
  pedidoId: number;
  negociacaoId: number;
  servico: string | null;
  /** O trabalho segue o modelo de 15-11 (o cliente paga ao parceiro). */
  novoModelo: boolean;
  passagem: Passagem;
  onMudou?: () => void;
}) {
  const { token } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [aberto, setAberto] = useState<null | "passar" | "desfazer">(null);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [motivo, setMotivo] = useState("");
  const [fatura, setFatura] = useState<"com" | "sem" | null>(null);
  const [paraTotal, setParaTotal] = useState(false);
  const [valorTotal, setValorTotal] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  if (!eAdministrador) return null;
  if (!passagem && !novoModelo) return null;

  function fechar() {
    setAberto(null);
    setPrevia(null);
    setErro(null);
    setMotivo("");
    setFatura(null);
    setParaTotal(false);
  }

  async function abrir(accao: "passar" | "desfazer") {
    setAberto(accao);
    setPrevia(null);
    setErro(null);
    setFeito(null);
    if (accao !== "passar" || !token) return;
    try {
      const res = await fetch(`/api/admin/pagamentos/cliente-paga-a-clyon?negociacaoId=${negociacaoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setErro((j.error as string) ?? "Não foi possível ler o trabalho.");
        return;
      }
      const d = { base: j.base as Dialogo["base"], valor: (j.valor as number) ?? null, taxa: (j.taxa as number) ?? null };
      setDialogo(d);
      if (d.valor != null) setValorTotal(d.valor.toFixed(2).replace(".", ","));
    } catch {
      setErro("Erro de rede.");
    }
  }

  async function pedir(previsualizar: boolean) {
    if (!token || !aberto) return;
    setOcupado(true);
    setErro(null);
    try {
      const corpo: Record<string, unknown> = { accao: aberto, negociacaoId, motivo, previsualizar };
      if (aberto === "passar") {
        corpo.fatura = fatura;
        if (dialogo?.base === "carga" && paraTotal) corpo.valorTotal = valorTotal;
      }
      const res = await fetch("/api/admin/pagamentos/cliente-paga-a-clyon", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setErro((j.error as string) ?? "Não foi possível.");
        return;
      }
      if (previsualizar) {
        setPrevia({
          frase: String(j.frase ?? ""),
          depois: j.depois as Previa["depois"],
          referenciasCanceladas: (j.referenciasCanceladas as Previa["referenciasCanceladas"]) ?? [],
        });
        return;
      }
      setFeito(String(j.feito ?? "Feito."));
      fechar();
      onMudou?.();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(false);
    }
  }

  const podeVer = motivo.trim().length >= 3 && (aberto === "desfazer" || fatura != null);
  const quando = passagem?.em ? QUANDO.format(new Date(passagem.em)) : null;

  return (
    <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs">
      {passagem ? (
        <>
          <p className="font-semibold text-emerald-300">O cliente paga à CLYON</p>
          <p className="mt-1 text-slate-300">
            {quando ? `Desde ${quando}` : "Passado"}
            {passagem.por ? `, por ${passagem.por}` : ""}
            {passagem.motivo ? ` — «${passagem.motivo}»` : ""}. A CLYON paga ao profissional; a taxa já não está na carteira do parceiro.
          </p>
          {!isMudancaType(servico ?? "") && (
            <div className="mt-2">
              <EnviarValorFinalAoCliente pedidoId={pedidoId} negociacaoId={negociacaoId} />
            </div>
          )}
          <button
            type="button"
            onClick={() => void abrir("desfazer")}
            className="mt-2 rounded-lg border border-slate-700 px-2.5 py-1 font-medium text-slate-300 hover:bg-slate-800/60"
          >
            Desfazer
          </button>
        </>
      ) : (
        <>
          <p className="text-slate-400">
            O parceiro pediu ao cliente que pagasse à CLYON? Passa este trabalho ao caminho em que a CLYON recebe do
            cliente e paga ao profissional.
          </p>
          <button
            type="button"
            onClick={() => void abrir("passar")}
            className="mt-2 rounded-lg border border-amber-600/60 bg-amber-500/10 px-2.5 py-1.5 font-semibold text-amber-200 hover:bg-amber-500/20"
          >
            {ROTULO_DO_BOTAO}
          </button>
        </>
      )}
      {feito && <p className="mt-2 text-emerald-300">{feito}</p>}

      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={aberto === "passar" ? ROTULO_DO_BOTAO : "Desfazer"}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !ocupado) fechar();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200 shadow-xl">
            <p className="text-base font-semibold text-white">
              {aberto === "passar" ? `${ROTULO_DO_BOTAO} — #${pedidoId}` : `Desfazer — #${pedidoId}`}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {aberto === "passar"
                ? "A CLYON recebe do cliente e paga ao profissional (o valor menos a taxa). As referências por pagar da taxa do parceiro ficam canceladas. Não se envia nada a ninguém."
                : "O cliente volta a pagar ao parceiro, e o parceiro passa à CLYON a taxa e o IVA dela. A fatura e o valor voltam ao que eram. As referências por pagar do cliente ficam canceladas."}
            </p>

            <label className="mt-3 block text-xs font-semibold text-slate-300">
              Motivo
              <textarea
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value);
                  setPrevia(null);
                }}
                rows={2}
                maxLength={300}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm font-normal text-slate-100"
              />
            </label>

            {aberto === "passar" && (
              <>
                <fieldset className="mt-3">
                  <legend className="text-xs font-semibold text-slate-300">Fatura</legend>
                  <div className="mt-1 flex gap-3">
                    {(["com", "sem"] as const).map((f) => (
                      <label key={f} className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={`fatura-${negociacaoId}`}
                          checked={fatura === f}
                          onChange={() => {
                            setFatura(f);
                            setPrevia(null);
                          }}
                        />
                        {f === "com" ? "Com fatura" : "Sem fatura"}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {dialogo?.base === "carga" && (
                  <div className="mt-3">
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={paraTotal}
                        onChange={(e) => {
                          setParaTotal(e.target.checked);
                          setPrevia(null);
                        }}
                      />
                      Passar o valor por carga a valor total
                    </label>
                    {paraTotal && (
                      <input
                        inputMode="decimal"
                        value={valorTotal}
                        onChange={(e) => {
                          setValorTotal(e.target.value);
                          setPrevia(null);
                        }}
                        aria-label="Valor total sem IVA"
                        className="mt-1 w-32 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                      />
                    )}
                    {paraTotal && <span className="ml-1.5 text-xs text-slate-400">€ sem IVA</span>}
                  </div>
                )}
              </>
            )}

            {previa && (
              <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/60 p-2.5 text-xs">
                {previa.depois && (
                  <ul className="space-y-0.5">
                    <li>
                      O cliente paga à CLYON: <strong>{emEuros(previa.depois.clientePaga)}</strong>
                      {previa.depois.comFatura ? " com IVA" : " (sem fatura)"}
                    </li>
                    <li>A CLYON paga ao profissional: {emEuros(previa.depois.profissionalRecebe)}</li>
                    <li>Fica para a CLYON: {emEuros(previa.depois.clyon)}</li>
                  </ul>
                )}
                {previa.referenciasCanceladas.length > 0 && (
                  <p className="mt-1 text-amber-200/90">
                    Referências por pagar a cancelar:{" "}
                    {previa.referenciasCanceladas.map((r) => emEuros(r.valor)).join(", ")}
                  </p>
                )}
                <p className="mt-1 text-slate-400">{previa.frase}</p>
              </div>
            )}
            {erro && <p className="mt-2 text-xs text-rose-300">{erro}</p>}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={fechar}
                disabled={ocupado}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                Fechar
              </button>
              {!previa ? (
                <button
                  type="button"
                  onClick={() => void pedir(true)}
                  disabled={!podeVer || ocupado}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-40"
                >
                  {ocupado && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                  Ver a conta
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void pedir(false)}
                  disabled={ocupado}
                  className="flex items-center gap-1.5 rounded-lg bg-acao px-3 py-1.5 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
                >
                  {ocupado && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                  Confirmar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
