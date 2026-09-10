import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  COMO_SE_RECOLHE_ENTULHO,
  NAO_HA_CONTENTORES,
  PESO_MAXIMO_DO_SACO_KG,
  RESPOSTA_SOBRE_CONTENTORES,
  sacosDeUmMetroCubico,
} from "./sacos-de-entulho";
import { CITY_SERVICE_CONTENT } from "./city-content";

/**
 * A CLYON NÃO TEM CONTENTORES — e o site dizia que sim.
 *
 * "Faça uma busca no site e remova tudo o que leve o utilizador a acreditar
 * que temos contentores. Não temos, e só fazemos recolha de entulho por meio
 * de sacos de 25 kg." — 10-09-2026.
 *
 * Prometiam-se contentores em cinco cidades, com medidas (3 m³, 5 m³, 8 m³),
 * prazos («fica 3 a 7 dias») e preço de aluguer. Nenhum existe.
 *
 * Este teste é o guarda. Procura as promessas antigas em TODO o código de
 * produção e falha se alguma voltar — porque vão voltar: as páginas de cidade
 * crescem por cópia, e o contentor entrou exactamente assim, escrito uma vez
 * para Lisboa e multiplicado por cinco sem ninguém decidir nada.
 */

const RAIZ = join(process.cwd(), "src");

function ficheirosDeProducao(dir = RAIZ, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      ficheirosDeProducao(caminho, acc);
    } else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) {
      acc.push(caminho);
    }
  }
  return acc;
}

const ler = (f: string) => readFileSync(f, "utf8");

/*
 * SÃO AS FRASES, E NÃO A PALAVRA.
 *
 * «Contentor» é legítimo noutros contextos — a FAQ dos móveis fala do
 * contentor do lixo da rua, e a página da recolha de móveis vende-se com «sem
 * contentores, sem espera». Um teste que apanhasse a palavra apanhava essas, e
 * um teste que apanha demais acaba desligado.
 *
 * Estas são as literais que estavam mesmo no código, mais as variantes óbvias
 * de quem as reescrevesse de boa-fé.
 */
const PROMESSAS_FALSAS = [
  /*
   * Na primeira pessoa, que é onde mora a promessa. «Fornece contentores?» é
   * uma PERGUNTA — dessas o site tem sete, e é suposto tê-las: são procuradas
   * no Google e agora são respondidas com um não.
   */
  "fornecemos contentores",
  "Fornecemos contentores",
  "fornecemos contentor",
  "alugamos contentores",
  "aluguer de contentor",
  "deixamos contentor",
  "colocamos contentor",
  "Ficam contentores",
  "entregamos contentor",
  "entregam contentor",
  "o contentor fica",
  "O contentor fica",
  "precisa de contentor",
  "contentores de vários tamanhos",
  "contentores de 3m³",
  "em sacos, a granel",
  "sacos big bag",
  "saco big bag",
  "big bags e",
  "Big Bags,",
];

describe("nenhuma promessa de contentor sobrevive no código", () => {
  it("as vinte frases antigas não estão em lado nenhum", () => {
    const reincidentes: string[] = [];
    for (const f of ficheirosDeProducao()) {
      // O ficheiro que EXPLICA que não há contentores cita-as de propósito.
      if (f.endsWith("sacos-de-entulho.ts")) continue;
      const texto = ler(f);
      for (const frase of PROMESSAS_FALSAS) {
        if (texto.includes(frase)) {
          reincidentes.push(`${f.replace(process.cwd(), "")} → «${frase}»`);
        }
      }
    }
    expect(
      reincidentes,
      `A promessa do contentor voltou em:\n${reincidentes.join("\n")}`,
    ).toEqual([]);
  });
});

