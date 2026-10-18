import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * O token da sessão, guardado no cofre do telemóvel (Keychain no iPhone,
 * Keystore no Android). É o mesmo token do painel no navegador — o site
 * assina-o e confirma-o; a app só o guarda e o manda no cabeçalho.
 *
 * No navegador (só para ver os ecrãs durante o desenvolvimento) não há cofre,
 * e usa-se o localStorage.
 */

const CHAVE = "clyon-pro-sessao";

export async function lerToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(CHAVE) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(CHAVE);
}

export async function guardarToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.setItem(CHAVE, token);
    } catch {
      /* sem armazenamento: a sessão dura até fechar o separador */
    }
    return;
  }
  await SecureStore.setItemAsync(CHAVE, token);
}

export async function esquecerToken(): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.removeItem(CHAVE);
    } catch {
      /* nada a apagar */
    }
    return;
  }
  await SecureStore.deleteItemAsync(CHAVE);
}
