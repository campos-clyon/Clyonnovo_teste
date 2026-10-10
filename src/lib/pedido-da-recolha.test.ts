import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { camposDaRecolha } from "./pedido-da-recolha";

/**
 * CRIAR O PEDIDO A PARTIR DA CONVERSA DE WHATSAPP — 07-10-2026.
 *
 * «Queria já poder criar esse pedido.» O assistente tinha tudo recolhido e
 * esperava pelo SIM do cliente; o backoffice não tinha como o aproveitar.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
// Só os comentários que começam a linha — os que vêm depois de código ficam.
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("o rascunho do assistente nos campos do formulário", () => {
  it("a conversa da captura: recolha de móveis em Lisboa, 3.º andar sem elevador", () => {
    const c = camposDaRecolha("85366883757", {
      serviceType: "recolha_moveis",
      contactName: "seria estes armarios e bancada + 1 lavatorio e 1 sanita",
      address: "rua de s sebastiao pedreira, 88 3 andar",
      postalCode: "1050-208",
      city: "Lisboa",
      floor: "3",
      hasElevator: "no",
      parkingDistance: "near",
      quandoTexto: "qual o mais rapido que conseguem?",
      urgency: "this_week",
      description: "seria estes armarios de madeira, a bancada, lavatorio e lavaloiça",
      precisaFatura: true,
    });
    expect(c).toEqual({
      contactPhone: "85366883757",
      serviceType: "recolha_moveis",
      // Vem como o assistente o percebeu — é no formulário que se corrige.
      contactName: "seria estes armarios e bancada + 1 lavatorio e 1 sanita",
      address: "rua de s sebastiao pedreira, 88 3 andar",
      postalCode: "1050-208",
      city: "Lisboa",
      floor: "3",
      hasElevator: "no",
      // O assistente diz «near»; o formulário diz «easy».
      parkingDistance: "easy",
      urgency: "this_week",
      // Sem data, o que ele disse sobre o dia vai para a descrição.
      description:
        "seria estes armarios de madeira, a bancada, lavatorio e lavaloiça\n" +
        "Quando (dito pelo cliente): qual o mais rapido que conseguem?",
      precisaFatura: true,
    });
  });

  it("a data vai para o campo em hora de Lisboa, e então o «quando» dito não se repete", () => {
    const c = camposDaRecolha("912345678", {
      dataDesejada: "2026-10-09T08:00:00.000Z",
      quandoTexto: "quinta de manhã",
      description: "um sofá",
    });
    expect(c.dataDesejada).toBe("2026-10-09T09:00");
    expect(c.description).toBe("um sofá");
  });

  it("o r/c e a cave escrevem-se como se dizem; o longe vira «difficult»", () => {
    expect(camposDaRecolha("1", { floor: "0" }).floor).toBe("r/c");
    expect(camposDaRecolha("1", { floor: "-1" }).floor).toBe("cave");
    expect(camposDaRecolha("1", { parkingDistance: "far" }).parkingDistance).toBe("difficult");
  });

  it("sem rascunho, só o telefone — e nada inventado", () => {
    expect(camposDaRecolha("912345678", null)).toEqual({ contactPhone: "912345678" });
    expect(camposDaRecolha("912345678", { hasElevator: "talvez", contactName: "  " })).toEqual({
      contactPhone: "912345678",
    });
  });
});

describe("o caminho até ao pedido", () => {
  it("o painel do WhatsApp tem o botão, e abre o formulário com o rascunho da conversa", () => {
    const P = semNotas(ler("src/components/admin/AdminWhatsAppPanel.tsx"));
    expect(P).toContain('{recolhaAberta?.pedidoId != null ? "Criar outro pedido" : "Criar pedido"}');
    expect(P).toContain("recolhaWhatsApp={l.telefone}");
    expect(P).toContain("camposDaRecolha(");
    expect(P).toContain("setRecolhaAberta(res.ok ? (dados.recolha ?? null) : null);");
    // A rota que abre a conversa devolve também o rascunho.
    expect(semNotas(ler("src/app/api/admin/whatsapp/route.ts"))).toContain("return NextResponse.json({ mensagens, recolha });");
  });

  it("o formulário abre preenchido e manda o telefone da conversa à rota", () => {
    const R = semNotas(ler("src/components/admin/RegistarPedido.tsx"));
    expect(R).toContain("useState(editarId != null || inicial != null)");
    expect(R).toContain("...inicial,");
    expect(R).toContain("...(recolhaWhatsApp ? { recolhaWhatsApp } : {})");
  });

  it("a rota liga a recolha ao pedido e avisa o cliente pelo portão de sempre", () => {
    const C = semNotas(ler("src/app/api/admin/pedidos/criar/route.ts"));
    const i = C.indexOf("const daConversa = texto(corpo.recolhaWhatsApp, 40);");
    expect(i).toBeGreaterThan(-1);
    const bloco = C.slice(i, i + 1200);
    expect(bloco).toContain("await ligarRecolhaWhatsAppAoPedido(daConversa, id);");
    // E com as fotografias que ele mandou na conversa antes de haver pedido (10-10-2026).
    expect(bloco).toContain("await anexarFotosPendentesAoPedido(daConversa, id)");
    expect(bloco).toContain("mensagemDePedidoRegistado(id, fotos.length > 0 || daConversaFotos > 0)");
    // A ligação vem antes da mensagem: um SIM que chegue no meio já não regista outro.
    expect(bloco.indexOf("ligarRecolhaWhatsAppAoPedido")).toBeLessThan(bloco.indexOf("enviarTextoWhatsApp"));
    expect(C).toContain("avisoAoCliente,");
  });

  it("e a base liga a recolha que houver, ou cria a linha com o pedido", () => {
    const D = ler("src/lib/db.ts");
    const i = D.indexOf("export async function ligarRecolhaWhatsAppAoPedido(");
    const corpo = D.slice(i, D.indexOf("\n}\n", i));
    expect(corpo).toContain("UPDATE whatsappRecolhas SET pedidoId = ? WHERE RIGHT(telefone, 9) = RIGHT(?, 9)");
    expect(corpo).toContain("INSERT INTO whatsappRecolhas (telefone, passo, dadosJson, pedidoId)");
    // É este pedidoId que o cérebro lê para tratar quem escreve como quem já tem pedido.
    expect(ler("src/lib/whatsapp-negociacao.ts")).toContain("const pedidoDaConversa = guardada?.pedidoId ?? null;");
  });
});
