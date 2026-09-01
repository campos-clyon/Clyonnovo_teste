import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AVALIACOES, PRAZO_DE_RESPOSTA } from "./seo-data";
import { PRECOS } from "./precos-publicos";
import { PROMESSA } from "./pagamento-na-plataforma";

/**
 * A página de contactos, refeita para ser encontrada.
 *
 * "A nossa página de contacto é realmente muito fraca — reformule para uma
 * página forte e competitiva no SEO do Google."
 *
 * Eram duzentas palavras, quase todas rótulos de campos. Sem dados
 * estruturados próprios, sem uma única ligação para dentro do site, e sem
 * resposta a nenhuma das perguntas que uma pessoa faz antes de ligar.
 *
 * Medido no browser depois de refeita: 896 palavras, um h1, sete h2,
 * dezassete h3, e três schemas novos — ContactPage, FAQPage e BreadcrumbList
 * — a somar aos três do layout. As 43 ligações internas foram verificadas
 * uma a uma contra o servidor: todas 200.
 *
 * O que estes testes prendem são as coisas que, se caírem, custam
 * posicionamento sem ninguém dar por isso.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * O ficheiro sem os comentários.
 *
 * Já falhou três vezes esta sessão pela mesma razão: um teste que varre o
 * ficheiro à procura do que NÃO pode lá estar encontra-o no comentário que
 * explica porque é que ele saiu. A explicação é a prova de que a coisa foi
 * arrumada, e chumbava o teste como se não tivesse sido.
 */
const semComentarios = (fonte: string) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PAGINA = ler("src/app/contactos/page.tsx");
const PAGINA_LIMPA = semComentarios(PAGINA);
const CLIENTE = semComentarios(ler("src/app/contactos/ContactosClient.tsx"));

describe("os dados estruturados", () => {
  it("declara ContactPage, FAQPage e BreadcrumbList", () => {
    for (const tipo of ["ContactPage", "FAQPage", "BreadcrumbList", "ContactPoint"]) {
      expect(PAGINA).toContain(`"${tipo}"`);
    }
  });

  it("NÃO declara aggregateRating — a nota vive onde as avaliações vivem", () => {
    // O layout já explica porquê: uma nota agregada numa página sem avaliações
    // visíveis é o padrão que o Google sanciona, e a sanção tira as estrelas ao
    // domínio inteiro, não só à página que as pediu a mais.
    expect(PAGINA_LIMPA).not.toContain("aggregateRating");
  });

  it("liga-se às entidades do layout em vez de as repetir", () => {
    // Duas entidades LocalBusiness com a mesma morada no mesmo HTML é o erro
    // que /avaliacoes já teve. Aqui referencia-se por @id.
    expect(PAGINA).toContain("#localbusiness");
    expect(PAGINA).toContain("#website");
    expect(PAGINA_LIMPA).not.toContain('"@type": "LocalBusiness"');
  });

  it("o FAQ do schema e o FAQ do ecrã são a mesma lista", () => {
    // Schema que não corresponde ao que está visível é o caminho mais curto
    // para uma acção manual. Uma constante, duas leituras.
    expect(PAGINA).toContain("mainEntity: PERGUNTAS.map(");
    expect(PAGINA).toContain("{PERGUNTAS.map((p) => (");
  });
});

describe("os números", () => {
  it("nenhum é escrito à mão — vêm das constantes", () => {
    expect(PAGINA).toContain("PRAZO_DE_RESPOSTA");
    expect(PAGINA).toContain("AVALIACOES_TOTAL");
    expect(PAGINA).toContain("PRECOS[chave]");
    // As avaliações e os preços existem mesmo, e são conferíveis.
    expect(AVALIACOES.google + AVALIACOES.fixando).toBeGreaterThan(0);
    expect(PRECOS.recolha_moveis.etiqueta).toBeTruthy();
  });

  it("as mudanças continuam sem número publicado", () => {
    // Decisão anterior: o site anunciava "desde 150 €" e o motor factura a
    // partir de 490. Esta página mostra a etiqueta, seja ela qual for — não
    // um número próprio.
    expect(PRECOS.mudanca.minimo).toBeNull();
    expect(PAGINA_LIMPA).not.toMatch(/mudan[çc]as?[^<]{0,40}desde \d/i);
  });

  it("o prazo prometido é o do resto do site, e não o velho 48h", () => {
    expect(PRAZO_DE_RESPOSTA.porExtenso).toBe("6 horas");
    // As 48 horas aparecem UMA vez e a propósito de outra coisa: é o tempo que
    // uma proposta demora a expirar, não o tempo de resposta. Foi confundir os
    // dois que pôs a homepage a prometer 6h no topo e 48h dois ecrãs abaixo.
    expect([...PAGINA_LIMPA.matchAll(/48\s*horas/gi)]).toHaveLength(1);
    expect(PAGINA_LIMPA).toContain("expira sozinha ao fim de 48 horas");
    expect(PAGINA_LIMPA).not.toMatch(/(resposta|respondemos|orçamento)[^.]{0,40}48\s*h/i);
  });
});

describe("a voz", () => {
  it("a CLYON não diz que faz o trabalho", () => {
    /*
     * A FRASE MUDOU DE CASA, e a garantia não mudou.
     *
     * Vive agora em `pagamento-na-plataforma.ts`, com as duas versões — a de
     * hoje e a que volta quando houver cobrança. Passou para lá porque a
     * segunda metade dela falava de dinheiro que a CLYON não tem; a primeira
     * metade, que é a que este teste protege, é igual nas duas.
     */
    expect(PROMESSA.faqQuemFaz).toContain("A CLYON é a plataforma");
    expect(PROMESSA.faqQuemFaz).toContain("Quem desmonta, carrega e transporta é o profissional");
    expect(PAGINA).toContain("PROMESSA.faqQuemFaz");
    // Nada de "nós recolhemos", "a nossa equipa vai lá".
    expect(PAGINA_LIMPA).not.toMatch(/n[óo]s (recolhemos|esvaziamos|levamos|transportamos)/i);
    expect(PAGINA_LIMPA).not.toMatch(/a nossa equipa (vai|desmonta|carrega)/i);
  });
});

describe("a estrutura", () => {
  it("um único h1, e o do cliente saiu", () => {
    // Dois h1 na mesma página diluem-se: o Google escolhe um.
    expect((PAGINA_LIMPA.match(/<h1/g) ?? []).length).toBe(1);
    expect(CLIENTE).not.toContain("<h1");
  });

  it("o componente cliente deixou de trazer o seu próprio ecrã inteiro", () => {
    // Um min-h-screen com padding dentro de outro empurrava a página para baixo.
    expect(CLIENTE).not.toContain("min-h-screen");
  });

  it("liga-se para dentro do site — era o que não tinha nenhum", () => {
    for (const destino of [
      "/como-funciona",
      "/precos",
      "/simulador",
      "/faq",
      "/regioes/",
      "/recolha-moveis-",
    ]) {
      expect(PAGINA).toContain(destino);
    }
  });

  it("as cidades apontam para rotas que existem", () => {
    // /areas-de-atuacao/<cidade> não existe: as páginas de cidade vivem no
    // apanha-tudo como "<servico>-<cidade>". Ligar para 404 é o oposto do que
    // esta página veio fazer.
    expect(PAGINA_LIMPA).not.toContain("/areas-de-atuacao/${");
    expect(PAGINA).toContain("`/recolha-moveis-${cidade.slug}`");
  });

  it("tem canonical e keywords próprias", () => {
    expect(PAGINA).toContain("alternates: { canonical:");
    expect(PAGINA).toContain("keywords:");
  });
});
