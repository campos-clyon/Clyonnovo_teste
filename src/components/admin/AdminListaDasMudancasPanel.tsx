"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";

/**
 * CONFIGS → «LISTA DE PARCEIROS NAS MUDANÇAS» — 10-11-2026 (fase 2).
 *
 * Ligado (por omissão, pedido do dono): no fim de um pedido de mudança o
 * cliente vê os parceiros com preço e escolhe a quem pede orçamento; o pedido
 * vai logo aos escolhidos. Desligado: volta ao caminho de antes (a Mesa).
 * Muda-o o administrador; um assistente com as Configs só o vê.
 */
export default function AdminListaDasMudancasPanel() {
  const { token } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [ligado, setLigado] = useState<boolean | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch("/api/admin/lista-das-mudancas", { headers: { Authorization: `Bearer ${token}` } });
        const j = (await r.json().catch(() => ({}))) as { ligado?: boolean; error?: string };
        if (!vivo) return;
        if (!r.ok || typeof j.ligado !== "boolean") {
          setAviso(j.error ?? "Não foi possível ler o interruptor.");
          return;
        }
        setLigado(j.ligado);
      } catch {
        if (vivo) setAviso("Não foi possível ler o interruptor.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [token]);

  const mudar = async (novo: boolean) => {
    if (!token) return;
    setAGuardar(true);
    setAviso(null);
    try {
      const r = await fetch("/api/admin/lista-das-mudancas", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ligado: novo }),
      });
      const j = (await r.json().catch(() => ({}))) as { ligado?: boolean; error?: string };
      if (!r.ok || typeof j.ligado !== "boolean") {
        setAviso(j.error ?? "Não foi possível guardar.");
        return;
      }
      setLigado(j.ligado);
      setAviso("Guardado.");
    } catch {
      setAviso("Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Lista de parceiros nas mudanças</p>
      <p className="mt-1 mb-3 text-sm leading-6 text-slate-300">
        Ligada: no fim de um pedido de mudança, o cliente vê os parceiros com preço na zona dele e escolhe até três; o
        pedido vai logo aos escolhidos, com a tarifa de cada um congelada, e aparece na Mesa com o prazo de resposta.
        Desligada: as mudanças voltam ao caminho de antes e esperam pela Mesa.
      </p>
      {ligado === null && !aviso && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />}
      {ligado !== null && (
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              ligado ? "bg-emerald-500/20 text-emerald-200" : "bg-slate-700/60 text-slate-300"
            }`}
          >
            {ligado ? "Ligada" : "Desligada"}
          </span>
          {eAdministrador ? (
            <button
              type="button"
              onClick={() => void mudar(!ligado)}
              disabled={aGuardar}
              className="flex items-center gap-1.5 rounded-lg bg-acao px-3 py-1.5 text-xs font-bold text-white transition hover:bg-acao-hover disabled:opacity-50"
            >
              {aGuardar && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {ligado ? "Desligar" : "Ligar"}
            </button>
          ) : (
            <span className="text-xs text-slate-400">Só o administrador muda este interruptor.</span>
          )}
        </div>
      )}
      {aviso && <p className="mt-2 text-xs text-slate-300">{aviso}</p>}
    </div>
  );
}
