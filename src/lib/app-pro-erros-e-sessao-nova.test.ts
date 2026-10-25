import { describe, it, expect, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAXIMO_POR_ARRANQUE,
  ROTA_DO_ERRO_DA_APP,
  contadorDeErros,
  corpoDoErro,
  ecraDe,
  enviarErroDaApp,
  versaoDaApp,
  type CorpoDoErro,
} from "../../app-pro/src/lib/erro-da-app";
import { MAXIMO_DA_MENSAGEM, lerErroDaApp } from "./erros-da-app";

/**
 * O SEGUNDO EAS UPDATE DE 25-10-2026 (sobre a build 13, sem build nova).
 *
 * d13 — um ecrã da app que rebenta chega à equipa: o ecrã de erro da raiz
 * manda o erro a `POST /api/profissionais/erro-da-app`, sem sessão, sem dados
 * de pessoas, uma vez por erro, e em silêncio sem rede.
 *
 * d14 — mudar a palavra-passe e «Sair de todos os aparelhos» fecham as
 * sessões de antes, e o site devolve um token novo (`{ ok, token }`). A app
 * guarda-o no lugar do antigo: antes, quem mudava a palavra-passe na app era
 * posto fora logo no pedido seguinte.
 */

const cru = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
/** Sem comentários, com a regra ancorada ao início da linha (tirar-comentarios-sem-comer-codigo). */
const semNotas = (f: string) =>
  cru(f)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s+/g, " ");

