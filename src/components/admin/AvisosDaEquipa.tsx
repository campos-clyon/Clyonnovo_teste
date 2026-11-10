"use client";

import { useEffect, useState } from "react";

import { disablePush, enablePush, isPushSupported, type DestinoDaSubscricao } from "@/lib/push-client";

/**
 * «AVISOS NO TELEMÓVEL» DA EQUIPA — d23, 10-11-2026.
 *
 * Liga, neste navegador, os avisos do que está parado: o «Do nosso lado» há
 * mais de 2 h, o «Por decidir» há mais de 1 h e as conversas que a Vitória
 * passou a uma pessoa — das 08h às 21h (ver `avisos-a-equipa.ts`). Cada conta
 * liga os seus; quem recebe o quê decide-se pelas secções da conta.
 *
 * Uma linha pequena, e não um cartão: está no cabeçalho do que avisa.
 */
export default function AvisosDaEquipa({ token }: { token: string | null }) {
  const [suportado, setSuportado] = useState(false);
  const [ligado, setLigado] = useState<boolean | null>(null);
  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState("");

  const destino: DestinoDaSubscricao | null = token
    ? { rota: "/api/admin/sessao/avisos", cabecalhos: { Authorization: `Bearer ${token}` } }
    : null;

  useEffect(() => {
    if (!token || !isPushSupported()) return;
    setSuportado(true);
    let vivo = true;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!sub) {
          if (vivo) setLigado(false);
          return;
        }
        // Este navegador pode ter avisos de outra conta: pergunta-se se são desta.
        const r = await fetch("/api/admin/sessao/avisos", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ accao: "estado", endpoint: sub.endpoint }),
        });
        const d = r.ok ? await r.json() : null;
        if (vivo) setLigado(d?.ligado === true);
      } catch {
        if (vivo) setLigado(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [token]);

  if (!suportado || !destino || ligado == null) return null;

  async function mudar() {
    if (!destino) return;
    setATratar(true);
    setErro("");
    try {
      if (ligado) {
        await disablePush(destino);
        setLigado(false);
      } else if (await enablePush(destino)) {
        setLigado(true);
      } else {
        setErro("O navegador recusou. Dê a permissão nas definições, em Notificações.");
      }
    } catch {
      setErro("Não foi possível. Tente outra vez.");
    } finally {
      setATratar(false);
    }
  }

  return (
    <p className="mt-1 text-[11px] text-slate-500">
      {ligado ? "Avisos no telemóvel ligados neste aparelho (08h–21h). " : "Receba no telemóvel o que fica parado. "}
      <button
        type="button"
        onClick={mudar}
        disabled={aTratar}
        className="font-semibold text-cyan-300 underline-offset-2 hover:underline disabled:opacity-60"
      >
        {aTratar ? "Um momento…" : ligado ? "Desligar" : "Ligar avisos"}
      </button>
      {erro && <span className="ml-2 text-amber-300">{erro}</span>}
    </p>
  );
}
