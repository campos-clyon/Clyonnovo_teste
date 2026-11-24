import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import * as remendo from "../../ponte-whatsapp/remendar-wwebjs.mjs";

/**
 * A PONTE REMENDA A ROTA /login — 24-11-2026 (urgência, ponte em baixo desde
 * as 07:40).
 *
 * Desde o WhatsApp Web 2.3000.1055852612, uma sessão sem login vai para
 * /login/, onde `WAWebSocketModel` não existe; a whatsapp-web.js 1.34.7 lia
 * `.Socket` dele e morria com «Cannot read properties of null (reading
 * 'Socket')». O remendo (ponte-whatsapp/remendar-wwebjs.mjs) corre no build,
 * depois do `npm ci`, e só cobre UMA versão. Este teste garante que:
 *   - a versão fixada no package.json e no lock é a que o remendo cobre;
 *   - o Dockerfile corre o remendo depois da instalação;
 *   - nos ficheiros VERDADEIROS dessa versão (do npm, conferidos pelo
 *     integrity do lock) o remendo encontra todos os textos;
 *   - o adaptador da /login faz o que o Client.js espera do Socket.
 */

const R = remendo as unknown as {
  VERSAO_COBERTA: string;
  MARCA: string;
  IMPRESSOES: Record<string, string>;
  remendarFicheiro: (ficheiro: string, texto: string) => string;
  definirOSocketDaClyon: () => void;
};

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf8");
const PACOTE = JSON.parse(ler("ponte-whatsapp/package.json"));
const LOCK = JSON.parse(ler("ponte-whatsapp/package-lock.json"));
const DOCKER = ler("ponte-whatsapp/Dockerfile").replace(/\r\n/g, "\n");
const NO_LOCK = LOCK.packages["node_modules/whatsapp-web.js"];
const FICHEIROS = ["src/Client.js", "src/util/Injected/AuthStore/AuthStore.js"];

describe("a versão fixada é a que o remendo cobre", () => {
  it("o package.json fixa a versão exacta, sem ^ nem ~", () => {
    expect(PACOTE.dependencies["whatsapp-web.js"]).toBe(R.VERSAO_COBERTA);
  });

  it("o lock instala essa mesma versão", () => {
    expect(LOCK.packages[""].dependencies["whatsapp-web.js"]).toBe(R.VERSAO_COBERTA);
    expect(NO_LOCK.version).toBe(R.VERSAO_COBERTA);
    expect(NO_LOCK.resolved).toBe(
      `https://registry.npmjs.org/whatsapp-web.js/-/whatsapp-web.js-${R.VERSAO_COBERTA}.tgz`,
    );
  });

  it("o Dockerfile copia o remendo e corre-o logo a seguir ao npm ci", () => {
    expect(DOCKER).toMatch(/^COPY package\.json package-lock\.json remendar-wwebjs\.mjs \.\/$/m);
    expect(DOCKER).toMatch(/^RUN npm ci [^\n]*&& node remendar-wwebjs\.mjs$/m);
  });

  it("o tini é o processo 1, para recolher os filhos do Chromium", () => {
    expect(DOCKER).toMatch(/^\s+tini \\$/m);
    expect(DOCKER).toContain('ENTRYPOINT ["/usr/bin/tini", "--"]');
    expect(DOCKER).toContain('CMD ["node", "index.js"]');
  });
});

