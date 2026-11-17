import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HORAS_SEM_VALOR, semValorHaMaisDe4h, seloDePorEnviar, semValorParaOInicio } from "./pedido-sem-valor";
import { lembreteDasPropostas, lembretesDasPropostas, mensagemDoLembrete } from "./propostas-sem-resposta";
import {
  MOTIVOS_DO_FECHO,
  exigirMotivoDoFecho,
  fechaOPedido,
  lerQuantoQueriaPagar,
  motivoDoFechoDoTexto,
  motivosPorServico,
  textoDoMotivo,
} from "./motivo-do-fecho";
import { MOTIVOS_DE_CANCELAMENTO } from "./cancelamento";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

/* ── d50: o selo «por enviar» passa a vermelho às 4 horas ─────────────────── */
describe("d50 — sem valor há mais de 4 h", () => {
  const agora = new Date("2026-11-16T14:00:00Z");

  it("a regra é de 4 horas", () => {
    expect(HORAS_SEM_VALOR).toBe(4);
  });

  it("às 3 h 59 ainda não; às 4 h sim (a base guarda em UTC, sem fuso)", () => {
    expect(semValorHaMaisDe4h({ id: 1, createdAt: "2026-11-16 10:01:00" }, agora)).toBe(false);
    expect(semValorHaMaisDe4h({ id: 1, createdAt: "2026-11-16 10:00:00" }, agora)).toBe(true);
    expect(semValorHaMaisDe4h({ id: 1, createdAt: new Date("2026-11-15T10:00:00Z") }, agora)).toBe(true);
  });

  it("com uma pergunta ao cliente por responder (precisa_info) não fica vermelho", () => {
    expect(semValorHaMaisDe4h({ id: 1, status: "precisa_info", createdAt: "2026-11-15 10:00:00" }, agora)).toBe(false);
  });

  it("sem data que se leia não se acusa", () => {
    expect(semValorHaMaisDe4h({ id: 1, createdAt: null }, agora)).toBe(false);
    expect(semValorHaMaisDe4h({ id: 1, createdAt: "lixo" }, agora)).toBe(false);
  });

  it("o selo diz «por enviar» e o tipo de serviço", () => {
    const selo = seloDePorEnviar({ id: 7, serviceType: "recolha_moveis", createdAt: "2026-11-16 09:00:00" }, agora);
    expect(selo.vermelho).toBe(true);
    expect(selo.texto.startsWith("por enviar · ")).toBe(true);
    expect(selo.texto.length).toBeGreaterThan("por enviar · ".length);
    expect(seloDePorEnviar({ id: 7, serviceType: "recolha_moveis", createdAt: "2026-11-16 13:00:00" }, agora).vermelho).toBe(false);
  });

  it("o Início: só os vermelhos, do maior n.º para o menor, com a hora de Lisboa", () => {
    const lista = semValorParaOInicio(
      [
        { id: 580, createdAt: "2026-11-16 09:00:00" },
        { id: 590, createdAt: "2026-11-16 12:00:00" }, // 2 h: fica de fora
        { id: 585, createdAt: "2026-11-16 08:30:00" },
        { id: 586, status: "precisa_info", createdAt: "2026-11-16 08:00:00" },
      ],
      agora,
    );
    expect(lista.map((p) => p.id)).toEqual([585, 580]);
    // 08:30 UTC em Novembro = 08:30 em Lisboa (sem hora de Verão).
    expect(lista[0].entrouEm).toBe("16/11/2026 · 08:30");
    expect(lista[0].horas).toBe(5);
  });

  it("o selo da Mesa e o contador do Início usam a mesma regra", () => {
    const mesa = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
    expect(mesa).toContain("seloDePorEnviar(p, agora)");
    const db = ler("src/lib/db.ts");
    expect(db).toContain("semValorParaOInicio(");
    const inicio = semComentarios(ler("src/components/admin/AdminInicioPanel.tsx"));
    expect(inicio).toContain("sem valor há mais de {HORAS_SEM_VALOR} h");
  });
});