describe("d13 — o que a app manda quando um ecrã rebenta", () => {
  it("vai para a rota que o site tem no ar", () => {
    expect(ROTA_DO_ERRO_DA_APP).toBe("/api/profissionais/erro-da-app");
    expect(existsSync(join(process.cwd(), "src/app/api/profissionais/erro-da-app/route.ts"))).toBe(true);
  });

  it("a versão diz qual é a actualização, e cabe no que o site aceita", () => {
    expect(versaoDaApp("0.1.0", "01a1741b-5c2e-4f00-9a00-000000000000")).toBe("0.1.0 (01a1741b)");
    expect(versaoDaApp("0.1.0", null)).toBe("0.1.0 (base)");
    expect(versaoDaApp(undefined, undefined)).toBe("? (base)");
    for (const v of [versaoDaApp("0.1.0", "01a1741b-5c2e"), versaoDaApp("0.1.0", null)]) {
      expect(lerErroDaApp({ versao: v, ecra: "x", mensagem: "y" })?.versao).toBe(v);
    }
  });

  it("o ecrã vai pelo nome da rota — nunca o número do trabalho nem o token de um link", () => {
    expect(ecraDe(["trabalho", "[id]"])).toBe("trabalho/[id]");
    expect(ecraDe(["definir-senha", "[token]"])).toBe("definir-senha/[token]");
    expect(ecraDe(["(app)", "conta"])).toBe("(app)/conta");
    expect(ecraDe([])).toBe("inicio");
    expect(ecraDe(null)).toBe("inicio");
  });

  it("só quatro campos, e a mensagem sai do telemóvel já sem emails, telefones nem tokens", () => {
    const erro = new TypeError(
      "falhou para alguem@exemplo.pt, 912 345 678, Bearer eyJhbGciOi.eyJzdWIi.assinatura e ExponentPushToken[abcdefghij]",
    );
    const agora = new Date("2026-10-25T18:00:00.000Z");
    const corpo = corpoDoErro(erro, "trabalho/[id]", "0.1.0 (01a1741b)", agora);
    expect(Object.keys(corpo).sort()).toEqual(["ecra", "mensagem", "quando", "versao"]);
    expect(corpo.quando).toBe("2026-10-25T18:00:00.000Z");
    expect(corpo.mensagem.startsWith("TypeError: falhou para")).toBe(true);
    for (const dado of ["alguem@exemplo.pt", "912 345 678", "eyJhbGciOi", "abcdefghij"]) {
      expect(corpo.mensagem, dado).not.toContain(dado);
    }
    // O site lê-o como a app o manda.
    const lido = lerErroDaApp(corpo, agora);
    expect(lido).toMatchObject({ versao: "0.1.0 (01a1741b)", ecra: "trabalho/[id]", mensagem: corpo.mensagem });
    expect(lido?.quando.toISOString()).toBe(corpo.quando);
  });

  it("uma mensagem comprida corta-se no tamanho que o site guarda", () => {
    const corpo = corpoDoErro(new Error("o ecrã rebentou ".repeat(40)), "inicio", "0.1.0 (base)");
    expect([...corpo.mensagem].length).toBe(MAXIMO_DA_MENSAGEM);
    expect(corpoDoErro(undefined, "inicio", "0.1.0 (base)").mensagem).toBe("Erro sem mensagem");
    expect(corpoDoErro("texto solto", "inicio", "0.1.0 (base)").mensagem).toBe("texto solto");
  });

  it("vai sem sessão: um POST com o corpo e nada que diga quem é", async () => {
    const buscar = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const corpo: CorpoDoErro = { versao: "0.1.0 (base)", ecra: "inicio", mensagem: "m", quando: "2026-10-25T18:00:00.000Z" };
    expect(await enviarErroDaApp("https://clyon.pt", corpo, buscar as unknown as typeof fetch)).toBe(true);
    expect(buscar).toHaveBeenCalledTimes(1);
    const [url, opcoes] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://clyon.pt/api/profissionais/erro-da-app");
    expect(opcoes.method).toBe("POST");
    expect(Object.keys(opcoes.headers as Record<string, string>).sort()).toEqual(["Accept", "Content-Type"]);
    expect(JSON.parse(String(opcoes.body))).toEqual(corpo);
    expect(opcoes.credentials).toBeUndefined();

    // E o ficheiro nem sabe onde está o token da sessão.
    const FONTE = semNotas("app-pro/src/lib/erro-da-app.ts");
    expect(FONTE).not.toContain("Authorization");
    expect(FONTE).not.toContain("lerToken");
    expect(FONTE).not.toContain("./api");
  });

  it("sem rede, ou com o site em baixo, não acontece nada — nem lança", async () => {
    const corpo: CorpoDoErro = { versao: "v", ecra: "e", mensagem: "m", quando: "2026-10-25T18:00:00.000Z" };
    const semRede = vi.fn(async () => {
      throw new TypeError("Network request failed");
    });
    await expect(enviarErroDaApp("https://clyon.pt", corpo, semRede as unknown as typeof fetch)).resolves.toBe(false);
    const emBaixo = vi.fn(async () => new Response("", { status: 500 }));
    await expect(enviarErroDaApp("https://clyon.pt", corpo, emBaixo as unknown as typeof fetch)).resolves.toBe(false);
    // Uma tentativa só: não volta a tentar.
    expect(semRede).toHaveBeenCalledTimes(1);
    expect(emBaixo).toHaveBeenCalledTimes(1);
  });

  it("uma vez por erro, e não em ciclo", () => {
    const enviar = vi.fn(async () => true);
    const contar = contadorDeErros(enviar);
    const um: CorpoDoErro = { versao: "v", ecra: "trabalho/[id]", mensagem: "rebentou", quando: "2026-10-25T18:00:00.000Z" };
    expect(contar(um)).toBe(true);
    // O «Tentar outra vez» que volta a rebentar, mais tarde, é o mesmo erro.
    expect(contar({ ...um, quando: "2026-10-25T18:00:05.000Z" })).toBe(false);
    expect(contar(um)).toBe(false);
    expect(enviar).toHaveBeenCalledTimes(1);

    // Um ecrã a rebentar sem parar não manda centenas: pára no máximo.
    for (let i = 0; i < 50; i++) contar({ ...um, mensagem: `erro ${i}` });
    expect(enviar).toHaveBeenCalledTimes(MAXIMO_POR_ARRANQUE);
    expect(MAXIMO_POR_ARRANQUE).toBeLessThanOrEqual(5);
  });

  it("um envio que falha não deixa o ecrã de erro rebentar também", async () => {
    const corpo: CorpoDoErro = { versao: "v", ecra: "e", mensagem: "m", quando: "2026-10-25T18:00:00.000Z" };
    const recusa = contadorDeErros(async () => {
      throw new Error("sem rede");
    });
    expect(() => recusa(corpo)).not.toThrow();
    const lancaLogo = contadorDeErros(() => {
      throw new Error("antes da promessa");
    });
    expect(() => lancaLogo(corpo)).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });

  it("o ecrã de erro da raiz conta o erro uma vez, pelo nome da rota, e não na demonstração", () => {
    const RAIZ = semNotas("app-pro/src/app/_layout.tsx");
    const i = RAIZ.indexOf("export function ErrorBoundary({ error, retry }: ErrorBoundaryProps)");
    const fim = RAIZ.indexOf("export default function Raiz()");
    expect(i).toBeGreaterThan(-1);
    expect(fim).toBeGreaterThan(i);
    const ECRA = RAIZ.slice(i, fim);
    expect(RAIZ).toContain("const contarOErro = contadorDeErros((corpo) => enviarErroDaApp(SITE, corpo));");
    expect(ECRA).toContain("const segmentos = useSegments();");
    expect(ECRA).toContain("if (EM_DEMO || Platform.OS === \"web\") return;");
    expect(ECRA).toContain("contarOErro(corpoDoErro(error, ecraDe(segmentos), versaoDaApp(Constants.expoConfig?.version, Updates.updateId)));");
    expect(ECRA).toMatch(/\}, \[error\]\);/);
    // O que já lá estava continua: «Tentar outra vez».
    expect(ECRA).toContain("void retry()");
  });

  it("a regra da limpeza é a do site, importada e não copiada", () => {
    const FONTE = cru("app-pro/src/lib/erro-da-app.ts");
    expect(FONTE).toMatch(/^import \{[^}]*\bsemDadosDePessoas\b[^}]*\} from "\.\.\/\.\.\/\.\.\/src\/lib\/erros-da-app";/m);
    expect(FONTE).not.toMatch(/\.replace\(\/\[A-Z0-9\._%\+-\]\+@/);
  });
});

