import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { oQueSeDesfaz, avisoDoCancelamento, resumoDoCancelamento } from "./cancelamento";

/**
 * Cancelar é um direito dos dois lados, e é absoluto.
 *
 * "Eu quero cancelar o pedido do Rui. Essa opção deve ser absoluta: tanto a
 * CLYON quanto o Rui devem ter esse direito."
 *
 * Eu tinha-o bloqueado com um 409 quando havia trabalho contratado, e mandava
 * desistir da negociação primeiro. Ele corrigiu-me, e tem razão: um cliente
 * que já foi noutro sítio não deixa de o ter feito por o botão estar
 * bloqueado. O pedido é que fica na mesa a fingir que está vivo, e o
 * profissional à espera de uma resposta que não vem.
 *
 * O que substitui o bloqueio não é o silêncio — é o registo. Quando há um
 * compromisso a desfazer, o motivo passa a obrigatório e fica escrito quem
 * perdeu o quê.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ROTA_CLIENTE = ler("src/app/api/negociacao/[token]/route.ts");
const ECRA_CLIENTE = ler("src/app/pedido/[token]/PropostasRecebidas.tsx");
const PAINEL = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));

const neg = (p: Partial<Parameters<typeof oQueSeDesfaz>[0][number]> = {}) => ({
  estado: "aberta",
  valorAcordado: null,
  profissionalNome: "Fred Teste",
  ...p,
});

describe("o que se desfaz", () => {
  it("sem ninguém contratado, não há compromisso nenhum", () => {
    const d = oQueSeDesfaz([neg(), neg({ estado: "aberta" })]);
    expect(d.temCompromisso).toBe(false);
    expect(d.motivoObrigatorio).toBe(false);
    expect(avisoDoCancelamento(d)).toBeNull();
  });

  it("negociações mortas e desistidas não contam", () => {
    const d = oQueSeDesfaz([
      neg({ estado: "morta", valorAcordado: 250 }),
      neg({ estado: "desistida", valorAcordado: 350 }),
    ]);
    expect(d.temCompromisso).toBe(false);
  });

  it("contratado: há compromisso e o motivo passa a obrigatório", () => {
    const d = oQueSeDesfaz([neg({ estado: "acordada", valorAcordado: 250 })]);
    expect(d.temCompromisso).toBe(true);
    expect(d.motivoObrigatorio).toBe(true);
    expect(d.profissional).toBe("Fred Teste");
    expect(d.valor).toBe(250);
    expect(d.ponto).toBe("contratado");
    expect(d.dinheiroJaLibertado).toBe(false);
  });

  it("com o trabalho feito, o aviso di-lo — é o caso do #225", () => {
    const d = oQueSeDesfaz([
      neg({ estado: "acordada", valorAcordado: 250, execucaoEnviadaEm: "2026-08-26T21:13:29Z" }),
    ]);
    expect(d.ponto).toContain("trabalho já feito");
    const aviso = avisoDoCancelamento(d)!;
    expect(aviso).toContain("Fred Teste");
    expect(aviso).toContain("250,00 €");
    expect(aviso).toContain("deixa de contar com o trabalho");
    // Ainda cativo: cancelar liberta-o de volta.
    expect(aviso).toContain("cativo deixa de estar");
  });

  it("com o pagamento libertado, diz que cancelar NÃO o traz de volta", () => {
    const d = oQueSeDesfaz([
      neg({ estado: "acordada", valorAcordado: 170, confirmadoEm: "2026-08-26T16:32:29Z" }),
    ]);
    expect(d.dinheiroJaLibertado).toBe(true);
    // A parte que não se pode calar: quem cancela tem de saber isto ANTES.
    expect(avisoDoCancelamento(d)).toContain("NÃO o traz de volta");
  });

  it("a mais avançada é a que conta", () => {
    const d = oQueSeDesfaz([
      neg({ estado: "morta" }),
      neg({ estado: "acordada", valorAcordado: 100, profissionalNome: "Manuel Martins" }),
    ]);
    expect(d.profissional).toBe("Manuel Martins");
  });

  it("o resumo escrito diz quem, quanto e porquê", () => {
    const d = oQueSeDesfaz([
      neg({ estado: "acordada", valorAcordado: 250, execucaoEnviadaEm: "x" }),
    ]);
    const r = resumoDoCancelamento(d, "o cliente", "arranjou mais barato noutro sítio");
    expect(r).toContain("o cliente");
    expect(r).toContain("Fred Teste");
    expect(r).toContain("250,00 €");
    expect(r).toContain("arranjou mais barato");
  });
});

describe("o cliente também cancela", () => {
  it("a rota do cliente aceita cancelar o pedido inteiro", () => {
    expect(ROTA_CLIENTE).toContain('corpo.accao === "cancelar_pedido"');
    // Não é o mesmo que desistir de uma proposta — essa continua a existir.
    expect(ROTA_CLIENTE).toContain('case "desistir":');
  });

  it("só o cliente o faz, e não o profissional pelo link dele", () => {
    const i = ROTA_CLIENTE.indexOf('corpo.accao === "cancelar_pedido"');
    const bloco = ROTA_CLIENTE.slice(i, i + 500);
    expect(bloco).toContain('lado !== "cliente"');
    expect(bloco).toContain("403");
  });

  it("exige o motivo pelas mesmas regras do admin", () => {
    const i = ROTA_CLIENTE.indexOf('corpo.accao === "cancelar_pedido"');
    const bloco = ROTA_CLIENTE.slice(i, ROTA_CLIENTE.indexOf("cancelarPedido(pedidoId)", i));
    expect(bloco).toContain("oQueSeDesfaz(existentes)");
    expect(bloco).toContain("desfaz.motivoObrigatorio && !motivo");
    expect(bloco).toContain("422");
  });

  it("fica no histórico e no registo permanente, como o do admin", () => {
    const i = ROTA_CLIENTE.indexOf('corpo.accao === "cancelar_pedido"');
    const bloco = ROTA_CLIENTE.slice(i, i + 3000);
    expect(bloco).toContain("appendOrderHistory");
    expect(bloco).toContain('acontecimento: "pedido_cancelado"');
    expect(bloco).toContain('autorTipo: "cliente"');
  });

  it("o ecrã dele tem a saída, e não a esconde atrás de um telefonema", () => {
    expect(ECRA_CLIENTE).toContain("cancelar o pedido");
    expect(ECRA_CLIENTE).toContain('accao: "cancelar_pedido"');
    // Pergunta duas vezes: a confirmação e o motivo.
    expect(ECRA_CLIENTE).toContain("window.confirm");
    expect(ECRA_CLIENTE).toContain("window.prompt");
  });

  it("quando o motivo passa a ser preciso, pergunta outra vez em vez de dar erro", () => {
    // Um 422 devolvido como erro seco deixa a pessoa sem saber o que fazer.
    expect(ECRA_CLIENTE).toContain("res.status === 422 && dados?.precisaDeMotivo");
  });
});

describe("o painel do admin", () => {
  it("avisa do que desfaz antes de perguntar", () => {
    const i = PAINEL.indexOf("async function cancelarPedidoNoPainel(");
    const corpo = PAINEL.slice(i, PAINEL.indexOf("\n  async function", i + 10));
    expect(corpo).toContain("oQueSeDesfaz(p.negociacoes)");
    expect(corpo).toContain("avisoDoCancelamento(desfaz)");
    expect(corpo).toContain("desfaz.motivoObrigatorio");
  });

  it("recusa avançar sem motivo quando ele é preciso", () => {
    const i = PAINEL.indexOf("async function cancelarPedidoNoPainel(");
    const corpo = PAINEL.slice(i, PAINEL.indexOf("\n  async function", i + 10));
    expect(corpo).toContain("motivo.trim().length === 0");
  });
});
