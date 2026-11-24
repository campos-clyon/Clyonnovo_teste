import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { perguntasDoProfissional } from "./ajuda-plataforma";
import { NADA_A_PAGAR_AGORA_NO_NOVO_MODELO as DAQUI } from "./aviso-de-oferta-clyon";
import { DIAS_PARA_PAGAR_A_DIVIDA } from "./divida-do-profissional";
import { DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO, NADA_A_PAGAR_AGORA_NO_NOVO_MODELO } from "./novo-modelo";
import { ANTES_DO_MODELO, DEPOIS_DO_MODELO } from "./relogio-dos-testes";
import { emTerra } from "./preposicao-da-terra";
import { descricaoDaCidade, LIMITE_DA_DESCRICAO, tamanho } from "./descricoes-seo";
import { getAllCidadeSlugs, getCidadeMudancaBySlug } from "./mudancas-cidades";
import { ACTUALIZADO_EM } from "./datas-das-paginas";
import { cabeNoGoogle, tituloDaCidade, tituloDaMudanca } from "./titulos-seo";
import { precoDaMudancaCom3NaDescricao, precoDaMudancaNaDescricao, precoDaMudancaNoTitulo, SEM_PARCEIROS, type PrecoPublicoDasMudancas } from "./preco-publico-das-mudancas";

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");

describe("d2 (24/11): /recolha-moveis-lisboa com o benefício no título", () => {
  it("o título diz o benefício, sem preço, e cabe; a descrição leva o par sem/com IVA e cabe", () => {
    const t = tituloDaCidade("Recolha de Móveis", "Lisboa", "recolha-moveis", "lisboa");
    expect(t).toBe("Recolha de Móveis em Lisboa: De Casa, Sem Esperar");
    expect(t).not.toMatch(/€|IVA/);
    expect(cabeNoGoogle(t)).toBe(true);
    const d = descricaoDaCidade("recolha-moveis", "Recolha de Móveis", "Lisboa", "lisboa");
    expect(tamanho(d)).toBeLessThanOrEqual(LIMITE_DA_DESCRICAO);
    expect(d).toContain("com IVA");
    expect(d).toContain("+ IVA");
  });

  it("a data da página mudou, para o sitemap", () => {
    expect(ACTUALIZADO_EM["/recolha-moveis-lisboa"]).toBe("2026-11-24");
  });
});

describe("d4 (24/11): uma só resposta ao parceiro — nada a pagar agora, a referência na confirmação, o prazo das constantes", () => {
  const DEPOIS = DEPOIS_DO_MODELO;
  const respostas = perguntasDoProfissional({ cliente: 0, profissional: 0.1 }, DEPOIS);
  const resposta = respostas.find((p) => p.pergunta === "O cliente pagou-me: e agora?")?.resposta ?? "";

  it("a ajuda diz a frase da d100, o prazo do modelo novo e o das dívidas antigas, tudo das constantes", () => {
    expect(resposta).toContain(NADA_A_PAGAR_AGORA_NO_NOVO_MODELO);
    expect(resposta).toContain(`${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias`);
    expect(resposta).toContain(`mantêm os ${DIAS_PARA_PAGAR_A_DIVIDA} dias`);
    expect(resposta).not.toContain("Pagamentos em dinheiro");
    expect(respostas.filter((p) => p.pergunta.includes("e agora?")).length).toBe(1);
  });

  it("antes do modelo novo já não há a resposta de «Carteira › Pagamentos em dinheiro», nem a lista fixa", () => {
    const antes = perguntasDoProfissional(null, ANTES_DO_MODELO).map((p) => p.resposta).join(" ");
    expect(antes).not.toContain("Pagamentos em dinheiro");
    expect(ler("src/lib/ajuda-plataforma.ts")).not.toContain("PERGUNTAS_DO_PROFISSIONAL");
  });

  it("a frase é uma só: o aviso do WhatsApp re-exporta a de novo-modelo.ts", () => {
    expect(DAQUI).toBe(NADA_A_PAGAR_AGORA_NO_NOVO_MODELO);
    expect(ler("src/lib/aviso-de-oferta-clyon.ts")).not.toMatch(/Não tem nada a pagar agora/);
  });

  it("as partes que dizem o prazo leem-no das constantes (ajuda, aviso ao escolhido, como funciona, termos), e a app Pro lê a ajuda do servidor", () => {
    for (const f of [
      "src/lib/ajuda-plataforma.ts",
      "src/lib/aviso-de-oferta-clyon.ts",
      "src/lib/como-funciona-para-o-profissional.ts",
      "src/lib/como-recebe-no-novo-modelo.ts",
      "src/lib/aceitacao-dos-termos.ts",
      "src/components/admin/frase-do-novo-modelo.ts",
      "src/app/termos/page.tsx",
    ]) {
      expect(ler(f), f).toMatch(/DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO|NADA_A_PAGAR_AGORA_NO_NOVO_MODELO/);
    }
    // Os textos que a ajuda e o aviso escrevem não levam o número à mão.
    for (const f of ["src/lib/ajuda-plataforma.ts", "src/lib/aviso-de-oferta-clyon.ts", "src/lib/novo-modelo.ts"]) {
      const codigo = ler(f).replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
      expect(codigo, f).not.toMatch(/\b4 dias\b|\bquatro dias\b/);
    }
    expect(ler("app-pro/src/lib/novo-modelo.ts")).toContain("perguntasDoProfissional(taxas");
  });
});

