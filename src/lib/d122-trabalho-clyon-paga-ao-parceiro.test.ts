import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * d122 — NUM TRABALHO CLYON O CLIENTE PAGA AO PARCEIRO (25-11-2026). O dono:
 * «Ao parceiro». Os de antes do corte que ainda não foram pagos passam ao
 * modelo de 15-11; os que já andaram ficam como foram. Números inventados.
 */

import { eDoNovoModelo, trabalhoClyonDoModeloAntigo, trabalhoClyonDoNovoModelo } from "./novo-modelo";
import { mensagemDeAdjudicacao } from "./mensagem-de-adjudicacao";
import { pagaAoContratado } from "./o-pagamento-da-vitoria";
import { AVISO_AO_MODELO } from "./vitoria-agente/aviso-ao-modelo";
import { comORelogioEm } from "./relogio-dos-testes";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const AGORA = new Date("2026-11-25T12:00:00Z");
const ANTES_DO_CORTE = "2026-11-10 10:00:00";
const DEPOIS_DO_CORTE = "2026-11-20 10:00:00";
// O relógio do modelo no dia (o guarda da d29).
comORelogioEm(AGORA);

describe("o modelo de um Trabalho CLYON", () => {
  it("um de antes do corte, ainda por pagar, passa ao modelo de 15-11 (paga ao parceiro)", () => {
    const t = { ofertaClyon: "directa", pedidoCriadoEm: ANTES_DO_CORTE };
    expect(trabalhoClyonDoModeloAntigo(t, AGORA)).toBe(false);
    expect(trabalhoClyonDoNovoModelo(t, AGORA)).toBe(true);
    expect(eDoNovoModelo(t, AGORA)).toBe(true);
  });

  it("os que já andaram ficam como foram: pago à CLYON, confirmado, pago ao profissional, fechado", () => {
    const t = { ofertaClyon: "directa", pedidoCriadoEm: ANTES_DO_CORTE };
    expect(trabalhoClyonDoModeloAntigo({ ...t, clientePagouAClyonEm: "2026-11-12 10:00:00" }, AGORA)).toBe(true);
    expect(trabalhoClyonDoModeloAntigo({ ...t, confirmadoEm: "2026-11-21 10:00:00" }, AGORA)).toBe(true);
    expect(trabalhoClyonDoModeloAntigo({ ...t, pagoAoProfissionalEm: "2026-11-22 10:00:00" }, AGORA)).toBe(true);
    expect(eDoNovoModelo({ ...t, fechadoEm: "2026-11-21 10:00:00" }, AGORA)).toBe(false);
  });

  it("um de depois do corte continua no novo; pago à CLYON, no antigo (d58)", () => {
    expect(trabalhoClyonDoModeloAntigo({ ofertaClyon: "directa", pedidoCriadoEm: DEPOIS_DO_CORTE }, AGORA)).toBe(false);
    expect(trabalhoClyonDoModeloAntigo({ ofertaClyon: "directa", pedidoCriadoEm: DEPOIS_DO_CORTE, clientePagouAClyonEm: "2026-11-21" }, AGORA)).toBe(true);
  });

  it("as portas do dinheiro passam o que já andou (a carteira, a retenção, a vista, as carteiras, os cartões)", () => {
    expect(ler("src/lib/carteira-do-profissional.ts")).toContain("confirmadoEm: l.confirmadoEm ?? null, pagoAoProfissionalEm: l.pagoEm ?? null");
    expect(ler("src/lib/regras-novas-da-retencao.ts")).toContain("pagoAoProfissionalEm: n.pagoEm ?? null,");
    expect(ler("src/lib/negociacao-na-vista.ts")).toContain("pagoAoProfissionalEm: n.pagoEm ?? null,");
    expect(ler("src/app/api/admin/carteiras/route.ts")).toContain("pagoAoProfissionalEm: (l.pagoEm as Date | string | null | undefined) ?? null,");
    expect(ler("src/app/api/admin/trabalhos-clyon/route.ts")).toContain("pagoAoProfissionalEm: o.negociacoes.map((n) => n.pagoEm).find((d) => d != null) ?? null,");
  });
});

describe("a adjudicação, a conta e a Vitória dizem o mesmo: ao parceiro", () => {
  const adjudicacao = mensagemDeAdjudicacao(
    {
      cliente: "Cliente Teste",
      quando: null,
      servico: "recolha_monos",
      empresa: "Ecorecolha",
      formas: {
        comDadosDoDono: false,
        referencias: [],
        link: "https://clyon.pt/pedido/abc",
        novoModelo: { total: 123, semIva: 100, formas: ["mbway", "transferencia", "dinheiro"] },
      },
    },
    AGORA,
  );

  it("a adjudicação do modelo novo: paga ao parceiro, pelos meios dele, e a fatura é do parceiro", () => {
    expect(adjudicacao).toContain("Paga diretamente à empresa Ecorecolha, no fim do trabalho");
    expect(adjudicacao).toContain("a do trabalho, do parceiro");
    expect(adjudicacao).not.toMatch(/envie-nos o comprovativo|pague à CLYON|pagar à CLYON/i);
  });

  it("a Vitória, no «a quem pago?» de um Trabalho CLYON contratado, diz a frase da confirmação", () => {
    const NEG = ler("src/lib/whatsapp-negociacao.ts");
    const ecra = NEG.slice(NEG.indexOf("export async function ecraDoPedido("));
    const clyon = ecra.slice(ecra.indexOf("const linhaDoClyon = linhaDoTrabalhoClyonNaConversa("), ecra.indexOf("if (acordada) {"));
    expect(clyon).toContain("if (acordada && (await noNovoModelo(acordada)))");
    expect(clyon).toContain("pagaAoContratado(await dadosPorConfirmarDe(Number(acordada.id)))");
    expect(clyon).toContain("quemPassaAFatura(acordada)");
    expect(pagaAoContratado(false)).toMatch(/^Paga-lhe diretamente/);
    expect(AVISO_AO_MODELO).toContain("Num Trabalho CLYON contratado é igual aos outros: paga o valor todo, com IVA, diretamente ao parceiro");
    expect(AVISO_AO_MODELO).toContain("o pagamento nunca é à plataforma");
  });

  it("nenhum texto ao cliente de um Trabalho CLYON por pagar manda pagar à CLYON", () => {
    expect(adjudicacao).not.toMatch(/\bà CLYON\b/);
    expect(pagaAoContratado(false)).not.toMatch(/\bCLYON\b/);
  });
});
