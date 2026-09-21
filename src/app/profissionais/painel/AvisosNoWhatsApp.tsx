"use client";

import { useState } from "react";
import { Loader2, MessageCircle, MessageCircleOff } from "lucide-react";

/**
 * O SIM DELE AOS AVISOS DE PEDIDO NOVO NO WHATSAPP.
 *
 * "sempre que publicarmos um pedido / enviar aos profissionais o assistente
 *  enviar mensagens no wpp para os pro falando sobre o pedido novo" — 20-09-2026.
 *
 * ── PORQUE É QUE ISTO SE PEDE, EM VEZ DE SE LIGAR ─────────────────────────
 *
 * O telemóvel dele está gravado desde a inscrição, e a tentação é óbvia: ligar
 * para toda a gente e ter isto a funcionar hoje. Mas o número foi pedido como
 * CONTACTO DE TRABALHO — para lhe ligarmos, ou para o cliente lhe ligar depois
 * de o contratar. Mandar-lhe mensagens é outra finalidade, e uma finalidade
 * nova precisa do sim de quem é dono do número.
 *
 * A decisão foi tomada assim, com estas palavras: "Só ele, no painel".
 *
 * ── E PORQUE É QUE ISTO É UM CARTÃO E NÃO UMA LINHA NAS DEFINIÇÕES ────────
 *
 * Pelo mesmo que o irmão dele, o dos avisos no telemóvel: uma permissão que se
 * pede numa página escondida não é pedida. A diferença é que este NÃO SE
 * DISPENSA com um «agora não» — porque, ao contrário do outro, do lado de cá
 * já há uma lista de números à espera de autorização, e um cartão que se
 * esconde para sempre deixava-nos sem saber se ele viu e disse que não, ou se
 * nunca chegou a ver. Fica, discreto, até ele decidir.
 */

export default function AvisosNoWhatsApp({
  ligado,
  desde,
  aoMudar,
}: {
  ligado: boolean;
  /** Quando é que ele disse que sim. É a prova, e é o que responde à pergunta dele. */
  desde?: string | null;
  aoMudar: (ligado: boolean) => void;
}) {
  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState("");

  async function mudar(quer: boolean) {
    setATratar(true);
    setErro("");
    try {
      const r = await fetch("/api/profissionais/avisos-whatsapp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quer }),
      });
      if (!r.ok) throw new Error(String(r.status));
      aoMudar(quer);
    } catch {
      setErro("Não foi possível guardar. Tente outra vez.");
    } finally {
      setATratar(false);
    }
  }

  /*
   * JÁ LIGADO: uma linha, com a data.
   *
   * A data não é enfeite. Quando ele estranhar a primeira mensagem — e vai
   * estranhar, porque chega de um número que nunca lhe escreveu — esta linha é
   * a resposta: foi ele que a pediu, neste dia. E o «desligar» está à vista,
   * porque uma definição que se liga e não se desliga é uma armadilha.
   */
  if (ligado) {
    return (
      <button
        onClick={() => void mudar(false)}
        disabled={aTratar}
        className="mb-4 flex w-full items-center gap-2 rounded-xl px-1 py-2 text-left text-xs text-slate-500 transition active:text-slate-700 disabled:opacity-50"
      >
        {aTratar ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <MessageCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
        )}
        <span>
          Avisos de pedido novo no WhatsApp, ligados
          {desde ? ` desde ${new Date(desde).toLocaleDateString("pt-PT")}` : ""}.{" "}
          <span className="underline underline-offset-2">Desligar</span>
        </span>
      </button>
    );
  }

  return (
    <section className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-emerald-900">
        <MessageCircleOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        Quer saber dos pedidos por WhatsApp?
      </p>
      <p className="mt-1 text-xs leading-relaxed text-emerald-800">
        Mandamos-lhe uma mensagem quando entra um pedido para si: a localidade, o
        que o cliente pediu e quanto receberia. Mais nada — não é publicidade, e
        pode desligar aqui a qualquer momento ou respondendo «parar».
      </p>
      {erro && <p className="mt-2 text-xs font-semibold text-rose-700">{erro}</p>}
      <div className="mt-3">
        <button
          onClick={() => void mudar(true)}
          disabled={aTratar}
          className="flex min-h-[42px] items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition active:bg-emerald-700 disabled:opacity-50"
        >
          {aTratar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Sim, avisem-me no WhatsApp
        </button>
      </div>
    </section>
  );
}
