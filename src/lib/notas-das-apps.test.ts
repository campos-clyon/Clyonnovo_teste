import { beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { NextRequest } from "next/server";
import { notaDaAtualizacao, notasDaApp, type NotaDaApp } from "./notas-das-apps";
import * as novidadesPro from "../../app-pro/src/lib/novidades";
import * as novidadesCliente from "../../app-cliente/src/lib/novidades";

vi.mock("@/lib/limite-rota-publica", () => ({ limitarRotaPublica: async () => ({ erro: null }) }));

/**
 * CADA ATUALIZAÇÃO DAS APPS DIZ O QUE TRAZ — d23, ordem do CEO com o sim do
 * dono (13-11-2026). A lista única (notas-das-apps.json), a rota pública, a
 * regra «nenhuma atualização sai sem nota» nos dois caminhos de publicar, e
 * as duas apps a mostrarem a nota antes e depois de reiniciar.
 */

const RAIZ = process.cwd();
const ler = (f: string) => readFileSync(join(RAIZ, f), "utf8").replace(/\r\n/g, "\n");
const NOTAS = "src/lib/notas-das-apps.json";
const SCRIPT = "scripts/nota-da-app.mjs";
const pasta = mkdtempSync(join(tmpdir(), "notas-das-apps-"));
let n = 0;
function ficheiro(conteudo: unknown): string {
  const p = join(pasta, `notas-${n++}.json`);
  writeFileSync(p, conteudo === "" ? "" : JSON.stringify(conteudo));
  return p;
}
/** Corre a mesma porta que a Action e o publicar da Pro correm (o processo inteiro: lento, por isso poucas vezes). */
function portaPelaLinha(app: string, antes: string, agora: string) {
  const r = spawnSync(process.execPath, [SCRIPT, app, antes, agora], { cwd: RAIZ, encoding: "utf8" });
  return { ok: r.status === 0, id: r.stdout.trim(), motivo: r.stderr.trim() };
}
type Porta = { notaParaPublicar(app: string, antes: unknown, agora: unknown): { ok: true; id: string } | { ok: false; motivo: string } };
let modulo: Porta;
beforeAll(async () => {
  modulo = (await import(pathToFileURL(join(RAIZ, SCRIPT)).href)) as Porta;
});
/** A mesma função, sem lançar um processo: lê os dois ficheiros como o script. */
function porta(app: string, antes: string, agora: string) {
  const lerF = (f: string) => {
    const t = readFileSync(f, "utf8").trim();
    return t ? JSON.parse(t) : null;
  };
  let a: unknown, b: unknown;
  try {
    a = lerF(antes);
    b = lerF(agora);
  } catch (e) {
    return { ok: false, id: "", motivo: String(e) };
  }
  if (!b) return { ok: false, id: "", motivo: "sem notas" };
  const r = modulo.notaParaPublicar(app, a, b);
  return r.ok ? { ok: true, id: r.id, motivo: "" } : { ok: false, id: "", motivo: r.motivo };
}
const nota = (id: string, texto: string, updates: string[] = []): NotaDaApp => ({ id, nota: texto, updates });
const BOA = "Agora cada atualização diz o que traz, antes de reiniciar e logo a seguir.";
const UUID_A = "019a1f2e-1111-7aaa-8bbb-0123456789ab";
const UUID_B = "019a1f2e-2222-7aaa-8bbb-0123456789ab";

describe("a lista única das notas", () => {
  it("as notas de agora passam a porta das duas apps (a primeira de cada é a mais recente)", () => {
    for (const app of ["pro", "cliente"]) {
      const r = portaPelaLinha(app, ficheiro(""), join(RAIZ, NOTAS));
      expect(r.motivo).toBe("");
      expect(r.ok).toBe(true);
      expect(r.id).toBe(notasDaApp(app as "pro" | "cliente")[0].id);
    }
  });

  it("a primeira nota real (d23) diz que cada atualização passa a dizer o que traz", () => {
    expect(notasDaApp("pro").at(-1)?.nota).toMatch(/cada atualização diz o que traz/);
    expect(notasDaApp("cliente").at(-1)?.nota).toMatch(/cada atualização diz o que traz/);
  });
});

describe("nenhuma atualização sai sem nota (scripts/nota-da-app.mjs)", () => {
  const agora = { pro: [nota("pro-2026-11-20", BOA), nota("pro-2026-11-13", BOA)], cliente: [nota("cliente-2026-11-13", BOA)] };

  it("passa com uma nota nova desde a última publicada, e diz o id", () => {
    const antes = { pro: [nota("pro-2026-11-13", BOA)], cliente: [nota("cliente-2026-11-13", BOA)] };
    expect(porta("pro", ficheiro(antes), ficheiro(agora))).toMatchObject({ ok: true, id: "pro-2026-11-20" });
  });

  it("chumba quando a nota mais recente já foi com a anterior — mudar a app sem nota não publica", () => {
    const r = portaPelaLinha("cliente", ficheiro(agora), ficheiro(agora));
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/já foi com a atualização anterior/);
  });

  it("chumba sem notas, com o JSON partido, ou com uma app desconhecida", () => {
    expect(porta("pro", ficheiro(""), ficheiro({ cliente: agora.cliente })).ok).toBe(false);
    const partido = join(pasta, "partido.json");
    writeFileSync(partido, "{ isto não é json");
    expect(portaPelaLinha("pro", ficheiro(""), partido).ok).toBe(false);
    expect(porta("web", ficheiro(""), ficheiro(agora)).ok).toBe(false);
  });

  it("a nota é para quem usa a app: uma ou duas linhas, sem palavras técnicas, PT-PT, e a palavra certa de cada app", () => {
    const casos: Array<[string, string]> = [
      ["pro", "Corrigimos um bug na agenda."],
      ["pro", "Nova build com o EAS."],
      ["pro", "Agora você vê a agenda."],
      ["pro", "O parceiro vê a agenda melhor."],
      ["cliente", "O profissional responde mais depressa."],
      ["cliente", "Uma linha.\nOutra linha.\nUma terceira linha."],
      ["cliente", "x".repeat(221)],
      ["cliente", "curta"],
    ];
    for (const [app, texto] of casos) {
      const r = porta(app, ficheiro(""), ficheiro({ [app]: [nota(`${app}-2026-11-20`, texto)] }));
      expect(r.ok, `${app}: ${texto.slice(0, 40)}`).toBe(false);
    }
    expect(porta("cliente", ficheiro(""), ficheiro({ cliente: [nota("cliente-2026-11-20", "O parceiro responde mais depressa.\nE o pagamento ficou mais claro.")] })).ok).toBe(true);
  });

  it("o id é «<app>-AAAA-MM-DD» (e «-2» no mesmo dia), sem repetir; «updates» são ids de atualização", () => {
    const mal = [
      { pro: [nota("cliente-2026-11-20", BOA)] },
      { pro: [nota("pro-13-11", BOA)] },
      { pro: [nota("pro-2026-11-20", BOA), nota("pro-2026-11-20", BOA)] },
      { pro: [nota("pro-2026-11-20", BOA, ["abc"])] },
    ];
    for (const m of mal) expect(porta("pro", ficheiro(""), ficheiro(m)).ok, JSON.stringify(m)).toBe(false);
    expect(porta("pro", ficheiro(""), ficheiro({ pro: [nota("pro-2026-11-20-2", BOA, [UUID_A])] })).ok).toBe(true);
  });
});

