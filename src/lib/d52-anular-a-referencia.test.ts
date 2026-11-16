import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MOTIVO_DA_REFERENCIA_ANULADA,
  eReferenciaAnulada,
  fraseDaAnulacao,
  lerAnulacao,
  motivoDaAnulacao,
  porqueNaoSeAnula,
  textoDaConfirmacao,
} from "./anular-a-referencia";
import { pagamentoForaDeVigor } from "./conferir-o-pagamento";
import { AVISO_SEM_NADA_PAGO, semNadaPagoRegistado } from "./aviso-sem-nada-pago";
import { contaDoValorFinal } from "./valor-final-ao-cliente";
import type { Pagamento } from "./pagamentos-na-base";

/*
 * d52 (16-11-2026, dono) — «ANULAR A REFERÊNCIA» e o aviso antes de enviar o
 * valor final sem nada pago registado. Valores inventados (repositório público).
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("a regra: o que se anula e como se lê o pedido", () => {
  it("motivo obrigatório e pagamento indicado", () => {
    expect(lerAnulacao({ pagamentoId: 7 }).ok).toBe(false);
    expect(lerAnulacao({ pagamentoId: 7, motivo: "  " }).ok).toBe(false);
    expect(lerAnulacao({ motivo: "pagou uma parte por fora" }).ok).toBe(false);
    expect(lerAnulacao({ pagamentoId: -1, motivo: "pagou uma parte por fora" }).ok).toBe(false);
    const r = lerAnulacao({ pagamentoId: "7", motivo: "  pagou   uma parte por fora " });
    expect(r).toEqual({ ok: true, pedido: { pagamentoId: 7, motivo: "pagou uma parte por fora" } });
  });

  it("só uma referência do cliente por pagar (Multibanco ou MB WAY)", () => {
    expect(porqueNaoSeAnula({ estado: "pendente", metodo: "multibanco", parte: "trabalho" })).toBeNull();
    expect(porqueNaoSeAnula({ estado: "pendente", metodo: "mbway", parte: "diferenca" })).toBeNull();
    expect(porqueNaoSeAnula({ estado: "pago", metodo: "multibanco", parte: "trabalho" })).not.toBeNull();
    expect(porqueNaoSeAnula({ estado: "cancelado", metodo: "multibanco", parte: "trabalho" })).not.toBeNull();
    expect(porqueNaoSeAnula({ estado: "substituido", metodo: "multibanco", parte: "trabalho" })).not.toBeNull();
    expect(porqueNaoSeAnula({ estado: "pendente", metodo: "multibanco", parte: "divida" })).not.toBeNull();
    expect(porqueNaoSeAnula({ estado: "pendente", metodo: "transferencia", parte: "trabalho" })).not.toBeNull();
  });

  it("a confirmação diz a referência, o valor, e que um pagamento depois fica para devolver", () => {
    const t = textoDaConfirmacao({ referencia: "123 456 789", metodo: "multibanco", valor: 250 });
    expect(t).toContain(
      "A referência 123 456 789 de 250,00 € deixa de valer na plataforma. Se o cliente a pagar mesmo assim, o pagamento entra e fica para devolver.",
    );
    expect(t).toContain("O euPago não é avisado");
  });

  it("o motivo gravado começa pela marca que o webhook reconhece, e cabe na coluna", () => {
    const m = motivoDaAnulacao("Admin", "x".repeat(400));
    expect(m.startsWith(MOTIVO_DA_REFERENCIA_ANULADA)).toBe(true);
    expect(m.length).toBeLessThanOrEqual(255);
    expect(fraseDaAnulacao({ referencia: "1", metodo: "multibanco", valor: 10 }, { quem: "Admin", motivo: "m" })).toContain(
      "motivo: m",
    );
  });
});

describe("o webhook: uma referência anulada paga na mesma entra e fica para devolver", () => {
  const anulada = { id: 9, valor: 300, estado: "cancelado", metodo: "multibanco", erro: motivoDaAnulacao("Admin", "pagou parte por fora") };

  it("o cancelado continua entre os estados que ainda podem ser pagos (o darPorPago aceita-o)", () => {
    const base = semComentarios(ler("src/lib/pagamentos-na-base.ts"));
    expect(base).toMatch(/AINDA_PODE_SER_PAGO: EstadoDoPagamento\[\] = \[\s*"pendente",\s*"cancelado",/);
  });

  it("mesmo sendo a mais recente, não fecha o pedido: valor a devolver ao cliente", () => {
    expect(eReferenciaAnulada(anulada)).toBe(true);
    const porque = pagamentoForaDeVigor(anulada, [anulada]);
    expect(porque).toContain("anulada");
    expect(porque).toContain("valor a devolver ao cliente");
  });

  it("um cancelado de outra origem (o valor final, que cancela as antigas) segue a regra de sempre", () => {
    const outra = { ...anulada, erro: null };
    expect(eReferenciaAnulada(outra)).toBe(false);
    expect(pagamentoForaDeVigor(outra, [outra])).toBeNull();
  });

  it("o webhook pergunta o «fora de vigor» antes de dar por pago, e guarda o aviso para devolver", () => {
    const w = semComentarios(ler("src/app/api/pagamentos/webhook/route.ts"));
    const fora = w.indexOf("const foraDeVigor = pagamentoForaDeVigor(");
    const paga = w.indexOf("const r = await darPorPago(");
    expect(fora).toBeGreaterThan(0);
    expect(paga).toBeGreaterThan(fora);
    expect(w.slice(fora, paga)).toContain('acontecimento: "pagamento_em_duplicado"');
    expect(w.slice(fora, paga)).toContain("anotarAviso(aviso.trid, aviso.estado, { aplicado: false, nota: foraDeVigor })");
  });
});

describe("a rota /api/admin/pagamentos/anular-referencia", () => {
  const rota = semComentarios(ler("src/app/api/admin/pagamentos/anular-referencia/route.ts"));

  it("só o administrador geral", () => {
    expect(rota).toContain("await requireAdminGeral(req)");
    expect(rota).not.toMatch(/requireAdmin\(/);
  });

  it("nunca apaga: fecha como «cancelado» pelo fecharSemPagar, que só sai de pendente", () => {
    expect(rota).not.toMatch(/DELETE/i);
    expect(rota).toContain('fecharSemPagar(p.id, "cancelado", { motivo: motivoDaAnulacao(quem, lido.pedido.motivo) })');
    const base = ler("src/lib/pagamentos-na-base.ts");
    const fechar = base.slice(base.indexOf("export async function fecharSemPagar"), base.indexOf("export async function darPorReembolsado"));
    expect(fechar).toContain("WHERE id = ? AND estado = 'pendente'");
    expect(fechar).not.toMatch(/DELETE/i);
  });

  it("recusa o que não se anula, e lê o motivo pela regra", () => {
    expect(rota).toContain("lerAnulacao(corpo)");
    expect(rota).toContain("porqueNaoSeAnula(p)");
  });

  it("histórico do pedido e registo permanente: quem, quando (o registo data-o) e o motivo", () => {
    expect(rota).toContain("appendOrderHistory(p.pedidoId,");
    expect(rota).toContain('acontecimento: "referencia_anulada"');
    expect(rota).toContain("autorNome: quem");
    expect(rota).toContain("motivo: lido.pedido.motivo");
    expect(ler("src/lib/historico-do-pedido.ts")).toContain('referencia_anulada: "Referência de pagamento anulada"');
    expect(ler("src/lib/db.ts")).toContain('| "referencia_anulada"');
  });
});

describe("o botão: Pagamentos e a caixa «Cobrar o cliente» da Mesa e dos Trabalhos CLYON", () => {
  const botao = semComentarios(ler("src/components/admin/AnularAReferencia.tsx"));

  it("só ao administrador, motivo obrigatório e confirmação antes de gravar", () => {
    expect(botao).toContain("useEAdministrador()");
    expect(botao).toContain('pagamento.estado !== "pendente"');
    expect(botao).toContain("window.confirm(textoDaConfirmacao(pagamento))");
    expect(botao).toContain("motivoLimpo.length < MOTIVO_MINIMO");
    expect(botao).toContain("/api/admin/pagamentos/anular-referencia");
  });

  it("montado na gaveta do pagamento (Pagamentos) e no «Cobrar o cliente» (não na dívida do profissional)", () => {
    expect(semComentarios(ler("src/components/admin/AdminPagamentosPanel.tsx"))).toContain("<AnularAReferencia");
    const gerar = semComentarios(ler("src/components/admin/GerarReferencia.tsx"));
    expect(gerar).toMatch(/\{!doProfissional && \(\s*<AnularAReferencia/);
  });
});

describe("«Enviar o valor final»: o aviso quando não há nada pago registado", () => {
  const T = { cliente: 0, profissional: 0.1 };
  const trabalho = {
    acordado: 400,
    taxas: T,
    modelo: "iva_incluido" as const,
    acrescimo: 0,
    formaDePagamento: "na_plataforma" as const,
    novoModelo: false,
    porHora: null,
    reservaCent: 0,
  };
  const linha = (p: Partial<Pagamento>): Pagamento =>
    ({ id: 1, negociacaoId: 5, pedidoId: 9, providerId: 3, metodo: "multibanco", estado: "pendente", valor: 100, comFactura: true, parte: "trabalho", ...p }) as Pagamento;

  it("sem nenhum pagamento pago: modo referência, pagoAteAgora 0 — avisa", () => {
    const r = contaDoValorFinal(trabalho as never, [linha({})], "normal");
    if (!r.ok) throw new Error(r.porque);
    expect(semNadaPagoRegistado(r.conta)).toBe(true);
  });

  it("com uma parte paga (a diferença das horas) ou no modelo do parceiro, não avisa", () => {
    expect(semNadaPagoRegistado({ modo: "referencia", pagoAteAgora: 120 })).toBe(false);
    expect(semNadaPagoRegistado({ modo: "parceiro" })).toBe(false);
    expect(semNadaPagoRegistado(null)).toBe(false);
  });

  it("o texto do aviso e o segundo clique «Enviar na mesma»", () => {
    expect(AVISO_SEM_NADA_PAGO).toBe(
      "Não há nada pago registado neste trabalho. Se o cliente já pagou uma parte, registe-a primeiro (Pagamentos › «Já recebemos») — senão a referência sai com o total.",
    );
    // O botão que o aviso nomeia existe nos Pagamentos, com esse nome (correcção da d52).
    const pagamentos = semComentarios(ler("src/components/admin/AdminPagamentosPanel.tsx"));
    expect(pagamentos).toContain('rotulo="Já recebemos"');
    expect(pagamentos).not.toMatch(/>\s*Registar pagamento\s*</);
    const ecra = semComentarios(ler("src/components/admin/EnviarValorFinalAoCliente.tsx"));
    expect(ecra).toContain("{AVISO_SEM_NADA_PAGO}");
    expect(ecra).toMatch(/if \(semNadaPago && !naMesma\) \{\s*setNaMesma\(true\);\s*return;\s*\}\s*void enviar\(\);/);
    expect(ecra).toContain('"Enviar na mesma"');
    // Uma conta nova (outra pré-visualização) volta a pedir os dois cliques.
    expect(ecra).toMatch(/setPrevia\(p\);\s*setNaMesma\(false\);/);
  });
});
