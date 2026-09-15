import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  contaDoCliente,
  comissaoDaClyon,
  quantoOProfissionalRecebe,
  servicoMaisTaxa,
  taxasDaNegociacao,
  TAXAS_DE_ORIGEM,
  TAXA_CLIENTE,
  TAXA_MAXIMA,
  TAXA_PROFISSIONAL,
} from "./taxas-plataforma";

/**
 * A TAXA FICA PRESA À NEGOCIAÇÃO QUE A VIU NASCER.
 *
 * "Os campos das taxas da plataforma devem ser editáveis pelo admin e deve
 * mudar para todos correctamente." — 15-09-2026.
 *
 * O "correctamente" é isto. Até aqui não havia coluna nenhuma de taxa: todos os
 * números de dinheiro eram calculados AO VIVO a partir das constantes — a
 * carteira do profissional, o total do cliente, e até os trabalhos JÁ PAGOS.
 * Tornar a percentagem editável sem mais nada reescrevia o passado inteiro:
 * mudar de 6 % para 7 % mudava o total ganho de cada profissional, o que cada
 * cliente pagou em trabalhos fechados, e os números que já tinham ido em
 * factura — que passariam a não bater certo com o papel.
 *
 * Este ficheiro guarda a promessa: uma taxa nova só se aplica ao que nascer
 * depois dela.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");

const corpoDe = (nome: string) => {
  const i = DB.indexOf(`export async function ${nome}(`);
  expect(i, `${nome} não existe`).toBeGreaterThan(-1);
  const seguinte = DB.slice(i + 1).search(/\r?\n(export |\/\/ ──|\/\*)/);
  return seguinte === -1 ? DB.slice(i) : DB.slice(i, i + 1 + seguinte);
};

describe("as taxas de uma negociação", () => {
  it("sem coluna gravada, são as de origem — a linha é anterior a isto existir", () => {
    expect(taxasDaNegociacao(null)).toEqual(TAXAS_DE_ORIGEM);
    expect(taxasDaNegociacao(undefined)).toEqual(TAXAS_DE_ORIGEM);
    expect(taxasDaNegociacao({})).toEqual(TAXAS_DE_ORIGEM);
    expect(taxasDaNegociacao({ taxaCliente: null, taxaProfissional: null })).toEqual(
      TAXAS_DE_ORIGEM,
    );
  });

  it("as de origem são 5 % e 6 %, e não se mexem", () => {
    // Mudá-las reescrevia o que já foi facturado: são a queda de tudo o que
    // não tem coluna.
    expect(TAXA_CLIENTE).toBe(0.05);
    expect(TAXA_PROFISSIONAL).toBe(0.06);
  });

  it("lê o que o MySQL devolve — DECIMAL vem como texto", () => {
    expect(taxasDaNegociacao({ taxaCliente: "0.0700", taxaProfissional: "0.0800" })).toEqual({
      cliente: 0.07,
      profissional: 0.08,
    });
  });

  it("zero é uma taxa legítima — uma campanha sem comissão", () => {
    expect(taxasDaNegociacao({ taxaCliente: "0.0000", taxaProfissional: 0 })).toEqual({
      cliente: 0,
      profissional: 0,
    });
  });

  it("um valor que não se percebe cai para as de origem", () => {
    /*
     * Uma conta de dinheiro nunca pode ser feita com um número que não se
     * percebe. Uma gralha de 0,06 para 6 seria uma comissão de 600 %.
     */
    for (const mau of ["", "abc", "-0.05", "6", NaN, Infinity, {}, []]) {
      expect(taxasDaNegociacao({ taxaCliente: mau, taxaProfissional: mau })).toEqual(
        TAXAS_DE_ORIGEM,
      );
    }
  });

  it("o tecto é metade, e existe", () => {
    expect(TAXA_MAXIMA).toBe(0.5);
    expect(taxasDaNegociacao({ taxaCliente: 0.5 }).cliente).toBe(0.5);
    expect(taxasDaNegociacao({ taxaCliente: 0.51 }).cliente).toBe(TAXA_CLIENTE);
  });
});

describe("as contas usam a taxa que lhes dão", () => {
  const dela = { cliente: 0.1, profissional: 0.2 };

  it("o que o cliente paga", () => {
    // 100 € a 10 %: 100 de serviço + 10 de taxa. Isento não leva IVA do
    // serviço, mas a taxa da CLYON leva sempre.
    const c = contaDoCliente(100, "isento", dela);
    expect(c.servico).toBe(100);
    expect(c.taxa).toBe(10);
    expect(c.ivaDoServico).toBe(0);
    expect(c.ivaDaTaxa).toBe(2.3);
    expect(c.total).toBe(112.3);
  });

  it("o que o profissional recebe", () => {
    expect(quantoOProfissionalRecebe(100, dela)).toBe(80);
  });

  it("e a comissão da casa vem das duas pontas", () => {
    // 110 (serviço + taxa do cliente) − 80 (o que ele recebe) = 30.
    expect(servicoMaisTaxa(100, dela)).toBe(110);
    expect(comissaoDaClyon(100, dela)).toBe(30);
  });

  it("sem taxas, continuam a ser as de origem — nada partiu", () => {
    expect(quantoOProfissionalRecebe(100)).toBe(94);
    expect(contaDoCliente(100, "isento").taxa).toBe(5);
  });
});

