"use client";

import { useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { TEXTOS_DA_AGENDA } from "@/lib/textos-da-agenda-do-profissional";

/**
 * «ADICIONAR À MINHA AGENDA» — d144 (dono, 27-11-2026).
 *
 * Num trabalho contratado com dia marcado, dois botões: o Google Agenda e o
 * ficheiro .ics (Apple, Outlook e os outros). As ligações vêm da rota
 * (`POST /api/profissionais/pedidos/[id]/agenda`), que também guarda o dia
 * marcado — se ele mudar depois, aparece «O dia mudou — actualize na sua
 * agenda» (`agendaDiaMudou`, do servidor) e o botão volta a servir, com o dia
 * novo.
 *
 * A janela abre-se NO CLIQUE e só depois recebe o endereço: aberta depois da
 * resposta, o navegador do telemóvel bloqueava-a como uma janela não pedida.
 */
type Ligacoes = { google: string; ics: string };

async function pedirAsLigacoes(negociacaoId: number): Promise<Ligacoes> {
  const res = await fetch(`/api/profissionais/pedidos/${negociacaoId}/agenda`, { method: "POST" });
  const r = (await res.json().catch(() => ({}))) as Partial<Ligacoes> & { error?: string };
  if (!res.ok || !r.google || !r.ics) throw new Error(r.error ?? "Não foi possível preparar a agenda.");
  return { google: r.google, ics: r.ics };
}

export default function AdicionarAAgenda({
  negociacaoId,
  diaMudou,
  onAdicionada,
}: {
  negociacaoId: number;
  diaMudou: boolean;
  onAdicionada?: () => void;
}) {
  const [aAbrir, setAAbrir] = useState<"google" | "ics" | null>(null);
  const [erro, setErro] = useState("");

  async function abrir(qual: "google" | "ics") {
    setErro("");
    setAAbrir(qual);
    // O Google numa janela nova; o .ics aqui mesmo (descarrega, ou o iPhone pergunta se o junta ao calendário).
    const janela = qual === "google" ? window.open("about:blank", "_blank") : null;
    try {
      const l = await pedirAsLigacoes(negociacaoId);
      if (qual === "google") {
        if (janela) {
          janela.opener = null;
          janela.location.href = l.google;
        } else {
          window.location.href = l.google;
        }
      } else {
        window.location.href = l.ics;
      }
      onAdicionada?.();
    } catch (e) {
      janela?.close();
      setErro(e instanceof Error ? e.message : "Sem rede. Tente outra vez.");
    } finally {
      setAAbrir(null);
    }
  }

  const botao =
    "flex min-h-[46px] items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-800 transition active:bg-emerald-50 disabled:opacity-50";

  return (
    <div className="mt-3 border-t border-emerald-200 pt-3">
      <p className="flex items-center gap-2 text-sm font-bold text-emerald-900">
        <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
        {TEXTOS_DA_AGENDA.titulo}
      </p>
      {diaMudou ? (
        <p className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          {TEXTOS_DA_AGENDA.diaMudou}
        </p>
      ) : (
        <p className="mt-0.5 text-xs leading-relaxed text-emerald-800">{TEXTOS_DA_AGENDA.explicacao}</p>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" className={botao} disabled={aAbrir !== null} onClick={() => void abrir("google")}>
          {aAbrir === "google" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {TEXTOS_DA_AGENDA.google}
        </button>
        <button type="button" className={botao} disabled={aAbrir !== null} onClick={() => void abrir("ics")}>
          {aAbrir === "ics" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {TEXTOS_DA_AGENDA.outra}
        </button>
      </div>
      {erro && <p className="mt-2 text-xs font-semibold text-rose-700">{erro}</p>}
    </div>
  );
}
