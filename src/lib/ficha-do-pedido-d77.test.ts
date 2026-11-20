import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contaDaEstimativa, desdobramentoDaConta, eurosPt, valorPt } from "./conta-da-estimativa";

/*
 * d77, 21-11-2026 — a ficha do pedido em Pedidos › «Todos os pedidos».
 *
 * A conta estava errada: no #653 dizia «Estimativa s/IVA 135,30 € · IVA 23 %
 * 25,30 € · Estimativa total 135.30 €». Os 135,30 são o preço COM IVA
 * (110,00 + 25,30) — o estimateTotal grava-se com IVA — e eram mostrados como
 * sem IVA. E a ficha refez-se no fundo escuro do backoffice, com a barra de
 * botões iguais e o «Geral» em cartões pequenos.
 */

const semComentarios = (f: string) =>
  f
    .replace(/\r\n/g, "\n")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");
const ler = (p: string) => semComentarios(readFileSync(join(process.cwd(), p), "utf8"));

describe("a conta da estimativa lê cada coluna pelo que ela guarda", () => {
  it("#653: o simulador guarda o sem IVA no estimateMin e o com IVA no estimateTotal", () => {
    const c = contaDaEstimativa({
      estimateMin: "110.00",
      estimateMax: "135.30",
      estimateTotal: "135.30",
      estimateJson: JSON.stringify({ estimatedPriceWithoutVat: 110, vatAmount: 25.3, estimatedPriceWithVat: 135.3 }),
    });
    expect(c).toEqual({ semIva: 110, iva: 25.3, comIva: 135.3, fonte: "estimativa" });
  });

  it("#651: 136,04 com IVA dá 110,60 sem IVA e 25,44 de IVA", () => {
    const c = contaDaEstimativa({ estimateTotal: "136.04", estimateJson: JSON.stringify({ estimatedPriceWithVat: 136.04 }) });
    expect(c).toEqual({ semIva: 110.6, iva: 25.44, comIva: 136.04, fonte: "estimativa" });
  });

  it("o total nunca é igual ao sem IVA quando há IVA", () => {
    const c = contaDaEstimativa({ estimateTotal: "135.30" })!;
    expect(c.comIva).toBe(135.3);
    expect(c.semIva).toBe(110);
    expect(c.semIva).not.toBe(c.comIva);
  });

  it("um pedido de antes do corte de 01-10 lê-se pela mesma regra (o corte mudou o que o cliente vê, não as colunas)", () => {
    // O simulador grava o estimateTotal com IVA desde 07-2026: um pedido de setembro tem o mesmo formato.
    const setembro = contaDaEstimativa({ estimateMin: "80", estimateTotal: "98.40", estimateMax: "98.40" });
    expect(setembro).toEqual({ semIva: 80, iva: 18.4, comIva: 98.4, fonte: "estimativa" });
  });

  it("o recálculo antigo do backoffice (faixa nas colunas, sem IVA no estimateTotal) lê-se pelo estimateJson", () => {
    const c = contaDaEstimativa({
      estimateMin: "90",
      estimateMax: "130",
      estimateTotal: "110",
      estimateJson: JSON.stringify({ estimatedPriceWithoutVat: 110, estimatedPriceWithVat: 135.3, estimateMinWithoutVat: 90 }),
    });
    expect(c).toEqual({ semIva: 110, iva: 25.3, comIva: 135.3, fonte: "estimativa" });
  });

  it("a marcação recorrente: as colunas têm o desconto, o estimateJson não — ganham as colunas", () => {
    const c = contaDaEstimativa({
      estimateMin: "93.50",
      estimateTotal: "115.01",
      estimateJson: JSON.stringify({ estimatedPriceWithoutVat: 110, estimatedPriceWithVat: 135.3 }),
    });
    expect(c).toEqual({ semIva: 93.5, iva: 21.51, comIva: 115.01, fonte: "estimativa" });
  });

  it("o preço final da equipa ganha à estimativa (e pode desligar-se)", () => {
    const o = { precoFinal: "200", precoFinalIva: "246", estimateMin: "110", estimateTotal: "135.30" };
    expect(contaDaEstimativa(o)).toEqual({ semIva: 200, iva: 46, comIva: 246, fonte: "preco_final" });
    expect(contaDaEstimativa(o, { comPrecoFinal: false })?.comIva).toBe(135.3);
    expect(contaDaEstimativa({ precoFinalIva: "246" })).toEqual({ semIva: 200, iva: 46, comIva: 246, fonte: "preco_final" });
  });

  it("zeros e vazios não são preço", () => {
    expect(contaDaEstimativa({ estimateTotal: "0.00", estimateMin: "", precoFinal: "0" })).toBeNull();
    expect(contaDaEstimativa(null)).toBeNull();
  });
});