describe("a taxa grava-se quando a negociação nasce", () => {
  const criar = corpoDe("criarNegociacao");

  it("as duas colunas vão no INSERT", () => {
    expect(criar).toContain("taxaCliente, taxaProfissional)");
    expect(criar).toContain("taxas.cliente");
    expect(criar).toContain("taxas.profissional");
  });

  it("e vêm das taxas em vigor, não de um número escrito ali", () => {
    expect(criar).toContain("await taxasParaUmaNegociacaoNova()");
    expect(DB).toContain("async function taxasParaUmaNegociacaoNova()");
  });

  it("reabrir renova-as — a negociação nasce outra vez", () => {
    // Reabrir substitui as propostas todas: o que o cliente tinha visto deixa
    // de existir por decisão de quem reabriu, e não há promessa a proteger.
    expect(criar).toContain("taxaCliente = VALUES(taxaCliente)");
    expect(criar).toContain("taxaProfissional = VALUES(taxaProfissional)");
  });

  it("não há backfill em massa numa tabela de dinheiro", () => {
    // NULL já quer dizer "as de origem". Um UPDATE em todas as linhas, para
    // gravar o que a ausência já diz, seria risco sem ganho nenhum.
    expect(DB).not.toMatch(/UPDATE negociacoes SET taxaCliente = [\d.]+/);
  });
});

describe("a carteira usa a taxa de cada trabalho", () => {
  it("e não a de hoje", () => {
    /*
     * Era aqui que doía mais: a carteira é recalculada sempre que o
     * profissional a abre. Sem isto, mudar a percentagem mexia no total ganho
     * de trabalhos feitos e pagos há meses.
     */
    const CARTEIRA = ler("src/lib/carteira.ts");
    expect(CARTEIRA).toContain("taxasDaNegociacao(t)");
    expect(CARTEIRA).toContain("taxaProfissional?: number | string | null");
  });

  it("e quem a monta traz as colunas da base", () => {
    for (const p of [
      "src/app/api/profissionais/carteira/route.ts",
      "src/app/api/profissionais/levantamento/route.ts",
    ]) {
      expect(ler(p), p).toContain("taxaProfissional: l.taxaProfissional");
    }
  });
});

describe("as consultas trazem as colunas", () => {
  it("quem faz contas de dinheiro pede-as ao MySQL", () => {
    /*
     * Uma consulta que não as traga faz a conta com as de origem em SILÊNCIO —
     * sem erro, sem aviso, e com o número errado no ecrã de alguém. É a forma
     * como isto volta a partir-se.
     */
    for (const p of [
      "src/app/api/admin/agenda/route.ts",
      "src/app/api/admin/carteiras/route.ts",
      "src/app/api/admin/negociacoes/valor/route.ts",
      "src/app/api/users/me/orders/route.ts",
      "src/lib/conta-server.ts",
    ]) {
      expect(ler(p), p).toContain("taxaProfissional");
    }
    expect(DB).toContain("n.taxaCliente, n.taxaProfissional");
  });
});

describe("mudar a taxa", () => {
  const guardar = corpoDe("guardarTaxas");

  it("recusa o que não é uma percentagem", () => {
    // Uma gralha de 6 para 60 não pode chegar à conta de ninguém.
    expect(guardar).toContain("n < 0 || n > TAXA_MAXIMA");
    expect(guardar).toContain("throw new Error");
  });

  it("fica escrito quem mudou, e de quanto para quanto", () => {
    // Uma percentagem que aparece diferente sem nome nem data é a pior linha
    // de um livro de contas.
    expect(guardar).toContain("taxas_alteradas");
    expect(guardar).toContain("antes");
    expect(DB).toContain('| "taxas_alteradas"');
  });

  it("e não toca em negociação nenhuma", () => {
    // O ponto todo: mudar a taxa só muda o que nascer a seguir.
    expect(guardar).not.toContain("UPDATE negociacoes");
    expect(guardar).not.toContain("negociacoes SET");
  });

  it("sem base, ou sem linha, valem as de origem", () => {
    // Um erro de ligação não pode virar uma taxa de zero por cento.
    const actuais = corpoDe("taxasActuais");
    expect(actuais).toContain("return TAXAS_DE_ORIGEM");
    expect(actuais).toContain("catch");
  });
});
