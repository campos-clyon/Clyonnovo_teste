import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { carteiraDe, type TrabalhoNaCarteira } from "./carteira";
import { contaDaCarteira, RAZOES, type LevantamentoComData, type TrabalhoParaALista } from "./trabalhos-da-carteira";
import { decidirComAsRegrasNovas, type PedidoParaRetencao } from "./regras-novas-da-retencao";
import { MESES_MINIMOS_DO_HISTORICO_DO_PROFISSIONAL } from "./retencao";

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const NOVO = "2026-10-05T10:00:00Z";
const agora = new Date("2026-10-30T12:00:00Z");

function t(id: number, valor: number, extra: Partial<TrabalhoNaCarteira> = {}): TrabalhoParaALista {
  return {
    negociacaoId: id,
    pedidoId: 400 + id,
    servico: "Recolha de móveis",
    cliente: "Maria",
    estado: "acordada",
    valorAcordado: valor,
    taxaProfissional: 0.1,
    taxaCliente: 0,
    execucaoEnviadaEm: `2026-10-${String(id).padStart(2, "0")}T10:00:00Z`,
    confirmadoEm: `2026-10-${String(id).padStart(2, "0")}T12:00:00Z`,
    pagoEm: null,
    clientePagouEm: `2026-10-${String(id).padStart(2, "0")}T11:00:00Z`,
    negociacaoCriadaEm: NOVO,
    ...extra,
  } as TrabalhoParaALista;
}

describe("a carteira trabalho a trabalho dá os mesmos números de carteiraDe", () => {
  const trabalhos = [
    t(10, 100), // 90 — pago pela transferência #1
    t(11, 200), // 180 — metade paga por #1, o resto a caminho
    t(12, 300), // 270 — pode pedir
    t(13, 150, { pagoEm: "2026-10-20T10:00:00Z" }), // 135 pago um a um
    t(14, 100, { confirmadoEm: null, execucaoEnviadaEm: "2026-10-29T10:00:00Z", provaJson: null }), // à espera
    t(15, 100, { clientePagouEm: null }), // o cliente não pagou
  ];
  const levs: LevantamentoComData[] = [
    { id: 1, valor: 180, estado: "pago", processadoEm: "2026-10-18T09:00:00Z" },
    { id: 2, valor: 90, estado: "pedido", criadoEm: "2026-10-29T09:00:00Z" },
  ];
  const { linhas, resumo } = contaDaCarteira(trabalhos, levs, agora);
  const k = carteiraDe(trabalhos, levs, agora);

  it("«Por receber» = o que falta nos trabalhos = disponível + a caminho", () => {
    const falta = linhas.filter((l) => l.grupo === "por_receber").reduce((s, l) => s + l.falta, 0);
    expect(Math.round(falta * 100) / 100).toBe(Math.round((k.disponivel + k.aCaminho) * 100) / 100);
    expect(resumo.porReceber).toBe(Math.round((k.disponivel + k.aCaminho) * 100) / 100);
    expect(resumo.podePedir).toBe(k.disponivel);
    expect(resumo.aEsperaDaConfirmacao).toBe(k.cativo);
    expect(resumo.clienteAindaNaoPagou).toBe(k.porCobrar);
    expect(resumo.recebidoTotal).toBe(k.levantado);
  });

  it("cada trabalho no seu sítio, com a razão em palavras", () => {
    const de = (id: number) => linhas.find((l) => l.negociacaoId === id)!;
    expect(de(10)).toMatchObject({ grupo: "recebido", recebidoEmTexto: "18/10/2026", como: "transferência #1" });
    expect(de(11).grupo).toBe("por_receber");
    expect(de(11).falta).toBe(90);
    expect(de(11).razao).toContain(RAZOES.aCaminho);
    expect(de(12)).toMatchObject({ grupo: "por_receber", falta: 270, razao: RAZOES.podePedir });
    expect(de(13)).toMatchObject({ grupo: "recebido", recebidoEmTexto: "20/10/2026" });
    expect(de(14)).toMatchObject({ grupo: "retido", razao: RAZOES.confirmacao });
    expect(de(15)).toMatchObject({ grupo: "retido", razao: RAZOES.clienteNaoPagou });
    expect(de(12)).toMatchObject({ valor: 300, taxa: 30, recebe: 270, cliente: "Maria", pedidoId: 412 });
  });

  it("do n.º do pedido maior para o menor", () => {
    const n = linhas.map((l) => l.pedidoId ?? 0);
    expect(n).toEqual([...n].sort((a, b) => b - a));
  });

  it("recebido este mês e nos últimos 12 meses, em Lisboa", () => {
    expect(resumo.recebidoEsteMes).toBe(180 + 135);
    expect(resumo.recebidoUltimos12Meses).toBe(180 + 135);
  });
});

describe("o histórico do dinheiro do profissional fica pelo menos 12 meses", () => {
  it("o mínimo está escrito num sítio só", () => {
    expect(MESES_MINIMOS_DO_HISTORICO_DO_PROFISSIONAL).toBeGreaterThanOrEqual(12);
  });

  it("um pedido com trabalho feito e pago nunca se apaga com as regras novas — nem com 400 dias", () => {
    const p = {
      id: 1,
      status: "concluido",
      anonimizado: false,
      dataMarcadaPassou: true,
      diasParado: 400,
      temPreco: true,
      negociacoes: [
        {
          estado: "acordada",
          valorAcordado: 200,
          execucaoEnviadaEm: "2025-09-01",
          confirmadoEm: "2025-09-02",
          pagoEm: "2025-09-05",
          formaDePagamento: null,
          clientePagouEm: "2025-09-01",
          comoEntrou: "pagamento",
          pagamentosRecebidos: 1,
          negociacaoCriadaEm: NOVO,
          id: 9,
          ofertaClyon: null,
          referenciasVivas: 0,
          pagamentosDevolvidos: 0,
        },
      ],
    } as unknown as PedidoParaRetencao;
    expect(decidirComAsRegrasNovas(p).faz).not.toBe("apagar");
  });

  it("a purga de hoje nunca leva um pedido com valor, trabalho ou pagamento", () => {
    const db = ler("src/lib/db.ts");
    const i = db.indexOf("export async function purgarPedidosTerminados(");
    const corpo = db.slice(i, db.indexOf("\nexport ", i + 1));
    for (const guarda of ["g.valorAcordado IS NOT NULL", "g.execucaoEnviadaEm IS NOT NULL", "g.confirmadoEm IS NOT NULL", "g.pagoEm IS NOT NULL"]) {
      expect(corpo).toContain(guarda);
    }
  });

  it("e a carteira só mostra o primeiro nome do cliente — o que a anonimização guarda", () => {
    const rota = ler("src/app/api/profissionais/carteira/route.ts");
    expect(rota).toContain("paraALista(trabalhos, linhas)");
    expect(ler("src/lib/conta-da-carteira-na-base.ts")).toContain("cliente: primeiroNome(l?.contactName ?? null)");
    // E o backoffice lê pela mesma porta.
    expect(ler("src/app/api/admin/carteiras/route.ts")).toContain("contaDaCarteiraDoProfissional(");
  });
});
