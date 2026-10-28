import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A APP DE CLIENTE — decisão d8 (27-10-2026), primeiro passo: `app-cliente/`
 * e o ecrã Entrar (E1) ligado à sessão do cliente (R1–R3 do site).
 *
 * Corre na suite do site, como os testes da app Pro: lê os ficheiros da app,
 * não os importa (os pacotes da app não estão instalados na CI do site).
 * As regras de língua (português de Portugal, voz de plataforma, sem «próprio
 * dia») são as do orquestra.test.ts, que também lê `app-cliente/src`.
 */

const RAIZ = process.cwd();
const APP = join(RAIZ, "app-cliente");
const ler = (p: string) => readFileSync(join(APP, p), "utf8");

function ficheiros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === "node_modules") return [];
    return statSync(p).isDirectory() ? ficheiros(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}
const FONTES = ficheiros(join(APP, "src"));

/** Sem comentários: o que conta é o código que chega ao telemóvel. */
const semComentarios = (t: string) =>
  t.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** Os imports que chegam ao telemóvel: `import type` e `import { type A }` não contam. */
function importsDeValor(ficheiro: string): string[] {
  const texto = readFileSync(ficheiro, "utf8");
  const saida: string[] = [];
  for (const m of texto.matchAll(/^import\s+(type\s)?([^;"]*?)from\s+"([^"]+)"/gm)) {
    if (m[1]) continue;
    const nomes = m[2].replace(/[{}\s]/g, "");
    if (nomes && nomes.split(",").every((n) => n.startsWith("type"))) continue;
    saida.push(m[3]);
  }
  for (const m of texto.matchAll(/^import\s+"([^"]+)"/gm)) saida.push(m[1]);
  return saida;
}

describe("a pasta da app de cliente", () => {
  it("é uma app Expo própria: pt.clyon.cliente, nome CLYON, o mesmo Expo da Pro", () => {
    const app = JSON.parse(ler("app.json")).expo;
    expect(app.name).toBe("CLYON");
    expect(app.android.package).toBe("pt.clyon.cliente");
    expect(app.ios.bundleIdentifier).toBe("pt.clyon.cliente");
    const cliente = JSON.parse(ler("package.json"));
    const pro = JSON.parse(readFileSync(join(RAIZ, "app-pro/package.json"), "utf8"));
    expect(cliente.dependencies.expo).toBe(pro.dependencies.expo);
    expect(cliente.dependencies["react-native"]).toBe(pro.dependencies["react-native"]);
    expect(existsSync(join(APP, "package-lock.json"))).toBe(true);
  });

  it("o «S» em fundo branco (o Pro é o mesmo S em azul-noite)", () => {
    const app = JSON.parse(ler("app.json")).expo;
    expect(app.android.adaptiveIcon.backgroundColor).toBe("#FFFFFF");
    const splash = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-splash-screen");
    expect(splash[1].backgroundColor).toBe("#FFFFFF");
    expect(ler("assets/logo-clyon-s.svg")).toBe(readFileSync(join(RAIZ, "app-pro/assets/logo-clyon-s.svg"), "utf8"));
  });

  it("pronta para a 1.ª build (A1), mas sem projecto na conta Expo: esse passo é do dono", () => {
    const app = JSON.parse(ler("app.json")).expo;
    expect(app.runtimeVersion).toEqual({ policy: "fingerprint" });
    expect(existsSync(join(APP, "eas.json"))).toBe(true);
    // O projectId e o updates.url só existem depois de criar o projecto na conta Expo.
    expect(app.extra?.eas).toBeUndefined();
    expect(app.updates?.url).toBeUndefined();
  });

  it("o link de entrada do SITE (/entrar/link) já não abre a app (versão 2, 28-10-2026)", () => {
    const app = JSON.parse(ler("app.json")).expo;
    const caminhos = app.android.intentFilters.flatMap((f: { data: Array<{ path?: string; pathPrefix?: string }> }) =>
      f.data.map((d) => d.path ?? d.pathPrefix),
    );
    expect(caminhos).not.toContain("/entrar/link");
    expect(existsSync(join(APP, "src/app/entrar/link.tsx"))).toBe(false);
  });
});

describe("E1 — entrar", () => {
  const ENTRAR = ler("src/app/entrar/index.tsx");
  const API = ler("src/lib/api.ts");
  const ERROS = ler("src/lib/erros.ts");
  const SESSAO = ler("src/estado/Sessao.tsx");
  const COFRE = ler("src/lib/sessao.ts");

  it("pergunta ao site se mostra o Google, e esconde-o até haver o cliente OAuth Android", () => {
    expect(ENTRAR).toContain('pedir<{ google?: boolean }>("/api/cliente/entrar", { semSessao: true })');
    expect(ENTRAR).toContain("export const GOOGLE_NESTA_VERSAO = false;");
    expect(ENTRAR).toContain("googleNoSite && GOOGLE_NESTA_VERSAO");
  });

  it("o link por email vai pela rota do site, com a prova deste telemóvel (o resto em app-cliente-fase-2.test.ts)", () => {
    expect(ENTRAR).toContain("await pedirLinkDeEntrada({ pedir, email: limpo, codigo, sha256Hex });");
    expect(ENTRAR).toContain("const codigo = await codigoParaPedirOLink();");
  });

  it("os textos da especificação, palavra por palavra", () => {
    expect(ENTRAR).toContain("Entrar na CLYON");
    expect(ENTRAR).toContain("Enviar link de entrada");
    expect(ENTRAR).toContain(
      "Se o email estiver certo, o link de entrada chega dentro de instantes. Abra-o neste telemóvel — dura 15 minutos e serve uma vez.",
    );
    expect(ENTRAR).toContain("Usar outro email");
    expect(ENTRAR).toContain("Se nunca entrou, a conta cria-se ao entrar. Use o mesmo email com que fez os seus pedidos, para os ver aqui.");
    expect(ENTRAR).toContain("const ESPERA_PARA_REENVIAR_S = 60;");
    expect(ERROS).toContain('"Sem ligação à internet. Tente outra vez."');
    expect(ERROS).toContain('"Muitas tentativas seguidas. Espere um minuto e tente outra vez."');
    expect(ERROS).toContain('"A sua sessão terminou. Entre outra vez."');
  });

  it("o 429 do site diz o mesmo que a app", () => {
    const rota = readFileSync(join(RAIZ, "src/app/api/cliente/entrar/route.ts"), "utf8");
    expect(rota).toContain('"Muitas tentativas seguidas. Espere um minuto e tente outra vez."');
  });

  it("o token fica no cofre do telemóvel e vai no cabeçalho", () => {
    expect(COFRE).toContain('import * as SecureStore from "expo-secure-store"');
    expect(COFRE).toContain("SecureStore.setItemAsync(chave, valor)");
    expect(API).toContain("if (token) cabecalhos.Authorization = `Bearer ${token}`;");
  });

  it("a cada abertura renova a sessão, com a versão da app", () => {
    expect(SESSAO).toContain('pedir<{ token: string }>("/api/cliente/sessao", { metodo: "POST" })');
    expect(API).toContain('export const CABECALHO_DA_VERSAO = "x-app-versao";');
    expect(API).toContain("[CABECALHO_DA_VERSAO]: versaoDestaApp()");
    // O site aceita este cabeçalho.
    expect(readFileSync(join(RAIZ, "src/lib/app-pro-no-telemovel.ts"), "utf8")).toContain('"x-app-versao"');
  });

  it("qualquer 401 com sessão apaga o token e volta ao Entrar com o aviso", () => {
    // Só o 401 do token que está guardado: o de uma conta que se acabou de trocar não faz sair.
    expect(API).toContain("if (r.status === 401 && podeFazerSair && token && token === (await lerToken())) aoPerderASessao?.();");
    expect(API).toContain("return chamar<T>(caminho, opcoes, token, !opcoes.semSessao);");
    expect(SESSAO).toContain('setAviso({ texto: SESSAO_TERMINOU, tom: "mau" });');
    expect(SESSAO).toContain("void largarAConta(false).then(ficarFora);");
    expect(SESSAO).toContain("await esquecerSessao();");
  });
});

describe("as regras de todos os ecrãs", () => {
  it("zero preços, taxas ou IVA escritos na app", () => {
    for (const f of FONTES) {
      const t = semComentarios(readFileSync(f, "utf8"));
      expect(t, f).not.toMatch(/\d\s?€|€\s?\d|\d+([,.]\d+)?\s?%(?![\w])/);
      expect(t, f).not.toMatch(/\bIVA\b/);
    }
  });

  it("a hora é sempre a de Lisboa: nada do relógio do telemóvel", () => {
    for (const f of FONTES) {
      const t = semComentarios(readFileSync(f, "utf8"));
      expect(t, f).not.toMatch(/\.toLocale(Date|Time)?String\(|\.get(Hours|Minutes|Date|Day|Month|FullYear)\(/);
    }
  });

  it("textos com «Text» e «TextInput» da casa (letra com limite), nunca de react-native", () => {
    for (const f of FONTES) {
      if (f.endsWith("Texto.tsx")) continue;
      const t = readFileSync(f, "utf8");
      const doRN = t.match(/import\s*\{([^}]*)\}\s*from\s*"react-native"/);
      if (doRN) expect(doRN[1].split(",").map((s) => s.trim()), f).not.toEqual(expect.arrayContaining(["Text"]));
      if (doRN) expect(doRN[1].split(",").map((s) => s.trim()), f).not.toEqual(expect.arrayContaining(["TextInput"]));
    }
  });

  it("do src/lib só regras puras, e nenhuma de preços, taxas ou IVA", () => {
    const lib = join(RAIZ, "src", "lib");
    const partilhados = new Set<string>();
    for (const f of FONTES) {
      for (const alvo of importsDeValor(f)) {
        if (/^(\.\.\/)+src\/lib\//.test(alvo)) partilhados.add(resolve(dirname(f), alvo) + ".ts");
        else if (alvo.startsWith("@/") || /\.\.\/\.\.\/\.\.\/.*src\//.test(alvo)) throw new Error(`${f} importa "${alvo}"`);
      }
    }
    const vistos = new Set<string>();
    const problemas: string[] = [];
    const seguir = (f: string) => {
      if (vistos.has(f)) return;
      vistos.add(f);
      if (!existsSync(f)) return void problemas.push(`${f} não existe`);
      if (dirname(f) !== lib) problemas.push(`${f} está fora de src/lib`);
      if (/precos|taxa|iva|tabela-das|sacos-de-entulho/i.test(f.slice(lib.length))) problemas.push(`${f} é de preços, taxas ou IVA`);
      if (/process\.env/.test(semComentarios(readFileSync(f, "utf8")))) problemas.push(`${f} lê process.env`);
      for (const alvo of importsDeValor(f)) {
        if (alvo.startsWith("./")) seguir(join(dirname(f), alvo.slice(2)) + ".ts");
        else problemas.push(`${f} importa "${alvo}"`);
      }
    };
    partilhados.forEach(seguir);
    expect(problemas).toEqual([]);
  });

  it("a app de cliente não mexe na app Pro", () => {
    for (const f of FONTES) {
      for (const alvo of importsDeValor(f)) expect(alvo, f).not.toMatch(/app-pro/);
    }
  });
});
