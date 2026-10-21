import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { pedir } from "./api";

/**
 * OS AVISOS NO TELEMÓVEL.
 *
 * Quem decide o que se avisa é o site: a app só pede a permissão, entrega ao
 * site o token que a Expo lhe dá (`/api/profissionais/dispositivo`) e abre o
 * trabalho certo quando ele toca no aviso. No navegador não há nada disto.
 */

const CHAVE_DO_TOKEN = "clyon-pro-aviso";
/**
 * «Desligar» na Conta (versão 12): fica guardado no telemóvel, para a app não
 * os voltar a ligar sozinha ao abrir. Sair da conta não conta como escolha.
 */
const CHAVE_DESLIGADOS = "clyon-pro-avisos-desligados";

export async function avisosDesligadosPorEle(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return (await SecureStore.getItemAsync(CHAVE_DESLIGADOS)) === "1";
  } catch {
    return false;
  }
}

/** Ao entrar ou abrir a app: liga os avisos, a não ser que ele os tenha desligado. */
export async function ligarAvisosSeQuiser(): Promise<void> {
  if (await avisosDesligadosPorEle()) return;
  await ligarAvisos();
}

/** O «Desligar» da Conta: o site deixa de avisar este telemóvel, e a escolha fica. */
export async function desligarAvisosPorEscolha(): Promise<void> {
  await desligarAvisos();
  if (Platform.OS === "web") return;
  try {
    await SecureStore.setItemAsync(CHAVE_DESLIGADOS, "1");
  } catch {
    /* sem armazenamento: ao abrir de novo, liga-os outra vez */
  }
}

/** O «Ligar» da Conta: liga e esquece o «desligado». */
export async function ligarAvisosPorEscolha(): Promise<ResultadoDosAvisos> {
  const r = await ligarAvisos();
  if (r.ok && Platform.OS !== "web") {
    try {
      await SecureStore.deleteItemAsync(CHAVE_DESLIGADOS);
    } catch {
      /* fica desligado ao abrir; o botão continua lá */
    }
  }
  return r;
}

// Com a app aberta, o aviso aparece na mesma — um pedido novo não espera.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type ResultadoDosAvisos =
  | { ok: true }
  | { ok: false; motivo: "web" | "simulador" | "recusou" | "sem-projecto" | "falhou"; detalhe?: string };

function idDoProjecto(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

export async function estadoDaPermissao(): Promise<"concedida" | "por-pedir" | "recusada" | "indisponivel"> {
  if (Platform.OS === "web" || !Device.isDevice) return "indisponivel";
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "concedida";
  return canAskAgain ? "por-pedir" : "recusada";
}

/** Pede a permissão (se for preciso) e regista o telemóvel no site. */
export async function ligarAvisos(): Promise<ResultadoDosAvisos> {
  if (Platform.OS === "web") return { ok: false, motivo: "web" };
  if (!Device.isDevice) return { ok: false, motivo: "simulador" };

  if (Platform.OS === "android") {
    // Importância máxima: um pedido novo tem de tocar e aparecer por cima.
    await Notifications.setNotificationChannelAsync("default", {
      name: "Trabalhos",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0A7C87",
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return { ok: false, motivo: "recusou" };

  const projectId = idDoProjecto();
  if (!projectId) return { ok: false, motivo: "sem-projecto" };

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await pedir("/api/profissionais/dispositivo", { metodo: "POST", corpo: { token } });
    await SecureStore.setItemAsync(CHAVE_DO_TOKEN, token);
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: "falhou", detalhe: e instanceof Error ? e.message : String(e) };
  }
}

/** Ao sair: o site deixa de mandar avisos para este telemóvel. Nunca lança. */
export async function desligarAvisos(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const token = await SecureStore.getItemAsync(CHAVE_DO_TOKEN);
    if (token) {
      await pedir("/api/profissionais/dispositivo", { metodo: "DELETE", corpo: { token }, semSessao: true });
      await SecureStore.deleteItemAsync(CHAVE_DO_TOKEN);
    }
  } catch {
    /* sem rede: o site esquece-o quando a Expo disser que já não existe */
  }
}
