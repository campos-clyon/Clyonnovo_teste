"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, Settings2 } from "lucide-react";

import {
  COOKIE_CONSENT_KEY,
  COOKIE_PREFERENCES_KEY,
  CookieConsentState,
  CookiePreferences,
  defaultCookiePreferences,
  getAcceptedCookiePreferences,
} from "@/lib/cookie-consent";

function saveConsent(status: CookieConsentState["status"], preferences: CookiePreferences) {
  const payload: CookieConsentState = {
    status,
    updatedAt: new Date().toISOString(),
    preferences,
  };

  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(payload));
  localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(preferences));
  document.cookie = `${COOKIE_CONSENT_KEY}=${encodeURIComponent(status)}; path=/; max-age=${60 * 60 * 24 * 180}; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent("clyon-cookie-consent-updated", { detail: payload }));
}

function readConsent() {
  const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CookieConsentState;
  } catch {
    return null;
  }
}

/*
 * ONDE A FAIXA SE SENTA (14-10-2026).
 *
 * Ela só existia nas páginas com a barra de navegação do telemóvel, e por
 * isso subia sempre acima dela. O simulador e a página dos anúncios não a
 * mostravam — e sem resposta à faixa o Google Ads e o Analytics nunca
 * carregavam lá, que é onde os pedidos acontecem. Agora vai a essas páginas
 * também, e cada uma diz o que tem por baixo.
 */
export const POSICOES_DA_FAIXA = {
  // A barra de navegação do site: 63 px medidos, mais a área segura dos
  // ecrãs com entalhe. A partir de lg a barra não existe e a faixa desce.
  barraDoSite: "bottom-[calc(3.9375rem+env(safe-area-inset-bottom))] lg:bottom-0",
  // A barra de contactos da página dos anúncios: botões de 52 px, 12 px de
  // margem em cima e em baixo, e a borda — 77 px. Mas a página inteira está
  // em `zoom: 0.89` e a faixa não (vive fora dela), por isso no ecrã a barra
  // tem 77 × 0,89 = 68,5 px. Também some em lg.
  barraDaLanding: "bottom-[calc(4.8125rem*0.89)] lg:bottom-0",
  // Nada por baixo (o simulador, a conta, o pedido).
  fundo: "bottom-0",
} as const;

export type PosicaoDaFaixa = keyof typeof POSICOES_DA_FAIXA;

/*
 * NO TELEMÓVEL, UMA LINHA — 15-10-2026. A faixa tinha título, três linhas de
 * texto e três botões empilhados: tapava quase meio ecrã, e no /simulador
 * era o maior bloco a aparecer — o «carregamento» da página contava-se por
 * ela, aos 2,6 s num telemóvel lento. No telemóvel fica uma linha, a
 * ligação à política e os três botões lado a lado; a partir de 640 px, a
 * faixa de sempre. Os botões dizem o nome inteiro a quem não vê.
 */
const BOTAO_DA_FAIXA = "!px-2 !py-2.5 !text-xs sm:!px-7 sm:!py-3.5 sm:!text-[0.9375rem]";

export default function CookieConsent({ posicao = "barraDoSite" }: { posicao?: PosicaoDaFaixa }) {
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(defaultCookiePreferences);

  useEffect(() => {
    let cancelled = false;

    const hydrateConsent = () => {
      if (cancelled) return;

      const consent = readConsent();
      if (!consent) {
        setVisible(true);
        return;
      }

      setPreferences(consent.preferences);
    };

    const idleId =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(hydrateConsent, { timeout: 1200 })
        : window.setTimeout(hydrateConsent, 500);

    return () => {
      cancelled = true;
      if (typeof idleId === "number") {
        window.clearTimeout(idleId);
        return;
      }

      window.cancelIdleCallback?.(idleId);
    };
  }, []);

  useEffect(() => {
    const handleOpenPreferences = () => {
      const consent = readConsent();
      if (consent) {
        setPreferences(consent.preferences);
      }
      setVisible(true);
      setShowPreferences(true);
    };

    window.addEventListener("clyon-open-cookie-preferences", handleOpenPreferences);
    return () => {
      window.removeEventListener("clyon-open-cookie-preferences", handleOpenPreferences);
    };
  }, []);

  const handleReject = () => {
    saveConsent("rejected", defaultCookiePreferences);
    setPreferences(defaultCookiePreferences);
    setVisible(false);
    setShowPreferences(false);
  };

  const handleAccept = () => {
    const acceptedPreferences = getAcceptedCookiePreferences();
    saveConsent("accepted", acceptedPreferences);
    setPreferences(acceptedPreferences);
    setVisible(false);
    setShowPreferences(false);
  };

  const handleSavePreferences = () => {
    saveConsent("custom", preferences);
    setVisible(false);
    setShowPreferences(false);
  };

  return (
    <>
      {visible ? (
        // A faixa ficava em bottom-0 com z-70, e a navegação de baixo está em
        // bottom-0 com z-50 — ou seja, em telemóvel a faixa tapava a barra
        // inteira. Tocar em "Conta" acertava no botão de aceitar cookies, e o
        // menu parecia partido a toda a gente que ainda não tinha respondido
        // ao aviso, que é quase toda a gente que chega ao site pela primeira
        // vez.
        //
        // Em telemóvel a faixa sobe acima da barra que houver por baixo — ver
        // POSICOES_DA_FAIXA.
        <div className={`fixed inset-x-0 ${POSICOES_DA_FAIXA[posicao]} z-[70] border-t border-white/10 bg-[#121c33] shadow-[0_-12px_36px_-18px_rgba(15,23,42,0.45)]`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:gap-5 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="max-w-4xl">
              <div className="sm:hidden">
                <p className="text-xs font-medium leading-5 text-white">Cookies de análise e marketing, só se aceitar.</p>
                <p className="text-xs leading-5">
                  <Link href="/privacidade" className="font-medium text-cyan-300 underline underline-offset-4 hover:text-cyan-200">
                    Política de privacidade
                  </Link>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/8 text-cyan-200 sm:flex">
                  <Cookie className="h-4 w-4" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-base font-semibold text-white">
                    Utilizamos cookies para melhorar a sua experiência no nosso site.
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Os cookies essenciais mantêm o site funcional. Pode gerir preferências de analítica e marketing
                    sempre que quiser.
                  </p>
                  <Link href="/privacidade" className="mt-2 inline-block text-sm font-medium text-cyan-300 underline underline-offset-4 hover:text-cyan-200">
                    Ver Política de Privacidade
                  </Link>
                </div>

                {showPreferences ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <PreferenceCard
                      title="Necessários"
                      description="Sempre activos para funcionamento básico."
                      enabled
                      locked
                      onToggle={() => undefined}
                    />
                    <PreferenceCard
                      title="Analítica"
                      description="Medição de visitas e desempenho das páginas."
                      enabled={preferences.analytics}
                      onToggle={() =>
                        setPreferences((state) => ({
                          ...state,
                          analytics: !state.analytics,
                        }))
                      }
                    />
                    <PreferenceCard
                      title="Marketing"
                      description="Apoio a campanhas e remarketing futuro."
                      enabled={preferences.marketing}
                      onToggle={() =>
                        setPreferences((state) => ({
                          ...state,
                          marketing: !state.marketing,
                        }))
                      }
                    />
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-row sm:gap-3 lg:flex-shrink-0 lg:justify-end">
                {showPreferences ? (
                  <button
                    type="button"
                    onClick={handleSavePreferences}
                    className={`site-btn-primary ${BOTAO_DA_FAIXA}`}
                    aria-label="Guardar preferências"
                  >
                    <span className="sm:hidden">Guardar</span>
                    <span className="hidden sm:inline">Guardar preferências</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPreferences(true)}
                    className={`site-btn-secondary ${BOTAO_DA_FAIXA}`}
                    aria-label="Gerir cookies"
                  >
                    <Settings2 className="mr-2 hidden h-4 w-4 sm:inline" />
                    <span className="sm:hidden">Gerir</span>
                    <span className="hidden sm:inline">Gerir cookies</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleReject}
                  className={`site-btn-secondary ${BOTAO_DA_FAIXA}`}
                  aria-label="Recusar cookies opcionais"
                >
                  <span className="sm:hidden">Recusar</span>
                  <span className="hidden sm:inline">Recusar opcionais</span>
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  className={`site-btn-primary ${BOTAO_DA_FAIXA}`}
                  aria-label="Aceitar cookies"
                >
                  <span className="sm:hidden">Aceitar</span>
                  <span className="hidden sm:inline">Aceitar cookies</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PreferenceCard({
  title,
  description,
  enabled,
  onToggle,
  locked = false,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  locked?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-cyan-100 bg-slate-50/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
          <p className="mt-2 text-xs leading-6 text-slate-600">{description}</p>
        </div>
        {/* Um interruptor sem nome era anunciado como "botão, premido" — sem
            dizer de quê. `role="switch"` com `aria-checked` diz ligado ou
            desligado, e o nome é o título do cartão. */}
        <button
          type="button"
          role="switch"
          onClick={onToggle}
          disabled={locked}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${
            enabled ? "bg-emerald-500" : "bg-slate-300"
          } ${locked ? "cursor-not-allowed opacity-80" : ""}`}
          aria-checked={enabled}
          aria-label={title}
        >
          <span
            aria-hidden="true"
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
              enabled ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
