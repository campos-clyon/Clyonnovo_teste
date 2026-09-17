import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  MARGEM_DE_CENTIMO,
  assinaturaValida,
  confereComOPedido,
  lerAvisoDoEupago,
  segredosDe,
  type AvisoDoEupago,
} from "./webhook-do-eupago";

/**
 * O webhook é a única forma de saber que alguém pagou — e é um endereço
 * público. Tudo o que está aqui é a diferença entre isso ser uma notificação
 * e ser um botão de «dar por pago» aberto ao mundo.
 */

const SEGREDO = "segredo-gerado-no-backoffice-do-eupago";

function assinar(corpo: string, segredo = SEGREDO): string {
  return crypto.createHmac("sha256", segredo).update(corpo, "utf8").digest("base64");
}

/** Um aviso como o euPago o manda, segundo a documentação de Webhooks 2.0. */
function avisoCru(sobrepor: Record<string, unknown> = {}) {
  return JSON.stringify({
    transactions: {
      entity: 12345,
      reference: 123456789,
      identifier: "clyon-site-312",
      method: "Mbway",
      amount: { value: 105, currency: "EUR" },
      fees: { value: 0.81, currency: "EUR" },
      date: "2026-09-17 14:32:05",
      trid: 987654,
      status: "Paid",
      ...sobrepor,
    },
    channel: { name: "CLYON" },
  });
}

describe("a assinatura do webhook", () => {
  const corpo = avisoCru();

  it("aceita a assinatura certa, em base64, do corpo cru", () => {
    expect(assinaturaValida(corpo, assinar(corpo), SEGREDO)).toBe(true);
  });

  /*
   * A documentação é um excerto de PHP, não uma especificação. As duas
   * codificações são do MESMO resumo: quem não tiver a chave não produz
   * nenhuma delas.
   */
  it("aceita também hexadecimal, porque é o mesmo resumo noutra roupa", () => {
    const hex = crypto.createHmac("sha256", SEGREDO).update(corpo, "utf8").digest("hex");
    expect(assinaturaValida(corpo, hex, SEGREDO)).toBe(true);
  });

  /*
   * ⚠️ O TESTE QUE IMPORTA. Um byte mexido no corpo — mudar o valor pago, o
   * identificador, o estado — tem de invalidar a assinatura.
   */
  it("um corpo alterado deixa de conferir", () => {
    const assinatura = assinar(corpo);
    const adulterado = corpo.replace('"value":105', '"value":5');
    expect(adulterado).not.toBe(corpo);
    expect(assinaturaValida(adulterado, assinatura, SEGREDO)).toBe(false);
  });

  it("assinado com outro segredo não passa", () => {
    expect(assinaturaValida(corpo, assinar(corpo, "outro"), SEGREDO)).toBe(false);
  });

  /*
   * SEM SEGREDO CONFIGURADO, NADA PASSA — e é o contrário do que um `if`
   * distraído faz. «Se não há segredo, não verifico» é a porta aberta: bastava
   * a variável faltar num deploy para o endereço aceitar tudo.
   */
  it("sem segredo configurado recusa — não deixa passar por não saber verificar", () => {
    expect(assinaturaValida(corpo, assinar(corpo), null)).toBe(false);
    expect(assinaturaValida(corpo, assinar(corpo), "")).toBe(false);
    expect(assinaturaValida(corpo, assinar(corpo), undefined)).toBe(false);
  });

  it("sem cabeçalho recusa", () => {
    for (const mau of [null, undefined, "", "   "]) {
      expect(assinaturaValida(corpo, mau, SEGREDO), String(mau)).toBe(false);
    }
  });

  it("lixo no cabeçalho recusa em vez de rebentar", () => {
    for (const mau of ["não é base64 %%%", "sha256=abc", "0".repeat(1000), "=="]) {
      expect(assinaturaValida(corpo, mau, SEGREDO), mau.slice(0, 20)).toBe(false);
    }
  });

  it("uma assinatura do tamanho errado recusa", () => {
    // Metade de um resumo bom continua a ser metade.
    const metade = Buffer.from(assinar(corpo), "base64").subarray(0, 16).toString("base64");
    expect(assinaturaValida(corpo, metade, SEGREDO)).toBe(false);
  });

  /*
   * Assina-se o CORPO CRU, e não o JSON reserializado: dois JSON iguais podem
   * ter bytes diferentes — espaços, ordem das chaves, acentos escapados.
   */
  it("o mesmo JSON com outro espaçamento tem outra assinatura", () => {
    const outro = JSON.stringify(JSON.parse(corpo), null, 2);
    expect(assinaturaValida(outro, assinar(corpo), SEGREDO)).toBe(false);
    expect(assinaturaValida(outro, assinar(outro), SEGREDO)).toBe(true);
  });

  it("compara em tempo constante", () => {
    // Guarda de código-fonte: a comparação byte a byte com saída antecipada
    // deixa medir quantos bytes se acertaram.
    expect(assinaturaValida.toString()).toContain("timingSafeEqual");
  });
});

