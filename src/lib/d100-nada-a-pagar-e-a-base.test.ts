import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { avisoDeEscolhaAoProfissional, NADA_A_PAGAR_AGORA_NO_NOVO_MODELO } from "./aviso-de-oferta-clyon";
import { DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO } from "./novo-modelo";
import { escolherResultado, geocodificarLocalidade, naZonaDaClyon, RESULTADOS_POR_NOME } from "./geocodificar";
import { distanciaParaElegibilidade } from "./distancia-entre-pontos";
import { distanciaParaOAviso } from "./aviso-de-pedido-ao-profissional";

/*
 * d100 (CEO e dono, 23-11-2026).
 *
 * (1) O WhatsApp ao parceiro escolhido («o trabalho é seu… a morada e o
 *     contacto do cliente já estão no seu painel») passa a dizer, no modelo de
 *     15-11, que não há nada a pagar agora: o cliente paga-lhe, e a referência
 *     da taxa da plataforma e do IVA dela vem quando o trabalho ficar
 *     confirmado, com DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO dias para a pagar.
 * (2) «A cerca de 146 km da sua base» numa recolha em Lisboa a um parceiro de
 *     Lisboa: a base tinha sido localizada pelo nome, e o nome existe duas
 *     vezes no país. O Nominatim só dava o primeiro resultado.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const AGORA = new Date("2026-11-23T12:00:00Z");
const BASE = {
  pedidoId: 9001,
  servico: "recolha_moveis",
  localidade: "Lisboa",
  valor: 90,
  link: "https://clyon.pt/profissionais/painel",
};

describe("d100 (1): nada a pagar agora, no aviso ao escolhido", () => {
  it("no modelo de 15-11 diz que o cliente paga e que a referência vem na confirmação, com o prazo da constante", () => {
    const t = avisoDeEscolhaAoProfissional("Ana", { ...BASE, novoModelo: true }, AGORA);
    expect(t).toContain(NADA_A_PAGAR_AGORA_NO_NOVO_MODELO);
    expect(t).toContain("Não tem nada a pagar agora");
    expect(t).toContain("o cliente paga-lhe diretamente no dia do trabalho");
    expect(t).toContain("Quando o trabalho ficar confirmado");
    expect(t).toContain("referência Multibanco da taxa da plataforma e do IVA dela");
    expect(t).toContain(`tem ${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias para a pagar`);
    // A frase vem depois da morada e do contacto, e o aviso continua a dar o painel.
    expect(t.indexOf("A morada e o contacto do cliente")).toBeLessThan(t.indexOf("Não tem nada a pagar agora"));
  });

  it("também quando foi atribuído por fora", () => {
    const t = avisoDeEscolhaAoProfissional("Ana", { ...BASE, porFora: true, novoModelo: true }, AGORA);
    expect(t).toContain(NADA_A_PAGAR_AGORA_NO_NOVO_MODELO);
  });

  it("no modelo antigo (ou sem saber) fica como estava", () => {
    for (const novoModelo of [false, undefined]) {
      const t = avisoDeEscolhaAoProfissional("Ana", { ...BASE, novoModelo }, AGORA);
      expect(t).not.toContain("nada a pagar");
      expect(t.endsWith(`A morada e o contacto do cliente já estão no seu painel: ${BASE.link}`)).toBe(true);
    }
  });

  it("o número de dias não está escrito à mão: vem de novo-modelo.ts", () => {
    const fonte = semComentarios(ler("src/lib/nada-a-pagar-agora.ts"));
    expect(fonte).toContain("${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias para a pagar");
    expect(fonte).not.toMatch(/\b\d+ dias para a pagar/);
  });

  it("quem envia pergunta ao servidor se o trabalho segue o modelo de 15-11", () => {
    const fonte = semComentarios(ler("src/lib/avisar-escolhido-da-oferta.ts"));
    expect(fonte).toContain("segueONovoModelo({ id: a.negociacaoId })");
    expect(fonte).toMatch(/novoModelo,\n\s*\},/);
  });
});

/* Os dois sítios com o mesmo nome: o bairro de Lisboa e a vila do Alentejo. */
const ALENTEJO = { lat: "37.938", lon: "-8.393" };
const LISBOA = { lat: "38.747", lon: "-9.140" };
const PEDIDO_EM_LISBOA = { lat: 38.73, lng: -9.17 };

describe("d100 (2): a base pelo nome fica na zona da CLYON quando o nome se repete", () => {
  it("o caso que deu 146 km: o primeiro resultado é o do Alentejo, fica o de Lisboa", () => {
    const base = escolherResultado([ALENTEJO, LISBOA]);
    expect(base).toEqual({ lat: 38.747, lng: -9.14 });
    const km = distanciaParaElegibilidade(base, PEDIDO_EM_LISBOA);
    expect(km).not.toBeNull();
    expect(km!).toBeLessThan(15);
    expect(distanciaParaOAviso(km)).not.toMatch(/1\d\d km/);
  });

  it("o erro reproduzido: com a base do Alentejo, o aviso dizia mais de 100 km", () => {
    const errada = { lat: 37.938, lng: -8.393 };
    expect(naZonaDaClyon(errada)).toBe(false);
    const km = distanciaParaElegibilidade(errada, PEDIDO_EM_LISBOA)!;
    expect(km).toBeGreaterThan(100);
  });

  it("sem nenhum resultado na zona, fica o primeiro (uma terra do Norte continua a ser a do Norte)", () => {
    expect(escolherResultado([{ lat: "41.15", lon: "-8.61" }, { lat: "40.2", lon: "-8.4" }])).toEqual({ lat: 41.15, lng: -8.61 });
  });

  it("resultados sem coordenadas não contam, e uma resposta vazia dá nulo", () => {
    expect(escolherResultado([{ lat: "" , lon: "" }, { lon: "-9" }, LISBOA])).toEqual({ lat: 38.747, lng: -9.14 });
    expect(escolherResultado([])).toBeNull();
    expect(escolherResultado(null)).toBeNull();
  });

  describe("geocodificarLocalidade", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("pede vários resultados e escolhe o da zona", async () => {
      const chamadas: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          chamadas.push(String(url));
          return { ok: true, json: async () => [ALENTEJO, LISBOA] } as Response;
        }),
      );
      const base = await geocodificarLocalidade("Alvalade");
      expect(base).toEqual({ lat: 38.747, lng: -9.14 });
      const u = new URL(chamadas[0]);
      expect(u.searchParams.get("limit")).toBe(String(RESULTADOS_POR_NOME));
      expect(Number(u.searchParams.get("limit"))).toBeGreaterThan(1);
      expect(u.searchParams.get("countrycodes")).toBe("pt");
    });
  });
});
