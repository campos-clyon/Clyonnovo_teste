import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AS_CARGAS_CONFIRMAM_SE_NO_LOCAL,
  AS_HORAS_CONTAM_SE_NO_DIA,
  fraseDaBase,
  fraseDaBaseAoProfissional,
  regraDaBase,
} from "./frase-da-base";
import { mensagemDeAdjudicacao } from "./mensagem-de-adjudicacao";
import { mensagemDoOrcamento } from "./mensagem-do-orcamento";
import { mensagemDasPropostas, propostasParaOCliente } from "./mensagem-das-propostas";
import { mensagemDosValoresParaPagamento } from "./valores-para-pagamento";
import { lerRespostaAoLembrete, textoDoFechoAoCliente, textoDoLembrete, textoDoUltimoAviso } from "./validade-do-orcamento";
import { notaDoPrecoParaOCliente } from "./itens-a-mais";
import { avisoDaBaseParaOCliente, notaDaCargaParaOCliente } from "./base-do-preco";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";

/**
 * d63 (CEO e dono, 18-11-2026): o que se diz ao cliente segue a BASE do preço,
 * numa fonte única (`frase-da-base.ts`). O #556 (por carga, 360 €/carga) levou
 * «o volume a mais combina-se consigo» na adjudicação do modelo antigo.
 */

const AGORA = new Date("2026-11-18T15:00:00Z");
const DO_TOTAL = /volume a mais|mais coisas/i;

describe("d63 — a frase da base", () => {
  it("por carga: o valor, as cargas confirmadas no local e o exemplo", () => {
    expect(fraseDaBase("carga", "esvaziamento_casa", { semIva: 360, total: 442.8 })).toBe(
      "O valor é 360 € + IVA (442,80 €) por carga. O número de cargas é confirmado consigo no local, pelo parceiro, antes de começar. " +
        "Por exemplo: 1 carga = 442,80 €; 2 cargas = 885,60 €.",
    );
  });

  it("por hora: o valor por hora com IVA ao lado, o mínimo real e as horas na folha", () => {
    expect(fraseDaBase("hora", "mudanca", { semIva: 50, total: 61.5, minimoHoras: 4 })).toBe(
      "O valor é 50 €/h + IVA (61,50 €/h), com mínimo de 4 horas. As horas contam-se no dia e o total fica na folha que valida no fim.",
    );
    expect(fraseDaBase("hora", "mudanca", { semIva: 50, total: 61.5 })).toContain("com mínimo de 3 horas");
  });

  it("no total: o que cobre e o extra no local, como sempre", () => {
    expect(fraseDaBase("total", "esvaziamento_casa")).toBe(
      "Inclui o que está nas fotografias e na descrição. Se no dia houver mais coisas, o volume a mais combina-se consigo antes de carregar.",
    );
  });

  it("sem número, nunca o sem IVA sozinho: «O valor é por carga.» e a regra", () => {
    expect(fraseDaBase("carga", null)).toBe(`O valor é por carga. ${AS_CARGAS_CONFIRMAM_SE_NO_LOCAL}`);
    expect(fraseDaBase("hora", null)).toBe(`O valor é por hora, com mínimo de 3 horas. ${AS_HORAS_CONTAM_SE_NO_DIA}`);
  });

  it("ao profissional, depois do aceite", () => {
    expect(fraseDaBaseAoProfissional("carga", 360)).toBe(
      "O cliente aceitou 360 €/carga. Confirme o número de cargas com o cliente no local, antes de carregar.",
    );
    expect(fraseDaBaseAoProfissional("total", 360)).toBeNull();
  });
});

