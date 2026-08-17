export const COOKIE_CONSENT_KEY = "clyon_cookie_consent";
export const COOKIE_PREFERENCES_KEY = "clyon_cookie_preferences";

export type CookiePreferences = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

export type CookieConsentState = {
  status: "accepted" | "rejected" | "custom";
  updatedAt: string;
  preferences: CookiePreferences;
};

export const defaultCookiePreferences: CookiePreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
};

export function getAcceptedCookiePreferences(): CookiePreferences {
  return {
    necessary: true,
    analytics: true,
    marketing: true,
  };
}

/** O nome do evento que o banner dispara quando alguém decide. */
export const EVENTO_CONSENTIMENTO = "clyon-cookie-consent-updated";

/**
 * O que a pessoa decidiu, lido de onde ficou guardado.
 *
 * Isto faltava, e a falta era séria: existia `getAcceptedCookiePreferences`,
 * que devolve tudo a verdadeiro — é o atalho de "aceitar tudo", não um leitor.
 * Ninguém lia o estado real, e por isso ninguém o respeitava: o banner pedia
 * autorização para analítica e marketing, e os scripts do Google carregavam à
 * mesma, tivesse a pessoa recusado ou nem sequer respondido.
 *
 * Um banner que não trava nada é pior do que não ter banner: promete uma
 * escolha que não existe.
 *
 * Por omissão devolve tudo a falso. Quem ainda não decidiu não consentiu.
 */
export function lerConsentimentoGuardado(): CookiePreferences {
  if (typeof window === "undefined") return defaultCookiePreferences;
  try {
    const cru = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!cru) return defaultCookiePreferences;
    const estado = JSON.parse(cru) as Partial<CookieConsentState>;
    const p = estado?.preferences;
    if (!p || typeof p !== "object") return defaultCookiePreferences;
    return {
      necessary: true,
      analytics: p.analytics === true,
      marketing: p.marketing === true,
    };
  } catch {
    // Um valor corrompido não é um consentimento.
    return defaultCookiePreferences;
  }
}
