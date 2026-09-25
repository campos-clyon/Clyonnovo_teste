import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RECEBIMENTOS_A_MAO,
  eRecebimentoAMao,
  faseDoDinheiro,
  ladoDoCliente,
  ladoDoProfissional,
  nomeDoRecebimento,
  pagouAoProfissional,
  prontoAPagar,
} from "./dinheiro-do-trabalho";

/**
 * *«Estamos com problema para gerir os pagamentos. Cria uma ferramenta ou
 * melhora uma para podermos gerir quem pagou, como pagou, e se já pagámos os
 * profissionais.»* — 24-09-2026.
 *
 * Três perguntas sobre o MESMO trabalho, que viviam em quatro ecrãs. Esta é a
 * regra que as junta numa linha — e é a única parte disto que não se pode dar
 * ao luxo de estar quase certa.
 */

describe("em que pé está o dinheiro deste trabalho", () => {
  it("ninguém pagou: é a fase que representa uma perda possível", () => {
    expect(faseDoDinheiro({})).toBe("a_receber");
    expect(faseDoDinheiro({ confirmadoEm: "2026-09-22" })).toBe("a_receber");
  });

  it("o cliente pagou e falta a confirmação dele", () => {
    expect(faseDoDinheiro({ clientePagouEm: "2026-09-22" })).toBe("a_decorrer");
  });

  it("recebemos, está confirmado, e devemos ao profissional", () => {
    expect(
      faseDoDinheiro({ clientePagouEm: "2026-09-22", confirmadoEm: "2026-09-23" }),
    ).toBe("a_pagar");
  });

  it("os dois lados feitos", () => {
    expect(
      faseDoDinheiro({
        clientePagouEm: "2026-09-22",
        confirmadoEm: "2026-09-23",
        pagoEm: "2026-09-24",
      }),
    ).toBe("fechado");
  });

  /*
   * ⚠️ O DINHEIRO EM MÃO DECIDE-SE PRIMEIRO, antes de perguntar se o cliente
   * pagou À CLYON — porque a pergunta não faz sentido: ele pagou AO
   * PROFISSIONAL. Não há nada a receber nem nada a pagar.
   *
   * Sem esta ordem, todo o trabalho em dinheiro aparecia em «por receber do
   * cliente» — a maior lista do ecrã a dizer que se perdeu dinheiro que nunca
   * devia ter passado por cá.
   */
  it("em dinheiro não há nada a receber nem nada a pagar", () => {
    expect(faseDoDinheiro({ formaDePagamento: "dinheiro" })).toBe("a_decorrer");
    expect(faseDoDinheiro({ formaDePagamento: "dinheiro", confirmadoEm: "2026-09-23" })).toBe(
      "fechado",
    );
  });

  it("e o mesmo quando foi alguém a registar que ele pagou ao profissional", () => {
    expect(faseDoDinheiro({ comoEntrou: "ao_profissional", confirmadoEm: "2026-09-23" })).toBe(
      "fechado",
    );
  });

  /*
   * É a mesma ordem de `carteiraDe`, e tem de ser: dois ecrãs a responder de
   * maneira diferente sobre o mesmo trabalho é pior do que um ecrã a menos.
   */
  it("concorda com a carteira sobre o que é dinheiro em mão", () => {
    const CARTEIRA = readFileSync(join(process.cwd(), "src/lib/carteira.ts"), "utf8");
    expect(CARTEIRA).toContain("if (foiPagoEmMao(t))");
    expect(pagouAoProfissional({ formaDePagamento: "dinheiro" })).toBe(true);
    // Coluna nula é «anterior a isto existir» = a forma de sempre, que passa
    // pela plataforma. Lê-la como dinheiro dava trabalhos por fechados à toa.
    expect(pagouAoProfissional({ formaDePagamento: null })).toBe(false);
    expect(pagouAoProfissional({ formaDePagamento: "na_plataforma" })).toBe(false);
  });
});

describe("como se chama o que entrou", () => {
  it("os dois do euPago e os três da mão", () => {
    expect(nomeDoRecebimento("multibanco")).toBe("Multibanco");
    expect(nomeDoRecebimento("mbway")).toBe("MB WAY");
    expect(nomeDoRecebimento("transferencia")).toBe("Transferência");
    expect(nomeDoRecebimento("numerario")).toBe("Numerário");
    expect(nomeDoRecebimento("ao_profissional")).toBe("Pago ao profissional");
  });

  /*
   * Isto lê uma coluna de texto que já tem linhas antigas lá dentro. Um método
   * que não se reconheça mostra-se como está — «undefined» ao lado de um valor
   * em euros é a maneira de alguém deixar de confiar no ecrã inteiro.
   */
  it("nunca devolve vazio nem «undefined»", () => {
    expect(nomeDoRecebimento(null)).toBe("—");
    expect(nomeDoRecebimento("")).toBe("—");
    expect(nomeDoRecebimento("  ")).toBe("—");
    expect(nomeDoRecebimento("payshop")).toBe("payshop");
  });

  it("só três se registam à mão — o euPago não se escreve à mão", () => {
    expect(RECEBIMENTOS_A_MAO).toEqual(["transferencia", "numerario", "ao_profissional"]);
    expect(eRecebimentoAMao("multibanco")).toBe(false);
    expect(eRecebimentoAMao("mbway")).toBe(false);
    expect(eRecebimentoAMao("transferencia")).toBe(true);
  });
});