describe("os valores em pt-PT, com vírgula e « €»", () => {
  it("formata como em Portugal", () => {
    expect(eurosPt(135.3)).toBe("135,30 €");
    expect(eurosPt("25.44")).toBe("25,44 €");
    expect(eurosPt(1234.5)).toBe("1234,50 €");
    expect(valorPt(110)).toBe("110,00");
    expect(eurosPt(null)).toBe("—");
    expect(eurosPt("lixo")).toBe("—");
  });

  it("o sem IVA é dito como parte do total", () => {
    expect(desdobramentoDaConta({ semIva: 110, iva: 25.3 })).toBe("110,00 € + 25,30 € de IVA (23 %)");
  });
});

describe("a ficha do pedido (PedidoDetailModal)", () => {
  const MODAL = ler("src/components/admin/PedidoDetailModal.tsx");

  it("a conta do «Geral» e do «Serviço e Fotos» vem de contaDaEstimativa", () => {
    expect(MODAL).toContain("const contaGeral = contaDaEstimativa(order);");
    expect(MODAL).toContain("contaDaEstimativa(order, { comPrecoFinal: false })");
    expect(MODAL).toContain("desdobramentoDaConta(contaGeral)");
    // As contas antigas: o estimateTotal como sem IVA, e ainda × 1,23.
    expect(MODAL).not.toContain("baseNoVat * 1.23");
    expect(MODAL).not.toContain('parseFloat(order.estimateTotal) * 1.23');
    expect(MODAL).not.toMatch(/fmtEur\(order\.estimateTotal\)/);
  });

  it("nenhum valor em euros com o ponto do toFixed", () => {
    expect(MODAL).not.toMatch(/toFixed\(2\)\}?\s*€/);
    expect(MODAL).not.toMatch(/toFixed\(2\)\} €`/);
  });

  it("o recálculo grava as colunas como o simulador (sem IVA no estimateMin, com IVA no estimateTotal)", () => {
    expect(MODAL).toContain("estimateMin: String(recommended)");
    expect(MODAL).toContain("estimateTotal: String(withVat)");
    expect(MODAL).not.toContain("estimateTotal: String(recommended)");
  });

  it("todos os botões de sempre na barra de cima, do mesmo tamanho", () => {
    const inicio = MODAL.indexOf("lg:flex-row lg:items-center");
    const fim = MODAL.indexOf("(acceptMsg || saveMsg ||");
    expect(inicio).toBeGreaterThan(-1);
    expect(fim).toBeGreaterThan(inicio);
    const barra = MODAL.slice(inicio, fim);
    for (const rotulo of ['"Aceitar pedido"', "Guardar", "Aprovar", "Pedir info", "Arquivar", "WhatsApp", "Apagar"]) {
      expect(barra, rotulo).toContain(rotulo);
    }
    // As mesmas funções e as mesmas guardas.
    for (const accao of [
      "onClick={handleAccept}",
      "onClick={handleSave}",
      'handleStatusQuick("aprovado")',
      "setShowPedirInfo(true)",
      "onClick={handleReject}",
      "setShowAcceptPrompt(true)",
      "isAdmin && permitirApagar",
      "onClick={() => setShowDelete(true)}",
      "onClick={openCalendarModal}",
    ]) {
      expect(barra, accao).toContain(accao);
    }
    // Um tamanho só: cada botão da barra leva a mesma classe.
    const usos = barra.match(/\$\{BOTAO_DA_BARRA\}/g) ?? [];
    expect(usos.length).toBeGreaterThanOrEqual(9);
    expect(MODAL).toMatch(/const BOTAO_DA_BARRA =\s*"inline-flex h-9 w-full[^"]*sm:w-\[8\.75rem\]/);
    // Já não se escondem no telemóvel.
    expect(barra).not.toContain("hidden sm:flex");
    expect(barra).not.toContain("hidden md:flex");
  });

  it("os separadores de sempre, pela mesma ordem", () => {
    const tabs = MODAL.slice(MODAL.indexOf("const TABS = ["), MODAL.indexOf("] as const;", MODAL.indexOf("const TABS = [")));
    const rotulos = [...tabs.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
    expect(rotulos).toEqual(["Geral", "Cliente e Morada", "Serviço e Fotos", "Estado e notas", "Distribuição", "Histórico"]);
  });

  it("o «Geral»: primeiro o que se decide, depois contacto e morada, e a análise da IA no fim, recolhida", () => {
    const geral = MODAL.slice(MODAL.indexOf('activeTab === "geral"'), MODAL.indexOf('activeTab === "cliente_morada"'));
    const onde = (t: string) => {
      const i = geral.indexOf(t);
      expect(i, t).toBeGreaterThan(-1);
      return i;
    };
    const estimativa = onde('"Estimativa"');
    const servico = onde('rotulo="Serviço"');
    const urgencia = onde('rotulo="Urgência"');
    const nif = onde('rotulo="NIF na fatura"');
    const contacto = onde('rotulo="Contacto"');
    const morada = onde('rotulo="Morada"');
    const ia = onde("<details");
    expect(estimativa).toBeLessThan(servico);
    expect(servico).toBeLessThan(urgencia);
    expect(urgencia).toBeLessThan(nif);
    expect(nif).toBeLessThan(contacto);
    expect(contacto).toBeLessThan(morada);
    expect(morada).toBeLessThan(ia);
    expect(geral.slice(ia)).toContain("Análise Gemini");
    // Nada se perde: o que a ficha tinha continua lá.
    for (const t of ["Conta gastar", "Preço final sem IVA (€)", "Preço final com IVA (€)", "Razão interna / notas", "Recalcular estimativa", "Aprovar orçamento", "Guardar alterações", "Ver no mapa", "Distância / Zona", "Responsável", "Fotos e ficheiros", "Ver histórico completo", "<ContaDoPedido", "<AcessoPeloLink", "<DescricaoDoPedido"]) {
      expect(geral, t).toContain(t);
    }
  });

  it("sem os cartões de emoji nem o fundo claro", () => {
    expect(MODAL).not.toContain('icon: "🔧"');
    expect(MODAL).not.toContain("bg-[#e8e8ff]");
    expect(MODAL).toContain("fixed inset-0 z-50 bg-[#070e17]");
    expect(MODAL).not.toMatch(/className="[^"]*\bbg-white\b(?!\/)/);
  });
});

describe("a página /admin/pedidos/[id] (AdminPedidoDetalheClient)", () => {
  const PAGINA = ler("src/app/admin/pedidos/[id]/AdminPedidoDetalheClient.tsx");

  it("os valores em pt-PT e a mesma conta da ficha", () => {
    expect(PAGINA).toContain("return isNaN(n) ? null : eurosPt(n);");
    expect(PAGINA).not.toMatch(/toFixed\(2\)\} €`/);
    expect(PAGINA).toContain("contaDaEstimativa(order, { comPrecoFinal: false })");
  });

  it("o sem IVA da estimativa tem o com IVA ao lado", () => {
    expect(PAGINA).toContain('{ label: "Estimativa c/IVA", value: fmtEur(semIvaDaEstimativa.comIva) }');
    // O estimateMin já não faz de mínimo da faixa (é o valor estimado, d59).
    expect(PAGINA).not.toContain("?? order.estimateMin ?? null");
  });
});
