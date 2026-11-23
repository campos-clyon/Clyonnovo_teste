"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import { NOME_DO_INTERRUPTOR_DAS_PROPOSTAS } from "@/lib/envio-das-propostas-ao-cliente";

/**
 * O INTERRUPTOR «ENVIAR AS PROPOSTAS AO CLIENTE» — Configs (d88, 23-11-2026).
 *
 * LIGADO POR OMISSÃO (o dono pediu). O ensaio mostra, por número de pedido, o
 * que a Vitória faz a cada pedido com propostas por enviar: envia já, a que
 * horas, ou porque fica com uma pessoa. Desligado, diz «enviaria a …». Só o
 * administrador o vê e muda; para ligar outra vez escreve-se LIGAR.
 */
type Estado = {
  ligado: boolean;
  mudadoEm: string | null;
  porQuem: string | null;
  ensaio?: { ligado: boolean; pedidos: Array<{ pedidoId: number; propostas: number; linha: string | null }> } | null;
};

export default function EnviarAsPropostas() {
  const { token, ready } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [palavra, setPalavra] = useState("");
  const [erro, setErro] = useState("");
  const [aMudar, setAMudar] = useState(false);

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/propostas-ao-cliente", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (r.ok) setEstado((await r.json()) as Estado);
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
      const r = await fetch("/api/admin/propostas-ao-cliente", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ligar, confirmacao: palavra }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível mudar.");
        return;
      }
      setPalavra("");
      await ler();
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
  const pedidos = estado?.ensaio?.pedidos ?? [];

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{NOME_DO_INTERRUPTOR_DAS_PROPOSTAS}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">
        Num pedido em negociação com propostas de parceiros por enviar, a Vitória envia ao cliente o orçamento (o mesmo
        do «Enviar pela CLYON», com a validade) assim que chega a 1.ª proposta (10 min depois de o parceiro a pôr), das 8h às 21h de
        Lisboa (o que fica fora sai às 9h). Uma vez por pedido, e uma mensagem automática por dia a cada cliente. Ficam
        com uma pessoa: a melhor proposta acima de 500 € com IVA, os Trabalhos CLYON e o valor único, as mudanças à
        hora, a conversa com uma pessoa, o cliente noutra língua, um pedido com queixa, e espera-se 10 min depois de um
        parceiro mudar a proposta.
      </p>
      <p className={`mt-2 text-sm font-semibold ${ligado ? "text-emerald-300" : "text-amber-200"}`}>
        {estado == null ? "A ler…" : ligado ? "LIGADO" : "Desligado: nada sai sozinho (a Mesa diz «enviaria a …»)"}
        {quando && <span className="ml-2 text-xs font-normal text-slate-400">({quando}{estado?.porQuem ? `, ${estado.porQuem}` : ""})</span>}
      </p>

      {estado?.ensaio && (
        <div className="mt-3 space-y-1 text-xs leading-5 text-slate-300">
          <p className="font-semibold text-slate-200">Agora (só leitura)</p>
          {pedidos.length === 0 ? (
            <p>Nenhum pedido com propostas por enviar.</p>
          ) : (
            pedidos.map((p) => (
              <p key={p.pedidoId}>
                #{p.pedidoId} ({p.propostas} {p.propostas === 1 ? "proposta" : "propostas"}): {p.linha ?? "já foi ao cliente"}
              </p>
            ))
          )}
        </div>
      )}

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
              aria-label="Escreva LIGAR para ligar o envio das propostas ao cliente"
              className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={() => mudar(true)}
              disabled={aMudar || palavra.trim().toUpperCase() !== "LIGAR"}
              className="rounded-lg border border-emerald-500/50 px-3 py-1.5 text-xs font-semibold text-emerald-200 disabled:opacity-40"
            >
              Ligar
            </button>
          </div>
        ))}
    </div>
  );
}
