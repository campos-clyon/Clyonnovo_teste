import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * d38 v2, commit b (15-11-2026) — A FOLHA FINAL DA MUDANÇA PELA EQUIPA.
 *
 * · a taxa é a gravada no trabalho e conta só sobre horas + deslocação (o #524:
 *   15 %, 75,45 € de taxa, 472,55 € ao profissional, 674,04 € com IVA);
 * · o que se grava (valor sem IVA + taxa efectiva) faz todos os ecrãs dizerem o
 *   mesmo que a folha, ao cêntimo;
 * · o exemplo do dono no modelo de 15-11 (120 € a 10 %: 108 / 12 → 132,84 +
 *   14,76 = 147,60);
 * · a rota: só administradores, pré-visualizar não grava, já pago pede motivo,
 *   e o cliente não é avisado (isso é o «Enviar o valor final»).
 */

vi.mock("./db", () => ({
  appendOrderHistory: vi.fn(async () => {}),
  registarSemFalhar: vi.fn(async () => {}),
  folhaDaNegociacao: vi.fn(async () => null),
  getSimulatorOrderById: vi.fn(async () => ({ id: 524, serviceType: "mudanca", baseDoPreco: "fixo", valorFixoClyon: 500, taxaClyon: "0.1500" })),
  getPool: vi.fn(async () => null),
}));
vi.mock("./avisos-do-backoffice", () => ({ avisarProfissional: vi.fn(async () => {}), avisarCliente: vi.fn(async () => {}) }));
vi.mock("./acesso-ao-pagamento", () => ({
  trabalhoVistoPeloBackoffice: vi.fn(async () => ({ ok: true, trabalho: { regime: "normal", novoModelo: false } })),
}));
vi.mock("./folha-final-na-base", () => ({
  folhasFinaisDe: vi.fn(async () => []),
  gravarFolhaFinal: vi.fn(async () => ({ ok: true, id: 1 })),
  transferidoAntesDasFolhasFinais: vi.fn(async () => new Map()),
}));

import { contaDaFolhaFinal } from "./conta-da-mudanca";
import {
  centimosDe,
  fazerAFolhaFinal,
  horasDe,
  lerCorpoDaFolhaFinal,
  taxaDaFolhaFinal,
  taxaEfectiva,
  type CorpoDaFolhaFinal,
} from "./folha-final";
import { quantoOProfissionalRecebe } from "./taxas-plataforma";
import { contaDaLinha, contaDoTrabalhoClyon, contaFecha } from "./conta-do-pagamento";
import { folhaFinalPelaEquipa } from "./folha-final-no-servidor";
import * as db from "./db";
import * as avisos from "./avisos-do-backoffice";
import * as naBase from "./folha-final-na-base";

/** Um caso com os números do #524 (inventados os pormenores): 503 € de horas + deslocação, 45 € de material. */
const COMO_O_524: CorpoDaFolhaFinal = {
  pessoas: 3,
  horas: "8",
  precoHora: "55",
  deslocacaoTipo: "euros",
  deslocacaoEuros: "63",
  materiais: [
    { descricao: "Caixas", valor: "30" },
    { descricao: "Filme", valor: "15,00" },
  ],
};

const TAXA_CLYON_15 = { daFolhaAnterior: null, trabalhoClyon: true, taxaClyon: 0.15, tarifa: null, taxaCliente: 0, taxaProfissional: 0.15 };

describe("ler o que a equipa escreve", () => {
  it("euros e horas em várias formas", () => {
    expect(centimosDe("12,5")).toBe(1250);
    expect(centimosDe("12.50 €")).toBe(1250);
    expect(centimosDe("")).toBeNull();
    expect(Number.isNaN(centimosDe("abc") as number)).toBe(true);
    expect(horasDe("6,5")).toBe(6.5);
    expect(horasDe("6:30")).toBe(6.5);
    expect(horasDe("6h15")).toBe(6.25);
    expect(Number.isNaN(horasDe("6:75") as number)).toBe(true);
  });

  it("recusa o que não se percebe", () => {
    expect(lerCorpoDaFolhaFinal({ ...COMO_O_524, pessoas: 4 }).ok).toBe(false);
    expect(lerCorpoDaFolhaFinal({ ...COMO_O_524, horas: "" }).ok).toBe(false);
    expect(lerCorpoDaFolhaFinal({ ...COMO_O_524, deslocacaoTipo: undefined }).ok).toBe(false);
    expect(lerCorpoDaFolhaFinal({ ...COMO_O_524, materiais: [{ descricao: "x", valor: "dez" }] }).ok).toBe(false);
    // Uma linha toda vazia ignora-se.
    const l = lerCorpoDaFolhaFinal({ ...COMO_O_524, materiais: [{ descricao: "", valor: "" }] });
    expect(l.ok && l.entrada.materiais).toEqual([]);
  });
});

