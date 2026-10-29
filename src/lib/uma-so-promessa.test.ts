import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { pedirNoSimulador } from "./servico-na-ligacao";
import { O_QUE_PODE_FAZER } from "./voz-da-vitoria";

/*
 * UMA SÓ PROMESSA — 27-10-2026.
 *
 * O «mesmo dia» responde-se sempre com NO_MESMO_DIA (promessas-publicas.ts) e
 * «próprio dia» não aparece em texto público. Os botões de orçamento levam ao
 * simulador. As páginas dos serviços fora do plano dizem que a CLYON não os
 * faz, sem preço e sem botão.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const semComentarios = (t: string) =>
  t
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

/** As páginas públicas e o que elas lêem: fora o backoffice, a API, o painel do pro e os testes. */
function ficheirosPublicos(): string[] {
  const FORA = /[\\/](api|admin)[\\/]|[\\/]profissionais[\\/]painel[\\/]|[\\/]components[\\/]admin[\\/]/;
  const saida: string[] = [];
  const andar = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) andar(p);
      else if (/\.tsx?$/.test(n) && !/\.test\./.test(n) && !FORA.test(p)) saida.push(p);
    }
  };
  andar(join(RAIZ, "src", "app"));
  andar(join(RAIZ, "src", "components"));
  return [
    ...saida,
    ...[
      "src/lib/city-content.ts",
      "src/lib/cidades-local.ts",
      "src/lib/blog-data.ts",
      "src/lib/seo-data.ts",
      "src/lib/promessas-publicas.ts",
      "src/lib/mudancas-cidades.ts",
      "src/lib/quanto-custa.ts",
      "src/lib/tipos-de-mudanca.ts",
    ].map((f) => join(RAIZ, f)),
  ];
}

describe("o mesmo dia diz-se de uma só maneira", () => {
  it("«próprio dia» não aparece em texto público (fora dos comentários)", () => {
    const achados = ficheirosPublicos().filter((f) =>
      /pr[óo]prio dia/i.test(semComentarios(readFileSync(f, "utf8"))),
    );
    expect(achados.map((f) => f.replace(RAIZ, ""))).toEqual([]);
  });

  it("nenhuma lista de keywords promete o mesmo dia", () => {
    const achados: string[] = [];
    for (const f of ficheirosPublicos()) {
      const s = semComentarios(readFileSync(f, "utf8"));
      for (const m of s.matchAll(/keywords:\s*\[([\s\S]*?)\]/g)) {
        if (/mesmo dia|pr[óo]prio dia/i.test(m[1])) achados.push(f.replace(RAIZ, ""));
      }
    }
    expect(achados).toEqual([]);
  });

  it("a FAQ responde ao «mesmo dia» com NO_MESMO_DIA", () => {
    // As perguntas vivem em perguntas-frequentes.ts desde 29-10-2026 (S12).
    const faq = semComentarios(ler("src/app/faq/page.tsx") + ler("src/lib/perguntas-frequentes.ts"));
    expect(faq).toMatch(/from "(@\/lib|\.)\/promessas-publicas"/);
    const i = faq.indexOf("no mesmo dia?");
    expect(i).toBeGreaterThan(-1);
    expect(faq.slice(i, i + 200)).toMatch(/a:\s*NO_MESMO_DIA/);
  });
});

