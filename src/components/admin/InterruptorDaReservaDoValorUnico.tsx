"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import { esquecerAReservaLida } from "@/hooks/useReservaDoValorUnico";
import { MOTIVO_DA_RESERVA_RETIRADA, NOME_DO_INTERRUPTOR_DA_RESERVA } from "@/lib/reserva";
import { CONFIRMACAO_DO_REFAZER } from "@/lib/refazer-sem-reserva";

/**
 * O INTERRUPTOR «RESERVA DO VALOR ÚNICO» — Configs (d101, dono, 24-11-2026).
 *
 * DESLIGADO POR OMISSÃO: a reserva para imprevistos (d39) não se grava e as já
 * gravadas não contam — o parceiro passa à CLYON só a taxa da plataforma e o
 * IVA dela. Só o administrador o vê e muda; para ligar escreve-se LIGAR.
 *
 * Por baixo, os trabalhos com reserva gravada e o «Refazer as referências»
 * (`/api/admin/reserva-do-valor-unico/refazer`): só os que não estão pagos;
 * os pagos ficam à parte, para o dono decidir.
 */
type Estado = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };
type Trabalho = {
  pedidoId: number;
  negociacaoId: number;
  valorUnico: number | null;
  valorAcordado: number | null;
  reservaGravada: number;
  estadoEmPalavras: string;
  estado: string;
  pendentes: Array<{ pagamentoId: number; valor: number }>;
};

const euros = (v: number | null) => (v == null ? "—" : `${v.toFixed(2).replace(".", ",")} €`);

export default function InterruptorDaReservaDoValorUnico() {
  const { token, ready } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [palavra, setPalavra] = useState("");
  const [erro, setErro] = useState("");
  const [aMudar, setAMudar] = useState(false);
  const [trabalhos, setTrabalhos] = useState<Trabalho[] | null>(null);
  const [refazer, setRefazer] = useState("");
  const [resultado, setResultado] = useState("");

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/reserva-do-valor-unico/refazer", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (r.ok) {
        const d = (await r.json()) as { interruptor: Estado; trabalhos: Trabalho[] };
        setEstado(d.interruptor);
        setTrabalhos(d.trabalhos);
      }
    } catch {
      /* fica o que se tinha */
    }
  }, [token]);

  useEffect(() => {
    if (ready && eAdministrador) void ler();
  }, [ready, eAdministrador, ler]);

  async function mudar(ligar: boolean) {
    if (!token) return;
    setAMudar(true);
    setErro("");
    try {
      const r = await fetch("/api/admin/reserva-do-valor-unico/interruptor", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ligar, confirmacao: palavra }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível mudar.");
        return;
      }
      setEstado(d as Estado);
      setPalavra("");
      esquecerAReservaLida();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAMudar(false);
    }
  }

  async function refazerAsReferencias() {
    if (!token) return;
    setAMudar(true);
    setErro("");
    setResultado("");
    try {
      const r = await fetch("/api/admin/reserva-do-valor-unico/refazer", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ confirmacao: refazer }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível refazer.");
        return;
      }
      const refeitas = (d.refeitas ?? []) as Array<{ pedidoId: number; nova: { valor: number } | null; porqueSemNova: string | null }>;
      const pagas = (d.pagas ?? []) as Trabalho[];
      const porVer = (d.porVer ?? []) as Array<Trabalho & { porque: string }>;
      setResultado(
        [
          ...refeitas.map((x) => `#${x.pedidoId}: ${x.nova ? `nova referência de ${euros(x.nova.valor)}` : `sem referência nova (${x.porqueSemNova ?? "—"})`}`),
          ...pagas.map((x) => `#${x.pedidoId}: já pago — não se mexeu (para o dono decidir)`),
          ...porVer.map((x) => `#${x.pedidoId}: não se mexeu — ${x.porque}`),
        ].join("\n") || "Nada a refazer.",
      );
      setRefazer("");
      void ler();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAMudar(false);
    }
  }

  if (!eAdministrador) return null;
  const ligado = estado?.ligado === true;
  const quando = estado?.mudadoEm
    ? new Date(estado.mudadoEm).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" })
    : null;
  const porRefazer = (trabalhos ?? []).filter((t) => t.estado !== "pago");

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{NOME_DO_INTERRUPTOR_DA_RESERVA}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">
        Num pedido com valor único, a diferença entre o valor único e a proposta aceite ficava como reserva para imprevistos, na
        parte da CLYON. Desligado, não se grava nem conta: o parceiro passa à CLYON só a taxa da plataforma e o IVA dela.
      </p>
      <p className={`mt-2 text-sm font-semibold ${ligado ? "text-red-300" : "text-amber-200"}`}>
        {estado == null ? "A ler…" : ligado ? "LIGADO" : "Desligado — a reserva não se grava nem conta"}
        {quando && <span className="ml-2 text-xs font-normal text-slate-400">({quando}{estado?.porQuem ? `, ${estado.porQuem}` : ""})</span>}
      </p>
      {erro && <p className="mt-2 text-xs text-red-300">{erro}</p>}
      {estado != null &&
        (ligado ? (
          <button
            type="button"
            onClick={() => mudar(false)}
            disabled={aMudar}
            className="mt-3 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50"
          >
            Desligar
          </button>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={palavra}
              onChange={(e) => setPalavra(e.target.value)}
              placeholder="Escreva LIGAR"
              aria-label="Escreva LIGAR para ligar a reserva do valor único"
              className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={() => mudar(true)}
              disabled={aMudar || palavra.trim().toUpperCase() !== "LIGAR"}
              className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-200 disabled:opacity-40"
            >
              Ligar (só com o sim do dono)
            </button>
          </div>
        ))}

      {trabalhos != null && trabalhos.length > 0 && (
        <div className="mt-4 border-t border-slate-800 pt-3">
          <p className="text-xs font-semibold text-slate-300">Trabalhos com reserva gravada</p>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
            {trabalhos.map((t) => (
              <li key={t.negociacaoId}>
                #{t.pedidoId} (negociação #{t.negociacaoId}) · valor único {euros(t.valorUnico)} · acordado {euros(t.valorAcordado)} · reserva{" "}
                {euros(t.reservaGravada)} · parte da CLYON: {t.estadoEmPalavras}
                {t.pendentes.length > 0 ? ` (${t.pendentes.map((p) => euros(p.valor)).join(", ")})` : ""}
              </li>
            ))}
          </ul>
          {!ligado && porRefazer.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={refazer}
                onChange={(e) => setRefazer(e.target.value)}
                placeholder={`Escreva ${CONFIRMACAO_DO_REFAZER}`}
                aria-label={`Escreva ${CONFIRMACAO_DO_REFAZER} para refazer as referências sem a reserva`}
                className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={refazerAsReferencias}
                disabled={aMudar || refazer.trim().toUpperCase() !== CONFIRMACAO_DO_REFAZER}
                className="rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs font-semibold text-amber-200 disabled:opacity-40"
              >
                Refazer as referências sem a reserva ({porRefazer.length})
              </button>
              <span className="text-[11px] text-slate-500">Motivo: «{MOTIVO_DA_RESERVA_RETIRADA}». As pagas não se mexem.</span>
            </div>
          )}
          {resultado && <pre className="mt-2 whitespace-pre-wrap text-[11px] text-slate-300">{resultado}</pre>}
        </div>
      )}
    </div>
  );
}
