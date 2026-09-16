import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * «A carregar» só quando não há nada para mostrar.
 *
 * "as telas abrem rapidamente com o conteúdo já no site; eu fico à espera de
 * carregar as infos." — 16-09-2026.
 *
 * A actualização automática resolveu metade: as novidades passaram a chegar
 * sozinhas. A outra metade era esta — voltar a uma secção deitava fora o que
 * já estava no ecrã e punha uma roda por cima, mesmo com os dados em memória
 * e prestes a chegar iguais.
 *
 * A REGRA: uma roda de carregamento só informa quem não tem nada. A quem já
 * tem a lista à frente, ela só tira o que ele estava a ler.
 */

const PASTA = join(process.cwd(), "src", "components", "admin");
const ler = (f: string) => readFileSync(join(PASTA, f), "utf8").replace(/\r\n/g, "\n");

describe("nenhum painel troca o que já mostra por uma roda", () => {
  const PAINEIS = readdirSync(PASTA).filter((f) => /^Admin.*Panel\.tsx$/.test(f));

  it("há painéis que chegue para isto valer a pena", () => {
    expect(PAINEIS.length).toBeGreaterThanOrEqual(12);
  });

  for (const f of PAINEIS) {
    it(`${f.replace("Admin", "").replace("Panel.tsx", "")} não tem um gate cego`, () => {
      /*
       * `{aCarregar ? (…) : (…)}` sem mais nada é o gate cego: deita fora o
       * conteúdo sempre que se recarrega. O que se quer é
       * `aCarregar && algumaCoisa.length === 0`, ou um indicador pequeno ao
       * lado do título — nunca a troca do ecrã inteiro.
       *
       * OS COMENTÁRIOS SAEM PRIMEIRO. Este teste chumbou à nascença por causa
       * das notas que os próprios painéis têm a contar esta história: elas
       * citam `aCarregar ?` para explicar o que já não se faz, e o teste leu
       * a explicação como se fosse o código.
       */
      const fonte = ler(f)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      /*
       * Só conta o gate que abre um BLOCO: `{aCarregar ? (`. Uma roda pequena
       * dentro de um `className` — `${aCarregar ? "animate-spin" : ""}` — é
       * precisamente o que se quer em vez disto, e não pode chumbar aqui.
       */
      const linhas = fonte.split("\n").filter((l) => /\{aCarregar \?\s*\(/.test(l));
      expect({ ficheiro: f, gatesCegos: linhas.map((l) => l.trim()) }).toEqual({
        ficheiro: f,
        gatesCegos: [],
      });
    });
  }
});

describe("e o monólito também não", () => {
  const LEGACY = ler("LegacyAdminClient.tsx");

  it("os pedidos só mostram espera com a lista vazia", () => {
    expect(LEGACY).toContain("pedidosLoading && pedidos.length === 0");
  });

  it("os tickets também", () => {
    expect(LEGACY).toContain("ticketsLoading && tickets.length === 0");
  });

  it("e os números dos leads não viram travessão a cada actualização", () => {
    // Era `{loadingLeads ? "—" : stat.value}`: os números que ele estava a ler
    // desapareciam de dois em dois minutos, sem nada ter mudado.
    expect(LEGACY).not.toContain('{loadingLeads ? "—"');
    expect(LEGACY).toContain('loadingLeads && leads.length === 0 ? "—"');
  });
});
