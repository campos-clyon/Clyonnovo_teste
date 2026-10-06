/**
 * AS SECÇÕES QUE SE DÃO A UM ASSISTENTE ABREM MESMO — 03-10-2026.
 *
 * Decisão do dono: em Gerir › Assistentes, a lista «Acessos desta conta»
 * passou a oferecer todas as secções do menu menos «Assistentes». Dar uma
 * secção é abrir duas coisas ao mesmo tempo — o ecrã no menu dela E as rotas
 * de API que esse ecrã chama. A segunda é a que se esquece: o ecrã abre, cada
 * botão dá 403, e ninguém percebe porquê. Foi o que aconteceu ao Suporte a
 * 21-09-2026.
 *
 * Por isso este teste NÃO tem a lista das rotas escrita à mão. Lê o código:
 *
 *   1. em `LegacyAdminClient.tsx`, o bloco que desenha cada secção
 *      (`{activeSection === "…" && …}`), os componentes que lá se usam, e os
 *      `fetch("/api/…")` desses componentes e de tudo o que eles importam;
 *   2. para cada rota encontrada, o `route.ts` que a serve — e se esse usa
 *      `requireAdmin` (que deixa passar o assistente com a secção) ou só
 *      `requireAdminGeral` (só o administrador);
 *   3. e confirma, com `assistenteComSeccoesPodeChamar`, que um assistente
 *      com SÓ essa secção chega lá.
 *
 * O que fica de fora fica de propósito, e está em `SO_DO_ADMINISTRADOR` com a
 * razão — e o teste confirma que está mesmo fechado.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import {
  papelMexeNoDinheiro,
  assistenteComSeccoesPodeChamar,
  assistentePodeChamar,
  assistentePodeVerSeccao,
  normalizarSeccoes,
  PREFIXOS_DE_API_DO_ASSISTENTE,
  rotaDeTodosOsAssistentes,
  SECCOES_DAS_CONTAS_ANTIGAS,
  SECCOES_DO_ASSISTENTE,
  seccoesGuardadas,
  type SeccaoDoAssistente,
} from "./papel-do-painel";

const RAIZ = process.cwd();
const SRC = join(RAIZ, "src");
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

/** Os comentários saem; só os que começam a linha (ver tirar-comentarios-sem-comer-codigo). */
const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const PAINEL_REL = "src/components/admin/LegacyAdminClient.tsx";
const PAINEL = semNotas(ler(PAINEL_REL));

// ─── Ler o código ───────────────────────────────────────────────────────────

