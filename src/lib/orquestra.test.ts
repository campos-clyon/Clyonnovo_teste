import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { SERVICE_CATEGORIES } from "./service-categories";
import { PRAZO_DE_RESPOSTA } from "./seo-data";
import { PROPOSTAS_EM_ATE, RECEBE_PROPOSTAS } from "./promessas-publicas";

/*
 * O TESTE DA ORQUESTRA — 27-10-2026 (decisão d12).
 *
 * Cada «limpeza geral» (30/09, 14/10, 17/10) voltou a derivar porque guardava
 * FICHEIROS e não REGRAS: o teste das páginas públicas via uma lista fixa de
 * ~45 ficheiros, e os desencontros nasciam nos outros ~130 (a inicial, as FAQ,
 * os emails, a conta do cliente, o backoffice, a app Pro).
 *
 * Este teste lê os TEXTOS do código pela árvore do TypeScript — strings,
 * templates e JSX; os comentários nunca entram, e não há regex sobre o CRLF —
 * em todo o src/app, src/components, src/lib e app-pro/src, e aplica as regras
 * da casa:
 *
 *   a) português de Portugal (nada de «você», «celular», «cadastro», «equipe»…);
 *   b) voz de plataforma: quem faz o trabalho é o profissional escolhido, não
 *      a CLYON («nossa equipa», «a nossa proposta», «levamos», «Empresa de
 *      Recolha»…) — só no que o cliente vê (o backoffice fica de fora);
 *   c) sem «próprio dia», e contentores/big bags só a dizer que não há;
 *   d) o prazo só na forma «em menos de 6 horas»;
 *   e) o telefone da CLYON só pela constante (telefone-da-clyon.ts);
 *   f) o nome de cada serviço só pelo mapa único (service-categories.ts);
 *   g) a hora sempre de Lisboa (getHours/toLocale… sem timeZone, só em
 *      hora-de-lisboa.ts e em quem trabalha de propósito no relógio de Lisboa).
 *
 * A LISTA DE EXCEPÇÕES diz o que ainda falta, com o motivo. Só pode encolher:
 * uma excepção que já não é precisa chumba (apaga-se), e a lista não pode
 * passar de TAMANHO_MAXIMO. Desce o número quando a lista desce.
 */

const RAIZ = process.cwd();

type Regra = "a-brasil" | "b-voz" | "c-promessa" | "d-prazo" | "e-telefone" | "f-servico" | "g-hora";

interface Excepcao {
  ficheiro: string;
  regra: Regra;
  motivo: string;
}

/*
 * O QUE AINDA FALTA, com quem o faz:
 *  - «d12»: o que esta decisão corrige a seguir (o estado de 27-10-2026);
 *  - «d11»:os ficheiros da Vitória (WhatsApp), que a I&D está a mudar na d11;
 *  - «apps»: a app CLYON Pro (app-pro/), que é das Apps;
 *  - «dono»: decisões de língua que só o dono toma.
 */
const EXCEPCOES: Excepcao[] = [
  { ficheiro: "src/app/faq/page.tsx", regra: "b-voz", motivo: "d12: voz de empresa executora («profissionais da CLYON»)" },
  { ficheiro: "src/app/privacidade/page.tsx", regra: "b-voz", motivo: "d12: voz de empresa executora («nossa equipa»)" },
  { ficheiro: "src/app/recolha-de-monos/page.tsx", regra: "b-voz", motivo: "d12: voz de empresa executora («Empresa de Recolha»)" },
  { ficheiro: "src/lib/proposta-clyon-ao-cliente.ts", regra: "b-voz", motivo: "d12: voz de empresa executora («A nossa proposta»)" },
  { ficheiro: "src/lib/seo-data.ts", regra: "b-voz", motivo: "d12: voz de empresa executora («profissionais da CLYON»)" },
  { ficheiro: "src/lib/whatsapp-cloud.ts", regra: "e-telefone", motivo: "d11: o telefone escrito à mão («351931632622»)" },
  // As lições da Vitória (629f70cf, d11): instruções ao modelo que citam o que ele não pode dizer.
  { ficheiro: "src/lib/licoes-da-vitoria.ts", regra: "a-brasil", motivo: "d11: lista de palavras para reconhecer o que o cliente escreve («voces»)" },
  { ficheiro: "src/lib/licoes-da-vitoria.ts", regra: "c-promessa", motivo: "d11: o aviso ao modelo cita a promessa proibida («próprio dia»)" },
  { ficheiro: "src/lib/o-que-o-site-sabe.ts", regra: "b-voz", motivo: "d11: o aviso ao modelo cita a voz proibida («nossa equipa»)" },
  { ficheiro: "src/lib/o-que-o-site-sabe.ts", regra: "c-promessa", motivo: "d11: o aviso ao modelo cita a promessa proibida («próprio dia»)" },
  { ficheiro: "src/lib/o-que-o-site-sabe.ts", regra: "f-servico", motivo: "d11: os nomes dos serviços com preço, escritos à mão para a Vitória" },
  { ficheiro: "src/lib/propor-licoes.ts", regra: "c-promessa", motivo: "d11: o aviso ao modelo cita a promessa proibida («próprio dia»)" },
];

