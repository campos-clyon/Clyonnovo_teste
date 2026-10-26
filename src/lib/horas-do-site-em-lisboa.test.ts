import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

/*
 * O SITE INTEIRO EM HORA DE LISBOA — 26-10-2026 (fecho da d21).
 *
 * Regra do dono: todas as horas do site e do backoffice em hora de Lisboa,
 * seja qual for o fuso de quem vê ou de quem corre o código. O backoffice e o
 * painel do profissional já estavam guardados (`horas-do-backoffice-em-lisboa`);
 * fora deles ficavam a mensagem «Marcado: … às …» ao cliente, o email do
 * orçamento, as páginas públicas e as contas da semana e do mês das Métricas e
 * das Leads — certas só porque o `instrumentation.ts` põe o fuso do processo
 * em Lisboa. Num processo noutro fuso (um teste, um script, o servidor sem o
 * gancho) diziam outra hora.
 *
 * Duas guardas:
 *  1. o código, corrido num Node à parte com o fuso do processo em
 *     Europe/Paris e em UTC, dá as horas, os dias, as semanas e os meses de
 *     Lisboa;
 *  2. em todo o src/ (lib, app — páginas e api —, components, hooks,
 *     contexts), nenhum `getHours()`/`setHours()`/… nem `new Date(ano, mês, …)`,
 *     e nenhum `toLocale…String`/`Intl.DateTimeFormat` de datas sem `timeZone`.
 *     As excepções são as que trabalham, de propósito, com o relógio de Lisboa
 *     dentro de um `Date` (`noRelogioDeLisboa`) — e cada uma diz porquê.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const paraJs = (fonte: string) =>
  ts.transpileModule(fonte, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

/** Um pedaço do ficheiro, de `de` até antes de `ate`, sem `export` — para correr à parte. */
function pedaco(ficheiro: string, de: string, ate: string): string {
  const fonte = ler(ficheiro);
  const i = fonte.indexOf(de);
  const j = fonte.indexOf(ate, i + 1);
  if (i < 0 || j <= i) throw new Error(`${ficheiro}: não encontrei «${de}» … «${ate}»`);
  return fonte.slice(i, j).replace(/^export /gm, "");
}

