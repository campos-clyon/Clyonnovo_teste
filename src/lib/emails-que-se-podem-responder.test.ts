import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BUSINESS_EMAIL, BUSINESS_PHONE } from "./seo-data";
import { IDENTIFICACAO } from "./identificacao-legal";
import { telefoneLegivel } from "./telefone-legivel";
import { PERGUNTAS_DO_PROFISSIONAL } from "./ajuda-plataforma";

/**
 * O QUE OS EMAILS E AS AJUDAS PROMETEM, E SE SE CUMPRE — 29-09-2026.
 *
 * Três coisas pequenas que se somavam numa impressão má:
 *
 *   · o email ao cliente dizia «responda a este email antes disso» e saía de
 *     um `noreply` — a resposta de quem tinha um problema não chegava a
 *     ninguém; e o do orçamento dizia «por favor não responda diretamente»;
 *   · o telefone ia nos rodapés como doze dígitos colados, «+351931632622»;
 *   · a ajuda do profissional prometia a transferência «em um a dois dias
 *     úteis» (o que é nosso são as 24 horas de tratar do pedido; o resto é
 *     do banco) e um «pagamento garantido» que não existe.
 *
 * E o fluxo antigo do orçamento anunciava o preço «c/ IVA», feito à mão
 * (× 1,23) e sem a taxa da plataforma — o único sítio do produto a fazê-lo.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (t: string) =>
  t.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^\s*\/\/.*$/gm, "");

const EMAILS_AO_CLIENTE = [
  "src/lib/email-trabalho.ts",
  "src/lib/email-proposta.ts",
  "src/lib/email-status.ts",
  "src/lib/email-orcamento.ts",
  "src/lib/email-pedido.ts",
  "src/lib/email-digest.ts",
];

describe("responder a um email vai ter a alguém", () => {
  it("o endereço é o de contacto oficial, escrito num sítio só", () => {
    expect(BUSINESS_EMAIL).toBe("geral@clyon.pt");
    expect(IDENTIFICACAO.email).toBe(BUSINESS_EMAIL);
  });

  it("os emails ao cliente respondem para lá", () => {
    for (const f of EMAILS_AO_CLIENTE) {
      expect(semComentarios(ler(f)), f).toContain("replyTo: BUSINESS_EMAIL");
    }
  });

  it("e o do orçamento deixou de pedir que não se responda", () => {
    const orcamento = semComentarios(ler("src/lib/email-orcamento.ts"));
    expect(orcamento).not.toContain("não responda");
    expect(orcamento).toContain("basta responder a este email");
  });
});

describe("o telefone lê-se como se dita", () => {
  it("«+351 931 632 622», pela função de todos", () => {
    expect(telefoneLegivel(BUSINESS_PHONE, { comIndicativo: true })).toBe("+351 931 632 622");
  });

  it("nos rodapés, o número à vista é o legível — e o `tel:` continua cru", () => {
    for (const f of ["src/lib/email-status.ts", "src/lib/email-orcamento.ts", "src/lib/email-digest.ts"]) {
      const codigo = semComentarios(ler(f));
      expect(codigo, f).toContain('href="tel:${BUSINESS_PHONE}"');
      expect(codigo, f).toContain(">${TELEFONE_PARA_LER}</a>");
      expect(codigo, f).not.toContain(">${BUSINESS_PHONE}</a>");
    }
  });
});

describe("a ajuda do profissional promete o que é nosso", () => {
  const resposta = (pergunta: string) =>
    PERGUNTAS_DO_PROFISSIONAL.find((q) => q.pergunta === pergunta)?.resposta ?? "";

  it("o levantamento: 24 horas nossas, e o banco à parte", () => {
    const r = resposta("Como levanto o saldo?");
    expect(r).toContain("Tratamos do pedido de levantamento em até 24 horas");
    expect(r).toContain("o banco pode demorar mais um dia útil a mostrar a transferência");
    expect(r).not.toContain("um a dois dias úteis");
  });

  it("nenhuma resposta promete pagamento garantido", () => {
    for (const q of PERGUNTAS_DO_PROFISSIONAL) {
      expect(q.resposta, q.pergunta).not.toMatch(/pagamento garantido/i);
    }
  });

  it("e a factura já não decide que pedidos lhe chegam", () => {
    const r = resposta("Porque é que não recebo pedidos?");
    expect(r).not.toMatch(/fatura só para quem emite|pedidos com fatura/i);
  });
});

describe("o orçamento do fluxo antigo diz o preço como o resto", () => {
  it("o email já não anuncia um valor «c/ IVA»", () => {
    const email = semComentarios(ler("src/lib/email-orcamento.ts"));
    expect(email).not.toContain("c/ IVA");
    expect(email).toContain("precoParaOCliente(p.precoFinal)");
    expect(email).toContain("comFacturaEmPalavras(p.precoFinal, null)");
  });

  it("e ninguém multiplica por 1,23 à mão", () => {
    for (const f of [
      "src/app/api/admin/pedidos/[id]/approve/route.ts",
      "src/app/api/admin/pedidos/approve/route.ts",
      "src/app/admin/aprovar/[token]/AprovarPedidoClient.tsx",
    ]) {
      const codigo = semComentarios(ler(f));
      expect(codigo, f).not.toMatch(/\*\s*1[.,]23/);
    }
    for (const f of [
      "src/app/api/admin/pedidos/[id]/approve/route.ts",
      "src/app/api/admin/pedidos/approve/route.ts",
    ]) {
      expect(semComentarios(ler(f)), f).toContain("contaDoCliente(Number(precoFinal)).total");
    }
  });

  it("a página para onde o email manda diz o mesmo número", () => {
    const pagina = semComentarios(ler("src/app/orcamento/[token]/OrcamentoClient.tsx"));
    expect(pagina).toContain("precoParaOCliente(order.precoFinal)");
    expect(pagina).not.toContain("Total aprovado");
  });
});
