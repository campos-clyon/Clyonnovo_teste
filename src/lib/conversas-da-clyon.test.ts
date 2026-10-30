import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chaveDeLeitura,
  conversaParaApagar,
  idDaConversa,
  pertenceAConversa,
  podeEscrever,
  prepararMensagem,
  rotuloDoAutor,
  vistaDaConversa,
  vistaDaMensagem,
  type Conversa,
  type ConversaParaAPurga,
  type MensagemGuardada,
} from "./conversas-da-clyon";
import { CONTACTO_ESCONDIDO } from "./filtro-de-contactos";
import { DIAS_DAS_CONVERSAS_DE_SUPORTE, MESES_DAS_CONVERSAS_DE_PEDIDO } from "./retencao";
import { lerMensagemNova } from "./conversa-com-a-clyon";

/** «Conversas» da CLYON, fase 1 (30-10-2026). */

const base: Conversa = {
  id: 7,
  tipo: "suporte_cliente",
  pedidoId: null,
  negociacaoId: null,
  clienteContaId: 10,
  profissionalId: null,
  estado: "aberta",
  atendidaPor: "vitoria",
  criadaEm: "2026-10-30T10:00:00Z",
  ultimaMensagemEm: null,
};
const pedido: Conversa = { ...base, id: 8, tipo: "pedido", pedidoId: 483, negociacaoId: 5, profissionalId: 3 };

describe("quem pertence à conversa", () => {
  it("o cliente só a dele", () => {
    expect(pertenceAConversa(base, { papel: "cliente", contaId: 10 })).toBe(true);
    expect(pertenceAConversa(base, { papel: "cliente", contaId: 11 })).toBe(false);
    expect(pertenceAConversa(pedido, { papel: "cliente", contaId: 10 })).toBe(true);
  });

  it("o parceiro só a do pedido em que está, e nunca o suporte de um cliente", () => {
    expect(pertenceAConversa(pedido, { papel: "profissional", providerId: 3 })).toBe(true);
    expect(pertenceAConversa(pedido, { papel: "profissional", providerId: 4 })).toBe(false);
    expect(pertenceAConversa({ ...base, profissionalId: 3 }, { papel: "profissional", providerId: 3 })).toBe(false);
  });

  it("um cliente não abre o suporte de um parceiro, mesmo com o mesmo número", () => {
    const sp: Conversa = { ...base, tipo: "suporte_profissional", clienteContaId: 3, profissionalId: 3 };
    expect(pertenceAConversa(sp, { papel: "cliente", contaId: 3 })).toBe(false);
    expect(pertenceAConversa(sp, { papel: "profissional", providerId: 3 })).toBe(true);
  });

  it("sem conta, ou id 0, ninguém pertence", () => {
    expect(pertenceAConversa({ ...base, clienteContaId: null }, { papel: "cliente", contaId: 10 })).toBe(false);
    expect(pertenceAConversa({ ...base, clienteContaId: 0 }, { papel: "cliente", contaId: 0 })).toBe(false);
  });

  it("só se escreve numa conversa aberta", () => {
    expect(podeEscrever(base)).toBe(true);
    expect(podeEscrever({ estado: "so_leitura" })).toBe(false);
    expect(podeEscrever({ estado: "fechada" })).toBe(false);
  });

  it("o n.º da conversa só de dígitos", () => {
    expect(idDaConversa("12")).toBe(12);
    expect(idDaConversa("0")).toBeNull();
    expect(idDaConversa("1 OR 1=1")).toBeNull();
    expect(idDaConversa(undefined)).toBeNull();
  });

  it("as chaves de leitura não se confundem", () => {
    expect(chaveDeLeitura({ papel: "cliente", contaId: 3 })).toBe("cliente:3");
    expect(chaveDeLeitura({ papel: "profissional", providerId: 3 })).toBe("profissional:3");
    expect(chaveDeLeitura("equipa")).toBe("equipa");
  });
});

describe("o filtro nas conversas de pedido (2a)", () => {
  it("tapa no pedido e guarda o original", () => {
    const r = prepararMensagem(pedido, { texto: "ligue 912 345 678", anexoUrl: null });
    expect(r.texto).toContain(CONTACTO_ESCONDIDO);
    expect(r.filtrada).toBe(true);
    expect(r.textoOriginal).toBe("ligue 912 345 678");
  });

  it("no suporte não tapa (é à CLYON que se escreve)", () => {
    const r = prepararMensagem(base, { texto: "o meu é 912 345 678", anexoUrl: null });
    expect(r.filtrada).toBe(false);
    expect(r.textoOriginal).toBeNull();
  });

  it("a mensagem lê-se pela regra da R14", () => {
    expect(lerMensagemNova({ texto: "  " }).ok).toBe(false);
    expect(lerMensagemNova({ texto: "x".repeat(2001) }).ok).toBe(false);
    expect(lerMensagemNova({ texto: "olá", anexoUrl: "https://mal.example.com/x.jpg" }).ok).toBe(false);
    expect(lerMensagemNova({ mensagem: "olá" })).toEqual({ ok: true, texto: "olá", anexoUrl: null });
  });
});