describe("a nota de uma atualização (a rota resolve pelo id do manifest)", () => {
  const lista = [nota("pro-2026-11-20", "A mais recente."), nota("pro-2026-11-13", "A de antes.", [UUID_A])];

  it("o id que está em «updates» dá essa nota (exacta)", () => {
    expect(notaDaAtualizacao("pro", UUID_A, lista)).toEqual({ id: "pro-2026-11-13", nota: "A de antes.", exacta: true });
    expect(notaDaAtualizacao("pro", UUID_A.toUpperCase(), lista)?.id).toBe("pro-2026-11-13");
  });

  it("um id desconhecido, inválido ou nenhum dá a mais recente — a da última publicada", () => {
    for (const id of [UUID_B, "nao-e-um-id", null, undefined, ""]) {
      expect(notaDaAtualizacao("pro", id, lista)).toEqual({ id: "pro-2026-11-20", nota: "A mais recente.", exacta: false });
    }
    expect(notaDaAtualizacao("pro", UUID_A, [])).toBeNull();
  });

  it("GET /api/apps/notas: pública, só a nota, com cache curta", async () => {
    const { GET } = await import("@/app/api/apps/notas/route");
    const r = await GET(new NextRequest(`https://clyon.pt/api/apps/notas?app=cliente&update=${UUID_B}`));
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(Object.keys(corpo).sort()).toEqual(["app", "exacta", "id", "nota"]);
    expect(corpo).toMatchObject({ app: "cliente", id: notasDaApp("cliente")[0].id, exacta: false });
    expect(r.headers.get("Cache-Control")).toMatch(/max-age=60/);
    for (const q of ["", "?app=web", "?app=pro%20"]) {
      expect((await GET(new NextRequest(`https://clyon.pt/api/apps/notas${q}`))).status).toBe(400);
    }
  });
});