describe("d5 (24/11): os títulos e as descrições das mudanças, com €/h e o valor com IVA ao lado", () => {
  const COM_LISTA: PrecoPublicoDasMudancas = {
    tipo: "parceiros",
    parceiros: 3,
    desde: { semIvaCent: 4500, comIvaCent: 5535 },
    desde3: { semIvaCent: 6000, comIvaCent: 7380 },
  };

  it("o título diz o «desde» à hora com + IVA, e a referência vem da tabela, sem «3 a 50 €/h»", () => {
    expect(precoDaMudancaNoTitulo(COM_LISTA)).toEqual(["Desde 45 €/h + IVA"]);
    expect(precoDaMudancaNoTitulo(SEM_PARCEIROS)[0]).toMatch(/^Referência desde \d+ €\/h \+ IVA$/);
  });

  it("a descrição diz o de 2 e o de 3 pessoas, cada um com o valor com IVA", () => {
    expect(precoDaMudancaNaDescricao(COM_LISTA)).toContain("desde 45 €/h + IVA (55,35 € com IVA)");
    expect(precoDaMudancaCom3NaDescricao(COM_LISTA)).toBe("Com 3 pessoas, desde 60 €/h + IVA (73,80 € com IVA).");
    expect(precoDaMudancaCom3NaDescricao(SEM_PARCEIROS)).toBeNull();
    expect(precoDaMudancaCom3NaDescricao({ ...COM_LISTA, desde3: undefined })).toBeNull();
  });

  it("em todas as cidades o título cabe, leva €/h e IVA, e a abertura da descrição cabe nos 155", () => {
    for (const slug of getAllCidadeSlugs()) {
      const nome = getCidadeMudancaBySlug(slug)!.nome;
      for (const preco of [COM_LISTA, SEM_PARCEIROS]) {
        const t = tituloDaMudanca(nome, preco);
        expect(cabeNoGoogle(t), t).toBe(true);
        const abre = `Mudanças ${emTerra(nome)} à hora, ${precoDaMudancaNaDescricao(preco)}.`;
        expect(tamanho(abre), abre).toBeLessThanOrEqual(LIMITE_DA_DESCRICAO);
      }
    }
  });

  it("nenhum texto público de código diz «3 a 50 €/h» (só comentários e testes que guardam a regra)", () => {
    const sem = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
    for (const f of [
      "src/lib/titulos-seo.ts",
      "src/lib/preco-publico-das-mudancas.ts",
      "src/lib/blog-data.ts",
      "src/lib/city-content.ts",
      "src/app/mudancas/[cidade]/page.tsx",
      "src/app/mudancas/page.tsx",
    ]) {
      expect(sem(ler(f)), f).not.toMatch(/3 a 50 ?€/);
    }
  });
});