/** Lê os ficheiros de dentro de um .tgz do npm (tar ustar, sem dependências). */
function lerDoTar(tgz: Buffer, queremos: string[]): Record<string, string> {
  const tar = gunzipSync(tgz);
  const out: Record<string, string> = {};
  let i = 0;
  while (i + 512 <= tar.length) {
    const cab = tar.subarray(i, i + 512);
    if (cab.every((b) => b === 0)) break;
    const texto = (a: number, b: number) => cab.subarray(a, b).toString("utf8").replace(/\0[\s\S]*$/, "");
    const prefixo = texto(345, 500);
    const nome = (prefixo ? prefixo + "/" : "") + texto(0, 100);
    const tamanho = parseInt(texto(124, 136).trim() || "0", 8);
    const curto = nome.replace(/^[^/]+\//, ""); // tira o «package/»
    if (queremos.includes(curto)) out[curto] = tar.subarray(i + 512, i + 512 + tamanho).toString("utf8");
    i += 512 + Math.ceil(tamanho / 512) * 512;
  }
  return out;
}

describe(`nos ficheiros verdadeiros da whatsapp-web.js`, () => {
  let originais: Record<string, string> = {};

  beforeAll(async () => {
    // Uma instalação local por remendar serve; senão vai-se ao npm buscar o
    // pacote que o lock diz, conferido pelo integrity do próprio lock.
    const local = join(raiz, "ponte-whatsapp/node_modules/whatsapp-web.js");
    if (existsSync(join(local, "package.json"))) {
      const versao = JSON.parse(readFileSync(join(local, "package.json"), "utf8")).version;
      const textos = Object.fromEntries(FICHEIROS.map((f) => [f, readFileSync(join(local, f), "utf8")]));
      if (versao === R.VERSAO_COBERTA && !Object.values(textos).some((t) => t.includes(R.MARCA))) {
        originais = textos;
        return;
      }
    }
    const res = await fetch(NO_LOCK.resolved);
    expect(res.ok).toBe(true);
    const tgz = Buffer.from(await res.arrayBuffer());
    const [algoritmo, esperado] = String(NO_LOCK.integrity).split("-");
    expect(createHash(algoritmo).update(tgz).digest("base64")).toBe(esperado);
    originais = lerDoTar(tgz, FICHEIROS);
  }, 60_000);

  it("têm a impressão digital que o remendo espera", () => {
    for (const f of FICHEIROS) {
      expect(originais[f], f).toBeTypeOf("string");
      expect(createHash("sha256").update(originais[f], "utf8").digest("hex"), f).toBe(R.IMPRESSOES[f]);
    }
  });

  it("o remendo encontra todos os textos e não deixa nenhum WAWebSocketModel.Socket directo", () => {
    for (const f of FICHEIROS) {
      const novo = R.remendarFicheiro(f, originais[f]);
      expect(novo).toContain(R.MARCA);
      expect(novo).not.toMatch(/window\s*\.require\('WAWebSocketModel'\)\s*\.Socket/);
      expect(novo).toContain("window.__clyonSocket()");
    }
  });

  it("o Client.js remendado define o adaptador no inject, antes do ExposeAuthStore, e continua JS válido", () => {
    const novo = R.remendarFicheiro("src/Client.js", originais["src/Client.js"]);
    const definir = novo.indexOf("function definirOSocketDaClyon()");
    const expor = novo.indexOf("await this.pupPage.evaluate(ExposeAuthStore);");
    expect(definir).toBeGreaterThan(novo.indexOf("async inject()"));
    expect(definir).toBeLessThan(expor);
    // Só compila (não corre): um erro de sintaxe rebentava aqui.
    expect(() => new Function("require", "module", "exports", novo)).not.toThrow();
  });

  it("um ficheiro diferente faz falhar o build, com mensagem clara", () => {
    const mexido = originais["src/Client.js"].replace("async inject()", "async inject( )");
    expect(() => R.remendarFicheiro("src/Client.js", mexido)).toThrow(/impressão digital não bate/);
    const remendado = R.remendarFicheiro("src/Client.js", originais["src/Client.js"]);
    expect(() => R.remendarFicheiro("src/Client.js", remendado)).toThrow(/já estava remendado/);
  });
});

describe("o adaptador da /login", () => {
  type Ouvinte = (...a: unknown[]) => void;
  const g = globalThis as unknown as { window?: Record<string, unknown> };

  function paginaDeLogin(modulos: Record<string, unknown>) {
    g.window = { require: (m: string) => modulos[m] ?? null };
    (g.window as Record<string, unknown>).location = { pathname: "/login/" };
    (globalThis as unknown as { location: unknown }).location = { pathname: "/login/" };
    R.definirOSocketDaClyon();
    return (g.window as { __clyonSocket: () => Record<string, unknown> }).__clyonSocket;
  }

  function busFalso() {
    const ouvintes: Record<string, Ouvinte[]> = {};
    return {
      socketState: "UNPAIRED",
      isMainStreamReadyMd: false,
      on(n: string, f: Ouvinte) {
        (ouvintes[n] ??= []).push(f);
      },
      off(n: string, f: Ouvinte) {
        ouvintes[n] = (ouvintes[n] ?? []).filter((x) => x !== f);
      },
      trigger(n: string, ...a: unknown[]) {
        for (const f of ouvintes[n] ?? []) f(...a);
      },
      quantos: (n: string) => (ouvintes[n] ?? []).length,
      triggerLogout() {
        return "logout";
      },
      triggerReconnectSocket() {
        return "reconnect";
      },
    };
  }

  afterEach(() => {
    delete g.window;
  });

  it("com o Socket verdadeiro (sessão emparelhada, rota /) usa-o a ele", () => {
    const Socket = { state: "CONNECTED" };
    const socket = paginaDeLogin({ WAWebSocketModel: { Socket }, WAWebBackendEventBus: { BackendEventBus: busFalso() } });
    expect(socket()).toBe(Socket);
  });

  it("na /login lê o estado do BackendEventBus", () => {
    const bus = busFalso();
    const socket = paginaDeLogin({ WAWebBackendEventBus: { BackendEventBus: bus } });
    expect(socket().state).toBe("UNPAIRED");
    bus.socketState = "CONNECTED";
    expect(socket().state).toBe("CONNECTED");
    expect(socket()).toBe(socket()); // o mesmo adaptador, para o off encontrar o on
  });

  it("change:state chega como (AppState, estado), e o off tira-o", () => {
    const bus = busFalso();
    const socket = paginaDeLogin({ WAWebBackendEventBus: { BackendEventBus: bus } });
    const vistos: unknown[] = [];
    const fn = (_app: unknown, estado: unknown) => vistos.push(estado);
    (socket().on as (e: string, f: unknown) => void)("change:state", fn);
    bus.trigger("set_socket_state", "PAIRING");
    expect(vistos).toEqual(["PAIRING"]);
    (socket().off as (e: string, f: unknown) => void)("change:state", fn);
    expect(bus.quantos("set_socket_state")).toBe(0);
    bus.trigger("set_socket_state", "UNPAIRED");
    expect(vistos).toEqual(["PAIRING"]);
  });

  it("change:hasSynced só dispara quando a app inteira já existe", () => {
    const bus = busFalso();
    const modulos: Record<string, unknown> = { WAWebBackendEventBus: { BackendEventBus: bus } };
    const socket = paginaDeLogin(modulos);
    let prontos = 0;
    (socket().on as (e: string, f: unknown) => void)("change:hasSynced", () => prontos++);
    modulos.WAWebCollections = { Msg: {} };
    bus.trigger("open_socket_stream");
    expect(prontos).toBe(1);
  });

  it("logout e reconnect vão para o BackendEventBus", () => {
    const socket = paginaDeLogin({ WAWebBackendEventBus: { BackendEventBus: busFalso() } });
    expect((socket().logout as () => string)()).toBe("logout");
    expect((socket().reconnect as () => string)()).toBe("reconnect");
  });
});
