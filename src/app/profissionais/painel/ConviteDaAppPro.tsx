"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";

/**
 * O CONVITE PARA O TESTE DA APP CLYON PRO — 23-10-2026.
 *
 * A Play Store só abre a app a toda a gente depois de 12 testadores aderirem
 * ao teste fechado e lá ficarem 14 dias seguidos. A lista tem os emails, mas o
 * Google não avisa ninguém, e o painel não dizia como entrar.
 *
 * Aparece só em Android (a app ainda não existe para iPhone), só a quem ainda
 * não a tem registada, e «Agora não» esconde-o durante 7 dias.
 */

export const LINK_DO_TESTE = "https://play.google.com/apps/testing/pt.clyon.pro";
const ESCONDIDO_ATE = "clyon_convite_app_pro_ate";
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;

export default function ConviteDaAppPro() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    if (!/Android/i.test(navigator.userAgent)) return;
    try {
      const ate = Number(localStorage.getItem(ESCONDIDO_ATE) ?? 0);
      if (ate > Date.now()) return;
    } catch {
      /* Sem armazenamento, mostra-se. */
    }
    let vivo = true;
    fetch("/api/profissionais/dispositivo")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { temApp?: boolean } | null) => {
        if (vivo && d && d.temApp === false) setMostrar(true);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  function agoraNao() {
    setMostrar(false);
    try {
      localStorage.setItem(ESCONDIDO_ATE, String(Date.now() + SETE_DIAS));
    } catch {
      /* Volta a aparecer na próxima visita. */
    }
  }

  if (!mostrar) return null;

  return (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <Smartphone className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        A app CLYON Pro está em teste
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        Entre no teste com o Gmail desta conta e instale-a pela Play Store: os
        pedidos novos chegam ao telemóvel como notificação, mesmo com o browser
        fechado.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={LINK_DO_TESTE}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[42px] items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition active:bg-slate-700"
        >
          Entrar no teste
        </a>
        <button
          onClick={agoraNao}
          className="min-h-[42px] px-3 text-sm font-medium text-slate-600 underline underline-offset-2"
        >
          Agora não
        </button>
      </div>
    </section>
  );
}
