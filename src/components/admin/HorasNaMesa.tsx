"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import type { ResumoDasHoras } from "@/lib/horas-do-trabalho";
import { REGRA_DAS_HORAS } from "@/lib/horas-do-trabalho";

/**
 * AS HORAS DE UM TRABALHO POR HORA, NA MESA — 31-10-2026.
 *
 * Lê `GET /api/admin/negociacoes/horas`: início, fim, horas faturadas, o total
 * (sem IVA e o do cliente), os materiais usados, quem confirmou e quando, o
 * «Não concordo» do cliente, e o acerto do dinheiro — a diferença que o
 * cliente ainda paga ou o «a devolver ao cliente», que a equipa trata à mão.
 * «Confirmar as horas» e «Corrigir e confirmar» são só de administradores (a
 * rota recusa aos outros).
 */

type Resposta = {
  marcadas: boolean;
  confirmadas: boolean;
  confirmadasPor: "cliente" | "clyon" | null;
  contestadas: boolean;
  contestacao: string | null;
  estadoTexto: string | null;
  resumo: (Omit<ResumoDasHoras, "marcadasEm" | "confirmadasEm" | "contestadasEm"> & {
    marcadasEm: string | null;
    confirmadasEm: string | null;
    contestadasEm: string | null;
  }) | null;
  materiaisTexto: string | null;
  acerto: { aPagar: number; aDevolver: number; pagoAteAgora: number; final: number; aDevolverTexto: string | null } | null;
};

const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const QUANDO = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const quando = (v: string | null) => (v ? QUANDO.format(new Date(v)) : null);

