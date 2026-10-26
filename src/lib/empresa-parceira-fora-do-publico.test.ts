import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { ENTIDADE_QUE_FACTURA } from "./entidade-que-factura";
import { EMPRESA_PARCEIRA_AO_PUBLICO, QUEM_FACTURA_EM_PALAVRAS } from "./identificacao-legal";
import { FACTURA_EM_PALAVRAS, NOTA_DE_PRECO } from "./seo-data";
import { PASSOS_DO_PROFISSIONAL } from "./como-funciona-para-o-profissional";
import { PERGUNTAS_DO_PROFISSIONAL } from "./ajuda-plataforma";
import { mensagemDaReferencia } from "./mensagem-da-referencia";
import { NOTA_DO_IVA, contaDaLinha } from "./conta-do-pagamento";
import { conteudoDoComprovativo } from "./comprovativo-pdf";

/**
 * A EMPRESA PARCEIRA QUE EMITE AS FACTURAS NÃO SE EXPÕE AO PÚBLICO — 26-10-2026.
 *
 * O dono: ela não é a CLYON, é uma empresa parceira, e o nome dela só vai nas
 * facturas impressas, a que só o cliente tem acesso. O site, as páginas em
 * inglês, os dados estruturados, os emails, as mensagens, o comprovativo em
 * PDF, o painel do profissional e a app Pro dizem «a empresa parceira da
 * CLYON» — sem nome nem NIF. O backoffice continua a mostrar o nome à equipa.
 *
 * Três guardas:
 *   1. nenhum ficheiro fora do backoffice tem o nome dela (nem em comentário)
 *      e nenhum ficheiro, em lado nenhum, tem o NIF dela fora de
 *      `entidade-que-factura.ts`;
 *   2. nenhuma página pública, rota pública ou ecrã da app chega, por
 *      importações, a `entidade-que-factura.ts` — senão o nome ia no
 *      JavaScript que o browser descarrega, mesmo sem aparecer no ecrã;
 *   3. as frases que saem (rodapés, emails, mensagens, ajuda, comprovativo)
 *      dizem a categoria e não o nome.
 */

const RAIZ = process.cwd();
const rel = (p: string) => relative(RAIZ, p).split("\\").join("/");

const BACKOFFICE = ["src/app/admin/", "src/app/api/admin/", "src/components/admin/"];
const eDoBackoffice = (f: string) => BACKOFFICE.some((b) => f.startsWith(b));
const MODULO_INTERNO = "src/lib/entidade-que-factura.ts";

const eTeste = (f: string) => /\.test\.[cm]?[jt]sx?$/.test(f);
const TEXTO = /\.(ts|tsx|js|mjs|cjs|json|md|txt|xml|html|css|webmanifest)$/;
const FORA = new Set(["node_modules", ".next", ".expo", "android", "ios", "dist", "build", ".git"]);

function ficheiros(pasta: string): string[] {
  const abs = join(RAIZ, pasta);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [rel(abs)];
  const fora: string[] = [];
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    if (FORA.has(e.name)) continue;
    const p = join(abs, e.name);
    if (e.isDirectory()) fora.push(...ficheiros(rel(p)));
    else if (TEXTO.test(e.name)) fora.push(rel(p));
  }
  return fora;
}

/** Tudo o que pode chegar a um cliente, a um profissional ou ao público. */
const TODOS = [
  ...ficheiros("src"),
  ...ficheiros("app-pro/src"),
  ...ficheiros("app-pro/app.json"),
  ...ficheiros("public"),
  ...ficheiros("ponte-whatsapp/index.js"),
].filter((f) => !eTeste(f));

const ler = (f: string) => readFileSync(join(RAIZ, f), "utf8");
const NOME = /miragem/i;
const nifComEspacos = new RegExp(ENTIDADE_QUE_FACTURA.nif.split("").join("[\\s.]?"));

