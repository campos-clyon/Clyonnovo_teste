/*
 * O REMENDO DA ROTA /login — 24-11-2026.
 *
 * Desde o WhatsApp Web 2.3000.1055852612, uma sessão sem login é mandada de
 * https://web.whatsapp.com/ para https://web.whatsapp.com/login/. Nessa página
 * o módulo `WAWebSocketModel` não existe: `window.require('WAWebSocketModel')`
 * dá null. A whatsapp-web.js 1.34.7 lê `.Socket.state` dele logo no `inject`,
 * e a ponte morria em ~2 s com «Cannot read properties of null (reading
 * 'Socket')» — sem QR, sem código de emparelhamento, em todos os arranques
 * (avaria de 24-11, desde as 07:40). Fixar uma versão antiga da página não
 * chegou: o servidor redirecciona na mesma.
 *
 * Na /login existe o `WAWebBackendEventBus` (`BackendEventBus`): o estado está
 * em `socketState`, os eventos são `set_socket_state` (com o estado) e
 * `open_socket_stream`. Visto numa sonda a 24-11 (2.3000.1056039834): na
 * /login existem também todos os módulos de que o emparelhamento precisa
 * (Conn, Cmd, AltDeviceLinking, RegistrationUtils…), mas NÃO o
 * `WAWebCollections` — a app inteira só carrega depois de emparelhar.
 * Referência (não instalada): issue #201988 e PR #201990 do repositório
 * wwebjs/whatsapp-web.js.
 *
 * O QUE ISTO FAZ: depois do `npm ci`, troca no Client.js e no AuthStore.js
 * cada `window.require('WAWebSocketModel').Socket` por
 * `window.__clyonSocket()`, que devolve o Socket verdadeiro quando ele existe
 * (sessão já emparelhada, rota /) e, na /login, um adaptador por cima do
 * BackendEventBus com a mesma forma (`state`, `on`/`off` de `change:state` e
 * `change:hasSynced`, `logout`, `reconnect`). O adaptador é definido no início
 * de cada `inject` (que corre de novo a cada navegação).
 *
 * Só cobre a versão VERSAO_COBERTA, e confere a impressão digital dos dois
 * ficheiros antes de mexer: qualquer diferença falha o build com uma
 * mensagem clara, em vez de publicar uma ponte que não arranca.
 *
 * Correr: `node remendar-wwebjs.mjs` na pasta da ponte (o Dockerfile fá-lo).
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const VERSAO_COBERTA = "1.34.7";

/** SHA-256 dos ficheiros originais da 1.34.7, tal como vêm do npm. */
export const IMPRESSOES = {
  "src/Client.js": "36c70c1eb058087624e57ddea6b0c4d4a140faa2daf9c097dc670697ac321389",
  "src/util/Injected/AuthStore/AuthStore.js": "e396ed6b2c6eb8882c71f8a3c3f37d9c5bd7a006515ce7495fdc69679125027e",
};

export const MARCA = "/* CLYON: remendo da rota /login (24-11-2026) */";

/** Cada forma de `window.require('WAWebSocketModel').Socket`, numa linha ou partida em três. */
const SOCKET = /window\s*\.require\('WAWebSocketModel'\)\s*\.Socket\b/g;
const SUBSTITUTO = "window.__clyonSocket()";

/** Quantas vezes aparece em cada ficheiro da 1.34.7 — se mudar, não é a mesma biblioteca. */
export const OCORRENCIAS = {
  "src/Client.js": 12,
  "src/util/Injected/AuthStore/AuthStore.js": 1,
};

/** Onde o adaptador é definido: logo antes do ExposeAuthStore, no `inject`. */
const ANCORA = "        await this.pupPage.evaluate(ExposeAuthStore);\n";

/**
 * Corre DENTRO da página do WhatsApp Web (vai para o Client.js pelo
 * `toString`). Tem de ser auto-suficiente: nada de fora desta função.
 */
export function definirOSocketDaClyon() {
  if (typeof window.__clyonSocket === "function") return;
  const EVENTOS = { "change:state": "set_socket_state", "change:hasSynced": "open_socket_stream" };
  let adaptador = null;
  let doBus = null;
  const embrulhos = [];
  // Na /login a app inteira (WAWebCollections) ainda não carregou: o «pronto»
  // só serve depois de ela existir. Espera-se por ela até 60 s; se a página
  // navegar para / entretanto, esta espera morre com ela e o inject seguinte
  // trata do resto com o Socket verdadeiro.
  const quandoAAppExistir = (fn) => {
    const desde = Date.now();
    const ver = () => {
      if (window.require("WAWebCollections") || Date.now() - desde > 60000) fn();
      else setTimeout(ver, 500);
    };
    ver();
  };
  window.__clyonSocket = () => {
    const real = window.require("WAWebSocketModel");
    if (real && real.Socket) return real.Socket;
    const modulo = window.require("WAWebBackendEventBus");
    const bus = modulo && modulo.BackendEventBus;
    if (!bus) {
      throw new Error("CLYON: nem WAWebSocketModel nem WAWebBackendEventBus nesta página (" + location.pathname + ")");
    }
    if (adaptador && doBus === bus) return adaptador;
    doBus = bus;
    adaptador = {
      get state() {
        return bus.socketState;
      },
      get hasSynced() {
        return Boolean(bus.isMainStreamReadyMd);
      },
      on(evento, fn) {
        const nome = EVENTOS[evento];
        if (!nome) return adaptador;
        const embrulho =
          evento === "change:state" ? (estado) => fn(adaptador, estado) : () => quandoAAppExistir(() => fn(adaptador));
        embrulhos.push({ evento, fn, embrulho });
        bus.on(nome, embrulho);
        return adaptador;
      },
      off(evento, fn) {
        const nome = EVENTOS[evento];
        if (!nome) return adaptador;
        for (let i = embrulhos.length - 1; i >= 0; i--) {
          const e = embrulhos[i];
          if (e.evento === evento && e.fn === fn) {
            bus.off(nome, e.embrulho);
            embrulhos.splice(i, 1);
          }
        }
        return adaptador;
      },
      logout() {
        return bus.triggerLogout();
      },
      reconnect() {
        return bus.triggerReconnectSocket();
      },
      takeover() {
        return bus.triggerReconnectSocket();
      },
    };
    return adaptador;
  };
}

