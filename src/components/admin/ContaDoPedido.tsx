"use client";

import { useState } from "react";

/**
 * A CONTA DO PEDIDO, NA MESA — 29-10-2026 (Segurança, R13).
 *
 * Um pedido do WhatsApp (sem email) que alguém pediu para juntar à conta pela
 * app fica à espera daqui: «Confirmar» ou «Recusar». Um pedido que foi ligado
 * a uma conta pela app pode ser desligado.
 */
export default function ContaDoPedido({
  pedidoId,
  pedidaPor,
  ligadoPelaApp,
  authHeader,
  aoMudar,
}: {
  pedidoId: number;
  /** O email (mascarado se for preciso) que pediu a junção, ou nada. */
  pedidaPor: string | null;
  ligadoPelaApp: boolean;
  authHeader: Record<string, string>;
  aoMudar: (order: unknown) => void;
}) {
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (!pedidaPor && !ligadoPelaApp) return null;

  async function agir(accao: "aprovar" | "recusar" | "desligar") {
    if (accao === "desligar" && !window.confirm("Desligar este pedido da conta? O cliente deixa de o ver na conta.")) return;
    setAEnviar(true);
    setErro(null);
    try {
      const r = await fetch(`/api/admin/pedidos/${pedidoId}/conta`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ accao }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Não foi possível guardar.");
      aoMudar(d.order);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível guardar.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
      {pedidaPor ? (
        <>
          <p>
            Pediram na app para juntar este pedido à conta <strong>{pedidaPor}</strong>. Confirme com o cliente (pelo
            telefone do pedido) antes de o ligar: a conta passa a ver a morada completa.
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={aEnviar} onClick={() => void agir("aprovar")}
              className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50">Confirmar</button>
            <button type="button" disabled={aEnviar} onClick={() => void agir("recusar")}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold text-amber-900 disabled:opacity-50">Recusar</button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p>Este pedido foi ligado a uma conta pela app.</p>
          <button type="button" disabled={aEnviar} onClick={() => void agir("desligar")}
            className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold text-amber-900 disabled:opacity-50">Desligar da conta</button>
        </div>
      )}
      {erro && <p className="text-red-700">{erro}</p>}
    </div>
  );
}