function resolver(de: string, especificador: string): string | null {
  let base: string;
  if (especificador.startsWith("@/")) base = join(SRC, especificador.slice(2));
  else if (especificador.startsWith(".")) base = join(dirname(de), especificador);
  else return null;
  for (const ext of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    const f = base + ext;
    if (existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
}

/** Os imports de um ficheiro que trazem código (os `import type` não trazem). */
function importsDe(ficheiro: string, fonte: string): Array<{ clausula: string; ficheiro: string }> {
  const fora: Array<{ clausula: string; ficheiro: string }> = [];
  for (const m of fonte.matchAll(/^import\s+(?!type\s)([\s\S]*?)\s+from\s+["']([^"']+)["']/gm)) {
    const f = resolver(ficheiro, m[2]);
    if (f) fora.push({ clausula: m[1], ficheiro: f });
  }
  // `await import("…")`, dentro de uma função.
  for (const m of fonte.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) {
    const f = resolver(ficheiro, m[1]);
    if (f) fora.push({ clausula: "", ficheiro: f });
  }
  return fora;
}

/*
 * Ficam de fora do fecho: o próprio painel (é ele que se parte em secções) e
 * a lista das permissões, que tem rotas escritas mas não as chama.
 */
const FORA_DO_FECHO = [join(SRC, "components", "admin", "LegacyAdminClient.tsx"), join(SRC, "lib", "papel-do-painel.ts")];

function fecho(ficheiro: string, vistos = new Set<string>()): Set<string> {
  if (vistos.has(ficheiro) || FORA_DO_FECHO.includes(ficheiro)) return vistos;
  vistos.add(ficheiro);
  const fonte = readFileSync(ficheiro, "utf8");
  for (const i of importsDe(ficheiro, fonte)) fecho(i.ficheiro, vistos);
  return vistos;
}

/** "/api/admin/pedidos/${id}/editar" → "/api/admin/pedidos/1/editar"; o resto do template sai. */
function normalizarRota(bruto: string): string {
  let s = bruto.replace(/\/\$\{[^}]*\}/g, "/1");
  const i = s.indexOf("${");
  if (i >= 0) s = s.slice(0, i);
  return s.replace(/\/+$/, "");
}

function rotasNoTexto(texto: string): Set<string> {
  const fora = new Set<string>();
  for (const m of texto.matchAll(/["'`](\/api\/(?:\$\{[^}]*\}|[^"'`?\s$#])*)/g)) {
    fora.add(normalizarRota(m[1]));
  }
  return fora;
}

/** O `route.ts` que serve um caminho, com os `[id]` e os `[...path]` do Next. */
function ficheiroDaRota(caminho: string): string | null {
  const partes = caminho.split("/").filter(Boolean);
  let dir = join(SRC, "app");
  for (const p of partes) {
    const exacto = join(dir, p);
    if (existsSync(exacto) && statSync(exacto).isDirectory()) {
      dir = exacto;
      continue;
    }
    const filhos = readdirSync(dir);
    const resto = filhos.find((n) => /^\[\.\.\..+\]$/.test(n));
    const dinamico = filhos.find((n) => /^\[[^.].*\]$/.test(n));
    if (dinamico) {
      dir = join(dir, dinamico);
      continue;
    }
    if (resto) {
      dir = join(dir, resto);
      break;
    }
    return null;
  }
  const f = join(dir, "route.ts");
  return existsSync(f) ? f : null;
}

type Tranca = "requireAdmin" | "so-administrador" | "outra";

/** Que tranca tem a rota: a que deixa passar o assistente com a secção, ou só o administrador. */
function trancaDaRota(ficheiro: string): Tranca {
  const codigo = semNotas(readFileSync(ficheiro, "utf8"));
  if (/import\s*\{[^}]*\brequireAdmin\b[^}]*\}\s*from\s*["']@\/lib\/admin-auth-helper["']/.test(codigo)) {
    return "requireAdmin";
  }
  if (codigo.includes("requireAdminGeral")) return "so-administrador";
  return "outra";
}

// ─── As secções no painel ───────────────────────────────────────────────────

/** Os ids do menu, pela ordem de `NAV_GRUPOS`. */
function idsDoMenu(): string[] {
  const inicio = PAINEL.indexOf("const NAV_GRUPOS");
  const fim = PAINEL.indexOf("];", inicio);
  const bloco = PAINEL.slice(inicio, fim);
  const ids: string[] = [];
  for (const m of bloco.matchAll(/itens:\s*\[([^\]]*)\]/g)) {
    for (const id of m[1].matchAll(/"([a-z_]+)"/g)) ids.push(id[1]);
  }
  return ids;
}

/** O nome de cada componente importado pelo painel → o ficheiro dele. */
function componentesDoPainel(): Map<string, string> {
  const ficheiro = join(RAIZ, PAINEL_REL);
  const m = new Map<string, string>();
  for (const i of importsDe(ficheiro, PAINEL)) {
    const nome = i.clausula.trim().split(/[\s,{]/)[0];
    if (/^[A-Z]/.test(nome)) m.set(nome, i.ficheiro);
  }
  return m;
}

/**
 * O painel partido nos blocos de cada secção. Um bloco vai do seu
 * `{activeSection === "…" &&` até ao seguinte; o que fica antes do primeiro é
 * do painel inteiro (as funções que carregam dados) e vai à parte.
 */
const MARCA_DE_BLOCO = /\{\(?activeSection === "([a-z_]+)"(?:\s*\|\|\s*activeSection === "([a-z_]+)"\))?\s*&&/g;

function blocosDoPainel(): { foraDasSeccoes: string; blocos: Array<{ ids: string[]; texto: string }> } {
  const marcas = [...PAINEL.matchAll(MARCA_DE_BLOCO)];
  const blocos = marcas.map((m, i) => ({
    ids: [m[1], m[2]].filter((x): x is string => Boolean(x)),
    texto: PAINEL.slice(m.index, i + 1 < marcas.length ? marcas[i + 1].index : PAINEL.length),
  }));
  return { foraDasSeccoes: PAINEL.slice(0, marcas[0]?.index ?? 0), blocos };
}

/*
 * AS CHAMADAS DO PAINEL QUE NÃO ESTÃO DENTRO DE UM BLOCO — as funções que
 * carregam dados para uma secção, escritas no corpo do painel. Aqui sim, à
 * mão: o código não diz para que secção é cada função. Mas o teste exige que
 * TODAS as que lá estão apareçam nesta lista — um `fetch` novo no painel sem
 * secção atribuída chumba.
 *
 * `null` = não é de nenhuma secção que se dê; ou é de todos (`"todas"`).
 */
const CHAMADAS_FORA_DOS_BLOCOS: Record<string, SeccaoDoAssistente | "todas" | null> = {
  "/api/admin/sessao/eu": "todas",
  "/api/admin/pedidos": "pedidos",
  // Arquivar em lote, na tabela dos pedidos.
  "/api/admin/pedidos/1/reject": "pedidos",
  "/api/admin/suporte": "suporte",
  "/api/admin/suporte/conversas": "suporte",
  "/api/admin/suporte/1": "suporte",
  "/api/admin/suporte/1/mensagens": "suporte",
  "/api/admin/leads": "leads",
  "/api/admin/lead-events": "leads",
  "/api/admin/taxas": "configs",
  "/api/media/gallery": "configs",
  "/api/colaboradores/admin/settings/simulador": "configs",
  "/api/admin/seguranca/alterar-senha": "configs",
  // Os selos do menu: só o painel do administrador os usa com proveito; ao
  // assistente a rota responde 403 e o selo fica a zero, como até aqui.
  "/api/admin/novidades": null,
};

/*
 * O QUE UMA SECÇÃO CHAMA E O ASSISTENTE NÃO PODE — de propósito, com a razão.
 * O teste confirma que cada uma está mesmo fechada a quem só tem a secção.
 */
const SO_DO_ADMINISTRADOR: Array<{ seccao: SeccaoDoAssistente; rota: string; porque: string }> = [
  { seccao: "negociacoes_clyon", rota: "/api/admin/negociacoes/apagar", porque: "apagar é do administrador" },
  { seccao: "negociacoes_clyon", rota: "/api/admin/pagamentos/criar", porque: "gerar a referência euPago é do administrador (18-09-2026)" },
  { seccao: "negociacoes_clyon", rota: "/api/admin/pagamentos/conferir", porque: "vem com a referência — do administrador" },
  { seccao: "negociacoes_clyon", rota: "/api/admin/whatsapp", porque: "enviar pelo WhatsApp da CLYON pede também a secção WhatsApp" },
  // O «Trabalho CLYON» do «Por enviar» (06-10-2026): oferecer a valor fixo é
  // dos Trabalhos CLYON, e o botão só aparece a quem tem essa secção.
  { seccao: "negociacoes_clyon", rota: "/api/admin/trabalhos-clyon", porque: "oferecer a valor fixo pede também a secção Trabalhos CLYON" },
  { seccao: "negociacoes_clyon", rota: "/api/admin/profissionais", porque: "escolher a quem oferecer, no Trabalho CLYON — pede também essa secção" },
  { seccao: "pagamentos", rota: "/api/admin/pagamentos/excluir", porque: "excluir um trabalho é do administrador, com motivo" },
  { seccao: "pagamentos", rota: "/api/admin/pagamentos/testar", porque: "testar a chave do euPago é configuração do administrador" },
  { seccao: "pagamentos", rota: "/api/admin/profissionais/1", porque: "marcar conta de teste é do administrador; mexer no profissional é da secção Profissionais" },
  { seccao: "configs", rota: "/api/admin/livro", porque: "o livro da carteira não é configuração — escreve-se uma vez e não se reescreve" },
  { seccao: "configs", rota: "/api/admin/seguranca/alterar-senha", porque: "a palavra-passe do administrador é dele" },
  { seccao: "configs", rota: "/api/colaboradores/admin/settings/simulador", porque: "os valores do motor já não aparecem no ecrã, e um deles é o pagamento aos assistentes" },
  // «Só ver» — 03-10-2026: as rotas que SÓ escrevem dinheiro ficam inteiras com o administrador.
  { seccao: "carteiras", rota: "/api/admin/negociacoes/valor", porque: "corrigir o valor é dinheiro" },
  { seccao: "pagamentos", rota: "/api/admin/negociacoes/valor", porque: "corrigir o valor é dinheiro" },
  { seccao: "agenda", rota: "/api/admin/negociacoes/valor", porque: "corrigir o valor é dinheiro, também na agenda" },
  { seccao: "pagamentos", rota: "/api/admin/pagamentos/recebido", porque: "registar o que o cliente pagou desbloqueia dinheiro" },
  { seccao: "pagamentos", rota: "/api/admin/pagamentos/pago-ao-profissional", porque: "registar o que se pagou ao profissional" },
  { seccao: "app_clyon", rota: "/api/admin/app-clyon/creditos/acoes", porque: "creditar a carteira e confirmar compras de créditos" },
  { seccao: "app_clyon", rota: "/api/admin/app-clyon/reservas-por-pagar", porque: "processar prazos cancela pedidos por pagar" },
];

const soDoAdministrador = (s: string, rota: string) =>
  SO_DO_ADMINISTRADOR.some((e) => e.seccao === s && e.rota === rota);

/** Secção → rotas que o ecrã dela chama, lido do código. */
function rotasPorSeccao(): Map<string, Set<string>> {
  const componentes = componentesDoPainel();
  const { foraDasSeccoes, blocos } = blocosDoPainel();
  const porSeccao = new Map<string, Set<string>>();
  const juntar = (s: string, rotas: Iterable<string>) => {
    const c = porSeccao.get(s) ?? new Set<string>();
    for (const r of rotas) c.add(r);
    porSeccao.set(s, c);
  };

  for (const b of blocos) {
    const rotas = rotasNoTexto(b.texto);
    for (const tag of b.texto.matchAll(/<([A-Z][A-Za-z0-9]*)/g)) {
      const f = componentes.get(tag[1]);
      if (!f) continue;
      for (const g of fecho(f)) for (const r of rotasNoTexto(semNotas(readFileSync(g, "utf8")))) rotas.add(r);
    }
    for (const id of b.ids) juntar(id, rotas);
  }

  for (const r of rotasNoTexto(foraDasSeccoes)) {
    const s = CHAMADAS_FORA_DOS_BLOCOS[r];
    if (typeof s === "string" && s !== "todas") juntar(s, [r]);
  }
  return porSeccao;
}

// ─── Os testes ──────────────────────────────────────────────────────────────

describe("o que se oferece é o menu, menos «Assistentes»", () => {
  it("a lista é a do menu, pela ordem do menu", () => {
    const menu = idsDoMenu();
    expect(menu).toContain("equipa");
    expect([...SECCOES_DO_ASSISTENTE]).toEqual(menu.filter((id) => id !== "equipa"));
  });

  it("são estas quinze, com estes ids", () => {
    expect([...SECCOES_DO_ASSISTENTE]).toEqual([
      "overview", "pedidos", "app_clyon", "profissionais", "negociacoes_clyon",
      "trabalhos_clyon", "agenda", "whatsapp", "carteiras", "pagamentos",
      "levantamentos", "leads", "contas", "suporte", "configs",
    ]);
  });

  it("cada secção oferecida tem o seu ecrã, e todos estão dentro da tranca do `podeVer`", () => {
    const { blocos } = blocosDoPainel();
    const comBloco = new Set(blocos.flatMap((b) => b.ids));
    for (const s of SECCOES_DO_ASSISTENTE) expect(comBloco.has(s), s).toBe(true);

    // A tranca abre antes do primeiro ecrã e fecha depois do último, dentro do <main>.
    const marcas = [...PAINEL.matchAll(MARCA_DE_BLOCO)].map((m) => m.index ?? 0);
    const abre = PAINEL.indexOf("{!podeVer(activeSection) ? (");
    const fimDoMain = PAINEL.indexOf("</main>");
    const fecha = PAINEL.lastIndexOf("</>", fimDoMain);
    expect(abre).toBeGreaterThan(0);
    expect(abre).toBeLessThan(Math.min(...marcas));
    expect(fecha).toBeGreaterThan(Math.max(...marcas));
    expect(marcas.every((i) => i < fimDoMain)).toBe(true);
  });
});

describe("cada secção oferecida abre as rotas que o seu ecrã chama", () => {
  const porSeccao = rotasPorSeccao();

  it("o painel não chama nada fora dos blocos sem secção atribuída", () => {
    const { foraDasSeccoes } = blocosDoPainel();
    const encontradas = [...rotasNoTexto(foraDasSeccoes)].sort();
    expect(encontradas).toEqual(Object.keys(CHAMADAS_FORA_DOS_BLOCOS).sort());
  });

  it("encontra rotas em todas as secções — senão é a leitura que se partiu", () => {
    for (const s of SECCOES_DO_ASSISTENTE) {
      expect(porSeccao.get(s)?.size ?? 0, s).toBeGreaterThan(0);
    }
  });

  for (const s of SECCOES_DO_ASSISTENTE) {
    it(`${s}: um assistente só com esta secção chega a tudo o que o ecrã chama`, () => {
      const falham: string[] = [];
      for (const rota of porSeccao.get(s) ?? []) {
        if (soDoAdministrador(s, rota)) continue;
        const f = ficheiroDaRota(rota);
        if (!f) continue; // uma rota que não existe é outro problema, e outro teste
        const tranca = trancaDaRota(f);
        if (tranca === "outra") continue; // rota pública ou com autenticação própria
        if (tranca === "so-administrador") {
          falham.push(`${rota} — ${relative(RAIZ, f)} é só do administrador`);
          continue;
        }
        if (!assistenteComSeccoesPodeChamar([s], rota, "GET")) {
          falham.push(`${rota} — fechada em papel-do-painel.ts`);
        }
      }
      expect(falham, `A secção ${s} abre o ecrã mas não estas rotas:\n${falham.join("\n")}`).toEqual([]);
    });
  }

  it("o que fica só para o administrador está mesmo fechado a quem tem a secção", () => {
    for (const e of SO_DO_ADMINISTRADOR) {
      const f = ficheiroDaRota(e.rota);
      expect(f, e.rota).not.toBeNull();
      const fechadaNaRota = trancaDaRota(f!) === "so-administrador";
      const fechadaNaLista = !assistenteComSeccoesPodeChamar([e.seccao], e.rota, "POST");
      expect(fechadaNaRota || fechadaNaLista, `${e.seccao} → ${e.rota}: ${e.porque}`).toBe(true);
    }
  });

  it("e cada excepção é uma chamada que o ecrã faz mesmo — nada de excepções esquecidas", () => {
    for (const e of SO_DO_ADMINISTRADOR) {
      expect(porSeccao.get(e.seccao)?.has(e.rota), `${e.seccao} → ${e.rota}`).toBe(true);
    }
  });
});

describe("«só ver» nas secções de dinheiro e nas Configs — 03-10-2026", () => {
  /*
   * Decisão do dono: nas Carteiras, Pagamentos, Levantamentos, App CLYON e
   * Configs o assistente VÊ tudo e não mexe em dinheiro nem em taxas.
   */
  const ESCRITAS: Array<[SeccaoDoAssistente, string, string]> = [
    ["carteiras", "POST", "/api/admin/carteiras"],
    ["carteiras", "POST", "/api/admin/negociacoes/valor"],
    ["pagamentos", "POST", "/api/admin/pagamentos/recebido"],
    ["pagamentos", "POST", "/api/admin/pagamentos/pago-ao-profissional"],
    ["pagamentos", "POST", "/api/admin/pagamentos/excluir"],
    ["pagamentos", "POST", "/api/admin/pagamentos/testar"],
    ["pagamentos", "POST", "/api/admin/negociacoes/valor"],
    ["levantamentos", "POST", "/api/admin/levantamentos"],
    ["agenda", "POST", "/api/admin/negociacoes/valor"],
    ["negociacoes_clyon", "POST", "/api/admin/negociacoes/valor"],
    ["configs", "PUT", "/api/admin/taxas"],
    ["app_clyon", "POST", "/api/admin/app-clyon/creditos/acoes"],
    ["app_clyon", "POST", "/api/admin/app-clyon/credit-fee-rules"],
    ["app_clyon", "POST", "/api/admin/app-clyon/cupons"],
    ["app_clyon", "PATCH", "/api/admin/app-clyon/cupons/1"],
    ["app_clyon", "POST", "/api/admin/app-clyon/referencias"],
    ["app_clyon", "POST", "/api/admin/app-clyon/reservas-por-pagar"],
    ["app_clyon", "POST", "/api/admin/app-pedidos/1/proposta"],
    ["app_clyon", "POST", "/api/admin/app-pedidos/1/motor"],
  ];
  const LEITURAS: Array<[SeccaoDoAssistente, string]> = [
    ["carteiras", "/api/admin/carteiras"],
    ["pagamentos", "/api/admin/pagamentos"],
    ["levantamentos", "/api/admin/levantamentos"],
    ["configs", "/api/admin/taxas"],
    ["configs", "/api/admin/retencao"],
    ["app_clyon", "/api/admin/app-clyon/creditos"],
    ["app_clyon", "/api/admin/app-clyon/credit-fee-rules"],
    ["app_clyon", "/api/admin/app-clyon/cupons"],
    ["app_clyon", "/api/admin/app-clyon/referencias"],
    ["app_clyon", "/api/admin/app-pedidos/1/proposta"],
    ["app_clyon", "/api/admin/app-pedidos/1/motor"],
  ];
  // O que não é dinheiro continua do assistente com a secção.
  const ESCRITAS_QUE_FICAM: Array<[SeccaoDoAssistente, string, string]> = [
    ["app_clyon", "POST", "/api/admin/app-pedidos/1/archive"],
    ["app_clyon", "POST", "/api/admin/app-pedidos/1/advance"],
    ["app_clyon", "PATCH", "/api/admin/app-pedidos/1"],
    ["app_clyon", "POST", "/api/admin/app-clyon/pedidos/1/ops"],
    ["app_clyon", "PATCH", "/api/admin/app-clyon/profissionais/1"],
    ["app_clyon", "PATCH", "/api/admin/app-clyon/catalogo/mudancas"],
    ["configs", "POST", "/api/media/gallery"],
    ["configs", "PUT", "/api/media/gallery/1"],
  ];

  it("o GET abre com a secção", () => {
    for (const [s, rota] of LEITURAS) {
      expect(assistenteComSeccoesPodeChamar([s], rota, "GET"), `${s} GET ${rota}`).toBe(true);
    }
  });

  it("as escritas de dinheiro e de taxas ficam fechadas, mesmo com todas as secções", () => {
    const todas = [...SECCOES_DO_ASSISTENTE];
    for (const [s, m, rota] of ESCRITAS) {
      expect(assistenteComSeccoesPodeChamar([s], rota, m), `${s} ${m} ${rota}`).toBe(false);
      expect(assistenteComSeccoesPodeChamar(todas, rota, m), `todas ${m} ${rota}`).toBe(false);
    }
  });

  it("e as rotas repetem a tranca: o método de escrita é requireAdminGeral", () => {
    for (const [, m, rota] of ESCRITAS) {
      const f = ficheiroDaRota(rota);
      expect(f, rota).not.toBeNull();
      const codigo = semNotas(readFileSync(f!, "utf8"));
      const i = codigo.indexOf(`export async function ${m}(`);
      expect(i, `${rota} ${m}`).toBeGreaterThan(-1);
      const fim = codigo.indexOf("export async function", i + 10);
      const corpo = codigo.slice(i, fim < 0 ? undefined : fim);
      expect(corpo, `${rota} ${m}`).toContain("await requireAdminGeral(req)");
    }
  });

  it("o que não é dinheiro continua aberto a quem tem a secção", () => {
    for (const [s, m, rota] of ESCRITAS_QUE_FICAM) {
      expect(assistenteComSeccoesPodeChamar([s], rota, m), `${s} ${m} ${rota}`).toBe(true);
    }
  });

  it("mas mudar o preço de um pedido da app, ou avançá-lo para a fase que o fixa, é do administrador", () => {
    const PATCH = semNotas(ler("src/app/api/admin/app-pedidos/[id]/route.ts"));
    expect(PATCH).toContain('if (colab?.papel !== "admin") {');
    expect(PATCH).toMatch(/body\.estimated_price !== undefined \|\|\s*body\.final_price !== undefined \|\|\s*body\.price_status !== undefined \|\|\s*quotePriceIsRequiredForStatus/);
    const AVANCO = semNotas(ler("src/app/api/admin/app-pedidos/[id]/advance/route.ts"));
    expect(AVANCO).toContain('if (colab?.papel !== "admin" && quotePriceIsRequiredForStatus(phase.next)) {');
  });
});

describe("os botões que o servidor recusa ao assistente não lhe aparecem", () => {
  const C = (rel: string) => semNotas(ler(rel));

  it("os ganchos começam fechados e só abrem ao administrador", () => {
    const H = C("src/hooks/useAdminAuth.ts");
    const dinheiro = H.slice(H.indexOf("export function useMexeNoDinheiro"), H.indexOf("export function useEAdministrador"));
    expect(dinheiro).toContain("useState(false)");
    expect(dinheiro).toContain("papelMexeNoDinheiro(papelGuardadoNoBrowser())");
    const admin = H.slice(H.indexOf("export function useEAdministrador"));
    expect(admin).toContain("useState(false)");
    expect(admin).toContain('papelGuardadoNoBrowser() === "admin"');
    expect(papelMexeNoDinheiro("admin")).toBe(true);
    expect(papelMexeNoDinheiro("assistente")).toBe(false);
    expect(papelMexeNoDinheiro(null)).toBe(false);
  });

  const CONDICOES: Array<[string, string[]]> = [
    ["src/components/admin/AdminCarteirasPanel.tsx", [
      "const mexeNoDinheiro = useMexeNoDinheiro();",
      "{pagavel && mexeNoDinheiro ? (",
      "{mexeNoDinheiro && (\r\n          <button\r\n            onClick={() => setACorrigir(",
    ]],
    ["src/components/admin/AdminPagamentosPanel.tsx", [
      "const mexeNoDinheiro = useMexeNoDinheiro();",
      "{ligacao.configurado && mexeNoDinheiro && (",
      "{mexeNoDinheiro && agrupamento === \"profissional\" && sg.linhas[0] && (",
      "{mexeNoDinheiro && (marcadosAqui.length > 0 || resultadoDoLote) && (",
      "{mexeNoDinheiro && actual.linhas.length > 0 && (",
      "{aberto && mexeNoDinheiro && (",
    ]],
    ["src/components/admin/AdminLevantamentosPanel.tsx", [
      "const mexeNoDinheiro = useMexeNoDinheiro();",
      "{l.estado === \"pedido\" && !mexeNoDinheiro ? (",
    ]],
    ["src/components/admin/FichaDaAgenda.tsx", [
      "mexeNoDinheiro && <BotaoEditar",
      "{aEditarValor && mexeNoDinheiro && (",
    ]],
    ["src/components/admin/GerarReferencia.tsx", [
      "return mexeNoDinheiro ? <GerarReferenciaDoAdministrador {...props} /> : null;",
    ]],
    ["src/components/admin/AppClyonEmbedded.tsx", [
      "{canApproveQuote && mexeNoDinheiro && (",
      "{o.estado === \"pending\" && mexeNoDinheiro && (",
      "{panelOpen && mexeNoDinheiro && (",
      "{showNew && mexeNoDinheiro && (",
      "{!r.conciliada && !r.automatico && mexeNoDinheiro && (",
      "readOnly={!mexeNoDinheiro}",
      "(mexeNoDinheiro || !quotePriceIsRequiredForStatus(nextPhase(order.status)!.next))",
      "{!eAdministrador ? null : !confirmDelete ? (",
    ]],
    ["src/app/admin/app-pedidos/AppPedidosClient.tsx", ["readOnly={!mexeNoDinheiro}"]],
    ["src/components/admin/LegacyAdminClient.tsx", [
      "readOnly={!papelMexeNoDinheiro(papel)}",
      "{papelMexeNoDinheiro(papel) && (\r\n                        <button\r\n                          type=\"button\"\r\n                          onClick={() => void gravarTaxas()}",
      "{papel === \"admin\" && (\r\n                    <button\r\n                      type=\"button\"\r\n                      disabled={aExecutarLote !== null}\r\n                      onClick={() => acaoEmLote(\"apagar\")}",
    ]],
    ["src/components/admin/ImageManagerClient.tsx", ["{eAdministrador && (\r\n                              <button\r\n                                type=\"button\"\r\n                                title=\"Apagar imagem\""]],
    ["src/components/admin/AdminConversasPanel.tsx", [
      "{eAdministrador && m.de === \"clyon\" && !papeleira && (",
      "{eAdministrador && m.de !== \"clyon\" && !papeleira && (",
      "{eAdministrador && (\r\n                <button\r\n                  onClick={() =>\r\n                    papeleira",
    ]],
    ["src/components/admin/AdminProfissionaisPanel.tsx", ["{eAdministrador && p.estado === \"suspenso\" && !aApagar && ("]],
  ];

  for (const [rel, frases] of CONDICOES) {
    it(rel.split("/").pop()!, () => {
      // Tudo em CRLF, seja qual for o fim de linha do ficheiro no disco.
      const codigo = C(rel).split("\r\n").join("\n").split("\n").join("\r\n");
      for (const f of frases) expect(codigo, f).toContain(f);
    });
  }

  it("a App CLYON pergunta o papel em cada parte que tem dinheiro", () => {
    const A = C("src/components/admin/AppClyonEmbedded.tsx");
    expect(A.match(/const mexeNoDinheiro = useMexeNoDinheiro\(\);/g)?.length).toBe(5);
  });
});

describe("«Assistentes» nunca se dá nem se abre", () => {
  it("não está na lista, e não entra por lado nenhum", () => {
    expect(SECCOES_DO_ASSISTENTE as readonly string[]).not.toContain("equipa");
    expect(assistentePodeVerSeccao("equipa")).toBe(false);
    expect(normalizarSeccoes(["equipa", "pedidos"])).toEqual(["pedidos"]);
    expect(seccoesGuardadas(JSON.stringify(["equipa"]))).toEqual([]);
  });

  it("nem com todas as secções se chega à gestão de assistentes", () => {
    const todas = [...SECCOES_DO_ASSISTENTE, "equipa"];
    for (const m of ["GET", "POST", "PATCH", "PUT"]) {
      expect(assistenteComSeccoesPodeChamar(todas, "/api/admin/assistentes", m), m).toBe(false);
    }
    const ROTA = semNotas(ler("src/app/api/admin/assistentes/route.ts"));
    expect(ROTA).toContain("requireAdminGeral(req)");
    expect(ROTA).not.toMatch(/\brequireAdmin\(/);
  });

  it("o ecrã dela só se desenha no painel do administrador", () => {
    expect(PAINEL).toContain('{activeSection === "equipa" && papel === "admin" && (');
  });
});

describe("apagar continua vedado", () => {
  it("nenhum DELETE passa, com todas as secções, em nenhum prefixo", () => {
    const todas = [...SECCOES_DO_ASSISTENTE];
    for (const p of PREFIXOS_DE_API_DO_ASSISTENTE) {
      expect(assistenteComSeccoesPodeChamar(todas, p, "DELETE"), p).toBe(false);
      expect(assistenteComSeccoesPodeChamar(todas, `${p}/1`, "delete"), p).toBe(false);
    }
  });

  it("as rotas que abriram e têm DELETE guardam-no para o administrador", () => {
    for (const rel of ["src/app/api/admin/users/route.ts", "src/app/api/media/gallery/[id]/route.ts"]) {
      const ROTA = semNotas(ler(rel));
      const del = ROTA.slice(ROTA.indexOf("export async function DELETE"));
      expect(del, rel).toContain("await exigirAcesso(request, true)");
      expect(ROTA, rel).toMatch(/soAdministrador\s*\?\s*await requireAdminGeral\(request\)/);
    }
  });

  it("e as contas não se apagam por PATCH", () => {
    const ROTA = semNotas(ler("src/app/api/admin/users/route.ts"));
    expect(ROTA).toContain('if (auth.colaborador?.papel !== "admin") {');
    expect(ROTA).toContain("role !== undefined || (deletedAt !== undefined && deletedAt !== null)");
  });
});

describe("uma conta antiga (NULL) fica com as seis de sempre", () => {
  it("NULL, vazio ou ilegível dão as seis, e não o menu inteiro", () => {
    const seis = ["pedidos", "profissionais", "negociacoes_clyon", "agenda", "whatsapp", "suporte"];
    expect([...SECCOES_DAS_CONTAS_ANTIGAS]).toEqual(seis);
    for (const bruto of [null, undefined, "", "isto não é json", '{"a":1}', "null"]) {
      expect(seccoesGuardadas(bruto), String(bruto)).toEqual(seis);
    }
    expect(seccoesGuardadas(null)).not.toContain("carteiras");
    expect(seccoesGuardadas(null)).not.toContain("configs");
  });

  it("uma lista gravada fica como foi gravada", () => {
    const seis = JSON.stringify(["pedidos", "profissionais", "negociacoes_clyon", "agenda", "whatsapp", "suporte"]);
    expect(seccoesGuardadas(seis)).toEqual([...SECCOES_DAS_CONTAS_ANTIGAS]);
    expect(seccoesGuardadas(JSON.stringify(["agenda", "pedidos"]))).toEqual(["pedidos", "agenda"]);
  });

  it("e é por aí que a base lê as secções", () => {
    const LIB = semNotas(ler("src/lib/assistentes.ts"));
    expect(LIB).toContain("return seccoesGuardadas(json);");
    expect(LIB).not.toContain("SECCOES_DO_ASSISTENTE");
  });
});

describe("criar sem secções é criar sem nenhuma", () => {
  it("vazio, nada ou lixo dão nenhuma", () => {
    expect(normalizarSeccoes(undefined)).toEqual([]);
    expect(normalizarSeccoes(null)).toEqual([]);
    expect(normalizarSeccoes([])).toEqual([]);
    expect(normalizarSeccoes(["inventada"])).toEqual([]);
    expect(seccoesGuardadas("[]")).toEqual([]);
  });

  it("uma conta sem secções só chega à sessão", () => {
    expect(assistenteComSeccoesPodeChamar([], "/api/admin/sessao/eu", "GET")).toBe(true);
    expect(assistenteComSeccoesPodeChamar([], "/api/admin/pedidos", "GET")).toBe(false);
    expect(assistenteComSeccoesPodeChamar([], "/api/admin/resumo", "GET")).toBe(false);
  });

  it("a rota grava sempre a lista — nunca NULL — e o formulário nasce desmarcado", () => {
    const ROTA = semNotas(ler("src/app/api/admin/assistentes/route.ts"));
    expect(ROTA).toContain("const seccoes = normalizarSeccoes(corpo.seccoes);");
    expect(semNotas(ler("src/lib/assistentes.ts"))).toContain("JSON.stringify(dados.seccoes)");
    const FORM = semNotas(ler("src/components/admin/AdminAssistentesPanel.tsx"));
    expect(FORM).toContain("useState<SeccaoDoAssistente[]>([])");
    expect(FORM).toContain("setSeccoesNovas([]);");
    expect(FORM).not.toContain("useState<SeccaoDoAssistente[]>([...SECCOES_DO_ASSISTENTE])");
  });
});

describe("uma rota sem secção nasce fechada", () => {
  it("só a sessão é de todos os assistentes", () => {
    expect(rotaDeTodosOsAssistentes("/api/admin/sessao/eu")).toBe(true);
    expect(rotaDeTodosOsAssistentes("/api/admin/sessao/sair")).toBe(true);
    for (const p of PREFIXOS_DE_API_DO_ASSISTENTE) {
      if (p === "/api/admin/sessao") continue;
      expect(rotaDeTodosOsAssistentes(p), p).toBe(false);
    }
  });

  it("uma rota nova dentro de um prefixo aberto não passa sem entrada", () => {
    const todas = [...SECCOES_DO_ASSISTENTE];
    expect(assistenteComSeccoesPodeChamar(todas, "/api/admin/pagamentos/uma-rota-nova", "POST")).toBe(false);
    expect(assistentePodeChamar("/api/admin/pagamentos/criar", "POST")).toBe(false);
  });

  it("todas as rotas debaixo dos prefixos abertos passam por requireAdmin ou requireAdminGeral", () => {
    // As duas que não precisam: sair (só apaga o cookie) e a imagem pública da galeria.
    const SEM_TRANCA = ["src/app/api/admin/sessao/sair/route.ts", "src/app/api/media/gallery/render/[id]/route.ts"];
    const semTranca: string[] = [];
    const rotas = (dir: string, acc: string[] = []): string[] => {
      if (!existsSync(dir)) return acc;
      for (const n of readdirSync(dir)) {
        const c = join(dir, n);
        if (statSync(c).isDirectory()) rotas(c, acc);
        else if (n === "route.ts") acc.push(c);
      }
      return acc;
    };
    let vistas = 0;
    for (const p of PREFIXOS_DE_API_DO_ASSISTENTE) {
      for (const f of rotas(join(SRC, "app", ...p.split("/").filter(Boolean)))) {
        vistas++;
        const rel = relative(RAIZ, f).split("\\").join("/");
        if (SEM_TRANCA.includes(rel)) continue;
        if (trancaDaRota(f) === "outra") semTranca.push(rel);
      }
    }
    expect(vistas).toBeGreaterThan(50);
    expect(semTranca).toEqual([]);
  });
});
