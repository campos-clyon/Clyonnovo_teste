import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NOVO_MODELO_DESDE,
  TRABALHOS_CLYON_NO_MODELO_ANTIGO,
  TRABALHOS_CLYON_NO_MODELO_ANTIGO_ATE_POR_EXTENSO,
  TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE,
  TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE_POR_EXTENSO,
  eDoNovoModelo,
  trabalhoClyonDoNovoModelo,
} from "./novo-modelo";
import { trabalhoClyonNoNovoModelo } from "./trabalho-clyon-no-novo-modelo";
import { mensagemDaPropostaClyon, precoDaPropostaClyon } from "./proposta-clyon-ao-cliente";
import { mensagemDeAdjudicacao } from "./mensagem-de-adjudicacao";
import { PAGA_AO_PARCEIRO } from "./mensagem-do-orcamento";
import {
  REFERENCIA_AO_CLIENTE_NO_NOVO_MODELO,
  porqueNaoHaReferenciaNoNovoModelo,
} from "./referencia-no-novo-modelo";
import { contaDoTrabalhoClyonNoNovoModelo, aPassarAClyonDaConta, contaFecha } from "./conta-do-pagamento";

/*
 * d54 (CEO e dono, 17-11-2026) — OS TRABALHOS CLYON NO MODELO DE 15-11.
 *
 * Criados a partir de 15-11-2026 00:00 de Lisboa, seguem o modelo novo: o
 * cliente paga ao parceiro, e o parceiro passa à CLYON a taxa. Os de antes
 * ficam no antigo. Nenhuma mensagem ao cliente de um pedido do modelo novo diz
 * «Paga à CLYON» nem leva `?pagar=1`, e o servidor não gera referência ao
 * cliente. relógio: datas explícitas.
 */

const DEPOIS = new Date("2026-11-20T12:00:00Z");
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("(a) a data de corte dos Trabalhos CLYON — 15-11-2026", () => {
  it("o interruptor está desligado e a data é a do modelo, meia-noite de Lisboa", () => {
    expect(TRABALHOS_CLYON_NO_MODELO_ANTIGO).toBe(false);
    expect(TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE.toISOString()).toBe("2026-11-15T00:00:00.000Z");
    expect(TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE.getTime()).toBe(NOVO_MODELO_DESDE.getTime());
    expect(
      new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
        TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE,
      ),
    ).toBe("00:00");
  });

  it("os textos por extenso batem com a data", () => {
    expect(TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE_POR_EXTENSO).toBe("15 de novembro de 2026");
    expect(TRABALHOS_CLYON_NO_MODELO_ANTIGO_ATE_POR_EXTENSO).toBe("14 de novembro de 2026");
    const lisboa = (d: Date) =>
      new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", day: "numeric", month: "long", year: "numeric" }).format(d);
    expect(lisboa(TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE)).toBe(TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE_POR_EXTENSO);
    expect(lisboa(new Date(TRABALHOS_CLYON_NO_NOVO_MODELO_DESDE.getTime() - 1))).toBe(TRABALHOS_CLYON_NO_MODELO_ANTIGO_ATE_POR_EXTENSO);
  });

  it("criado a 15-11 → modelo novo; a 14-11 → antigo", () => {
    expect(trabalhoClyonNoNovoModelo(new Date("2026-11-15T10:00:00Z"), DEPOIS)).toBe(true);
    expect(trabalhoClyonNoNovoModelo(new Date("2026-11-14T10:00:00Z"), DEPOIS)).toBe(false);
    // A fronteira, e o texto sem fuso que a base devolve (lido em UTC).
    expect(trabalhoClyonNoNovoModelo("2026-11-14 23:59:59", DEPOIS)).toBe(false);
    expect(trabalhoClyonNoNovoModelo("2026-11-15 00:00:00", DEPOIS)).toBe(true);
    expect(eDoNovoModelo({ ofertaClyon: "directa", pedidoCriadoEm: "2026-11-15 10:00:00" }, DEPOIS)).toBe(true);
    expect(eDoNovoModelo({ ofertaClyon: "directa", pedidoCriadoEm: "2026-11-14 10:00:00" }, DEPOIS)).toBe(false);
    expect(trabalhoClyonDoNovoModelo({ valorFixoClyon: "350.00", pedidoCriadoEm: "2026-11-15 10:00:00" }, DEPOIS)).toBe(true);
    expect(trabalhoClyonDoNovoModelo({ valorFixoClyon: "350.00", pedidoCriadoEm: "2026-11-14 10:00:00" }, DEPOIS)).toBe(false);
  });

  it("sem data de criação, antes de o modelo valer, ou não sendo Trabalho CLYON: não", () => {
    expect(trabalhoClyonDoNovoModelo({ valorFixoClyon: "350.00", pedidoCriadoEm: null }, DEPOIS)).toBe(false);
    expect(trabalhoClyonDoNovoModelo({ valorFixoClyon: "350.00", pedidoCriadoEm: "2026-11-15 10:00:00" }, new Date("2026-11-14T12:00:00Z"))).toBe(false);
    expect(trabalhoClyonDoNovoModelo({ valorFixoClyon: null, pedidoCriadoEm: "2026-11-15 10:00:00" }, DEPOIS)).toBe(false);
  });

  it("a conta do cartão é a do modelo novo: o cliente paga ao profissional, e ele passa à CLYON a taxa e o IVA dela", () => {
    const c = contaDoTrabalhoClyonNoNovoModelo({ valorFixo: 350, taxa: 0.2 })!;
    expect(c.novoModelo).toBe(true);
    expect(c.total).toBe(430.5);
    // 20 % de 350 = 70 de taxa, + 23 % de IVA = 86,10.
    expect(aPassarAClyonDaConta(c)).toBe(86.1);
    expect(contaFecha(c)).toBe(true);
    const rotulos = c.degraus.map((d) => d.rotulo).join(" | ");
    expect(rotulos).not.toMatch(/A pagar ao profissional|A receber do cliente/);
    expect(contaDoTrabalhoClyonNoNovoModelo({ valorFixo: 350, taxa: null })).toBeNull();
  });
});

