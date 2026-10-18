import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";
import { Platform, useColorScheme } from "react-native";

/**
 * As cores da CLYON Pro — o ciano da marca, as mesmas famílias do painel no
 * navegador. Claro e escuro, porque o profissional abre a app às seis da manhã
 * dentro da carrinha.
 *
 * O ESCURO É O AZUL-NOITE DO ÍCONE (18-10-2026, pedido do dono): o mesmo
 * #0F172A do fundo do ícone, do ecrã de arranque e do rodapé do site — abrir a
 * app não dá um salto de cor. Os botões levam o ciano do site (#22D3EE).
 */
const CLARO = {
  fundo: "#F2F6F6",
  superficie: "#FFFFFF",
  tinta: "#132321",
  suave: "#546965",
  linha: "#D5DFDD",
  marca: "#0A7C87",
  marcaSuave: "#E0F1F2",
  sobreMarca: "#FFFFFF",
  bom: "#2A7849",
  bomSuave: "#E3F2E8",
  aviso: "#9A6500",
  avisoSuave: "#FBEFD6",
  mau: "#AD3A29",
  mauSuave: "#F8E4E0",
};

const ESCURO: typeof CLARO = {
  fundo: "#0F172A",
  superficie: "#1E293B",
  tinta: "#E2E8F0",
  suave: "#94A3B8",
  linha: "#334155",
  marca: "#22D3EE",
  marcaSuave: "#133D51",
  sobreMarca: "#0F172A",
  bom: "#5CC488",
  bomSuave: "#0E3B2E",
  aviso: "#F0B43A",
  avisoSuave: "#382A0C",
  mau: "#F07B67",
  mauSuave: "#3A1A15",
};

export type Cores = typeof CLARO;

// ── O modo do ecrã que ele escolhe na Conta (18-10-2026, pedido do dono) ──────
// «auto» segue o telemóvel; «claro» e «escuro» (o azul-noite) ficam fixos.
// Guarda-se no telemóvel, como a sessão; no navegador, no localStorage.

export type Modo = "auto" | "claro" | "escuro";
const CHAVE_DO_MODO = "clyon-pro-modo";
let modo: Modo = "auto";
let modoLido = false;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
const subscrever = (f: () => void) => {
  ouvintes.add(f);
  return () => void ouvintes.delete(f);
};

/** Lê o modo guardado. Chama-se uma vez, ao abrir a app. */
export async function lerModoGuardado(): Promise<void> {
  try {
    const v =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(CHAVE_DO_MODO)
        : await SecureStore.getItemAsync(CHAVE_DO_MODO);
    if (v === "auto" || v === "claro" || v === "escuro") modo = v;
  } catch {
    /* sem o guardado, segue o telemóvel */
  }
  modoLido = true;
  avisar();
}

export function escolherModo(novo: Modo): void {
  modo = novo;
  avisar();
  try {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(CHAVE_DO_MODO, novo);
    else void SecureStore.setItemAsync(CHAVE_DO_MODO, novo).catch(() => {});
  } catch {
    /* fica até fechar a app */
  }
}

export function useModo(): Modo {
  return useSyncExternalStore(subscrever, () => modo, () => modo);
}

export function useModoLido(): boolean {
  return useSyncExternalStore(subscrever, () => modoLido, () => modoLido);
}

export function useEscuro(): boolean {
  const sistema = useColorScheme();
  const m = useModo();
  return m === "escuro" || (m === "auto" && sistema === "dark");
}

export function useCores(): Cores {
  return useEscuro() ? ESCURO : CLARO;
}

export const ESPACO = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const RAIO = { s: 6, m: 10, l: 14 } as const;
/** Tamanhos pensados para um telemóvel de 360–400 px de largura, com a letra do sistema até 1,2×. */
export const LETRA = { pequena: 12, normal: 15, media: 16, titulo: 20, grande: 24 } as const;
