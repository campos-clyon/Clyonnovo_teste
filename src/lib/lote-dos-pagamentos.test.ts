import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  adiantados,
  aplicaSe,
  foiFeito,
  jaPagoEPagouEmMao,
  maisRecentesPrimeiro,
  oQueFazAoTrabalho,
  valorNoLote,
  ROTA_DO_PAGO,
  ROTA_DO_RECEBIDO,
  type TrabalhoDoLote,
} from "./lote-dos-pagamentos";

/**
 * APROVAR E DAR POR PAGO VÁRIOS DE UMA VEZ, nos Pagamentos — 08-10-2026.
 *
 * *«Quando marcar todos deve ter mais opções: eu devo poder aprovar todos e
 * fechar esses pedidos como já pagámos, sem ter que ir 1 a 1.»* E *«coloque em
 * ordem esses trabalhos»*.
 *
 * O que importa é A QUEM cada acção se aplica: um lote que registasse o
 * pagamento de um trabalho já recebido, ou que «pagasse» a quem recebeu em
 * mão, mexia em dinheiro que já está certo.
 */

const t = (extra: Partial<TrabalhoDoLote> = {}): TrabalhoDoLote => ({
  negociacaoId: 1,
  pedidoId: 100,
  clientePaga: 307.5,
  profissionalRecebe: 250,
  formaDePagamento: null,
  clientePagouEm: null,
  comoEntrou: null,
  confirmadoEm: null,
  pagoEm: null,
  dividaDoProfissional: null,
  declarado: null,
  ...extra,
});

describe("confirmar o declarado", () => {
  it("usa o método que ficou dito ao dar o trabalho por feito", () => {
    expect(oQueFazAoTrabalho(t({ declarado: { como: "ao_profissional" } }), { tipo: "declarado" })).toEqual({
      url: ROTA_DO_RECEBIDO,
      corpo: { negociacaoId: 1, metodo: "ao_profissional" },
    });
    expect(oQueFazAoTrabalho(t({ declarado: { como: "transferencia" } }), { tipo: "declarado" })?.corpo).toEqual({
      negociacaoId: 1,
      metodo: "transferencia",
    });
  });

  it("não toca em quem não declarou, nem em quem disse «ainda não pagou»", () => {
    expect(aplicaSe(t(), { tipo: "declarado" })).toBe(false);
    expect(aplicaSe(t({ declarado: { como: "ainda_nao" } }), { tipo: "declarado" })).toBe(false);
  });

  it("não toca no que já está recebido", () => {
    const recebido = t({ declarado: { como: "transferencia" }, clientePagouEm: "2026-10-01T10:00:00Z" });
    expect(aplicaSe(recebido, { tipo: "declarado" })).toBe(false);
  });

  it("em dinheiro com IVA incluído quem deve é o profissional: a declaração não é a pergunta", () => {
    const divida = t({
      formaDePagamento: "dinheiro",
      confirmadoEm: "2026-10-01T10:00:00Z",
      dividaDoProfissional: 80,
      declarado: { como: "ao_profissional" },
    });
    expect(aplicaSe(divida, { tipo: "declarado" })).toBe(false);
  });
});

describe("já recebemos, com um método para todos", () => {
  it("aplica-se a quem está por receber, com o método escolhido — mesmo a quem declarou outro", () => {
    expect(oQueFazAoTrabalho(t(), { tipo: "recebido", metodo: "numerario" })).toEqual({
      url: ROTA_DO_RECEBIDO,
      corpo: { negociacaoId: 1, metodo: "numerario" },
    });
    expect(
      oQueFazAoTrabalho(t({ declarado: { como: "transferencia" } }), { tipo: "recebido", metodo: "numerario" })?.corpo,
    ).toEqual({ negociacaoId: 1, metodo: "numerario" });
  });

  it("nunca regista duas vezes o que já entrou, nem o que foi pago em mão", () => {
    expect(aplicaSe(t({ clientePagouEm: "2026-10-01T10:00:00Z" }), { tipo: "recebido", metodo: "transferencia" })).toBe(false);
    expect(aplicaSe(t({ comoEntrou: "ao_profissional", clientePagouEm: "2026-10-01T10:00:00Z" }), { tipo: "recebido", metodo: "transferencia" })).toBe(false);
  });

  it("a dívida do profissional entra por transferência ou numerário — nunca «ao profissional»", () => {
    const divida = t({ formaDePagamento: "dinheiro", confirmadoEm: "2026-10-01T10:00:00Z", dividaDoProfissional: 80 });
    expect(aplicaSe(divida, { tipo: "recebido", metodo: "transferencia" })).toBe(true);
    expect(aplicaSe(divida, { tipo: "recebido", metodo: "ao_profissional" })).toBe(false);
    expect(valorNoLote(divida, { tipo: "recebido", metodo: "transferencia" })).toBe(80);
  });
});

describe("o profissional pago duas vezes", () => {
  it("avisa quando se diz que o cliente lhe pagou em mão e a CLYON já lhe tinha transferido", () => {
    const jaPago = t({ pagoEm: "2026-10-08T10:00:00Z", declarado: { como: "ao_profissional" } });
    expect(jaPagoEPagouEmMao(jaPago, { tipo: "declarado" })).toBe(true);
    expect(jaPagoEPagouEmMao(jaPago, { tipo: "recebido", metodo: "ao_profissional" })).toBe(true);
    expect(jaPagoEPagouEmMao(jaPago, { tipo: "recebido", metodo: "transferencia" })).toBe(false);
    expect(jaPagoEPagouEmMao(t({ declarado: { como: "ao_profissional" } }), { tipo: "declarado" })).toBe(false);
  });

  it("e a pergunta antes do lote di-lo", () => {
    const P = readFileSync(join(process.cwd(), "src/components/admin/AdminPagamentosPanel.tsx"), "utf8");
    expect(P).toContain("const emDobro = lista.filter(({ t }) => jaPagoEPagouEmMao(t, accao))");
    expect(P).toContain("ele pode ter recebido duas vezes.");
  });
});

