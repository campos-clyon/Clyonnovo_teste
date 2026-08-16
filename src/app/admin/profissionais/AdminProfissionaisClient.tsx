"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Loader2, MapPin, ShieldAlert, Truck } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

type Profissional = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  nif: string | null;
  city: string | null;
  categorias: string | null;
  zonas: string | null;
  raioKm: number | null;
  emiteFatura: number;
  emiteGuiaTransporte: number;
  numeroTransportador: string | null;
  guiaVerificadaEm: string | null;
  guiaVerificadaPor: string | null;
  estado: string;
  isActive: number;
  baseLat: string | null;
  baseLng: string | null;
  createdAt: string;
};

const ESTADO_CLS: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-800",
  aprovado: "bg-emerald-100 text-emerald-800",
  rejeitado: "bg-slate-200 text-slate-600",
  suspenso: "bg-red-100 text-red-800",
};

function lista(json: string | null): string[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}

export default function AdminProfissionaisClient() {
  const { token, ready } = useAdminAuth();
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [aGuardar, setAGuardar] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!token) return;
    setACarregar(true);
    try {
      const res = await fetch("/api/admin/profissionais", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar.");
        return;
      }
      setProfissionais(dados.profissionais ?? []);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    if (ready && token) carregar();
  }, [ready, token, carregar]);

  async function actualizar(id: number, corpo: Record<string, unknown>) {
    if (!token) return;
    setAGuardar(id);
    try {
      const res = await fetch(`/api/admin/profissionais/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErro(d.error ?? "Não foi possível actualizar.");
        return;
      }
      await carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGuardar(null);
    }
  }

  if (!ready || aCarregar) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  const porVerificar = profissionais.filter(
    (p) => p.emiteGuiaTransporte === 1 && !p.guiaVerificadaEm,
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Profissionais</h1>
        <p className="mt-1 text-sm text-slate-500">
          {profissionais.length} inscritos
          {porVerificar > 0 && (
            <>
              {" · "}
              <span className="font-semibold text-amber-700">
                {porVerificar} à espera de verificação da guia
              </span>
            </>
          )}
        </p>
      </header>

      {erro && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      {profissionais.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Ainda ninguém se inscreveu.
        </p>
      )}

      <div className="space-y-3">
        {profissionais.map((p) => {
          const categorias = lista(p.categorias);
          const zonas = lista(p.zonas);
          const guiaPorVerificar = p.emiteGuiaTransporte === 1 && !p.guiaVerificadaEm;
          const semCoordenadas = !p.baseLat || !p.baseLng;

          return (
            <article
              key={p.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">{p.name}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        ESTADO_CLS[p.estado] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {p.estado}
                    </span>
                    {p.emiteFatura === 1 && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        emite fatura
                      </span>
                    )}
                    {p.guiaVerificadaEm && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                        guia verificada
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {p.email} {p.phone && `· ${p.phone}`} {p.nif && `· NIF ${p.nif}`}
                  </p>

                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {p.city} · até {p.raioKm ?? "—"} km
                    {zonas.length > 0 && ` · ${zonas.join(", ")}`}
                    {semCoordenadas && (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">
                        sem coordenadas — só recebe por zona
                      </span>
                    )}
                  </p>

                  {categorias.length > 0 && (
                    <p className="mt-1.5 text-xs text-slate-600">{categorias.join(" · ")}</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {p.estado !== "aprovado" && (
                    <button
                      onClick={() => actualizar(p.id, { estado: "aprovado" })}
                      disabled={aGuardar === p.id}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Aprovar
                    </button>
                  )}
                  {p.estado === "aprovado" && (
                    <button
                      onClick={() => actualizar(p.id, { estado: "suspenso" })}
                      disabled={aGuardar === p.id}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Suspender
                    </button>
                  )}
                </div>
              </div>

              {/* A guia é o que trava pedidos — fica em destaque, não numa
                  linha de detalhe que se lê por acaso. */}
              {guiaPorVerificar && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <ShieldAlert
                        className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-semibold text-amber-900">
                          Declarou emitir guia de transporte
                        </p>
                        <p className="mt-0.5 text-xs text-amber-800">
                          Registo n.º{" "}
                          <span className="font-mono font-semibold">
                            {p.numeroTransportador}
                          </span>{" "}
                          — confirme no registo da APA antes de aprovar. Até lá não
                          recebe pedidos que exijam guia.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => actualizar(p.id, { verificarGuia: true })}
                      disabled={aGuardar === p.id}
                      className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
                    >
                      <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                      Confirmei o registo
                    </button>
                  </div>
                </div>
              )}

              {p.guiaVerificadaEm && p.guiaVerificadaPor && (
                <p className="mt-2 text-xs text-slate-400">
                  Guia verificada por {p.guiaVerificadaPor} ·{" "}
                  {new Date(p.guiaVerificadaEm).toLocaleDateString("pt-PT")}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