describe("o nome e o NIF da parceira não estão em nada do que é público", () => {
  it("a varredura apanha os sítios certos (senão passava às cegas)", () => {
    for (const f of [
      "src/app/termos/page.tsx",
      "src/app/privacidade/page.tsx",
      "src/app/en/[pagina]/page.tsx",
      "src/lib/seo-data.ts",
      "src/lib/comprovativo-pdf.ts",
      "src/lib/email-pedido.ts",
      "src/app/profissionais/painel/PainelDoProfissional.tsx",
      "app-pro/src/app/(app)/conta.tsx",
      MODULO_INTERNO,
    ]) {
      expect(TODOS, f).toContain(f);
    }
    expect(TODOS.length).toBeGreaterThan(500);
  });

  it("nenhum ficheiro fora do backoffice tem o nome dela — nem num comentário", () => {
    const comNome = TODOS.filter((f) => f !== MODULO_INTERNO && !eDoBackoffice(f)).filter((f) =>
      NOME.test(ler(f)),
    );
    expect(comNome).toEqual([]);
  });

  it("o NIF dela só existe no módulo interno — nem o backoffice o escreve à mão", () => {
    const comNif = TODOS.filter((f) => f !== MODULO_INTERNO).filter((f) => nifComEspacos.test(ler(f)));
    expect(comNif).toEqual([]);
    // E o módulo interno ainda o tem: é dele que o backoffice o lê.
    expect(nifComEspacos.test(ler(MODULO_INTERNO))).toBe(true);
  });
});

/*
 * O GRAFO DAS IMPORTAÇÕES. Um módulo importado por um ecrã público vai no
 * JavaScript desse ecrã. Conta-se só o que leva código (`import type` some na
 * compilação).
 */
const CODIGO = TODOS.filter((f) => /\.(ts|tsx|js|mjs)$/.test(f));
const IMPORTA =
  /(?:^|[\s;])(?:import|export)\s+(?!type\s)(?:[^'"`;]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

function resolver(de: string, alvo: string): string | null {
  let base: string;
  if (alvo.startsWith("@/")) base = join(RAIZ, "src", alvo.slice(2));
  else if (alvo.startsWith(".")) base = resolve(join(RAIZ, dirname(de)), alvo);
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(c) && statSync(c).isFile()) return rel(c);
  }
  return null;
}

const quemImporta = new Map<string, Set<string>>();
for (const f of CODIGO) {
  for (const m of ler(f).matchAll(IMPORTA)) {
    const alvo = resolver(f, m[1] ?? m[2]);
    if (!alvo) continue;
    if (!quemImporta.has(alvo)) quemImporta.set(alvo, new Set());
    quemImporta.get(alvo)!.add(f);
  }
}

/** Todos os ficheiros que, directa ou indirectamente, levam o módulo consigo. */
function quemChegaA(modulo: string): Set<string> {
  const vistos = new Set<string>();
  const fila = [modulo];
  while (fila.length) {
    const atual = fila.shift()!;
    for (const q of quemImporta.get(atual) ?? []) {
      if (!vistos.has(q)) {
        vistos.add(q);
        fila.push(q);
      }
    }
  }
  return vistos;
}

describe("só o backoffice importa o nome dela", () => {
  const chegam = quemChegaA(MODULO_INTERNO);

  it("o grafo funciona: a conta em degraus do backoffice chega lá", () => {
    expect([...chegam]).toContain("src/lib/contas-do-trabalho-clyon.ts");
    expect([...chegam].some(eDoBackoffice)).toBe(true);
  });

  it("nenhuma página, rota ou ecrã fora do backoffice o leva no código", () => {
    /*
     * Os módulos de src/lib e src/components são caminho, não destino: o que
     * vai para o browser ou sai para o cliente começa numa página ou rota de
     * src/app, no middleware ou num ecrã da app Pro. Se um desses chegar ao
     * módulo interno sem ser do backoffice, o nome vai com ele.
     *
     * UMA EXCEPÇÃO, com razão escrita: /comprovativo/<token> é uma rota do
     * servidor (o código não vai para o browser) e devolve só o PDF, cujo
     * conteúdo se confere em baixo («o comprovativo, nas duas pontas»). Ela
     * passa pela conta em degraus, que traz o nome para o backoffice. Uma rota
     * pública nova que chegue lá chumba aqui, e decide-se então.
     */
    const SO_SERVIDOR_E_CONFERIDA = new Set(["src/app/comprovativo/[token]/route.ts"]);
    const entradasPublicas = [...chegam].filter(
      (f) =>
        !eDoBackoffice(f) &&
        !SO_SERVIDOR_E_CONFERIDA.has(f) &&
        (f.startsWith("src/app/") || f.startsWith("app-pro/") || /^src\/(middleware|instrumentation)/.test(f)),
    );
    expect(entradasPublicas).toEqual([]);
    for (const f of SO_SERVIDOR_E_CONFERIDA) expect(f.endsWith("/route.ts"), f).toBe(true);
  });

  it("e o que liga ao público (identificacao-legal) já não o importa", () => {
    expect(chegam.has("src/lib/identificacao-legal.ts")).toBe(false);
    expect(chegam.has("src/lib/seo-data.ts")).toBe(false);
    expect(chegam.has("src/lib/comprovativo-pdf.ts")).toBe(false);
  });
});

