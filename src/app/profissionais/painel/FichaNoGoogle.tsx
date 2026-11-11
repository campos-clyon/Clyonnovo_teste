"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { CabecalhoDeEcra } from "@/components/portal/Portal";
import { TEXTOS_DA_FICHA_NO_GOOGLE } from "@/lib/estado-da-ficha-no-google";

/**
 * «A MINHA FICHA NO GOOGLE» — 11-11-2026.
 *
 * O profissional procura a empresa pelo nome e escolhe a ficha; fica à espera
 * da confirmação da CLYON. Só a confirmada dá a nota do Google no cartão da
 * lista das mudanças. O mesmo ecrã que a app Pro (`app-pro/src/app/conta/google.tsx`),
 * com os mesmos textos (`estado-da-ficha-no-google.ts`).
 *
 * `GET/PUT /api/profissionais/ficha-google` e `POST /api/profissionais/ficha-google/procurar`.
 */

type Ficha = { nome: string | null; morada: string | null; mapsUri: string | null };
type Estado = {
  estado: string;
  texto: string;
  confirmada: (Ficha & { em: string | null }) | null;
  proposta: Ficha | null;
};
type Resultado = { placeId: string; nome: string; morada: string | null; mapsUri: string | null };

const T = TEXTOS_DA_FICHA_NO_GOOGLE;
const CAIXA =
  "w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-cyan-600";

export default function FichaNoGoogle({ onVoltar }: { onVoltar: () => void }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [aProcurar, setAProcurar] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [aEscolher, setAEscolher] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const ler = useCallback(async () => {
    setACarregar(true);
    setErro(null);
    try {
      const r = await fetch("/api/profissionais/ficha-google", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErro(d.error ?? "Não foi possível ler a sua ficha no Google.");
      else setEstado(d as Estado);
    } catch {
      setErro("Sem ligação. Tente outra vez.");
    } finally {
      setACarregar(false);
    }
  }, []);

  useEffect(() => {
    void ler();
  }, [ler]);

  async function procurar(ev: React.FormEvent) {
    ev.preventDefault();
    setAviso(null);
    setErro(null);
    if (texto.trim().length < 3) {
      setErro("Escreva pelo menos 3 letras do nome.");
      return;
    }
    setAProcurar(true);
    try {
      const r = await fetch("/api/profissionais/ficha-google/procurar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErro(d.error ?? "A procura não correu bem.");
      else setResultados((d.fichas as Resultado[]) ?? []);
    } catch {
      setErro("Sem ligação. Tente outra vez.");
    } finally {
      setAProcurar(false);
    }
  }

  async function escolher(placeId: string) {
    setAEscolher(placeId);
    setErro(null);
    try {
      const r = await fetch("/api/profissionais/ficha-google", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErro(d.error ?? "Não foi possível guardar a ficha.");
      else {
        setEstado(d as Estado);
        setResultados(null);
        setTexto("");
        setAviso(T.enviada);
      }
    } catch {
      setErro("Sem ligação. Tente outra vez.");
    } finally {
      setAEscolher(null);
    }
  }

  const fichaEmTexto = (f: Ficha) => (
    <>
      <p className="font-semibold text-[#0B1929]">{f.nome ?? "Ficha do Google"}</p>
      {f.morada && <p className="text-sm text-slate-600">{f.morada}</p>}
      {f.mapsUri && (
        <a href={f.mapsUri} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-700 underline">
          Ver no Google Maps
        </a>
      )}
    </>
  );

  return (
    <>
      <CabecalhoDeEcra titulo={T.titulo} onVoltar={onVoltar} />
      {aCarregar ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A carregar…
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">{T.explicacao}</p>

          {estado && (
            <section className="space-y-2 rounded-2xl border border-[#E2EEF3] bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-[#0B1929]">O estado</h2>
              <p className="text-sm text-slate-700">{estado.texto}</p>
              {estado.confirmada && <div className="space-y-0.5">{fichaEmTexto(estado.confirmada)}</div>}
              {estado.proposta && (
                <div className="space-y-0.5 border-t border-gray-200 pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">À espera de confirmação</p>
                  {fichaEmTexto(estado.proposta)}
                </div>
              )}
            </section>
          )}

          <section className="space-y-3 rounded-2xl border border-[#E2EEF3] bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-[#0B1929]">{T.procurar}</h2>
            <form onSubmit={procurar} className="space-y-3">
              <label className="block text-sm font-semibold text-slate-800">
                {T.rotuloDaProcura}
                <input
                  className={`${CAIXA} mt-1`}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  maxLength={120}
                  placeholder="ex.: Mudanças Silva, Almada"
                  autoComplete="organization"
                />
              </label>
              <button
                type="submit"
                disabled={aProcurar}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {aProcurar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {T.procurar}
              </button>
            </form>

            {resultados && resultados.length === 0 && <p className="text-sm text-slate-600">{T.semResultados}</p>}
            {resultados && resultados.length > 0 && (
              <ul className="space-y-2">
                {resultados.map((f) => (
                  <li key={f.placeId} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-gray-200 p-3">
                    <div className="min-w-0 flex-1 space-y-0.5">{fichaEmTexto(f)}</div>
                    <button
                      type="button"
                      onClick={() => void escolher(f.placeId)}
                      disabled={aEscolher !== null}
                      className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
                    >
                      {aEscolher === f.placeId ? "A enviar…" : T.escolher}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          {aviso && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{aviso}</p>}
        </div>
      )}
    </>
  );
}