describe("as duas apps mostram a nota", () => {
  it("o mesmo caminho da rota, com o id do manifest só quando é um id", () => {
    expect(existsSync(join(RAIZ, "src/app/api/apps/notas/route.ts"))).toBe(true);
    expect(novidadesPro.caminhoDaNota("pro", UUID_A)).toBe(`/api/apps/notas?app=pro&update=${UUID_A}`);
    expect(novidadesCliente.caminhoDaNota("cliente", null)).toBe("/api/apps/notas?app=cliente");
    expect(novidadesPro.caminhoDaNota("pro", "../x")).toBe("/api/apps/notas?app=pro");
  });

  it("cada app guarda o último visto na sua chave", () => {
    expect(novidadesPro.CHAVE_DA_NOVIDADE).not.toBe(novidadesCliente.CHAVE_DA_NOVIDADE);
    for (const m of [novidadesPro, novidadesCliente]) {
      const v = { u: UUID_A, n: "pro-2026-11-13" };
      expect(m.lerVista(m.textoDaVista(v))).toEqual(v);
      expect(m.lerVista("{partido")).toBeNull();
      expect(m.lerVista(null)).toBeNull();
    }
  });

  it("o cartão «O que há de novo» aparece UMA vez, e nunca na versão da loja", () => {
    for (const m of [novidadesPro, novidadesCliente]) {
      // A da loja (sem atualização): nada.
      expect(m.pedirNotaAoArrancar(null, UUID_A, true)).toBe(false);
      expect(m.pedirNotaAoArrancar(null, null, false)).toBe(false);
      // Uma atualização que ainda não se tratou: pede-se a nota.
      expect(m.pedirNotaAoArrancar(null, UUID_A, false)).toBe(true);
      expect(m.pedirNotaAoArrancar({ u: UUID_B, n: "x" }, UUID_A, false)).toBe(true);
      // Já tratada: nada.
      expect(m.pedirNotaAoArrancar({ u: UUID_A, n: "x" }, UUID_A, false)).toBe(false);
      const recebida = { id: "pro-2026-11-20", nota: BOA };
      expect(m.depoisDeLerANota(null, UUID_A, recebida)).toEqual({ mostrar: true, guardar: { u: UUID_A, n: "pro-2026-11-20" } });
      // Viu-a antes de reiniciar (na faixa ou no aviso): não se repete.
      expect(m.depoisDeLerANota({ u: null, n: "pro-2026-11-20" }, UUID_A, recebida).mostrar).toBe(false);
      expect(m.lerNota({ id: "x", nota: "  " })).toBeNull();
      expect(m.lerNota({ nota: BOA })).toBeNull();
      expect(m.lerNota({ id: "pro-2026-11-20", nota: BOA, outra: 1 })).toEqual(recebida);
    }
  });

  for (const app of ["app-pro", "app-cliente"]) {
    it(`${app}: a faixa e o aviso da versão nova mostram a nota; a inicial tem o cartão`, () => {
      for (const f of ["VersaoNova.tsx", "ActualizacaoAutomatica.tsx"]) {
        const s = ler(`${app}/src/componentes/${f}`);
        expect(s, f).toMatch(/useNotaDaAtualizacao\(/);
        expect(s, f).toMatch(/downloadedUpdate\?\.updateId \?\? availableUpdate\?\.updateId/);
        expect(s, f).toMatch(/marcarNotaVista\(updateId, nota\)/);
      }
      // Sem rede, o aviso fica com a frase de sempre.
      expect(ler(`${app}/src/componentes/ActualizacaoAutomatica.tsx`)).toMatch(/\{nota \? `\$\{nota\.nota\} Demora só uns segundos\.` : "[^"]+"\}/);
      const inicio = ler(`${app}/src/app/(app)/index.tsx`);
      expect(inicio).toMatch(/<VersaoNova \/>\n\s*<OQueHaDeNovo \/>/);
      const nov = ler(`${app}/src/componentes/Novidades.tsx`);
      expect(nov).toContain(`caminhoDaNota("${app === "app-pro" ? "pro" : "cliente"}", updateId)`);
      expect(nov).toContain("TITULO_DA_NOVIDADE");
      // A Pro tem modo escuro: cores do tema, nunca hex à mão.
      if (app === "app-pro") {
        expect(nov).toContain("useCores()");
        expect(nov).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      }
    });
  }
});

describe("os dois caminhos de publicar exigem a nota", () => {
  const yml = ler(".github/workflows/atualizar-app-cliente.yml").replace(/^[ \t]*#.*$/gm, "");
  const mudou = yml.slice(yml.indexOf("\n  mudou:"), yml.indexOf("\n  publicar:"));
  const publicar = yml.slice(yml.indexOf("\n  publicar:"), yml.indexOf("\n  marcar:"));

  it("a Action da app de cliente: a porta corre antes de publicar, no trabalho sem segredo, e a nota vai na mensagem", () => {
    expect(mudou).toMatch(/- name: A nota desta atualização\n\s+id: nota\n\s+if: \$\{\{ steps\.mudou\.outputs\.sim == '1' \}\}/);
    expect(mudou).toMatch(/git show "\$ETIQUETA:src\/lib\/notas-das-apps\.json"/);
    expect(mudou).toMatch(/node scripts\/nota-da-app\.mjs cliente "\$antes" src\/lib\/notas-das-apps\.json/);
    expect(mudou).toMatch(/nota: \$\{\{ steps\.nota\.outputs\.id \}\}/);
    expect(publicar.match(/NOTA: \$\{\{ needs\.mudou\.outputs\.nota \}\}/g)?.length).toBe(2);
    expect(publicar.match(/mensagem="\[nota:\$NOTA\] /g)?.length).toBe(2);
    expect(publicar.match(/grep -Eq '\^cliente-/g)?.length).toBe(2);
  });

  it("o publicar da Pro: a fingerprint da build, a porta, e a nota na mensagem", () => {
    const s = ler("scripts/publicar-app-pro.mjs");
    const daBuild = ler("app-pro/LEIA-ME.md").match(/hoje `([0-9a-f]{40})`/)?.[1];
    expect(daBuild).toBeTruthy();
    expect(s).toContain(`FINGERPRINT_DA_BUILD = "${daBuild}"`);
    expect(s).toMatch(/"scripts\/nota-da-app\.mjs", "pro", antes, NOTAS\]/);
    expect(s).toMatch(/if \(gate\.status !== 0\) parar\(/);
    expect(s).toContain("const mensagem = `[nota:${nota}] ${assunto}`;");
    expect(s).toMatch(/EAS_CLI = "eas-cli@\d+\.\d+\.\d+"/);
    // A porta vem antes de publicar.
    expect(s.indexOf("gate.status !== 0")).toBeLessThan(s.indexOf('"update", "--channel", "production"'));
  });

  /*
   * Onde há as etiquetas (numa worktree com elas; a CI tira o repositório sem
   * etiquetas e salta): se a app mudou desde a última publicada, a porta tem
   * de passar JÁ, antes de alguém tentar publicar.
   */
  for (const [app, etiqueta, pastaDaApp] of [
    ["cliente", "app-cliente-publicada", "app-cliente/"],
    ["pro", "app-pro-publicada", "app-pro/"],
  ] as const) {
    it(`a app «${app}» mudou desde ${etiqueta}? Então já tem nota nova`, () => {
      let mudou = "";
      let antes = "";
      try {
        execFileSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${etiqueta}`], { cwd: RAIZ, stdio: "ignore" });
        mudou = execFileSync("git", ["diff", "--name-only", etiqueta, "HEAD", "--", pastaDaApp], { cwd: RAIZ, encoding: "utf8" }).trim();
        try {
          antes = execFileSync("git", ["show", `${etiqueta}:${NOTAS}`], { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
        } catch {
          antes = "";
        }
      } catch {
        return; // sem a etiqueta aqui
      }
      if (!mudou) return;
      const f = join(pasta, `etiqueta-${app}.json`);
      writeFileSync(f, antes);
      const r = portaPelaLinha(app, f, join(RAIZ, NOTAS));
      expect(r.motivo).toBe("");
      expect(r.ok).toBe(true);
    });
  }
});
