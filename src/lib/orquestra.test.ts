import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { SERVICE_CATEGORIES } from "./service-categories";
import { PRAZO_DE_RESPOSTA } from "./seo-data";
import { PROPOSTAS_EM_ATE, RECEBE_PROPOSTAS } from "./promessas-publicas";
import { FRASES_PROIBIDAS } from "./frases-proibidas";

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

type Regra =
  | "a-brasil"
  | "b-voz"
  | "c-promessa"
  | "d-prazo"
  | "e-telefone"
  | "f-servico"
  | "g-hora"
  | "h-taxa"
  | "i-grafia";

interface Excepcao {
  ficheiro: string;
  regra: Regra;
  motivo: string;
}

/*
 * O QUE AINDA FALTA, com quem o faz:
 *    (a d12 começou com 69 a 27-10-2026 e corrigiu as suas no mesmo dia;
 *    o que ficou é de outra execução. As 9 da Vitória, «d11», fecharam-se
 *    no mesmo dia: o telefone pela constante, «fatura», os nomes pelo mapa
 *    único, e as frases proibidas que o aviso ao modelo cita vêm de
 *    frases-proibidas.ts.)
 *  - «apps»: a app CLYON Pro (app-pro/), que é das Apps;
 *  - «dono»: decisões de língua que só o dono toma.
 */
const EXCEPCOES: Excepcao[] = [
  // As decisões de língua do dono (27-10-2026) nos ficheiros que não são da d12:
  { ficheiro: "app-pro/src/app/(app)/carteira.tsx", regra: "h-taxa", motivo: "apps: «comissão» na carteira da app — passa a «taxa da plataforma»" },
  { ficheiro: "app-pro/src/app/registo.tsx", regra: "h-taxa", motivo: "apps: «comissão» no registo da app — passa a «taxa da plataforma»" },
  { ficheiro: "app-pro/src/app/trabalho/[id].tsx", regra: "h-taxa", motivo: "apps: «taxa CLYON» no trabalho da app — passa a «taxa da plataforma»" },
];

/** Desce sempre que a lista desce. Nunca sobe. */
const TAMANHO_MAXIMO = 3;

/*
 * AS DECISÕES DE LÍNGUA DO DONO — 27-10-2026 (na conversa com o CEO):
 * português de Portugal sempre, e
 *  h) a taxa chama-se «taxa da plataforma» — nada de «taxa CLYON», «taxa da
 *     CLYON», «taxa de plataforma», «comissão da CLYON» ou «comissão» solta
 *     (as comissões dos ASSISTENTES são outra coisa, e ficam);
 *  i) a grafia é «fatura», «faturação», «faturar» — sem c.
 * Só no texto: nomes de variáveis, colunas da base e chaves da API não se
 * mudam (um texto sem espaços é um nome, não uma frase).
 */
const NOME_DA_TAXA = "taxa da plataforma";
const TAXA_COM_OUTRO_NOME =
  /\b(taxa (da |de )?CLYON|taxa de plataforma|comiss(ão|ões)( da CLYON)?)(?![\wÀ-ú])/i;
// «sem-factura», «/pagamentos/factura»: nomes de ficheiros e rotas, não texto.
const GRAFIA_ANTIGA = /(?<![\w/.-])factur/i;
/*
 * «Comissão» que NÃO é a taxa: a dos assistentes (a parte deles do lucro),
 * a do euPago (o que o banco cobra) e a Comissão Nacional de Proteção de
 * Dados. E o SQL, que é para a base, não para quem lê.
 */
const DOS_ASSISTENTES = new Set([
  "src/components/admin/MinhaComissao.tsx",
  "src/components/admin/TrabalhosDoAssistente.tsx",
  "src/components/admin/AdminAssistentesPanel.tsx",
  "src/lib/assistentes.ts",
  "src/lib/relatorio-das-comissoes.ts",
  "src/lib/periodos-de-comissao.ts",
  "src/app/api/admin/assistentes/route.ts",
  "src/app/api/admin/sessao/eu/route.ts",
]);
const NAO_E_A_TAXA = /assistente|deste período|antes de comissão|euPago|Comissão Nacional|Comissão Europeia/i;
const E_SQL = /\b(SELECT|FROM|WHERE|INSERT INTO|UPDATE|ALTER TABLE)\b/;

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
 * As frases que a CLYON não diz, escritas UMA vez para os avisos ao modelo
 * as citarem («nunca "no próprio dia"»). O teste prova, mais abaixo, que
 * cada uma é apanhada pela regra dela.
 */
const FONTE_DAS_FRASES_PROIBIDAS = "src/lib/frases-proibidas.ts";
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
    if (f === FONTE_DAS_FRASES_PROIBIDAS) continue;
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
    if (/\s/.test(texto) && !E_SQL.test(texto)) {
      if (!DOS_ASSISTENTES.has(f) && !NAO_E_A_TAXA.test(texto)) marcar("h-taxa", TAXA_COM_OUTRO_NOME.exec(texto));
      marcar("i-grafia", GRAFIA_ANTIGA.exec(texto));
    }
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

  it("as frases proibidas que os avisos citam são as que as regras apanham", () => {
    const tem = (lista: RegExp[], s: string) => lista.some((re) => re.test(s));
    for (const f of FRASES_PROIBIDAS.promessa) expect(PROMESSAS.some(({ re }) => re.test(`no ${f}`)), f).toBe(true);
    for (const f of FRASES_PROIBIDAS.voz) expect(tem(VOZ, `a ${f}`), f).toBe(true);
    for (const f of FRASES_PROIBIDAS.brasil) expect(tem(BRASIL, f), f).toBe(true);
    // A fonte só tem as frases: nada mais escapa por ela.
    expect(FONTES).toContain(FONTE_DAS_FRASES_PROIBIDAS);
    const { textos } = lerFicheiro(FONTE_DAS_FRASES_PROIBIDAS);
    const todas = new Set<string>([...FRASES_PROIBIDAS.promessa, ...FRASES_PROIBIDAS.voz, ...FRASES_PROIBIDAS.brasil]);
    expect(textos.map((t) => t.texto).filter((t) => !todas.has(t))).toEqual([]);
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
      expect(e.motivo, chave(e.ficheiro, e.regra)).toMatch(/^(apps|dono):/);
    }
  });

  it("o email do pedido conta a mesma história do ecrã do simulador", () => {
    const CONFERE = "A CLYON confere o pedido e envia-o aos profissionais da sua zona";
    const ecra = readFileSync(join(RAIZ, "src/app/simulador/SimulatorThreePhaseForm.tsx"), "utf8");
    const email = readFileSync(join(RAIZ, "src/lib/email-pedido.ts"), "utf8");
    expect(ecra).toContain(CONFERE);
    expect(ecra).toContain("Recebe propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}");
    expect(email).toContain(CONFERE);
    expect(email).toContain("${RECEBE_PROPOSTAS}");
  });

  it("a taxa tem um nome e a fatura uma grafia (decisão do dono, 27-10-2026)", () => {
    expect(NOME_DA_TAXA).toBe("taxa da plataforma");
    expect(TAXA_COM_OUTRO_NOME.test("a taxa da CLYON")).toBe(true);
    expect(TAXA_COM_OUTRO_NOME.test("a comissão")).toBe(true);
    expect(TAXA_COM_OUTRO_NOME.test("já com a taxa da plataforma")).toBe(false);
    expect(GRAFIA_ANTIGA.test("Há factura em todas as vendas")).toBe(true);
    expect(GRAFIA_ANTIGA.test("Há fatura em todas as vendas")).toBe(false);
  });
});
