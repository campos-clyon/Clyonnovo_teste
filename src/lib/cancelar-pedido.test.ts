import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Cancelar um pedido: o cliente desistiu.
 *
 * O #225. Duas propostas na mesa, 250 € do Manuel Martins e 350 € da
 * Sthefanny, e o Sr. Rui a responder pelo WhatsApp: "obtivemos mais algumas
 * ofertas, das quais pelo menos uma é mais competitiva do que as acima
 * listadas". Não havia como o dizer ao sistema.
 *
 * O pedido ficava em "A correr" ao lado dos contratados — ele reparou: "o
 * pedido do Rui Dias está no meio dos pedidos contratados, não devia" — e o
 * profissional com a proposta aberta continuava à espera de uma resposta que
 * nunca ia chegar.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");
const ROTA = ler("src/app/api/admin/negociacoes/cancelar/route.ts");
const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");

describe("cancelar na base", () => {
  it("muda o estado e encerra as negociações — mas não apaga nada", () => {
    const i = DB.indexOf("export async function cancelarPedido(");
    expect(i).toBeGreaterThan(-1);
    const corpo = DB.slice(i, DB.indexOf("\nexport ", i + 10));
    expect(corpo).toContain("matarNegociacoesDoPedido(pedidoId)");
    expect(corpo).toContain("SET status = 'cancelado'");
    // O pedido fica. Cancelar não é apagar: daqui a um mês a pergunta "o que
    // aconteceu ao #225?" tem de ter resposta.
    expect(corpo).not.toContain("DELETE");
  });

  it("mortas e não desistidas — não desistiu nenhuma das partes", () => {
    const i = DB.indexOf("export async function cancelarPedido(");
    const corpo = DB.slice(i, DB.indexOf("\nexport ", i + 10));
    expect(corpo).not.toContain("'desistida'");
  });
});

describe("a rota", () => {
  it("recusa um trabalho já contratado, executado, confirmado ou pago", () => {
    // Isso não é cancelar um pedido, é desfazer um compromisso entre duas
    // pessoas com dinheiro pelo meio — e tem caminho próprio, que fala com
    // quem está do outro lado.
    const i = ROTA.indexOf("const fechada = existentes.find(");
    const guarda = ROTA.slice(i, ROTA.indexOf("try {", i));
    expect(guarda).toContain('n.estado === "acordada"');
    expect(guarda).toContain("n.confirmadoEm != null");
    expect(guarda).toContain("n.pagoEm != null");
    expect(guarda).toContain("n.execucaoEnviadaEm != null");
    expect(guarda).toContain("status: 409");
    expect(guarda).toContain("fechada.profissionalNome");
  });

  it("o guarda corre antes de cancelar seja o que for", () => {
    expect(ROTA.indexOf("const fechada = existentes.find(")).toBeLessThan(
      ROTA.indexOf("await cancelarPedido(pedidoId)"),
    );
  });

  it("recusa cancelar duas vezes", () => {
    expect(ROTA).toContain('pedido.status === "cancelado"');
  });

  it("o motivo fica escrito no histórico e no registo permanente", () => {
    expect(ROTA).toContain("appendOrderHistory");
    expect(ROTA).toContain('acontecimento: "pedido_cancelado"');
    const i = ROTA.indexOf("registarSemFalhar({");
    expect(ROTA.slice(i, i + 500)).toContain("motivo");
  });

  it("pedido_cancelado é um acontecimento a sério do registo", () => {
    expect(DB).toContain('| "pedido_cancelado"');
  });
});

describe("a mesa", () => {
  it("um cancelado não é activo nem concluído — tem prateleira própria", () => {
    expect(PAINEL).toContain('ordenados.filter((p) => p.status === "cancelado")');
    // As outras duas listas passam a excluí-lo explicitamente.
    expect(PAINEL).toContain('p.status !== "cancelado" && pedidoConcluido(p)');
    expect(PAINEL).toContain('p.status !== "cancelado" && !pedidoConcluido(p)');
  });

  it("a linha diz que foi cancelado, antes de tudo o resto", () => {
    const i = PAINEL.indexOf("const bola = cancelado");
    expect(i).toBeGreaterThan(-1);
    const bloco = PAINEL.slice(i, PAINEL.indexOf("return (", i));
    expect(bloco).toContain("✕ Cancelado");
    expect(bloco.indexOf("Cancelado")).toBeLessThan(bloco.indexOf("Concluído"));
  });

  it("o botão não aparece onde não faz nada", () => {
    expect(PAINEL).toContain("{!concluido && !cancelado && (");
  });

  it("cancelar pergunta antes, e o motivo é opcional", () => {
    const i = PAINEL.indexOf("async function cancelarPedidoNoPainel(");
    const corpo = PAINEL.slice(i, PAINEL.indexOf("\n  async function", i + 10));
    expect(corpo).toContain("window.prompt");
    // Fechar a caixa desiste; uma cadeia vazia é um motivo em branco, e isso
    // é uma escolha, não um cancelamento do cancelamento.
    expect(corpo).toContain("if (motivo === null) return;");
    expect(corpo).toContain("/api/admin/negociacoes/cancelar");
  });
});
