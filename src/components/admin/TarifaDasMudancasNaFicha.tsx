"use client";

import { useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { euros } from "@/components/portal/Portal";
import { MATERIAIS, type TarifaDasMudancas } from "@/lib/conta-da-mudanca";
import { dataEHoraEmLisboa } from "@/lib/hora-de-lisboa";

/**
 * OS PREÇOS DAS MUDANÇAS DO PROFISSIONAL, NA FICHA — 10-11-2026 (fase 1).
 *
 * Só leitura: quem os muda é o profissional, no painel ou na app. Abre-se a
 * pedido, para a lista dos profissionais não fazer um pedido por cartão.
 */
export default function TarifaDasMudancasNaFicha({ providerId }: { providerId: number }) {
  const { token } = useAdminAuth();
  const [estado, setEstado] = useState<
    | { fase: "fechado" }
    | { fase: "a-ver" }
    | { fase: "visto"; tarifa: (TarifaDasMudancas & { actualizadoEm: string | null }) | null }
    | { fase: "erro"; texto: string }
  >({ fase: "fechado" });

  async function ver() {
    setEstado({ fase: "a-ver" });
    try {
      const r = await fetch(`/api/admin/profissionais/${providerId}/tarifas-mudancas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setEstado({ fase: "erro", texto: d.error ?? "Não foi possível ler os preços." });
      else setEstado({ fase: "visto", tarifa: d.tarifa ?? null });
    } catch {
      setEstado({ fase: "erro", texto: "Erro de rede." });
    }
  }

  if (estado.fase === "fechado" || estado.fase === "a-ver") {
    return (
      <button
        type="button"
        onClick={ver}
        disabled={estado.fase === "a-ver" || !token}
        className="mt-1.5 rounded-md bg-slate-800 px-2 py-1 text-xs font-semibold text-cyan-300 hover:bg-slate-700 disabled:opacity-50"
      >
        {estado.fase === "a-ver" ? "A ver…" : "Ver os preços das mudanças"}
      </button>
    );
  }
  if (estado.fase === "erro") return <p className="mt-1.5 text-xs text-red-300">{estado.texto}</p>;

  const t = estado.tarifa;
  if (!t) return <p className="mt-1.5 text-xs text-slate-400">Ainda não pôs os preços das mudanças.</p>;

  const valor = (n: number | null, sufixo: string) => (n == null ? "não" : `${euros(n)}${sufixo}`);
  return (
    <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-xs text-slate-300">
      <p className="font-semibold text-slate-200">
        Preços das mudanças (sem IVA) · {t.aparecerNaLista ? "aparece na lista" : "fora da lista"}
      </p>
      <p className="mt-1">
        Hora: 2 pessoas {valor(t.precoHora2, "/h")} · 3 pessoas {valor(t.precoHora3, "/h")} · mínimo {t.minimoHoras} h
      </p>
      <p>
        Km: {valor(t.precoKm, "/km")} · mínimo {t.kmMinimo} km · até {t.kmMaximo} km
      </p>
      <p>
        Material: {MATERIAIS.map((m) => `${m.nome.toLowerCase()} ${valor(t[m.chave], `/${m.unidade}`)}`).join(" · ")}
      </p>
      {t.actualizadoEm && (
        <p className="mt-1 text-slate-500">Mudados a {dataEHoraEmLisboa(new Date(t.actualizadoEm))}</p>
      )}
    </div>
  );
}
