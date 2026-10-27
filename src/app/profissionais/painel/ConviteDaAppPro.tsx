"use client";

import { useEffect, useState, type FormEvent } from "react";
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
/** O mesmo que o servidor aceita (`validarGmail`, app-pro-no-telemovel.ts). */
const EH_GMAIL = /^[a-z0-9.+_-]+@gmail\.com$/;

export default function ConviteDaAppPro() {
  const [mostrar, setMostrar] = useState(false);
  const [outroGmail, setOutroGmail] = useState(false);
  const [gmail, setGmail] = useState("");
  const [erroGmail, setErroGmail] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [gmailGuardado, setGmailGuardado] = useState("");

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

  async function guardarGmail(e: FormEvent) {
    e.preventDefault();
    const g = gmail.trim().toLowerCase();
    if (!EH_GMAIL.test(g)) {
      setErroGmail("Tem de ser um endereço @gmail.com.");
      return;
    }
    setAGuardar(true);
    try {
      const res = await fetch("/api/profissionais/gmail-do-teste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmail: g }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErroGmail(d.error ?? "Não consegui guardar. Tente outra vez.");
        return;
      }
      setGmailGuardado(g);
    } catch {
      setErroGmail("Sem ligação. Tente outra vez.");
    } finally {
      setAGuardar(false);
    }
  }

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

      {/*
        «O GMAIL DO MEU TELEMÓVEL É OUTRO» — 27-10-2026. O teste só deixa
        entrar os Gmails da lista; quem tem outro no telemóvel escreve-o aqui
        e a equipa da CLYON acrescenta-o.
      */}
      {gmailGuardado ? (
        <p className="mt-3 text-xs leading-relaxed text-emerald-700">
          Obrigado. Vamos pôr {gmailGuardado} na lista do teste; depois é só carregar em «Entrar no
          teste» com esse Gmail no telemóvel.
        </p>
      ) : !outroGmail ? (
        <button
          onClick={() => setOutroGmail(true)}
          className="mt-2 min-h-[36px] text-xs font-medium text-slate-600 underline underline-offset-2"
        >
          O Gmail do meu telemóvel é outro
        </button>
      ) : (
        <form onSubmit={guardarGmail} className="mt-3">
          <label htmlFor="gmail-do-teste" className="block text-xs font-medium text-slate-700">
            O Gmail do seu telemóvel
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              id="gmail-do-teste"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="nome@gmail.com"
              value={gmail}
              onChange={(e) => {
                setGmail(e.target.value);
                setErroGmail("");
              }}
              className="min-h-[42px] min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
            />
            <button
              type="submit"
              disabled={aGuardar}
              className="min-h-[42px] rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition active:bg-slate-700 disabled:opacity-50"
            >
              {aGuardar ? "A guardar…" : "Guardar"}
            </button>
          </div>
          {erroGmail && <p className="mt-1 text-xs text-red-600">{erroGmail}</p>}
        </form>
      )}
    </section>
  );
}
