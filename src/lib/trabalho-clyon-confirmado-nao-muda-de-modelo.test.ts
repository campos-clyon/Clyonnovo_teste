import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TRABALHOS_CLYON_ANTIGOS_AO_PARCEIRO_DESDE,
  eDoNovoModelo,
  trabalhoClyonDoModeloAntigo,
  trabalhoClyonDoNovoModelo,
} from "./novo-modelo";
import { contaDaCarteira, RAZOES } from "./trabalhos-da-carteira";
import type { TrabalhoNaCarteira } from "./carteira";
import { comORelogioEm } from "./relogio-dos-testes";

/*
 * CONFIRMAR NÃO MUDA O MODELO DE UM TRABALHO CLYON — 27-11-2026 (o #558).
 *
 * A d122 (25-11) passou ao modelo de 15-11 os Trabalhos CLYON de antes do corte
 * ainda por andar, e deixou «como foram» os já confirmados. Mas a regra lia a
 * confirmação a qualquer hora: um destes, confirmado DEPOIS da d122, voltava ao
 * antigo nesse instante — a carteira e a app Pro diziam «o cliente ainda não
 * pagou» (por receber, como se a CLYON lhe devesse) quando o cliente lhe tinha
 * pago a ele, e o backoffice punha-o «à espera do cliente». Agora só conta o
 * que já tinha andado quando a d122 entrou. Números inventados.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const AGORA = new Date("2026-11-27T18:00:00Z");
comORelogioEm(AGORA);

const ANTES_DO_CORTE = "2026-11-03 12:00:00";
const DEPOIS_DA_D122 = "2026-11-27 16:43:00";
const ANTES_DA_D122 = "2026-11-21 10:00:00";
const t = { ofertaClyon: "directa", pedidoCriadoEm: ANTES_DO_CORTE };

describe("o modelo de um Trabalho CLYON de antes do corte", () => {
  it("confirmado depois da d122, continua no modelo de 15-11 (paga ao parceiro)", () => {
    expect(trabalhoClyonDoModeloAntigo({ ...t, confirmadoEm: DEPOIS_DA_D122 }, AGORA)).toBe(false);
    expect(trabalhoClyonDoNovoModelo({ ...t, confirmadoEm: DEPOIS_DA_D122 }, AGORA)).toBe(true);
    expect(eDoNovoModelo({ ...t, fechadoEm: DEPOIS_DA_D122 }, AGORA)).toBe(true);
    // Também lido como Date, como a base o devolve.
    expect(trabalhoClyonDoModeloAntigo({ ...t, confirmadoEm: new Date("2026-11-27T16:43:00Z") }, AGORA)).toBe(false);
  });

  it("o mesmo, antes e depois de confirmado: o modelo não muda com a confirmação", () => {
    expect(trabalhoClyonDoModeloAntigo(t, AGORA)).toBe(trabalhoClyonDoModeloAntigo({ ...t, confirmadoEm: DEPOIS_DA_D122 }, AGORA));
  });

  it("o que já tinha andado antes da d122 fica como foi (confirmado, pago ao profissional, fechado)", () => {
    expect(trabalhoClyonDoModeloAntigo({ ...t, confirmadoEm: ANTES_DA_D122 }, AGORA)).toBe(true);
    expect(trabalhoClyonDoModeloAntigo({ ...t, pagoAoProfissionalEm: ANTES_DA_D122 }, AGORA)).toBe(true);
    expect(eDoNovoModelo({ ...t, fechadoEm: ANTES_DA_D122 }, AGORA)).toBe(false);
  });

  it("o pago à CLYON fica no antigo seja quando for (d58)", () => {
    expect(trabalhoClyonDoModeloAntigo({ ...t, clientePagouAClyonEm: DEPOIS_DA_D122, confirmadoEm: DEPOIS_DA_D122 }, AGORA)).toBe(true);
  });

  it("a data da d122 é a do commit (25-11-2026, 15h20 de Lisboa)", () => {
    expect(TRABALHOS_CLYON_ANTIGOS_AO_PARCEIRO_DESDE.toISOString()).toBe("2026-11-25T14:20:00.000Z");
  });
});

describe("na carteira dele, nunca «por receber»", () => {
  /** Como `trabalhosDaCarteira` o monta, já com a regra: modelo de 15-11, a CLYON não paga. */
  const doParceiro: TrabalhoNaCarteira = {
    negociacaoId: 7001,
    estado: "acordada",
    valorAcordado: 100,
    taxaCliente: 0,
    taxaProfissional: 0.1,
    formaDePagamento: null,
    execucaoEnviadaEm: "2026-11-27T16:14:00Z",
    confirmadoEm: "2026-11-27T16:43:00Z",
    pagoEm: null,
    negociacaoCriadaEm: "2026-11-03T12:30:00Z",
    trabalhoClyon: true,
    noNovoModelo: true,
    pagoPelaClyon: trabalhoClyonDoModeloAntigo({ ...t, confirmadoEm: DEPOIS_DA_D122 }, AGORA),
  } as TrabalhoNaCarteira;

  it("feito e confirmado: recebido em mão, nada por receber da CLYON", () => {
    const { linhas, resumo } = contaDaCarteira([doParceiro], [], AGORA);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].grupo).toBe("recebido");
    expect(linhas[0].razao).toBe(RAZOES.emMao);
    expect(linhas[0].razao).not.toBe(RAZOES.clienteNaoPagou);
    expect(resumo.porReceber).toBe(0);
  });

  it("confirmado e sem registo de a quem o cliente pagou: «por confirmar o pagamento», nunca «por receber»", () => {
    const semRegisto = { ...doParceiro, noNovoModelo: false, pagoPelaClyon: true, clientePagouEm: null } as TrabalhoNaCarteira;
    const { linhas, resumo } = contaDaCarteira([semRegisto], [], AGORA);
    expect(linhas[0]).toMatchObject({ grupo: "por_confirmar", razao: RAZOES.porConfirmar, falta: 0 });
    expect(resumo.porReceber).toBe(0);
    expect(resumo.podePedir).toBe(0);
    expect(resumo.porConfirmarOPagamento).toBe(90);
    // Por fazer, continua «o cliente ainda não pagou».
    const porFazer = contaDaCarteira([{ ...semRegisto, confirmadoEm: null, execucaoEnviadaEm: null }], [], AGORA);
    expect(porFazer.linhas[0]).toMatchObject({ grupo: "retido", razao: RAZOES.clienteNaoPagou });
  });

  it("o painel dá-lhe separador próprio e a Mesa pede «a quem o cliente pagou» em «Precisa de si»", () => {
    const painel = ler("src/app/profissionais/painel/Carteira.tsx");
    expect(painel).toContain('l.grupo === "por_receber" || l.grupo === "retido"');
    expect(painel).toContain('"Por confirmar"');
    expect(ler("src/app/api/admin/resumo/route.ts")).toContain("trabalhosSemAQuemPagou()");
    const mesa = ler("src/components/admin/PrecisaDeSiNaMesa.tsx");
    expect(mesa).toContain('titulo: "falta dizer a quem o cliente pagou"');
    expect(mesa).toContain('seccao: "pagamentos"');
    expect(ler("src/lib/sem-a-quem-pagou-na-base.ts")).toContain('l.grupo === "por_confirmar"');
  });

  it("todas as portas do dinheiro perguntam à mesma função (carteira, app Pro, backoffice, cartões)", () => {
    expect(ler("src/lib/carteira-do-profissional.ts")).toContain("pagoPelaClyon: trabalhoClyonDoModeloAntigo(");
    expect(ler("src/app/api/admin/carteiras/route.ts")).toContain("trabalhoClyonDoModeloAntigo(");
    expect(ler("src/app/api/admin/trabalhos-clyon/route.ts")).toContain("noNovoModelo: trabalhoClyonDoNovoModelo(");
    expect(ler("src/lib/novo-modelo.ts")).toContain("return andouAntesDaD122(n.confirmadoEm) || andouAntesDaD122(n.pagoAoProfissionalEm);");
  });
});
