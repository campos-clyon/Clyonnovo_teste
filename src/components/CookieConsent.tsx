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

export default function CookieConsent() {
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
        <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-white/10 bg-[#121c33] shadow-[0_-12px_36px_-18px_rgba(15,23,42,0.45)]">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="max-w-4xl">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/8 text-cyan-200">
                  <Cookie className="h-4 w-4" />
                </div>
                <div>
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

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-shrink-0 lg:justify-end">
                {showPreferences ? (
                  <button
                    type="button"
                    onClick={handleSavePreferences}
                    className="site-btn-primary"
                  >
                    Guardar preferências
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPreferences(true)}
                    className="site-btn-secondary"
                  >
                    <Settings2 className="mr-2 h-4 w-4" />
                    Gerir cookies
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleReject}
                  className="site-btn-secondary"
                >
                  Recusar opcionais
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  className="site-btn-primary"
                >
                  Aceitar cookies
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
        <button
          type="button"
          onClick={onToggle}
          disabled={locked}
          className={`relative h-7 w-12 rounded-full transition ${
            enabled ? "bg-emerald-500" : "bg-slate-300"
          } ${locked ? "cursor-not-allowed opacity-80" : ""}`}
          aria-pressed={enabled}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
              enabled ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
