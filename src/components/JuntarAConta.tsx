"use client";

import { useState } from "react";

/**
 * JUNTAR À CONTA, NO SITE — 29-10-2026 (S21, com a regra R13 da Segurança).
 *
 * Um pedido feito pelo WhatsApp (sem email) junta-se à conta de quem entrou no
 * site, mas só depois de confirmar o código que a CLYON manda por WhatsApp ao
 * telefone do pedido — ou, sem ele, quando a Mesa confirmar. A mesma rota da
 * app (R10), com a sessão do site.
 */
export default function JuntarAConta({ token, pedidoId }: { token: string; pedidoId: number }) {
  const [passo, setPasso] = useState<"inicio" | "codigo" | "feito" | "mesa">("inicio");
  const [codigo, setCodigo] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [texto, setTexto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [entrar, setEntrar] = useState(false);

  async function pedir(corpo: Record<string, unknown>) {
    setAEnviar(true);
    setErro(null);
    try {
      const r = await fetch("/api/cliente/pedido-do-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, juntar: true, ...corpo }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) {
        setEntrar(true);
        return;
      }
      if (d?.estado === "seu") {
        setPasso("feito");
        setTexto(`O pedido #${pedidoId} está agora na sua conta.`);
      } else if (d?.estado === "aConfirmar") {
        setPasso("codigo");
        setTexto(d.error ?? null);
      } else if (d?.estado === "aEsperaDaMesa") {
        setPasso("mesa");
        setTexto(d.error ?? null);
      } else if (d?.estado === "outroEmail") {
        setErro("Este pedido foi feito com outro email. Para o juntar, entre com esse email.");
      } else {
        setErro(d?.error ?? "Não foi possível juntar o pedido agora.");
      }
    } catch {
      setErro("Não foi possível juntar o pedido agora.");
    } finally {
      setAEnviar(false);
    }
  }

  if (entrar) {
    const volta = typeof window !== "undefined" ? encodeURIComponent(window.location.pathname) : "";
    return (
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        Para juntar este pedido à sua conta, entre primeiro.{" "}
        <a href={`/entrar?destino=${volta}`} className="font-semibold underline">Entrar</a>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 space-y-2">
      {passo === "inicio" && (
        <>
          <p>Tem conta na CLYON? Junte este pedido à sua conta para o ver com os outros e receber os avisos.</p>
          <button type="button" disabled={aEnviar} onClick={() => void pedir({})} className="font-semibold text-acao underline disabled:opacity-50">
            Juntar à minha conta
          </button>
        </>
      )}
      {passo === "codigo" && (
        <>
          {texto && <p>{texto}</p>}
          <input inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            placeholder="Código de 6 algarismos" className="block w-full rounded-lg border border-slate-300 px-3 py-2" />
          <button type="button" disabled={aEnviar || codigo.length !== 6} onClick={() => void pedir({ codigo })}
            className="w-full rounded-xl bg-acao px-4 py-3 font-semibold text-white disabled:opacity-50">
            Confirmar
          </button>
        </>
      )}
      {(passo === "feito" || passo === "mesa") && texto && <p className="font-semibold">{texto}</p>}
      {erro && <p className="text-red-600">{erro}</p>}
    </section>
  );
}
