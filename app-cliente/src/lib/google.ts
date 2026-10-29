import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";
import { pedir } from "./api";
import { ErroDaApi } from "./erros";
import { ROTA_DE_ENTRAR, type SessaoNova } from "./entrada";

/**
 * ENTRAR COM O GOOGLE (A6, 2.ª build nativa, 29-10-2026).
 *
 * O Google Sign-In nativo do Android, com o botão clássico (`signIn`) — NUNCA
 * o «autoDetect» nem o «One Tap» que entra sem se carregar em nada. O
 * `webClientId` é o `GOOGLE_CLIENT_ID` do SITE (projecto clyon-466017): é ele
 * a audiência do `idToken`, que o site confere junto do Google (R1,
 * `google-id-token.ts`). Não é o do `google-services.json` (esse é do
 * Firebase, só para os avisos). O cliente OAuth Android de pt.clyon.cliente,
 * no mesmo projecto, é o que deixa esta app pedir o token: casa pelo pacote e
 * pela impressão SHA-1 da chave da EAS.
 *
 * O ID é público (vai em todas as páginas de entrada do site).
 */
export const WEB_CLIENT_ID = "443649873745-dv3db5v3nji00mrasbrr48orfqbgqsl2.apps.googleusercontent.com";

let configurado = false;
function configurar() {
  if (configurado) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, offlineAccess: false });
  configurado = true;
}

export type ResultadoDoGoogle = { tipo: "sessao"; sessao: SessaoNova } | { tipo: "cancelado" } | { tipo: "erro"; mensagem: string };

const NAO_DEU = "Não foi possível entrar com o Google. Tente outra vez, ou entre com o email.";

/** O toque em «Continuar com o Google»: escolher a conta, e o site dá a sessão (R1 `{ google }`). */
export async function entrarComGoogle(): Promise<ResultadoDoGoogle> {
  if (Platform.OS === "web") return { tipo: "erro", mensagem: NAO_DEU };
  try {
    configurar();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const r = await GoogleSignin.signIn();
    if (!isSuccessResponse(r)) return { tipo: "cancelado" };
    const idToken = r.data.idToken;
    // O token é de uso único: a escolha da conta não fica presa à app.
    void GoogleSignin.signOut().catch(() => {});
    if (!idToken) return { tipo: "erro", mensagem: NAO_DEU };
    const s = await pedir<{ token?: unknown; email?: unknown; expiraEm?: unknown }>(ROTA_DE_ENTRAR, {
      metodo: "POST",
      corpo: { google: idToken },
      semSessao: true,
    });
    if (typeof s.token !== "string" || !s.token || typeof s.email !== "string" || !s.email) return { tipo: "erro", mensagem: NAO_DEU };
    return {
      tipo: "sessao",
      sessao: { token: s.token, email: s.email.trim().toLowerCase(), expiraEm: typeof s.expiraEm === "string" ? s.expiraEm : null, entrada: "google" },
    };
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) return { tipo: "cancelado" };
    if (e instanceof ErroDaApi && e.message) return { tipo: "erro", mensagem: e.message };
    return { tipo: "erro", mensagem: NAO_DEU };
  }
}