/** Desce sempre que a lista desce. Nunca sobe. */
const TAMANHO_MAXIMO = 12;

/*
 * PREPARADAS E DESLIGADAS — à espera da decisão do dono (orquestra.json,
 * «Decisões de língua que só o dono toma»):
 *  - o nome da taxa (hoje: «taxa CLYON», «taxa da CLYON», «taxa da
 *    plataforma», «taxa de plataforma», «comissão da CLYON», «comissão»);
 *  - a grafia, «factura» ou «fatura».
 * Quando ele escolher, põe-se o nome/grafia que fica em NOME_DA_TAXA e
 * GRAFIA, liga-se a regra em REGRAS_POR_DECIDIR e corre-se para ver a lista.
 */
const NOME_DA_TAXA: string | null = null;
const GRAFIA: "factura" | "fatura" | null = null;
const REGRAS_POR_DECIDIR: Array<{ regra: string; re: RegExp; ligada: boolean }> = [
  {
    regra: "h-taxa",
    re: /\b(taxa (da |de )?(CLYON|plataforma)|taxa de plataforma da CLYON|comiss[ãa]o( da CLYON)?)\b/i,
    ligada: NOME_DA_TAXA !== null,
  },
  {
    regra: "i-grafia",
    re: GRAFIA === "fatura" ? /\bfactur/i : /\bfatur/i,
    ligada: GRAFIA !== null,
  },
];

/* ─── Onde se lê ─────────────────────────────────────────────────────────── */

const PASTAS = ["src/app", "src/components", "src/lib", "src/hooks", "src/contexts", "app-pro/src"];

function ficheiros(p: string): string[] {
  const abs = join(RAIZ, p);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [p];
  return readdirSync(abs).flatMap((n) => ficheiros(`${p}/${n}`));
}