/* ── d54: propostas há mais de 24 h sem resposta do cliente ───────────────── */
describe("d54 — a mensagem das propostas sem resposta", () => {
  const agora = new Date("2026-11-17T12:00:00Z");
  const proposta = (valor: number, criadaEm = "2026-11-16T09:00:00Z") =>
    JSON.stringify([{ por: "profissional", valor, criadaEm, estado: "pendente" }]);
  const neg = (id: number, valor: number, extra: Record<string, unknown> = {}) => ({
    id,
    estado: "aberta",
    profissionalNome: `Parceiro ${id}`,
    propostasJson: proposta(valor),
    taxaCliente: "0",
    taxaProfissional: "0.1000",
    criadaEm: "2026-11-16T08:00:00Z",
    noNovoModelo: true,
    regimeParaOTotal: "normal",
    verificado: true,
    ...extra,
  });
  const pedido = (extra: Record<string, unknown> = {}) => ({
    id: 583,
    status: "pendente",
    serviceType: "recolha_monos",
    baseDoPreco: "total",
    propostaEnviadaEm: null,
    valorUnicoCliente: null,
    negociacoes: [neg(1, 400), neg(2, 350)],
    ...extra,
  });

  it("às 24 h, duas propostas: a mais em conta, com e sem IVA", () => {
    const l = lembreteDasPropostas(pedido() as never, agora)!;
    expect(l.fase).toBe("24h");
    expect(l.quantas).toBe(2);
    expect(mensagemDoLembrete(l)).toBe(
      // Texto do Vendas desde 17-11-2026 (d66).
      "Olá! O seu pedido #583 já tem 2 propostas de parceiros verificados, desde 350 € + IVA = 430,50 €. " +
        "Quer que reservemos a mais em conta? Responda SIM, ou escolha no link do pedido que lhe enviámos. " +
        "Se nenhuma servir, diga-nos o que precisa e falamos com os parceiros.",
    );
  });

  it("a mais em conta é a de menor TOTAL: um isento de 360 passa à frente de um normal de 350", () => {
    const p = pedido({ negociacoes: [neg(1, 350), neg(2, 360, { regimeParaOTotal: "isento" })] });
    const l = lembreteDasPropostas(p as never, agora)!;
    expect(l.isento).toBe(true);
    // 360 € isento, com o IVA só na taxa (36 € × 23 % = 8,28 €): 368,28 € — abaixo dos 430,50 € do normal.
    expect(l.valorDoCliente).toBe("368,28 € (isento de IVA)");
    expect(mensagemDoLembrete(l)).toContain("desde 368,28 € (isento de IVA). ");
    expect(mensagemDoLembrete(l)).not.toContain("+ IVA");
  });

  it("uma proposta só, e por hora", () => {
    const p = pedido({ negociacoes: [neg(1, 50)], baseDoPreco: "hora", id: 589 });
    const l = lembreteDasPropostas(p as never, agora)!;
    expect(mensagemDoLembrete(l)).toBe(
      "Olá! O seu pedido #589 já tem uma proposta de um parceiro verificado: 50 € + IVA = 61,50 € por hora. " +
        "Quer que a reservemos? Responda SIM, ou veja-a no link do pedido que lhe enviámos. " +
        "Se o dia ou o valor não lhe servirem, diga-nos e falamos com o parceiro.",
    );
  });

  it("às 72 h, a pergunta final, sem link", () => {
    const p = pedido({ negociacoes: [neg(1, 350, { propostasJson: proposta(350, "2026-11-14T09:00:00Z") })] });
    const l = lembreteDasPropostas(p as never, agora)!;
    expect(l.fase).toBe("72h");
    const m = mensagemDoLembrete(l);
    expect(m).toBe(
      "Olá! A proposta do pedido #583 continua válida. Se ainda quiser avançar, responda SIM e reservamos a proposta. " +
        "Se o preço não serve, diga quanto queria pagar e passamos isso aos parceiros. Se já resolveu de outra forma, diga-nos e fechamos o pedido.",
    );
    expect(m).not.toContain("link");
  });

  it("antes das 24 h, nada; conta desde o envio do orçamento quando há", () => {
    expect(lembreteDasPropostas(pedido() as never, new Date("2026-11-17T08:00:00Z"))).toBeNull();
    expect(lembreteDasPropostas(pedido({ propostaEnviadaEm: "2026-11-17 06:00:00" }) as never, agora)).toBeNull();
  });

  it("ficam de fora: valor único enviado, fechados, contratados e o cliente que contrapropôs", () => {
    expect(lembreteDasPropostas(pedido({ valorUnicoCliente: "300.00" }) as never, agora)).toBeNull();
    expect(lembreteDasPropostas(pedido({ status: "cancelado" }) as never, agora)).toBeNull();
    expect(lembreteDasPropostas(pedido({ negociacoes: [neg(1, 350, { estado: "acordada" })] }) as never, agora)).toBeNull();
    const contra = JSON.stringify([
      { por: "profissional", valor: 400, criadaEm: "2026-11-16T09:00:00Z", estado: "recusada" },
      { por: "cliente", valor: 300, criadaEm: "2026-11-16T10:00:00Z", estado: "pendente" },
    ]);
    expect(lembreteDasPropostas(pedido({ negociacoes: [neg(1, 350), neg(2, 0, { propostasJson: contra })] }) as never, agora)).toBeNull();
  });

  it("«verificados» só quando todos os que propuseram o são", () => {
    const p = pedido({ negociacoes: [neg(1, 400), neg(2, 350, { verificado: false })] });
    const m = mensagemDoLembrete(lembreteDasPropostas(p as never, agora)!);
    expect(m.startsWith("Olá! O seu pedido #583 já tem 2 propostas de parceiros, desde 350 € + IVA = 430,50 €.")).toBe(true);
    const um = mensagemDoLembrete(lembreteDasPropostas(pedido({ negociacoes: [neg(1, 50, { verificado: false })] }) as never, agora)!);
    expect(um).toContain("O seu pedido #583 já tem uma proposta de um parceiro: ");
  });

  it("a lista vai pelo n.º do pedido, do maior para o menor", () => {
    const l = lembretesDasPropostas([pedido({ id: 583 }), pedido({ id: 589 })] as never, agora);
    expect(l.map((x) => x.pedidoId)).toEqual([589, 583]);
  });

  it("a mensagem não se envia sozinha: o Início só copia", () => {
    const c = semComentarios(ler("src/components/admin/PropostasSemResposta.tsx"));
    expect(c).toContain("navigator.clipboard.writeText(l.mensagem)");
    expect(c).not.toMatch(/enviar_pela_clyon|whatsapp\/enviar|wa\.me/);
    // Copiar nunca chama o reenviar (gera um link novo e mata o antigo), nem a rota do link.
    expect(c).not.toContain("negociacoes/reenviar");
    expect(c).not.toContain("paraCopiar");
    expect(c.slice(c.indexOf("async function copiar"), c.indexOf("if (!lista"))).not.toContain("fetch(");
  });
});

