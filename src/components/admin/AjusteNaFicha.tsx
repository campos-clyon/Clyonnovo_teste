"use client";

import { useState } from "react";
import { AlertTriangle, MapPin } from "lucide-react";
import type { VistaDoAjuste } from "@/lib/ajuste-no-local";

/**
 * O TRABALHO NO TERRENO, NA FICHA DA AGENDA — 18-10-2026.
 *
 * O que o profissional fez na app: a hora a que saiu e a que chegou, e um
 * ajuste no local por responder. O ajuste é a CLYON a responder em nome do
 * cliente (o cliente ligou em vez de carregar no link) — e nos Trabalhos CLYON
 * de valor fixo, a única que responde. Ver `docs/plano-ajuste-no-local.md` §10.
 */

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit" });

export default function AjusteNaFicha({
  token,
  negociacaoId,
  profissionalNome,
  aCaminhoEm,
  chegouEm,
  ajuste,
  podeDecidir,
  onMudou,
}: {
  token: string;
  negociacaoId: number;
  profissionalNome: string;
  aCaminhoEm?: string | null;
  chegouEm?: string | null;
  ajuste?: VistaDoAjuste | null;
  podeDecidir: boolean;
  onMudou: () => void;
}) {
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const pendente = ajuste?.pendente ?? null;
  const ultimo = ajuste?.ultimo ?? null;

  async function responder(resposta: "aprovar" | "recusar") {
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/ajuste", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ negociacaoId, resposta }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível responder.");
        return;
      }
      onMudou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  if (!aCaminhoEm && !chegouEm && !pendente && !ultimo) return null;

  return (
    <div className="space-y-3">
      {(aCaminhoEm || chegouEm) && (
        <p className="flex items-center gap-2 text-xs text-slate-300">
          <MapPin className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
          {aCaminhoEm ? `A caminho às ${hora(aCaminhoEm)}` : null}
          {aCaminhoEm && chegouEm ? " · " : null}
          {chegouEm ? `chegou às ${hora(chegouEm)}` : null}
        </p>
      )}

      {pendente && (
        <div className="rounded-xl border border-amber-500/60 bg-amber-950/40 p-3">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-200">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {profissionalNome.split(" ")[0]} pede ajuste: {euros(pendente.valorAntigo)} → {euros(pendente.valorNovo)}
          </p>
          <p className="mt-1 text-sm text-amber-100">«{pendente.motivo}»</p>
          {pendente.fotos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {pendente.fotos.map((u, i) => (
                <a key={u} href={u} target="_blank" rel="noreferrer" className="text-xs text-cyan-300 underline">
                  Fotografia {i + 1}
                </a>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-amber-300/90">
            À espera do cliente até às {hora(pendente.expiraEm)}. Responda só se o cliente lhe disse o que quer.
          </p>
          {podeDecidir && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={aEnviar}
                onClick={() => void responder("aprovar")}
                className="min-h-[40px] rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                Aprovar pelo cliente
              </button>
              <button
                type="button"
                disabled={aEnviar}
                onClick={() => void responder("recusar")}
                className="min-h-[40px] rounded-lg border border-slate-600 px-3 text-sm font-semibold text-slate-200 disabled:opacity-60"
              >
                Recusar
              </button>
            </div>
          )}
          {erro && <p className="mt-2 text-xs text-rose-300">{erro}</p>}
        </div>
      )}

      {!pendente && ultimo && (
        <p className="text-xs text-slate-400">
          Último ajuste: {euros(ultimo.valorAntigo)} → {euros(ultimo.valorNovo)} ·{" "}
          {
            {
              aprovado: "aprovado",
              recusado: "recusado",
              expirado: "expirou sem resposta",
              cancelado: "retirado pelo profissional",
              descida: "baixou no local",
              pendente: "à espera",
            }[ultimo.estado]
          }
        </p>
      )}
    </div>
  );
}