describe("o que sai para o outro lado", () => {
  const m: MensagemGuardada = {
    id: 1,
    conversaId: 8,
    autor: "profissional",
    autorId: 3,
    texto: `ligue ${CONTACTO_ESCONDIDO}`,
    textoOriginal: "ligue 912345678",
    filtrada: true,
    anexoUrl: null,
    criadaEm: "2026-10-30T10:00:00Z",
  };

  it("nunca o original nem o id de quem escreveu", () => {
    const v = vistaDaMensagem(m, { papel: "cliente", contaId: 10 });
    expect(JSON.stringify(v)).not.toContain("912345678");
    expect(v).not.toHaveProperty("textoOriginal");
    expect(v).not.toHaveProperty("autorId");
    expect(v.rotulo).toBe("Parceiro");
    expect(v.minha).toBe(false);
  });

  it("a equipa aparece como «Equipa CLYON», nunca pelo nome", () => {
    expect(rotuloDoAutor("equipa", "cliente")).toBe("Equipa CLYON");
    expect(vistaDaMensagem({ ...m, autor: "equipa", autorId: 42 }, { papel: "cliente", contaId: 10 })).not.toHaveProperty(
      "autorId",
    );
  });

  it("a conversa sai sem as contas de quem está do outro lado", () => {
    const v = vistaDaConversa(pedido);
    expect(v).not.toHaveProperty("clienteContaId");
    expect(v).not.toHaveProperty("profissionalId");
    expect(v.titulo).toBe("Pedido #483");
    expect(vistaDaConversa(base).titulo).toBe("Suporte CLYON");
  });
});

describe("a purga das conversas (3b): o que apaga e o que NÃO apaga", () => {
  const prazos = { mesesDoPedido: MESES_DAS_CONVERSAS_DE_PEDIDO, diasDoSuporte: DIAS_DAS_CONVERSAS_DE_SUPORTE };
  const c = (x: Partial<ConversaParaAPurga>): ConversaParaAPurga => ({
    id: 1,
    tipo: "pedido",
    estado: "fechada",
    pedidoExiste: true,
    diasSemMensagens: 0,
    mesesDesdeQueFechou: 0,
    ...x,
  });

  it("os prazos são os do dono", () => {
    expect(MESES_DAS_CONVERSAS_DE_PEDIDO).toBe(6);
    expect(DIAS_DAS_CONVERSAS_DE_SUPORTE).toBe(90);
  });

  it("APAGA: pedido fechado há 6 meses ou mais", () => {
    expect(conversaParaApagar(c({ mesesDesdeQueFechou: 6, diasSemMensagens: 190 }), prazos)).toBe(true);
    expect(conversaParaApagar(c({ estado: "so_leitura", mesesDesdeQueFechou: 9 }), prazos)).toBe(true);
  });

  it("APAGA: pedido que já saiu da base, 6 meses depois", () => {
    expect(conversaParaApagar(c({ estado: "aberta", pedidoExiste: false, mesesDesdeQueFechou: 6 }), prazos)).toBe(true);
  });

  it("APAGA: suporte com 90 dias sem mensagens", () => {
    expect(conversaParaApagar(c({ tipo: "suporte_cliente", estado: "aberta", diasSemMensagens: 90 }), prazos)).toBe(true);
    expect(conversaParaApagar(c({ tipo: "suporte_profissional", estado: "aberta", diasSemMensagens: 400 }), prazos)).toBe(true);
  });

  it("NÃO APAGA: pedido fechado há menos de 6 meses", () => {
    expect(conversaParaApagar(c({ mesesDesdeQueFechou: 5, diasSemMensagens: 170 }), prazos)).toBe(false);
  });

  it("NÃO APAGA: conversa de pedido aberta, com o pedido na base, por mais velha que seja", () => {
    expect(conversaParaApagar(c({ estado: "aberta", mesesDesdeQueFechou: 30, diasSemMensagens: 900 }), prazos)).toBe(false);
  });

  it("NÃO APAGA: suporte com menos de 90 dias", () => {
    expect(conversaParaApagar(c({ tipo: "suporte_cliente", estado: "aberta", diasSemMensagens: 89 }), prazos)).toBe(false);
  });

  it("NÃO APAGA: um tipo que não se conhece", () => {
    expect(conversaParaApagar(c({ tipo: "outra", diasSemMensagens: 9999, mesesDesdeQueFechou: 99 }), prazos)).toBe(false);
  });
});

describe("as rotas confirmam quem pede (lidas do código)", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const ROTAS = [
    "src/app/api/conversas/route.ts",
    "src/app/api/conversas/[id]/mensagens/route.ts",
    "src/app/api/conversas/[id]/lida/route.ts",
    "src/app/api/conversas/suporte/pessoa/route.ts",
  ];

  it.each(ROTAS)("%s lê a sessão e trava por endereço", (p) => {
    const s = ler(p);
    expect(s).toContain("await quemPedeAConversa(req)");
    expect(s).toContain("limitarRotaPublica(req,");
    // O texto original de uma mensagem filtrada nunca sai destas rotas.
    expect(s).not.toMatch(/m.textoOriginal|gravada.textoOriginal/);
  });

  it("as rotas de uma conversa confirmam que a pessoa pertence a ela", () => {
    for (const p of ROTAS.slice(1, 3)) expect(ler(p)).toContain("pertenceAConversa(c, quem)");
  });

  it("a «pessoa» só no suporte da própria conta", () => {
    const s = ler("src/app/api/conversas/suporte/pessoa/route.ts");
    expect(s).toContain("suporteDoCliente(quem.contaId)");
    expect(s).toContain('quem.papel !== "cliente"');
  });

  it("as rotas da equipa pedem requireAdmin e ficam na secção do Suporte", () => {
    for (const p of ["src/app/api/admin/suporte/clientes/route.ts", "src/app/api/admin/suporte/clientes/[id]/route.ts"]) {
      expect(ler(p)).toContain("await requireAdmin(req)");
    }
  });

  it("a purga corre com o mesmo PURGA_ARMADA", () => {
    const s = ler("src/app/api/cron/purgar-pedidos/route.ts");
    expect(s).toContain("purgarConversas(");
    expect(s).toContain("{ aSerio: armada },");
  });
});
