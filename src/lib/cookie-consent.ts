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