describe("as frases que saem dizem a categoria", () => {
  const proibidas = [ENTIDADE_QUE_FACTURA.nomeCurto, ENTIDADE_QUE_FACTURA.nif];
  const semNome = (t: string, onde: string) => {
    for (const p of proibidas) expect(t, onde).not.toContain(p);
  };

  it("rodapés, páginas de preços, ajuda e «como funciona» do profissional", () => {
    expect(EMPRESA_PARCEIRA_AO_PUBLICO).toBe("empresa parceira da CLYON");
    semNome(QUEM_FACTURA_EM_PALAVRAS, "QUEM_FACTURA_EM_PALAVRAS");
    semNome(FACTURA_EM_PALAVRAS, "FACTURA_EM_PALAVRAS");
    semNome(NOTA_DE_PRECO.completa, "NOTA_DE_PRECO");
    for (const p of PASSOS_DO_PROFISSIONAL) semNome(`${p.titulo} ${p.texto}`, `passo ${p.chave}`);
    for (const p of PERGUNTAS_DO_PROFISSIONAL) semNome(`${p.pergunta} ${p.resposta}`, p.pergunta);
    expect(FACTURA_EM_PALAVRAS).toContain(EMPRESA_PARCEIRA_AO_PUBLICO);
  });

  it("a mensagem da referência ao cliente", () => {
    const m = mensagemDaReferencia({
      pedidoId: 12,
      metodo: "multibanco",
      valor: 129.15,
      entidade: "12345",
      referencia: "123 456 789",
      comFactura: true,
    });
    semNome(m, "mensagem da referência");
    expect(m).toContain(QUEM_FACTURA_EM_PALAVRAS);
  });

  it("o comprovativo, nas duas pontas — tudo o que o PDF escreve", () => {
    const conta = contaDaLinha(
      {
        valorAcordado: 282,
        taxaCliente: 0,
        taxaProfissional: 0.11,
        formaDePagamento: "na_plataforma",
        negociacaoCriadaEm: "2026-10-23T10:00:00Z",
        semFactura: 0,
      },
      true,
    )!;
    // A conta em degraus leva o nome (é do backoffice); o PDF não pode.
    expect(JSON.stringify(conta)).toContain(ENTIDADE_QUE_FACTURA.nomeCurto);
    for (const para of ["cliente", "profissional"] as const) {
      const c = conteudoDoComprovativo(
        {
          para,
          pedidoId: 904,
          cliente: "Rui Exemplo",
          telefoneDoCliente: "960 000 029",
          cidade: "Lisboa",
          servico: "recolha_moveis",
          profissional: "Recolhas Exemplo",
          dataDoTrabalho: "2026-10-23T14:40:00Z",
          semFactura: false,
          conta,
          pagoEm: "2026-10-23T16:53:00Z",
          como: "Transferência",
        },
        new Date("2026-10-24T10:00:00Z"),
      );
      semNome(JSON.stringify(c), `comprovativo do ${para}`);
    }
  });

  it("e o backoffice continua a dizer à equipa para quem vai o IVA, com o nome", () => {
    expect(NOTA_DO_IVA).toContain(ENTIDADE_QUE_FACTURA.nomeCurto);
  });
});
