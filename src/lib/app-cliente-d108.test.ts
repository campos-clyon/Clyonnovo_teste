import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  lerPrimeiraAbertura,
  lerProblema,
  MAXIMO_DO_PROBLEMA,
  ONDE_ACONTECEU,
  ROTULO_DE_ONDE,
} from "./sinais-da-app-de-cliente";

/*
 * d108 (24-11-2026, CEO e dono; P5 do Produto, com a correcção do Jurídico):
 *   1. a primeira abertura da app de cliente chega ao site SEM identificador
 *      (só versão e plataforma), uma vez, e a rota não guarda o endereço;
 *   2. «Entre para vermos que chegou» no Início, sem sessão;
 *   3. os avisos pedem-se uma vez, no primeiro uso, e o «Agora não» fica;
 *   4. «Algo não funciona?» na Ajuda (Perfil e barra de cima), gravado com a
 *      versão, o modelo e onde aconteceu; aparece em Contas › Programa da app.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");
const pares = (s: string) => [...s.matchAll(/\{ id: "([a-z]+)", rotulo: "([^"]+)" \}/g)].map((m) => [m[1], m[2]]);

describe("d108 1) a primeira abertura, sem identificador", () => {
  it("o site só lê a versão e a plataforma; um número do aparelho ou um email não passam", () => {
    const lido = lerPrimeiraAbertura({
      versao: "0.1.0 (01a1741b)",
      plataforma: "android",
      aparelho: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
      email: "alguem@example.com",
    });
    expect(lido).toEqual({ versao: "0.1.0 (01a1741b)", plataforma: "android" });
    expect(lerPrimeiraAbertura(null)).toEqual({ versao: "?", plataforma: "outra" });
    expect(lerPrimeiraAbertura({ versao: "<script>", plataforma: "windows" })).toEqual({ versao: "?", plataforma: "outra" });
  });

  it("a app manda só versão e plataforma, sem sessão, e guarda a marca só para si", () => {
    const app = semComentarios(ler("app-cliente/src/lib/primeira-abertura.ts"));
    expect(app).toContain("semSessao: true");
    expect(app).toContain("corpo: { versao: versaoDestaApp(), plataforma: Platform.OS }");
    expect(app).not.toMatch(/codigo-do-aparelho|expo-crypto|getRandomBytes|aparelho:/);
    expect(app).toMatch(/if \(\(await lerDoCofre\(JA_AVISOU\)\) === "1"\) return;/);
    // A marca grava-se depois de o site responder: sem rede, tenta na abertura seguinte.
    expect(app.indexOf("await pedir(")).toBeLessThan(app.indexOf("guardarNoCofre(JA_AVISOU"));
    expect(semComentarios(ler("app-cliente/src/app/_layout.tsx"))).toContain("void avisarAPrimeiraAbertura();");
  });

  it("a rota não usa o endereço de quem manda (o travão é um só para todos)", () => {
    const rota = semComentarios(ler("src/app/api/cliente/primeira-abertura/route.ts"));
    expect(rota).not.toMatch(/getClientIp|limitarRotaPublica|x-forwarded-for|headers\.get/);
    expect(rota).toContain(`limitarPorConta("app-cliente-primeira-abertura", "todos"`);
    const base = semComentarios(ler("src/lib/sinais-da-app-de-cliente-na-base.ts"));
    const tabela = /CREATE TABLE IF NOT EXISTS primeirasAberturasDaAppCliente \(([\s\S]*?)\) ENGINE/.exec(base)?.[1] ?? "";
    expect(tabela).toContain("versao");
    expect(tabela).not.toMatch(/\bip\b|aparelho|email|endereco/i);
  });
});

describe("d108 2) e 3) o primeiro uso no Início", () => {
  const primeiro = semComentarios(ler("app-cliente/src/componentes/PrimeiroUso.tsx"));
  it("o cartão só aparece sem sessão e leva ao Entrar", () => {
    expect(primeiro).toContain("if (ligado || carregando || escondido) return null;");
    expect(primeiro).toContain('router.push("/entrar")');
    expect(primeiro).toContain('titulo: "Entre para vermos que chegou"');
    expect(semComentarios(ler("app-cliente/src/app/(app)/index.tsx"))).toContain("<PrimeiroUso />");
  });

  it("os avisos pedem-se uma vez: o «Agora não» marca e não se volta a perguntar (nem no E4)", () => {
    expect(primeiro).toMatch(/aoVoltar=\{\(\) => \{\s*setPerguntar\(false\);\s*void marcarQueJaPerguntou\(\);/);
    expect(primeiro).toMatch(/aoConfirmar=\{\(\) => \{\s*setPerguntar\(false\);\s*void marcarQueJaPerguntou\(\)\.then\(\(\) => ligarAvisos\(\)\);/);
    const avisos = semComentarios(ler("app-cliente/src/lib/avisos.ts"));
    const deve = avisos.slice(avisos.indexOf("export async function devePerguntarPelosAvisos"));
    expect(deve).toContain("if (await jaPerguntouPelosAvisos()) return false;");
    expect(deve).toContain("if (await avisosDesligadosPorEle()) return false;");
    expect(deve).toContain("p.canAskAgain !== false");
    // O E4 continua a respeitar a mesma marca.
    expect(ler("app-cliente/src/componentes/NovoPedido.tsx")).toContain("if (!(await jaPerguntouPelosAvisos())) setPerguntarAvisos(true);");
  });
});

describe("d108 4) «Algo não funciona?»", () => {
  it("lê o texto, corta-o, e o «onde» é sempre uma das escolhas", () => {
    expect(lerProblema({ texto: "  oi " })).toEqual({ ok: false, erro: "Conte-nos em poucas palavras o que aconteceu." });
    const r = lerProblema({ texto: "x".repeat(MAXIMO_DO_PROBLEMA + 50), onde: "pedido/[id]", versao: "0.1.0 (base)", modelo: "Google Pixel 7<b>", sistema: "Android 15" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect([...r.problema.texto].length).toBe(MAXIMO_DO_PROBLEMA);
    expect(r.problema.onde).toBe("outro");
    expect(r.problema.modelo).toBe("Google Pixel 7b");
    expect(r.problema.sistema).toBe("Android 15");
    expect(lerProblema({ texto: "Não consigo pagar", onde: "pagar" })).toMatchObject({ ok: true, problema: { onde: "pagar", versao: "?" } });
  });

  it("a lista de onde aconteceu é a mesma na app e no site", () => {
    const app = pares(ler("app-cliente/src/lib/algo-nao-funciona.ts"));
    expect(app).toEqual(ONDE_ACONTECEU.map((o) => [o.id, o.rotulo]));
    expect(Object.keys(ROTULO_DE_ONDE)).toHaveLength(ONDE_ACONTECEU.length);
  });

  it("está na Ajuda (Perfil e barra de cima) e tem o ecrã na pilha", () => {
    expect(ler("app-cliente/src/componentes/Linhas.tsx")).toContain('titulo="Algo não funciona?"');
    expect(ler("app-cliente/src/componentes/Linhas.tsx")).toContain('router.push("/algo-nao-funciona" as never)');
    expect(ler("app-cliente/src/app/_layout.tsx")).toContain('<Stack.Screen name="algo-nao-funciona"');
    const app = semComentarios(ler("app-cliente/src/lib/algo-nao-funciona.ts"));
    expect(app).toContain("corpo: { texto: texto.trim(), onde, versao: versaoDestaApp(), ...oTelemovel() }");
  });

  it("um token inválido não faz sair da conta: a rota nunca responde 401", () => {
    const rota = semComentarios(ler("src/app/api/cliente/algo-nao-funciona/route.ts"));
    expect(rota).not.toContain("401");
    expect(rota).toContain("(await sessaoActivaDoCliente(token))?.email ?? null");
  });

  it("o backoffice mostra os dois números e os problemas em Contas › Programa da app, só ao administrador", () => {
    const admin = semComentarios(ler("src/app/api/admin/app-cliente-sinais/route.ts"));
    expect(admin).toContain("await requireAdminGeral(req)");
    const legacy = ler("src/components/admin/LegacyAdminClient.tsx");
    const programa = legacy.slice(legacy.indexOf('separadorDasContas === "programa" ?'));
    expect(programa.indexOf("<SinaisDaAppDeCliente />")).toBeGreaterThan(programa.indexOf('<QuemContaParaOs12 app="cliente"'));
    expect(programa.indexOf("<SinaisDaAppDeCliente />")).toBeLessThan(programa.indexOf("<ContasPanel"));
  });
});
