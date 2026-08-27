import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  camposDoPedido,
  notifyNewOrder,
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
  textoDoPedido,
  type NovoPedido,
} from "./whatsapp";

const PEDIDO: NovoPedido = {
  id: 42,
  contactName: "Ana Ferreira",
  serviceType: "recolha_moveis",
  city: "Almada",
  address: "Rua das Flores 3, Almada",
  estimateWithVat: "120.5",
  backofficeUrl: "https://clyon.pt/admin/pedidos/42",
};

/** Corpo JSON do último POST feito ao fetch trocado. */
function corpoEnviado(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

describe("whatsapp", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    process.env.WHATSAPP_TOKEN = "token-de-teste";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1264882616711421";
    process.env.WHATSAPP_TO_NUMBER = "351931632622";
    delete process.env.WHATSAPP_TEMPLATE_NOVO_PEDIDO;
    delete process.env.WHATSAPP_TEMPLATE_LINGUA;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("não chama a API quando as credenciais faltam", async () => {
    delete process.env.WHATSAPP_TOKEN;
    await sendWhatsAppMessage({ to: "351931632622", text: "olá" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envia texto livre no formato que a Graph API espera", async () => {
    await sendWhatsAppMessage({ to: "351931632622", text: "olá" });

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/1264882616711421/messages");
    expect(opts.headers.Authorization).toBe("Bearer token-de-teste");
    expect(corpoEnviado(fetchMock)).toMatchObject({
      messaging_product: "whatsapp",
      to: "351931632622",
      type: "text",
      text: { body: "olá" },
    });
  });

  it("envia template com os parâmetros na ordem do corpo", async () => {
    await sendWhatsAppTemplate({
      to: "351931632622",
      template: "novo_pedido",
      parametros: ["42", "Ana"],
    });

    expect(corpoEnviado(fetchMock)).toMatchObject({
      type: "template",
      template: {
        name: "novo_pedido",
        language: { code: "pt_PT" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "42" },
              { type: "text", text: "Ana" },
            ],
          },
        ],
      },
    });
  });

  it("omite os componentes quando o template não leva parâmetros", async () => {
    await sendWhatsAppTemplate({ to: "351931632622", template: "aviso" });
    expect(corpoEnviado(fetchMock).template.components).toBeUndefined();
  });

  it("respeita a língua configurada no ambiente", async () => {
    process.env.WHATSAPP_TEMPLATE_LINGUA = "pt_BR";
    await sendWhatsAppTemplate({ to: "351931632622", template: "aviso" });
    expect(corpoEnviado(fetchMock).template.language.code).toBe("pt_BR");
  });

  it("não relança quando a API devolve erro", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => "erro" });
    await expect(sendWhatsAppMessage({ to: "351", text: "olá" })).resolves.toBeUndefined();
  });

  it("não relança quando o fetch rebenta", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("rede em baixo"));
    await expect(sendWhatsAppMessage({ to: "351", text: "olá" })).resolves.toBeUndefined();
  });

  describe("campos do pedido", () => {
    it("traduz o serviço e formata o preço", () => {
      expect(camposDoPedido(PEDIDO)).toEqual([
        "42",
        "Ana Ferreira",
        "Recolha de móveis",
        "Almada",
        "≈ 120.50 € c/IVA",
      ]);
    });

    it("usa a primeira parte da morada quando não há cidade", () => {
      expect(camposDoPedido({ ...PEDIDO, city: null })[3]).toBe("Rua das Flores 3");
    });

    it("não deixa campos vazios sem preenchimento", () => {
      const vazio = camposDoPedido({
        ...PEDIDO,
        contactName: null,
        serviceType: null,
        city: null,
        address: null,
        estimateWithVat: null,
      });
      expect(vazio).toEqual(["42", "Não informado", "Não especificado", "Não informado", "Em análise"]);
    });

    // O template aprovado e o texto de fallback têm de contar a mesma história.
    it("o texto livre usa exactamente os mesmos valores do template", () => {
      const texto = textoDoPedido(PEDIDO);
      for (const campo of camposDoPedido(PEDIDO)) {
        expect(texto, campo).toContain(campo);
      }
      expect(texto).toContain(PEDIDO.backofficeUrl);
    });
  });

  describe("notifyNewOrder", () => {
    it("não envia nada sem número de destino", () => {
      delete process.env.WHATSAPP_TO_NUMBER;
      notifyNewOrder(PEDIDO);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("cai no texto livre quando não há template configurado", async () => {
      notifyNewOrder(PEDIDO);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(corpoEnviado(fetchMock).type).toBe("text");
    });

    it("usa o template quando está configurado", async () => {
      process.env.WHATSAPP_TEMPLATE_NOVO_PEDIDO = "novo_pedido_clyon";
      notifyNewOrder(PEDIDO);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

      const corpo = corpoEnviado(fetchMock);
      expect(corpo.type).toBe("template");
      expect(corpo.template.name).toBe("novo_pedido_clyon");
      expect(corpo.template.components[0].parameters).toHaveLength(5);
    });
  });
});
