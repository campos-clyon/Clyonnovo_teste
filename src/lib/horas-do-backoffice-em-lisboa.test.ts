import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

/*
 * AS HORAS DO BACKOFFICE E DO PAINEL DO PROFISSIONAL SÃO AS DE LISBOA — 26-10-2026.
 *
 * Regra do dono: todas as horas do site e do backoffice em hora de Lisboa,
 * nunca a do navegador. Ele está em França: nos Levantamentos, um pedido das
 * 14h20 de Lisboa aparecia «15h20» (`getHours()` no fuso do computador), e o
 * «há quantos dias está à espera» contava a partir da meia-noite de Paris.
 *
 * Duas guardas:
 *  1. o que os Levantamentos mostram, corrido num Node à parte com o fuso do
 *     processo em Europe/Paris (e em UTC, como o servidor), dá a hora de Lisboa;
 *  2. nas pastas do backoffice e do painel do profissional, nenhum
 *     `getHours()`/`getDate()`/… e nenhum `toLocale…String`/`Intl.DateTimeFormat`
 *     de datas sem `timeZone` explícito. O script no `<head>`
 *     (`relogio-de-lisboa.ts`) já cobre os `toLocale…` sem fuso, mas a regra é
 *     dizê-lo em cada chamada, igual no servidor e no navegador.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const paraJs = (fonte: string) =>
  ts.transpileModule(fonte, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

describe("os Levantamentos mostram a hora de Lisboa, seja qual for o fuso do processo", () => {
  const PAINEL = ler("src/components/admin/AdminLevantamentosPanel.tsx");
  const ini = PAINEL.indexOf("function quandoCurto(");
  const fim = PAINEL.indexOf("const CHAVE_DO_AGRUPAMENTO");

  it("as duas funções estão onde se espera", () => {
    expect(ini).toBeGreaterThan(-1);
    expect(fim).toBeGreaterThan(ini);
    const corpo = PAINEL.slice(ini, fim);
    expect(corpo).toContain("function diasDesde(");
    expect(corpo).toMatch(/diaMesEHoraEmLisboa\(/);
    expect(corpo).toMatch(/diasDeCalendarioEmLisboa\(/);
  });

  /*
   * O código corre num Node à parte: no processo dos testes o fuso pode ser
   * qualquer um, e mudar o TZ a meio não é de confiança. Lá dentro, o «agora»
   * fica parado em 25-10-2026 às 10h00 UTC (11h00 em Paris, 10h00 em Lisboa —
   * já depois da mudança da hora).
   */
  function correrCom(tz: string) {
    const horas = paraJs(readFileSync(join(RAIZ, "src/lib/hora-de-lisboa.ts"), "utf8"));
    const funcoes = paraJs(PAINEL.slice(ini, fim));
    const codigo = `
      const RealDate = Date;
      const AGORA = RealDate.parse("2026-10-25T10:00:00Z");
      globalThis.Date = class extends RealDate {
        constructor(...a) { if (a.length === 0) super(AGORA); else super(...a); }
        static now() { return AGORA; }
      };
      const h = (() => {
        const module = { exports: {} };
        const exports = module.exports;
        ${horas}
        return module.exports;
      })();
      const { diaMesEHoraEmLisboa, diasDeCalendarioEmLisboa, instanteDaBase } = h;
      ${funcoes}
      console.log(JSON.stringify({
        horaDoProcesso: new RealDate("2026-10-01T13:20:00Z").getHours(),
        verao: quandoCurto("2026-10-01T13:20:00.000Z"),
        daBaseSemFuso: quandoCurto("2026-10-01 13:20:00"),
        passagemDeAno: quandoCurto("2026-12-31T23:30:00.000Z"),
        semData: quandoCurto(null),
        dasOnzeEMeiaDeOntem: diasDesde("2026-10-24T22:30:00.000Z"),
        deAnteontem: diasDesde("2026-10-23T22:30:00.000Z"),
        deHoje: diasDesde("2026-10-25T09:00:00.000Z"),
        toLocaleComFuso: new RealDate("2026-10-01T13:20:00Z").toLocaleTimeString("pt-PT", {
          timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit",
        }),
      }));
    `;
    const r = spawnSync(process.execPath, ["-"], {
      input: codigo,
      encoding: "utf8",
      env: { ...process.env, TZ: tz },
    });
    expect(r.stderr).toBe("");
    return JSON.parse(r.stdout.trim());
  }

  const LISBOA = {
    verao: "01/10 14:20",
    daBaseSemFuso: "01/10 14:20",
    passagemDeAno: "31/12 23:30",
    semData: "—",
    // 23h30 de 24/10 em Lisboa (já 00h30 de 25/10 em Paris): foi ontem.
    dasOnzeEMeiaDeOntem: 1,
    // 23h30 de 23/10 em Lisboa: dois dias — o que acende o «há 2 dias».
    deAnteontem: 2,
    deHoje: 0,
    toLocaleComFuso: "14:20",
  };

  it("com o processo em Europe/Paris, as horas e os dias são os de Lisboa", () => {
    const r = correrCom("Europe/Paris");
    // O processo está mesmo em Paris: 13h20 UTC são 15h no relógio dele.
    expect(r).toEqual({ horaDoProcesso: 15, ...LISBOA });
  });

  it("e o mesmo em UTC (o servidor) — iguais no servidor e no navegador", () => {
    const r = correrCom("UTC");
    expect(r).toEqual({ horaDoProcesso: 13, ...LISBOA });
  });
});