/**
 * ⚠️ UM REGISTO AQUI DESBLOQUEIA DINHEIRO.
 *
 * Dizer «o cliente pagou» move o trabalho de «por cobrar» para «disponível» na
 * carteira do profissional — ou seja, autoriza uma transferência da conta da
 * CLYON. É a acção mais perigosa deste ecrã, e é por isso que estes testes
 * olham para a rota e não só para a regra.
 */
describe("registar um pagamento que não passou pelo euPago", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const semComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const ROTA = semComentarios(ler("src/app/api/admin/pagamentos/recebido/route.ts"));
  const BASE = semComentarios(ler("src/lib/pagamentos-na-base.ts"));

  it("é uma porta de administrador", () => {
    expect(ROTA).toContain("requireAdmin(req)");
  });

  /*
   * O método vem de uma lista fechada. Um método escrito à mão numa coluna de
   * texto é um relatório que nunca mais soma certo — e é também a porta por
   * onde entraria um «multibanco» falso, que se confundiria com um do euPago.
   */
  it("só aceita os três métodos da lista", () => {
    expect(ROTA).toContain("RECEBIMENTOS_A_MAO.includes(metodo)");
    expect(ROTA).toContain("status: 400");
  });

  /*
   * ⚠️ O VALOR NÃO VEM DO ECRÃ. Quem regista diz COMO entrou; QUANTO entrou
   * sai das taxas gravadas na negociação, que são as mesmas que o cliente viu.
   * Deixar escrever o valor era deixar a carteira do profissional depender de
   * quem tem pressa.
   */
  it("o valor sai da conta, e não do corpo do pedido", () => {
    expect(ROTA).toContain("contaDoCliente(Number(l.valorAcordado), taxasDaNegociacao(l)).total");
    expect(ROTA).not.toContain("corpo.valor");
  });

  it("só num trabalho fechado", () => {
    expect(ROTA).toContain('l.estado !== "acordada"');
  });

  /*
   * ⚠️ É O ÍNDICE ÚNICO QUE GARANTE QUE NÃO ENTRA DUAS VEZES, e não um `if`
   * antes. Dois cliques no mesmo botão, ou um registo à mão em cima de um
   * pagamento do euPago, batem na base e voltam com `duplicado`.
   */
  it("a base é que recusa o segundo, e a resposta diz que há valor a devolver", () => {
    const i = BASE.indexOf("export async function registarRecebimentoAMao");
    const corpo = BASE.slice(i, BASE.indexOf("export async function ultimosPagamentos", i));
    expect(i).toBeGreaterThan(-1);
    expect(corpo).toContain("CHAVE_REPETIDA");
    expect(corpo).toContain("duplicado: true");
    expect(BASE).toContain("UNIQUE KEY uq_uma_paga (negociacaoPaga)");
  });

  /*
   * As referências vivas deixam de fazer sentido: se o cliente já pagou por
   * outro caminho, o ecrã dele não pode continuar a oferecer uma Multibanco
   * aberta. É a mesma limpeza que `darPorPago` faz do outro lado.
   */
  it("fecha as referências que ficaram por pagar", () => {
    const i = BASE.indexOf("export async function registarRecebimentoAMao");
    const corpo = BASE.slice(i, BASE.indexOf("export async function ultimosPagamentos", i));
    expect(corpo).toContain("SET estado = 'substituido'");
  });

  it("fica escrito no histórico do pedido com o nome de quem o fez", () => {
    expect(ROTA).toContain("appendOrderHistory");
    expect(ler("src/app/api/admin/pagamentos/recebido/route.ts")).toContain(
      "é um registo à mão",
    );
  });

  /* NÃO PAGA NADA A NINGUÉM. Diz o que já aconteceu — quem paga é outro botão. */
  it("não toca no pagamento ao profissional", () => {
    expect(ROTA).not.toContain("pagoEm = NOW()");
    expect(ROTA).not.toContain("SET pagoEm");
  });
});

