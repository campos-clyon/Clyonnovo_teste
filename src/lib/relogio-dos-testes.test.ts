import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { ANTES_DO_MODELO, DEPOIS_DO_MODELO, relogioEm, relogioReal } from "./relogio-dos-testes";
import { NOVO_MODELO_DESDE, novoModeloEmVigor } from "./novo-modelo";

/*
 * O GUARDA DO RELÓGIO — d29, 15-11-2026.
 *
 * À meia-noite de 15-11-2026 ~26 testes chumbaram de uma vez: chamavam o que
 * depende da data do modelo (`novo-modelo.ts`) sem dizer a data, e provavam o
 * modelo antigo com o relógio verdadeiro. A main ficou vermelha sem ninguém ter
 * mexido em nada.
 *
 * Este guarda varre os testes. Um teste que TOCA NO MODELO — usa uma função com
 * `agora` por omissão de um módulo que lê a data do modelo, ou chama uma rota ou
 * página que lê `agoraDoModelo()` — tem de dizer em que dia está:
 *
 *   · o relógio dos testes (`relogio-dos-testes.ts`: `comORelogioEm`, `relogioEm`);
 *   · `vi.setSystemTime`;
 *   · o relógio do modelo simulado (`vi.mock("@/lib/relogio-do-modelo", …)`); ou
 *   · a nota `// relógio: datas explícitas` — quem a põe passa a data em TODAS as
 *     chamadas.
 *
 * Os testes que já existiam e passam com qualquer data ficam na lista de baixo,
 * que só pode encolher: um teste novo não entra nela.
 *
 * Só se lê o código-fonte (regras da memória «testes que lêem o código-fonte»:
 * CRLF fora, comentários tirados só com a regra ancorada ao início da linha).
 */

const RAIZ = join(__dirname, "..", "..");
const SRC = join(RAIZ, "src");
const ler = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

function ficheiros(dir: string, fora: (f: string) => boolean = () => false): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    const f = join(dir, nome);
    if (statSync(f).isDirectory()) out.push(...ficheiros(f, fora));
    else if (/\.(ts|tsx)$/.test(nome) && !fora(f)) out.push(f);
  }
  return out;
}

const eTeste = (f: string) => /\.(test|spec)\.tsx?$/.test(f);
const TODOS = ficheiros(SRC);
const FONTES = TODOS.filter((f) => !eTeste(f));
const TESTES = TODOS.filter(eTeste);
const rel = (f: string) => relative(RAIZ, f).replace(/\\/g, "/");

