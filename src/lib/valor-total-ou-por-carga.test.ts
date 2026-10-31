import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mensagemDaPropostaClyon, precoDaPropostaClyon } from "./proposta-clyon-ao-cliente";
import { notaDoPrecoParaOCliente } from "./itens-a-mais";
import { avisoDeOfertaAoProfissional, avisoDeValorNovoAoProfissional } from "./aviso-de-oferta-clyon";

/**
 * VALOR TOTAL OU POR CARGA, EM TODO O LADO — 22-10-2026.
 *
 * *«A criação de pedidos, tanto nos Trabalhos CLYON quanto nas negociações,
 * deve sempre ter a opção de marcar se é valor total ou valor por carga. E as
 * mensagens que são enviadas para o cliente têm de deixar claro que o valor é
 * por carga.»* E: *«Caso seja valor total, a mensagem também tem de deixar
 * claro que, se o cliente tiver itens de que não enviou imagens, que não
 * estavam no orçamento, são 32 € por item a mais.»* — o dono, sobre o #466.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const agora = new Date("2026-10-22T10:00:00Z");
const preco = precoDaPropostaClyon({ valorFixo: 360, taxa: 0.15, precoAoCliente: null })!;
const proposta = (base?: string) =>
  mensagemDaPropostaClyon(
    { cliente: "Vasco Ramalhete", servico: "esvaziamento_casa", localidade: "Sobreda", quando: null, preco, base },
    agora,
  );

describe("a nota ao lado do preço, para o cliente", () => {
  it("pelo trabalho todo: os 32 € por item a mais", () => {
    const n = notaDoPrecoParaOCliente("total");
    expect(n).toContain("fotografias");
    // «32 € mais IVA» — o dono, 22-10-2026: o sem IVA nunca sozinho.
    expect(n).toContain("cada item a mais acresce 32 € + IVA = 39,36 €");
  });

  it("por carga: que o total depende das cargas — e num Trabalho CLYON, confirma-se connosco", () => {
    expect(notaDoPrecoParaOCliente("carga")).toContain("POR CARGA");
    expect(notaDoPrecoParaOCliente("carga", "clyon")).toContain("confirmamos o número consigo");
    expect(notaDoPrecoParaOCliente("hora")).toContain("POR HORA");
  });
});

describe("a proposta de um Trabalho CLYON ao cliente (o #466)", () => {
  it("por carga, o número diz «por carga» e a nota explica", () => {
    const m = proposta("carga");
    expect(m).toContain("442,80 € por carga — já com IVA.");
    expect(m).toContain("É um preço POR CARGA");
    expect(m).not.toContain("32 €");
  });

  it("pelo trabalho todo, os 32 € por item que não estava nas fotografias", () => {
    for (const m of [proposta("total"), proposta(undefined)]) {
      expect(m).toContain("é o valor final a pagar, já com IVA.");
      expect(m).toContain("cada item a mais acresce 32 €");
    }
  });
});

describe("os avisos aos profissionais dizem a unidade", () => {
  it("a oferta e o valor novo, por carga", () => {
    const oferta = avisoDeOfertaAoProfissional(
      "Rui",
      {
        pedidoId: 466,
        localidade: "Sobreda",
        servico: "esvaziamento_casa",
        descricao: null,
        urgencia: null,
        distanciaKm: null,
        valor: 360,
        ganhos: 306,
        modo: "distribuida",
        link: "https://clyon.pt/x",
        base: "carga",
      },
      agora,
    );
    expect(oferta).toContain("No valor de 360,00 € por carga — ganhos estimados de 306,00 € por carga.");
    expect(oferta).toContain("POR CARGA");
    const novo = avisoDeValorNovoAoProfissional(
      "Rui",
      {
        pedidoId: 466,
        servico: "esvaziamento_casa",
        localidade: "Sobreda",
        valor: 360,
        ganhos: 306,
        motivo: "valor_novo",
        eraDele: false,
        link: "https://clyon.pt/x",
        base: "carga",
      },
      agora,
    );
    expect(novo).toContain("360,00 € por carga — ganhos estimados de 306,00 € por carga");
  });
});

describe("as mensagens das negociações levam a nota em todos os preços", () => {
  it("a Mesa, o WhatsApp, o assistente e o email", () => {
    expect(ler("src/lib/texto-da-mesa.ts")).toContain("`${notaDoPrecoParaOCliente(base)}\\n\\n` +");
    expect(ler("src/lib/whatsapp-negociacao.ts")).toContain("return `\\n\\n${notaDoPrecoParaOCliente(base)}`;");
    expect(ler("src/lib/assistente-automatico.ts")).toContain("const eANota = ` ${notaDoPrecoParaOCliente(base)}`;");
    expect(ler("src/lib/email-proposta.ts")).toContain('notaDoPrecoParaOCliente(p.base ?? "total")');
    expect(ler("src/lib/mensagem-das-propostas.ts")).toContain(': avisoDosItens(base, "cliente");');
  });
});

describe("a escolha existe ao criar e ao corrigir um Trabalho CLYON", () => {
  it("os três botões ao lado do valor", () => {
    const V = ler("src/components/admin/ValorETaxaDoTrabalho.tsx");
    // Os botões vivem em BotoesDaBase desde 31-10-2026 (com o aviso ao trocar de base).
    expect(ler("src/components/admin/BotoesDaBase.tsx")).toContain('{b === "total" ? "Valor total" : b === "carga" ? "Por carga" : "Por hora"}');
    expect(V).toContain("{onBase && (");
    expect(V).toContain("<BotoesDaBase");
  });

  it("oferecer, editar o pedido e o cartão gravam-na", () => {
    const F = ler("src/components/admin/FormularioDaOferta.tsx");
    expect(F).toContain("onBase={setBase}");
    expect(F).toMatch(/taxa,\n\s+base,\n/);
    const R = ler("src/components/admin/RegistarPedido.tsx");
    expect(R).toContain('onBase={(b) => muda("baseDoPreco", b)}');
    expect(R).toContain("base: lerBase(f.baseDoPreco),");
    const T = ler("src/components/admin/TrabalhoClyon.tsx");
    expect(T).toContain("onBase={setBaseEscolhida}");
    // …e, desde 25-10-2026, o motivo de uma taxa abaixo do escalão (d18).
    expect(T).toContain('mexer({ accao: "valor", valor, taxa, base, motivoTaxa }');
    const ROTA = ler("src/app/api/admin/trabalhos-clyon/route.ts");
    expect(ROTA).toContain("const r = await mudarValorDoTrabalhoClyon(pedidoId, valor.valor, taxa.taxa, base, motivoDaTaxa.motivo);");
    expect(ROTA).toContain("baseDoPreco: baseEscolhida ?? lerBase(pedido.baseDoPreco),");
    const DB = ler("src/lib/db.ts");
    expect(DB).toContain("baseDoPreco = COALESCE(?, baseDoPreco), updatedAt = NOW()");
  });
});
