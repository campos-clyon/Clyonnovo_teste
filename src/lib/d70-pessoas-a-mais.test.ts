import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * d70 (17-11-2026) — NA FOLHA DA MUDANÇA, A EQUIPA VAI DE 2 A 8 PESSOAS.
 *
 * · acima de 3, a hora é a da equipa de 3 + PRECO_POR_PESSOA_A_MAIS_SEM_IVA por
 *   pessoa (62 → 75 com 4 → 127 com 8, sem IVA);
 * · cada pessoa a mais só com «O cliente concordou com as pessoas a mais»
 *   (quando e quem): sem a marca, o servidor recusa a folha;
 * · a taxa continua sobre horas + deslocação (as horas já com a hora maior);
 * · o cliente lê «4 pessoas, 75,00 €/h + IVA (92,25 € com IVA)»;
 * · o simulador, a lista de parceiros e as tarifas continuam com 2 ou 3.
 */

vi.mock("./db", () => ({
  appendOrderHistory: vi.fn(async () => {}),
  registarSemFalhar: vi.fn(async () => {}),
  folhaDaNegociacao: vi.fn(async () => null),
  getSimulatorOrderById: vi.fn(async () => ({ id: 591, serviceType: "mudanca", baseDoPreco: "hora", valorFixoClyon: 186, taxaClyon: "0.1000" })),
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

import {
  PESSOAS_DA_FOLHA,
  PRECO_POR_PESSOA_A_MAIS_SEM_IVA,
  SEM_ACORDO_DAS_PESSOAS_A_MAIS,
  acordoParaGravar,
  ePessoasDaFolha,
  precoDaHoraParaPessoas,
  precoDaHoraParaPessoasCent,
} from "./tabela-das-mudancas";
import { congelarTarifa, contaDaFolhaFinal, REGRAS_DAS_MUDANCAS, validarTarifa, type TarifaDasMudancas } from "./conta-da-mudanca";
import { fazerAFolhaFinal, lerCorpoDaFolhaFinal } from "./folha-final";
import { camposDaFolha, folhaNoEcra, lerFolha, lerRascunhoDaFolha, rascunhoDeJson, type ContextoDaFolha } from "./folha-da-mudanca";
import { folhaFinalPelaEquipa } from "./folha-final-no-servidor";
import { oQueMudouDaFolha } from "./valor-final-ao-cliente";
import * as naBase from "./folha-final-na-base";

const AGORA = new Date("2026-11-17T12:00:00Z");

describe("a fonte: o preço da hora para n pessoas", () => {
  it("13 € sem IVA por pessoa acima de 3", () => {
    expect(PRECO_POR_PESSOA_A_MAIS_SEM_IVA).toBe(13);
    expect(precoDaHoraParaPessoasCent(6200, 3)).toBe(6200);
    expect(precoDaHoraParaPessoasCent(6200, 4)).toBe(7500);
    expect(precoDaHoraParaPessoasCent(6200, 8)).toBe(12700); // 62 + 5 × 13
    expect(precoDaHoraParaPessoas(62, 4)).toBe(75);
    expect(precoDaHoraParaPessoas(62, 8)).toBe(127);
    expect(PESSOAS_DA_FOLHA).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(ePessoasDaFolha(8)).toBe(true);
    expect(ePessoasDaFolha(9)).toBe(false);
    expect(ePessoasDaFolha(1)).toBe(false);
    expect(ePessoasDaFolha(3.5)).toBe(false);
  });

  it("o acordo: só acima de 3 e com a caixa marcada; o anterior fica se já cobria as pessoas", () => {
    const quem = { por: "admin" as const, nome: "Ana" };
    expect(acordoParaGravar({ pessoas: 3, marcado: true, quem, agora: AGORA })).toBeNull();
    expect(acordoParaGravar({ pessoas: 4, marcado: false, quem, agora: AGORA })).toBeNull();
    expect(acordoParaGravar({ pessoas: 4, marcado: "true", quem, agora: AGORA })).toBeNull();
    const a = acordoParaGravar({ pessoas: 4, marcado: true, quem, agora: AGORA })!;
    expect(a).toEqual({ em: AGORA.toISOString(), por: "admin", nome: "Ana", pessoas: 4 });
    const antes = { em: "2026-11-16T10:00:00.000Z", por: "profissional" as const, nome: "Rui", pessoas: 5 as const };
    expect(acordoParaGravar({ pessoas: 4, marcado: true, anterior: antes, quem, agora: AGORA })).toBe(antes);
    expect(acordoParaGravar({ pessoas: 6, marcado: true, anterior: antes, quem, agora: AGORA })!.pessoas).toBe(6);
  });

  it("a tarifa dos parceiros não muda: continua com a hora de 2 e a de 3", () => {
    const r = validarTarifa({ precoHora2: 45, precoHora3: 62, minimoHoras: 3, precoKm: 0.5, kmMinimo: 0, kmMaximo: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.tarifa).filter((k) => k.startsWith("precoHora"))).toEqual(["precoHora2", "precoHora3"]);
  });
});

describe("a folha final da equipa (backoffice)", () => {
  const corpo = { pessoas: 4, horas: "4", precoHora: "62", deslocacaoTipo: "euros", deslocacaoEuros: "0" };
  const registo = { quem: { por: "admin" as const, nome: "Ana" }, agora: AGORA };

  it("4 pessoas sem a marca: recusa", () => {
    const r = lerCorpoDaFolhaFinal(corpo, registo);
    expect(r).toEqual({ ok: false, erro: SEM_ACORDO_DAS_PESSOAS_A_MAIS });
  });

  it("4 pessoas com a marca: 75 €/h sem IVA com 62 de base, e o acordo gravado com quem e quando", () => {
    const r = lerCorpoDaFolhaFinal({ ...corpo, acordoDasPessoasAMais: true }, registo);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entrada.acordoDasPessoasAMais).toEqual({ em: AGORA.toISOString(), por: "admin", nome: "Ana", pessoas: 4 });
    const c = contaDaFolhaFinal({ ...r.entrada, tarifa: null, regras: { ...REGRAS_DAS_MUDANCAS, taxa: 0.1 } });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.pessoas).toBe(4);
    expect(c.horas.precoHoraCent).toBe(7500);
    expect(c.horas.precoDaEquipaDe3Cent).toBe(6200);
    expect(c.horas.pessoasAMais).toBe(1);
    expect(c.horas.cent).toBe(30000);
    // A taxa continua sobre horas + deslocação, as horas já com a hora maior.
    expect(c.taxa.cent).toBe(3000);
  });

  it("3 e 8 pessoas", () => {
    const tres = fazerAFolhaFinal({
      corpo: { ...corpo, pessoas: 3 },
      tarifa: null,
      taxa: { daFolhaAnterior: null, trabalhoClyon: true, taxaClyon: 0.1, tarifa: null, taxaCliente: 0, taxaProfissional: 0.1 },
      modelo: { novoModelo: false, regime: "normal" },
      registo,
    });
    expect(tres.ok && tres.folha.conta.horas.precoHoraCent).toBe(6200);
    expect(tres.ok && tres.folha.entrada.acordoDasPessoasAMais).toBeUndefined();
    const oito = fazerAFolhaFinal({
      corpo: { ...corpo, pessoas: 8, acordoDasPessoasAMais: true },
      tarifa: null,
      taxa: { daFolhaAnterior: null, trabalhoClyon: true, taxaClyon: 0.1, tarifa: null, taxaCliente: 0, taxaProfissional: 0.1 },
      modelo: { novoModelo: false, regime: "normal" },
      registo,
    });
    expect(oito.ok && oito.folha.conta.horas.precoHoraCent).toBe(12700);
    expect(oito.ok && oito.folha.conta.horas.cent).toBe(50800);
  });

  it("a conta, chamada sem o acordo, também recusa (as duas portas)", () => {
    const c = contaDaFolhaFinal({ tarifa: null, pessoas: 5, horas: 4, precoHoraCent: 6200, deslocacao: { tipo: "euros", cent: 0 } });
    expect(c).toEqual({ ok: false, erro: SEM_ACORDO_DAS_PESSOAS_A_MAIS });
    expect(lerCorpoDaFolhaFinal({ ...corpo, pessoas: 9, acordoDasPessoasAMais: true }, registo).ok).toBe(false);
  });

  it("com a tarifa congelada, a base é a hora de 3 da tarifa", () => {
    const t = congelarTarifa({ precoHora2: 45, precoHora3: 62, minimoHoras: 3, precoKm: 0.5, kmMinimo: 0, kmMaximo: 100, caixa: null, cartaoMetro: null, filmeRolo: null, plasticoBolhaRolo: null, aparecerNaLista: true });
    const r = lerCorpoDaFolhaFinal({ ...corpo, precoHora: "", acordoDasPessoasAMais: true }, registo);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = contaDaFolhaFinal({ ...r.entrada, tarifa: t });
    expect(c.ok && c.horas.precoHoraCent).toBe(7500);
  });

  describe("a rota (simulação, sem base)", () => {
    const linha = {
      id: 900,
      pedidoId: 591,
      providerId: 77,
      estado: "acordada",
      ofertaClyon: "atribuida",
      valorAcordado: "186.00",
      taxaCliente: "0.0000",
      taxaProfissional: "0.10000000",
      pagoEm: null as Date | null,
      formaDePagamento: "na_plataforma",
    };
    beforeEach(() => vi.mocked(naBase.gravarFolhaFinal).mockClear());

    it("sem a marca o servidor recusa e não grava", async () => {
      const r = await folhaFinalPelaEquipa({ pedidoId: 591, negociacaoId: 900, linha, corpo, porQuem: "Ana", papel: "admin" });
      expect(r.status).toBe(400);
      expect(r.corpo.error).toBe(SEM_ACORDO_DAS_PESSOAS_A_MAIS);
      expect(naBase.gravarFolhaFinal).not.toHaveBeenCalled();
    });

    it("com a marca grava o acordo na entrada, e o histórico diz a equipa de 4", async () => {
      const r = await folhaFinalPelaEquipa({ pedidoId: 591, negociacaoId: 900, linha, corpo: { ...corpo, acordoDasPessoasAMais: true }, porQuem: "Ana", papel: "admin" });
      expect(r.status).toBe(200);
      const g = vi.mocked(naBase.gravarFolhaFinal).mock.calls[0][0];
      expect(g.entrada.pessoas).toBe(4);
      expect(g.entrada.acordoDasPessoasAMais).toMatchObject({ por: "admin", nome: "Ana", pessoas: 4 });
      expect(g.conta.horas.precoHoraCent).toBe(7500);
    });
  });

  it("a mensagem do valor final diz a equipa de 4", () => {
    expect(oQueMudouDaFolha({ pessoas: 4, horas: 4 })).toContain("equipa de 4 pessoas");
    expect(oQueMudouDaFolha({ pessoas: 3, horas: 4 })).toContain("equipa de 3 pessoas");
  });
});

describe("a folha do parceiro (painel, Mesa, app Pro)", () => {
  const TARIFA: TarifaDasMudancas = {
    precoHora2: 45,
    precoHora3: 62,
    minimoHoras: 3,
    precoKm: 0.5,
    kmMinimo: 0,
    kmMaximo: 100,
    caixa: null,
    cartaoMetro: null,
    filmeRolo: null,
    plasticoBolhaRolo: null,
    aparecerNaLista: true,
  };
  const CTX: ContextoDaFolha = {
    tarifa: congelarTarifa(TARIFA, REGRAS_DAS_MUDANCAS, new Date("2026-11-15T10:00:00Z")),
    pessoasEscolhidas: 3,
    kmDoPercurso: 10,
    valorPorHoraAcordado: null,
    diaPorOmissao: "2026-11-16",
  };
  const corpo = { inicio: "09:00", fim: "13:00", km: "10", pessoas: 4 };

  it("4 pessoas sem a marca: recusa, no campo das pessoas", () => {
    const r = lerFolha(corpo, CTX, AGORA);
    expect(r).toMatchObject({ ok: false, campo: "pessoas", erro: SEM_ACORDO_DAS_PESSOAS_A_MAIS });
  });

  it("4 pessoas com a marca: 75 €/h, o acordo do profissional, e o cliente lê-o com o com IVA ao lado", () => {
    const r = lerFolha({ ...corpo, acordoDasPessoasAMais: true }, CTX, AGORA, { por: "profissional", nome: "Rui" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const f = r.folha;
    expect(f.pessoas).toBe(4);
    expect(f.conta.pessoas).toBe(4);
    expect(f.horaCent).toBe(7500);
    expect(f.conta.horas.cent).toBe(30000);
    expect(f.conta.taxa.cent).toBe(Math.round((30000 + f.conta.km.cent) * REGRAS_DAS_MUDANCAS.taxa));
    expect(f.acordoDasPessoasAMais).toEqual({ em: AGORA.toISOString(), por: "profissional", nome: "Rui", pessoas: 4 });
    const cliente = folhaNoEcra(f, "cliente", 3);
    expect(cliente.avisoDaEquipa).toContain("A equipa foi de 4 pessoas, com o seu acordo registado a 17/11/2026 pelo parceiro");
    expect(cliente.avisoDaEquipa).toContain("75,00 €/h + IVA (92,25 € com IVA)");
    expect(cliente.avisoDaEquipa).toContain("13,00 € + IVA (15,99 € com IVA) por cada pessoa a mais");
    expect(cliente.resumo).toContain("com 4 pessoas");
    expect(cliente.linhas.find((l) => l.rotulo === "Horas (equipa de 4)")?.nota).toContain("equipa de 3 a 62,00 €/h + 1 pessoa a mais");
    const parceiro = folhaNoEcra(f, "parceiro", 3);
    expect(parceiro.avisoDaEquipa).toContain("com o acordo do cliente registado a 17/11/2026 por si");
  });

  it("8 pessoas: 127 €/h (62 + 5 × 13); e sem preço da equipa de 3 não há mais de 3", () => {
    const r = lerFolha({ ...corpo, pessoas: 8, acordoDasPessoasAMais: true }, CTX, AGORA);
    expect(r.ok && r.folha.horaCent).toBe(12700);
    const sem3 = { ...CTX, pessoasEscolhidas: 2 as const, tarifa: congelarTarifa({ ...TARIFA, precoHora3: null }) };
    expect(lerFolha({ ...corpo, acordoDasPessoasAMais: true }, sem3, AGORA).ok).toBe(false);
    expect(camposDaFolha(null, sem3).pessoasMaximas).toBe(2);
  });

  it("os campos e o rascunho: a equipa verdadeira em pessoasDaFolha; pessoas fica 2 ou 3 para a app Pro de hoje", () => {
    const r = lerFolha({ ...corpo, pessoas: 5, acordoDasPessoasAMais: true }, CTX, AGORA);
    if (!r.ok) throw new Error(r.erro);
    const c = camposDaFolha(r.folha, CTX);
    expect(c.pessoas).toBe(3);
    expect(c.pessoasDaFolha).toBe(5);
    expect(c.acordoDasPessoasAMais).toBe(true);
    expect(c.pessoasMaximas).toBe(8);
    expect(c.horaDaEquipaDe3Cent).toBe(6200);
    const ras = lerRascunhoDaFolha({ pessoas: 6 }, AGORA);
    expect(ras.pessoas).toBe(3);
    expect(ras.pessoasDaFolha).toBe(6);
    expect(rascunhoDeJson(JSON.stringify(ras))?.pessoasDaFolha).toBe(6);
  });
});

describe("onde não muda e onde aparece", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  it("o simulador e a lista de parceiros continuam com 2 ou 3", () => {
    expect(ler("src/app/simulador/components/ParceirosDaMudanca.tsx")).not.toMatch(/PESSOAS_DA_FOLHA|PRECO_POR_PESSOA_A_MAIS/);
    expect(ler("src/lib/lista-de-parceiros-da-mudanca.ts")).toContain("export type Pessoas = 2 | 3;");
  });
  it("a caixa do acordo nas três folhas do site", () => {
    for (const f of ["src/components/admin/FolhaFinalDaMudanca.tsx", "src/components/admin/HorasNaMesa.tsx", "src/app/profissionais/painel/FolhaDaMudanca.tsx"]) {
      const t = ler(f);
      expect(t, f).toContain("CAIXA_DO_ACORDO_DAS_PESSOAS_A_MAIS");
      expect(t, f).toContain("acordoDasPessoasAMais");
    }
  });
});
