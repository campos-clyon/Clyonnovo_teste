"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import { CAMINHO_DO_SABER_MAIS, NOME_DO_INTERRUPTOR_DO_AVISO } from "@/lib/aviso-aos-profissionais";

/**
 * O INTERRUPTOR «MOSTRAR O AVISO DO NOVO MODELO» — Configs (d11, 15-11-2026).
 *
 * DESLIGADO POR OMISSÃO. Ligado, aparece a faixa do aviso no painel do
 * profissional e abre a página «Saber mais». Só o administrador; para ligar
 * escreve-se LIGAR. A mudança fica no registo permanente.
 */
type Estado = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

export default function InterruptorDoAvisoDoNovoModelo() {
  const { token, ready } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [palavra, setPalavra] = useState("");
  const [erro, setErro] = useState("");
  const [aMudar, setAMudar] = useState(false);

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/aviso-aos-profissionais", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (r.ok) setEstado(((await r.json()) as { interruptor: Estado }).interruptor);
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
      const r = await fetch("/api/admin/aviso-aos-profissionais", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ accao: "interruptor", ligar, confirmacao: palavra }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível mudar.");
        return;
      }
      setEstado(d as Estado);
      setPalavra("");
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

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{NOME_DO_INTERRUPTOR_DO_AVISO}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">
        Ligado, o painel do profissional mostra a faixa do modelo de 15-11 («Saber mais» e «Completar o perfil») e abre a
        página {CAMINHO_DO_SABER_MAIS}, com o texto do email do «Aviso a todos os profissionais». Desligado, nenhuma das
        duas aparece.
      </p>
      <p className="mt-2 text-sm text-slate-200">
        Agora: <span className="font-semibold">{estado ? (ligado ? "LIGADO" : "DESLIGADO") : "…"}</span>
        {quando ? ` (desde ${quando}${estado?.porQuem ? `, por ${estado.porQuem}` : ""})` : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {ligado ? (
          <button
            type="button"
            disabled={aMudar}
            onClick={() => void mudar(false)}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Desligar
          </button>
        ) : (
          <>
            <input
              value={palavra}
              onChange={(e) => setPalavra(e.target.value)}
              placeholder="Escreva LIGAR"
              className="max-w-[180px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <button
              type="button"
              disabled={aMudar || palavra.trim().toUpperCase() !== "LIGAR"}
              onClick={() => void mudar(true)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Ligar
            </button>
          </>
        )}
      </div>
      {erro && <p className="mt-2 text-sm text-red-300">{erro}</p>}
    </div>
  );
}
