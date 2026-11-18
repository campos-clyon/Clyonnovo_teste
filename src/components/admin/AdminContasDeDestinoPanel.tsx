"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import {
  MAXIMO_DE_CONTAS_DE_DESTINO,
  TAMANHO_DO_NOME_DA_CONTA,
  rotuloDaConta,
  type ContaDeDestino,
} from "@/lib/contas-de-destino";

/**
 * CONFIGS → «CONTAS ONDE ENTRAM AS TRANSFERÊNCIAS» — d66 (18-11-2026).
 *
 * Cada transferência registada à mão («Já recebemos», as partes da cobrança ao
 * profissional) diz em que conta entrou, escolhida desta lista. Só o nome e,
 * se quiser, os últimos 4 dígitos — nunca o IBAN inteiro. Muda-a o
 * administrador; um assistente com as Configs só a vê. Mudar a lista não
 * reescreve os pagamentos já registados: cada um guarda o nome do momento.
 */
type Linha = { id?: string; nome: string; ultimos4: string };

export default function AdminContasDeDestinoPanel() {
  const { token } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [guardadas, setGuardadas] = useState<ContaDeDestino[]>([]);
  const [lido, setLido] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const mostrar = (contas: ContaDeDestino[]) => {
    setGuardadas(contas);
    setLinhas(contas.map((c) => ({ id: c.id, nome: c.nome, ultimos4: c.ultimos4 ?? "" })));
  };

  useEffect(() => {
    if (!token) return;
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch("/api/admin/contas-de-destino", { headers: { Authorization: `Bearer ${token}` } });
        const j = (await r.json().catch(() => ({}))) as { contas?: ContaDeDestino[]; error?: string };
        if (!vivo) return;
        if (!r.ok) {
          setAviso(j.error ?? "Não foi possível ler as contas.");
          return;
        }
        mostrar(Array.isArray(j.contas) ? j.contas : []);
        setLido(true);
      } catch {
        if (vivo) setAviso("Não foi possível ler as contas.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [token]);

  const guardar = async () => {
    if (!token) return;
    setAGuardar(true);
    setAviso(null);
    try {
      const r = await fetch("/api/admin/contas-de-destino", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contas: linhas.map((l) => ({ id: l.id, nome: l.nome, ultimos4: l.ultimos4 })) }),
      });
      const j = (await r.json().catch(() => ({}))) as { contas?: ContaDeDestino[]; error?: string };
      if (!r.ok) {
        setAviso(j.error ?? "Não foi possível guardar.");
        return;
      }
      mostrar(Array.isArray(j.contas) ? j.contas : []);
      setAviso("Guardado.");
    } catch {
      setAviso("Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  };

  const mudar = (i: number, d: Partial<Linha>) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...d } : l)));
  const campo =
    "rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none";

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Contas onde entram as transferências</p>
      <p className="mt-1 mb-3 text-sm leading-6 text-slate-300">
        Quem regista uma transferência à mão diz em que conta entrou. Só o nome e os últimos 4 dígitos — nunca o IBAN
        inteiro. Os pagamentos já registados guardam o nome que tinham.
      </p>
      {eAdministrador ? (
        <>
          <ul className="space-y-2">
            {linhas.map((l, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <input
                  value={l.nome}
                  onChange={(e) => mudar(i, { nome: e.target.value })}
                  maxLength={TAMANHO_DO_NOME_DA_CONTA}
                  placeholder="Nome da conta"
                  aria-label="Nome da conta"
                  className={`${campo} min-w-[12rem] flex-1`}
                />
                <input
                  value={l.ultimos4}
                  onChange={(e) => mudar(i, { ultimos4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  inputMode="numeric"
                  placeholder="Últimos 4"
                  aria-label="Últimos 4 dígitos"
                  className={`${campo} w-24 tabular-nums`}
                />
                <button
                  type="button"
                  onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}
                  aria-label={`Tirar ${l.nome || "esta conta"}`}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!lido || linhas.length >= MAXIMO_DE_CONTAS_DE_DESTINO}
              onClick={() => setLinhas((ls) => [...ls, { nome: "", ultimos4: "" }])}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Juntar conta
            </button>
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={!lido || aGuardar}
              className="flex items-center gap-1.5 rounded-lg bg-acao px-3 py-1.5 text-xs font-bold text-white transition hover:bg-acao-hover disabled:opacity-50"
            >
              {aGuardar && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Guardar
            </button>
            {aviso && <span className="text-xs text-slate-300">{aviso}</span>}
          </div>
        </>
      ) : (
        <>
          <ul className="space-y-1 text-sm text-slate-200">
            {guardadas.map((c) => (
              <li key={c.id}>{rotuloDaConta(c)}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-400">Só o administrador muda esta lista.</p>
          {aviso && <p className="mt-1 text-xs text-slate-300">{aviso}</p>}
        </>
      )}
    </div>
  );
}
