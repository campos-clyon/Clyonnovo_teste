import { router } from "expo-router";
import { useSyncExternalStore } from "react";
import { AppState, BackHandler, Platform } from "react-native";
import { sessaoNovaAoVoltar } from "./pedido-a-meio";

/**
 * A SESSÃO DA APP (d5, 03-11-2026) — um número que sobe sempre que a app
 * volta depois de ter sido fechada (as regras estão em `sessaoNovaAoVoltar`,
 * `pedido-a-meio.ts`). Vive só na memória: abrir a app de raiz começa na 1.
 * Serve ao Pedir para perguntar pelo pedido a meio uma vez por sessão.
 */
let sessao = 1;
let saiuEm: number | null = null;
let voltarSemDestinoEm: number | null = null;
let vigiada = false;
const ouvintes = new Set<() => void>();

function vigiar() {
  if (vigiada || Platform.OS === "web") return;
  vigiada = true;
  AppState.addEventListener("change", (estado) => {
    const agora = Date.now();
    if (estado === "background") {
      if (saiuEm === null) saiuEm = agora;
      return;
    }
    if (estado !== "active") return;
    const nova = sessaoNovaAoVoltar({ saiuEm, voltouEm: agora, voltarSemDestinoEm });
    saiuEm = null;
    voltarSemDestinoEm = null;
    if (nova) {
      sessao += 1;
      for (const f of ouvintes) f();
    }
  });
  // O «voltar» sem ecrã para onde voltar fecha a app; não o trata, só o anota.
  if (Platform.OS === "android") {
    BackHandler.addEventListener("hardwareBackPress", () => {
      try {
        if (!router.canGoBack()) voltarSemDestinoEm = Date.now();
      } catch {
        /* a navegação ainda não está pronta: não se anota nada */
      }
      return false;
    });
  }
}

function subscrever(f: () => void) {
  vigiar();
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

const lerSessao = () => sessao;

/** A sessão da app agora (o ecrã volta a desenhar-se quando muda). */
export function useSessaoDaApp(): number {
  return useSyncExternalStore(subscrever, lerSessao, lerSessao);
}

/** A sessão em que o Pedir já mostrou o rascunho (perguntou, ou não havia nada a perguntar). */
let pedirVistoNaSessao: number | null = null;
export const sessaoEmQueOPedirFoiVisto = () => pedirVistoNaSessao;
export function marcarOPedirVisto(n: number): void {
  pedirVistoNaSessao = n;
}
