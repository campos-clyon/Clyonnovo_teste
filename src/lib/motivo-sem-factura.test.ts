import { describe, it, expect } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerMotivoSemFactura, MOTIVO_SEM_FACTURA_MAXIMO, pagouSemFactura } from "./sem-factura";
import { fraseDoSemFacturaNoMes, semFacturaNoMes, type LinhaDoMes } from "./sem-factura-no-mes";
import { planoDeConfirmacao } from "./confirmar-varios";
import CampoDoMotivoSemFactura from "@/components/admin/CampoDoMotivoSemFactura";

/**
 * CADA PAGAMENTO «SEM FACTURA» COM O MOTIVO ESCRITO — 25-10-2026 (decisão d19).
 *
 * Onde se marca (o «Sem factura» dos Pagamentos) ou se declara (o «Para que
 * foi o pagamento?» ao confirmar nas Negociações, no cartão e em lote), o
 * motivo é obrigatório e fica com o pagamento. Os de antes ficam sem motivo e
 * lêem-se «sem motivo registado». Nos Pagamentos, uma linha diz quantos
 * pagamentos sem factura houve no mês e que parte do valor foram. As regras
 * do «sem factura» não mudam — só o registo do motivo.
 */

(globalThis as { React?: typeof React }).React = React;

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("o motivo", () => {
  it("sem motivo (ou só com espaços, ou curto de mais), não grava, e diz porquê", () => {
    for (const v of [undefined, null, "", "    ", "não", 7]) {
      const r = lerMotivoSemFactura(v);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro).toBe("Escreva o motivo de ser sem factura — sem ele, não se grava.");
    }
  });

  it("com o motivo, grava-o aparado e com tamanho limitado", () => {
    expect(lerMotivoSemFactura("  O cliente   não quis factura ")).toEqual({ ok: true, motivo: "O cliente não quis factura" });
    const longo = lerMotivoSemFactura("y".repeat(900));
    expect(longo.ok && longo.motivo.length).toBe(MOTIVO_SEM_FACTURA_MAXIMO);
  });
});

describe("quem pagou sem factura", () => {
  const ANTES_DO_IVA = "2026-09-20T10:00:00Z";
  const COM_IVA = "2026-10-05T10:00:00Z";

  it("a marca dos Pagamentos conta sempre", () => {
    expect(pagouSemFactura({ semFactura: 1 }, COM_IVA)).toBe(true);
    expect(pagouSemFactura({ semFactura: 1 }, ANTES_DO_IVA)).toBe(true);
  });

  it("declarado ao confirmar conta antes do IVA incluído; depois, o valor é sempre o total", () => {
    expect(pagouSemFactura({ semFactura: 0, pagamentoParaQue: "sem_factura" }, ANTES_DO_IVA)).toBe(true);
    expect(pagouSemFactura({ semFactura: 0, pagamentoParaQue: "sem_factura" }, COM_IVA)).toBe(false);
    expect(pagouSemFactura({ semFactura: 0, pagamentoParaQue: "com_factura" }, ANTES_DO_IVA)).toBe(false);
    expect(pagouSemFactura({ semFactura: 0, pagamentoParaQue: null }, ANTES_DO_IVA)).toBe(false);
  });
});

describe("a linha do mês nos Pagamentos", () => {
  const AGORA = new Date("2026-10-20T12:00:00Z");
  const linha = (extra: Partial<LinhaDoMes>): LinhaDoMes => ({
    valorAcordado: 100,
    conta: null,
    dataDoTrabalho: "2026-10-10T09:00:00Z",
    clientePagouEm: null,
    confirmadoEm: null,
    pagoEm: null,
    ...extra,
  });

  it("conta os do mês, sem as contas de teste, pelo valor sem IVA", () => {
    const r = semFacturaNoMes(
      [
        linha({ pagouSemFactura: true, motivoSemFactura: "Cliente não quis", conta: { semIva: 282 } }),
        linha({ pagouSemFactura: true, motivoSemFactura: null, valorAcordado: 118 }),
        linha({ conta: { semIva: 600 } }),
        // Do mês passado — fica de fora.
        linha({ pagouSemFactura: true, dataDoTrabalho: "2026-09-25T09:00:00Z" }),
        // O trabalho foi em Setembro, mas o cliente pagou em Outubro: conta em Outubro.
        linha({ dataDoTrabalho: "2026-09-28T09:00:00Z", clientePagouEm: "2026-10-02T09:00:00Z" }),
        // Conta de teste — fica de fora.
        linha({ contaDeTeste: true, pagouSemFactura: true }),
      ],
      AGORA,
    );
    expect(r).toMatchObject({ pagamentos: 4, semFactura: 2, semMotivo: 1, valor: 1100, valorSemFactura: 400 });
    expect(r.percentagem).toBeCloseTo(400 / 1100, 10);
    expect(fraseDoSemFacturaNoMes(r)).toBe(
      "Sem factura este mês: 2 de 4 pagamentos — 36,4 % do valor, sem IVA. 1 está sem motivo registado.",
    );
  });

  it("sem pagamentos no mês, diz isso em vez de um zero por cento", () => {
    const r = semFacturaNoMes([linha({ dataDoTrabalho: "2026-08-01T09:00:00Z" })], AGORA);
    expect(r.pagamentos).toBe(0);
    expect(r.percentagem).toBeNull();
    expect(fraseDoSemFacturaNoMes(r)).toBe("Sem factura este mês: ainda não há pagamentos no mês.");
  });

  it("todos com motivo: a frase não fala de motivos", () => {
    const r = semFacturaNoMes([linha({ pagouSemFactura: true, motivoSemFactura: "Pagou em numerário" })], AGORA);
    expect(fraseDoSemFacturaNoMes(r)).toBe("Sem factura este mês: 1 de 1 pagamento — 100 % do valor, sem IVA.");
  });
});