function impressao(texto) {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

function trocarOSocket(texto, ficheiro) {
  const encontradas = texto.match(SOCKET)?.length ?? 0;
  const esperadas = OCORRENCIAS[ficheiro];
  if (encontradas !== esperadas) {
    throw new Error(
      `[remendo] ${ficheiro}: esperava ${esperadas} usos de WAWebSocketModel.Socket e encontrei ${encontradas}. ` +
        `A biblioteca não é a ${VERSAO_COBERTA} que o remendo cobre — reveja o remendo antes de subir a versão.`,
    );
  }
  return texto.replace(SOCKET, SUBSTITUTO);
}

/** O Client.js remendado. Lança se o texto não for o da versão coberta. */
export function remendarClient(texto) {
  if (texto.includes(MARCA)) throw new Error("[remendo] src/Client.js já estava remendado");
  if (!texto.includes(ANCORA)) {
    throw new Error(
      `[remendo] src/Client.js: não encontrei a linha do ExposeAuthStore no inject — ` +
        `a biblioteca não é a ${VERSAO_COBERTA} que o remendo cobre.`,
    );
  }
  const trocado = trocarOSocket(texto, "src/Client.js");
  const definir = `        ${MARCA}\n        await this.pupPage.evaluate(${definirOSocketDaClyon.toString()});\n`;
  return trocado.replace(ANCORA, definir + ANCORA);
}

/** O AuthStore.js remendado. */
export function remendarAuthStore(texto) {
  if (texto.includes(MARCA)) throw new Error("[remendo] AuthStore.js já estava remendado");
  return `${MARCA}\n` + trocarOSocket(texto, "src/util/Injected/AuthStore/AuthStore.js");
}

export const REMENDOS = {
  "src/Client.js": remendarClient,
  "src/util/Injected/AuthStore/AuthStore.js": remendarAuthStore,
};

/** Confere a impressão digital do original e devolve-o remendado. */
export function remendarFicheiro(ficheiro, texto) {
  if (texto.includes(MARCA)) throw new Error(`[remendo] ${ficheiro} já estava remendado — corre-se uma vez, logo a seguir ao npm ci`);
  const tem = impressao(texto);
  const devia = IMPRESSOES[ficheiro];
  if (tem !== devia) {
    throw new Error(
      `[remendo] ${ficheiro}: a impressão digital não bate (${tem.slice(0, 12)}… em vez de ${devia.slice(0, 12)}…). ` +
        `Não é o ficheiro da whatsapp-web.js ${VERSAO_COBERTA} — o build pára aqui.`,
    );
  }
  return REMENDOS[ficheiro](texto);
}

function principal() {
  const pasta = path.join(path.dirname(fileURLToPath(import.meta.url)), "node_modules", "whatsapp-web.js");
  const pkg = JSON.parse(fs.readFileSync(path.join(pasta, "package.json"), "utf8"));
  if (pkg.version !== VERSAO_COBERTA) {
    throw new Error(
      `[remendo] instalada a whatsapp-web.js ${pkg.version}, o remendo cobre só a ${VERSAO_COBERTA}. ` +
        `Fixe a versão no package.json ou reveja o remendo.`,
    );
  }
  const novos = {};
  for (const ficheiro of Object.keys(REMENDOS)) {
    const texto = fs.readFileSync(path.join(pasta, ficheiro), "utf8");
    novos[ficheiro] = remendarFicheiro(ficheiro, texto);
  }
  // Só se escreve depois de os dois passarem: nunca meio remendo.
  for (const [ficheiro, texto] of Object.entries(novos)) {
    fs.writeFileSync(path.join(pasta, ficheiro), texto);
  }
  console.log(`[remendo] whatsapp-web.js ${VERSAO_COBERTA} remendada para a rota /login (${Object.keys(novos).length} ficheiros).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    principal();
  } catch (e) {
    console.error(e?.message ?? e);
    process.exit(1);
  }
}
