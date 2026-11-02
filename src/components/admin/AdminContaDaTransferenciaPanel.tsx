"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import { LIMITE_DA_TRANSFERENCIA, ibanValido } from "@/lib/transferencia-bancaria";

/**
 * CONFIGS → «CONTA PARA A TRANSFERÊNCIA BANCÁRIA» — 02-11-2026.
 *
 * O IBAN e o titular que o cliente vê na página de pagar quando o total com
 * IVA chega a `LIMITE_DA_TRANSFERENCIA`. Só o administrador os vê e muda; vazio,
 * o método não aparece a ninguém.
 */
export default function AdminContaDaTransferenciaPanel() {
  const { token } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [guardada, setGuardada] = useState<{ iban: string; titular: string } | null>(null);
  const [iban, setIban] = useState("");
  const [titular, setTitular] = useState("");
  const [lido, setLido] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !eAdministrador) return;
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch("/api/admin/conta-da-transferencia", { headers: { Authorization: `Bearer ${token}` } });
        const j = (await r.json().catch(() => ({}))) as {
          conta?: { iban: string; titular: string } | null;
          error?: string;
        };
        if (!vivo) return;
        if (!r.ok) {
          setAviso(j.error ?? "Não foi possível ler a conta.");
          return;
        }
        setGuardada(j.conta ?? null);
        setIban(j.conta?.iban ?? "");
        setTitular(j.conta?.titular ?? "");
        setLido(true);
      } catch {
        if (vivo) setAviso("Não foi possível ler a conta.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [token, eAdministrador]);

  const guardar = async () => {
    if (!token) return;
    setAGuardar(true);
    setAviso(null);
    try {
      const r = await fetch("/api/admin/conta-da-transferencia", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ iban, titular }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        conta?: { iban: string; titular: string } | null;
        error?: string;
      };
      if (!r.ok) {
        setAviso(j.error ?? "Não foi possível guardar.");
        return;
      }
      setGuardada(j.conta ?? null);
      setIban(j.conta?.iban ?? "");
      setTitular(j.conta?.titular ?? "");
      setAviso("Guardado.");
    } catch {
      setAviso("Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  };

  const limite = `${LIMITE_DA_TRANSFERENCIA} €`;
  const mudou = (guardada?.iban ?? "") !== iban.trim() || (guardada?.titular ?? "") !== titular.trim();
  const ibanMal = iban.trim() !== "" && !ibanValido(iban);

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        Conta para a transferência bancária
      </p>
      <p className="mt-1 mb-3 text-sm leading-6 text-slate-300">
        Em pedidos de {limite} ou mais (com IVA), o cliente pode pagar por transferência para esta
        conta, com «Pedido #número» no descritivo. Quando o dinheiro entrar, registe-o em Pagamentos →
        «Recebido» → transferência. Sem conta escrita, o método não aparece.
      </p>
      {!eAdministrador ? (
        <p className="text-xs text-slate-400">Só o administrador vê e muda esta conta.</p>
      ) : (
        <>
          {lido && !guardada && (
            <p className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Ainda não há conta: o cliente só vê MB WAY e Multibanco.
            </p>
          )}
          <label className="block text-xs text-slate-400">
            IBAN
            <input
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              disabled={!lido}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
            />
          </label>
          {ibanMal && <p className="mt-1 text-xs text-rose-300">Este IBAN não confere — veja os dígitos.</p>}
          <label className="mt-2 block text-xs text-slate-400">
            Titular
            <input
              value={titular}
              onChange={(e) => setTitular(e.target.value)}
              disabled={!lido}
              maxLength={120}
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={!lido || aGuardar || !mudou || ibanMal}
              className="flex items-center gap-1.5 rounded-lg bg-acao px-3 py-1.5 text-xs font-bold text-white transition hover:bg-acao-hover disabled:opacity-50"
            >
              {aGuardar && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Guardar
            </button>
            {aviso && <span className="text-xs text-slate-300">{aviso}</span>}
          </div>
        </>
      )}
    </div>
  );
}
