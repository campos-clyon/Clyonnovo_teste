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
  it("pelo trabalho todo: os itens a mais pela tabela das peças (d7; eram 32 €; curta desde a d47)", () => {
    const n = notaDoPrecoParaOCliente("total");
    expect(n).toContain("fotografias");
    // «32 € mais IVA» — o dono, 22-10-2026: o sem IVA nunca sozinho. Curta desde a d47 (15-11-2026).
    expect(n).toContain("O que aparecer a mais combina-se consigo antes de carregar, pela tabela (peça pequena 15 €, média 30 €, grande 65 € a primeira e 50 € as seguintes, + IVA)");
    expect(n).not.toContain("32 €");
  });

  it("por carga: que o total depende das cargas — e num Trabalho CLYON, confirma-se connosco", () => {
    // d63: a frase única da base, igual com a CLYON e com o parceiro.
    expect(notaDoPrecoParaOCliente("carga")).toContain("O valor é por carga.");
    expect(notaDoPrecoParaOCliente("carga", "clyon")).toContain("O número de cargas é confirmado consigo no local, pelo parceiro, antes de começar.");
    expect(notaDoPrecoParaOCliente("hora")).toContain("O valor é por hora");
  });
});

describe("a proposta de um Trabalho CLYON ao cliente (o #466)", () => {
  it("por carga, o número diz «por carga» e a nota explica", () => {
    const m = proposta("carga");
    // d47: curta — «X € + IVA = Y € por carga», e mais uma carga ao mesmo preço.
    expect(m).toContain("360 € + IVA = 442,80 € por carga.");
    // d63: a regra da base, com o exemplo das cargas.
    expect(m).toContain("O número de cargas é confirmado consigo no local, pelo parceiro, antes de começar. Por exemplo: 1 carga = 442,80 €; 2 cargas = 885,60 €.");
    expect(m).not.toContain("32 €");
  });

  it("pelo trabalho todo, na recolha de móveis, os itens a mais pela tabela das peças (d7; eram 32 €)", () => {
    const m = mensagemDaPropostaClyon(
      { cliente: "Vasco Ramalhete", servico: "recolha_moveis", localidade: "Sobreda", quando: null, preco, base: "total" },
      agora,
    );
    expect(m).toContain("360 € + IVA = 442,80 €.");
    expect(m).toContain("O que aparecer a mais combina-se consigo antes de carregar, pela tabela (peça pequena");
  });

  it("pelo trabalho todo, nos outros serviços, a nota do serviço — sem a tabela das peças (d20)", () => {
    for (const m of [proposta("total"), proposta(undefined)]) {
      expect(m).toContain("360 € + IVA = 442,80 €.");
      expect(m).toContain("Inclui o que está nas fotografias e na descrição.");
      // O esvaziamento conta o volume, não a peça (d20, d47).
      expect(m).not.toContain("peça pequena");
      expect(m).toContain("o volume a mais combina-se consigo antes de carregar");
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
    // d135b: a oferta curta diz o que lhe fica, com a unidade.
    expect(oferta).toContain("💶 Recebe: 306,00 € por carga (valor fixo, já sem a taxa e sem IVA)");
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
    // d47: na lista das propostas, o que cobre e o extra pela regra do serviço.
    expect(ler("src/lib/mensagem-das-propostas.ts")).toContain("`${INCLUI} ${extraNoLocal(d.servicoId ?? null, \"total\")}`");
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
