import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { negociacaoNova, propor, aceitar, accoesDisponiveis } from "./negociacao";

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
const ROTA = ler("src/app/api/admin/negociacoes/redistribuir/route.ts");
const DISTRIBUIR = ler("src/lib/distribuir-pedido.ts");
const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");

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

// ─── A rota: mata primeiro, distribui a seguir, e recusa o que está fechado ─

describe("a rota do recomeço", () => {
  it("o recomeço é pedido de propósito — por omissão continua a ser redistribuir", () => {
    expect(ROTA).toContain("const recomecar = corpo.recomecar === true;");
    expect(ROTA).toContain("{ reabrir: recomecar }");
  });

  it("mata as negociações ANTES de distribuir", () => {
    const posMatar = ROTA.indexOf("matarNegociacoesDoPedido(pedidoId)");
    const posDistribuir = ROTA.indexOf("await distribuirPedido(");
    expect(posMatar).toBeGreaterThan(-1);
    expect(posDistribuir).toBeGreaterThan(posMatar);
  });

  it("recusa com 409 quando o trabalho já está fechado, executado ou pago", () => {
    const i = ROTA.indexOf("if (recomecar) {");
    const guarda = ROTA.slice(i, ROTA.indexOf("try {", i));
    expect(guarda).toContain('n.estado === "acordada"');
    expect(guarda).toContain("n.confirmadoEm != null");
    expect(guarda).toContain("n.pagoEm != null");
    expect(guarda).toContain("n.execucaoEnviadaEm != null");
    expect(guarda).toContain("status: 409");
    // A recusa diz COM QUEM está fechado — sem isso o admin não sabe de qual
    // negociação há-de desistir para poder recomeçar.
    expect(guarda).toContain("fechada.profissionalNome");
  });

  it("o guarda corre antes de qualquer coisa ser mexida", () => {
    expect(ROTA.indexOf("if (recomecar) {")).toBeLessThan(ROTA.indexOf("matarNegociacoesDoPedido(pedidoId)"));
  });

  it("fica no histórico do pedido que foi um recomeço, e com que valor", () => {
    expect(ROTA).toContain("appendOrderHistory");
    const i = ROTA.indexOf("message: recomecar");
    expect(i).toBeGreaterThan(-1);
    expect(ROTA.slice(i, i + 400)).toContain("pedido.valorDesejadoCliente");
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

// ─── O botão avisa antes de destruir ───────────────────────────────────────

describe("o botão", () => {
  it("pede confirmação antes de recomeçar", () => {
    const i = PAINEL.indexOf("Recomeçar do zero");
    expect(i).toBeGreaterThan(-1);
    const bloco = PAINEL.slice(Math.max(0, i - 2200), i);
    expect(bloco).toContain("window.confirm");
    expect(bloco).toContain("redistribuir(p.id, true)");
    // Sai sem fazer nada se ele disser que não.
    expect(bloco).toMatch(/\)\s*\n?\s*return;/);
  });

  it("só aparece quando há alguma coisa para desfazer", () => {
    expect(PAINEL).toContain("{p.negociacoes.length > 0 && (");
  });
});
