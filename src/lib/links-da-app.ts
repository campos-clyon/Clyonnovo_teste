/**
 * OS LINKS DO SITE QUE ABREM A APP DO PROFISSIONAL — 18-10-2026.
 *
 * Um link de clyon.pt/profissionais/painel… que chegue por WhatsApp, email ou
 * aviso abre a CLYON Pro, se ela estiver instalada, e o painel no navegador se
 * não estiver. Para isso, o Android e o iPhone perguntam ao site se a app é
 * mesmo dele, em dois ficheiros de /.well-known que saem daqui.
 *
 * As provas vêm de variáveis de ambiente porque só existem depois de a app ser
 * assinada pela primeira vez:
 *   APP_PRO_ANDROID_SHA256 — impressões digitais SHA-256 do certificado (a do
 *                            Play Console e a da EAS), separadas por vírgulas
 *   APP_PRO_APPLE_TEAM_ID  — o Team ID da conta Apple Developer
 * Sem elas, os ficheiros saem vazios e válidos: nenhum link abre a app, e o
 * painel no navegador continua a funcionar como hoje.
 */

/** O identificador da app nas duas lojas. Novo de propósito: o `pt.clyon.app`
 * foi usado por duas apps antigas e perdeu a chave de assinatura. */
export const ID_DA_APP_PRO = "pt.clyon.pro";

/** Os caminhos que a app sabe abrir. O resto do site fica no navegador. */
export const CAMINHOS_DA_APP_PRO = ["/profissionais/painel", "/profissionais/pedidos/"] as const;

type Ambiente = Record<string, string | undefined>;

const SHA256 = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/** As impressões digitais válidas, em maiúsculas. As mal escritas ficam de fora. */
export function impressoesDoAndroid(ambiente: Ambiente): string[] {
  return (ambiente.APP_PRO_ANDROID_SHA256 ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => SHA256.test(s));
}

/** O `assetlinks.json` (Android App Links). */
export function assetLinks(ambiente: Ambiente) {
  const impressoes = impressoesDoAndroid(ambiente);
  if (!impressoes.length) return [];
  return [
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        // A palavra-passe guardada no Chrome serve também na app.
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: ID_DA_APP_PRO,
        sha256_cert_fingerprints: impressoes,
      },
    },
  ];
}

/** O `apple-app-site-association` (Universal Links e palavras-passe). */
export function associacaoDaApple(ambiente: Ambiente) {
  const equipa = (ambiente.APP_PRO_APPLE_TEAM_ID ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(equipa)) {
    return { applinks: { details: [] }, webcredentials: { apps: [] } };
  }
  const app = `${equipa}.${ID_DA_APP_PRO}`;
  return {
    applinks: {
      details: [
        {
          appIDs: [app],
          components: CAMINHOS_DA_APP_PRO.map((c) => ({ "/": `${c}*` })),
        },
      ],
    },
    webcredentials: { apps: [app] },
  };
}
