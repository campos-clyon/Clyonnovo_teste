"use client";

import { useState } from "react";
import { Ban, Loader2 } from "lucide-react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import { MOTIVO_MINIMO, MOTIVO_MAXIMO, textoDaConfirmacao } from "@/lib/anular-a-referencia";

/**
 * «ANULAR A REFERÊNCIA» — 16-11-2026 (d52, dono). Num pagamento do cliente por
 * pagar (Pagamentos, na gaveta do pagamento; Mesa e Trabalhos CLYON, na caixa
 * «Cobrar o cliente»). Só o administrador geral: o botão nem aparece a quem o
 * servidor recusaria. Motivo obrigatório e confirmação antes de gravar. A regra
 * e o texto são `anular-a-referencia.ts`; a rota é
 * `/api/admin/pagamentos/anular-referencia`.
 */
export const ROTA_DA_ANULACAO = "/api/admin/pagamentos/anular-referencia";

export default function AnularAReferencia({
  pagamento,
  onFeito,
}: {
  pagamento: { id: number; estado: string; metodo: string; valor: number; referencia: string | null; parte?: string | null };
  onFeito?: () => void;
}) {
  const { token } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [resposta, setResposta] = useState<{ ok: boolean; texto: string } | null>(null);

  // Anulada agora: fica só a frase, mesmo antes de a lista se reler.
  if (resposta?.ok) return <p className="mt-2 text-[11px] text-emerald-300">{resposta.texto}</p>;
  if (!eAdministrador || pagamento.estado !== "pendente" || pagamento.parte === "divida") return null;
  if (pagamento.metodo !== "multibanco" && pagamento.metodo !== "mbway") return null;

  const motivoLimpo = motivo.trim();

  async function anular() {
    if (!token || motivoLimpo.length < MOTIVO_MINIMO) return;
    if (!window.confirm(textoDaConfirmacao(pagamento))) return;
    setOcupado(true);
    setResposta(null);
    try {
      const r = await fetch(ROTA_DA_ANULACAO, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pagamentoId: pagamento.id, motivo: motivoLimpo }),
      });
      const j = (await r.json().catch(() => ({}))) as { feito?: string; error?: string };
      if (r.ok) {
        setResposta({ ok: true, texto: j.feito ?? "Referência anulada." });
        setAberto(false);
        setMotivo("");
        onFeito?.();
      } else {
        setResposta({ ok: false, texto: j.error ?? "Não foi possível anular." });
      }
    } catch {
      setResposta({ ok: false, texto: "Erro de rede." });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-2">
      {!aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="flex items-center gap-1.5 rounded-lg border border-red-800/60 px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:border-red-600 hover:text-red-200"
        >
          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
          Anular a referência
        </button>
      ) : (
        <div className="space-y-1.5 rounded-lg border border-red-800/60 bg-red-950/20 p-2.5 text-[11px] text-slate-300">
          <p>
            A referência deixa de valer na plataforma. O euPago não é avisado: se o cliente a pagar mesmo assim, o
            pagamento entra e fica para devolver.
          </p>
          <label className="block text-slate-400" htmlFor={`anular-${pagamento.id}`}>
            Motivo (obrigatório)
          </label>
          <textarea
            id={`anular-${pagamento.id}`}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            maxLength={MOTIVO_MAXIMO}
            placeholder="Ex.: o cliente já pagou uma parte por fora"
            className="block w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-white"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void anular()}
              disabled={ocupado || motivoLimpo.length < MOTIVO_MINIMO}
              className="flex items-center gap-1.5 rounded-lg bg-red-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-40"
            >
              {ocupado && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
              Anular a referência
            </button>
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                setResposta(null);
              }}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              não anular
            </button>
          </div>
        </div>
      )}
      {resposta && <p className={`mt-1 text-[11px] ${resposta.ok ? "text-emerald-300" : "text-red-300"}`}>{resposta.texto}</p>}
    </div>
  );
}
