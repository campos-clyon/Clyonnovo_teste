/**
 * OS LINKS DO SITE QUE ABREM A APP DO PROFISSIONAL — 18-10-2026.
 *
 * Um link de clyon.pt/profissionais/painel… que chegue por WhatsApp, email ou
 * aviso abre a CLYON Pro, se ela estiver instalada, e o painel no navegador se
 * não estiver. Para isso, o Android e o iPhone perguntam ao site se a app é
 * mesmo dele, em dois ficheiros de /.well-known que saem daqui.
 *
 * As provas do Android são as impressões digitais SHA-256 dos certificados que
 * assinam a app. São públicas — vêm dentro de qualquer instalação —, por isso
 * ficam aqui desde que a app foi assinada pela primeira vez (20-10-2026):
 *   - a chave com que a Google Play assina o que instala (Play Console →
 *     Integridade da app → Assinatura de apps);
 *   - a chave de carregamento da EAS, que assina os APK de teste.
 * As variáveis de ambiente juntam outras, se um dia houver uma chave nova:
 *   APP_PRO_ANDROID_SHA256 — impressões SHA-256, separadas por vírgulas
 *   APP_PRO_APPLE_TEAM_ID  — o Team ID da conta Apple Developer
 * Sem Team ID, o ficheiro da Apple sai vazio e válido: no iPhone os links
 * continuam a abrir o navegador.
 */

/** O identificador da app nas duas lojas. Novo de propósito: o `pt.clyon.app`
 * foi usado por duas apps antigas e perdeu a chave de assinatura. */
export const ID_DA_APP_PRO = "pt.clyon.pro";

/**
 * Os caminhos que a app sabe abrir. O resto do site fica no navegador.
 *
 * `/profissionais/definir-senha/` entrou a 20-10-2026: o link do email de
 * aprovação (e o de «esqueci-me da palavra-passe») abre a app, e ele escolhe a
 * palavra-passe lá dentro e fica logo com a sessão — em vez de entrar no site
 * e ter de fechar o navegador para ir à app.
 */
export const CAMINHOS_DA_APP_PRO = [
  "/profissionais/painel",
  "/profissionais/pedidos/",
  "/profissionais/definir-senha/",
] as const;

/** As impressões digitais dos certificados da CLYON Pro (ver acima). */
export const IMPRESSOES_DA_APP_PRO = [
  // Assinatura de apps da Google Play (o que os testadores e a loja instalam).
  "75:5B:1E:64:84:C8:51:10:2D:82:77:83:8F:7F:3D:B6:7E:B0:24:DF:F1:AA:D2:3D:A1:39:9E:A0:E7:81:69:55",
  // Chave de carregamento da EAS (os APK de teste, instalados à mão).
  "4B:A9:2D:75:AA:A7:0C:D8:7B:D4:E7:01:70:92:16:15:FC:61:F7:A5:9B:E2:66:FE:A6:97:F6:8F:CA:26:3E:39",
] as const;

/**
 * O link «Abrir na app» para o Android, para quando o link do email abriu o
 * navegador na mesma (o Gmail às vezes abre-o no navegador dele, ou a app foi
 * instalada depois de o email chegar). É um `intent://` do Chrome: com a app
 * instalada, abre-a nesse caminho; sem ela, volta à mesma página.
 */
export function abrirNaAppNoAndroid(caminho: string, paginaAtual: string): string {
  const semBarra = caminho.replace(/^\/+/, "");
  return (
    `intent://clyon.pt/${semBarra}#Intent;scheme=https;package=${ID_DA_APP_PRO};` +
    `S.browser_fallback_url=${encodeURIComponent(paginaAtual)};end`
  );
}

/** O identificador da app de cliente (d8, 28-10-2026). */
export const ID_DA_APP_CLIENTE = "pt.clyon.cliente";

