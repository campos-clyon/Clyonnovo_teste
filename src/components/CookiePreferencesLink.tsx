"use client";

export default function CookiePreferencesLink() {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new CustomEvent("clyon-open-cookie-preferences"));
      }}
      className="text-sm text-slate-500 transition-colors hover:text-white"
    >
      Gerir cookies
    </button>
  );
}