describe("d14 — a sessão nova fica no lugar da antiga", () => {
  const API = semNotas("app-pro/src/lib/api.ts");

  it("as duas rotas do site devolvem o token à app", () => {
    for (const rota of ["src/app/api/profissionais/palavra-passe/route.ts", "src/app/api/profissionais/sair-de-todos/route.ts"]) {
      expect(semNotas(rota), rota).toContain("return respostaComSessaoNova(req, token, sessao.lembrar);");
    }
    expect(semNotas("src/lib/corte-das-sessoes.ts")).toContain("if (sessaoVemDaApp(req)) return NextResponse.json({ ok: true, token });");
  });

  it("a app guarda o token que vem na resposta", () => {
    const i = API.indexOf("export async function pedirComSessaoNova<");
    const fim = API.indexOf("async function perdeuASessao(");
    expect(i).toBeGreaterThan(-1);
    expect(fim).toBeGreaterThan(i);
    const TROCA = API.slice(i, fim);
    expect(TROCA).toContain('r = await pedir<T>(caminho, { metodo: "POST", corpo });');
    expect(TROCA).toContain('if (typeof r.token === "string" && r.token) await guardarToken(r.token);');
    // O 401 da própria troca continua a fazer sair.
    expect(TROCA).toContain("if (e instanceof ErroDaApi && e.estado === 401) aoPerderASessao?.();");
    expect(API).toContain('import { guardarToken, lerToken } from "./sessao";');
  });

  it("um 401 de um pedido com o token antigo não o põe fora", () => {
    const i = API.indexOf("async function perdeuASessao(tokenUsado: string | null): Promise<void> {");
    expect(i).toBeGreaterThan(-1);
    const PERDEU = API.slice(i, API.indexOf("export const PRAZO_DO_PEDIDO_MS"));
    expect(PERDEU).toContain("if (trocasEmCurso > 0) return;");
    expect(PERDEU).toContain("if (tokenUsado !== null && tokenUsado !== (await lerToken())) return;");
    expect(PERDEU).toContain("aoPerderASessao?.();");
    // As duas portas para o site passam o token que levaram.
    expect(API.split("lerResposta<T>(r, ").length - 1).toBe(2);
    expect(API).toContain("return lerResposta<T>(r, !!opcoes.semSessao, tokenUsado);");
    expect(API).toContain("return lerResposta<T>(r, false, tokenUsado);");
    expect(API).toContain("if (r.status === 401 && !semSessao) await perdeuASessao(tokenUsado);");
    expect(API).not.toContain("if (r.status === 401 && !semSessao) aoPerderASessao?.();");
  });

  it("mudar a palavra-passe na app usa a troca, e não o pedido simples", () => {
    const SENHA = semNotas("app-pro/src/app/conta/palavra-passe.tsx");
    expect(SENHA).toContain('await pedirComSessaoNova<{ ok?: boolean; token?: string }>("/api/profissionais/palavra-passe", { actual, nova });');
    expect(SENHA).not.toContain('pedir("/api/profissionais/palavra-passe"');
  });

  it("na Conta, «Sair de todos os aparelhos» chama a rota nova e diz o que aconteceu", () => {
    const CONTA = semNotas("app-pro/src/app/(app)/conta.tsx");
    expect(CONTA).toContain('titulo={aSairDeTodos ? "A fechar as outras sessões…" : "Sair de todos os aparelhos"}');
    expect(CONTA).toContain('await pedirComSessaoNova<{ ok?: boolean; token?: string }>("/api/profissionais/sair-de-todos");');
    expect(CONTA).toContain('"Os outros telemóveis tiveram de voltar a entrar."');
    expect(CONTA).toContain("{deTodos ? <Mensagem tom={deTodos.tom} texto={deTodos.texto} /> : null}");
    // O botão fica antes do «Sair» deste telemóvel.
    expect(CONTA.indexOf('"Sair de todos os aparelhos"')).toBeLessThan(CONTA.indexOf('titulo={aSair ? "A sair…" : "Sair"}'));
  });

  it("sair deste telemóvel apaga-o da lista dos avisos, antes de esquecer a sessão", () => {
    const SESSAO = semNotas("app-pro/src/estado/Sessao.tsx");
    const i = SESSAO.indexOf("const sair = useCallback(async () => {");
    expect(i).toBeGreaterThan(-1);
    const SAIR = SESSAO.slice(i, SESSAO.indexOf("}, []);", i));
    expect(SAIR.indexOf("await desligarAvisos();")).toBeGreaterThan(-1);
    expect(SAIR.indexOf("await desligarAvisos();")).toBeLessThan(SAIR.indexOf("await esquecerToken();"));
    const AVISOS = semNotas("app-pro/src/lib/avisos.ts");
    expect(AVISOS).toContain('await pedir("/api/profissionais/dispositivo", { metodo: "DELETE", corpo: { token }, semSessao: true });');
    expect(semNotas("src/app/api/profissionais/dispositivo/route.ts")).toContain("export async function DELETE(req: NextRequest)");
  });

  it("na demonstração, as duas rotas também devolvem a sessão nova", () => {
    const DEMO = semNotas("app-pro/src/lib/demo.ts");
    expect(DEMO).toContain(
      'if (caminho === "/api/profissionais/palavra-passe" || caminho === "/api/profissionais/sair-de-todos") { return { ok: true, token: "demo" } as T; }',
    );
  });
});
