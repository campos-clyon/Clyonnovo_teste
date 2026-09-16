"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * UM RELÓGIO SÓ, PARA O BACKOFFICE INTEIRO — 16-09-2026.
 *
 * "Vamos unificar tudo, fazer tudo actualizar junto em 20s com um único."
 *
 * Havia vinte e dois sítios a chamar este hook e cada um trazia o seu número:
 * 10 segundos no suporte, 30 nas negociações, 60 nos pedidos do cliente, 120
 * em dois `setInterval` escritos à mão, 180 por omissão. Vinte e dois
 * temporizadores a disparar em vinte e dois momentos diferentes — e duas
 * consequências, uma chata e outra má:
 *
 *   · para mudar o ritmo era preciso mudar vinte e dois números, e no dia
 *     seguinte já havia um que ninguém tinha mudado;
 *   · dois painéis do MESMO ecrã mostravam estados de momentos diferentes. A
 *     lista dizia três a aguardar e o contador do menu dizia dois, e a
 *     diferença durava até o mais lento dos dois relógios bater.
 *
 * Agora o pulso é um só. Quem chama diz apenas SE quer bater, nunca de quanto
 * em quanto tempo: esse número vive aqui, uma vez.
 *
 * O TEMPORIZADOR SÓ EXISTE ENQUANTO FAZ FALTA. Nasce ao primeiro subscritor,
 * morre ao último, e pára com o separador escondido — um ecrã minimizado não
 * gasta pedidos. Ao voltar ao separador bate LOGO, sem esperar os 20 segundos:
 * é o momento em que mais interessa ter dados frescos.
 *
 * E CONTINUA DISCRETO, que é o que o tornava utilizável:
 *
 *   · não mexe em nenhum estado de "a carregar" — quem chama recebe
 *     `silent = true` e só substitui o que é leitura;
 *   · espera enquanto houver uma gravação a decorrer (`paused`), para não
 *     trazer por cima um estado anterior ao que se acabou de gravar;
 *   · se um ciclo falhar, não diz nada. Uma falha de rede a meio de uma
 *     actualização automática não é notícia para quem está a trabalhar — o
 *     próximo ciclo resolve.
 */

/**
 * De quanto em quanto tempo o backoffice inteiro se actualiza.
 *
 * Vinte segundos é o que ficou de uma conversa: dez pareciam instantâneos mas
 * eram seis pedidos por minuto por cada separador aberto; um minuto já se nota
 * à espera de uma resposta de um cliente. Mudar este número muda todos os
 * ecrãs ao mesmo tempo, que é a razão de ele existir.
 */
export const INTERVALO_DO_CICLO = 20_000;

/* ── O pulso partilhado ────────────────────────────────────────────────────
 *
 * Fora do React de propósito: é um recurso do separador, não de um componente.
 * Um `setInterval` por dentro de cada hook era exactamente o problema.
 */
type Batida = () => void;
const ouvintes = new Set<Batida>();
let temporizador: ReturnType<typeof setInterval> | null = null;
let aOuvirOSeparador = false;

function separadorVisivel(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function bater() {
  // Uma cópia: um ouvinte que se desligue a meio da batida não pode fazer o
  // ciclo saltar o seguinte.
  for (const o of [...ouvintes]) o();
}

function arrancar() {
  if (temporizador !== null || ouvintes.size === 0 || !separadorVisivel()) return;
  temporizador = setInterval(bater, INTERVALO_DO_CICLO);
}

function parar() {
  if (temporizador === null) return;
  clearInterval(temporizador);
  temporizador = null;
}

function aoMudarVisibilidade() {
  if (separadorVisivel()) {
    bater();
    arrancar();
  } else {
    parar();
  }
}

function subscrever(o: Batida): () => void {
  ouvintes.add(o);
  if (!aOuvirOSeparador && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    aOuvirOSeparador = true;
  }
  arrancar();
  return () => {
    ouvintes.delete(o);
    if (ouvintes.size === 0) parar();
  };
}

export function useAutoRefresh(
  refresh: () => Promise<void> | void,
  {
    enabled = true,
    /** Enquanto true, o ciclo espera. Usar durante gravações. */
    paused = false,
  }: { enabled?: boolean; paused?: boolean } = {},
) {
  /** Quando os dados no ecrã foram lidos da base. */
  const [lastRefresh, setLastRefresh] = useState<number>(() => 0);
  const [refreshing, setRefreshing] = useState(false);

  // Refs para a subscrição não se desfazer e refazer a cada render por a
  // função mudar — era isso que reiniciava o relógio antigo a toda a hora.
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
    return subscrever(() => void correr());
  }, [correr, enabled]);

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