describe("ler o aviso", () => {
  function lido(cru: string): AvisoDoEupago {
    const r = lerAvisoDoEupago(JSON.parse(cru));
    if (!r.ok) throw new Error(r.porque);
    return r.aviso;
  }

  it("tira do corpo tudo o que é preciso para conciliar", () => {
    const a = lido(avisoCru());
    expect(a.trid).toBe("987654");
    expect(a.pagamentoId).toBe(312);
    expect(a.estado).toBe("pago");
    expect(a.valor).toBe(105);
    expect(a.moeda).toBe("EUR");
    expect(a.comissao).toBe(0.81);
    expect(a.metodo).toBe("Mbway");
    expect(a.entidade).toBe("12345");
    expect(a.referencia).toBe("123456789");
    expect(a.quando?.toISOString()).toBe("2026-09-17T14:32:05.000Z");
  });

  it("conhece os cinco estados, nas duas grafias do euPago", () => {
    const esperado = {
      Paid: "pago",
      PAID: "pago",
      Refund: "reembolsado",
      REFUNDED: "reembolsado",
      Error: "erro",
      ERROR: "erro",
      Cancel: "cancelado",
      CANCELED: "cancelado",
      Expired: "expirado",
      EXPIRED: "expirado",
    } as const;
    for (const [veio, nosso] of Object.entries(esperado)) {
      expect(lido(avisoCru({ status: veio })).estado, veio).toBe(nosso);
    }
  });

  /*
   * Um estado que não conhecemos NÃO é «pago». E não se manda repetir: o
   * euPago ia mandar exactamente o mesmo 24 horas seguidas.
   */
  it("um estado desconhecido não passa por pago, e não pede repetição", () => {
    const r = lerAvisoDoEupago(JSON.parse(avisoCru({ status: "Something" })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retentar).toBe(false);
  });

  /*
   * O `trid` é a chave única na base que faz um aviso repetido não contar
   * duas vezes. Sem ele não há idempotência, e sem idempotência não se
   * credita nada — num sítio onde a repetição é garantida por desenho.
   */
  it("sem trid não se aceita nada — é ele a defesa contra a repetição", () => {
    for (const sem of [{ trid: null }, { trid: "" }, { trid: undefined }]) {
      const r = lerAvisoDoEupago(JSON.parse(avisoCru(sem)));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.retentar).toBe(true);
    }
  });

  /*
   * Se alguém ligar «Encriptar Webhook» no backoffice, os avisos passam a vir
   * só com `data`. Responder 200 a isso perdia todos os pagamentos em
   * silêncio até alguém reparar. A 500, o euPago insiste 24 horas e manda o
   * aviso de erro por email.
   */
  it("um aviso encriptado manda repetir, e diz onde se desliga", () => {
    const r = lerAvisoDoEupago({ data: "U2FsdGVkX1+abc…", channel: { name: "CLYON" } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.retentar).toBe(true);
      expect(r.porque).toContain("Encriptar Webhook");
    }
  });

  it("um corpo sem transacção manda repetir", () => {
    for (const vazio of [{}, { transactions: null }, { transactions: "texto" }, null]) {
      const r = lerAvisoDoEupago(vazio);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.retentar).toBe(true);
    }
  });

  it("lê a transacção venha ela como objecto ou dentro de uma lista", () => {
    const uma = JSON.parse(avisoCru()) as { transactions: unknown };
    const emLista = lerAvisoDoEupago({ transactions: [uma.transactions] });
    expect(emLista.ok).toBe(true);
    if (emLista.ok) expect(emLista.aviso.trid).toBe("987654");
  });

  it("um identificador que não é nosso dá pagamento nenhum", () => {
    expect(lido(avisoCru({ identifier: "loja-online-99" })).pagamentoId).toBeNull();
    expect(lido(avisoCru({ identifier: null })).pagamentoId).toBeNull();
  });

  it("aceita o valor como texto com vírgula, que é como o Multibanco o manda", () => {
    expect(lido(avisoCru({ amount: "105,00" })).valor).toBe(105);
    expect(lido(avisoCru({ amount: 105 })).valor).toBe(105);
  });

  it("uma data que não se percebe fica nula em vez de dar uma data inventada", () => {
    expect(lido(avisoCru({ date: "não é uma data" })).quando).toBeNull();
    expect(lido(avisoCru({ date: null })).quando).toBeNull();
  });
});

