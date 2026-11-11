"use client";

import { useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { dataEHoraEmLisboa } from "@/lib/hora-de-lisboa";

/**
 * A FICHA DO GOOGLE DO PROFISSIONAL, NA FICHA DO BACKOFFICE — 11-11-2026.
 *
 * O profissional propõe a sua ficha do Google (no painel ou na app). Aqui vê-se
 * a proposta (nome, morada, link do Maps) AO LADO do nome, do NIF e da morada
 * dele, para conferir que é mesmo a empresa dele. Só o administrador confirma
 * ou recusa; confirmar regista quem e quando. Só a confirmada conta para a
 * nota do Google na lista das mudanças.
 *
 * Abre-se a pedido: cada abertura pergunta ao Google (é pago).
 */

type Ficha = { placeId: string; nome: string | null; morada: string | null; mapsUri: string | null };
type Resposta = {
  estado: string;
  confirmada: (Ficha & { em: string | null; por: string | null }) | null;
  proposta: Ficha | null;
};

export default function FichaDoGoogleNaFicha({
  providerId,
  nome,
  nif,
  morada,
  eAdministrador,
}: {
  providerId: number;
  nome: string;
  nif: string | null;
  morada: string | null;
  eAdministrador: boolean;
}) {
  const { token } = useAdminAuth();
  const [estado, setEstado] = useState<
    { fase: "fechado" } | { fase: "a-ver" } | { fase: "visto"; r: Resposta } | { fase: "erro"; texto: string }
  >({ fase: "fechado" });
  const [aGravar, setAGravar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function ver() {
    setEstado({ fase: "a-ver" });
    setAviso(null);
    try {
      const r = await fetch(`/api/admin/profissionais/${providerId}/ficha-google`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setEstado({ fase: "erro", texto: d.error ?? "Não foi possível ler a ficha do Google." });
      else setEstado({ fase: "visto", r: d as Resposta });
    } catch {
      setEstado({ fase: "erro", texto: "Erro de rede." });
    }
  }

  async function actuar(accao: "confirmar" | "recusar" | "retirar", placeId?: string) {
    if (accao === "retirar" && !window.confirm("Tirar a ficha confirmada? A nota do Google deixa de aparecer no cartão.")) return;
    setAGravar(true);
    setAviso(null);
    try {
      const r = await fetch(`/api/admin/profissionais/${providerId}/ficha-google`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ accao, placeId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setAviso(d.error ?? "Não foi possível gravar.");
      else {
        setEstado({ fase: "visto", r: d as Resposta });
        setAviso(accao === "confirmar" ? "Ficha confirmada." : accao === "recusar" ? "Proposta recusada." : "Ficha retirada.");
      }
    } catch {
      setAviso("Erro de rede.");
    } finally {
      setAGravar(false);
    }
  }

  if (estado.fase === "fechado" || estado.fase === "a-ver") {
    return (
      <button
        type="button"
        onClick={ver}
        disabled={estado.fase === "a-ver" || !token}
        className="mt-1.5 ml-1.5 rounded-md bg-slate-800 px-2 py-1 text-xs font-semibold text-cyan-300 hover:bg-slate-700 disabled:opacity-50"
      >
        {estado.fase === "a-ver" ? "A ver…" : "Ver a ficha no Google"}
      </button>
    );
  }
  if (estado.fase === "erro") return <p className="mt-1.5 text-xs text-red-300">{estado.texto}</p>;

  const { confirmada, proposta } = estado.r;
  const linkDoMaps = (f: Ficha) =>
    f.mapsUri ? (
      <a href={f.mapsUri} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline hover:text-cyan-200">
        Abrir no Google Maps
      </a>
    ) : null;

  return (
    <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-xs text-slate-300">
      <p className="font-semibold text-slate-200">Ficha no Google</p>
      {!confirmada && !proposta && <p className="mt-1 text-slate-400">Ainda não propôs nenhuma ficha.</p>}

      {confirmada && (
        <div className="mt-1">
          <p className="text-emerald-300">
            Confirmada{confirmada.em ? ` a ${dataEHoraEmLisboa(new Date(confirmada.em))}` : ""}
            {confirmada.por ? ` por ${confirmada.por}` : ""}
          </p>
          <p>
            {confirmada.nome ?? "(o Google não respondeu agora)"}
            {confirmada.morada ? ` · ${confirmada.morada}` : ""}
          </p>
          {linkDoMaps(confirmada)}
          {eAdministrador && (
            <button
              type="button"
              onClick={() => void actuar("retirar")}
              disabled={aGravar}
              className="ml-2 rounded-md bg-slate-800 px-2 py-0.5 font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              Retirar
            </button>
          )}
        </div>
      )}

      {proposta && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
            <p className="font-semibold text-amber-300">Proposta pelo profissional</p>
            <p className="mt-0.5">{proposta.nome ?? "(o Google não respondeu agora)"}</p>
            {proposta.morada && <p className="text-slate-400">{proposta.morada}</p>}
            {linkDoMaps(proposta)}
          </div>
          <div className="rounded-md border border-slate-800 p-2">
            <p className="font-semibold text-slate-200">Na conta dele</p>
            <p className="mt-0.5">{nome}</p>
            <p className="text-slate-400">{nif ? `NIF ${nif}` : "Sem NIF"}</p>
            <p className="text-slate-400">{morada || "Sem morada"}</p>
          </div>
          <div className="sm:col-span-2">
            {eAdministrador ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void actuar("confirmar", proposta.placeId)}
                  disabled={aGravar || !proposta.nome}
                  className="rounded-md bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Confirmar ficha
                </button>
                <button
                  type="button"
                  onClick={() => void actuar("recusar", proposta.placeId)}
                  disabled={aGravar}
                  className="rounded-md bg-slate-800 px-2.5 py-1 font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  Recusar
                </button>
              </div>
            ) : (
              <p className="text-slate-400">Só o administrador confirma a ficha.</p>
            )}
          </div>
        </div>
      )}
      {aviso && <p className="mt-1.5 text-slate-200">{aviso}</p>}
    </div>
  );
}