const FONTES = PASTAS.flatMap(ficheiros).filter(
  (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !/\.d\.ts$/.test(f) && !/\.generated\.ts$/.test(f),
);

/** O backoffice fala com a equipa, não com o cliente: a voz e as promessas não se lhe aplicam. */
const DO_BACKOFFICE = (f: string) =>
  /^src\/app\/admin\//.test(f) || /^src\/app\/api\/admin\//.test(f) || /^src\/components\/admin\//.test(f);

/*
 * As fontes de cada regra — onde a coisa se escreve UMA vez, de propósito.
 * Não são excepções: são o sítio certo.
 */
const FONTE_DO_TELEFONE = "src/lib/telefone-da-clyon.ts";
const FONTE_DOS_SERVICOS = "src/lib/service-categories.ts";
/*
 * Ficheiros cujas palavras não são frases para ninguém ler: listas para
 * RECONHECER a língua de quem escreve («voce» é uma marca de português).
 */
const NAO_FALAM = new Set(["src/lib/lingua-do-cliente.ts"]);
const NO_RELOGIO_DE_LISBOA = new Set([
  // É aqui que se faz a conversão (noRelogioDeLisboa / doRelogioDeLisboa).
  "src/lib/hora-de-lisboa.ts",
  // A grelha da agenda: quem chama passa as datas por noRelogioDeLisboa.
  "src/lib/agenda-em-grelha.ts",
  "src/components/GrelhaDeAgenda.tsx",
]);

/* ─── As regras ──────────────────────────────────────────────────────────── */

const BRASIL: RegExp[] = [
  /\bvoc[êe]s?\b/i,
  /\bcelular(es)?\b/i,
  /\bcadastr[a-zçãõáéíóú]*/i,
  /\bequipes?\b/i,
  /\b(o|um|nosso|do|no|ao|seu) time\b/i,
  /\b[ôo]nibus\b/i,
  /(?<!toda )\ba gente\b/i,
  /\bcontatos?\b/i,
  /\busu[áa]rios?\b/i,
  /\bgeladeiras?\b/i,
  /\bbanheiros?\b/i,
  /\bcaminh[ãa]o\b/i,
  /\baluguel\b/i,
  // Gerúndio de progressão: «estamos verificando» (cá: «estamos a verificar»).
  /\b(estou|estás|está|estamos|estão|estava|estavam|esteve|estive|ficamos|fico)\s+(?!quando\b|lindo\b)[a-zà-ú]{2,}(ando|endo|indo)\b/i,
];

const VOZ: RegExp[] = [
  /\bnossa equipa\b/i,
  /\ba nossa proposta\b/i,
  /\bprofissionais da CLYON\b/i,
  /\bvamos buscar\b/i,
  /\blevamos\b/i,
  // «Que dados recolhemos» (a Privacidade) é outra recolha, e fica.
  /(?<!dados )\brecolhemos\b(?![^.]{0,40}\bdados\b)/i,
  /\besvaziamos\b/i,
  /\bEmpresa de Recolha\b/i,
];

const NEGA = /\b(não|nem|sem|nunca|nenhum|nenhuns)\b/i;
/*
 * Contentores e big bags podem aparecer: na pergunta «A CLYON fornece
 * contentor?» (a resposta é não), como medida («cabem num big bag, quase
 * 1 m³»), no serviço da câmara, nos pedidos antigos. O que não pode é a CLYON
 * a oferecê-los.
 */
const PROMESSAS: Array<{ re: RegExp; negavel: boolean }> = [
  { re: /\bpr[óo]prio dia\b/i, negavel: false },
  {
    re: /(\bCLYON\b[^.?!]{0,30}\b(fornece|aluga|disponibiliza|leva|entrega|deixa|traz)|\b(fornecemos|alugamos|disponibilizamos|levamos|entregamos|deixamos|trazemos))\b[^.?!]{0,25}\b(contentor(es)?|big[ -]?bags?)\b(?![^.!]*\?)/i,
    negavel: true,
  },
];

const PRAZO: RegExp[] = [
  /\bem 6 ?h(oras)?\b/i,
  /\bem até 6\b/i,
  /\bdentro de 6\b/i,
  /\bor[çc]amento gratuito em\b/i,
  /\brespondem em \d/i,
];

/** Os números da CLYON (o do atendimento e o da API do WhatsApp), escritos à mão. */
const TELEFONE = /(?<!\d)(\+?351[\s.-]?)?93[1][\s.-]?(632[\s.-]?622|493[\s.-]?991)(?!\d)/;

const IDS_DOS_SERVICOS = new Set(SERVICE_CATEGORIES.map((c) => c.id));

const LER_O_RELOGIO = new Set([
  "getHours",
  "getMinutes",
  "getSeconds",
  "getDate",
  "getDay",
  "getMonth",
  "getFullYear",
  "setHours",
  "setMinutes",
  "setSeconds",
  "setDate",
  "setMonth",
  "setFullYear",
]);
const DE_NUMERO = /style\s*:|currency|FractionDigits|useGrouping/;

/* ─── Ler os textos pela árvore ──────────────────────────────────────────── */

/** O valor das constantes que entram nos textos, para ler a frase como o cliente a lê. */
const CONHECIDAS: Record<string, string> = {
  "PRAZO_DE_RESPOSTA.porExtenso": PRAZO_DE_RESPOSTA.porExtenso,
  "PRAZO_DE_RESPOSTA.curto": PRAZO_DE_RESPOSTA.curto,
  "PRAZO_DE_RESPOSTA.frase": PRAZO_DE_RESPOSTA.frase,
  PROPOSTAS_EM_ATE,
  RECEBE_PROPOSTAS,
};

interface Achado {
  ficheiro: string;
  linha: number;
  regra: Regra;
  texto: string;
}

function lerFicheiro(f: string): { textos: Array<{ linha: number; texto: string }>; codigo: Achado[] } {
  const fonte = readFileSync(join(RAIZ, f), "utf8");
  const sf = ts.createSourceFile(f, fonte, ts.ScriptTarget.Latest, true, f.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const textos: Array<{ linha: number; texto: string }> = [];
  const codigo: Achado[] = [];
  const linhaDe = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const limpar = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();

  const resolver = (e: ts.Expression | undefined): string => {
    if (!e) return "";
    const t = e.getText(sf);
    if (t in CONHECIDAS) return CONHECIDAS[t];
    if (ts.isStringLiteralLike(e)) return e.text;
    return "‹›";
  };

  const textoDoJsx = (n: ts.JsxElement | ts.JsxFragment): string =>
    n.children
      .map((c) => {
        if (ts.isJsxText(c)) return c.text;
        if (ts.isJsxExpression(c)) return resolver(c.expression);
        if (ts.isJsxElement(c) || ts.isJsxFragment(c)) return textoDoJsx(c);
        return " ";
      })
      .join("");

  const visitar = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isLiteralTypeNode(n)) return;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const pai = n.parent;
      const eNomeDePropriedade = pai && (ts.isPropertyAssignment(pai) || ts.isPropertySignature(pai)) && pai.name === n;
      if (!eNomeDePropriedade) textos.push({ linha: linhaDe(n), texto: limpar(n.text) });
    } else if (ts.isTemplateExpression(n)) {
      const t = n.head.text + n.templateSpans.map((s) => resolver(s.expression) + s.literal.text).join("");
      textos.push({ linha: linhaDe(n), texto: limpar(t) });
    } else if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      textos.push({ linha: linhaDe(n), texto: limpar(textoDoJsx(n)) });
    }

    // f) um mapa { id do serviço: "Nome" } copiado à mão. Os de minúscula
    // («recolha de móveis» para meio de frase, a pesquisa de preços) dizem o
    // serviço noutra forma, de propósito, e não são o nome.
    if (ts.isObjectLiteralExpression(n) && f !== FONTE_DOS_SERVICOS) {
      const nomes = n.properties.filter(
        (p): p is ts.PropertyAssignment =>
          ts.isPropertyAssignment(p) &&
          IDS_DOS_SERVICOS.has(p.name.getText(sf).replace(/^["']|["']$/g, "")) &&
          ts.isStringLiteralLike(p.initializer) &&
          /^[A-ZÀ-Ú]/.test(p.initializer.text),
      );
      if (nomes.length >= 3) {
        codigo.push({ ficheiro: f, linha: linhaDe(n), regra: "f-servico", texto: `mapa de ${nomes.length} nomes de serviço` });
      }
    }

    // g) o relógio do processo
    if (ts.isCallExpression(n) && !NO_RELOGIO_DE_LISBOA.has(f)) {
      const callee = n.expression;
      const nome = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isPropertyAccessExpression(callee) === false && callee.getText(sf) === "Intl.DateTimeFormat"
          ? "Intl.DateTimeFormat"
          : "";
      const args = n.arguments.map((a) => a.getText(sf)).join(", ");
      if (LER_O_RELOGIO.has(nome)) {
        codigo.push({ ficheiro: f, linha: linhaDe(n), regra: "g-hora", texto: `${nome}()` });
      } else if (
        (nome === "toLocaleDateString" || nome === "toLocaleTimeString") &&
        !/timeZone|Europe\/Lisbon/.test(args) &&
        !/\.\.\./.test(args)
      ) {
        codigo.push({ ficheiro: f, linha: linhaDe(n), regra: "g-hora", texto: `${nome}(${args})` });
      }
    }
    if (ts.isNewExpression(n) && n.expression.getText(sf) === "Intl.DateTimeFormat" && !NO_RELOGIO_DE_LISBOA.has(f)) {
      const args = (n.arguments ?? []).map((a) => a.getText(sf)).join(", ");
      if (!/timeZone|Europe\/Lisbon/.test(args) && !/\.\.\./.test(args) && !DE_NUMERO.test(args)) {
        codigo.push({ ficheiro: f, linha: linhaDe(n), regra: "g-hora", texto: `new Intl.DateTimeFormat(${args})` });
      }
    }

    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return { textos, codigo };
}

function achadosDe(f: string): Achado[] {
  const { textos, codigo } = lerFicheiro(f);
  const out: Achado[] = [...codigo];
  const publico = !DO_BACKOFFICE(f);
  for (const { linha, texto } of textos) {
    if (!texto) continue;
    const marcar = (regra: Regra, m: RegExpExecArray | null) => {
      if (m) out.push({ ficheiro: f, linha, regra, texto: m[0] });
    };
    if (!NAO_FALAM.has(f)) for (const re of BRASIL) marcar("a-brasil", re.exec(texto));
    if (publico) {
      for (const re of VOZ) marcar("b-voz", re.exec(texto));
      for (const { re, negavel } of PROMESSAS) {
        const m = re.exec(texto);
        if (m && !(negavel && NEGA.test(texto))) marcar("c-promessa", m);
      }
      for (const re of PRAZO) marcar("d-prazo", re.exec(texto));
    }
    if (f !== FONTE_DO_TELEFONE) marcar("e-telefone", TELEFONE.exec(texto));
    for (const r of REGRAS_POR_DECIDIR) if (r.ligada) r.re.exec(texto);
  }
  // O mesmo achado visto duas vezes (a string e o JSX à volta dela) conta uma.
  const vistos = new Set<string>();
  return out.filter((a) => {
    const k = `${a.ficheiro}|${a.regra}|${a.texto.toLowerCase()}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

const ACHADOS = FONTES.flatMap(achadosDe);
const chave = (f: string, r: string) => `${f} · ${r}`;
const EXCEPTUADOS = new Set(EXCEPCOES.map((e) => chave(e.ficheiro, e.regra)));

describe("a orquestra: o site inteiro fala a mesma língua", () => {
  it("lê o que tem de ler", () => {
    expect(FONTES.length).toBeGreaterThan(500);
    expect(FONTES).toContain("src/app/page.tsx");
    expect(FONTES).toContain("src/lib/email-pedido.ts");
    expect(FONTES.some((f) => f.startsWith("app-pro/src/"))).toBe(true);
    // Os comentários não entram: este ficheiro fala de «você» e de «em 6h» nos comentários.
    expect(achadosDe("src/lib/promessas-publicas.ts").filter((a) => a.regra === "d-prazo")).toEqual([]);
  });

  it("cada regra apanha o que deve (prova com frases de exemplo)", () => {
    const tem = (lista: RegExp[], s: string) => lista.some((re) => re.test(s));
    expect(tem(BRASIL, "Você recebe no celular")).toBe(true);
    expect(tem(BRASIL, "Estamos verificando o seu pedido")).toBe(true);
    expect(tem(BRASIL, "Estamos a verificar o seu pedido")).toBe(false);
    expect(tem(BRASIL, "Está quando quiser")).toBe(false);
    expect(tem(BRASIL, "toda a gente")).toBe(false);
    expect(tem(VOZ, "A nossa equipa vai buscar")).toBe(true);
    expect(tem(VOZ, "Profissionais verificados na CLYON")).toBe(false);
    expect(tem(PRAZO, "Recebe propostas em 6 horas")).toBe(true);
    expect(tem(PRAZO, "Orçamento em 6h")).toBe(true);
    expect(tem(PRAZO, RECEBE_PROPOSTAS)).toBe(false);
    const promete = (s: string) => PROMESSAS.some(({ re, negavel }) => re.test(s) && !(negavel && NEGA.test(s)));
    expect(promete("Recolha no próprio dia")).toBe(true);
    expect(promete("A CLYON fornece contentor para o entulho.")).toBe(true);
    expect(promete("A CLYON fornece contentor para entulho em Lisboa?")).toBe(false);
    expect(promete("A CLYON não fornece contentores.")).toBe(false);
    expect(promete("Cabem num big bag, quase 1 m³")).toBe(false);
    expect(tem(VOZ, "Que dados recolhemos")).toBe(false);
    expect(tem(VOZ, "Recolhemos os seus móveis")).toBe(true);
    expect(TELEFONE.test("ligue 931 632 622")).toBe(true);
    expect(TELEFONE.test("wa.me/351931632622")).toBe(true);
    expect(TELEFONE.test("912 345 678")).toBe(false);
  });

  it("nenhum desencontro fora da lista de excepções", () => {
    const fora = ACHADOS.filter((a) => !EXCEPTUADOS.has(chave(a.ficheiro, a.regra))).map(
      (a) => `${a.ficheiro}:${a.linha} [${a.regra}] «${a.texto}»`,
    );
    expect(fora).toEqual([]);
  });

  it("a lista de excepções só encolhe: nenhuma está a mais, e não passa do máximo", () => {
    const usadas = new Set(ACHADOS.map((a) => chave(a.ficheiro, a.regra)));
    const amais = EXCEPCOES.filter((e) => !usadas.has(chave(e.ficheiro, e.regra))).map(
      (e) => `${chave(e.ficheiro, e.regra)} já está limpo — apaga a excepção e desce TAMANHO_MAXIMO`,
    );
    expect(amais).toEqual([]);
    expect(EXCEPCOES.length).toBeLessThanOrEqual(TAMANHO_MAXIMO);
    expect(new Set(EXCEPCOES.map((e) => chave(e.ficheiro, e.regra))).size).toBe(EXCEPCOES.length);
    for (const e of EXCEPCOES) {
      expect(e.motivo.length, chave(e.ficheiro, e.regra)).toBeGreaterThan(10);
      // Só ficam as que pertencem a outra execução ou a uma decisão do dono.
      expect(e.motivo, chave(e.ficheiro, e.regra)).toMatch(/^(d11|apps|dono|d12):/);
    }
  });

  it("as regras do nome da taxa e da grafia estão preparadas, à espera do dono", () => {
    expect(REGRAS_POR_DECIDIR.map((r) => r.regra)).toEqual(["h-taxa", "i-grafia"]);
  });
});