describe("a taxa do trabalho", () => {
  it("Trabalho CLYON: a taxaClyon; antigo sem taxa: recusa", () => {
    expect(taxaDaFolhaFinal(TAXA_CLYON_15)).toEqual({ ok: true, taxa: 0.15, deOnde: "trabalho_clyon" });
    expect(taxaDaFolhaFinal({ ...TAXA_CLYON_15, taxaClyon: null }).ok).toBe(false);
  });

  it("a de uma folha final anterior manda (a da negociação já é a efectiva)", () => {
    expect(taxaDaFolhaFinal({ ...TAXA_CLYON_15, daFolhaAnterior: 0.15, taxaProfissional: 0.1376 })).toMatchObject({ taxa: 0.15, deOnde: "folha_anterior" });
  });

  it("com taxa do cliente não serve (a conta tira a taxa de dentro do valor)", () => {
    expect(taxaDaFolhaFinal({ ...TAXA_CLYON_15, trabalhoClyon: false, taxaClyon: null, taxaCliente: 0.05, taxaProfissional: 0.05 }).ok).toBe(false);
    expect(taxaDaFolhaFinal({ ...TAXA_CLYON_15, trabalhoClyon: false, taxaClyon: null, taxaCliente: 0, taxaProfissional: 0.1 })).toMatchObject({ taxa: 0.1, deOnde: "negociacao" });
  });
});

describe("o #524 a 15 %, sem o material", () => {
  const f = fazerAFolhaFinal({ corpo: COMO_O_524, tarifa: null, taxa: TAXA_CLYON_15, modelo: { novoModelo: false, regime: "normal" } });
  if (!f.ok) throw new Error(f.erro);
  const { conta, gravar, previa } = f.folha;

  it("taxa 75,45 €, profissional 472,55 €, total 674,04 € com IVA", () => {
    expect(conta.servicoCent).toBe(50300);
    expect(conta.materiais.cent).toBe(4500);
    expect(conta.taxa.cent).toBe(7545);
    expect(previa).toMatchObject({ semIva: 548, iva: 126.04, total: 674.04, profissional: 472.55, clyon: 75.45, taxa: 0.15, novoModelo: null });
  });

  it("o que se grava faz o «acordado × (1 − taxa)» dar o mesmo, ao cêntimo", () => {
    expect(gravar.valorAcordado).toBe(548);
    expect(gravar.taxaBase).toBe(0.15);
    expect(quantoOProfissionalRecebe(548, { cliente: 0, profissional: gravar.taxaProfissional })).toBe(472.55);
  });

  it("a conta do Trabalho CLYON diz o mesmo nos ecrãs, e fecha", () => {
    const c = contaDoTrabalhoClyon({ valorFixo: 548, taxa: 0.15, precoAoCliente: 548, taxaDoProfissional: gravar.taxaProfissional }, true);
    expect(c).not.toBeNull();
    expect(c!.total).toBe(674.04);
    expect(c!.profissional).toBe(472.55);
    expect(c!.clyon).toBe(75.45);
    expect(contaFecha(c!)).toBe(true);
    const daLinha = contaDaLinha(
      { valorAcordado: 548, ofertaClyon: "atribuida", valorFixoClyon: 548, taxaClyon: "0.1500", precoClienteClyon: 548, taxaProfissional: gravar.taxaProfissional, taxaCliente: 0 },
      true,
    );
    expect(daLinha!.profissional).toBe(472.55);
  });

  it("sem folha final (a taxa da negociação igual à do pedido) a conta fica como sempre", () => {
    const daLinha = contaDaLinha(
      { valorAcordado: 548, ofertaClyon: "atribuida", valorFixoClyon: 548, taxaClyon: "0.1500", precoClienteClyon: 548, taxaProfissional: "0.15000000", taxaCliente: 0 },
      true,
    );
    expect(daLinha!.profissional).toBe(465.8);
  });
});

