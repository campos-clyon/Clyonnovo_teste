import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * O COFRE DO TELEMÓVEL (Keychain no iPhone, Keystore no Android).
 *
 * - O token da sessão do cliente: o site assina-o (`POST /api/cliente/entrar`)
 *   e confirma-o; a app só o guarda e o manda no cabeçalho.
 * - O email e a forma de entrar, para a app dizer com que conta se entrou (a
 *   renovação da sessão só devolve o token).
 * - O token dos avisos que o site guardou (R6), para o tirar ao sair.
 * - O código do aparelho (`codigo-do-aparelho.ts`).
 *
 * No navegador (só para ver os ecrãs durante o desenvolvimento) não há cofre,
 * e usa-se o localStorage.
 */

const TOKEN = "clyon-cliente-sessao";
const EMAIL = "clyon-cliente-email";
const ENTRADA = "clyon-cliente-entrada";
const AVISOS = "clyon-cliente-aviso";

export async function lerDoCofre(chave: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(chave) ?? null;
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(chave);
  } catch {
    return null;
  }
}

export async function guardarNoCofre(chave: string, valor: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.setItem(chave, valor);
    } catch {
      /* sem armazenamento: dura até fechar o separador */
    }
    return;
  }
  await SecureStore.setItemAsync(chave, valor);
}

export async function apagarDoCofre(chave: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.removeItem(chave);
    } catch {
      /* nada a apagar */
    }
    return;
  }
  try {
    await SecureStore.deleteItemAsync(chave);
  } catch {
    /* já não estava lá */
  }
}

export const lerToken = () => lerDoCofre(TOKEN);
export const guardarToken = (token: string) => guardarNoCofre(TOKEN, token);
export const lerEmail = () => lerDoCofre(EMAIL);
export const guardarEmail = (email: string) => guardarNoCofre(EMAIL, email);
export const lerEntrada = () => lerDoCofre(ENTRADA);
export const guardarEntrada = (entrada: string) => guardarNoCofre(ENTRADA, entrada);
export const lerTokenDosAvisos = () => lerDoCofre(AVISOS);
export const guardarTokenDosAvisos = (token: string) => guardarNoCofre(AVISOS, token);
export const esquecerTokenDosAvisos = () => apagarDoCofre(AVISOS);

export async function esquecerSessao(): Promise<void> {
  await apagarDoCofre(TOKEN);
  await apagarDoCofre(EMAIL);
  await apagarDoCofre(ENTRADA);
  await apagarDoCofre(AVISOS);
}
