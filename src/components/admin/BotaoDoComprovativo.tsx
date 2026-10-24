"use client";

import { useState } from "react";
import { FileDown, Loader2, Send } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import type { ParaQuem } from "@/lib/comprovativo-pdf";

/**
 * «COMPROVATIVO (PDF)» — 24-10-2026, ver `comprovativo-pdf.ts`.
 *
 * Um link não serve: a rota pede o token do backoffice no cabeçalho. Vai-se
 * buscar o PDF, e o browser descarrega-o com um nome que diz o que é —
 * `comprovativo-476-cliente.pdf` —, pronto a anexar no WhatsApp ou no email.
 */
export default function BotaoDoComprovativo({
  negociacaoId,
  pedidoId,
  para,
}: {
  negociacaoId: number;
  pedidoId: number;
  para: ParaQuem;
}) {
  const { token } = useAdminAuth();
  const [aGerar, setAGerar] = useState(false);
  const [erro, setErro] = useState("");

  async function descarregar() {
    if (!token) return;
    setAGerar(true);
    setErro("");
    try {
      const res = await fetch(`/api/admin/comprovativo?negociacao=${negociacaoId}&para=${para}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErro(d.error ?? "Não foi possível gerar o comprovativo.");
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `comprovativo-${pedidoId}-${para}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGerar(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void descarregar();
        }}
        disabled={aGerar}
        title={
          para === "cliente"
            ? "Descarrega o comprovativo do que o cliente pagou, em PDF"
            : "Descarrega o comprovativo do que a CLYON pagou ao profissional, em PDF"
        }
        className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800/60 disabled:opacity-50"
      >
        {aGerar ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FileDown className="h-3.5 w-3.5" aria-hidden="true" />}
        {para === "cliente" ? "Comprovativo do cliente" : "Comprovativo do profissional"}
      </button>
      {erro && <span className="text-[11px] text-red-300">{erro}</span>}
    </span>
  );
}

/**
 * «ENVIAR COMPROVATIVO AO CLIENTE» — 24-10-2026. *«Coloque o botão enviar
 * comprovativo, que envia directamente ao cliente.»* — o dono. Vai pelo
 * WhatsApp da CLYON, com o link do PDF; pergunta antes.
 */
export function BotaoEnviarComprovativo({ negociacaoId, pedidoId }: { negociacaoId: number; pedidoId: number }) {
  const { token } = useAdminAuth();
  const [aEnviar, setAEnviar] = useState(false);
  const [resposta, setResposta] = useState<{ ok: boolean; texto: string } | null>(null);

  async function enviar() {
    if (!token) return;
    if (!window.confirm(`Enviar o comprovativo de pagamento do #${pedidoId} ao cliente, pelo WhatsApp da CLYON?`)) return;
    setAEnviar(true);
    setResposta(null);
    try {
      const res = await fetch("/api/admin/comprovativo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ negociacao: negociacaoId }),
      });
      const d = await res.json().catch(() => ({}));
      setResposta(
        res.ok
          ? { ok: true, texto: d.feito ?? "Comprovativo enviado." }
          : { ok: false, texto: d.error ?? "Não foi possível enviar." },
      );
    } catch {
      setResposta({ ok: false, texto: "Erro de rede." });
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void enviar();
        }}
        disabled={aEnviar}
        title="Manda ao cliente, pelo WhatsApp da CLYON, o link do comprovativo em PDF"
        className="flex items-center gap-1.5 rounded-lg border border-emerald-600/50 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
      >
        {aEnviar ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
        Enviar comprovativo ao cliente
      </button>
      {resposta && <span className={`text-[11px] ${resposta.ok ? "text-emerald-300" : "text-red-300"}`}>{resposta.texto}</span>}
    </span>
  );
}