describe("o exemplo do dono, no modelo de 15-11", () => {
  it("120 € a 10 %: o parceiro 108 (132,84 com IVA), a CLYON 12 (14,76 com IVA), o cliente 147,60", () => {
    const f = fazerAFolhaFinal({
      corpo: { pessoas: 2, horas: "3", precoHora: "40", deslocacaoTipo: "euros", deslocacaoEuros: "0" },
      tarifa: null,
      taxa: { daFolhaAnterior: null, trabalhoClyon: false, taxaClyon: null, tarifa: null, taxaCliente: 0, taxaProfissional: 0.1 },
      modelo: { novoModelo: true, regime: "normal" },
    });
    if (!f.ok) throw new Error(f.erro);
    expect(f.folha.previa).toMatchObject({
      semIva: 120,
      total: 147.6,
      profissional: 108,
      clyon: 12,
      novoModelo: { faturaDoParceiro: 132.84, faturaDaClyon: 14.76, regime: "normal" },
    });
  });

  it("parceiro isento: a fatura dele sem IVA, a da CLYON sempre com IVA", () => {
    const f = fazerAFolhaFinal({
      corpo: { pessoas: 2, horas: "3", precoHora: "40", deslocacaoTipo: "euros", deslocacaoEuros: "0" },
      tarifa: null,
      taxa: { daFolhaAnterior: null, trabalhoClyon: false, taxaClyon: null, tarifa: null, taxaCliente: 0, taxaProfissional: 0.1 },
      modelo: { novoModelo: true, regime: "isento" },
    });
    if (!f.ok) throw new Error(f.erro);
    expect(f.folha.previa.novoModelo).toEqual({ faturaDoParceiro: 108, faturaDaClyon: 14.76, regime: "isento" });
    expect(f.folha.previa.total).toBe(122.76);
  });
});

describe("a taxa efectiva fecha sempre ao cêntimo", () => {
  it("em muitos casos de horas, deslocação, material e taxa", () => {
    let semente = 7;
    const aleatorio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 400; i++) {
      const taxa = [0.1, 0.15, 0.2][i % 3];
      const c = contaDaFolhaFinal({
        tarifa: null,
        pessoas: 2,
        horas: Math.round((1 + aleatorio() * 12) * 4) / 4,
        precoHoraCent: 2000 + Math.round(aleatorio() * 10000),
        deslocacao: { tipo: "euros", cent: Math.round(aleatorio() * 20000) },
        materiais: aleatorio() < 0.5 ? [] : [{ descricao: "m", cent: Math.round(aleatorio() * 30000) }],
        regras: { taxa, modo: "de_dentro", materialComIva: true, iva: 0.23 },
      });
      if (!c.ok) throw new Error(c.erro);
      const t = taxaEfectiva(c.semIvaCent, c.profissionalCent);
      expect(t).not.toBeNull();
      expect(quantoOProfissionalRecebe(c.semIvaCent / 100, { cliente: 0, profissional: t! })).toBeCloseTo(c.profissionalCent / 100, 6);
      // Oito casas: cabe na coluna DECIMAL(10,8).
      expect(Math.round(t! * 1e8) / 1e8).toBe(t);
    }
  });
});

