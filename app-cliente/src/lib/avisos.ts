import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { pedir, pedirComToken } from "./api";
import { apagarDoCofre, guardarNoCofre, guardarTokenDosAvisos, lerDoCofre, lerTokenDosAvisos } from "./sessao";

/**
 * OS AVISOS NO TELEMÓVEL (R6).
 *
 * Quem decide o que se avisa é o site: a app só pede a autorização, entrega
 * ao site o token que a Expo lhe dá (`POST /api/cliente/dispositivo`, gravado
 * com `app: "cliente"` — nunca toca na CLYON Pro do mesmo email) e abre o
 * pedido certo quando ele toca no aviso (`caminhoDoAviso`, pelo `pedidoId`).
 *
 * A AUTORIZAÇÃO PEDE-SE UMA VEZ, NO E4 (o momento em que o aviso tem valor);
 * ao abrir a app só se regista o telemóvel se já estiver autorizado e ele não
 * os tiver desligado na Conta. Ao sair (ou trocar de conta), o telemóvel sai
 * da conta no site (`DELETE`), com o token dessa conta.
 */

const DESLIGADOS = "clyon-cliente-avisos-desligados";
const JA_PERGUNTOU = "clyon-cliente-avisos-perguntou";

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

export const avisosDesligadosPorEle = async () => (await lerDoCofre(DESLIGADOS)) === "1";
export const jaPerguntouPelosAvisos = async () => (await lerDoCofre(JA_PERGUNTOU)) === "1";
export const marcarQueJaPerguntou = () => guardarNoCofre(JA_PERGUNTOU, "1");

async function registar(): Promise<ResultadoDosAvisos> {
  const projectId = idDoProjecto();
  if (!projectId) return { ok: false, motivo: "sem-projecto" };
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await pedir("/api/cliente/dispositivo", { metodo: "POST", corpo: { token } });
    await guardarTokenDosAvisos(token);
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: "falhou", detalhe: e instanceof Error ? e.message : String(e) };
  }
}

async function canal(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Pedidos",
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: "#0A7C87",
  });
}

/** Ao abrir a app (com sessão): regista o telemóvel só se já houver autorização e ele não os desligou. */
export async function registarSeJaAutorizado(): Promise<void> {
  if (Platform.OS === "web" || !Device.isDevice) return;
  if (await avisosDesligadosPorEle()) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
    await canal();
    await registar();
  } catch {
    /* sem avisos desta vez; o pedido continua na lista */
  }
}

/** O «Sim» do E4 e o «Ligar» da Conta: pede a autorização (se for preciso) e regista. */
export async function ligarAvisos(): Promise<ResultadoDosAvisos> {
  if (Platform.OS === "web") return { ok: false, motivo: "web" };
  if (!Device.isDevice) return { ok: false, motivo: "simulador" };
  await canal();
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return { ok: false, motivo: "recusou" };
  const r = await registar();
  if (r.ok) await apagarDoCofre(DESLIGADOS);
  return r;
}

/** Tira este telemóvel da conta no site, com o token dessa conta. Nunca lança. */
export async function tirarTelemovelDaConta(tokenDaSessao: string | null): Promise<void> {
  const token = await lerTokenDosAvisos();
  if (!token || !tokenDaSessao) return;
  try {
    await pedirComToken("/api/cliente/dispositivo", tokenDaSessao, { metodo: "DELETE", corpo: { token } });
  } catch {
    /* sem rede: o site deixa de o usar quando a Expo disser que já não existe */
  }
}

/** O «Desligar» da Conta: o site deixa de avisar este telemóvel, e a escolha fica. */
export async function desligarAvisos(tokenDaSessao: string | null): Promise<void> {
  await tirarTelemovelDaConta(tokenDaSessao);
  await apagarDoCofre("clyon-cliente-aviso");
  await guardarNoCofre(DESLIGADOS, "1");
}

export async function avisosLigados(): Promise<boolean> {
  return !!(await lerTokenDosAvisos()) && !(await avisosDesligadosPorEle());
}
