import { createHash, randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { MENSAGEM } from "./entrada-por-link";
import {
  codigoNovo,
  emBase64Url,
  entrarComOLink,
  FORMA_DA_PROVA,
  FORMA_DO_CODIGO,
  mascararEmail,
  NAO_ENTROU,
  pedirLinkDeEntrada,
  ROTA_DE_ENTRAR,
  ROTA_DE_VERIFICAR,
  ROTA_DO_LINK,
  verificarLinkDeEntrada,
} from "../../app-cliente/src/lib/entrada";
import { ErroDaApi, motivoDe, type OpcoesDoPedido, type Pedir } from "../../app-cliente/src/lib/erros";
import {
  caminhoDoAviso,
  ECRA_DA_ENTRADA,
  ECRA_DO_PEDIDO_DO_LINK,
  esquecerLinkDeEntrada,
  esquecerLinkDoPedido,
  INICIO,
  lerLinkDeFora,
  linkDeEntradaPendente,
  linkDoPedidoPendente,
  tratarLinkDeFora,
} from "../../app-cliente/src/lib/links";
import {
  catalogoValido,
  corpoDoPedido,
  diasParaEscolher,
  faltaNoPasso,
  primeiroDiaPossivel,
  rascunhoVazio,
  type Catalogo,
  type Rascunho,
} from "../../app-cliente/src/lib/novo-pedido";
import {
  juntarPaginas,
  linhaDoTempo,
  momentoDoTrabalhoClyon,
  perguntaDeRecusar,
  podeRecusar,
  propostasEmAberto,
  quantosComNovidade,
  textoDaEspera,
  textoDeContratar,
  type Negociacao,
  type Pedido,
  type PedidoNaLista,
  type RespostaDoPedido,
} from "../../app-cliente/src/lib/pedidos";
import { corpoDoErro, ROTA_DO_ERRO_DA_APP, versaoDaApp } from "../../app-cliente/src/lib/erro-da-app";

/**
 * A APP DE CLIENTE, FASE 2 — ordem de 28-10-2026 (especificação v2: A1, A2, A4).
 *
 * A2 — a entrada segura: o esquema próprio nunca chega aos ecrãs de link; o
 * link pedido na app fica preso ao telemóvel que o pediu (o código do
 * aparelho no cofre, a prova no pedido); um link de outra instalação é
 * recusado; entrar só depois de um toque.
 *
 * As rotas da Engenharia — Site que ainda não estão no ar (S1: a R1 v2 e a
 * R1a) testam-se aqui contra o CONTRATO da especificação, com um site de
 * mentira que o cumpre. Quando a S1 chegar, os testes dela provam o lado do
 * servidor; estes provam que a app faz a parte dela.
 *
 * Corre na suite do site, como os testes da app Pro: importa só os ficheiros
 * puros da app (sem Expo nem React Native) e lê os outros como texto.
 */

const RAIZ = process.cwd();
const APP = join(RAIZ, "app-cliente");
const ler = (p: string) => readFileSync(join(APP, p), "utf8");

function ficheiros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? ficheiros(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}
const FONTES = ficheiros(join(APP, "src"));
const relativo = (f: string) => f.slice(APP.length + 1).replace(/\\/g, "/");

/** Os textos de um ficheiro (strings, templates e JSX), como o cliente os lê — pela árvore do TypeScript. */
function textosDe(ficheiro: string): string[] {
  const fonte = readFileSync(ficheiro, "utf8");
  const sf = ts.createSourceFile(ficheiro, fonte, ts.ScriptTarget.Latest, true, ficheiro.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const saida: string[] = [];
  const visitar = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isLiteralTypeNode(n)) return;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) saida.push(n.text);
    else if (ts.isTemplateExpression(n)) saida.push(n.head.text + n.templateSpans.map((s) => `‹›${s.literal.text}`).join(""));
    else if (ts.isJsxText(n)) saida.push(n.text);
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return saida.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/* ─── Um site de mentira que cumpre o contrato da S1 (R1 v2, R1a, entrada/link) ── */

function siteDeMentira() {
  const links = new Map<string, { email: string; prova: string | null; gasto: boolean }>();
  const chamadas: string[] = [];
  let ultimoLink = "";
  const recusa = (motivo: string, error: string) => new ErroDaApi(error, 401, { ok: false, error, motivo });

  const pedir = (async (caminho: string, o: OpcoesDoPedido = {}) => {
    chamadas.push(caminho);
    const c = (o.corpo ?? {}) as Record<string, unknown>;
    if (caminho === ROTA_DO_LINK) {
      const comApp = c.app === "cliente";
      if (comApp && !/^[0-9a-f]{64}$/.test(String(c.prova ?? ""))) throw new ErroDaApi("Pedido inválido.", 400);
      ultimoLink = randomBytes(32).toString("base64url");
      links.set(ultimoLink, { email: String(c.email), prova: comApp ? String(c.prova) : null, gasto: false });
      return { ok: true };
    }
    if (caminho === ROTA_DE_VERIFICAR || caminho === ROTA_DE_ENTRAR) {
      if (!FORMA_DO_CODIGO.test(String(c.codigoDoAparelho ?? ""))) throw new ErroDaApi("Pedido inválido.", 400);
      const l = links.get(String(c.linkToken));
      if (!l) throw recusa("desconhecido", MENSAGEM.desconhecido);
      if (l.gasto) throw recusa("usado", MENSAGEM.usado);
      if (!l.prova) throw recusa("doSite", "Este link é para entrar no site. Peça o link de entrada aqui na app.");
      const prova = createHash("sha256").update(String(c.codigoDoAparelho), "utf8").digest("hex");
      if (prova !== l.prova) throw recusa("outroAparelho", "Este link foi pedido noutro telemóvel. Peça um novo aqui.");
      if (caminho === ROTA_DE_VERIFICAR) return { ok: true, email: l.email, emailMascarado: mascararEmail(l.email) };
      l.gasto = true;
      return { ok: true, token: `sessao-de-${l.email}`, expiraEm: "2026-11-27T10:00:00.000Z", email: l.email, entrada: "link" };
    }
    throw new ErroDaApi("Rota desconhecida no site de mentira.", 404);
  }) as Pedir;

  return { pedir, chamadas, links, ultimo: () => ultimoLink };
}

const sha256Hex = async (t: string) => createHash("sha256").update(t, "utf8").digest("hex");
const bytes = (n: number) => new Uint8Array(randomBytes(n));

/* ─── A2 — o esquema próprio nunca chega aos ecrãs de link ──────────────────── */

describe("A2 — os links de fora (+native-intent)", () => {
  it("o +native-intent passa tudo por tratarLinkDeFora, e nunca lança", () => {
    const n = ler("src/app/+native-intent.tsx");
    expect(n).toContain("export function redirectSystemPath");
    expect(n).toContain("return tratarLinkDeFora(path);");
    expect(n).toMatch(/catch\s*\{\s*return "\/";/);
  });

  it("o esquema próprio vai para o início e não deixa token nenhum na memória", () => {
    esquecerLinkDeEntrada();
    esquecerLinkDoPedido();
    for (const url of [
      "clyoncliente://entrar/app?t=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCd",
      "clyoncliente:///entrar/app?t=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCd",
      "clyoncliente://entrar/confirmar?t=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCd",
      "clyoncliente://pedido/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCd",
      "clyoncliente://pedido-do-link",
      "/entrar/app?t=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCd",
      "/pedido/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCd",
    ]) {
      expect(tratarLinkDeFora(url), url).toBe(INICIO);
    }
    expect(linkDeEntradaPendente()).toBeNull();
    expect(linkDoPedidoPendente()).toBeNull();
  });

  it("só https://clyon.pt, exactamente: nem http, nem porta, nem outro nome colado", () => {
    for (const url of [
      "http://clyon.pt/entrar/app?t=abcdefghijklmnopqrstuvwxyz",
      "https://clyon.pt:8443/entrar/app?t=abcdefghijklmnopqrstuvwxyz",
      "https://clyon.pt.outro.pt/entrar/app?t=abcdefghijklmnopqrstuvwxyz",
      "https://clyon.pt@outro.pt/entrar/app?t=abcdefghijklmnopqrstuvwxyz",
      "https://outro.pt/https://clyon.pt/entrar/app?t=abcdefghijklmnopqrstuvwxyz",
      "https://www.clyon.pt/entrar/app?t=abcdefghijklmnopqrstuvwxyz",
      // O link de entrada pedido no SITE abre o site, não a app.
      "https://clyon.pt/entrar/link?t=abcdefghijklmnopqrstuvwxyz",
      "https://clyon.pt/profissionais/pedidos/abcdefghijklmnopqrstuvwxyz",
    ]) {
      expect(lerLinkDeFora(url), url).toEqual({ tipo: "inicio" });
    }
  });

  it("o link de entrada da app abre o E1a, com o token na memória e não no caminho", () => {
    const t = randomBytes(32).toString("base64url");
    const caminho = tratarLinkDeFora(`https://clyon.pt/entrar/app?t=${t}`);
    expect(caminho).toBe(ECRA_DA_ENTRADA);
    expect(caminho).not.toContain(t);
    expect(linkDeEntradaPendente()).toBe(t);
    esquecerLinkDeEntrada();
    expect(linkDeEntradaPendente()).toBeNull();
  });

  it("o link de um pedido abre o E1b, com o token na memória e não no caminho", () => {
    const t = randomBytes(32).toString("base64url");
    const caminho = tratarLinkDeFora(`https://clyon.pt/pedido/${t}`);
    expect(caminho).toBe(ECRA_DO_PEDIDO_DO_LINK);
    expect(caminho).not.toContain(t);
    expect(linkDoPedidoPendente()).toBe(t);
    esquecerLinkDoPedido();
  });

  it("os ecrãs E1a e E1b só confiam no token da memória — nunca nos parâmetros do endereço", () => {
    const e1a = ler("src/app/entrar/confirmar.tsx");
    const e1b = ler("src/app/pedido-do-link.tsx");
    expect(e1a).toContain("useRef<string | null>(linkDeEntradaPendente())");
    expect(e1b).toContain("useRef<string | null>(linkDoPedidoPendente())");
    for (const t of [e1a, e1b]) expect(t).not.toContain("useLocalSearchParams");
  });

  it("os App Links da app: /entrar/app (exacto) e /pedido/ (prefixo), verificados, sem /entrar/link", () => {
    const app = JSON.parse(ler("app.json")).expo;
    const filtros = app.android.intentFilters as Array<{ autoVerify: boolean; data: Array<Record<string, string>> }>;
    expect(filtros.every((f) => f.autoVerify === true)).toBe(true);
    const dados = filtros.flatMap((f) => f.data);
    expect(dados).toEqual([
      { scheme: "https", host: "clyon.pt", path: "/entrar/app" },
      { scheme: "https", host: "clyon.pt", pathPrefix: "/pedido/" },
    ]);
    // E não se cruzam com os da Pro.
    const pro = JSON.parse(readFileSync(join(RAIZ, "app-pro/app.json"), "utf8")).expo;
    const daPro = pro.android.intentFilters.flatMap((f: { data: Array<Record<string, string>> }) => f.data.map((d) => d.path ?? d.pathPrefix));
    for (const c of daPro) expect(String(c)).toMatch(/^\/profissionais\//);
  });

  it("tocar num aviso abre esse pedido, pelo pedidoId (S10)", () => {
    expect(caminhoDoAviso({ pedidoId: 482, tipo: "proposta" })).toBe("/pedido/482");
    expect(caminhoDoAviso({ pedidoId: "482" })).toBe("/pedido/482");
    expect(caminhoDoAviso({ url: "https://clyon.pt/pedido/abc" })).toBe(INICIO);
    expect(caminhoDoAviso({ pedidoId: -1 })).toBe(INICIO);
    expect(caminhoDoAviso(null)).toBe(INICIO);
  });
});

/* ─── A2 — a entrada presa a este telemóvel ───────────────────────────────── */

describe("A2 — o código do aparelho e a prova", () => {
  it("o código: 32 bytes aleatórios em base64url, 43 caracteres", () => {
    for (let i = 0; i < 50; i++) expect(codigoNovo(bytes)).toMatch(FORMA_DO_CODIGO);
    for (const n of [0, 1, 2, 3, 31, 32, 33, 64]) {
      const b = randomBytes(n);
      expect(emBase64Url(new Uint8Array(b))).toBe(b.toString("base64url"));
    }
  });

  it("ao pedir o link vai a prova — o SHA-256 do código, em hexadecimal — e nunca o código", async () => {
    const site = siteDeMentira();
    const corpos: unknown[] = [];
    const pedir = (async (c: string, o?: OpcoesDoPedido) => {
      corpos.push(o?.corpo);
      return site.pedir(c, o);
    }) as Pedir;
    const codigo = codigoNovo(bytes);
    await pedirLinkDeEntrada({ pedir, email: "cliente@exemplo.pt", codigo, sha256Hex });
    expect(corpos).toEqual([{ email: "cliente@exemplo.pt", app: "cliente", prova: await sha256Hex(codigo) }]);
    expect(JSON.stringify(corpos)).not.toContain(codigo);
    expect(await sha256Hex(codigo)).toMatch(FORMA_DA_PROVA);
  });

  it("o código fica no cofre e vai para o lixo depois de entrar, de «Não sou eu» e de «Sair»", () => {
    const codigo = ler("src/lib/codigo-do-aparelho.ts");
    expect(codigo).toContain("Crypto.getRandomBytes(n)");
    expect(codigo).toContain("await guardarNoCofre(CHAVE, novo);");
    expect(codigo).toContain("Crypto.CryptoDigestAlgorithm.SHA256");
    expect(ler("src/lib/sessao.ts")).toContain("SecureStore.setItemAsync(chave, valor)");
    const sessao = ler("src/estado/Sessao.tsx");
    // Depois de entrar e depois de sair.
    expect(sessao.match(/await esquecerCodigoDoAparelho\(\);/g)?.length).toBe(2);
    expect(ler("src/app/entrar/confirmar.tsx")).toMatch(/async function naoSouEu\(\) \{[\s\S]*?await esquecerCodigoDoAparelho\(\);[\s\S]*?\n  \}/);
  });
});

describe("A2 — um link de outra instalação é recusado (contrato da R1 v2 e da R1a)", () => {
  it("o link pedido no telemóvel A, aberto no B: não entra, e continua a servir no A", async () => {
    const site = siteDeMentira();
    const codigoA = codigoNovo(bytes);
    const codigoB = codigoNovo(bytes);
    await pedirLinkDeEntrada({ pedir: site.pedir, email: "ana@exemplo.pt", codigo: codigoA, sha256Hex });
    const token = site.ultimo();

    // No telemóvel B: o E1a pergunta de quem é, e o site recusa.
    const noB = await verificarLinkDeEntrada({ pedir: site.pedir, token, codigo: codigoB, emailDaSessao: null });
    expect(noB).toEqual({ passo: "erro", mensagem: "Este link foi pedido noutro telemóvel. Peça um novo aqui.", botao: "novo-link" });
    // Mesmo que alguém tente entrar à força com o código errado.
    const forcado = await entrarComOLink({ pedir: site.pedir, token, codigo: codigoB }).catch((e) => e);
    expect(motivoDe(forcado)).toBe("outroAparelho");
    expect(site.links.get(token)?.gasto).toBe(false);

    // No telemóvel A: mostra a conta mascarada e espera pelo toque.
    const noA = await verificarLinkDeEntrada({ pedir: site.pedir, token, codigo: codigoA, emailDaSessao: null });
    expect(noA).toEqual({ passo: "entrar", email: "ana@exemplo.pt", emailMascarado: "a•••@exemplo.pt" });
    expect(site.links.get(token)?.gasto).toBe(false);

    const sessao = await entrarComOLink({ pedir: site.pedir, token, codigo: codigoA });
    expect(sessao).toEqual({ token: "sessao-de-ana@exemplo.pt", email: "ana@exemplo.pt", expiraEm: "2026-11-27T10:00:00.000Z", entrada: "link" });

    // Uso único: a segunda vez dá a frase do site.
    const outraVez = await verificarLinkDeEntrada({ pedir: site.pedir, token, codigo: codigoA, emailDaSessao: null });
    expect(outraVez).toEqual({ passo: "erro", mensagem: MENSAGEM.usado, botao: "novo-link" });
  });

  it("abrir o E1a não gasta o link: só a R1a, nunca a R1, até haver um toque", async () => {
    const site = siteDeMentira();
    const codigo = codigoNovo(bytes);
    await pedirLinkDeEntrada({ pedir: site.pedir, email: "rui@exemplo.pt", codigo, sha256Hex });
    for (let i = 0; i < 3; i++) await verificarLinkDeEntrada({ pedir: site.pedir, token: site.ultimo(), codigo, emailDaSessao: null });
    expect(site.chamadas.filter((c) => c === ROTA_DE_ENTRAR)).toEqual([]);
    expect(site.chamadas.filter((c) => c === ROTA_DE_VERIFICAR)).toHaveLength(3);
  });

  it("no ecrã, a R1 só se chama dentro de «Entrar» / «Trocar de conta», e o arranque só verifica", () => {
    const e1a = ler("src/app/entrar/confirmar.tsx");
    expect(e1a.match(/entrarComOLink\(/g)?.length).toBe(1);
    const entrar = e1a.slice(e1a.indexOf("async function entrar()"), e1a.indexOf("async function naoSouEu()"));
    expect(entrar).toContain("await entrarComOLink({ pedir, token: token.current, codigo: codigo.current })");
    const efeito = e1a.slice(e1a.indexOf("useEffect(() => {"), e1a.indexOf("async function entrar()"));
    expect(efeito).toContain("void verificar();");
    expect(efeito).not.toContain("entrar(");
    // Os botões que chamam a R1 são estes dois, e só por toque.
    expect(e1a).toContain('<Botao titulo="Entrar" aoCarregar={() => void entrar()} />');
    expect(e1a).toContain('<Botao titulo="Trocar de conta" aoCarregar={() => void entrar()} />');
    expect(e1a).toContain('<Botao titulo="Não sou eu" tipo="secundario" aoCarregar={() => void naoSouEu()} />');
  });

  it("um link pedido no SITE não entra na app (doSite), e não se gasta", async () => {
    const site = siteDeMentira();
    await site.pedir(ROTA_DO_LINK, { metodo: "POST", corpo: { email: "rui@exemplo.pt" }, semSessao: true });
    const r = await verificarLinkDeEntrada({ pedir: site.pedir, token: site.ultimo(), codigo: codigoNovo(bytes), emailDaSessao: null });
    expect(r).toEqual({ passo: "erro", mensagem: "Este link é para entrar no site. Peça o link de entrada aqui na app.", botao: "novo-link" });
    expect(site.links.get(site.ultimo())?.gasto).toBe(false);
  });

  it("com outra conta aberta pergunta «Trocar de conta?»; com a mesma, vai para Pedidos sem gastar", async () => {
    const site = siteDeMentira();
    const codigo = codigoNovo(bytes);
    await pedirLinkDeEntrada({ pedir: site.pedir, email: "rui@exemplo.pt", codigo, sha256Hex });
    const token = site.ultimo();
    expect(await verificarLinkDeEntrada({ pedir: site.pedir, token, codigo, emailDaSessao: "ana@exemplo.pt" })).toEqual({
      passo: "trocar",
      email: "rui@exemplo.pt",
      emailMascarado: "r•••@exemplo.pt",
      sessaoMascarada: "a•••@exemplo.pt",
    });
    expect(await verificarLinkDeEntrada({ pedir: site.pedir, token, codigo, emailDaSessao: "RUI@exemplo.pt " })).toEqual({ passo: "mesma-conta" });
    expect(site.links.get(token)?.gasto).toBe(false);
  });

  it("sem rede: «Tentar outra vez»; 429: a frase do site", async () => {
    const semRede = (async () => {
      throw new ErroDaApi("Sem ligação à internet. Tente outra vez.", 0);
    }) as Pedir;
    expect(await verificarLinkDeEntrada({ pedir: semRede, token: "x", codigo: codigoNovo(bytes), emailDaSessao: null })).toEqual({
      passo: "erro",
      mensagem: "Sem ligação à internet. Tente outra vez.",
      botao: "tentar-outra-vez",
    });
  });

  it("a máscara do email é a da especificação (a mesma da mascararEmail do site, S1)", () => {
    expect(mascararEmail("joao@gmail.com")).toBe("j•••@gmail.com");
    expect(mascararEmail("a@x.pt")).toBe("a•••@x.pt");
    expect(mascararEmail("")).toBe("•••");
  });

  it("«Não sou eu» não entra: deita fora o código, e o aviso é o da especificação", () => {
    expect(NAO_ENTROU).toBe("Não entrou. Este link só serve no telemóvel onde foi pedido. Se não o pediu, pode ignorá-lo.");
    const e1a = ler("src/app/entrar/confirmar.tsx");
    const naoSouEu = e1a.slice(e1a.indexOf("async function naoSouEu()"), e1a.indexOf("function ficarNaConta()"));
    expect(naoSouEu).not.toContain("entrarComOLink");
    expect(naoSouEu).toContain('mostrarAviso({ texto: NAO_ENTROU, tom: "aviso" });');
  });

  it("trocar de conta: primeiro sai da antiga (tira o telemóvel no site, apaga o token, a lista e o rascunho), depois guarda a nova", () => {
    const s = ler("src/estado/Sessao.tsx");
    const troca = s.slice(s.indexOf("const entrarComSessaoNova"), s.indexOf("const valor = useMemo"));
    const sai = troca.indexOf("await largarAConta(true);");
    expect(sai).toBeGreaterThan(-1);
    expect(sai).toBeLessThan(troca.indexOf("await guardarToken(s.token);"));
    const largar = s.slice(s.indexOf("async function largarAConta"), s.indexOf("export function SessaoProvider"));
    expect(largar).toContain("await tirarTelemovelDaConta(await lerToken());");
    expect(largar).toContain("await esquecerSessao();");
    expect(largar).toContain("apagarTudoDaConta();");
    expect(ler("src/lib/guardado.ts")).toMatch(/export function apagarTudoDaConta\(\): void \{\s*apagar\(LISTA\);\s*apagar\(RASCUNHO\);/);
    // O telemóvel sai da conta antiga COM O TOKEN DELA (R6, DELETE).
    expect(ler("src/lib/avisos.ts")).toContain('await pedirComToken("/api/cliente/dispositivo", tokenDaSessao, { metodo: "DELETE", corpo: { token } });');
  });
});

/* ─── A4 — E2: a lista ────────────────────────────────────────────────────── */

const pedidoNaLista = (id: number, novidade: string | null = null): PedidoNaLista => ({
  id,
  servico: "Recolha de móveis",
  cidade: "Lisboa",
  criadoEm: null,
  criadoEmTexto: null,
  estadoTexto: "Tem propostas",
  novidade,
  trabalhoClyon: false,
});

describe("A4 — E2, os seus pedidos (R4)", () => {
  it("o número do separador são os pedidos com novidade; as páginas juntam-se pela ordem da API", () => {
    expect(quantosComNovidade([pedidoNaLista(3, "1 proposta nova"), pedidoNaLista(2), pedidoNaLista(1, "Por pagar")])).toBe(2);
    expect(juntarPaginas([pedidoNaLista(9), pedidoNaLista(4)], [pedidoNaLista(4), pedidoNaLista(7)]).map((p) => p.id)).toEqual([9, 4, 7]);
  });

  it("a app não reordena, e os cartões têm todos a mesma altura, uma linha por informação", () => {
    const e2 = ler("src/app/(app)/pedidos.tsx");
    const estado = ler("src/estado/Pedidos.tsx");
    for (const t of [e2, estado]) expect(t).not.toMatch(/\.sort\(|\.reverse\(/);
    expect(e2).toContain("height: ALTURA_DO_CARTAO,");
    expect(e2.match(/numberOfLines=\{1\}/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("os textos da especificação", () => {
    const e2 = ler("src/app/(app)/pedidos.tsx");
    for (const t of [
      "Os seus pedidos",
      "Ainda não tem pedidos.",
      "Fez o pedido pelo WhatsApp? Abra o link do pedido neste telemóvel para o juntar aqui.",
      "Sem ligação — a mostrar o que tinha guardado.",
    ]) {
      expect(e2).toContain(t);
    }
    expect(ler("src/estado/Pedidos.tsx")).toContain("const guardada = e instanceof ErroDaApi && e.estado === 0 ? await lerListaGuardada() : null;");
  });
});

/* ─── A4 — E5: o pedido, as propostas e as acções ─────────────────────────── */

const preco = { principal: "452,03 € com IVA", detalhe: "367,50 € + 84,53 € de IVA (23 %)", nota: "Pelo trabalho todo." };

function negociacao(id: number, extra: Partial<Negociacao> = {}): Negociacao {
  return {
    id,
    estado: "aberta",
    estadoTexto: "Proposta de Rui",
    fase: "a_negociar",
    profissional: {
      nome: `Profissional ${id}`,
      telefone: null,
      guiaVerificada: false,
      notaMedia: null,
      notaTexto: "Sem avaliações ainda",
      quantasAvaliacoes: 0,
      trabalhosConcluidos: 0,
      naClyonDesde: null,
      naClyonDesdeTexto: null,
      zonas: [],
      raioKm: null,
      avaliacoes: [],
    },
    accoes: ["aceitar", "propor", "desistir"],
    aguardaContratacao: false,
    propostasRestantes: 2,
    preco,
    precoEtiqueta: "proposta dele",
    formaTexto: "",
    dataCombinada: null,
    dataCombinadaTexto: null,
    aCaminhoEm: null,
    aCaminhoEmTexto: null,
    chegouEm: null,
    chegouEmTexto: null,
    execucaoEnviadaEm: null,
    execucaoEnviadaEmTexto: null,
    confirmadoEm: null,
    confirmadoEmTexto: null,
    pagoEm: null,
    pagoEmTexto: null,
    avaliado: false,
    estrelas: null,
    prova: [],
    provaNota: null,
    ajuste: null,
    porConfirmarPelaClyon: false,
    diasAteLibertarTexto: null,
    botaoDeConfirmar: "Está bem feito, dar por concluído",
    pagamento: null,
    ...extra,
  };
}

function pedido(extra: Partial<Pedido> = {}): Pedido {
  return {
    id: 482,
    servico: "Recolha de móveis",
    estadoTexto: "Tem propostas",
    morada: null,
    cidade: "Lisboa",
    quando: null,
    descricao: null,
    fotos: [],
    precisaFatura: false,
    precisaGuiaTransporte: false,
    avisos: [],
    criadoEm: null,
    criadoEmTexto: null,
    trabalhoClyon: false,
    valorClyon: null,
    quemFaz: null,
    ...extra,
  };
}

const RECUSAR = {
  comOutras: "Recusar a proposta de {nome}? As outras continuam.",
  semOutras: "Recusar a proposta de {nome}? O pedido continua aberto a outras propostas.",
};

describe("A4 — E5, o pedido (R5 e R8)", () => {
  it("as propostas ficam pela ordem da API (a última actividade em cima, P3); as fechadas não aparecem", () => {
    const r = { negociacoes: [negociacao(7), negociacao(3, { estado: "desistida" }), negociacao(5, { estado: "aguarda_contratacao", accoes: ["contratar", "desistir"] })] };
    expect(propostasEmAberto(r).map((n) => n.id)).toEqual([7, 5]);
  });

  it("«Contratar»: o preço, a nota, quem faz o trabalho — e a frase única por baixo, do catálogo", () => {
    expect(textoDeContratar(negociacao(7, { profissional: { ...negociacao(7).profissional, nome: "Rui" } }))).toEqual({
      titulo: "Contratar Rui?",
      texto: "452,03 € com IVA. Pelo trabalho todo. O trabalho é feito por Rui, parceiro verificado que escolheu. As outras propostas fecham.",
    });
    const e5 = ler("src/componentes/VistaDoPedido.tsx");
    expect(e5).toContain("pequeno={catalogo?.textos.fraseUnica ?? null}");
  });

  it("«Recusar» só com o texto do site (S8/S9), e diz «com outras» ou «única»", () => {
    const sem: RespostaDoPedido["textos"] = { sobreAsPropostas: "", sobreOValorCombinado: "" };
    expect(podeRecusar(negociacao(7), sem)).toBe(false);
    expect(podeRecusar(negociacao(7), { ...sem, recusar: RECUSAR })).toBe(true);
    expect(podeRecusar(negociacao(7, { accoes: ["aceitar"] }), { ...sem, recusar: RECUSAR })).toBe(false);
    const duas = { negociacoes: [negociacao(7), negociacao(5)], textos: { ...sem, recusar: RECUSAR } };
    expect(perguntaDeRecusar(duas.negociacoes[0], duas)).toBe("Recusar a proposta de Profissional 7? As outras continuam.");
    const uma = { negociacoes: [negociacao(7)], textos: { ...sem, recusar: RECUSAR } };
    expect(perguntaDeRecusar(uma.negociacoes[0], uma)).toBe("Recusar a proposta de Profissional 7? O pedido continua aberto a outras propostas.");
    expect(ler("src/componentes/VistaDoPedido.tsx")).toContain('accao: "desistir"');
  });

  it("antes de haver propostas: «A CLYON está a rever…» ou «enviado aos parceiros verificados…»", () => {
    expect(textoDaEspera({ pedido: pedido({ estadoTexto: "A ser revisto pela CLYON" }), negociacoes: [] })).toBe("A CLYON está a rever o seu pedido.");
    expect(textoDaEspera({ pedido: pedido({ estadoTexto: "À espera de propostas" }), negociacoes: [] })).toBe(
      "O pedido foi enviado aos parceiros verificados da zona. Ainda sem propostas.",
    );
    expect(textoDaEspera({ pedido: pedido(), negociacoes: [negociacao(1)] })).toBeNull();
  });

  it("Trabalho CLYON (P2): sem preço enviado nada à vista; «Aceito este preço» com a versão; aceite; com profissional", () => {
    const valor = { ...preco };
    // Antes da S7 a R5 manda o valor sem versão: a app trata-o como «a ser revisto».
    expect(momentoDoTrabalhoClyon(pedido({ trabalhoClyon: true, valorClyon: valor }))).toEqual({ momento: "a-rever" });
    expect(momentoDoTrabalhoClyon(pedido({ trabalhoClyon: true }))).toEqual({ momento: "a-rever" });
    const enviado = { ...valor, versao: "2026-10-28T10:00:00.000Z" };
    expect(momentoDoTrabalhoClyon(pedido({ trabalhoClyon: true, valorClyon: enviado, accoes: ["aceitar_preco_clyon"] }))).toEqual({
      momento: "por-responder",
      valor: enviado,
      versao: "2026-10-28T10:00:00.000Z",
    });
    expect(
      momentoDoTrabalhoClyon(pedido({ trabalhoClyon: true, valorClyon: enviado, precoAceiteEm: "2026-10-28T11:00:00.000Z", precoAceiteEmTexto: "quarta-feira, 28 de outubro, às 11:00" })),
    ).toEqual({ momento: "aceite", valor: enviado, aceiteEmTexto: "quarta-feira, 28 de outubro, às 11:00" });
    expect(momentoDoTrabalhoClyon(pedido({ trabalhoClyon: true, valorClyon: enviado, quemFaz: "Rui" }))).toEqual({
      momento: "com-profissional",
      valor: enviado,
      quemFaz: "Rui",
    });
    const e5d = ler("src/componentes/TrabalhoClyon.tsx");
    expect(e5d).toContain('accao: "aceitar_preco_clyon", versao');
    expect(e5d).not.toMatch(/titulo="Contratar"|titulo="Recusar"/);
  });

  it("a linha do tempo (E8) pela ordem da especificação, com as datas que a API manda", () => {
    const n = negociacao(1, {
      estado: "acordada",
      dataCombinadaTexto: "sexta-feira, 30 de outubro, às 09:00",
      aCaminhoEmTexto: "sexta-feira, 30 de outubro, às 08:40",
      chegouEmTexto: "sexta-feira, 30 de outubro, às 09:02",
    });
    expect(linhaDoTempo(n).map((p) => p.titulo)).toEqual([
      "Contratado",
      "Dia combinado: sexta-feira, 30 de outubro, às 09:00",
      "A caminho",
      "Chegou",
    ]);
    expect(linhaDoTempo(negociacao(1, { estado: "acordada" }))[1].titulo).toBe("O parceiro vai combinar o dia consigo.");
  });

  it("E9b (sem fotografias): nunca aparece o texto de prazo", () => {
    const e9 = ler("src/componentes/TrabalhoFeito.tsx");
    expect(e9).toContain("const semFotografias = n.porConfirmarPelaClyon || n.prova.length === 0;");
    expect(e9).toMatch(/semFotografias \? \(\s*<Text[^>]*>Se preferir, espere pelo contacto da CLYON\.<\/Text>\s*\) : n\.diasAteLibertarTexto/);
  });

  it("os tipos da app batem com o que a R5 devolve (os campos que ainda faltam são os da S7)", () => {
    const tipos = ler("src/lib/pedidos.ts");
    const campos = (nome: string) => {
      const bloco = tipos.slice(tipos.indexOf(`export type ${nome} = {`), tipos.indexOf("\n};", tipos.indexOf(`export type ${nome} = {`)));
      return [...bloco.matchAll(/^  (\w+)\??:/gm)].map((m) => m[1]);
    };
    const daNegociacao = readFileSync(join(RAIZ, "src/lib/pedido-para-a-app.ts"), "utf8");
    const doPedido = readFileSync(join(RAIZ, "src/lib/pedidos-do-cliente.ts"), "utf8");
    const existe = (fonte: string, campo: string) => new RegExp(`\\b${campo}\\b\\s*[:,]`).test(fonte);
    for (const c of campos("Negociacao")) expect(existe(daNegociacao, c) || existe(doPedido, c), `negociação.${c}`).toBe(true);
    for (const c of campos("Profissional").filter((x) => x !== "respostaTexto")) expect(existe(daNegociacao, c), `profissional.${c}`).toBe(true);
    const daS7 = ["accoes", "precoAceiteEm", "precoAceiteEmTexto"];
    for (const c of campos("Pedido").filter((x) => !daS7.includes(x))) expect(existe(doPedido, c), `pedido.${c}`).toBe(true);
    for (const c of campos("PedidoNaLista")) expect(existe(doPedido, c), `lista.${c}`).toBe(true);
  });
});

/* ─── A4 — E3: o novo pedido ──────────────────────────────────────────────── */

const CATALOGO = {
  servicos: [
    { id: "recolha_moveis", nome: "Recolha de móveis", detalhes: "moveis" },
    { id: "recolha_entulho", nome: "Recolha de entulho", detalhes: "entulho" },
    { id: "mudanca", nome: "Mudança", detalhes: "mudanca" },
  ],
  entulho: [
    { id: "ensacado", nome: "Já está em sacos" },
    { id: "chao", nome: "Está no chão" },
    { id: "bigbags", nome: "Em big bags" },
  ],
  tipologias: [{ id: "T2", nome: "T2" }],
  quando: ["hoje", "amanha", "esta_semana", "data", "flexivel"],
  textos: { fraseUnica: "Profissionais verificados fazem o trabalho; a CLYON organiza, guarda o acordo e o pagamento." },
  ficheiros: { maximo: 50, tipos: ["image/jpeg"] },
  whatsapp: "x",
};

describe("A4 — E3, o novo pedido (R7 e S5, pelo contrato)", () => {
  const c = catalogoValido(CATALOGO) as Catalogo;

  it("o catálogo: sem big bags nem «hoje», no máximo 20 fotografias; sem a frase única, não serve", () => {
    expect(c.entulho.map((o) => o.id)).toEqual(["ensacado", "chao"]);
    expect(c.quando).toEqual(["amanha", "esta_semana", "data", "flexivel"]);
    expect(c.ficheiros.maximo).toBe(20);
    expect(catalogoValido({ ...CATALOGO, textos: {} })).toBeNull();
  });

  it("o calendário começa amanhã EM LISBOA, nunca hoje — seja qual for o fuso do telemóvel", () => {
    // 23:30 em Lisboa (Inverno): amanhã é 29.
    expect(primeiroDiaPossivel(new Date("2026-10-28T23:30:00Z"))).toBe("2026-10-29");
    // 23:30 em Paris = 22:30 em Lisboa: amanhã é 29.
    expect(primeiroDiaPossivel(new Date("2026-10-28T23:30:00+01:00"))).toBe("2026-10-29");
    // Verão: 23:30 UTC já é 00:30 de dia 16 em Lisboa — amanhã é 17.
    expect(primeiroDiaPossivel(new Date("2026-07-15T23:30:00Z"))).toBe("2026-07-17");
    const dias = diasParaEscolher(new Date("2026-10-28T10:00:00Z"), 3);
    expect(dias).toEqual([
      { dia: "2026-10-29", texto: "quinta-feira, 29 de outubro" },
      { dia: "2026-10-30", texto: "sexta-feira, 30 de outubro" },
      { dia: "2026-10-31", texto: "sábado, 31 de outubro" },
    ]);
  });

  it("o pedido vai com a origem da app, a data preferida e o número de rascunhos — nunca «today»", () => {
    const r: Rascunho = {
      ...rascunhoVazio(),
      passo: 3,
      servico: "recolha_entulho",
      entulho: "chao",
      descricao: "Sacos de obra na garagem",
      morada: { formattedAddress: "Rua X, Lisboa", aMao: true },
      acesso: { floor: "rés-do-chão", parkingDistance: "door" },
      fotos: [
        { uri: "a", estado: "enviada", url: "https://exemplo/a.jpg", nome: "a.jpg", tamanho: 10, tipo: "image/jpeg" },
        { uri: "b", estado: "falhou" },
      ],
      quando: "data",
      data: "2026-10-30",
      nome: "Ana",
      telefone: "912 345 678",
      email: "",
    };
    const { order } = corpoDoPedido(r, c, { emailDaSessao: "ana@exemplo.pt", rascunhosAntes: 99 });
    expect(order.origemPedido).toBe("app_cliente");
    expect(order.dataPreferida).toBe("2026-10-30");
    expect(order.urgency).toBeUndefined();
    expect(order.rascunhosAntes).toBe(50);
    expect(order.entulhoState).toBe("chao");
    expect((order.receiver as { email: string }).email).toBe("ana@exemplo.pt");
    expect((order.files as unknown[]).length).toBe(1);
    expect(order.fotosNaoEnviadas).toBe(1);
    expect(JSON.stringify(order)).not.toContain("today");
    expect(corpoDoPedido({ ...r, quando: "amanha" }, c, { emailDaSessao: null, rascunhosAntes: 0 }).order.urgency).toBe("tomorrow");
  });

  it("v3: o email nunca se pede no pedido — é sempre o da sessão (a conta pede-se para enviar, E3.F)", () => {
    const r: Rascunho = { ...rascunhoVazio(), quando: "amanha", nome: "Ana", telefone: "912 345 678" };
    expect(faltaNoPasso(r, 3, c)).toBeNull();
    expect(faltaNoPasso({ ...r, quando: "data", data: "2020-01-01" }, 3, c)).toBe("Escolha um dia a partir de amanhã.");
    const { order } = corpoDoPedido({ ...r, email: "outro@exemplo.pt" }, c, { emailDaSessao: "ana@exemplo.pt", rascunhosAntes: 0 });
    expect((order.receiver as { email: string }).email).toBe("ana@exemplo.pt");
  });
});

/* ─── A1 — a 1.ª build, preparada e não construída ─────────────────────────── */

describe("A1 — a 1.ª build nativa (secção 5A)", () => {
  const app = JSON.parse(ler("app.json")).expo;

  it("sem cópias de segurança do Android (regra 9), sem localização, sem janelas por cima", () => {
    expect(app.android.allowBackup).toBe(false);
    for (const p of ["SYSTEM_ALERT_WINDOW", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "ACCESS_BACKGROUND_LOCATION", "RECORD_AUDIO"]) {
      expect(app.android.blockedPermissions).toContain(`android.permission.${p}`);
    }
  });

  it("EAS Update por fingerprint, com os canais preview e production", () => {
    expect(app.runtimeVersion).toEqual({ policy: "fingerprint" });
    expect(app.updates).toMatchObject({ checkAutomatically: "ON_LOAD", fallbackToCacheTimeout: 0 });
    const eas = JSON.parse(ler("eas.json"));
    expect(eas.build.preview).toMatchObject({ distribution: "internal", channel: "preview", android: { buildType: "apk" } });
    expect(eas.build.production).toMatchObject({ channel: "production" });
  });

  it("os scripts do package.json são os definitivos — entram na fingerprint: mudá-los depois da build corta os updates", () => {
    expect(JSON.parse(ler("package.json")).scripts).toEqual({
      start: "expo start",
      android: "expo start --android",
      ios: "expo start --ios",
      web: "expo start --web",
      check: "tsc --noEmit",
      test: "cd .. && corepack pnpm exec vitest run src/lib/app-cliente",
      fingerprint: "expo-updates fingerprint:generate --platform android",
    });
  });

  it("os módulos nativos de toda a v1 já vão na 1.ª build (nada nativo chega depois)", () => {
    const dependencias = Object.keys(JSON.parse(ler("package.json")).dependencies);
    for (const m of [
      "expo-updates",
      "expo-notifications",
      "expo-device",
      "expo-image-picker",
      "expo-image-manipulator",
      "expo-file-system",
      "expo-secure-store",
      "expo-crypto",
      "expo-clipboard",
      "expo-web-browser",
      "@react-native-google-signin/google-signin",
      // A 2.ª build (A6, 29-10-2026): o degradé das maquetas v3 e a cor do sistema.
      "expo-linear-gradient",
      "expo-system-ui",
    ]) {
      expect(dependencias, m).toContain(m);
    }
    // A 2.ª build traz o Google ligado (o cliente OAuth Android existe desde 29-10-2026).
    expect(ler("src/componentes/Entrada.tsx")).toContain("export const GOOGLE_NESTA_VERSAO = true;");
  });

  it("as autorizações em português, com os textos da especificação; o ícone branco dos avisos", () => {
    const picker = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-image-picker")[1];
    expect(picker.cameraPermission).toBe("A CLYON usa a câmara para tirar fotografias do que precisa de levar.");
    expect(picker.photosPermission).toBe("A CLYON usa as fotografias que escolher para as juntar ao pedido.");
    expect(picker.microphonePermission).toBe(false);
    const avisos = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-notifications")[1];
    expect(avisos.icon).toBe("./assets/notification-icon.png");
  });

  it("os ficheiros que entram na fingerprint estão em LF (o CRLF muda-a)", () => {
    for (const f of ["app.json", "eas.json", "package.json"]) expect(ler(f).includes("\r"), f).toBe(false);
    expect(ler(".gitattributes")).toContain("* text=auto eol=lf");
  });

  it("os erros dos ecrãs vão para a rota do cliente (S3), limpos, com a versão e o id do update", () => {
    expect(ROTA_DO_ERRO_DA_APP).toBe("/api/cliente/erro-da-app");
    expect(versaoDaApp("0.1.0", "01a1741b-aaaa")).toBe("0.1.0 (01a1741b)");
    expect(versaoDaApp("0.1.0", null)).toBe("0.1.0 (base)");
    const c = corpoDoErro(new Error("falhou para ana@exemplo.pt 912345678"), "pedido/[id]", "0.1.0 (base)", new Date("2026-10-28T10:00:00Z"));
    expect(c.mensagem).not.toContain("ana@exemplo.pt");
    expect(c.mensagem).not.toContain("912345678");
    expect(ler("src/app/_layout.tsx")).toContain("export function ErrorBoundary");
  });
});

/* ─── As regras de todos os ecrãs (secção 2 e critérios 1, 2, 2a) ──────────── */

describe("as regras da língua e da voz, nos textos da app", () => {
  const TEXTOS = FONTES.flatMap((f) => textosDe(f).map((t) => ({ f: relativo(f), t })));

  it("lê os textos (controlo: as frases da especificação estão lá)", () => {
    expect(TEXTOS.some((x) => x.t === "Trocar de conta?")).toBe(true);
    expect(TEXTOS.some((x) => x.t.includes("Juntar este pedido à sua conta?"))).toBe(true);
  });

  it("sem «você», sem palavras do Brasil, sem «factur», sem promessas proibidas, voz de plataforma", () => {
    const proibidas = [
      /\bvoc[êe]s?\b/iu,
      /\bcelular/iu,
      /\btela\b/iu,
      /\bcadastr/iu,
      /\bbaixar\b/iu,
      /factur/iu,
      /pr[óo]prio dia/iu,
      /\bcontentor/iu,
      /big\s?bag/iu,
      /\ba CLYON (faz|executa|leva)\b/iu,
      /nossa equipa|nossos profissionais|profissionais da CLYON|a nossa proposta|\blevamos\b|vamos buscar/iu,
    ];
    const achados = TEXTOS.filter((x) => proibidas.some((re) => re.test(x.t)));
    expect(achados).toEqual([]);
  });

  it("«Hoje» nunca é uma opção", () => {
    expect(TEXTOS.filter((x) => /^hoje$/i.test(x.t))).toEqual([]);
  });

  it("a frase única não está escrita na app (vem da R7) e só aparece onde a v3 a pede: Início, contratar, Perfil e Como funciona", () => {
    expect(TEXTOS.filter((x) => x.t.includes("fazem o trabalho; a CLYON organiza"))).toEqual([]);
    const usam = FONTES.filter((f) => /\.textos\.fraseUnica/.test(readFileSync(f, "utf8"))).map(relativo).sort();
    expect(usam).toEqual(["src/app/(app)/index.tsx", "src/app/(app)/perfil.tsx", "src/app/info/[tema].tsx", "src/componentes/VistaDoPedido.tsx"]);
  });

  it("o número da CLYON é o de telefone-da-clyon.ts, nunca escrito à mão", () => {
    for (const f of FONTES) expect(readFileSync(f, "utf8"), relativo(f)).not.toMatch(/93\s?1\s?63\s?2\s?622|931632622/);
    expect(ler("src/lib/abrir.ts")).toContain('from "../../../src/lib/telefone-da-clyon"');
  });
});