describe("d63 — nenhuma mensagem de base carga ou hora fala do «volume a mais», e a regra é a mesma em todo o lado", () => {
  const casos: Array<{ base: "carga" | "hora"; regra: string }> = [
    { base: "carga", regra: AS_CARGAS_CONFIRMAM_SE_NO_LOCAL },
    { base: "hora", regra: AS_HORAS_CONTAM_SE_NO_DIA },
  ];

  for (const { base, regra } of casos) {
    const mensagens: Record<string, string> = {
      "adjudicação (modelo antigo, o #556)": mensagemDeAdjudicacao(
        {
          cliente: "Ana Silva",
          quando: null,
          servico: "esvaziamento_casa",
          localidade: "Lisboa",
          empresa: "Parceiro Exemplo",
          base,
          valor: base === "carga" ? { semIva: 360, total: 442.8 } : null,
        },
        AGORA,
      ),
      "adjudicação (modelo de 15-11)": mensagemDeAdjudicacao(
        {
          cliente: "Ana",
          quando: null,
          servico: "esvaziamento_casa",
          empresa: "Parceiro Exemplo",
          formas: {
            comDadosDoDono: false,
            referencias: [],
            novoModelo: {
              total: base === "carga" ? 442.8 : 246,
              semIva: base === "carga" ? 360 : 200,
              base,
              porHora: base === "hora" ? { semIva: 50, total: 61.5 } : null,
              formas: ["transferencia"],
            },
          },
        },
        AGORA,
      ),
      "orçamento / Enviar pela CLYON": mensagemDoOrcamento(
        {
          cliente: "Ana",
          servicoComArtigo: "o esvaziamento de casa",
          servicoId: "esvaziamento_casa",
          semIva: 360,
          total: 442.8,
          base,
          modelo: "clyon",
        },
        AGORA,
      ),
      "valor único": mensagemDoOrcamento(
        {
          cliente: "Ana",
          servicoComArtigo: "o esvaziamento de casa",
          servicoId: "esvaziamento_casa",
          semIva: 360,
          total: 442.8,
          base,
          modelo: "valor_unico",
        },
        AGORA,
      ),
      propostas: mensagemDasPropostas({
        nomeCliente: "Ana",
        servico: "esvaziamento de casa",
        servicoId: "esvaziamento_casa",
        base,
        propostas: propostasParaOCliente([
          {
            estado: "pendente",
            profissionalNome: "Parceiro Exemplo",
            propostasJson: JSON.stringify([{ por: "profissional", valor: 300, estado: "pendente", criadaEm: "2026-11-18T10:00:00Z" }]),
            criadaEm: "2026-11-18T09:00:00Z",
          },
        ]),
      }),
      "valores para pagamento": mensagemDosValoresParaPagamento(
        {
          pedidoId: 556,
          cliente: "Ana",
          servico: "esvaziamento_casa",
          localidade: "Lisboa",
          quando: null,
          base,
          conta: { semIva: 360, iva: 82.8, total: 442.8 },
        },
        AGORA,
      ),
      "lembrete da validade": textoDoLembrete({
        pedidoId: 556,
        nome: "Ana",
        servico: "esvaziamento de casa",
        semIva: 360,
        total: 442.8,
        unidade: base,
        parceiro: "Parceiro Exemplo",
      }),
      "último aviso da validade": textoDoUltimoAviso({
        pedidoId: 556,
        nome: "Ana",
        servico: "esvaziamento de casa",
        semIva: 360,
        total: 442.8,
        unidade: base,
        parceiro: null,
      }),
      "nota do preço (Vitória, emails, a app de cliente)": notaDoPrecoParaOCliente(base, "clyon", "esvaziamento_casa"),
      "nota com o parceiro": notaDoPrecoParaOCliente(base, "profissional", "esvaziamento_casa"),
      "a página do pedido": avisoDaBaseParaOCliente(base) ?? "",
      "a nota da carga": notaDaCargaParaOCliente(base) ?? "",
    };
    for (const [onde, texto] of Object.entries(mensagens)) {
      it(`${base} — ${onde}`, () => {
        expect(texto).not.toMatch(DO_TOTAL);
        expect(texto).toContain(regra);
      });
    }
  }

  it("a regra da base é a mesma letra a letra nas mensagens com o exemplo das cargas", () => {
    const regra = regraDaBase("carga", null, { semIva: 360, total: 442.8 });
    expect(
      mensagemDeAdjudicacao(
        { cliente: null, quando: null, servico: "esvaziamento_casa", base: "carga", valor: { semIva: 360, total: 442.8 } },
        AGORA,
      ),
    ).toContain(regra);
    expect(
      mensagemDoOrcamento(
        { cliente: null, servicoComArtigo: null, servicoId: "esvaziamento_casa", semIva: 360, total: 442.8, base: "carga", modelo: "clyon" },
        AGORA,
      ),
    ).toContain(regra);
    expect(
      textoDoLembrete({ pedidoId: 1, nome: null, servico: "esvaziamento de casa", semIva: 360, total: 442.8, unidade: "carga", parceiro: null }),
    ).toContain(regra);
  });

  it("o total continua a dizer o que cobre (e o volume a mais, no esvaziamento)", () => {
    const m = mensagemDeAdjudicacao({ cliente: null, quando: null, servico: "esvaziamento_casa", base: "total" }, AGORA);
    expect(m).toContain("Inclui o que está nas fotografias e na descrição.");
  });
});

describe("d63 — a Vitória e o caso de 18-11 (#603, cliente inglesa)", () => {
  it("as respostas que valem «3»", () => {
    for (const t of [
      "sorted",
      "Sorted now",
      "all sorted",
      "All sorted, thanks!",
      "already done",
      "found someone",
      "I've found someone else",
      "no longer need",
      "no longer needed",
      "I don't need it anymore",
      "not needed",
      "no thanks",
      "No thank you",
      "já resolvi",
      "Já está resolvido",
      "já tratei",
      "já não é preciso",
      "arranjei outra empresa",
    ]) {
      expect(lerRespostaAoLembrete(t), t).toBe("cancelar");
    }
  });

  it("as respostas que valem «1»", () => {
    for (const t of ["yes", "Yes!", "ok", "OK", "okay", "go ahead", "Yes, go ahead", "sim", "1"]) {
      expect(lerRespostaAoLembrete(t), t).toBe("avancar");
    }
  });

  it("o que não é claro continua a ir à equipa", () => {
    for (const t of ["sorted? not sure", "yes but on another day", "sim, mas noutro dia", "what time?"]) {
      expect(lerRespostaAoLembrete(t), t).toBeNull();
    }
  });

  it("os lembretes têm tradução fixa em inglês (sem o tradutor não saem em português)", () => {
    const dados = {
      pedidoId: 603,
      nome: "Jane",
      servico: "recolha de monos",
      semIva: 105,
      total: 129.15,
      unidade: "carga" as const,
      parceiro: "Parceiro Exemplo",
    };
    for (const texto of [textoDoLembrete(dados), textoDoUltimoAviso(dados), textoDoFechoAoCliente(603), textoDoLembrete({ ...dados, unidade: null, parceiro: null })]) {
      const en = traducaoFixa(texto, "en");
      expect(en, texto).not.toBeNull();
      expect(en).not.toMatch(/orçamento|pedido|carga|Responda/);
    }
  });

  it("os lembretes e o fecho saem na língua do cliente, ou não saem (passam à equipa)", () => {
    const fonte = readFileSync(join(__dirname, "validade-do-orcamento-na-base.ts"), "utf8");
    expect(fonte.split("{ semLinguaErrada: true })").length - 1).toBe(2);
    const canal = readFileSync(join(__dirname, "whatsapp-cloud.ts"), "utf8");
    expect(canal).toContain("return enviarTextoPorCanal(para, texto, { semLinguaErrada: opcoes.semLinguaErrada === true });");
  });
});