describe("o site conta as horas em Lisboa, seja qual for o fuso do processo", () => {
  const HORAS = paraJs(readFileSync(join(RAIZ, "src/lib/hora-de-lisboa.ts"), "utf8"));
  const QUANDO = paraJs(pedaco("src/lib/ler-a-data.ts", "export function quandoSera(", "/** «dia 16» ou «16/10»"));
  const METRICAS = paraJs(
    pedaco("src/app/api/admin/metricas/route.ts", "function getPeriodBounds(", "function toSQL("),
  );
  const LEADS = paraJs(pedaco("src/app/api/admin/leads/route.ts", "function getPeriodStart(", "// GET /api/admin/leads"));
  const LEAD_EVENTS = paraJs(
    pedaco("src/app/api/admin/lead-events/route.ts", "function getPeriodStart(", "// GET /api/admin/lead-events"),
  );
  const EMAIL = paraJs(pedaco("src/lib/email-orcamento.ts", "function formatDate(", "function buildHtml("));
  const VALIDADE = paraJs(
    pedaco("src/lib/dados-estruturados.ts", "export function validadeDoPreco(", "/** A Organization"),
  );
  const GUIAO = paraJs(pedaco("src/lib/reler-a-conversa.ts", "export function guiaoDoFio(", "/** Os campos que"));
  const DIAS = paraJs(pedaco("src/lib/taxa-agendamento.ts", "export function diasAteData(", "export function taxaPorUrgencia("));

  /* A mensagem que o cliente recebe no WhatsApp, tal e qual está no código. */
  const MARCADO = /`Marcado: [^`]*`/.exec(ler("src/lib/whatsapp-negociacao.ts"))?.[0];

  it("os pedaços estão onde se espera", () => {
    expect(MARCADO).toBeDefined();
    expect(MARCADO).toContain("timeZone");
    for (const p of [QUANDO, METRICAS, LEADS, LEAD_EVENTS, EMAIL, VALIDADE, GUIAO, DIAS]) {
      expect(p.length).toBeGreaterThan(40);
    }
  });

  /*
   * O «agora» fica parado na segunda-feira 26-10-2026 às 15h00 UTC — 15h00 em
   * Lisboa (já em WET, no dia a seguir à mudança da hora) e 16h00 em Paris.
   */
  function correrCom(tz: string) {
    const codigo = `
      const RealDate = Date;
      const AGORA = RealDate.parse("2026-10-26T15:00:00Z");
      globalThis.Date = class extends RealDate {
        constructor(...a) { if (a.length === 0) super(AGORA); else super(...a); }
        static now() { return AGORA; }
      };
      const h = (() => {
        const module = { exports: {} };
        const exports = module.exports;
        ${HORAS}
        return module.exports;
      })();
      const {
        pecasEmLisboa, instanteEmLisboa, diaEmLisboa, somarDiasAoDia, diasDeCalendarioEmLisboa,
        inicioDoDiaEmLisboa, segundaDaSemanaEmLisboa, primeiroDoMesEmLisboa, primeiroDoMesSeguinte,
        inicioDoPeriodoEmLisboa,
      } = h;
      const toMySQLDateTime = (d) => d.toISOString().slice(0, 19).replace("T", " ");
      ${QUANDO}
      ${METRICAS}
      ${EMAIL}
      ${VALIDADE}
      const MAX_GUIAO = 12000;
      ${GUIAO}
      ${DIAS}
      const leads = (() => { ${LEADS}; return getPeriodStart; })();
      const leadEvents = (() => { ${LEAD_EVENTS}; return getPeriodStart; })();
      const L = (s) => instanteEmLisboa(s);
      const iso = (x) => ({ start: x.start.toISOString(), end: x.end.toISOString() });

      // Segunda 19/10 às 00h30 de Lisboa: ainda domingo em UTC, já 01h30 em Paris.
      const segundaCedo = L("2026-10-19T00:30");
      // Domingo 18/10 às 23h30 de Lisboa: já segunda em Paris.
      const domingoTarde = L("2026-10-18T23:30");

      const d = quandoSera({ dia: 28, mes: null, hora: 14, minuto: 30 }, new Date());
      const acordada = { profissionalNome: "Profissional Teste" };

      console.log(JSON.stringify({
        horaDoProcesso: new RealDate("2026-10-26T15:00:00Z").getHours(),
        marcadoEm: d.toISOString(),
        marcado: ${MARCADO},
        marcadoNoVerao: quandoSera({ dia: 16, mes: null, hora: 10, minuto: 0 }, L("2026-09-14T15:00")).toISOString(),
        semana: iso(getPeriodBounds("semana")),
        mes: iso(getPeriodBounds("mes")),
        personalizado: iso(getPeriodBounds("personalizado", "2026-10-24", "2026-10-25")),
        semanaDaSegundaCedo: iso(getPeriodBounds("semana", undefined, undefined, segundaCedo)),
        semanaDoDomingoTarde: iso(getPeriodBounds("semana", undefined, undefined, domingoTarde)),
        leads: ["hoje", "semana", "7d", "30d"].map((p) => leads(p)),
        leadEvents: ["hoje", "semana", "7d", "30d"].map((p) => leadEvents(p)),
        periodoDaSegundaCedo: toMySQLDateTime(inicioDoPeriodoEmLisboa("semana", segundaCedo)),
        periodoDoDomingoTarde: toMySQLDateTime(inicioDoPeriodoEmLisboa("semana", domingoTarde)),
        emailNoVerao: formatDate("2026-09-30T23:30:00.000Z"),
        emailNoInverno: formatDate("2026-10-31T23:30:00.000Z"),
        validadeNaPassagemDeAno: validadeDoPreco(L("2026-12-31T23:30")),
        guiao: guiaoDoFio([{ direccao: "in", texto: "amanhã", criadoEm: "2026-09-30T23:30:00.000Z" }]),
        diasAteAmanha: diasAteData(L("2026-08-01T00:30"), L("2026-07-31T23:30")),
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
    marcadoEm: "2026-10-28T14:30:00.000Z",
    marcado: "Marcado: 28/10/2026 às 14:30, com Profissional Teste. Ele vê a data na agenda dele.",
    // 10h00 de Lisboa em Setembro (WEST) são 9h00 UTC.
    marcadoNoVerao: "2026-09-16T09:00:00.000Z",
    // De segunda 26/10 à meia-noite de Lisboa até ao fim de domingo 1/11.
    semana: { start: "2026-10-26T00:00:00.000Z", end: "2026-11-01T23:59:59.999Z" },
    // 1/10 à meia-noite de Lisboa ainda era Verão (23h00 UTC de 30/09).
    mes: { start: "2026-09-30T23:00:00.000Z", end: "2026-10-31T23:59:59.999Z" },
    personalizado: { start: "2026-10-23T23:00:00.000Z", end: "2026-10-25T23:59:59.999Z" },
    semanaDaSegundaCedo: { start: "2026-10-18T23:00:00.000Z", end: "2026-10-25T23:59:59.999Z" },
    semanaDoDomingoTarde: { start: "2026-10-11T23:00:00.000Z", end: "2026-10-18T22:59:59.999Z" },
    leads: ["2026-10-26 00:00:00", "2026-10-26 00:00:00", "2026-10-18 23:00:00", "2026-09-25 23:00:00"],
    leadEvents: ["2026-10-26 00:00:00", "2026-10-26 00:00:00", "2026-10-18 23:00:00", "2026-09-25 23:00:00"],
    periodoDaSegundaCedo: "2026-10-18 23:00:00",
    periodoDoDomingoTarde: "2026-10-11 23:00:00",
    // 23h30 UTC de 30/09 já é 1/10 em Lisboa (WEST); 23h30 UTC de 31/10 ainda é 31/10 (WET).
    emailNoVerao: "01 de outubro de 2026",
    emailNoInverno: "31 de outubro de 2026",
    // 23h30 de 31/12 em Lisboa — já 2027 em Paris.
    validadeNaPassagemDeAno: "2027-12-31",
    guiao: "[01/10] CLIENTE: amanhã",
    // 23h30 → 00h30 em Lisboa: é amanhã (14,99 €), e não hoje.
    diasAteAmanha: 1,
  };

  it("com o processo em Europe/Paris, tudo é contado em Lisboa", () => {
    const r = correrCom("Europe/Paris");
    // O processo está mesmo em Paris: 15h00 UTC são 16h no relógio dele.
    expect(r).toEqual({ horaDoProcesso: 16, ...LISBOA });
  });

  it("e o mesmo em UTC (o servidor sem o fuso do instrumentation.ts)", () => {
    const r = correrCom("UTC");
    expect(r).toEqual({ horaDoProcesso: 15, ...LISBOA });
  });
});

describe("nenhuma parte do site lê o relógio do processo", () => {
  const PASTAS = ["src/lib", "src/app", "src/components", "src/hooks", "src/contexts"];

  /*
   * As que trabalham, DE PROPÓSITO, com o relógio de Lisboa dentro de um
   * `Date`: quem chama passa as datas por `noRelogioDeLisboa` à entrada, e os
   * `getHours()`/`getDate()` daí dão a hora de Lisboa em qualquer fuso.
   */
  const NO_RELOGIO_DE_LISBOA: Record<string, RegExp> = {
    // É aqui que se faz a conversão (`noRelogioDeLisboa` e `doRelogioDeLisboa`).
    "src/lib/hora-de-lisboa.ts": /export function noRelogioDeLisboa\(/,
    // A grelha da agenda: «quem chama passa as datas por `noRelogioDeLisboa`».
    "src/lib/agenda-em-grelha.ts": /noRelogioDeLisboa/,
    "src/components/GrelhaDeAgenda.tsx": /import \{[^}]*noRelogioDeLisboa[^}]*\} from "@\/lib\/hora-de-lisboa"/,
  };

  function ficheiros(p: string): string[] {
    const abs = join(RAIZ, p);
    if (statSync(abs).isFile()) return [p];
    return readdirSync(abs).flatMap((n) => ficheiros(`${p}/${n}`));
  }

  const FONTES = PASTAS.flatMap(ficheiros).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
  const GUARDADAS = FONTES.filter((f) => !(f in NO_RELOGIO_DE_LISBOA));

  /** Cada chamada, com os argumentos dela (os parênteses contam-se). */
  function chamadas(fonte: string, re: RegExp): Array<{ nome: string; args: string }> {
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
      out.push({ nome: m[1] ?? "new Date", args: fonte.slice(m.index + m[0].length, i - 1) });
    }
    return out;
  }

  /** Quantos argumentos — as vírgulas de topo, fora de textos e de parênteses. */
  function argumentos(args: string): number {
    const limpo = args.trim().replace(/,$/, "");
    if (!limpo) return 0;
    let nivel = 0;
    let n = 1;
    let texto: string | null = null;
    for (const c of limpo) {
      if (texto) {
        if (c === texto) texto = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") texto = c;
      else if ("([{".includes(c)) nivel++;
      else if (")]}".includes(c)) nivel--;
      else if (c === "," && nivel === 0) n++;
    }
    return n;
  }

  // Números (euros, percentagens) também usam toLocaleString — esses não têm fuso.
  const DE_NUMERO = /style\s*:|currency|FractionDigits|useGrouping/;

  /** Diz `timeZone` — à letra, ou por um objecto do mesmo ficheiro que o diz (`{ ...tz, … }`). */
  function dizOFuso(args: string, fonte: string): boolean {
    if (/timeZone/.test(args)) return true;
    return [...args.matchAll(/\.\.\.(\w+)/g)].some(([, nome]) =>
      new RegExp(`const ${nome}\\s*=\\s*\\{[^}]*timeZone`).test(fonte),
    );
  }

  it("as pastas existem, e as excepções dizem porquê", () => {
    expect(FONTES.length).toBeGreaterThan(300);
    for (const [f, razao] of Object.entries(NO_RELOGIO_DE_LISBOA)) {
      expect(FONTES, f).toContain(f);
      expect(ler(f), f).toMatch(razao);
    }
  });

  it("nenhum getHours/getDate/getDay/getMonth/getFullYear/getMinutes, nem setHours/setDate/…", () => {
    const re = /\.(getHours|getMinutes|getSeconds|getDate|getDay|getMonth|getFullYear|setHours|setMinutes|setSeconds|setDate|setMonth|setFullYear)\(/;
    const achados = GUARDADAS.flatMap((f) =>
      semNotas(ler(f))
        .split("\n")
        .map((linha, i) => ({ f, i: i + 1, linha }))
        .filter((x) => re.test(x.linha))
        .map((x) => `${x.f}:${x.i} → usar src/lib/hora-de-lisboa.ts (pecasEmLisboa, diaEmLisboa…)`),
    );
    expect(achados).toEqual([]);
  });

  it("nenhum new Date(ano, mês, dia…) — esse lê os números no fuso do processo", () => {
    const achados = GUARDADAS.flatMap((f) =>
      chamadas(semNotas(ler(f)), /new Date\(/g)
        .filter((c) => argumentos(c.args) > 1)
        .map((c) => `${f}: new Date(${c.args.replace(/\s+/g, " ")}) → instanteEmLisboa("AAAA-MM-DDTHH:mm")`),
    );
    expect(achados).toEqual([]);
  });

  it("cada toLocale…String e Intl.DateTimeFormat de datas diz timeZone", () => {
    const achados = GUARDADAS.flatMap((f) => {
      const fonte = semNotas(ler(f));
      return chamadas(fonte, /(toLocaleString|toLocaleDateString|toLocaleTimeString|Intl\.DateTimeFormat)\(/g)
        .filter((c) => !dizOFuso(c.args, fonte) && !DE_NUMERO.test(c.args))
        .map((c) => `${f}: ${c.nome}(${c.args.replace(/\s+/g, " ")}) → { timeZone: "Europe/Lisbon", … }`);
    });
    expect(achados).toEqual([]);
  });
});