describe("o conteúdo das cidades diz o que acontece mesmo", () => {
  const entulho = Object.entries(CITY_SERVICE_CONTENT).filter(
    ([, c]) => c.serviceSlug === "recolha-entulho",
  );

  it("há páginas de entulho para testar", () => {
    expect(entulho.length).toBeGreaterThan(3);
  });

  it("nenhuma promete contentor no título ou no H1 — é o que vai ao Google", () => {
    for (const [slug, c] of entulho) {
      expect(c.metaTitle.toLowerCase(), slug).not.toContain("contentor");
      expect(c.h1.toLowerCase(), slug).not.toContain("contentor");
      expect(c.metaTitle.toLowerCase(), slug).not.toContain("big bag");
      expect(c.h1.toLowerCase(), slug).not.toContain("big bag");
    }
  });

  it("nenhuma promete contentor no que convida a pedir", () => {
    for (const [slug, c] of entulho) {
      expect(c.ctaText.toLowerCase(), slug).not.toContain("contentor");
    }
  });

  it("as perguntas sobre contentores continuam a existir — respondidas com um não", () => {
    /*
     * Apagar a pergunta perdia quem a procura no Google. O que muda é a
     * resposta: quem só quer um contentor descobre-o em dez segundos, em vez
     * de o descobrir na véspera da obra.
     */
    const sobreContentores = entulho.flatMap(([slug, c]) =>
      c.faqs.filter((f) => f.q.toLowerCase().includes("contentor")).map((f) => ({ slug, f })),
    );
    expect(sobreContentores.length).toBeGreaterThan(3);
    for (const { slug, f } of sobreContentores) {
      expect(f.a.toLowerCase(), `${slug}: ${f.q}`).toContain("não");
      expect(f.a, `${slug}: ${f.q}`).not.toContain("Sim.");
    }
  });
});

describe("a fonte única diz o serviço em uma linha", () => {
  it("o saco é de 25 kg", () => {
    expect(PESO_MAXIMO_DO_SACO_KG).toBe(25);
    expect(COMO_SE_RECOLHE_ENTULHO).toContain("25 kg");
    expect(COMO_SE_RECOLHE_ENTULHO).toContain("à mão");
  });

  it("o «não» é dito sem rodeios, e as duas coisas de uma vez", () => {
    expect(NAO_HA_CONTENTORES).toContain("não fornece nem aluga contentores");
    expect(NAO_HA_CONTENTORES).toContain("a granel");
  });

  it("a resposta longa diz o que existe em vez do contentor", () => {
    expect(RESPOSTA_SOBRE_CONTENTORES).toContain(NAO_HA_CONTENTORES);
    expect(RESPOSTA_SOBRE_CONTENTORES).toContain("ensaca-o no local");
    // E manda a quem precisa mesmo de contentor para quem os tem.
    expect(RESPOSTA_SOBRE_CONTENTORES).toContain("empresa de aluguer de contentores");
  });

  it("a conta de sacos por metro cúbico serve para explicar quantidades", () => {
    expect(sacosDeUmMetroCubico(1)).toBe(40);
    expect(sacosDeUmMetroCubico(0)).toBe(0);
  });
});

describe("os formulários não oferecem o que não se faz", () => {
  const SIMULADOR = ler(join(RAIZ, "app/simulador/components/EntulhoDetails.tsx"));
  const PLATAFORMA = ler(join(RAIZ, "app/plataforma/pedir/components/EntulhoDetails.tsx"));
  const REGISTAR = ler(join(RAIZ, "components/admin/RegistarPedido.tsx"));

  it("nem o simulador nem o pedido da plataforma têm o botão dos big bags", () => {
    expect(SIMULADOR).not.toContain('stateBtn("bigbags"');
    expect(PLATAFORMA).not.toContain('stateBtn("bigbags"');
  });

  it("e os dois dizem, ali mesmo, como é que a recolha é feita", () => {
    for (const [nome, f] of [
      ["simulador", SIMULADOR],
      ["plataforma", PLATAFORMA],
    ] as const) {
      expect(f, nome).toContain("PESO_MAXIMO_DO_SACO_KG");
      expect(f, nome).toContain("Não há contentores nem big bags");
    }
  });

  it("o registo manual do backoffice também não o oferece", () => {
    // Um assistente ao telefone a escolher «big bags» marca um trabalho que
    // ninguém pode fazer, e quem o descobre é o profissional, à porta.
    expect(REGISTAR).not.toContain('["bigbags", "Big bags"]');
  });
});
