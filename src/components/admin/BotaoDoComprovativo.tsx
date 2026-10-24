"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
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
      const res = await fetch(`/api/admin/pagamentos/comprovativo?negociacao=${negociacaoId}&para=${para}`, {
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