describe("o backoffice e o painel do profissional não lêem o relógio do computador", () => {
  const PASTAS = ["src/components/admin", "src/app/admin", "src/app/profissionais/painel"];

  function ficheiros(p: string): string[] {
    const abs = join(RAIZ, p);
    if (statSync(abs).isFile()) return [p];
    return readdirSync(abs).flatMap((n) => ficheiros(`${p}/${n}`));
  }

  const FONTES = PASTAS.flatMap(ficheiros).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));

  /** Cada chamada que escreve uma data, com os argumentos dela. */
  function chamadas(fonte: string): Array<{ nome: string; args: string }> {
    const re = /(toLocaleString|toLocaleDateString|toLocaleTimeString|Intl\.DateTimeFormat)\(/g;
    const out: Array<{ nome: string; args: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(fonte))) {
      let i = m.index + m[0].length;
      let nivel = 1;
      while (i < fonte.length && nivel > 0) {
        if (fonte[i] === "(") nivel++;
        else if (fonte[i] === ")") nivel--;
        i++;
      }
      out.push({ nome: m[1], args: fonte.slice(m.index + m[0].length, i - 1) });
    }
    return out;
  }

  // Números (euros, percentagens) também usam toLocaleString — esses não têm fuso.
  const DE_NUMERO = /style\s*:|currency|FractionDigits|useGrouping/;

  it("as pastas existem e têm datas para guardar", () => {
    expect(FONTES.length).toBeGreaterThan(40);
    const comFuso = FONTES.flatMap((f) => chamadas(semNotas(ler(f)))).filter((c) => /timeZone/.test(c.args));
    expect(comFuso.length).toBeGreaterThan(40);
  });

  it("nenhum getHours/getDate/getDay/getMonth/getFullYear/getMinutes", () => {
    const achados = FONTES.flatMap((f) =>
      semNotas(ler(f))
        .split("\n")
        .map((linha, i) => ({ f, i: i + 1, linha }))
        .filter((x) => /\.(getHours|getMinutes|getDate|getDay|getMonth|getFullYear)\(/.test(x.linha))
        .map((x) => `${x.f}:${x.i} → usar src/lib/hora-de-lisboa.ts (pecasEmLisboa, diaEmLisboa…)`),
    );
    expect(achados).toEqual([]);
  });

  it("cada toLocale…String e Intl.DateTimeFormat de datas diz timeZone", () => {
    const achados = FONTES.flatMap((f) =>
      chamadas(semNotas(ler(f)))
        .filter((c) => !/timeZone/.test(c.args) && !DE_NUMERO.test(c.args))
        .map((c) => `${f}: ${c.nome}(${c.args.replace(/\s+/g, " ")}) → { timeZone: "Europe/Lisbon", … }`),
    );
    expect(achados).toEqual([]);
  });
});
