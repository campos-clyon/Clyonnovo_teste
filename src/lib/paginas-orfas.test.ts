import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import robotsTxt from "../app/robots";

/**
 * AS PÁGINAS DOS PROFISSIONAIS DEIXAM DE SER ÓRFÃS.
 *
 * Dezasseis delas estavam em «Detectada, mas não indexada» no Search Console.
 * Não era um bloqueio nem um erro: o Google viu os endereços e decidiu não
 * gastar rastreio neles.
 *
 * A causa estava no nosso código e via-se com uma procura:
 *
 *   grep -rn 'href="/profissionais' src/app src/components
 *
 * Nenhum resultado apontava para um perfil. As únicas referências eram o
 * canónico dentro da própria página e a lista do sitemap. Ou seja: NENHUMA
 * página do site lhes ligava. Um endereço que só existe numa declaração
 * nossa, sem um único link interno, é o que ele põe no fim da fila — e o fim
 * da fila de um site pequeno nunca chega.
 *
 * Três coisas, e as três têm de andar juntas:
 *
 *   1. LINKS a partir das páginas que já estão indexadas.
 *   2. SÓ QUEM TEM QUE MOSTRAR entra no sitemap e pede indexação.
 *   3. LINKS DAS PÁGINAS DE CIDADE, que são as que recebem visitas.
 *
 * Sem a 2, a 1 e a 3 mandam o Google a páginas vazias e fica tudo na mesma.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/*
 * O código sem comentários.
 *
 * Um teste que procura texto no ficheiro encontra-o dentro dos comentários —
 * incluindo dentro dos comentários que explicam o próprio teste. Fica sempre
 * verde e nunca guarda nada.
 */
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const lerNu = (p: string) => semComentarios(ler(p));

const BLOCO = lerNu("src/components/ProfissionaisComPagina.tsx");

describe("o bloco que liga às páginas dos profissionais", () => {
  it("põe um link a sério para cada um — é a razão de existir", () => {
    // Um <Link href="/profissionais/..."> e não um botão com onClick: o que o
    // Google segue é um href no HTML. Sem isto, o bloco é decoração.
    expect(BLOCO).toContain("href={`/profissionais/${p.slug}`}");
  });

  it("só mostra quem tem alguma coisa para mostrar", () => {
    // Ligar a uma página vazia é gastar o link e ensinar o Google a
    // desconfiar dos outros. A regra é a mesma do sitemap, escrita uma vez.
    expect(BLOCO).toContain("filter(temAlgoParaMostrar)");
  });

  it("uma consulta só para a lista toda, e não uma por cartão", () => {
    // A página de um profissional faz três consultas. Vinte cartões não podem
    // fazer sessenta — isto é um bloco no fim de páginas que já são lentas.
    expect(BLOCO).toContain("profissionaisComPagina()");
    expect(BLOCO).not.toContain("perfilPublicoPorSlug");
  });

  it("sem ninguém, não desenha um título sobre uma grelha vazia", () => {
    expect(BLOCO).toContain("if (lista.length === 0) return null;");
  });

  it("filtra pela zona de quem lá trabalha, e não pela morada do cliente", () => {
    // A base dele ou uma das zonas que ele próprio indicou. «Profissionais em
    // Almada» com uma empresa de Setúbal é o género de coisa que o cliente
    // confirma no primeiro telefonema.
    expect(BLOCO).toContain("function trabalhaEm");
    expect(BLOCO).toContain("p.zonas.some");
  });

  it("não deixa escapar o contacto de ninguém", () => {
    /*
     * A mesma regra da página do perfil: o perfil dá confiança, não dá o
     * contacto. Numa grelha aberta ao mundo isso deixa de ser produto e passa
     * a ser protecção de dados de quem trabalha connosco.
     */
    for (const proibido of ["telefone", "email", "morada", "nif", "iban"]) {
      expect(BLOCO.toLowerCase()).not.toContain(proibido);
    }
  });
});

describe("as páginas que já estão indexadas passam a ligar-lhes", () => {
  const ONDE = [
    ["as avaliações", "src/app/avaliacoes/page.tsx"],
    ["os trabalhos", "src/app/trabalhos/page.tsx"],
    ["a página de recrutamento", "src/app/profissionais/page.tsx"],
    ["as páginas de cidade", "src/app/[...slug]/page.tsx"],
  ] as const;

  for (const [nome, ficheiro] of ONDE) {
    it(`${nome}`, () => {
      const f = lerNu(ficheiro);
      expect(f).toContain('from "@/components/ProfissionaisComPagina"');
      expect(f).toContain("<ProfissionaisComPagina");
    });
  }

  it("a página de cidade passa a cidade — senão lista o país inteiro", () => {
    const f = lerNu("src/app/[...slug]/page.tsx");
    expect(f).toContain("cidade={city.name}");
  });

  it("e continua a dizer que quem faz o trabalho é o profissional", () => {
    // Regra de voz do site, e agora também de facto: a CLYON liga, não recolhe.
    const f = ler("src/app/[...slug]/page.tsx");
    expect(f).toContain("Quem faz o trabalho são eles");
  });
});

describe("o robots.txt deixou de bloquear a página de contactos", () => {
  /*
   * «Indexada, mas bloqueada pelo robots.txt» — uma página, com a validação a
   * falhar a 15-09-2026: https://clyon.pt/contactos.
   *
   * A causa é uma armadilha do formato: um `Disallow` é um PREFIXO, não um
   * caminho. `Disallow: /conta` casa com tudo o que comece por essas seis
   * letras — e /contactos começa. A página de contactos do site esteve
   * bloqueada ao Google desde que a linha existe.
   *
   * Para um negócio local é das piores páginas para ter fechada: é ela que
   * carrega a morada, o telefone e o horário.
   */
  const regras = (() => {
    const r = robotsTxt().rules;
    const primeira = Array.isArray(r) ? r[0] : r;
    const d = primeira?.disallow ?? [];
    return (Array.isArray(d) ? d : [d]).map(String);
  })();

  /** A regra do robots.txt, como os robôs a lêem: prefixo, e `$` ancora. */
  const bloqueado = (caminho: string) =>
    regras.some((r) => (r.endsWith("$") ? caminho === r.slice(0, -1) : caminho.startsWith(r)));

  it("/contactos e /contacto ficam abertos", () => {
    expect(bloqueado("/contactos")).toBe(false);
    expect(bloqueado("/contacto")).toBe(false);
  });

  it("e a conta do cliente continua fechada, que era o ponto", () => {
    expect(bloqueado("/conta")).toBe(true);
    expect(bloqueado("/conta/")).toBe(true);
    expect(bloqueado("/conta/pedidos")).toBe(true);
  });

  it("nenhuma outra página pública ficou apanhada pelo mesmo prefixo", () => {
    /*
     * A armadilha não era só do /conta. Vale a pena varrer o que o site tem
     * mesmo para o público: se um dia alguém acrescentar `/precos` à lista
     * privada por engano, isto apanha-o no mesmo dia e não seis meses depois
     * num relatório.
     */
    const publicas = [
      "/",
      "/simulador",
      "/precos",
      "/servicos",
      "/mudancas",
      "/trabalhos",
      "/avaliacoes",
      "/faq",
      "/blog",
      "/regioes",
      "/areas-de-atuacao",
      "/sobre-nos",
      "/quero-ser-parceiro",
      "/profissionais",
      "/profissionais/oscar",
      "/recolha-de-moveis",
      "/recolha-moveis-lisboa",
    ];
    for (const p of publicas) {
      expect(bloqueado(p), `${p} tem de continuar aberta ao Google`).toBe(false);
    }
  });
});