/** Importa o relógio do modelo (`novo-modelo`, `novo-modelo-no-servidor`, `relogio-do-modelo`)? */
const LE_O_MODELO = /from\s+["'](?:\.{1,2}\/|@\/lib\/)(?:[\w-]+\/)*(?:novo-modelo|novo-modelo-no-servidor|relogio-do-modelo)["']/;

/** As funções exportadas com `agora` por omissão, nos módulos que lêem o modelo. */
function funcoesDoRelogio(): Map<string, string> {
  const nomes = new Map<string, string>();
  for (const f of FONTES) {
    const s = semComentarios(ler(f));
    const doModelo = LE_O_MODELO.test(s) || /[\\/]lib[\\/]novo-modelo\.ts$/.test(f);
    if (!doModelo) continue;
    // Os parâmetros podem ter parênteses dentro (`agora = new Date()`): um nível chega.
    const re = /export\s+(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(((?:[^()]|\([^()]*\))*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      if (/agora(?:\s*:\s*Date)?\s*=\s*(?:new Date\(\)|agoraDoModelo\(\))/.test(m[2])) nomes.set(m[1], rel(f));
    }
  }
  return nomes;
}

/** O ficheiro de um caminho importado (`@/…` ou relativo), se existir. */
function resolver(de: string, caminho: string): string | null {
  const base = caminho.startsWith("@/") ? join(SRC, caminho.slice(2)) : caminho.startsWith(".") ? join(dirname(de), caminho) : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const f = base + ext;
    if (existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
}

/** As rotas e páginas (src/app) que lêem `agoraDoModelo()`, nelas ou num módulo que importam. */
function ecrasDoRelogio(): Set<string> {
  const lido = new Map<string, boolean>();
  const leAgora = (f: string): boolean => {
    if (!lido.has(f)) lido.set(f, /agoraDoModelo\(\)/.test(semComentarios(ler(f))));
    return lido.get(f)!;
  };
  const out = new Set<string>();
  for (const f of FONTES) {
    if (!rel(f).startsWith("src/app/")) continue;
    const s = semComentarios(ler(f));
    if (leAgora(f)) {
      out.add(f);
      continue;
    }
    for (const m of s.matchAll(/from\s+["']([^"']+)["']/g)) {
      const alvo = resolver(f, m[1]);
      if (alvo && !eTeste(alvo) && leAgora(alvo)) {
        out.add(f);
        break;
      }
    }
  }
  return out;
}

const DIZ_O_DIA = /relogio-dos-testes|setSystemTime|vi\.mock\(\s*["']@\/lib\/relogio-do-modelo["']|relógio: datas explícitas/;

function testesQueTocamNoModelo(): Map<string, string> {
  const funcoes = funcoesDoRelogio();
  const ecras = ecrasDoRelogio();
  const out = new Map<string, string>();
  for (const t of TESTES) {
    if (rel(t) === "src/lib/relogio-dos-testes.test.ts") continue;
    const s = semComentarios(ler(t));
    // Um nome dentro de um texto («expect(rota).toContain("f(")») não é uma chamada.
    const semTextos = s.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
    let porque: string | null = null;
    for (const [nome, de] of funcoes) {
      if (new RegExp(`\\b${nome}\\s*\\(`).test(semTextos)) {
        porque = `chama ${nome} (${de})`;
        break;
      }
    }
    if (!porque) {
      for (const m of s.matchAll(/(?:from\s+|import\(\s*)["']([^"']+)["']/g)) {
        const alvo = resolver(t, m[1]);
        if (alvo && ecras.has(alvo)) {
          porque = `chama ${rel(alvo)}`;
          break;
        }
      }
    }
    if (porque) out.set(rel(t), porque);
  }
  return out;
}

/*
 * OS QUE JÁ EXISTIAM A 15-11-2026 e passam com qualquer data (passam a data em
 * cada chamada, ou só provam o que não muda com ela). SÓ PODE ENCOLHER: quem
 * mexer num destes e lhe der o relógio, tira-o daqui.
 */
const JA_EXISTIAM: ReadonlySet<string> = new Set([
  "src/lib/a-conta-so-mostra-o-que-e-do-cliente.test.ts",
  "src/lib/a-conversa-da-leonor.test.ts",
  "src/lib/a-fotografia-que-nao-chegou.test.ts", // d34 (I&D), entrou em paralelo a 15-11
  "src/lib/a-conversa-da-mudanca-pela-lista.test.ts",
  "src/lib/a-conversa-do-oliver.test.ts",
  "src/lib/a-vitoria-aprende.test.ts",
  "src/lib/a-vitoria-no-novo-modelo.test.ts",
  "src/lib/a-vitoria-responde-aos-profissionais.test.ts",
  "src/lib/aceito-este-preco.test.ts",
  "src/lib/adjudicacao-com-referencia.test.ts",
  "src/lib/apagar-conta-com-valor-por-pagar.test.ts",
  "src/lib/app-cliente-parceiros-da-mudanca.test.ts",
  "src/lib/apps-d10-novo-modelo.test.ts",
  "src/lib/apps-d10-os-dois-modos.test.ts",
  "src/lib/apps-d18-o-modelo-novo-nas-apps.test.ts",
  "src/lib/campos-da-candidatura.test.ts",
  "src/lib/conferir-pagamentos-rotina.test.ts",
  "src/lib/conta-da-mudanca.test.ts",
  "src/lib/contacto-so-enquanto-ha-trabalho.test.ts",
  "src/lib/conversa-com-a-clyon.test.ts",
  "src/lib/corte-das-sessoes.test.ts",
  "src/lib/d13-transferencia-igual-no-site-e-na-app.test.ts",
  "src/lib/d17-o-mesmo-total-em-todo-o-lado.test.ts",
  "src/lib/d24-correccoes-baixas.test.ts",
  "src/lib/d24-email-da-conta-so-do-administrador.test.ts",
  "src/lib/d24-email-do-pedido-so-do-administrador.test.ts",
  "src/lib/d24-token-do-pagamento-no-cabecalho.test.ts",
  "src/lib/d26-conferencia-avisa-como-o-webhook.test.ts",
  "src/lib/d26-preco-mudou-so-se-mudou.test.ts",
  "src/lib/d27-guardas-de-estado-na-base.test.ts",
  "src/lib/d27-um-cancelado-fica-cancelado.test.ts",
  "src/lib/dados-de-pagamento-mudados.test.ts",
  "src/lib/duas-apps-no-mesmo-email.test.ts",
  "src/lib/entrada-presa-ao-telemovel.test.ts",
  "src/lib/entulho-e-moveis-d7.test.ts",
  "src/lib/erros-da-app-de-cliente.test.ts",
  "src/lib/erros-da-app.test.ts",
  "src/lib/filtro-de-contactos-m1.test.ts",
  "src/lib/filtro-de-contactos.test.ts",
  "src/lib/fotografias-da-carrinha-na-lista.test.ts",
  "src/lib/fotografias-da-carrinha.test.ts",
  "src/lib/hora-preferida-da-app.test.ts",
  "src/lib/interruptor-da-retencao.test.ts",
  "src/lib/juntar-a-conta-na-mesa.test.ts",
  "src/lib/manutencao-e-iva-o-que-faltava.test.ts",
  "src/lib/manutencao-em-todo-o-lado-fecho.test.ts",
  "src/lib/manutencao-em-todo-o-lado.test.ts",
  "src/lib/margem-de-referencia.test.ts",
  "src/lib/mudancas-com-parceiros-nas-apps.test.ts",
  "src/lib/novo-modelo.test.ts",
  "src/lib/origem-no-pedido-feito-a-mao.test.ts",
  "src/lib/orquestra.test.ts",
  "src/lib/pagina-para-empresas.test.ts",
  "src/lib/pedido-da-app-de-cliente.test.ts",
  "src/lib/pedido-do-link-na-app.test.ts",
  "src/lib/percurso-so-enquanto-ha-trabalho.test.ts",
  "src/lib/porque-e-que-a-leitura-falhou.test.ts",
  "src/lib/programa-da-app.test.ts",
  "src/lib/recusar-proposta.test.ts",
  "src/lib/rotas-que-nao-mentem.test.ts",
  "src/lib/servicos-fora-do-plano.test.ts",
  "src/lib/sessao-da-app.test.ts",
  "src/lib/sessao-do-cliente.test.ts",
  "src/lib/simulador-por-categoria.test.ts",
  "src/lib/textos-do-novo-modelo.test.ts",
  "src/lib/textos-do-pagamento-d16.test.ts",
  "src/lib/trabalho-no-terreno.test.ts",
  "src/lib/uma-so-tabela-de-estados.test.ts",
  "src/lib/visto-pelo-cliente.test.ts",
  "src/lib/webhook-do-eupago-rota.test.ts",
]);

describe("o guarda do relógio — d29", () => {
  const tocam = testesQueTocamNoModelo();

  it("encontra o que deve (o próprio caso de 15-11 seria apanhado)", () => {
    expect(funcoesDoRelogio().has("perguntasDoProfissional")).toBe(true);
    expect(funcoesDoRelogio().has("validarInscricao")).toBe(true);
    expect(funcoesDoRelogio().has("eDoNovoModelo")).toBe(true);
    expect(ecrasDoRelogio().has(join(SRC, "app", "api", "cliente", "catalogo", "route.ts"))).toBe(true);
    expect(tocam.has("src/lib/ajuda-le-a-taxa-em-vigor.test.ts")).toBe(true);
  });

  it("todo o teste que toca no modelo diz em que dia está", () => {
    const sem = [...tocam]
      .filter(([f]) => !JA_EXISTIAM.has(f) && !DIZ_O_DIA.test(ler(join(RAIZ, f))))
      .map(([f, porque]) => `${f} — ${porque}`);
    expect(sem, "use relogio-dos-testes.ts (comORelogioEm / relogioEm) ou passe a data").toEqual([]);
  });

  it("a lista dos que já existiam só tem quem ainda precisa dela", () => {
    const aMais = [...JA_EXISTIAM].filter((f) => !tocam.has(f) || DIZ_O_DIA.test(ler(join(RAIZ, f))));
    expect(aMais, "tire-os da lista JA_EXISTIAM").toEqual([]);
  });
});

describe("o relógio dos testes", () => {
  it("os dois dias ficam um de cada lado da data do modelo", () => {
    expect(novoModeloEmVigor(ANTES_DO_MODELO)).toBe(false);
    expect(novoModeloEmVigor(DEPOIS_DO_MODELO)).toBe(true);
    expect(ANTES_DO_MODELO.getTime()).toBeLessThan(NOVO_MODELO_DESDE.getTime());
  });

  it("finge só o Date, e devolve o verdadeiro", () => {
    relogioEm(ANTES_DO_MODELO);
    try {
      expect(Date.now()).toBe(ANTES_DO_MODELO.getTime());
      expect(novoModeloEmVigor()).toBe(false);
    } finally {
      relogioReal();
    }
    expect(Math.abs(Date.now() - new Date().getTime())).toBeLessThan(1000);
    expect(Date.now()).toBeGreaterThan(new Date("2026-01-01T00:00:00Z").getTime());
  });
});