describe("os botões de orçamento levam ao simulador", () => {
  it("o atalho escolhe o serviço quando o sabe, e só os do plano", () => {
    expect(pedirNoSimulador("recolha-moveis")).toBe("/simulador?servico=recolha_moveis");
    expect(pedirNoSimulador("recolha-monos")).toBe("/simulador?servico=recolha_monos");
    expect(pedirNoSimulador("recolha-entulho")).toBe("/simulador?servico=recolha_entulho");
    expect(pedirNoSimulador("esvaziamento-casas")).toBe("/simulador?servico=esvaziamento_casa");
    expect(pedirNoSimulador("mudancas")).toBe("/simulador?servico=mudanca");
    expect(pedirNoSimulador("montagem-moveis")).toBe("/simulador");
    expect(pedirNoSimulador(null)).toBe("/simulador");
  });

  it("o CTABlock, por omissão, vai ao /simulador", () => {
    expect(ler("src/components/CTABlock.tsx")).toMatch(/primaryHref\s*=\s*"\/simulador"/);
  });

  it("o botão «Pedir Orçamento Grátis» das páginas de cidade vai ao simulador", () => {
    const s = semComentarios(ler("src/app/[...slug]/page.tsx"));
    const i = s.indexOf("Pedir Orçamento Grátis");
    expect(i).toBeGreaterThan(-1);
    const link = s.slice(s.lastIndexOf("<Link", i), i);
    expect(link).toContain("href={pedirNoSimulador(service.slug)}");
  });

  it("nenhum botão de orçamento público vai para /contactos", () => {
    const achados: string[] = [];
    for (const f of ficheirosPublicos()) {
      const s = semComentarios(readFileSync(f, "utf8"));
      if (/primaryHref=["{]\s*"?\/contactos/.test(s)) achados.push(f.replace(RAIZ, ""));
      for (const m of s.matchAll(/<Link\s+href="\/contactos"[^>]*>[\s\S]{0,200}?<\/Link>/g)) {
        if (/or[çc]amento/i.test(m[0])) achados.push(f.replace(RAIZ, ""));
      }
    }
    expect(achados).toEqual([]);
  });
});

/*
 * TODOS OS BOTÕES DE ORÇAMENTO — 28-10-2026 (d1, «Plano de SEO e autoridade»).
 *
 * A d4 tratou as páginas de cidade e o CTABlock; uma análise de fora ainda viu
 * um botão de orçamento a ir para /contactos (o menu «Soluções», em todas as
 * páginas), e as páginas de cada serviço mandavam para o simulador sem dizer
 * qual. Este teste lê pela árvore do TypeScript TODAS as ligações públicas
 * cujo texto pede orçamento ou propostas, e exige o simulador — ou o
 * WhatsApp, que é outro canal, quando o próprio botão o diz ou está na lista.
 */
// O texto do botão COMEÇA pelo pedido: um cartão «Recolha de móveis em Lisboa — ver preços e
// pedir orçamento» leva à página da terra, que tem o botão dela.
const PEDE_ORCAMENTO = /^(pedir|pe[çc]a|simular|receber|obter|abrir)\b[^.]{0,30}\b(or[çc]amentos?|propostas?)\b|^or[çc]amento/i;
const AO_SIMULADOR = /^"\/simulador|pedirNoSimulador\(|\bPEDIR_[A-Z]+\b|\/simulador|^\{?pedir\}?$/;
const AO_WHATSAPP = /wa\.me|whatsapp|WHATSAPP|WA_HREF/;
/*
 * WhatsApp sem o dizer no botão — com o motivo. Só encolhe.
 *
 * Vazia desde 28-10-2026 (d1): os cartões da página do Google Ads, que abrem
 * o WhatsApp (a conversão que a campanha conta até 2/11), passaram a dizer
 * «Pedir orçamento no WhatsApp». O destino não mudou.
 */
const WHATSAPP_SEM_O_DIZER: Record<string, string> = {};

interface BotaoDeOrcamento {
  ficheiro: string;
  linha: number;
  texto: string;
  href: string;
}

function botoesDeOrcamento(): BotaoDeOrcamento[] {
  const saida: BotaoDeOrcamento[] = [];
  for (const abs of ficheirosPublicos().filter((f) => f.endsWith(".tsx"))) {
    const f = abs.replace(RAIZ, "").replace(/\\/g, "/").replace(/^\//, "");
    const fonte = readFileSync(abs, "utf8");
    const sf = ts.createSourceFile(f, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const texto = (n: ts.Node): string => {
      if (ts.isJsxText(n)) return n.text;
      if (ts.isJsxExpression(n)) {
        const e = n.expression;
        return e && ts.isStringLiteralLike(e) ? e.text : " ";
      }
      if (ts.isJsxElement(n)) return n.children.map(texto).join("");
      return " ";
    };
    const visitar = (n: ts.Node): void => {
      if (ts.isJsxElement(n) && /^(Link|a)$/.test(n.openingElement.tagName.getText(sf))) {
        const t = texto(n).replace(/\s+/g, " ").trim();
        if (PEDE_ORCAMENTO.test(t)) {
          const attr = n.openingElement.attributes.properties.find(
            (a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText(sf) === "href",
          );
          const ini = attr?.initializer;
          const href = !ini
            ? ""
            : ts.isStringLiteral(ini)
              ? `"${ini.text}"`
              : ts.isJsxExpression(ini) && ini.expression
                ? ini.expression.getText(sf)
                : "";
          const linha = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
          saida.push({ ficheiro: f, linha, texto: t, href });
        }
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }
  return saida;
}

describe("todos os botões de orçamento vão ao simulador (d1, 28-10-2026)", () => {
  const BOTOES = botoesDeOrcamento();

  it("lê os botões de todas as páginas públicas", () => {
    // A inicial, as páginas de serviço, as de cidade, o rodapé e o menu.
    expect(BOTOES.length).toBeGreaterThan(40);
    for (const f of ["src/app/page.tsx", "src/app/[...slug]/page.tsx", "src/components/Header.tsx", "src/components/Footer.tsx"]) {
      expect(BOTOES.some((b) => b.ficheiro === f), f).toBe(true);
    }
  });

  it("cada um vai ao simulador — ou ao WhatsApp, dito no botão ou com motivo", () => {
    const fora = BOTOES.filter((b) => {
      if (AO_SIMULADOR.test(b.href)) return false;
      if (AO_WHATSAPP.test(b.href) && (/whatsapp/i.test(b.texto) || b.ficheiro in WHATSAPP_SEM_O_DIZER)) return false;
      return true;
    }).map((b) => `${b.ficheiro}:${b.linha} «${b.texto}» → ${b.href}`);
    expect(fora).toEqual([]);
  });

  it("a lista do WhatsApp só tem quem precisa dela", () => {
    for (const [f, motivo] of Object.entries(WHATSAPP_SEM_O_DIZER)) {
      expect(motivo.length, f).toBeGreaterThan(20);
      expect(
        BOTOES.some((b) => b.ficheiro === f && AO_WHATSAPP.test(b.href) && !/whatsapp/i.test(b.texto)),
        `${f} já não precisa da excepção`,
      ).toBe(true);
    }
  });

  it("o menu «Soluções» pede o orçamento no simulador, e não em /contactos", () => {
    const menu = semComentarios(ler("src/components/Header.tsx"));
    expect(menu).not.toContain("orçamento personalizado");
    const i = menu.indexOf("Descreva o seu caso e receba propostas");
    expect(i).toBeGreaterThan(-1);
    expect(menu.slice(i, i + 400)).toContain('href="/simulador"');
  });

  /*
   * Quem está na página de um serviço chega ao simulador com ele escolhido.
   * O serviço de cada página, e nenhuma ligação «/simulador» à seca nelas.
   */
  const SERVICO_DA_PAGINA: Record<string, string> = {
    "src/app/recolha-de-moveis/page.tsx": "recolha-moveis",
    "src/app/recolha-de-sofas/page.tsx": "recolha-moveis",
    "src/app/recolha-de-camas/page.tsx": "recolha-moveis",
    "src/app/recolha-de-armarios/page.tsx": "recolha-moveis",
    "src/app/recolha-de-eletrodomesticos/page.tsx": "recolha-moveis",
    "src/app/recolha-de-moveis-urgente/page.tsx": "recolha-moveis",
    "src/app/retirar-moveis-velhos/page.tsx": "recolha-moveis",
    "src/app/recolha-gratuita-de-moveis-usados/page.tsx": "recolha-moveis",
    "src/app/recolha-de-monos/page.tsx": "recolha-monos",
    "src/app/recolha-de-monos-amadora/page.tsx": "recolha-monos",
    "src/app/esvaziamento-de-casas/page.tsx": "esvaziamento-casas",
    "src/app/esvaziamento-de-casas-amadora/page.tsx": "esvaziamento-casas",
  };

  it("nas páginas de um serviço, o simulador abre já com ele", () => {
    const maus: string[] = [];
    for (const [f, servico] of Object.entries(SERVICO_DA_PAGINA)) {
      const s = semComentarios(ler(f));
      if (s.includes('href="/simulador"')) maus.push(`${f}: href="/simulador" sem o serviço`);
      if (!s.includes(`pedirNoSimulador("${servico}")`) && !s.includes(`?servico=${pedirNoSimulador(servico).split("=")[1]}`)) {
        maus.push(`${f}: não leva ${servico}`);
      }
    }
    for (const f of ["src/app/[...slug]/page.tsx", "src/app/servicos/[slug]/page.tsx"]) {
      if (semComentarios(ler(f)).includes('href="/simulador"')) maus.push(`${f}: href="/simulador" sem o serviço`);
    }
    expect(maus).toEqual([]);
  });
});

describe("as páginas dos serviços fora do plano", () => {
  const COMPONENTE = semComentarios(ler("src/components/ServicoForaDoPlano.tsx"));
  const QUINTAIS = semComentarios(ler("src/app/limpeza-de-quintais/page.tsx"));
  const SERVICO = semComentarios(ler("src/app/servicos/[slug]/page.tsx"));

  it("dizem no topo que a CLYON não faz o serviço, e o que se pode pedir", () => {
    expect(COMPONENTE).toContain('"De momento a CLYON não faz este serviço."');
    expect(COMPONENTE).toContain("O_QUE_PODE_FAZER");
    expect(O_QUE_PODE_FAZER).not.toMatch(/montagem|jardin|quinta/);
    expect(QUINTAIS).toContain("<ServicoForaDoPlano");
    expect(SERVICO).toMatch(/if \(FORA_DO_PLANO\.has\(cat\.id\)\) return <ServicoForaDoPlano/);
  });

  it("sem preço e sem botão para o simulador", () => {
    for (const [nome, s] of [["componente", COMPONENTE], ["quintais", QUINTAIS]] as const) {
      expect(s, nome).not.toContain("/simulador");
      expect(s, nome).not.toMatch(/PRECOS|precos-publicos|€/);
      expect(s, nome).not.toContain("CTABlock");
    }
  });

  it("e continuam fora do Google", () => {
    expect(QUINTAIS).toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(SERVICO).toMatch(/foraDoPlano \? \{ robots: \{ index: false/);
  });
});
