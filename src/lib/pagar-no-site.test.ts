import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { A_PLATAFORMA_COBRA } from "./pagamento-na-plataforma";

/**
 * AS DEFESAS DO DINHEIRO, GUARDADAS CONTRA UMA EDIÇÃO DISTRAÍDA.
 *
 * As regras têm testes próprios — `eupago.test.ts` e `webhook-do-eupago.test.ts`
 * provam-nas com números. Este ficheiro guarda outra coisa: que elas continuam
 * LIGADAS onde têm de estar. Uma função perfeita que ninguém chama não defende
 * nada, e é assim que estas coisas se perdem — não com alguém a apagar a
 * verificação, mas com alguém a mover uma linha para cima dela.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const WEBHOOK = ler("src/app/api/pagamentos/webhook/route.ts");
const CRIAR = ler("src/app/api/pagamentos/route.ts");
const BASE = ler("src/lib/pagamentos-na-base.ts");
const ECRA = ler("src/components/PagarTrabalho.tsx");
const PEDIR = ler("src/lib/pedir-ao-eupago.ts");

describe("o webhook não acredita em quem lhe bate à porta", () => {
  it("verifica a assinatura ANTES de gravar seja o que for", () => {
    const verifica = WEBHOOK.indexOf("assinaturaValida(corpoCru");
    const grava = WEBHOOK.indexOf("guardarAviso(");
    expect(verifica).toBeGreaterThan(0);
    expect(grava).toBeGreaterThan(0);
    expect(verifica).toBeLessThan(grava);
  });

  it("assina o corpo CRU, e não um JSON reserializado", () => {
    // `req.text()` e não `req.json()`: dois JSON iguais podem ter bytes
    // diferentes, e assinar a nossa versão em vez da deles falha sempre.
    expect(WEBHOOK).toContain("await req.text()");
  });

  it("sem segredo configurado não aceita nada", () => {
    expect(WEBHOOK).toContain("segredoDoWebhook");
    expect(WEBHOOK).toMatch(/!conf\.ok \|\| !conf\.config\.segredoDoWebhook/);
  });

  /*
   * O CÓDIGO DE RESPOSTA É UMA INSTRUÇÃO PARA O euPAGO.
   *
   * 200 quer dizer «risca isto da lista». Um 200 devolvido a um erro nosso
   * perde o pagamento em silêncio e para sempre — o euPago não volta.
   */
  it("um erro nosso devolve 500, para o euPago voltar", () => {
    expect(WEBHOOK).toContain("status: 500");
    expect(WEBHOOK).toContain("return VOLTA(");
  });

  it("confere o valor antes de dar por pago", () => {
    const confere = WEBHOOK.indexOf("confereComOPedido(aviso");
    const paga = WEBHOOK.indexOf("darPorPago(");
    expect(confere).toBeGreaterThan(0);
    expect(confere).toBeLessThan(paga);
  });

  it("o pagamento em duplicado sai identificado, não morre num catch", () => {
    expect(WEBHOOK).toContain("pagamento_em_duplicado");
    expect(WEBHOOK).toContain("r.duplicado");
  });
});

describe("as garantias que só a base dá", () => {
  /*
   * Um `if` antes do INSERT tem uma janela entre a verificação e a escrita, e
   * dois webhooks a chegar ao mesmo tempo cabem lá dentro. Um índice único não
   * tem janela.
   */
  it("um pagamento pago por negociação — índice único, não um if", () => {
    expect(BASE).toContain("UNIQUE KEY uq_uma_paga (negociacaoPaga)");
    expect(BASE).toContain("negociacaoPaga = ?");
  });

  it("um aviso só conta uma vez — índice único em (trid, estado)", () => {
    expect(BASE).toContain("UNIQUE KEY uq_aviso (trid, estado)");
    expect(BASE).toContain("INSERT IGNORE INTO avisosDoEupago");
  });

  it("nada anda para trás: as transições exigem o estado de partida", () => {
    // `darPorPago` só pega numa linha pendente. Um «expirado» atrasado — e
    // chegam fora de ordem — não desfaz um pagamento já feito.
    expect(BASE).toMatch(/SET estado = 'pago'[\s\S]*?WHERE id = \? AND estado = 'pendente'/);
    expect(BASE).toMatch(/SET estado = 'reembolsado'[\s\S]*?WHERE id = \? AND estado = 'pago'/);
  });

  it("o reembolso liberta o índice, senão o trabalho nunca mais se podia pagar", () => {
    expect(BASE).toContain("negociacaoPaga = NULL");
  });
});

describe("o que se pede ao euPago", () => {
  /*
   * `per_dup: 1` deixava a mesma referência ser paga duas vezes, e o cliente
   * que a pagasse por engano pagava duas vezes o mesmo trabalho.
   */
  it("a referência Multibanco aceita um pagamento só", () => {
    expect(ler("src/lib/eupago.ts")).toContain("per_dup: 0 as const");
  });

  it("as duas APIs vão a endereços diferentes, como são", () => {
    expect(PEDIR).toContain("/api/v1.02/mbway/create");
    expect(PEDIR).toContain("/clientes/rest_api/multibanco/create");
  });

  it("a ida à rede tem relógio — um pedido pendurado não escreve o que falhou", () => {
    expect(PEDIR).toContain("AbortController");
    expect(PEDIR).toContain("SEGUNDOS_DE_ESPERA");
  });
});

describe("a porta: ninguém é cobrado antes de a plataforma o assumir", () => {
  it("a criação passa pelo `podeCobrar`", () => {
    expect(CRIAR).toContain("podeCobrar(conf.config, A_PLATAFORMA_COBRA");
  });

  /*
   * ⚠️ ISTO NÃO É UMA VERIFICAÇÃO DE ESTILO.
   *
   * Enquanto for falso, todos os ecrãs dizem ao cliente que paga ao
   * profissional no fim do trabalho. Ligá-lo antes de as fases estarem feitas
   * põe a plataforma a prometer uma caução que ninguém segura.
   *
   * Quando for a sério, este teste muda com o interruptor — e é suposto que
   * mudar exija tocar aqui, para alguém ler isto nesse dia.
   */
  it("o interruptor da cobrança continua desligado", () => {
    expect(A_PLATAFORMA_COBRA).toBe(false);
  });
});

describe("o ecrã do cliente não faz contas de dinheiro", () => {
  /*
   * Uma segunda conta do lado do navegador é uma segunda verdade. O dia em que
   * discordasse da primeira era o dia em que o cliente via um número e o banco
   * lhe pedia outro — e é o último passo, onde se perde a confiança toda.
   */
  it("recebe os valores do servidor em vez de os calcular", () => {
    expect(ECRA).not.toContain("taxas-plataforma");
    expect(ECRA).not.toContain("contaDoCliente");
    expect(ECRA).toContain("estado.valores");
  });

  it("nomeia o euPago, como o contrato obriga", () => {
    expect(ECRA).toContain("processados pelo euPago");
  });

  it("não desenha nada quando a cobrança não está aberta", () => {
    expect(ECRA).toContain("if (!estado.disponivel) return null");
  });
});
