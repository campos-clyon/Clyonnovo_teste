import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ENTIDADE_QUE_FACTURA, QUEM_FACTURA_EM_PALAVRAS } from "./identificacao-legal";
import { perguntaDo } from "./whatsapp-recolha";
import { mensagemDaReferencia } from "./mensagem-da-referencia";
import { STATUS_PUSH } from "./email-status";

/**
 * QUEM FACTURA E QUEM FAZ — duas frases que o produto dizia ao contrário.
 *
 * QUEM FACTURA. Desde 22-09-2026 a factura ao cliente é emitida pela Miragem
 * Dourada, empresa parceira da CLYON («vamos ignorar os pros»). Havia rodapés
 * de email e de ecrã a dizer que «quem executa o trabalho e emite a fatura é o
 * profissional», uma mensagem de referência a dizer «para lhe podermos passar
 * factura» como se fosse a CLYON, e um email aos profissionais a pôr a fatura
 * como requisito. Corrigido a 29-09-2026.
 *
 * QUEM FAZ. A CLYON é uma plataforma: quem faz o trabalho é o profissional
 * que o cliente escolhe. Os avisos de estado falavam como uma empresa que
 * executa — «a nossa equipa está a tratar do seu serviço».
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (t: string) =>
  t.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("a factura é da parceira, e diz-se assim", () => {
  it("a frase está escrita uma vez, com o nome que vem da constante", () => {
    expect(QUEM_FACTURA_EM_PALAVRAS).toBe(
      `A factura é emitida pela ${ENTIDADE_QUE_FACTURA.nomeCurto}, empresa parceira da CLYON.`,
    );
  });

  it("nenhum texto ao cliente ou ao profissional diz que é o profissional quem a emite", () => {
    for (const f of [
      "src/lib/email-pedido.ts",
      "src/lib/email-trabalho.ts",
      "src/app/pedido/[token]/VistaDoPedido.tsx",
      "src/app/profissionais/painel/PainelDoProfissional.tsx",
      "src/lib/como-funciona-para-o-profissional.ts",
    ]) {
      const codigo = semComentarios(ler(f));
      expect(codigo, f).not.toMatch(/emite a fatura é o profissional|fatura do serviço é sua/i);
    }
  });

  it("os rodapés dos emails e do pedido dizem quem a emite", () => {
    for (const f of [
      "src/lib/email-pedido.ts",
      "src/lib/email-trabalho.ts",
      "src/app/pedido/[token]/VistaDoPedido.tsx",
    ]) {
      expect(ler(f), f).toContain("QUEM_FACTURA_EM_PALAVRAS");
    }
  });

  it("a mensagem da referência já não diz que é a CLYON a passá-la", () => {
    const m = mensagemDaReferencia({
      pedidoId: 12,
      metodo: "multibanco",
      valor: 129.15,
      entidade: "12345",
      referencia: "123 456 789",
      comFactura: true,
    });
    expect(m).toContain(QUEM_FACTURA_EM_PALAVRAS);
    expect(m).toContain("23 % de IVA");
    expect(m).not.toContain("para lhe podermos passar factura");
  });

  it("no WhatsApp, a pergunta da factura diz quem a emite e quanto acresce", () => {
    const p = perguntaDo("fatura", {});
    expect(p).toContain("Precisa de factura com NIF?");
    expect(p).toContain(`emitida pela ${ENTIDADE_QUE_FACTURA.nomeCurto}, nossa parceira`);
    expect(p).toContain("acrescem 23 % de IVA");
    // E a repetição, quando a resposta não se percebe, também.
    expect(semComentarios(ler("src/lib/whatsapp-recolha.ts"))).toContain(
      "Responda sim ou não. ${SE_PEDIR_FACTURA}",
    );
  });

  it("o pedido do cliente já não tira nem põe avisos ao profissional", () => {
    // Nem «Precisa de: fatura» no email do pedido novo, nem a etiqueta
    // «emite fatura / não emite fatura» no cartão da proposta.
    expect(semComentarios(ler("src/lib/email-profissional.ts"))).not.toContain('"fatura"');
    const cartao = semComentarios(ler("src/app/pedido/[token]/PropostasRecebidas.tsx"));
    expect(cartao).not.toContain("emite fatura");
    expect(cartao).not.toContain("emiteFatura");
  });

  it("e o perfil do profissional já não diz que há clientes que só contratam quem a passa", () => {
    const perfil = semComentarios(ler("src/app/profissionais/painel/Perfil.tsx"));
    expect(perfil).not.toContain("Há clientes que só contratam quem passa fatura");
    expect(perfil).toContain("ENTIDADE_QUE_FACTURA.nomeCurto");
  });
});

describe("quem faz o trabalho é o profissional", () => {
  it("os avisos de estado não falam como uma empresa que executa", () => {
    const EMAIL = semComentarios(ler("src/lib/email-status.ts"));
    for (const frase of [
      "A nossa equipa está a tratar",
      "A nossa equipa está a analisar",
      "Entraremos em contacto",
      "Vamos avançar com o agendamento",
    ]) {
      expect(EMAIL, frase).not.toContain(frase);
    }
  });

  it("dizem o que cada estado quer dizer, do lado de quem o vive", () => {
    // O push sai das mesmas frases — é o mesmo aviso, noutro sítio.
    expect(STATUS_PUSH.em_analise.body).toBe(
      "Estamos a conferir o seu pedido antes de o enviar aos profissionais da sua zona.",
    );
    expect(STATUS_PUSH.confirmado.body).toBe(
      "O seu pedido está confirmado. O profissional combina os detalhes consigo.",
    );
    expect(STATUS_PUSH.em_curso.body).toBe("O profissional que escolheu está a tratar do seu serviço.");
    expect(STATUS_PUSH.em_execucao.body).toBe(STATUS_PUSH.em_curso.body);
  });

  it("e o tradutor do WhatsApp sabe que traduz para uma plataforma", () => {
    const t = ler("src/lib/traduzir-para-o-cliente.ts");
    expect(t).not.toContain("empresa portuguesa de mudanças e recolhas");
    expect(t).toContain("És o tradutor da CLYON, uma plataforma portuguesa que liga clientes a profissionais");
  });
});
