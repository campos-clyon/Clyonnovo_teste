import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mensagemDeAdjudicacao } from "./mensagem-de-adjudicacao";

/**
 * AS MESMAS MENSAGENS NAS NEGOCIAÇÕES — 23-10-2026. *«As negociações, as mesmas
 * opções de enviar mensagem no WhatsApp para o cliente: enviar a proposta,
 * enviar pela CLYON, e o outro, para enviar depois de já ter contratado o
 * profissional — os dados do profissional, a mensagem com o modo de pagamento,
 * e que o profissional vai entrar em contacto com ele em breve.»* — o dono.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const M = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const R = ler("src/app/api/admin/negociacoes/route.ts");

describe("na Mesa, as negociações", () => {
  it("«Enviar pela CLYON», com o mesmo texto do «Enviar orçamento»", () => {
    expect(M).toContain("Enviar pela CLYON");
    expect(M).toContain('accao: "enviar_pela_clyon",');
    expect(M).toContain("texto: textoDoOrcamento(p),");
    expect(M).toContain("const texto = textoDoOrcamento(p, propostas);");
  });

  it("a rota envia para o telefone do pedido, lido na base, e diz porque não saiu", () => {
    const corpo = R.slice(R.indexOf('if (corpo.accao === "enviar_pela_clyon") {'));
    expect(corpo).toContain("const pedido = await getSimulatorOrderById(pedidoId);");
    expect(corpo).toContain("const telefone = String(pedido.contactPhone ?? \"\");");
    expect(corpo).toContain("if (await numeroBloqueadoWhatsApp(telefone)) {");
    expect(corpo).toContain("const saiu = await enviarTextoManualWhatsApp(telefone, texto);");
    expect(corpo).toContain("24 horas");
  });

  it("a adjudicação, depois de contratado e antes de confirmado", () => {
    expect(M).toContain("if (!acordada || acordada.confirmadoEm || cancelado) return null;");
    expect(M).toContain("empresa: acordada.profissionalNome,");
    // O botão com as formas de pagamento (27-10-2026, d14) — ver EnviarAdjudicacao.tsx.
    expect(M).toContain("<EnviarAdjudicacao");
    expect(ler("src/components/admin/EnviarAdjudicacao.tsx")).toContain("Enviar adjudicação ao cliente");
    expect(ler("src/lib/db.ts")).toContain("p.phone AS profissionalTelefone, p.responsavel AS profissionalResponsavel,");
  });

  it("a mensagem diz quem faz, o contacto e os métodos de pagamento", () => {
    const m = mensagemDeAdjudicacao(
      { cliente: "Aaron Pinhal", quando: null, servico: "recolha_monos", localidade: "Lisboa", empresa: "Revolution", responsavel: "Rui", telefoneDaEmpresa: "912345678" },
      new Date("2026-10-23T10:00:00Z"),
    );
    expect(m).toContain("O trabalho fica a cargo da empresa Revolution.");
    expect(m).toContain("O Rui, responsável da Revolution, vai entrar em contacto consigo o mais breve possível");
    // Os métodos vêm das Configs (27-10-2026); sem eles, os dados seguem a seguir.
    expect(m).toContain("Enviamos-lhe os dados para o pagamento a seguir.");
  });
});
