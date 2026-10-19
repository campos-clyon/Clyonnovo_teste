"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

// Saiu da Mesa das negociações a 19-10-2026, para os Trabalhos CLYON o usarem também.
/**
 * TROCAR A EMPRESA DE UM TRABALHO FECHADO — 01-10-2026.
 *
 * «Esse trabalho já foi concluído por outra empresa — como é que o admin pode
 * finalizar o pedido, e até editar a empresa?» O negócio passa tal como
 * estava: o mesmo valor e as mesmas taxas. Ver
 * `passarOTrabalhoAOutroProfissional`.
 *
 * A lista é a dos profissionais activos — a mesma de «Escolher» no envio —, e
 * não só os que receberam o pedido: quem o fez pode nunca o ter recebido.
 */
export default function TrocarProfissional({
  pedidoId,
  actualProviderId,
  actualNome,
  onMudou,
}: {
  pedidoId: number;
  actualProviderId: number;
  actualNome: string;
  onMudou: () => void;
}) {
  const { token } = useAdminAuth();
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Array<{ id: number; nome: string }> | null>(null);
  const [escolhido, setEscolhido] = useState<number | "">("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto || lista || !token) return;
    let vivo = true;
    fetch(`/api/admin/negociacoes/alcance?pedidoId=${pedidoId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!vivo) return;
        if (!r.ok) {
          setErro(d.error ?? "Não foi possível ler os profissionais.");
          return;
        }
        setLista(
          ((d.todos ?? []) as Array<{ id: number; nome: string }>)
            .filter((p) => p.id !== actualProviderId)
            .sort((a, b) => a.nome.localeCompare(b.nome)),
        );
      })
      .catch(() => {
        if (vivo) setErro("Erro de rede.");
      });
    return () => {
      vivo = false;
    };
  }, [aberto, lista, token, pedidoId, actualProviderId]);

  const nomeEscolhido = lista?.find((p) => p.id === escolhido)?.nome ?? "";

  const trocar = async () => {
    if (!token || escolhido === "") return;
    if (
      !window.confirm(
        `Passar este trabalho de ${actualNome} para ${nomeEscolhido}?\n\n` +
          `Fica com o mesmo valor e as mesmas taxas. ${actualNome} deixa de o ter. Ninguém é avisado.`,
      )
    )
      return;
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/trocar-profissional", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId, providerId: escolhido }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(d.error ?? "Não foi possível trocar.");
        return;
      }
      setAberto(false);
      onMudou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  };

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        title="Foi outra empresa a fazer o trabalho — passa-o para ela, com o mesmo valor"
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Trocar empresa
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/50 p-3">
      <p className="text-xs font-semibold text-slate-200">
        Quem fez este trabalho, em vez de {actualNome}?
      </p>
      {!lista && !erro && (
        <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />A ler os profissionais…
        </p>
      )}
      {lista && (
        <select
          value={escolhido}
          onChange={(e) => setEscolhido(e.target.value ? Number(e.target.value) : "")}
          className="mt-2 w-full max-w-sm rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white"
        >
          <option value="">Escolha a empresa…</option>
          {lista.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      )}
      {erro && <p className="mt-2 text-xs text-red-300">{erro}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          onClick={() => void trocar()}
          disabled={aEnviar || escolhido === ""}
          className="rounded-lg bg-acao px-3 py-1.5 text-xs font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
        >
          {aEnviar ? "A trocar…" : nomeEscolhido ? `Passar para ${nomeEscolhido}` : "Passar o trabalho"}
        </button>
        <button
          onClick={() => {
            setAberto(false);
            setErro("");
          }}
          disabled={aEnviar}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800/60"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
