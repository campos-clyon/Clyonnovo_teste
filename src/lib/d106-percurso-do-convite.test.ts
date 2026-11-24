import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  aparelhoDoUserAgent,
  codigoValido,
  juntarAparelho,
  lerRegisto,
  linkDoConviteDaApp,
  resumoDosPercursos,
  textoLivreLimpo,
  ultimoPassoEmPalavras,
  type Percurso,
} from "./percurso-da-app-cliente";

/*
 * d106 (24-11-2026): o link nosso no convite da app de cliente, o aparelho,
 * o passo e o «Não consegui».
 */

const raiz = join(__dirname, "..", "..");
const ler = (p: string) => readFileSync(join(raiz, p), "utf8").replace(/\r\n/g, "\n");
/** O código sem os comentários de linha inteira (// e * de blocos). */
const semComentarios = (s: string) =>
  s
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");

const CODIGO = "AbCdEfGhIjKlMnOp";

describe("a classe do aparelho, pelo user-agent", () => {
  it("Android, iPhone, iPad, computador e o resto", () => {
    expect(aparelhoDoUserAgent("Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 Chrome/131 Mobile")).toBe("android");
    expect(aparelhoDoUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15")).toBe("iphone");
    expect(aparelhoDoUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("iphone");
    expect(aparelhoDoUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131")).toBe("pc");
    expect(aparelhoDoUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605")).toBe("pc");
    expect(aparelhoDoUserAgent("Mozilla/5.0 (X11; Linux x86_64) Firefox/133")).toBe("pc");
    expect(aparelhoDoUserAgent("curl/8.4")).toBe("outro");
    expect(aparelhoDoUserAgent("")).toBe("outro");
    expect(aparelhoDoUserAgent(null)).toBe("outro");
  });

  it("o iPad em modo computador (Macintosh com ecrã táctil) conta como iPhone", () => {
    expect(aparelhoDoUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("iphone");
  });

  it("as classes juntam-se sem repetir", () => {
    expect(juntarAparelho(null, "pc")).toBe("pc");
    expect(juntarAparelho("pc", "android")).toBe("pc,android");
    expect(juntarAparelho("pc,android", "pc")).toBe("pc,android");
    expect(juntarAparelho("lixo,pc", "iphone")).toBe("pc,iphone");
  });
});

describe("o link do convite", () => {
  it("é nosso, com o código opaco, e nunca leva o email", () => {
    const l = linkDoConviteDaApp("https://clyon.pt/", CODIGO);
    expect(l).toBe(`https://clyon.pt/app-cliente?c=${CODIGO}`);
    expect(l).not.toContain("@");
    expect(l).not.toContain("play.google.com");
  });

  it("sem código (ou com um que não serve), a mesma página sem registo", () => {
    expect(linkDoConviteDaApp("https://clyon.pt", null)).toBe("https://clyon.pt/app-cliente");
    expect(linkDoConviteDaApp("https://clyon.pt", "nome@gmail.com")).toBe("https://clyon.pt/app-cliente");
  });

  it("o código: base64url, 16 a 32 caracteres", () => {
    expect(codigoValido(CODIGO)).toBe(true);
    expect(codigoValido("curto")).toBe(false);
    expect(codigoValido("a@b.pt-aaaaaaaaaaaaaa")).toBe(false);
    expect(codigoValido(123)).toBe(false);
  });
});

describe("o que a página manda", () => {
  it("abriu, passo e «Não consegui»", () => {
    expect(lerRegisto({ c: CODIGO, accao: "abriu" })).toEqual({ codigo: CODIGO, registo: { accao: "abriu" } });
    expect(lerRegisto({ c: CODIGO, accao: "passo", passo: 3 })).toEqual({ codigo: CODIGO, registo: { accao: "passo", passo: 3 } });
    expect(lerRegisto({ c: CODIGO, accao: "nao-consegui", passo: 3, motivo: "outro", texto: "  diz que não há acesso  " })).toEqual({
      codigo: CODIGO,
      registo: { accao: "nao-consegui", passo: 3, motivo: "outro", texto: "diz que não há acesso" },
    });
  });

  it("o resto não se grava", () => {
    expect(lerRegisto(null)).toBeNull();
    expect(lerRegisto({ accao: "abriu" })).toBeNull();
    expect(lerRegisto({ c: "x", accao: "abriu" })).toBeNull();
    expect(lerRegisto({ c: CODIGO, accao: "passo", passo: 9 })).toBeNull();
    expect(lerRegisto({ c: CODIGO, accao: "nao-consegui", passo: 2, motivo: "inventado" })).toBeNull();
    expect(lerRegisto({ c: CODIGO, accao: "apagar" })).toBeNull();
    // Cada passo só aceita as suas opções (v3); as palavras livres só no «Outro».
    expect(lerRegisto({ c: CODIGO, accao: "nao-consegui", passo: 1, motivo: "sem-acesso" })).toBeNull();
    expect(lerRegisto({ c: CODIGO, accao: "nao-consegui", passo: 3, motivo: "sem-acesso", texto: "olá" })?.registo).toEqual({
      accao: "nao-consegui",
      passo: 3,
      motivo: "sem-acesso",
      texto: null,
    });
    expect(lerRegisto({ c: CODIGO, accao: "resposta", r: 4 })).toBeNull();
  });

  it("as opções de cada passo e as respostas são as da v3", async () => {
    const m = await import("./percurso-da-app-cliente");
    expect(m.MOTIVOS_POR_PASSO[1].map((x) => m.ROTULOS_DO_MOTIVO[x])).toEqual(["Não tenho Android", "Não percebo para que serve", "Outro"]);
    expect(m.MOTIVOS_POR_PASSO[3].map((x) => m.ROTULOS_DO_MOTIVO[x])).toEqual([
      "Diz que não tenho acesso",
      "Abri no computador",
      "A página não abre",
      "Outro",
    ]);
    // O rótulo real do botão da app (app-cliente/src/componentes/Entrada.tsx).
    expect(m.RESPOSTAS_DO_NAO_CONSEGUI["entrar-na-conta"]).toContain("«Prefiro receber uma ligação por email»");
    const entrada = ler("app-cliente/src/componentes/Entrada.tsx");
    expect(entrada).toContain('titulo="Prefiro receber uma ligação por email"');
    expect(m.TEXTOS_DO_NAO_CONSEGUI.iphone).toBe(
      "Ainda não há app CLYON para iPhone. No site faz tudo na sua conta. Obrigado: não lhe voltamos a falar da app.",
    );
  });

  it("«SEM APP» na conversa (ponto de leitura para a Vitória)", async () => {
    const { eRespostaSemApp } = await import("./percurso-da-app-cliente");
    expect(eRespostaSemApp("SEM APP")).toBe(true);
    expect(eRespostaSemApp("sem a app, obrigado")).toBe(true);
    expect(eRespostaSemApp("não")).toBe(false);
    expect(eRespostaSemApp("semapp")).toBe(false);
  });

  it("as palavras livres: sem emails nem telefones, cortadas", () => {
    expect(textoLivreLimpo("o meu é nome.apelido@gmail.com")).toBe("o meu é [email]");
    expect(textoLivreLimpo("liguem 912 345 678 por favor")).toBe("liguem [número] por favor");
    expect(textoLivreLimpo("a".repeat(500))?.length).toBe(200);
    expect(textoLivreLimpo("   ")).toBeNull();
    expect(textoLivreLimpo(42)).toBeNull();
  });
});

const percurso = (p: Partial<Percurso>): Percurso => ({
  email: "x@gmail.com",
  criadoEm: null,
  cliqueEm: null,
  cliques: 0,
  aparelho: null,
  aparelhos: [],
  passo: null,
  passoEm: null,
  naoConsegui: null,
  ...p,
});

describe("o que o backoffice mostra", () => {
  it("o último passo, por palavras", () => {
    expect(ultimoPassoEmPalavras(null)).toBe("—");
    expect(ultimoPassoEmPalavras(percurso({}))).toBe("Convite enviado, ainda sem clique");
    expect(ultimoPassoEmPalavras(percurso({ cliques: 1, aparelho: "iphone", aparelhos: ["iphone"] }))).toBe("Clicou (iPhone)");
    expect(ultimoPassoEmPalavras(percurso({ cliques: 2, aparelho: "android", passo: 3 }))).toContain("Chegou ao passo 3");
    expect(
      ultimoPassoEmPalavras(percurso({ cliques: 1, passo: 2, naoConsegui: { passo: 2, motivo: "conta-google", texto: null, em: null } })),
    ).toBe("Não conseguiu no passo 2 (O Gmail): Não sei qual é a conta Google do telemóvel");
  });

  it("o resumo: cliques, % iPhone e computador, motivos por passo", () => {
    const r = resumoDosPercursos([
      percurso({}),
      percurso({ cliques: 1, aparelhos: ["iphone"] }),
      percurso({ cliques: 3, aparelhos: ["pc", "android"], naoConsegui: { passo: 3, motivo: "sem-acesso", texto: null, em: null } }),
      percurso({ cliques: 1, aparelhos: ["android"], naoConsegui: { passo: 3, motivo: "sem-acesso", texto: null, em: null } }),
    ]);
    expect(r.comLink).toBe(4);
    expect(r.clicaram).toBe(3);
    expect(r.porAparelho).toEqual({ android: 2, iphone: 1, pc: 1, outro: 0 });
    expect(r.percentIphone).toBe(33);
    expect(r.percentPc).toBe(33);
    expect(r.motivos).toEqual([{ passo: 3, motivo: "sem-acesso", n: 2 }]);
  });
});

/* ─── Gravar o passo e o motivo (a base de mentira) ─────────────────────── */

const chamadas: Array<{ sql: string; params: unknown[] }> = [];
vi.mock("./db", () => ({
  getPool: async () => ({
    execute: async (sql: string, params: unknown[] = []) => {
      chamadas.push({ sql, params });
      if (/^\s*SELECT codigo/.test(sql)) return [[{ codigo: CODIGO }], []];
      return [{ affectedRows: 1 }, []];
    },
    query: async () => [[], []],
  }),
}));

describe("gravar na base", () => {
  beforeEach(() => {
    chamadas.length = 0;
  });

  it("o clique grava a classe do aparelho, e só ela, num código que ainda vale", async () => {
    const { registarNoPercurso } = await import("./percurso-da-app-cliente-na-base");
    await registarNoPercurso(CODIGO, { accao: "abriu" }, "iphone");
    const u = chamadas.find((c) => c.sql.includes("UPDATE percursoDoConviteDaApp"));
    expect(u?.sql).toContain("cliques = LEAST(cliques + 1");
    expect(u?.sql).toContain("caducaEm > UTC_TIMESTAMP()");
    expect(u?.params).toEqual(["iphone", "iphone", "iphone", "iphone", CODIGO]);
    // v3: «Obrigado: não lhe voltamos a falar da app» — o iPhone sai de tudo o que é sobre a app.
    expect(chamadas.some((c) => c.sql.includes("SET semAppEm = COALESCE(semAppEm"))).toBe(true);
  });

  it("o r=3 do lembrete ({LINK_RECUSA}) grava a resposta e tira a pessoa das mensagens sobre a app", async () => {
    const { registarNoPercurso } = await import("./percurso-da-app-cliente-na-base");
    const lido = lerRegisto({ c: CODIGO, accao: "resposta", r: 3 });
    expect(lido).toEqual({ codigo: CODIGO, registo: { accao: "resposta", r: 3 } });
    await registarNoPercurso(lido!.codigo, lido!.registo, "android");
    expect(chamadas.find((c) => c.sql.includes("SET resposta = ?"))?.params).toEqual([3, CODIGO]);
    expect(chamadas.some((c) => c.sql.includes("SET semAppEm = COALESCE(semAppEm"))).toBe(true);
  });

  it("o r=1 grava a resposta e não tira ninguém", async () => {
    const { registarNoPercurso } = await import("./percurso-da-app-cliente-na-base");
    await registarNoPercurso(CODIGO, { accao: "resposta", r: 1 }, "android");
    expect(chamadas.some((c) => c.sql.includes("SET semAppEm"))).toBe(false);
  });

  it("o «Não consegui» grava o passo, o motivo e as palavras limpas", async () => {
    const { registarNoPercurso } = await import("./percurso-da-app-cliente-na-base");
    const lido = lerRegisto({ c: CODIGO, accao: "nao-consegui", passo: 2, motivo: "outro", texto: "uso o a@b.pt" });
    expect(lido).not.toBeNull();
    await registarNoPercurso(lido!.codigo, lido!.registo, "android");
    const u = chamadas.find((c) => c.sql.includes("naoConseguiMotivo = ?"));
    expect(u?.params).toEqual([2, 2, "outro", "uso o [email]", CODIGO]);
  });

  it("o passo só anda para a frente", async () => {
    const { registarNoPercurso } = await import("./percurso-da-app-cliente-na-base");
    await registarNoPercurso(CODIGO, { accao: "passo", passo: 3 }, "android");
    expect(chamadas.find((c) => c.sql.includes("passo = GREATEST"))?.params).toEqual([3, CODIGO]);
  });

  it("o link do convite leva o código da pessoa, não o email", async () => {
    const { linkNossoDoConvite, codigoNovo } = await import("./percurso-da-app-cliente-na-base");
    const l = await linkNossoDoConvite("Nome@Gmail.com", 12);
    expect(l.endsWith(`/app-cliente?c=${CODIGO}`)).toBe(true);
    expect(l.toLowerCase()).not.toContain("nome@gmail.com");
    const ins = chamadas.find((c) => c.sql.includes("INSERT INTO percursoDoConviteDaApp"));
    expect(ins?.params[0]).toBe("nome@gmail.com");
    const novo = codigoNovo();
    expect(codigoValido(novo)).toBe(true);
    expect(novo).toHaveLength(16);
  });
});

/* ─── O código-fonte: os sítios por onde o convite sai ──────────────────── */

describe("o convite, o lembrete e o WhatsApp levam o link nosso", () => {
  it("o convite novo e o do Gmail: um link por pessoa", () => {
    const s = semComentarios(ler("src/app/api/admin/convite-app-cliente/route.ts"));
    expect(s.match(/link: await linkNossoDoConvite\(d\.email, d\.id\)/g)?.length).toBe(2);
    expect(s).not.toMatch(/enviarConviteDaApp\(\{ para: d\.email, nome: d\.nome, link \}\)/);
    expect(s).toContain("naoContactarNaApp");
  });

  it("o lembrete e o WhatsApp: o mesmo link, e o «não contactar»", () => {
    const l = semComentarios(ler("src/lib/lembrete-da-app.ts"));
    expect(l).toContain("link: await linkNossoDoConvite(c.email)");
    expect(l).toContain("naoContactarNaApp");
    const w = semComentarios(ler("src/lib/convite-novo-da-app-na-base.ts"));
    expect(w).toContain("const link = await linkNossoDoConvite(p.email)");
    expect(w).toContain("naoContactarNaApp");
  });

  it("NADA se envia sozinho (24-11-2026): o grupo de 17/11, o lembrete e o «Já pode instalar» desligados", async () => {
    const textos = await import("./textos-do-seguimento-da-app");
    expect(textos.ENVIOS_AO_GRUPO_DE_17_11_LIGADOS).toBe(false);
    expect(textos.LEMBRETE_DA_APP_LIGADO).toBe(false);
    expect(textos.AVISO_JA_PODE_INSTALAR_LIGADO).toBe(false);
    const rota = semComentarios(ler("src/app/api/admin/convite-app-cliente/route.ts"));
    expect(rota).toContain("!ENVIOS_AO_GRUPO_DE_17_11_LIGADOS");
    const fila = semComentarios(ler("src/lib/convite-novo-da-app-na-base.ts"));
    expect(fila).toContain("textos.ENVIOS_AO_GRUPO_DE_17_11_LIGADOS");
  });

  it("o aviso «Já pode instalar» existe para a app de cliente, só a quem nos deu o Gmail", { timeout: 60_000 }, async () => {
    const r = semComentarios(ler("src/app/api/admin/quem-conta-para-os-12/route.ts"));
    expect(r).toContain("avisarClientesQueEntraramNaListaDaPlay(emailsDaListaColada(lista))");
    const { deuOGmail } = await import("./lista-da-play-avisos-na-base");
    expect(deuOGmail("Programa: adicionado à Play")).toBe(true);
    expect(deuOGmail("Recebeu o convite")).toBe(false);
    expect(deuOGmail("Abriu a app")).toBe(false);
  });

  it("os textos v3 sem as linhas [SÓ COM AVISOS] e com «em teste», nunca «acesso antecipado»", async () => {
    const textos = await import("./textos-do-seguimento-da-app");
    const tudo = JSON.stringify(textos);
    expect(tudo).not.toMatch(/recebe um aviso/);
    expect(tudo).not.toMatch(/acesso antecipado/);
    expect(tudo).not.toMatch(/Responda NÃO/);
    expect(textos.TEXTO_DO_AVISO_JA_PODE_INSTALAR_POR_WHATSAPP).toContain("responda SEM APP.");
  });

  it("o email do lembrete: três botões com r=1, r=2 e r=3 e a recusa", async () => {
    const { montarEmailDaApp } = await import("./email-da-app-de-cliente");
    const { MODELO_DO_LEMBRETE_POR_EMAIL } = await import("./textos-do-seguimento-da-app");
    const l = `https://clyon.pt/app-cliente?c=${CODIGO}`;
    const m = montarEmailDaApp(MODELO_DO_LEMBRETE_POR_EMAIL, { nome: "Rui", link: l });
    expect(m.texto).toContain(`Tentei e não consegui: ${l}&r=1`);
    expect(m.texto).toContain(`Não tenho Android: ${l}&r=2`);
    expect(m.texto).toContain(`Não me interessa: ${l}&r=3`);
    expect(m.html).toContain(`>Não me interessa</a>`);
    expect(m.texto.startsWith("Olá, Rui.")).toBe(true);
  });

  it("aos profissionais e à equipa (secção 6): a frase dos pedidos só aos profissionais", async () => {
    const { modeloDoConviteAosVoluntarios, modeloDoLembreteAosVoluntarios } = await import("./textos-do-seguimento-da-app");
    expect(JSON.stringify(modeloDoConviteAosVoluntarios("profissional"))).toContain("não muda nada nos pedidos que recebe");
    expect(JSON.stringify(modeloDoConviteAosVoluntarios("equipa"))).not.toContain("pedidos que recebe");
    expect(JSON.stringify(modeloDoLembreteAosVoluntarios("equipa"))).not.toContain("pedidos que recebe");
  });
});

describe("os dados: o mínimo, e por pouco tempo", () => {
  it("a tabela não guarda o user-agent nem o IP", async () => {
    const { SQL_DA_TABELA_DO_PERCURSO } = await import("./percurso-da-app-cliente-na-base");
    expect(SQL_DA_TABELA_DO_PERCURSO).not.toMatch(/userAgent|user_agent|\bip\b|ipAddress/i);
  });

  it("a rota responde sempre o mesmo e tem travão", () => {
    const s = semComentarios(ler("src/app/api/app-cliente/percurso/route.ts"));
    expect(s).toContain("limitarRotaPublica");
    expect(s).toContain("limitarPorConta");
    expect(s.match(/NextResponse\.json\(RESPOSTA/g)?.length).toBe(2);
  });

  it("a purga apaga o percurso com prazo próprio em retencao.ts", async () => {
    const { DIAS_DO_PERCURSO_DO_CONVITE_DA_APP } = await import("./retencao");
    expect(DIAS_DO_PERCURSO_DO_CONVITE_DA_APP).toBe(90);
    const p = semComentarios(ler("src/app/api/cron/purgar-pedidos/route.ts"));
    expect(p).toContain("purgarPercursosDaApp(DIAS_DO_PERCURSO_DO_CONVITE_DA_APP, { aSerio: armada })");
  });

  it("apagar a conta apaga o percurso", () => {
    const s = semComentarios(ler("src/lib/convite-novo-da-app-na-base.ts"));
    expect(s).toContain('"percursoDoConviteDaApp"');
    expect(s).toContain("DELETE FROM percursoDoConviteDaApp WHERE userId = ?");
  });

  it("quem cancela fica também com o email no «não contactar»", () => {
    const s = semComentarios(ler("src/lib/cancelar-pelo-cliente-na-base.ts"));
    expect(s).toContain("marcarEmailParaNaoContactar(p.contactEmail");
  });
});
