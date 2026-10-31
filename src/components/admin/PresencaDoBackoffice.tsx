"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getColaboradorItem } from "@/lib/colaborador-storage";
import { papelGuardadoNoBrowser } from "@/hooks/useAdminAuth";
import { INTERVALO_DO_SINAL_MS, LIMITE_DE_INACTIVIDADE_MS } from "@/lib/presenca-do-backoffice";

/** O que conta como interacção: um clique, uma tecla, um scroll, um toque. */
const INTERACCOES = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/** Fora do componente, para uma mudança de página dentro do backoffice não esquecer a última interacção. */
const estado = { ultimaInteraccao: null as number | null, ultimoEnvio: 0 };

/**
 * A PRESENÇA DE UMA ASSISTENTE NO BACKOFFICE — 31-10-2026 (ordem do CEO e do dono).
 *
 * Só nas contas de assistente (o administrador não é contado). Enquanto a
 * página está à vista e houve interacção nos últimos 15 minutos, manda um
 * sinal a cada minuto com há quanto tempo foi a última. Sem interacção há 15
 * minutos deixa de enviar; ao esconder ou fechar o separador manda o último,
 * para o bloco fechar na última interacção — e o tempo escondido não conta.
 *
 * Não guarda nem envia nada do que está no ecrã: só o tempo desde a última
 * interacção. As regras estão em `presenca-do-backoffice.ts`. Não desenha nada.
 */
export default function PresencaDoBackoffice() {
  const caminho = usePathname();

  useEffect(() => {
    if (!caminho || caminho.startsWith("/admin/login")) return;
    if (papelGuardadoNoBrowser() !== "assistente") return;

    const enviar = (aoSair = false) => {
      const token = getColaboradorItem("token");
      if (!token || estado.ultimaInteraccao === null) return;
      const agora = Date.now();
      const ms = agora - estado.ultimaInteraccao;
      if (ms >= LIMITE_DE_INACTIVIDADE_MS) return;
      estado.ultimoEnvio = agora;
      void fetch("/api/admin/sessao/presenca", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ msDesdeInteraccao: Math.max(0, ms) }),
        keepalive: aoSair,
        cache: "no-store",
      }).catch(() => {
        /* sem rede: o sinal seguinte leva a mesma interacção */
      });
    };

    const aoInteragir = () => {
      const agora = Date.now();
      const voltou =
        estado.ultimaInteraccao === null || agora - estado.ultimaInteraccao >= LIMITE_DE_INACTIVIDADE_MS;
      estado.ultimaInteraccao = agora;
      // A primeira depois de uma pausa começa o bloco já; as outras vão no sinal do minuto.
      if (voltou || agora - estado.ultimoEnvio >= INTERVALO_DO_SINAL_MS) enviar();
    };

    const doMinuto = () => {
      if (document.visibilityState === "visible") enviar();
    };
    const aoEsconder = () => {
      if (document.visibilityState === "hidden") enviar(true);
    };
    const aoFechar = () => enviar(true);

    for (const tipo of INTERACCOES) window.addEventListener(tipo, aoInteragir, { passive: true, capture: true });
    // O scroll não sobe na árvore: apanha-se na captura, em qualquer caixa que role.
    window.addEventListener("scroll", aoInteragir, { passive: true, capture: true });
    document.addEventListener("visibilitychange", aoEsconder);
    window.addEventListener("pagehide", aoFechar);
    const intervalo = window.setInterval(doMinuto, INTERVALO_DO_SINAL_MS);

    return () => {
      window.clearInterval(intervalo);
      for (const tipo of INTERACCOES) window.removeEventListener(tipo, aoInteragir, { capture: true });
      window.removeEventListener("scroll", aoInteragir, { capture: true });
      document.removeEventListener("visibilitychange", aoEsconder);
      window.removeEventListener("pagehide", aoFechar);
    };
  }, [caminho]);

  return null;
}