/**
 * OS CAMINHOS QUE A APP DE CLIENTE ABRE — R9 v2, 28-10-2026 (S2).
 *
 * `/entrar/app` (caminho exacto: o link de entrada pedido na app, preso ao
 * telemóvel) e `/pedido/` (prefixo: o link de um pedido, que a app junta à
 * conta — R10). O `/entrar/link` NÃO: um link de entrada pedido no site
 * continua a abrir o site, mesmo num Android com a app. E nada de
 * `/profissionais/`, que é da CLYON Pro: os caminhos das duas apps não se
 * cruzam (há um teste).
 */
export const CAMINHOS_DA_APP_CLIENTE = ["/entrar/app", "/pedido/"] as const;

/**
 * As impressões SHA-256 dos certificados da app de cliente. Públicas, como as
 * da Pro: vêm dentro de qualquer instalação.
 *   - a chave da EAS do projecto da app de cliente (29-10-2026), lida no
 *     certificado que assina o 1.º APK (build 3879f098) — os APK de teste.
 * A da assinatura da Play junta-se quando a app lá estiver. Outras podem vir
 * pela variável `APP_CLIENTE_ANDROID_SHA256` (separadas por vírgulas), sem
 * publicar código. Sem nenhuma, a app de cliente não entra no assetlinks.json
 * (uma entrada sem impressão não verifica nada).
 */
export const IMPRESSOES_DA_APP_CLIENTE: readonly string[] = [
  // Chave de carregamento da EAS (os APK de teste, instalados à mão).
  "C5:F0:B9:CA:0A:BB:C1:08:6C:8A:16:1B:19:4E:D8:F7:FE:17:A1:12:9C:55:1E:E9:EA:40:5D:EE:EB:80:6B:55",
];

/** O mesmo «Abrir na app», para a app de cliente (a página /entrar/app). */
export function abrirNaAppDeClienteNoAndroid(caminho: string, paginaAtual: string): string {
  const semBarra = caminho.replace(/^\/+/, "");
  return (
    `intent://clyon.pt/${semBarra}#Intent;scheme=https;package=${ID_DA_APP_CLIENTE};` +
    `S.browser_fallback_url=${encodeURIComponent(paginaAtual)};end`
  );
}

type Ambiente = Record<string, string | undefined>;

const SHA256 = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/** As impressões válidas: as da app e as das variáveis, em maiúsculas, sem
 * repetidas. As mal escritas ficam de fora. */
export function impressoesDoAndroid(ambiente: Ambiente): string[] {
  const extra = (ambiente.APP_PRO_ANDROID_SHA256 ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => SHA256.test(s));
  return [...new Set([...IMPRESSOES_DA_APP_PRO, ...extra])];
}

/** As impressões válidas da app de cliente: as constantes e as da variável. */
export function impressoesDaAppDeCliente(ambiente: Ambiente): string[] {
  const extra = (ambiente.APP_CLIENTE_ANDROID_SHA256 ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => SHA256.test(s));
  return [...new Set([...IMPRESSOES_DA_APP_CLIENTE.map((s) => s.toUpperCase()), ...extra])].filter((s) =>
    SHA256.test(s),
  );
}

/** O `assetlinks.json` (Android App Links). */
export function assetLinks(ambiente: Ambiente) {
  const doCliente = impressoesDaAppDeCliente(ambiente);
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
        sha256_cert_fingerprints: impressoesDoAndroid(ambiente),
      },
    },
    // A app de cliente (R9 v2), só com a sua impressão: abre os links, sem palavras-passe.
    ...(doCliente.length > 0
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: ID_DA_APP_CLIENTE,
              sha256_cert_fingerprints: doCliente,
            },
          },
        ]
      : []),
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
        // A app de cliente (R9 v2): `/entrar/app*` e `/pedido/*`.
        {
          appIDs: [`${equipa}.${ID_DA_APP_CLIENTE}`],
          components: CAMINHOS_DA_APP_CLIENTE.map((c) => ({ "/": `${c}*` })),
        },
      ],
    },
    webcredentials: { apps: [app] },
  };
}