describe("o aviso bate certo com o que pedimos?", () => {
  const pedido = { pagamentoId: 312, valor: 105 };
  function aviso(sobrepor: Partial<AvisoDoEupago> = {}): AvisoDoEupago {
    const r = lerAvisoDoEupago(JSON.parse(avisoCru()));
    if (!r.ok) throw new Error(r.porque);
    return { ...r.aviso, ...sobrepor };
  }

  it("o aviso certo passa", () => {
    expect(confereComOPedido(aviso(), pedido)).toBeNull();
  });

  /*
   * ⚠️ O CASO MAIS TRAIÇOEIRO DE TODOS, e o único que uma assinatura válida
   * não apanha: um aviso legítimo com um valor que não é o nosso. Dar por pago
   * um trabalho de 105 € com um aviso de 5 € é perder 100 € e ainda mandar o
   * profissional trabalhar.
   */
  it("um valor a menos não é um pagamento", () => {
    expect(confereComOPedido(aviso({ valor: 5 }), pedido)).toContain("5.00");
    expect(confereComOPedido(aviso({ valor: 104.5 }), pedido)).not.toBeNull();
  });

  it("um valor a mais também não passa — não é nosso e não se fica com ele", () => {
    expect(confereComOPedido(aviso({ valor: 200 }), pedido)).not.toBeNull();
  });

  it("um cêntimo de vírgula flutuante não parte o pagamento", () => {
    expect(confereComOPedido(aviso({ valor: 104.999999 }), pedido)).toBeNull();
    expect(confereComOPedido(aviso({ valor: 105 + MARGEM_DE_CENTIMO / 2 }), pedido)).toBeNull();
    // Dois cêntimos já é outro valor.
    expect(confereComOPedido(aviso({ valor: 105.02 }), pedido)).not.toBeNull();
  });

  it("um aviso de outro pagamento não conta para este", () => {
    expect(confereComOPedido(aviso({ pagamentoId: 313 }), pedido)).not.toBeNull();
    expect(confereComOPedido(aviso({ pagamentoId: null }), pedido)).not.toBeNull();
  });

  it("noutra moeda não conta", () => {
    expect(confereComOPedido(aviso({ moeda: "USD" }), pedido)).toContain("USD");
  });

  it("um aviso que não diz quanto foi pago não dá nada por pago", () => {
    expect(confereComOPedido(aviso({ valor: null }), pedido)).not.toBeNull();
  });
});

/**
 * OS DOIS SEGREDOS — 17-09-2026.
 *
 * A sandbox e a produção do euPago são contas separadas, cada uma com o seu
 * canal e a sua chave criptográfica. Com uma variável a guardar um segredo só,
 * trocar de ambiente obrigava a acertar três variáveis ao mesmo tempo — e a que
 * se esquece é sempre esta, porque é a única cujo esquecimento não dá erro à
 * frente de ninguém: dá 401 a avisos que chegam de madrugada.
 */
describe("dois segredos ao mesmo tempo — sandbox e produção", () => {
  const corpo = avisoCru();
  const DOIS = `${SEGREDO}, segredo-da-producao`;

  it("aceita o primeiro", () => {
    expect(assinaturaValida(corpo, assinar(corpo, SEGREDO), DOIS)).toBe(true);
  });

  it("aceita o segundo", () => {
    expect(assinaturaValida(corpo, assinar(corpo, "segredo-da-producao"), DOIS)).toBe(true);
  });

  /*
   * Aceitar dois assinantes legítimos não é o mesmo que aceitar mais um
   * qualquer. Se isto passasse, a lista teria deixado de ser uma lista de
   * segredos e passado a ser uma porta aberta.
   */
  it("continua a recusar um terceiro", () => {
    expect(assinaturaValida(corpo, assinar(corpo, "outro qualquer"), DOIS)).toBe(false);
  });

  it("espaços à volta não contam, e uma vírgula solta não abre nada", () => {
    expect(assinaturaValida(corpo, assinar(corpo, SEGREDO), `  ${SEGREDO}  ,  `)).toBe(true);
    expect(assinaturaValida(corpo, assinar(corpo, ""), ",,,")).toBe(false);
    expect(segredosDe(",,,")).toEqual([]);
  });

  it("um segredo sozinho continua a funcionar como sempre", () => {
    expect(assinaturaValida(corpo, assinar(corpo), SEGREDO)).toBe(true);
    expect(segredosDe(SEGREDO)).toEqual([SEGREDO]);
  });
});