/**
 * A FERRAMENTA CHEGA-SE A UM CLIQUE.
 *
 * Estava dentro de Configurações, ao lado do livro de movimentos, com o
 * argumento de que «são as duas metades da mesma coisa». E são — mas uma
 * metade abre-se uma vez por mês para conferir, e a outra é trabalho de todos
 * os dias. Uma ferramenta de dinheiro atrás de um separador chamado «Configs»
 * não se usa.
 */
describe("os Pagamentos têm secção própria", () => {
  const ECRA = readFileSync(
    join(process.cwd(), "src/components/admin/LegacyAdminClient.tsx"),
    "utf8",
  );

  it("é uma secção, e está no menu da Plataforma", () => {
    expect(ECRA).toContain('activeSection === "pagamentos"');
    expect(ECRA).toContain('"carteiras", "pagamentos", "levantamentos"');
    expect(ECRA).toContain('pagamentos: "Pagamentos"');
  });

  /*
   * Montado UMA vez. Duas montagens do mesmo painel são dois ciclos de
   * actualização a bater na mesma rota de vinte em vinte segundos — e duas
   * listas de dinheiro que se contradizem enquanto uma delas não recarrega.
   */
  it("e só num sítio — dois painéis eram dois ciclos a bater na mesma rota", () => {
    const montagens = ECRA.match(/<AdminPagamentosPanel \/>/g) ?? [];
    expect(montagens.length).toBe(1);
  });
});

describe("as duas pontas, cada uma com a sua lista", () => {
  /*
   * «Separar os pagamentos entre os já recebidos, por receber, pagos ao pro e
   * por pagar aos pros.» — 25-09-2026. Cada trabalho responde às duas
   * perguntas, e aparece numa lista de cada lado.
   */
  it("ninguém pagou: por receber, e também por pagar", () => {
    expect(ladoDoCliente({})).toBe("por_receber");
    expect(ladoDoProfissional({})).toBe("por_pagar");
    expect(prontoAPagar({})).toBe(false);
  });

  it("recebido mas não confirmado: por pagar, e ainda não pronto", () => {
    const t = { clientePagouEm: "2026-09-22" };
    expect(ladoDoCliente(t)).toBe("recebido");
    expect(ladoDoProfissional(t)).toBe("por_pagar");
    expect(prontoAPagar(t)).toBe(false);
  });

  it("recebido e confirmado: pronto a pagar", () => {
    const t = { clientePagouEm: "2026-09-22", confirmadoEm: "2026-09-23" };
    expect(prontoAPagar(t)).toBe(true);
    expect(ladoDoProfissional({ ...t, pagoEm: "2026-09-24" })).toBe("pago");
  });

  /*
   * Pagar sem o dinheiro ter entrado é adiantar dinheiro da CLYON: um
   * trabalho confirmado mas por receber não está pronto a pagar.
   */
  it("confirmado mas por receber não se paga", () => {
    expect(prontoAPagar({ confirmadoEm: "2026-09-23" })).toBe(false);
  });

  it("em mão, os dois lados estão feitos — nada passou pela CLYON", () => {
    const t = { formaDePagamento: "dinheiro" };
    expect(ladoDoCliente(t)).toBe("recebido");
    expect(ladoDoProfissional(t)).toBe("pago");
    expect(prontoAPagar(t)).toBe(false);
  });
});

/**
 * «Tem pedidos que ainda não pagaram mas já pagámos os pros.» — 25-09-2026.
 *
 * O ecrã dos Pagamentos anota o que já aconteceu, e as duas pontas não andam
 * por ordem. A rota que marca o profissional como pago não pode exigir que o
 * cliente tenha pago nem confirmado — mas tem de o deixar escrito.
 */
describe("marcar o profissional como pago, sem esperar pelo cliente", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const semComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const ROTA = semComentarios(ler("src/app/api/admin/pagamentos/pago-ao-profissional/route.ts"));
  const PAINEL = semComentarios(ler("src/components/admin/AdminPagamentosPanel.tsx"));

  it("é uma porta de administrador", () => {
    expect(ROTA).toContain("requireAdmin(req)");
  });

  it("não exige confirmação — e não paga duas vezes", () => {
    const update = ROTA.slice(ROTA.indexOf("UPDATE negociacoes SET pagoEm"));
    expect(update).toContain("pagoEm IS NULL");
    expect(update.slice(0, 200)).not.toContain("confirmadoEm IS NOT NULL");
  });

  it("recusa o dinheiro em mão, e deixa escrito quando foi adiantado", () => {
    expect(ROTA).toContain('lerForma(l.formaDePagamento) === "dinheiro"');
    expect(ROTA).toContain("ADIANTADO");
    expect(ROTA).toContain("appendOrderHistory");
  });

  it("o painel usa esta rota, e pede confirmação antes", () => {
    expect(PAINEL).toContain("/api/admin/pagamentos/pago-ao-profissional");
    expect(PAINEL).toContain("window.confirm(");
  });
});