export default function HorasNaMesa({
  pedidoId,
  negociacaoId,
  onMudou,
}: {
  pedidoId: number;
  negociacaoId: number;
  onMudou: () => void;
}) {
  const { token } = useAdminAuth();
  const [r, setR] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");
  const [aEnviar, setAEnviar] = useState("");
  const [aCorrigir, setACorrigir] = useState(false);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/negociacoes/horas?pedidoId=${pedidoId}&negociacaoId=${negociacaoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) return setErro(dados.error ?? "Não foi possível ler as horas.");
      setR(dados as Resposta);
      setInicio((dados as Resposta).resumo?.inicio ?? "");
      setFim((dados as Resposta).resumo?.fim ?? "");
    } catch {
      setErro("Erro de rede.");
    }
  }, [token, pedidoId, negociacaoId]);

  useEffect(() => {
    void ler();
  }, [ler]);

  async function agir(accao: "confirmar" | "corrigir") {
    if (!token) return;
    const pergunta =
      accao === "confirmar"
        ? "Confirmar estas horas pela CLYON? O total passa a ser o valor do trabalho."
        : `Gravar das ${inicio} às ${fim} e confirmar pela CLYON? O total passa a ser o valor do trabalho.`;
    if (!window.confirm(pergunta)) return;
    setAEnviar(accao);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/horas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        // Os materiais usados ficam como ele os marcou (sem eles, a rota apagava-os).
        body: JSON.stringify({
          pedidoId,
          negociacaoId,
          accao,
          inicio,
          fim,
          materiais: Object.fromEntries((r?.resumo?.materiais ?? []).map((l) => [l.id, l.quantidade])),
        }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) return setErro(dados.error ?? "Não foi possível gravar.");
      setACorrigir(false);
      await ler();
      onMudou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar("");
    }
  }

  if (!r || !r.marcadas || !r.resumo) {
    return erro ? <p className="mt-2 text-xs text-red-300">{erro}</p> : null;
  }
  const h = r.resumo;
  return (
    <section
      aria-label="Horas do trabalho"
      className={`mt-3 rounded-xl border p-3 text-xs ${
        r.contestadas ? "border-red-500/50 bg-red-500/10" : "border-cyan-900/60 bg-slate-950/60"
      }`}
    >
      <p className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-cyan-300">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        Horas do trabalho
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <div>
          <dt className="text-slate-500">Início</dt>
          <dd className="font-semibold tabular-nums text-slate-100">{h.inicio}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Fim</dt>
          <dd className="font-semibold tabular-nums text-slate-100">
            {h.fim}
            {h.passaDaMeiaNoite ? " (dia seguinte)" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Horas faturadas</dt>
          <dd className="font-semibold tabular-nums text-slate-100">{String(h.horas).replace(".", ",")} h</dd>
        </div>
        <div>
          <dt className="text-slate-500">Total</dt>
          <dd className="font-semibold tabular-nums text-emerald-300">
            {eur(h.total)} sem IVA · cliente {eur(h.cliente.total)} com IVA
          </dd>
        </div>
      </dl>
      <p className="mt-1.5 text-slate-400">{h.textoParaAEquipa}</p>
      {h.materiais.length > 0 && (
        <p className="mt-1 text-slate-400">
          Materiais usados: {h.materiais.map((l) => `${l.quantidade} × ${l.nome} (${eur(l.total)})`).join(", ")}
        </p>
      )}
      {r.materiaisTexto && <p className="mt-1 text-slate-500">Na proposta: {r.materiaisTexto}</p>}
      <p className="mt-1 text-slate-500">
        Marcadas {quando(h.marcadasEm) ?? "—"}.{" "}
        {h.confirmadas
          ? `Confirmadas ${h.confirmadasPor === "clyon" ? "pela CLYON" : "pelo cliente"} a ${quando(h.confirmadasEm) ?? "—"}.`
          : "Por confirmar."}{" "}
        {REGRA_DAS_HORAS}
      </p>
      {r.contestadas && (
        <p className="mt-1.5 rounded-md bg-red-500/15 px-2 py-1 font-semibold text-red-200">
          Horas contestadas pelo cliente{h.contestacao ? `: «${h.contestacao}»` : ""}
          {h.contestadasEm ? ` (${quando(h.contestadasEm)})` : ""}. Fale com os dois e corrija ou confirme.
        </p>
      )}
      {r.acerto && r.acerto.aPagar > 0 && (
        <p className="mt-1.5 font-semibold text-amber-200">
          O cliente pagou {eur(r.acerto.pagoAteAgora)}; falta a diferença das horas: {eur(r.acerto.aPagar)} (o cliente paga-a no pedido).
        </p>
      )}
      {r.acerto?.aDevolverTexto && (
        <p className="mt-1.5 rounded-md bg-amber-500/15 px-2 py-1 font-semibold text-amber-100">
          {r.acerto.aDevolverTexto} — o cliente pagou {eur(r.acerto.pagoAteAgora)} e as horas deram {eur(r.acerto.final)}. Devolver à mão.
        </p>
      )}
      {!r.confirmadas && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void agir("confirmar")}
            disabled={aEnviar !== ""}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {aEnviar === "confirmar" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            Confirmar as horas
          </button>
          {aCorrigir ? (
            <>
              <label className="flex items-center gap-1 text-slate-400">
                Início
                <input
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  placeholder="09:00"
                  inputMode="numeric"
                  className="h-8 w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 text-white outline-none focus:border-cyan-600"
                />
              </label>
              <label className="flex items-center gap-1 text-slate-400">
                Fim
                <input
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                  placeholder="13:00"
                  inputMode="numeric"
                  className="h-8 w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 text-white outline-none focus:border-cyan-600"
                />
              </label>
              <button
                type="button"
                onClick={() => void agir("corrigir")}
                disabled={aEnviar !== "" || !inicio || !fim}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-700 px-3 py-1.5 font-semibold text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-40"
              >
                {aEnviar === "corrigir" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                Corrigir e confirmar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setACorrigir(true)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-slate-300 hover:bg-slate-800"
            >
              Corrigir e confirmar
            </button>
          )}
        </div>
      )}
      {erro && <p className="mt-1.5 text-red-300">{erro}</p>}
    </section>
  );
}