describe("já pagámos aos profissionais", () => {
  it("aplica-se a quem está por pagar, pela rota do pago", () => {
    expect(oQueFazAoTrabalho(t(), { tipo: "pago" })).toEqual({ url: ROTA_DO_PAGO, corpo: { negociacaoId: 1 } });
    expect(valorNoLote(t(), { tipo: "pago" })).toBe(250);
  });

  it("não paga outra vez, nem a quem recebeu em mão", () => {
    expect(aplicaSe(t({ pagoEm: "2026-10-08T10:00:00Z" }), { tipo: "pago" })).toBe(false);
    expect(aplicaSe(t({ formaDePagamento: "dinheiro" }), { tipo: "pago" })).toBe(false);
    expect(aplicaSe(t({ comoEntrou: "ao_profissional" }), { tipo: "pago" })).toBe(false);
  });

  it("conta os que não estavam prontos, que ficam como adiantados", () => {
    const pronto = t({ negociacaoId: 2, clientePagouEm: "2026-10-01T10:00:00Z", confirmadoEm: "2026-10-02T10:00:00Z" });
    const semCliente = t({ negociacaoId: 3 });
    const jaPago = t({ negociacaoId: 4, pagoEm: "2026-10-08T10:00:00Z" });
    expect(adiantados([pronto, semCliente, jaPago])).toBe(1);
  });
});

describe("feito ou ainda por fazer", () => {
  it("feito é ter a prova do profissional, ou estar confirmado", () => {
    expect(foiFeito({ feitoEm: null, confirmadoEm: null })).toBe(false);
    expect(foiFeito({ feitoEm: "2026-10-03T10:00:00Z", confirmadoEm: null })).toBe(true);
    expect(foiFeito({ feitoEm: null, confirmadoEm: "2026-10-03T10:00:00Z" })).toBe(true);
  });
});

describe("a ordem das listas", () => {
  const linha = (pedidoId: number, dia: string | null) => ({ pedidoId, dia });

  it("do mais recente para trás; os sem data no fim; no mesmo dia, o número mais alto primeiro", () => {
    const lista = [
      linha(403, "2026-10-03T10:00:00Z"),
      linha(417, "2026-10-09T09:00:00Z"),
      linha(386, "2026-10-01T10:00:00Z"),
      linha(500, null),
      linha(344, "2026-09-26T10:00:00Z"),
      linha(372, "2026-09-26T10:00:00Z"),
    ];
    expect(maisRecentesPrimeiro(lista, (l) => l.dia).map((l) => l.pedidoId)).toEqual([417, 403, 386, 372, 344, 500]);
  });

  it("não mexe na lista que recebe", () => {
    const lista = [linha(1, "2026-09-01T00:00:00Z"), linha(2, "2026-10-01T00:00:00Z")];
    maisRecentesPrimeiro(lista, (l) => l.dia);
    expect(lista.map((l) => l.pedidoId)).toEqual([1, 2]);
  });
});

describe("o ecrã", () => {
  const PAINEL = readFileSync(join(process.cwd(), "src/components/admin/AdminPagamentosPanel.tsx"), "utf8").replace(
    /\r\n/g,
    "\n",
  );

  it("as listas saem por ordem, e partidas em feitos e ainda por fazer", () => {
    expect(PAINEL).toContain("const emOrdem = maisRecentesPrimeiro(actual.linhas, quandoNaLista(separador));");
    expect(PAINEL).toContain("const feitos = emOrdem.filter(foiFeito);");
    expect(PAINEL).toContain("const porFazer = emOrdem.filter((t) => !foiFeito(t));");
    expect(PAINEL).toContain('{ titulo: "Prontos a pagar", linhas: feitos.filter(prontoAPagar) },');
    expect(PAINEL).toContain('{ titulo: "Feitos", linhas: feitos },');
    expect((PAINEL.match(/\{ titulo: "Ainda por fazer", linhas: porFazer \}/g) ?? []).length).toBe(2);
  });

  it("cada grupo marca-se inteiro, para aprovar os feitos de uma vez", () => {
    expect(PAINEL).toContain("onChange={(e) => marcar(g.linhas.map((t) => t.negociacaoId), e.target.checked)}");
  });

  it("a barra dos marcados tem as três acções, cada uma só para os que se aplicam", () => {
    expect(PAINEL).toContain('onClick={() => void correrLote({ tipo: "declarado" })}');
    expect(PAINEL).toContain('onClick={() => void correrLote({ tipo: "pago" })}');
    expect(PAINEL).toMatch(/void correrLote\(\{\n\s+tipo: "recebido",/);
    expect(PAINEL).toContain("const o = oQueFazAoTrabalho(t, accao);");
  });

  it("pergunta antes, um de cada vez, e os recusados ficam marcados", () => {
    expect(PAINEL).toContain("if (!window.confirm(pergunta)) return;");
    expect(PAINEL).toContain("for (let i = 0; i < lista.length; i++) {");
    expect(PAINEL).toContain("marcar(feitos, false);");
  });

  it("só para quem mexe no dinheiro (o servidor recusa na mesma ao assistente)", () => {
    const barra = PAINEL.indexOf("{mexeNoDinheiro && (marcadosAqui.length > 0 || resultadoDoLote) && (");
    expect(barra).toBeGreaterThan(-1);
    expect(barra).toBeLessThan(PAINEL.indexOf('onClick={() => void correrLote({ tipo: "declarado" })}'));
  });
});
