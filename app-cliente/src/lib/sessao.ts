import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * O token da sessão do cliente, guardado no cofre do telemóvel (Keychain no
 * iPhone, Keystore no Android). O site assina-o (`POST /api/cliente/entrar`)
 * e confirma-o; a app só o guarda e o manda no cabeçalho.
 *
 * O email fica ao lado, para a app dizer com que conta se entrou (a renovação
 * da sessão só devolve o token).
 *
 * No navegador (só para ver os ecrãs durante o desenvolvimento) não há cofre,
 * e usa-se o localStorage.
 */

const TOKEN = "clyon-cliente-sessao";
const EMAIL = "clyon-cliente-email";

async function ler(chave: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(chave) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(chave);
}

async function guardar(chave: string, valor: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.setItem(chave, valor);
    } catch {
      /* sem armazenamento: a sessão dura até fechar o separador */
    }
    return;
  }
  await SecureStore.setItemAsync(chave, valor);
}

async function apagar(chave: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.removeItem(chave);
    } catch {
      /* nada a apagar */
    }
    return;
  }
  await SecureStore.deleteItemAsync(chave);
}

export const lerToken = () => ler(TOKEN);
export const guardarToken = (token: string) => guardar(TOKEN, token);
export const lerEmail = () => ler(EMAIL);
export const guardarEmail = (email: string) => guardar(EMAIL, email);

export async function esquecerSessao(): Promise<void> {
  await apagar(TOKEN);
  await apagar(EMAIL);
}
