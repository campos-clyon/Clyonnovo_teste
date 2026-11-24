import { Platform } from "react-native";
import { pedir, versaoDestaApp } from "./api";
import { guardarNoCofre, lerDoCofre } from "./sessao";

/**
 * A PRIMEIRA ABERTURA — 24-11-2026 (d108, P5 do Produto).
 *
 * Uma vez por telemóvel, a app diz ao site que abriu: só a versão e a
 * plataforma (`POST /api/cliente/primeira-abertura`), SEM IDENTIFICADOR
 * NENHUM e sem a sessão (Jurídico, 24-11-2026: um número do aparelho enviado
 * ao site precisaria de consentimento — Lei 41/2004, art. 5.º). A marca «já
 * avisou» fica só no cofre deste telemóvel e nunca sai daqui. Sem rede, tenta
 * outra vez na abertura seguinte. Nunca lança.
 */

export const ROTA_DA_PRIMEIRA_ABERTURA = "/api/cliente/primeira-abertura";
const JA_AVISOU = "clyon-cliente-primeira-abertura";

export async function avisarAPrimeiraAbertura(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    if ((await lerDoCofre(JA_AVISOU)) === "1") return;
    await pedir(ROTA_DA_PRIMEIRA_ABERTURA, {
      metodo: "POST",
      semSessao: true,
      corpo: { versao: versaoDestaApp(), plataforma: Platform.OS },
    });
    await guardarNoCofre(JA_AVISOU, "1");
  } catch {
    /* sem rede ou com o site em baixo: fica para a próxima abertura */
  }
}