describe("(b) nenhuma mensagem ao cliente de um pedido do modelo novo diz «Paga à CLYON» nem leva ?pagar=1", () => {
  const preco = precoDaPropostaClyon({ valorFixo: 350, taxa: 0.2, precoAoCliente: null })!;
  const proposta = (novoModelo: boolean) =>
    mensagemDaPropostaClyon(
      { cliente: "Cliente Teste", servico: "recolha_monos", localidade: "Lisboa", quando: null, preco, base: "total", novoModelo },
      DEPOIS,
    );

  it("a proposta: «Paga ao parceiro» no modelo novo, «Paga à CLYON» só no antigo", () => {
    expect(proposta(true)).toContain(PAGA_AO_PARCEIRO);
    expect(proposta(true)).not.toContain("Paga à CLYON");
    expect(proposta(false)).toContain("Paga à CLYON");
  });

  it("a adjudicação do modelo novo: o pagamento ao parceiro, sem «Paga à CLYON» nem ?pagar=1", () => {
    const m = mensagemDeAdjudicacao(
      {
        cliente: "Cliente Teste",
        quando: null,
        servico: "recolha_monos",
        empresa: "Parceiro de Teste",
        formas: {
          comDadosDoDono: false,
          referencias: [],
          link: "https://clyon.pt/pedido/abc",
          novoModelo: { total: 430.5, semIva: 350, formas: ["transferencia", "mbway"] },
        },
      },
      DEPOIS,
    );
    expect(m).toContain("Paga diretamente à empresa Parceiro de Teste");
    expect(m).not.toContain("Paga à CLYON");
    expect(m).not.toContain("pagar=1");
  });

  it("o servidor: a adjudicação do modelo novo leva o link sem ?pagar=1, e sem conta recusa", () => {
    const adj = ler("src/app/api/admin/negociacoes/adjudicacao/route.ts");
    expect(adj).toContain("link = noNovoModelo ? gerado : linkParaPagar(gerado);");
    expect(adj).toMatch(/if \(visto\.conta\?\.total == null\) \{\s*return NextResponse\.json\(\{ error: ADJUDICACAO_SEM_CONTA_NO_NOVO_MODELO \}/);
    // A conta lê-se antes de gerar o link (um link novo mata o anterior).
    expect(adj.indexOf("ADJUDICACAO_SEM_CONTA_NO_NOVO_MODELO },")).toBeLessThan(adj.indexOf("await linkParaQuemFechou("));
  });

  it("os «valores para pagamento» (Paga à CLYON + ?pagar=1) não saem num trabalho do modelo novo", () => {
    const rota = ler("src/app/api/admin/trabalhos-clyon/route.ts");
    const bloco = rota.slice(rota.indexOf('accao === "valores_para_pagamento"'));
    expect(bloco.indexOf("VALORES_PARA_PAGAMENTO_NO_NOVO_MODELO")).toBeGreaterThan(0);
    expect(bloco.indexOf("VALORES_PARA_PAGAMENTO_NO_NOVO_MODELO")).toBeLessThan(bloco.indexOf("linkParaPagar(link)"));
    // A proposta pelo WhatsApp da CLYON pergunta o modelo.
    expect(rota).toMatch(/novoModelo: trabalhoClyonDoNovoModelo\(/);
    // E o cartão nem mostra o botão.
    const cartao = ler("src/components/admin/TrabalhoClyon.tsx");
    expect(cartao).toContain("!novoModelo && botoes.valoresParaPagamento && a && conta && t.telefone");
    expect(cartao).toContain("novoModelo={novoModelo}");
  });
});

describe("(c) o servidor recusa referência ao cliente no modelo novo", () => {
  it("de qualquer origem do lado do cliente, ou quando quem pagaria é o cliente", () => {
    for (const origem of ["adjudicacao", "valores", "cliente"]) {
      expect(porqueNaoHaReferenciaNoNovoModelo({ novoModelo: true }, origem, "profissional")).toBe(REFERENCIA_AO_CLIENTE_NO_NOVO_MODELO);
    }
    expect(porqueNaoHaReferenciaNoNovoModelo({ novoModelo: true }, undefined, "cliente")).toBe(REFERENCIA_AO_CLIENTE_NO_NOVO_MODELO);
    // A taxa, ao profissional, continua (a da confirmação e a dos Pagamentos).
    expect(porqueNaoHaReferenciaNoNovoModelo({ novoModelo: true }, undefined, "profissional")).toBeNull();
    // No modelo antigo nada muda.
    expect(porqueNaoHaReferenciaNoNovoModelo({ novoModelo: false }, "adjudicacao", "cliente")).toBeNull();
  });

  it("a rota pergunta-o antes de gerar seja o que for", () => {
    const criar = ler("src/app/api/admin/pagamentos/criar/route.ts");
    const i = criar.indexOf("porqueNaoHaReferenciaNoNovoModelo(t, corpo.origem, quemPaga)");
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(criar.indexOf("pagamentosDaNegociacao(t.negociacaoId)"));
  });
});