/* ── d54: cancelar ou arquivar pede um motivo ─────────────────────────────── */
describe("d54 — o motivo de cancelar ou arquivar", () => {
  it("são os seis motivos", () => {
    expect(MOTIVOS_DO_FECHO.map((m) => m.rotulo)).toEqual([
      "Sem resposta do cliente",
      "Preço",
      "Sem parceiro na zona ou na data",
      "Repetido",
      "Já não precisa",
      "Outro",
    ]);
  });

  it("sem motivo não deixa", () => {
    expect(exigirMotivoDoFecho({}).ok).toBe(false);
    expect(exigirMotivoDoFecho(null).ok).toBe(false);
    expect(exigirMotivoDoFecho({ motivoDoFecho: "porque sim" }).ok).toBe(false);
    expect(exigirMotivoDoFecho({ motivoDoFecho: "repetido" })).toEqual({ ok: true, motivo: "repetido", quantoQueriaPagar: null });
  });

  it("«quanto queria pagar» só com o preço, e opcional", () => {
    expect(exigirMotivoDoFecho({ motivoDoFecho: "preco", quantoQueriaPagar: "150,50" })).toEqual({
      ok: true,
      motivo: "preco",
      quantoQueriaPagar: 150.5,
    });
    expect(lerQuantoQueriaPagar("150", "repetido")).toBeNull();
    expect(lerQuantoQueriaPagar("", "preco")).toBeNull();
    expect(textoDoMotivo("preco", 150.5)).toBe("Motivo: Preço (queria pagar 150,5 €).");
  });

  it("só pede ao fechar um pedido aberto", () => {
    expect(fechaOPedido("pendente", "cancelado")).toBe(true);
    expect(fechaOPedido("aprovado", "arquivado")).toBe(true);
    expect(fechaOPedido("pendente", "rejeitado")).toBe(true);
    expect(fechaOPedido("cancelado", "cancelado")).toBe(false);
    expect(fechaOPedido("arquivado", "arquivado")).toBe(false);
    expect(fechaOPedido("rejeitado", "rejeitado")).toBe(false);
    // Passar de um fechado a outro é uma mudança de estado: pede.
    expect(fechaOPedido("cancelado", "arquivado")).toBe(true);
    expect(fechaOPedido("arquivado", "pendente")).toBe(false);
    expect(fechaOPedido("pendente", "concluido")).toBe(false);
  });

  it("cada motivo das janelas de cancelar cai numa categoria", () => {
    for (const m of MOTIVOS_DE_CANCELAMENTO) expect(motivoDoFechoDoTexto(m)).not.toBeNull();
    expect(motivoDoFechoDoTexto("O cliente achou o preço alto")).toBe("preco");
    expect(motivoDoFechoDoTexto("Pedido repetido")).toBe("repetido");
    expect(motivoDoFechoDoTexto("Não conseguimos falar com o cliente")).toBe("sem_resposta");
    expect(motivoDoFechoDoTexto("escrito à mão")).toBe("outro");
    expect(motivoDoFechoDoTexto("")).toBeNull();
  });

  it("a contagem da semana, por serviço", () => {
    expect(
      motivosPorServico([
        { serviceType: "recolha_moveis", motivo: "preco", n: 2 },
        { serviceType: "recolha_moveis", motivo: "sem_resposta", n: 1 },
        { serviceType: "mudanca", motivo: "repetido", n: 1 },
        { serviceType: "mudanca", motivo: "lixo", n: 9 },
      ]),
    ).toEqual([
      { servico: "recolha_moveis", total: 3, porMotivo: { preco: 2, sem_resposta: 1 } },
      { servico: "mudanca", total: 1, porMotivo: { repetido: 1 } },
    ]);
  });

  it("as páginas «Aprovado ✓» só pedem o motivo quando o estado muda para fechado", () => {
    for (const f of ["src/components/admin/PedidoDetailModal.tsx", "src/app/admin/pedidos/[id]/AdminPedidoDetalheClient.tsx"]) {
      const c = semComentarios(ler(f));
      expect(c, f).toMatch(/motivoSeFechar\(order\.status, editStatus\)/);
    }
    // Guardar com o mesmo estado (o «Aprovado ✓» manda sempre o estado) não pergunta.
    expect(fechaOPedido("cancelado", "cancelado")).toBe(false);
    expect(fechaOPedido("aprovado", "aprovado")).toBe(false);
  });

  it("todas as rotas da equipa que cancelam ou arquivam exigem o motivo (422)", () => {
    for (const rota of [
      "src/app/api/admin/pedidos/[id]/reject/route.ts",
      "src/app/api/admin/negociacoes/cancelar/route.ts",
      "src/app/api/admin/trabalhos-clyon/route.ts",
      "src/app/api/admin/pedidos/[id]/route.ts",
      "src/app/api/admin/pedidos/route.ts",
    ]) {
      const c = semComentarios(ler(rota));
      expect(c, rota).toContain("exigirMotivoDoFecho(");
      expect(c, rota).toContain("status: 422");
      expect(c, rota).toContain("gravarMotivoDoFecho(");
    }
    // Nos Trabalhos CLYON, no cancelar e no arquivar.
    const tc = semComentarios(ler("src/app/api/admin/trabalhos-clyon/route.ts"));
    expect(tc.match(/exigirMotivoDoFecho\(corpo\)/g)?.length).toBe(2);
  });

  it("a migração é aditiva e as colunas existem no CREATE/ALTER", () => {
    const db = ler("src/lib/db.ts");
    expect(db).toContain("ALTER TABLE simulatorOrders ADD COLUMN motivoDoFecho VARCHAR(30) NULL DEFAULT NULL");
    expect(db).toContain("ALTER TABLE simulatorOrders ADD COLUMN motivoDoFechoEm DATETIME NULL DEFAULT NULL");
    expect(db).toContain("ALTER TABLE simulatorOrders ADD COLUMN quantoQueriaPagar DECIMAL(10,2) NULL DEFAULT NULL");
    expect(db).not.toMatch(/DROP COLUMN motivoDoFecho|DROP COLUMN quantoQueriaPagar/);
  });
});