describe("confirmar vários: o motivo vai com cada um", () => {
  const p = { pedidoId: 300, negociacao: { id: 3000, criadaEm: "2026-09-20T10:00:00Z" }, podeConfirmar: true };

  it("sem factura, leva o motivo escrito", () => {
    const plano = planoDeConfirmacao([p], { paraQue: "sem_factura", como: "numerario", motivoSemFactura: "Pediu sem factura" });
    expect(plano.aConfirmar[0].corpo).toMatchObject({ paraQue: "sem_factura", motivoSemFactura: "Pediu sem factura" });
  });

  it("com factura, não leva motivo nenhum", () => {
    const plano = planoDeConfirmacao([p], { paraQue: "com_factura", como: "numerario", motivoSemFactura: "sobra" });
    expect(plano.aConfirmar[0].corpo).not.toHaveProperty("motivoSemFactura");
  });
});

describe("o campo do motivo", () => {
  const desenhar = (valor: string) =>
    renderToStaticMarkup(createElement(CampoDoMotivoSemFactura, { valor, onMudar: () => {} })).replace(/<!-- -->/g, "");

  it("vazio, diz que sem ele não se grava; escrito, deixa de o dizer", () => {
    expect(desenhar("")).toContain("Motivo de ser sem factura (obrigatório)");
    expect(desenhar("")).toContain("sem ele, não se grava");
    expect(desenhar("O cliente não quis factura")).not.toContain("sem ele, não se grava");
  });
});

describe("onde se marca ou se declara «sem factura», o motivo é obrigatório", () => {
  it("Pagamentos: a rota não grava «sem factura» sem o motivo, e guarda-o com a marca", () => {
    const ROTA = ler("src/app/api/admin/pagamentos/factura/route.ts");
    const le = ROTA.indexOf("lerMotivoSemFactura(corpo.motivo)");
    const grava = ROTA.indexOf("await mudarAFacturaDaNegociacao(negociacaoId, semFactura, motivo)");
    expect(le).toBeGreaterThan(-1);
    expect(grava).toBeGreaterThan(le);
    expect(ROTA).toContain("if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });");
    const DB = ler("src/lib/db.ts");
    const MUDA = DB.slice(DB.indexOf("export async function mudarAFacturaDaNegociacao("));
    expect(MUDA.slice(0, 5000)).toContain('"UPDATE negociacoes SET motivoSemFactura = ? WHERE id = ?"');
    expect(MUDA.slice(0, 5000)).toContain("semFactura ? motivoSemFactura : null,");
  });

  it("Negociações: confirmar «sem factura» sem o motivo é recusado, e o motivo vai no mesmo update", () => {
    const AGIR = ler("src/app/api/admin/negociacoes/agir/route.ts");
    const le = AGIR.indexOf("lerMotivoSemFactura(corpo.motivoSemFactura)");
    const grava = AGIR.indexOf("await confirmarExecucao(negociacaoId, pedidoId, {");
    expect(le).toBeGreaterThan(-1);
    expect(grava).toBeGreaterThan(le);
    expect(AGIR).toMatch(/if \(paraQue === "sem_factura"\) \{\s*const lido = lerMotivoSemFactura/);
    const DB = ler("src/lib/db.ts");
    const CONFIRMA = DB.slice(DB.indexOf("export async function confirmarExecucao("));
    expect(CONFIRMA.slice(0, 3000)).toMatch(/pagamentoDeclaradoEm = NOW\(\), pagamentoDeclaradoPor = \?,\s*motivoSemFactura = \?/);
  });

  it("a coluna nova é nula por omissão, e a versão das migrações subiu", () => {
    const DB = ler("src/lib/db.ts");
    expect(DB).toContain("`ALTER TABLE negociacoes ADD COLUMN motivoSemFactura VARCHAR(300) NULL DEFAULT NULL`,");
    expect(Number(DB.match(/const VERSAO_DAS_NEGOCIACOES = (\d+);/)?.[1])).toBeGreaterThanOrEqual(10);
  });

  it("os ecrãs pedem o motivo, mostram-no, e os de antes dizem que não têm", () => {
    const NEG = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(NEG.match(/<CampoDoMotivoSemFactura /g)?.length).toBe(2);
    expect(NEG).toContain("motivoSemFactura: motivoSemFacturaDosVarios,");
    expect(NEG).toContain('...(paraQue === "sem_factura" ? { motivoSemFactura } : {})');
    const PAG = ler("src/components/admin/AdminPagamentosPanel.tsx");
    expect(PAG).toContain("<CampoDoMotivoSemFactura ");
    expect(PAG).toContain("if (lido.ok) onFactura(true, lido.motivo);");
    expect(PAG).toContain("t.motivoSemFactura");
    expect(PAG).toContain('"sem motivo registado."');
    expect(PAG).toContain("fraseDoSemFacturaNoMes(semFacturaNoMes(trabalhos, agora))");
    const GERIR = ler("src/lib/trabalhos-para-gerir.ts");
    expect(GERIR).toContain("n.motivoSemFactura");
    expect(GERIR).toContain("pagouSemFactura: pagouSemFactura(l, l.negociacaoCriadaEm as Date | string | null),");
  });
});
