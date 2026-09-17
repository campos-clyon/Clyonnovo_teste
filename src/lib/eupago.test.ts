import { describe, it, expect } from "vitest";
import {
  BASE_DO_EUPAGO,
  DIAS_DE_PRAZO_DA_REFERENCIA,
  MAXIMO_POR_PAGAMENTO,
  MINIMO_MULTIBANCO,
  configuracaoDoEupago,
  corpoDoMbway,
  corpoDoMultibanco,
  dataParaOEupago,
  idDoIdentificador,
  identificadorDoPagamento,
  lerRespostaDoMbway,
  lerRespostaDoMultibanco,
  podeCobrar,
  porqueNaoPodeCobrar,
  quantoOClientePaga,
  recusaDoEupago,
  telemovelParaMbway,
} from "./eupago";
import { contaDoCliente, quantoOProfissionalRecebe } from "./taxas-plataforma";

/**
 * As duas APIs do euPago, provadas com as respostas que elas dão mesmo.
 *
 * Os corpos de resposta aqui são os documentados em <https://eupago.readme.io>,
 * lidos a 17-09-2026. Se um deles mudar, é aqui que se vê primeiro — e é aqui
 * que tem de se corrigir antes de se corrigir o código.
 */

const SANDBOX = { EUPAGO_API_KEY: "demo-1234", EUPAGO_AMBIENTE: "sandbox" };

function configDe(env: Record<string, string | undefined>) {
  const r = configuracaoDoEupago(env);
  if (!r.ok) throw new Error(r.falta);
  return r.config;
}