describe("a rota (simulação, sem base)", () => {
  const linha = {
    id: 900,
    pedidoId: 524,
    providerId: 77,
    estado: "acordada",
    ofertaClyon: "atribuida",
    valorAcordado: "500.00",
    taxaCliente: "0.0000",
    taxaProfissional: "0.15000000",
    pagoEm: null as Date | null,
    formaDePagamento: "na_plataforma",
  };

  beforeEach(() => {
    vi.mocked(naBase.gravarFolhaFinal).mockClear();
    vi.mocked(avisos.avisarProfissional).mockClear();
    vi.mocked(avisos.avisarCliente).mockClear();
    vi.mocked(db.appendOrderHistory).mockClear();
  });

  it("pré-visualizar não grava nem avisa ninguém", async () => {
    const r = await folhaFinalPelaEquipa({ pedidoId: 524, negociacaoId: 900, linha, corpo: { ...COMO_O_524, previsualizar: true }, porQuem: "Ana" });
    expect(r.status).toBe(200);
    expect(r.corpo.previa).toMatchObject({ total: 674.04, profissional: 472.55, clyon: 75.45 });
    expect(naBase.gravarFolhaFinal).not.toHaveBeenCalled();
    expect(avisos.avisarProfissional).not.toHaveBeenCalled();
  });

  it("já pago ao profissional: sem motivo não grava", async () => {
    const r = await folhaFinalPelaEquipa({ pedidoId: 524, negociacaoId: 900, linha: { ...linha, pagoEm: new Date() }, corpo: COMO_O_524, porQuem: "Ana" });
    expect(r.status).toBe(409);
    expect(r.corpo.precisaMotivo).toBe(true);
    expect(naBase.gravarFolhaFinal).not.toHaveBeenCalled();
  });

  it("grava o valor final com o antes, avisa o profissional e não o cliente", async () => {
    const r = await folhaFinalPelaEquipa({ pedidoId: 524, negociacaoId: 900, linha, corpo: COMO_O_524, porQuem: "Ana" });
    expect(r.status).toBe(200);
    const g = vi.mocked(naBase.gravarFolhaFinal).mock.calls[0][0];
    expect(g.antes).toEqual({ valorAcordado: 500, taxaProfissional: 0.15, profissional: 425 });
    expect(g.gravar.valorAcordado).toBe(548);
    expect(g.precoClyonAcompanha).toBe(true);
    expect(g.porHora).toBe(false);
    expect(String(vi.mocked(db.appendOrderHistory).mock.calls[0][1].message)).toContain("Folha final da mudança gravada por Ana");
    expect(avisos.avisarProfissional).toHaveBeenCalledTimes(1);
    expect(avisos.avisarCliente).not.toHaveBeenCalled();
  });

  it("um trabalho que não é mudança não tem folha final", async () => {
    vi.mocked(db.getSimulatorOrderById).mockResolvedValueOnce({ id: 1, serviceType: "recolha", valorFixoClyon: 100, taxaClyon: "0.1" } as never);
    const r = await folhaFinalPelaEquipa({ pedidoId: 1, negociacaoId: 900, linha, corpo: COMO_O_524, porQuem: "Ana" });
    expect(r.status).toBe(409);
  });
});

describe("onde aparece", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("a acção está na rota das horas, só para administradores", () => {
    const rota = ler("src/app/api/admin/negociacoes/horas/route.ts");
    expect(rota).toContain('corpo.accao === "folha_final"');
    const post = rota.slice(rota.indexOf("export async function POST"));
    expect(post).toContain("requireAdminGeral(req)");
  });

  it("no lugar do «Corrigir o valor» nas mudanças: Pagamentos, Carteiras, Mesa e Trabalhos CLYON", () => {
    for (const p of [
      "src/components/admin/AdminPagamentosPanel.tsx",
      "src/components/admin/AdminCarteirasPanel.tsx",
      "src/components/admin/AdminNegociacoesPanel.tsx",
      "src/components/admin/TrabalhoClyon.tsx",
    ]) {
      const s = ler(p);
      expect(s, p).toContain("<FolhaFinalDaMudanca");
      expect(s, p).toContain("isMudancaType(");
    }
  });

  it("à hora: o preço da hora guarda-se antes de o valor passar a ser o total", () => {
    const s = ler("src/lib/folha-final-na-base.ts");
    const upd = s.slice(s.indexOf("SET valorPorHora = CASE"));
    expect(upd.indexOf("valorPorHora = CASE")).toBeLessThan(upd.indexOf("valorAcordado = ?"));
  });
});
