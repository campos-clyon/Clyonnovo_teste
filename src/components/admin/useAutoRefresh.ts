"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Traz dados novos de tempo a tempo, sem dar por isso.
 *
 * O operador não deve ter de carregar em F5 para saber se o cliente
 * respondeu — mas também não pode ficar com o ecrã a piscar nem a perder o
 * que está a escrever. Por isso este ciclo é deliberadamente discreto:
 *
 *   · não mexe em nenhum estado de "a carregar" — quem chama recebe
 *     `silent = true` e só substitui o que é leitura;
 *   · pára quando o separador está escondido, e vai buscar assim que ele
 *     volta a estar à frente. Um ecrã minimizado não gasta pedidos, e ao
 *     voltar não mostra dados de há uma hora;
 *   · pára enquanto houver uma gravação a decorrer, para não trazer por cima
 *     um estado anterior ao que se acabou de gravar;
 *   · se um ciclo falhar, não diz nada. Uma falha de rede a meio de uma
 *     actualização automática não é notícia para quem está a trabalhar — o
 *     próximo ciclo resolve.
 */
export function useAutoRefresh(
  refresh: () => Promise<void> | void,
  {
    intervalMs = 180_000,
    enabled = true,
    /** Enquanto true, o ciclo espera. Usar durante gravações. */
    paused = false,
  }: { intervalMs?: number; enabled?: boolean; paused?: boolean } = {},
) {
  /** Quando os dados no ecrã foram lidos da base. */
  const [lastRefresh, setLastRefresh] = useState<number>(() => 0);
  const [refreshing, setRefreshing] = useState(false);

  // Refs para o intervalo não se reiniciar a cada render por a função mudar
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const emCurso = useRef(false);

  const correr = useCallback(async () => {
    // Um ciclo de cada vez: uma rede lenta não pode empilhar pedidos
    if (emCurso.current || pausedRef.current) return;
    emCurso.current = true;
    setRefreshing(true);
    try {
      await refreshRef.current();
      setLastRefresh(Date.now());
    } catch {
      // Silêncio de propósito — ver o comentário do topo
    } finally {
      emCurso.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const arrancar = () => {
      if (timer !== null) return;
      timer = setInterval(correr, intervalMs);
    };
    const parar = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible") {
        // Voltar ao separador é o momento em que mais interessa ter dados
        // frescos — não vale a pena esperar mais três minutos.
        correr();
        arrancar();
      } else {
        parar();
      }
    };

    if (document.visibilityState === "visible") arrancar();
    document.addEventListener("visibilitychange", aoMudarVisibilidade);

    return () => {
      parar();
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, [correr, enabled, intervalMs]);

  // Relógio próprio: sem ele, "há 2 min" ficaria a dizer "agora mesmo" até
  // à actualização seguinte. Só anda depois da primeira leitura.
  const [relogio, setRelogio] = useState(0);
  useEffect(() => {
    if (!lastRefresh) return;
    setRelogio(Date.now());
    const t = setInterval(() => setRelogio(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [lastRefresh]);

  return { lastRefresh, refreshing, refreshNow: correr, relogio };
}

/** "agora mesmo", "há 4 min" — para o operador saber se o que vê é recente. */
export function textoDesde(timestamp: number, agora: number = Date.now()): string {
  if (!timestamp) return "";
  const segundos = Math.max(0, Math.floor((agora - timestamp) / 1000));
  if (segundos < 60) return "agora mesmo";
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `há ${horas} h`;
}