describe("configuração do euPago", () => {
  it("sem chave não há configuração, e diz qual falta", () => {
    const r = configuracaoDoEupago({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.falta).toContain("EUPAGO_API_KEY");
  });

  /*
   * O TESTE QUE MAIS IMPORTA DESTE FICHEIRO.
   *
   * Uma variável esquecida num deploy não pode cobrar ninguém a sério. Se
   * alguém inverter este valor por omissão, é aqui que rebenta.
   */
  it("sem ambiente escrito, é sandbox — nunca produção", () => {
    const c = configDe({ EUPAGO_API_KEY: "x" });
    expect(c.ambiente).toBe("sandbox");
    expect(c.base).toBe(BASE_DO_EUPAGO.sandbox);
  });

  it("um ambiente mal escrito é recusado, e não cai para produção", () => {
    const r = configuracaoDoEupago({ EUPAGO_API_KEY: "x", EUPAGO_AMBIENTE: "prod" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.falta).toContain("prod");
  });

  it("«producao» aponta para clientes.eupago.pt", () => {
    const c = configDe({ EUPAGO_API_KEY: "x", EUPAGO_AMBIENTE: "producao" });
    expect(c.base).toBe("https://clientes.eupago.pt");
  });

  it("as duas bases diferem só na palavra, como a documentação diz", () => {
    expect(BASE_DO_EUPAGO.sandbox.replace("sandbox", "clientes")).toBe(BASE_DO_EUPAGO.producao);
  });

  it("a chave vem sem espaços à volta", () => {
    expect(configDe({ EUPAGO_API_KEY: "  abc  " }).chave).toBe("abc");
  });
});

describe("a porta: quem pode ser cobrado", () => {
  it("em sandbox cobra-se sempre — não há dinheiro nenhum", () => {
    expect(podeCobrar(configDe(SANDBOX), false).pode).toBe(true);
  });

  /*
   * O cliente leu, em todos os ecrãs, que paga ao profissional no fim.
   * Cobrá-lo antes de o produto mudar de discurso é ficar-lhe com o dinheiro
   * depois de lhe termos escrito o contrário.
   */
  it("em produção, com a plataforma a não cobrar, a porta está fechada", () => {
    const r = podeCobrar(configDe({ EUPAGO_API_KEY: "x", EUPAGO_AMBIENTE: "producao" }), false);
    expect(r.pode).toBe(false);
    if (!r.pode) expect(r.porque).toContain("A_PLATAFORMA_COBRA");
  });

  it("em produção, com a plataforma a cobrar, abre", () => {
    const r = podeCobrar(configDe({ EUPAGO_API_KEY: "x", EUPAGO_AMBIENTE: "producao" }), true);
    expect(r.pode).toBe(true);
  });
});

describe("o telemóvel do MB WAY", () => {
  it("aceita as formas em que as pessoas escrevem o número", () => {
    for (const escrito of [
      "912345678",
      "+351912345678",
      "351912345678",
      "00351912345678",
      "+351 912 345 678",
      "912-345-678",
      " 912345678 ",
    ]) {
      expect(telemovelParaMbway(escrito), escrito).toEqual({
        countryCode: "+351",
        customerPhone: "912345678",
      });
    }
  });

  it("recusa o que não é um telemóvel português", () => {
    for (const mau of [
      null,
      undefined,
      "",
      "21 123 4567", // fixo
      "812345678", // não começa em 9
      "91234567", // oito dígitos
      "9123456789", // dez dígitos
      "não sei",
      "+34912345678", // Espanha: o 34 não é removido e sobram dígitos a mais
    ]) {
      expect(telemovelParaMbway(mau), String(mau)).toBeNull();
    }
  });

  /*
   * Um telemóvel inválido tem de parar AQUI e não na rede. O erro do euPago é
   * genérico, e o cliente ficava cinco minutos à espera de uma notificação que
   * nunca ia chegar.
   */
  it("sem telemóvel válido não se chega a construir o pedido", () => {
    expect(corpoDoMbway({ pagamentoId: 1, valor: 105, telemovel: "21 123 4567" })).toBeNull();
    expect(corpoDoMbway({ pagamentoId: 1, valor: 105 })).toBeNull();
  });
});

describe("que valores se podem cobrar", () => {
  it("aceita um valor normal nos dois meios", () => {
    expect(porqueNaoPodeCobrar("mbway", 105)).toBeNull();
    expect(porqueNaoPodeCobrar("multibanco", 105)).toBeNull();
  });

  it("recusa zero, negativos e o que não é número", () => {
    for (const v of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(porqueNaoPodeCobrar("mbway", v), String(v)).not.toBeNull();
    }
  });

  it("recusa mais de dois decimais — um terço de cêntimo não se paga", () => {
    expect(porqueNaoPodeCobrar("mbway", 105.005)).not.toBeNull();
    expect(porqueNaoPodeCobrar("mbway", 105.01)).toBeNull();
  });

  it("respeita os limites documentados: 99 999 € no topo, 1 € no Multibanco", () => {
    expect(porqueNaoPodeCobrar("mbway", MAXIMO_POR_PAGAMENTO)).toBeNull();
    expect(porqueNaoPodeCobrar("mbway", MAXIMO_POR_PAGAMENTO + 1)).not.toBeNull();
    expect(porqueNaoPodeCobrar("multibanco", MINIMO_MULTIBANCO)).toBeNull();
    expect(porqueNaoPodeCobrar("multibanco", 0.99)).not.toBeNull();
    // O MB WAY não tem mínimo documentado, e por isso não se lhe inventa um.
    expect(porqueNaoPodeCobrar("mbway", 0.99)).toBeNull();
  });
});

describe("o identificador, que é o fio que liga o aviso ao pagamento", () => {
  it("vai e volta", () => {
    for (const id of [1, 7, 312, 999_999]) {
      expect(idDoIdentificador(identificadorDoPagamento(id))).toBe(id);
    }
  });

  /*
   * O mesmo backoffice do euPago serve a App CLYON. Sem prefixo, um
   * identificador «312» de lá seria lido como um pagamento «312» daqui — e
   * daria um trabalho por pago com o dinheiro de outro produto.
   */
  it("o que não traz o nosso prefixo não é nosso", () => {
    for (const alheio of ["312", "app-clyon-312", "", null, undefined, "clyon-site-", "outro"]) {
      expect(idDoIdentificador(alheio), String(alheio)).toBeNull();
    }
  });

  it("um identificador nosso com lixo atrás não vira um id", () => {
    expect(idDoIdentificador("clyon-site-12a")).toBeNull();
    expect(idDoIdentificador("clyon-site--3")).toBeNull();
    expect(idDoIdentificador("clyon-site-1.5")).toBeNull();
    expect(idDoIdentificador("clyon-site-0")).toBeNull();
  });
});

describe("o corpo do pedido de MB WAY", () => {
  const corpo = corpoDoMbway({ pagamentoId: 312, valor: 105, telemovel: "912345678" })!;

  it("tem a forma aninhada que a API v1.02 exige", () => {
    expect(corpo).toEqual({
      payment: {
        identifier: "clyon-site-312",
        amount: { value: 105, currency: "EUR" },
        customerPhone: "912345678",
        countryCode: "+351",
      },
    });
  });

  /*
   * O euPago notifica o cliente por conta própria se lhe dermos o `customer`.
   * Mandar mensagens aos nossos clientes em nome de outra empresa é decisão do
   * dono, não um campo que se preenche por estar lá.
   */
  it("não leva dados do cliente — o euPago não fala com ele em nosso nome", () => {
    expect(Object.keys(corpo)).toEqual(["payment"]);
  });

  it("arredonda ao cêntimo o que lhe derem", () => {
    const c = corpoDoMbway({ pagamentoId: 1, valor: 105.004999, telemovel: "912345678" })!;
    expect(c.payment.amount.value).toBe(105);
  });
});

describe("o corpo da referência Multibanco", () => {
  it("é plano, em português, e leva a chave dentro", () => {
    expect(corpoDoMultibanco({ pagamentoId: 312, valor: 105 }, "K")).toEqual({
      chave: "K",
      valor: 105,
      id: "clyon-site-312",
      per_dup: 0,
    });
  });

  /*
   * `per_dup: 1` deixaria a mesma referência ser paga duas vezes — e o cliente
   * que a pagasse por engano pagava duas vezes o mesmo trabalho, com o segundo
   * pagamento a entrar na conta sem ter a quem pertencer.
   */
  it("per_dup é ZERO: a referência aceita um pagamento só", () => {
    expect(corpoDoMultibanco({ pagamentoId: 1, valor: 10 }, "K").per_dup).toBe(0);
  });

  it("leva prazo quando lhe dão um, no formato da data deles", () => {
    const c = corpoDoMultibanco(
      { pagamentoId: 1, valor: 10, prazo: new Date("2026-09-20T23:59:00Z") },
      "K",
    );
    expect(c.data_fim).toBe("2026-09-20");
  });

  it("sem prazo, não inventa o campo", () => {
    expect(corpoDoMultibanco({ pagamentoId: 1, valor: 10 }, "K").data_fim).toBeUndefined();
  });

  it("o prazo por omissão cobre um fim-de-semana inteiro", () => {
    expect(DIAS_DE_PRAZO_DA_REFERENCIA).toBeGreaterThanOrEqual(3);
  });

  it("a data sai sem hora", () => {
    expect(dataParaOEupago(new Date("2026-01-05T08:00:00Z"))).toBe("2026-01-05");
  });
});

describe("ler a resposta do MB WAY", () => {
  it("201 com referência é um pagamento pedido", () => {
    const r = lerRespostaDoMbway(201, {
      transactionStatus: "Success",
      transactionID: "abc-123",
      reference: "111222333",
    });
    expect(r).toEqual({ ok: true, referencia: "111222333", entidade: null, trid: "abc-123" });
  });

  /*
   * Um 201 sem referência não é «quase um pagamento»: é uma resposta que não
   * percebemos. Aceitá-la gravava um pagamento por onde ninguém pode pagar.
   */
  it("201 sem referência é recusa, não sucesso", () => {
    const r = lerRespostaDoMbway(201, { transactionStatus: "Success" });
    expect(r.ok).toBe(false);
  });

  it("401 é a chave errada, e o cliente não vê isso", () => {
    const r = lerRespostaDoMbway(401, {
      transactionStatus: "Failed",
      code: "-10",
      text: "Invalid API Key",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.recusa.paraNos).toContain("Chave de API");
      expect(r.recusa.paraOCliente).not.toMatch(/chave|key|api/i);
    }
  });

  it("um número que não tem MB WAY manda o cliente para o Multibanco", () => {
    const r = lerRespostaDoMbway(400, { code: "-12", text: "Alias is not valid" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.recusa.sugereOutroMetodo).toBe(true);
      expect(r.recusa.paraOCliente).toContain("Multibanco");
    }
  });
});

describe("ler a resposta do Multibanco", () => {
  it("estado 0 com referência e entidade é uma referência boa", () => {
    const r = lerRespostaDoMultibanco(200, {
      sucesso: true,
      estado: 0,
      resposta: "OK",
      referencia: "123456789",
      entidade: "12345",
      valor: "105.00",
    });
    expect(r).toEqual({ ok: true, referencia: "123456789", entidade: "12345", trid: null });
  });

  /*
   * ⚠️ O TESTE QUE JUSTIFICA O FICHEIRO TODO.
   *
   * A API antiga responde HTTP 200 a recusar. Quem olhar para o código de
   * estado da resposta grava uma referência vazia e mostra-a ao cliente.
   */
  it("HTTP 200 a recusar continua a ser recusa — o estado está no corpo", () => {
    const r = lerRespostaDoMultibanco(200, { sucesso: false, estado: -10, resposta: "Invalid API Key" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.recusa.codigo).toBe("-10");
  });

  it("uma referência sem entidade não é meia referência — é nenhuma", () => {
    expect(lerRespostaDoMultibanco(200, { estado: 0, referencia: "123456789" }).ok).toBe(false);
    expect(lerRespostaDoMultibanco(200, { estado: 0, entidade: "12345" }).ok).toBe(false);
  });

  it("um corpo sem campo estado não passa por sucesso", () => {
    expect(lerRespostaDoMultibanco(200, {}).ok).toBe(false);
    expect(lerRespostaDoMultibanco(200, null).ok).toBe(false);
    expect(lerRespostaDoMultibanco(500, "<html>erro</html>").ok).toBe(false);
  });

  it("aceita o estado como número ou como texto — o euPago manda os dois", () => {
    const comum = { referencia: "123456789", entidade: "12345" };
    expect(lerRespostaDoMultibanco(200, { ...comum, estado: 0 }).ok).toBe(true);
    expect(lerRespostaDoMultibanco(200, { ...comum, estado: "0" }).ok).toBe(true);
  });
});

describe("um código que não conhecemos nunca é sucesso", () => {
  it("recusa, e diz-nos que não o reconheceu", () => {
    const r = recusaDoEupago("-99", "Coisa nova");
    expect(r.paraNos).toContain("nao reconhecida");
    expect(r.paraOCliente).toBeTruthy();
  });

  it("nenhuma mensagem para o cliente denuncia a nossa configuração", () => {
    for (const codigo of ["-7", "-8", "-9", "-10", "-11", "-12", "-99", null]) {
      const r = recusaDoEupago(codigo, "seja o que for");
      expect(r.paraOCliente, String(codigo)).not.toMatch(/api|chave|key|token|segredo/i);
    }
  });
});

describe("o que se pede ao banco é o que o ecrã mostrou", () => {
  /*
   * ⚠️ O TESTE QUE PROTEGE O ÚLTIMO PASSO.
   *
   * Desde 17-09-2026 o ecrã do cliente mostra `semIva` como «a pagar», e o
   * `total` só na linha de quem quer factura. Um cliente que leu 105 e recebe
   * no telemóvel um pedido de 106,15 recusa-o — e tem razão em recusá-lo.
   *
   * Se alguém trocar isto, é aqui que rebenta antes de rebentar num MB WAY.
   */
  it("sem factura, é o `semIva` — o número grande do ecrã", () => {
    for (const acordado of [1, 100, 105.55, 300, 1287.31]) {
      for (const regime of ["isento", "normal"] as const) {
        expect(quantoOClientePaga(acordado, regime)).toBe(contaDoCliente(acordado, regime).semIva);
      }
    }
  });

  it("com factura, é o total com imposto — o número da linha de baixo", () => {
    for (const acordado of [1, 100, 105.55, 300, 1287.31]) {
      for (const regime of ["isento", "normal"] as const) {
        expect(quantoOClientePaga(acordado, regime, undefined, true)).toBe(
          contaDoCliente(acordado, regime).total,
        );
      }
    }
  });

  it("os dois números do exemplo do dono: 105,00 sem factura e 106,15 com", () => {
    expect(quantoOClientePaga(100, "isento")).toBe(105);
    expect(quantoOClientePaga(100, "isento", undefined, true)).toBe(106.15);
  });

  /*
   * ⚠️ OS «105 €» DO DONO SÃO SEM O IVA DA TAXA. O banco do cliente vê 106,15.
   *
   * *«se o pro e o cliente fechar um acordo de 100 euros a clyon vai cobrar
   * com a taxa 105»* — 16-09-2026. E está certo no que conta: a CLYON fica com
   * 11 € (105 − 94), que são os 11 % dos dois lados.
   *
   * Mas a decisão de 14-09-2026 — *«a CLYON vai assumir as facturas, então
   * vamos fazer valor mais taxa mais IVA»* — obriga a liquidar 23 % sobre a
   * taxa. São 1,15 € que a CLYON cobra e entrega ao Estado: não são receita,
   * e por isso os «11 %» continuam verdadeiros. Mas SAEM DA CONTA DO CLIENTE,
   * e é este o número que o MB WAY lhe vai pedir.
   *
   * Fica escrito num teste, e não num comentário, porque é a única forma de
   * alguém dar por isso antes de o ver no extracto.
   */
  it("100 € acordados com um isento: 105 sem factura, 106,15 com", () => {
    const c = contaDoCliente(100, "isento");
    expect(c.servico).toBe(100);
    expect(c.taxa).toBe(5);
    expect(c.ivaDoServico).toBe(0); // isento: não liquida imposto nenhum
    expect(c.ivaDaTaxa).toBe(1.15); // 23 % sobre os 5 € da CLYON
    expect(c.semIva).toBe(105);
    expect(c.total).toBe(106.15);

    // E a parte da CLYON continua a ser 11 € — o IVA é do Estado, não nosso.
    expect(c.semIva - quantoOProfissionalRecebe(100)).toBe(11);
  });
});
