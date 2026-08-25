import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Gerir tudo no site: as conversas do WhatsApp no painel.
 *
 * Com o Winapp reformado, o backoffice passa a ser o único posto de comando:
 * cada mensagem que entra ou sai fica registada (60 dias, como os pedidos),
 * o painel mostra o fio de cada número, dá para responder à mão — por cima
 * do interruptor e das entregas, porque aí quem fala é a pessoa — e as
 * fotografias dos clientes vão parar às fotos do pedido deles.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");
const CLOUD = ler("src/lib/whatsapp-cloud.ts");
const CEREBRO = ler("src/lib/whatsapp-negociacao.ts");
const WEBHOOK = ler("src/app/api/whatsapp/webhook/route.ts");
const ROTA_ADMIN = ler("src/app/api/admin/whatsapp/route.ts");
const PAINEL = ler("src/components/admin/AdminWhatsAppPanel.tsx");

describe("o registo das conversas", () => {
  it("tem tabela própria e limpa-se aos 60 dias, como os pedidos", () => {
    expect(DB).toContain("CREATE TABLE IF NOT EXISTS whatsappMensagens");
    expect(DB).toContain("INTERVAL 60 DAY");
  });

  it("tudo o que sai fica registado — nos dois envios e nas duas vias", () => {
    expect(CLOUD).toContain("registarSaida");
    // O caminho comum regista; os botões registam nas duas variantes.
    expect(CLOUD).toContain("if (saiu) await registarSaida(para, texto);");
    expect(CLOUD).toContain("[botões:");
  });

  it("tudo o que entra fica registado — texto, botão (pelo TÍTULO) e fotografia", () => {
    expect(WEBHOOK).toContain('registarMensagemWhatsApp(msg.from, "in", msg.text.body)');
    expect(WEBHOOK).toContain("[carregou:");
    expect(WEBHOOK).toContain('"[fotografia]"');
  });

  it("o registo nunca pode partir a mensagem — falha em silêncio", () => {
    expect(CLOUD).toContain("O registo nunca pode impedir a mensagem");
    expect(WEBHOOK).toContain(".catch(() => {})");
  });
});

describe("responder à mão pelo painel", () => {
  it("o envio manual passa por cima do portão — quem escreve é a pessoa", () => {
    expect(CLOUD).toContain("export async function enviarTextoManualWhatsApp");
    // O manual vai direto ao canal, sem o autorizadoAFalarCom.
    const manual = CLOUD.slice(
      CLOUD.indexOf("export async function enviarTextoManualWhatsApp"),
      CLOUD.indexOf("export async function enviarBotoesWhatsApp"),
    );
    expect(manual).not.toContain("autorizadoAFalarCom");
    expect(manual).toContain("enviarTextoPorCanal");
  });

  it("a rota do backoffice tem a acção responder e explica a janela de 24 horas", () => {
    expect(ROTA_ADMIN).toContain('accao === "responder"');
    expect(ROTA_ADMIN).toContain("enviarTextoManualWhatsApp");
    expect(ROTA_ADMIN).toContain("24 horas");
  });

  it("o painel mostra o fio e tem a caixa de resposta", () => {
    expect(PAINEL).toContain("Conversas");
    expect(PAINEL).toContain("abrirConversa");
    expect(PAINEL).toContain('accao: "responder"');
    expect(PAINEL).toContain("Responder como CLYON");
  });
});

describe("as fotografias dos clientes", () => {
  it("uma imagem no webhook segue para o pedido — Meta → Blob → filesJson", () => {
    expect(WEBHOOK).toContain("tratarFotoDoCliente");
    expect(CEREBRO).toContain("export async function tratarFotoDoCliente");
    expect(CEREBRO).toContain("graph.facebook.com/v21.0/${mediaId}");
    expect(CEREBRO).toContain("obterTokenDoBlob");
    expect(CEREBRO).toContain("filesJson");
    expect(CEREBRO).toContain("anexada ao pedido");
  });

  it("uma foto de um desconhecido não se guarda — não é nossa para guardar", () => {
    const foto = CEREBRO.slice(
      CEREBRO.indexOf("export async function tratarFotoDoCliente"),
      CEREBRO.indexOf("export async function aceitacaoParaOWhatsApp"),
    );
    expect(foto).toContain("if (pedidos.length === 0) return;");
    expect(foto).toContain("podeOWhatsAppFalarCom");
  });

  it("há tecto de tamanho — 10 MB chegam para qualquer fotografia", () => {
    expect(CEREBRO).toContain("10 * 1024 * 1024");
  });
});
