import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  minimoDasHorasEmPalavras,
  rotuloDoValorPorBase,
  sufixoDaBase,
  totalEstimadoNoBackoffice,
  trocaDeBase,
  valorComSufixo,
} from "./valor-por-base";
import { mensagemDasPropostas, propostasParaOCliente } from "./mensagem-das-propostas";

/**
 * O BACKOFFICE NUM PEDIDO POR HORA — 31-10-2026 (ordem das horas, parte 1 e
 * acrescentos). O #536: «Por hora» com «Valor de partida (sem IVA) 270.00»
 * escrito como total, e a Mesa a dizer «72,00 € à espera de resposta» sem
 * unidade.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");

describe("o rótulo do valor diz o que o número mede", () => {
  it("um rótulo por base", () => {
    expect(rotuloDoValorPorBase("hora")).toBe("Valor por hora (sem IVA)");
    expect(rotuloDoValorPorBase("carga")).toBe("Valor por carga (sem IVA)");
    expect(rotuloDoValorPorBase("total")).toBe("Valor total (sem IVA)");
  });
  it("por hora mostra o mínimo de 3 horas e o total mínimo, com o IVA ao lado", () => {
    expect(minimoDasHorasEmPalavras(50)).toBe("Mínimo 3 horas · total mínimo 150,00 € + IVA (184,50 € com IVA)");
    expect(minimoDasHorasEmPalavras(null)).toBe("Mínimo 3 horas.");
  });
  it("o registo do pedido e o valor dos Trabalhos CLYON usam o rótulo e os botões com o aviso", () => {
    const registar = ler("src/components/admin/RegistarPedido.tsx");
    expect(registar).toContain("{rotuloDoValorPorBase(lerBase(f.baseDoPreco))}");
    expect(registar).toContain("<BotoesDaBase");
    expect(registar).not.toMatch(/Valor de partida <span/);
    const valor = ler("src/components/admin/ValorETaxaDoTrabalho.tsx");
    expect(valor).toContain("{rotuloDoValorPorBase(base)}");
    expect(valor).toContain("<BotoesDaBase");
    expect(valor).not.toContain("Valor do trabalho, sem IVA");
  });
});

describe("trocar de base nunca reinterpreta o número em silêncio", () => {
  it("propõe a conversão total ↔ hora pelas horas previstas (mínimo 3)", () => {
    expect(trocaDeBase("270", "total", "hora", null)).toEqual({ texto: "270,00 € total ÷ 3 h = 90,00 €/hora?", convertido: 90 });
    expect(trocaDeBase("50", "hora", "total", 4)).toEqual({ texto: "50,00 €/hora × 4 h = 200,00 € total?", convertido: 200 });
    expect(trocaDeBase("150", "total", "carga", null)?.convertido).toBeNull();
    expect(trocaDeBase("", "total", "hora", null)).toBeNull();
    expect(trocaDeBase("270", "hora", "hora", null)).toBeNull();
  });
  it("o componente só muda a base com um clique (Converter, Manter o número), e avisa", () => {
    const c = ler("src/components/admin/BotoesDaBase.tsx");
    expect(c).toContain("setPendente(b)");
    expect(c).toContain('role="alert"');
    expect(c).toContain("Converter");
    expect(c).toContain("Manter o número");
    // Sem número escrito muda logo; com ele, espera pela escolha.
    expect(c).toMatch(/if \(!trocaDeBase\(valor, base, b, horasPrevistas\)\) \{[\s\S]*?return onBase\(b\);/);
  });
});

describe("na Mesa, todos os valores levam a unidade", () => {
  const mesa = ler("src/components/admin/AdminNegociacoesPanel.tsx");
  it("«/hora» com o total estimado, «/carga», e «total das horas» depois de confirmadas", () => {
    expect(sufixoDaBase("hora")).toBe("/hora");
    expect(sufixoDaBase("carga")).toBe("/carga");
    expect(sufixoDaBase("total")).toBe("");
    expect(valorComSufixo(72, "hora")).toBe("72,00 €/hora");
    expect(totalEstimadoNoBackoffice(72, 4)).toBe("≈ 288,00 € em 4 h (estimado)");
    expect(mesa).toContain("function valorNaMesa(");
    expect(mesa).toContain("(total das horas)");
    expect(mesa).toContain("valorNaMesa(valorDoPrimeiro, p)");
    expect(mesa).toContain("valorNaMesa(valor, pedido, negociacao)");
    expect(mesa).toContain("placeholder={`contrapropor €${sufixo}`}");
  });
  it("as horas contestadas vão a «Precisa de si» com o distintivo e o motivo", () => {
    expect(mesa).toContain("return esperaConfirmacao(n) || esperaResposta(n) || horasEmDisputa(n);");
    expect(mesa).toContain("horas contestadas");
    expect(mesa).toContain("for (const p of aguardaCliente.filter(comHorasEmDisputa)) {");
    expect(mesa).toContain('if (comHorasEmDisputa(p)) return "n1";');
  });
  it("a secção das horas lê e grava pela rota do backoffice, e o confirmar espera por elas", () => {
    const horas = ler("src/components/admin/HorasNaMesa.tsx");
    expect(horas).toContain("/api/admin/negociacoes/horas?pedidoId=");
    expect(horas).toContain("Confirmar as horas");
    expect(horas).toContain("Corrigir e confirmar");
    expect(horas).toContain("aDevolverTexto");
    expect(horas).toContain('timeZone: "Europe/Lisbon"');
    expect(mesa).toContain("<HorasNaMesa");
    expect(mesa).toContain("{!horasNaoTravamOFim(feito) ? (");
    const clyon = ler("src/app/api/admin/trabalhos-clyon/confirmar/route.ts");
    expect(clyon).toContain("if (!horasNaoTravamOFim(linha))");
  });
});

describe("os materiais na mensagem ao cliente", () => {
  const neg = (materiaisJson: string | null) => ({
    estado: "aberta",
    profissionalNome: "Jorge",
    propostasJson: JSON.stringify([{ por: "profissional", valor: 47.62, criadaEm: "2026-10-31T09:00:00Z", estado: "pendente" }]),
    taxaCliente: 0,
    taxaProfissional: 0.11,
    criadaEm: "2026-10-31T09:00:00Z",
    materiaisJson,
  });
  it("à parte, com o IVA ao lado; por hora, a estimativa; e quem faz é o parceiro", () => {
    const m = JSON.stringify({ incluidos: false, itens: [{ id: "caixa", nome: "Caixa", preco: 2, unidade: "unidade" }] });
    const texto = mensagemDasPropostas({
      nomeCliente: "Ana",
      servico: "mudança",
      cidade: "Almada",
      propostas: propostasParaOCliente([neg(m)]),
      base: "hora",
      horasPrevistas: 4,
    });
    expect(texto).toContain("Materiais à parte: caixa 2,00 € + IVA (2,46 € com IVA) por unidade.");
    expect(texto).toContain("por hora");
    expect(texto).toContain("em 4 h (estimativa)");
    expect(texto).toContain("parceiro");
    expect(texto).not.toMatch(/\bprofissional\b/);
  });
  it("incluídos diz-se assim, e sem a pergunta respondida não se diz nada", () => {
    const com = mensagemDasPropostas({ propostas: propostasParaOCliente([neg(JSON.stringify({ incluidos: true }))]), base: "hora" });
    expect(com).toContain("Materiais incluídos no valor.");
    const sem = mensagemDasPropostas({ propostas: propostasParaOCliente([neg(null)]), base: "total" });
    expect(sem).not.toContain("Materiais");
  });
});
