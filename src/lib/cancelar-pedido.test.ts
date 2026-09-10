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

describe("a rota do admin", () => {
  it("NÃO recusa um trabalho contratado — o direito é absoluto", () => {
    // A primeira versão devolvia 409 e mandava desistir da negociação
    // primeiro. Ele corrigiu-me: "essa opção deve ser absoluta, tanto a CLYON
    // quanto o Rui devem ter esse direito". Bloquear não protegia o
    // profissional; só deixava o pedido na mesa a fingir que estava vivo.
    expect(ROTA).not.toContain("status: 409, ");
    expect(ROTA).not.toContain("const fechada = existentes.find(");
  });

  it("exige o motivo quando há um compromisso a desfazer", () => {
    // Não é um bloqueio: é uma exigência de registo. Quando o profissional
    // perguntar porque perdeu o trabalho, a resposta tem de existir escrita.
    expect(ROTA).toContain("desfaz.motivoObrigatorio && !motivo");
    expect(ROTA).toContain("status: 422");
    expect(ROTA).toContain("precisaDeMotivo: true");
  });

  it("o que se desfaz é apurado antes de se desfazer", () => {
    expect(ROTA.indexOf("oQueSeDesfaz(existentes)")).toBeLessThan(
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
    /*
     * Era um `window.prompt` dentro do painel; é agora a `CancelarPedido`,
     * com os motivos em botões e partilhada com a agenda. Perguntar antes
     * continua a ser a regra — o que mudou foi quem faz a pergunta.
     */
    const CAIXA = ler("src/components/admin/CancelarPedido.tsx");
    expect(PAINEL).toContain("<CancelarPedido");
    expect(CAIXA).toContain("Cancelar o pedido #");
    // Há por onde sair sem cancelar: fechar a caixa desiste do cancelamento.
    expect(CAIXA).toContain("Voltar atrás");
    expect(CAIXA).toContain("/api/admin/negociacoes/cancelar");
    // E sem compromisso a desfazer, o motivo continua a ser opcional.
    expect(CAIXA).toContain("desfaz.motivoObrigatorio ? motivo.length > 0 : true");
  });
});
