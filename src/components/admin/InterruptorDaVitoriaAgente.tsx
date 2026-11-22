"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";

/**
 * «VITÓRIA AGENTE — ENSAIO» NAS CONFIGS — d85, fase 0 (22-11-2026).
 *
 * DESLIGADO POR OMISSÃO. Ligado, depois de cada resposta da Vitória de hoje
 * (as regras continuam a responder), o agente com o Claude corre ao lado e
 * grava o que teria dito e feito — nunca envia. Aqui: o interruptor (para
 * ligar escreve-se LIGAR), o tecto diário em dólares, e o termómetro (a
 * chave, o gasto de hoje e do mês, os tokens com os da cache, as últimas
 * chamadas). Só o administrador. O nome é o de `NOME_DO_INTERRUPTOR_DO_ENSAIO`.
 */
type Totais = {
  chamadas: number;
  erros: number;
  custoUsd: number;
  tokensEntrada: number;
  tokensSaida: number;
  tokensCacheLidos: number;
  tokensCacheEscritos: number;
};
type Termometro = {
  ensaio: { ligado: boolean; mudadoEm: string | null; porQuem: string | null };
  chave: { existe: boolean; porque: string | null };
  modelo: string;
  tectoUsd: number;
  hoje: Totais;
  mes: Totais;
  passouOTecto: boolean;
  ultimas: Array<{ em: string; modelo: string | null; tokensEntrada: number; tokensSaida: number; tokensCacheLidos: number; custoUsd: number; erro: string | null }>;
};

const NOME = "Vitória agente — ensaio";
const ROTA = "/api/admin/vitoria-agente";

const usd = (v: number) => `${v.toFixed(v < 1 ? 4 : 2)} USD`;
const mil = (v: number) => new Intl.NumberFormat("pt-PT").format(v);
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" });

export default function InterruptorDaVitoriaAgente() {
  const { token, ready } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [estado, setEstado] = useState<Termometro | null>(null);
  const [palavra, setPalavra] = useState("");
  const [tecto, setTecto] = useState("");
  const [erro, setErro] = useState("");
  const [aMudar, setAMudar] = useState(false);

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(ROTA, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (r.ok) setEstado((await r.json()) as Termometro);
    } catch {
      /* fica o que se tinha */
    }
  }, [token]);

  useEffect(() => {
    if (ready && eAdministrador) void ler();
  }, [ready, eAdministrador, ler]);

  async function enviar(corpo: Record<string, unknown>) {
    if (!token) return;
    setAMudar(true);
    setErro("");
    try {
      const r = await fetch(ROTA, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível mudar.");
        return;
      }
      setEstado(d as Termometro);
      setPalavra("");
      setTecto("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAMudar(false);
    }
  }

  if (!eAdministrador) return null;
  const ligado = estado?.ensaio.ligado === true;

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{NOME}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">
        Ligado, depois de cada resposta da Vitória o agente (Claude) lê a mesma conversa, sem dados de pessoas, e grava o
        que teria dito e feito, para comparar no «Ensaio da Vitória» (WhatsApp › Lições). Nunca envia nada a ninguém: as
        respostas continuam a ser as de hoje. Passado o tecto do dia, pára até amanhã.
      </p>
      <p className={`mt-2 text-sm font-semibold ${ligado ? "text-red-300" : "text-amber-200"}`}>
        {estado == null ? "A ler…" : ligado ? "LIGADO (ensaio, nada sai)" : "Desligado"}
        {estado?.ensaio.mudadoEm && (
          <span className="ml-2 text-xs font-normal text-slate-400">
            ({quando(estado.ensaio.mudadoEm)}
            {estado.ensaio.porQuem ? `, ${estado.ensaio.porQuem}` : ""})
          </span>
        )}
      </p>
      {estado && !estado.chave.existe && <p className="mt-2 text-xs text-amber-300">{estado.chave.porque}</p>}
      {erro && <p className="mt-2 text-xs text-red-300">{erro}</p>}

      {estado != null &&
        (ligado ? (
          <button
            type="button"
            onClick={() => enviar({ ligar: false })}
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
              aria-label="Escreva LIGAR para ligar o ensaio da Vitória agente"
              className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={() => enviar({ ligar: true, confirmacao: palavra })}
              disabled={aMudar || palavra.trim().toUpperCase() !== "LIGAR"}
              className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-200 disabled:opacity-40"
            >
              Ligar o ensaio (só com o sim do dono)
            </button>
          </div>
        ))}

      {estado != null && (
        <div className="mt-4 space-y-2 text-xs text-slate-300">
          <p>
            Modelo: <span className="font-semibold text-slate-100">{estado.modelo}</span> · Tecto diário:{" "}
            <span className="font-semibold text-slate-100">{usd(estado.tectoUsd)}</span>
            {estado.passouOTecto && <span className="ml-2 font-semibold text-red-300">tecto atingido hoje — volta às regras</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={tecto}
              onChange={(e) => setTecto(e.target.value)}
              inputMode="decimal"
              placeholder="Novo tecto (USD/dia)"
              aria-label="Novo tecto diário em dólares"
              className="w-40 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={() => enviar({ tecto })}
              disabled={aMudar || !tecto.trim()}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-40"
            >
              Guardar o tecto
            </button>
          </div>
          <table className="w-full max-w-xl text-left">
            <thead className="text-slate-400">
              <tr>
                <th className="py-1 font-medium" />
                <th className="py-1 font-medium">Chamadas</th>
                <th className="py-1 font-medium">Erros</th>
                <th className="py-1 font-medium">Tokens (entrada / saída)</th>
                <th className="py-1 font-medium">Da cache</th>
                <th className="py-1 font-medium">Custo</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Hoje", estado.hoje],
                  ["Este mês", estado.mes],
                ] as const
              ).map(([rotulo, t]) => (
                <tr key={rotulo} className="border-t border-slate-800">
                  <td className="py-1 text-slate-400">{rotulo}</td>
                  <td className="py-1">{mil(t.chamadas)}</td>
                  <td className={`py-1 ${t.erros ? "text-red-300" : ""}`}>{mil(t.erros)}</td>
                  <td className="py-1">
                    {mil(t.tokensEntrada)} / {mil(t.tokensSaida)}
                  </td>
                  <td className="py-1">{mil(t.tokensCacheLidos)}</td>
                  <td className="py-1">{usd(t.custoUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {estado.ultimas.length > 0 && (
            <details>
              <summary className="cursor-pointer text-slate-400">Últimas chamadas</summary>
              <ul className="mt-1 space-y-0.5">
                {estado.ultimas.map((c, i) => (
                  <li key={`${c.em}-${i}`}>
                    {quando(c.em)} · {c.modelo ?? "?"} · {mil(c.tokensEntrada)}/{mil(c.tokensSaida)} · cache {mil(c.tokensCacheLidos)} ·{" "}
                    {usd(c.custoUsd)}
                    {c.erro && <span className="ml-1 text-red-300">{c.erro}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
