"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { clearColaboradorStorage, getColaboradorItem } from "@/lib/colaborador-storage";
import {
  CHAVE_DO_NAVEGADOR,
  CHAVE_DO_SEPARADOR,
  INTERVALO_DO_BATIMENTO_MS,
  marcaGuardada,
  marcaNova,
} from "@/lib/sessoes-do-backoffice";

/** A marca desta página, se o browser não deixar guardar nenhuma. */
const DE_RESERVA_NAVEGADOR = marcaNova();
const DE_RESERVA_SEPARADOR = marcaNova();

/**
 * O BATIMENTO DE CADA JANELA DO BACKOFFICE — 27-10-2026 (decisão d15).
 *
 * Enquanto uma janela do backoffice estiver aberta, diz ao servidor a cada
 * minuto que está aberta (e ao fechar, que fechou). É assim que o cartão
 * «Sessões abertas no backoffice», nas Configs, conta computadores e janelas.
 *
 * Se o servidor responder 401 — a sessão foi terminada pelo administrador,
 * ou caducou —, o navegador sai e volta ao ecrã de entrada.
 *
 * Não desenha nada. Fica no layout do /admin para valer em todas as páginas
 * do backoffice; no ecrã de entrada não há sessão e não bate.
 */
export default function BatimentoDoBackoffice() {
  const caminho = usePathname();

  useEffect(() => {
    if (!caminho || caminho.startsWith("/admin/login")) return;

    const navegador = marcaGuardada(() => window.localStorage, CHAVE_DO_NAVEGADOR, DE_RESERVA_NAVEGADOR);
    const separador = marcaGuardada(() => window.sessionStorage, CHAVE_DO_SEPARADOR, DE_RESERVA_SEPARADOR);
    let parado = false;

    const enviar = async (fechar = false) => {
      const token = getColaboradorItem("token");
      if (!token || parado) return;
      try {
        const r = await fetch("/api/admin/sessao/batimento", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ navegador, separador, fechar }),
          keepalive: fechar,
          cache: "no-store",
        });
        if (r.status === 401 && !fechar) {
          parado = true;
          clearColaboradorStorage();
          window.location.replace("/admin/login");
        }
      } catch {
        /* sem rede: o próximo batimento tenta outra vez */
      }
    };

    void enviar();
    const intervalo = window.setInterval(() => void enviar(), INTERVALO_DO_BATIMENTO_MS);
    const aoFechar = () => void enviar(true);
    // Ao voltar a uma janela (ou do «voltar atrás» do browser), conta logo.
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void enviar();
    };
    window.addEventListener("pagehide", aoFechar);
    window.addEventListener("pageshow", aoVoltar);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("pagehide", aoFechar);
      window.removeEventListener("pageshow", aoVoltar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [caminho]);

  return null;
}
