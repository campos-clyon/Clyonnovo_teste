import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { doNossoLado, TITULOS_DO_NOSSO_LADO } from "./do-nosso-lado";
import { COLUNAS_DA_FOLHA_D7, csvDaFolhaD7, folhaD7, linhaDaFolhaD7, type PedidoParaAFolhaD7 } from "./folha-d7-mudancas";
import {
  HORAS_ATE_O_SELO_DA_MUDANCA,
  mudancaAHoraSemValor,
  textoModeloDoValorDaMudanca,
  type PedidoDeMudancaParaOSelo,
} from "./mudanca-a-hora-sem-valor";

const ler = (c: string) => readFileSync(c, "utf8").replace(/\r\n/g, "\n");

// A base escreve em UTC, sem fuso: 10:00 é 10:00 UTC (a mesma hora em Lisboa no Inverno, mais 1 h no Verão).
const ENTROU = "2026-11-27 10:00:00";
const entrouMais = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 27, 10 + h, m, 0));

const mudanca = (o: Partial<PedidoDeMudancaParaOSelo> = {}): PedidoDeMudancaParaOSelo => ({
  id: 701,
  serviceType: "mudanca",
  baseDoPreco: "hora",
  status: "novo",
  propostaEnviadaEm: null,
  createdAt: ENTROU,
  ...o,
});

