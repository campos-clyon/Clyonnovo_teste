import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { negociacaoNova, propor, aceitar, accoesDisponiveis } from "./negociacao";
import { retratoDoPedido, oQueMudou, mudancasPorExtenso } from "./recomecar-do-zero";

/**
 * Voltar do zero.
 *
 * O #228 encalhou: uma cómoda para recolher, o cliente com 30 € de orçamento,
 * e o pedido a sair com 121 € porque foi esse o valor que o formulário
 * calculou. Um profissional aceitou os 121 € — e a partir daí a negociação
 * deixou de aceitar propostas de quem quer que seja. Corrigir o valor do
 * pedido não mudava nada.
 *
 * "Ele deveria sumir e reaparecer para todos dentro do raio e da categoria
 * como um novo pedido, independente das propostas anteriores, deveria voltar
 * do zero."
 *
 * O que estes testes protegem: que o encalhe é real (e portanto o botão faz
 * falta), que o recomeço REPÕE em vez de preservar, e sobretudo que ele
 * recusa quando há um trabalho fechado — porque aí do outro lado há um
 * profissional que contava com o trabalho e dinheiro cativo.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");
const LIB = ler("src/lib/recomecar-do-zero.ts");
const EDITOR = ler("src/app/api/admin/pedidos/[id]/editar/route.ts");
const FORMULARIO = ler("src/components/admin/RegistarPedido.tsx");
const DISTRIBUIR = ler("src/lib/distribuir-pedido.ts");

// ─── O encalhe que justifica tudo isto ─────────────────────────────────────

describe("o encalhe", () => {
  it("depois de o profissional aceitar, mais ninguém consegue propor outro valor", () => {
    const agora = new Date();
    let n = negociacaoNova(121, agora);

    // O profissional aceita o valor que saiu por engano.
    const aceite = aceitar(n, "profissional", agora);
    expect(aceite.ok).toBe(true);
    n = aceite.ok ? aceite.negociacao : n;
    expect(n.estado).toBe("aguarda_contratacao");

    // E agora o cliente já não pode dizer que só tem 30 €.
    const tentativa = propor(n, "cliente", 30, agora);
    expect(tentativa.ok).toBe(false);

    // Nem o profissional se arrepender.
    expect(propor(n, "profissional", 30, agora).ok).toBe(false);

    // Só restam duas saídas, e nenhuma delas repõe o valor.
    const podeCliente = accoesDisponiveis(n, "cliente", agora);
    expect(podeCliente).not.toContain("propor");
  });
});

// ─── A reposição na base ───────────────────────────────────────────────────

describe("a reposição", () => {
  it("criarNegociacao aceita reabrir, e só então apaga o que lá estava", () => {
    const i = DB.indexOf("export async function criarNegociacao(");
    const corpo = DB.slice(i, DB.indexOf("\nexport ", i + 10));

    // Sem reabrir, o ON DUPLICATE KEY continua a tocar só no id — é o que
    // mantém o histórico de quem foi redistribuído sem querer recomeçar.
    expect(corpo).toContain("reabrir = false");
    expect(corpo).toMatch(/:\s*`id = LAST_INSERT_ID\(id\)`/);

    // Com reabrir, o estado e as propostas voltam ao princípio.
    const ramo = corpo.slice(corpo.indexOf("reabrir\n") >= 0 ? corpo.indexOf("reabrir") : 0);
    expect(ramo).toContain("estado = 'aberta'");
    expect(ramo).toContain("valorAcordado = NULL");
    expect(ramo).toContain("propostasJson = VALUES(propostasJson)");

    // O link antigo deixa de servir: token novo, prazo novo.
    expect(ramo).toContain("acessoTokenHash = VALUES(acessoTokenHash)");
    expect(ramo).toContain("acessoTokenExpiraEm = VALUES(acessoTokenExpiraEm)");

    // E nada do que veio depois da negociação sobrevive a um recomeço.
    for (const coluna of [
      "execucaoEnviadaEm",
      "provaJson",
      "confirmadoEm",
      "pagoEm",
      "estrelas",
      "avaliadoEm",
    ]) {
      expect(ramo).toContain(`${coluna} = NULL`);
    }
  });

  it("matar é mudar de estado, não apagar — o histórico do pedido fica inteiro", () => {
    const i = DB.indexOf("export async function matarNegociacoesDoPedido(");
    expect(i).toBeGreaterThan(-1);
    const corpo = DB.slice(i, DB.indexOf("\nexport ", i + 10));
    expect(corpo).toContain("UPDATE negociacoes SET estado = 'morta'");
    expect(corpo).not.toContain("DELETE");
    // Só as vivas contam para o número que se mostra ao admin.
    expect(corpo).toContain("estado <> 'morta'");
  });
});

// ─── Gravar É recomeçar ───────────────────────────────────────────────────

describe("gravar uma alteração recomeça o pedido", () => {
  it("o editor compara o pedido antes e depois, e só age se mudou", () => {
    expect(EDITOR).toContain("const antes = retratoDoPedido(pedido);");
    expect(EDITOR).toContain("oQueMudou(antes, retratoDoPedido(depoisDeGravar))");
    expect(EDITOR).toContain("if (mudou.length > 0 && depoisDeGravar) {");
    expect(EDITOR).toContain("recomecarDoZero(depoisDeGravar");
  });

  it("compara DEPOIS de gravar, e não o que o formulário mandou", () => {
    // O formulário pode mandar campos que a base ignora — foi assim que o
    // valor de partida se perdeu em silêncio no #228. Ler a base outra vez é
    // a única forma de saber o que ficou lá.
    const posGravar = EDITOR.indexOf("await updateSimulatorOrder(pedidoId, {");
    const posReler = EDITOR.indexOf("const depoisDeGravar = await getSimulatorOrderById(pedidoId);");
    expect(posReler).toBeGreaterThan(posGravar);
  });

  it("uma falha no recomeço não desfaz a gravação", () => {
    const i = EDITOR.indexOf("recomecarDoZero(depoisDeGravar");
    const bloco = EDITOR.slice(i - 200, i + 400);
    expect(bloco).toContain("catch");
  });

  it("o ecrã diz o que aconteceu ao pedido, e não só que gravou", () => {
    expect(FORMULARIO).toContain("O pedido voltou a circular como novo.");
    expect(FORMULARIO).toContain("NÃO voltou a circular");
    // E avisa ANTES, no cabeçalho do editor: é destrutivo.
    expect(FORMULARIO).toContain("Gravar recomeça o pedido do zero");
  });
});

// ─── O recomeço em si: mata primeiro, distribui a seguir ──────────────────

describe("recomecarDoZero", () => {
  it("mata as negociações ANTES de distribuir", () => {
    const posMatar = LIB.indexOf("matarNegociacoesDoPedido(pedido.id)");
    const posDistribuir = LIB.indexOf("await distribuirPedido(");
    expect(posMatar).toBeGreaterThan(-1);
    expect(posDistribuir).toBeGreaterThan(posMatar);
  });

  it("recusa quando o trabalho já está fechado, executado ou pago", () => {
    const i = LIB.indexOf("const fechada = existentes.find(");
    const guarda = LIB.slice(i, LIB.indexOf("if (pedido.valorDesejadoCliente == null)", i));
    expect(guarda).toContain('n.estado === "acordada"');
    expect(guarda).toContain("n.confirmadoEm != null");
    expect(guarda).toContain("n.pagoEm != null");
    expect(guarda).toContain("n.execucaoEnviadaEm != null");
    // E diz COM QUEM, senão quem editou não sabe de qual desistir.
    expect(guarda).toContain("fechada.profissionalNome");
  });

  it("o guarda corre antes de qualquer coisa ser mexida", () => {
    expect(LIB.indexOf("const fechada = existentes.find(")).toBeLessThan(
      LIB.indexOf("matarNegociacoesDoPedido(pedido.id)"),
    );
  });

  it("distribui com reabrir — senão as propostas antigas sobreviviam", () => {
    expect(LIB).toContain("{ reabrir: true }");
  });

  it("fica no histórico que foi um recomeço, e quantas acabaram", () => {
    expect(LIB).toContain("appendOrderHistory");
    const i = LIB.indexOf("Recomeçado do zero depois da edição");
    expect(i).toBeGreaterThan(-1);
  });
});

// ─── O que conta como mudança ─────────────────────────────────────────────

describe("o retrato do pedido", () => {
  const base = {
    serviceType: "recolha_moveis",
    description: "uma cómoda",
    address: "Rua José Fontana, 23",
    city: "Almada",
    postalCode: "2800-122",
    floor: "2º",
    hasElevator: "no",
    parkingDistance: "door",
    dataAgendada: "2026-08-27T00:20:00.000Z",
    valorDesejadoCliente: "121.43",
    precisaFatura: 1,
    filesJson: '[{"url":"a"}]',
  };

  it("o valor conta como número — 30 e 30.00 são o mesmo", () => {
    const a = retratoDoPedido({ ...base, valorDesejadoCliente: "30" });
    const b = retratoDoPedido({ ...base, valorDesejadoCliente: "30.00" });
    expect(oQueMudou(a, b)).toEqual([]);
  });

  it("mudar o valor conta", () => {
    const a = retratoDoPedido(base);
    const b = retratoDoPedido({ ...base, valorDesejadoCliente: "30" });
    expect(oQueMudou(a, b)).toEqual(["valorDesejadoCliente"]);
  });

  it("acrescentar uma fotografia conta", () => {
    const a = retratoDoPedido(base);
    const b = retratoDoPedido({ ...base, filesJson: '[{"url":"a"},{"url":"b"}]' });
    expect(oQueMudou(a, b)).toEqual(["fotografias"]);
  });

  it("corrigir o nome, o telefone ou o email do cliente NÃO conta", () => {
    // Eles são do cliente, não do pedido, e nenhum profissional os vê antes
    // de ser contratado. Um acento não pode matar cinco propostas a sério.
    const a = retratoDoPedido({ ...base, contactName: "Fatima", contactPhone: "911", contactEmail: "a@b.pt" } as never);
    const b = retratoDoPedido({ ...base, contactName: "Fátima", contactPhone: "912", contactEmail: "c@d.pt" } as never);
    expect(oQueMudou(a, b)).toEqual([]);
  });

  it("diz o que mudou em português, para o histórico e para o ecrã", () => {
    expect(mudancasPorExtenso(["valorDesejadoCliente"])).toBe("o valor de partida");
    expect(mudancasPorExtenso(["valorDesejadoCliente", "fotografias"])).toBe(
      "o valor de partida e as fotografias",
    );
    expect(mudancasPorExtenso(["description", "floor", "fotografias"])).toBe(
      "a descrição, o andar e as fotografias",
    );
  });
});

// ─── A distribuição volta a medir tudo, com as regras de hoje ──────────────

describe("quem recebe", () => {
  it("o recomeço passa pela distribuição normal — mesmo raio, mesma categoria", () => {
    expect(DISTRIBUIR).toContain("reabrir = false");
    expect(DISTRIBUIR).toContain("{ reabrir }");
    // A elegibilidade não é contornada: continua a ser a mesma regra.
    expect(DISTRIBUIR).toContain("avaliarElegibilidade");
  });
});