describe("d14: a mudança à hora sem valor enviado tem selo às 3 h", () => {
  it("a regra das 3 h: às 2 h 59 ainda não, às 3 h 00 sim", () => {
    expect(HORAS_ATE_O_SELO_DA_MUDANCA).toBe(3);
    expect(mudancaAHoraSemValor(mudanca(), entrouMais(2, 59))).toBeNull();
    const r = mudancaAHoraSemValor(mudanca(), entrouMais(3, 0));
    expect(r?.pedidoId).toBe(701);
    expect(r?.esperaS).toBe(3 * 3600);
    expect(mudancaAHoraSemValor(mudanca(), entrouMais(30))?.esperaS).toBe(30 * 3600);
  });

  it("a hora da base é UTC: a mesma conta num ISO com fuso dá o mesmo", () => {
    expect(mudancaAHoraSemValor(mudanca({ createdAt: "2026-11-27T10:00:00.000Z" }), entrouMais(3))?.esperaS).toBe(3 * 3600);
    expect(mudancaAHoraSemValor(mudanca({ createdAt: new Date(Date.UTC(2026, 10, 27, 10)) }), entrouMais(3))?.esperaS).toBe(3 * 3600);
  });

  it("com o valor já enviado, não", () => {
    expect(mudancaAHoraSemValor(mudanca({ propostaEnviadaEm: "2026-11-27 12:00:00" }), entrouMais(5))).toBeNull();
    expect(mudancaAHoraSemValor(mudanca({ propostaEnviadaEm: new Date() }), entrouMais(5))).toBeNull();
  });

  it("só mudanças à hora e só pedidos vivos", () => {
    expect(mudancaAHoraSemValor(mudanca({ serviceType: "recolha" }), entrouMais(5))).toBeNull();
    expect(mudancaAHoraSemValor(mudanca({ baseDoPreco: "total" }), entrouMais(5))).toBeNull();
    for (const status of ["cancelado", "arquivado", "rejeitado", "concluido"]) {
      expect(mudancaAHoraSemValor(mudanca({ status }), entrouMais(5))).toBeNull();
    }
    expect(mudancaAHoraSemValor(mudanca({ createdAt: null }), entrouMais(5))).toBeNull();
  });

  it("o selo vai para o cartão «Do nosso lado» da Mesa, com o texto-modelo e sem repetir pedidos", () => {
    const grupos = doNossoLado({
      conversas: null,
      pedidos: [],
      trabalhosClyon: [],
      mudancasSemValor: [
        { pedidoId: 701, desde: "2026-11-27T10:00:00.000Z" },
        { pedidoId: 701, desde: "2026-11-27T10:00:00.000Z" },
        { pedidoId: 702, desde: "2026-11-26T09:00:00.000Z" },
      ],
      agora: entrouMais(4),
    });
    const g = grupos.find((x) => x.tipo === "mudanca_sem_valor");
    expect(g?.titulo).toBe(TITULOS_DO_NOSSO_LADO.mudanca_sem_valor);
    expect(g?.linhas.map((l) => l.pedidoId)).toEqual([702, 701]); // quem espera há mais tempo primeiro
    expect(g?.linhas[1].esperaS).toBe(4 * 3600);
    expect(g?.linhas[0].modelo).toContain("#702");
    // Sem a lista, o grupo existe e fica a zero (não aparece no cartão).
    expect(doNossoLado({ conversas: null, pedidos: [], trabalhosClyon: [], agora: entrouMais(4) }).find((x) => x.tipo === "mudanca_sem_valor")?.linhas).toEqual([]);
  });

  it("o texto-modelo fala como pessoa: parceiro da zona (sem «verificado» sem prova), IVA ao lado, sem promessas proibidas", () => {
    const t = textoModeloDoValorDaMudanca(701);
    expect(t).toContain("#701");
    expect(t).toContain("[nome]");
    expect(t).toContain("parceiro da zona");
    expect(t).not.toMatch(/verificad/i);
    expect(t).toMatch(/\+ IVA por hora \(.* € com IVA\)/);
    expect(t).not.toMatch(/próprio dia|contentor|big ?bag|carregamos|levamos/i);
  });

  it("a rota e o cartão estão ligados, e o preço não se decide aqui", () => {
    const rota = ler("src/app/api/admin/negociacoes/mudanca-sem-valor/route.ts");
    expect(rota).toContain("requireAdmin");
    expect(rota).toContain("mudancasAHoraSemValorNaMesa");
    const cartao = ler("src/components/admin/DoNossoLado.tsx");
    expect(cartao).toContain("/api/admin/negociacoes/mudanca-sem-valor");
    expect(cartao).toContain("mudancasSemValor");
    expect(cartao).toContain("l.modelo");
    const regra = ler("src/lib/mudanca-a-hora-sem-valor.ts");
    expect(regra).toContain('from "./tabela-das-mudancas"');
    expect(regra).not.toMatch(/\b(45|50|55)\b\s*€/);
    // Nada sai sozinho para o cliente: nenhum envio nos ficheiros novos.
    for (const f of ["src/lib/mudanca-a-hora-sem-valor.ts", "src/lib/mudanca-a-hora-sem-valor-na-base.ts", "src/lib/folha-d7-mudancas.ts", "src/lib/folha-d7-mudancas-na-base.ts"]) {
      expect(ler(f)).not.toMatch(/enviarWhatsApp|sendMail|enviarEmail|enviarMensagem|fetch\(/);
    }
  });
});

describe("d14: o motivo grava-se nos pedidos que fecham calados", () => {
  it("os três fechos calados gravam «sem resposta»", () => {
    expect(ler("src/lib/arquivar-sem-resposta.ts")).toContain('gravarMotivoDoFecho(p.id, "sem_resposta"');
    expect(ler("src/lib/seguimento-do-cliente-na-base.ts")).toContain('gravarMotivoDoFecho(p.id, "sem_resposta"');
    expect(ler("src/lib/validade-do-orcamento-na-base.ts")).toContain('gravarMotivoDoFecho(pedidoId, "sem_resposta"');
  });

  it("o cancelamento pedido pelo cliente grava o motivo; o do «porquê» (d126) já o grava", () => {
    expect(ler("src/lib/agir-como-cliente.ts")).toContain('motivoDoFechoDoTexto(motivo) ?? "ja_nao_precisa"');
    expect(ler("src/lib/cancelar-pelo-lembrete.ts")).toContain('gravarMotivoDoFecho(pedidoId, "ja_nao_precisa"');
    expect(ler("src/lib/porque-cancelou-na-base.ts")).toContain("gravarMotivoDoFecho");
  });
});

describe("d14: a folha da medição de 30 dias da d7 (uma linha por n.º de pedido de mudança)", () => {
  const base: PedidoParaAFolhaD7 = {
    id: 701,
    createdAt: ENTROU,
    baseDoPreco: "hora",
    status: "novo",
    horasPrevistas: 4,
    valorUnicoCliente: null,
    precoAceiteEm: null,
    motivoDoFecho: null,
    quantoQueriaPagar: null,
    negociacoes: [],
  };

  it("as colunas são desde, referência, valor proposto, aceite, motivo (e o n.º e a base)", () => {
    expect([...COLUNAS_DA_FOLHA_D7]).toEqual(["pedido", "desde", "base", "referencia", "valorProposto", "aceite", "motivo"]);
  });

  it("um pedido aberto, sem valor: em curso, sem motivo; «desde» na hora de Lisboa", () => {
    const l = linhaDaFolhaD7(base);
    expect(l).toMatchObject({ pedidoId: 701, base: "hora", valorProposto: null, aceite: "em_curso", motivo: "" });
    expect(l.desde).toBe("27/11/2026 · 10:00");
    expect(linhaDaFolhaD7({ ...base, createdAt: "2026-07-01 10:00:00" }).desde).toBe("01/07/2026 · 11:00");
    expect(l.referencia).toBeGreaterThan(0);
  });

  it("o valor proposto é o valor único, ou o último de um parceiro; o aceite lê a negociação", () => {
    expect(linhaDaFolhaD7({ ...base, valorUnicoCliente: "240.00" }).valorProposto).toBe(240);
    const propostas = JSON.stringify([
      { por: "profissional", valor: 48, criadaEm: "2026-11-27T11:00:00Z" },
      { por: "cliente", valor: 40, criadaEm: "2026-11-27T12:00:00Z" },
      { por: "profissional", valor: 45, criadaEm: "2026-11-27T13:00:00Z" },
    ]);
    const l = linhaDaFolhaD7({ ...base, negociacoes: [{ estado: "aguarda_contratacao", propostasJson: propostas, valorAcordado: null }] });
    expect(l.valorProposto).toBe(45);
    expect(l.aceite).toBe("sim");
  });

  it("fechado: aceite «nao» e o motivo em palavras, com o que queria pagar", () => {
    const l = linhaDaFolhaD7({ ...base, status: "arquivado", motivoDoFecho: "preco", quantoQueriaPagar: "150.00" });
    expect(l.aceite).toBe("nao");
    expect(l.motivo).toBe("Preço (queria pagar 150 €)");
    expect(linhaDaFolhaD7({ ...base, status: "arquivado", motivoDoFecho: "sem_resposta" }).motivo).toBe("Sem resposta do cliente");
    expect(linhaDaFolhaD7({ ...base, status: "cancelado" }).motivo).toBe("sem motivo gravado");
  });

  it("a folha vem do mais recente para o mais antigo, e o CSV tem o cabeçalho e uma linha por pedido", () => {
    const f = folhaD7([base, { ...base, id: 705, status: "arquivado", motivoDoFecho: "ja_nao_precisa" }]);
    expect(f.map((l) => l.pedidoId)).toEqual([705, 701]);
    const csv = csvDaFolhaD7(f).split("\n");
    expect(csv[0]).toBe("pedido;desde;base;referencia;valorProposto;aceite;motivo");
    expect(csv).toHaveLength(3);
    expect(csv[1].startsWith("705;")).toBe(true);
  });

  it("a folha lê-se em /api/admin/mudancas/folha-d7, só para a equipa e sem dados de pessoas", () => {
    const rota = ler("src/app/api/admin/mudancas/folha-d7/route.ts");
    expect(rota).toContain("requireAdmin");
    expect(rota).toContain("formato");
    const base = ler("src/lib/folha-d7-mudancas-na-base.ts");
    expect(base).not.toMatch(/contactName|contactPhone|contactEmail|address/);
  });
});
