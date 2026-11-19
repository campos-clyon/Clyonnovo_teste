import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mensagemDoOrcamento, oQueGanha, RESPONDA_SIM_COM_QUEM, RESPONDA_SIM_CURTO, type DadosDoOrcamento } from "./mensagem-do-orcamento";
import { mensagemDaPropostaClyon, precoDaPropostaClyon } from "./proposta-clyon-ao-cliente";
import { mensagemDoValorUnico } from "./valor-unico";
import { mensagemDoLembrete, type Lembrete } from "./propostas-sem-resposta";
import { linkDeWhatsApp } from "./link-de-whatsapp";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { passoDaPergunta } from "./reler-a-conversa";
import { eUmSimAoValorUnico, decidirOValorUnico } from "./valor-unico-no-whatsapp";
import { lerARespostaDirecta } from "./ler-a-resposta";
import { avisoDosItens } from "./itens-a-mais";
import { PECAS_EM_TEXTO, PRECOS, RECOLHA_MINIMA_DOS_MOVEIS, MONOS_SEM_PECAS_CONTADAS } from "./precos-publicos";
import { desdeSemEComIva, etiquetaComOIvaAoLado } from "./preco-de-referencia";
import { calculateFastEstimate } from "./pricing-helper";
import { alteracoesParaAApp, CAMPOS_QUE_SE_ALTERAM, lerAlteracao, oQueMudou } from "./alteracoes-do-cliente";
import { retratoDoPedido } from "./recomecar-do-zero";

/**
 * AS MENSAGENS PRONTAS SEM EMOJI, PELO api.whatsapp.com — 17-11-2026 (d66), e os
 * acertos da d64 (servidor) e da d62/d63.
 *
 * O link do WhatsApp (`wa.me`) estragava os caracteres acima de U+FFFF: o 😊 do
 * «Responda SIM» chegava ao cliente como «�». As mensagens que vão por link
 * deixam de ter emoji, o link vai directo ao api.whatsapp.com, e os textos são
 * os do Vendas.
 */

const NOITE = new Date("2026-11-15T21:40:00Z");
const ACIMA_DE_FFFF = /[\u{10000}-\u{10FFFF}]/u;

const BASE: DadosDoOrcamento = {
  cliente: "Jason",
  servicoComArtigo: "a recolha de monos",
  servicoId: "recolha_monos",
  localidade: "Campo de Ourique Lisboa",
  semIva: 105,
  total: 129.15,
  base: "total",
  modelo: "clyon",
};

const SERVICOS = [
  "recolha_moveis", "recolha_monos", "recolha_entulho", "esvaziamento_casa", "esvaziamento_apartamento", "esvaziamento_garagem",
  "esvaziamento_sotao", "esvaziamento_cave", "esvaziamento_empresa", "mudanca", "manutencao_casa", "outro", null,
];

const LEMBRETE: Lembrete = {
  pedidoId: 812, servico: "recolha de monos", fase: "24h", horas: 25, quantas: 1,
  valorDoCliente: "105 € + IVA = 129,15 €", unidade: "", isento: false, verificados: true,
};

/** Todas as mensagens prontas que saem por link (orçamento, proposta CLYON, valor único, lembretes). */
function todasAsMensagens(): string[] {
  const m: string[] = [];
  for (const servicoId of SERVICOS) {
    for (const base of ["total", "carga", "hora"] as const) {
      for (const modelo of ["clyon", "parceiro", "valor_unico"] as const) {
        m.push(mensagemDoOrcamento({ ...BASE, servicoId, base, modelo }, NOITE));
        m.push(mensagemDoOrcamento({ ...BASE, servicoId, base, modelo, comQuemJaEscolhido: true }, NOITE));
        m.push(mensagemDoOrcamento({ ...BASE, servicoId, base, modelo, quemFaz: "Mudanças Exemplo, parceiro da CLYON" }, NOITE));
      }
    }
  }
  const preco = precoDaPropostaClyon({ valorFixo: 105, taxa: 0.1, precoAoCliente: null })!;
  m.push(mensagemDaPropostaClyon({ cliente: "Jason", servico: "recolha_monos", localidade: "Lisboa", quando: null, preco, base: "total" }, NOITE));
  m.push(mensagemDoValorUnico({ nomeCliente: "Jason", servico: "esvaziamento de apartamento", servicoId: "esvaziamento_apartamento", cidade: "Odivelas", valorSemIva: 450, base: "total" }, NOITE));
  for (const fase of ["24h", "72h"] as const) for (const quantas of [1, 3]) m.push(mensagemDoLembrete({ ...LEMBRETE, fase, quantas }));
  return m;
}

describe("d66: sem emoji no que vai por link", () => {
  it("nenhuma mensagem pronta tem um carácter acima de U+FFFF", () => {
    const comEmoji = todasAsMensagens().filter((t) => ACIMA_DE_FFFF.test(t));
    expect(comEmoji).toEqual([]);
  });

  it("nem as traduções fixas das mensagens do orçamento", () => {
    for (const lingua of ["en", "fr", "es"] as const) {
      for (const servicoId of SERVICOS) {
        const t = traducaoFixa(mensagemDoOrcamento({ ...BASE, servicoId }, NOITE), lingua);
        expect(t, `${lingua}/${servicoId}`).not.toBeNull();
        expect(ACIMA_DE_FFFF.test(t as string), `${lingua}/${servicoId}`).toBe(false);
      }
    }
  });

  it("nem os ficheiros que as escrevem (fora dos comentários)", () => {
    const FICHEIROS = [
      "src/lib/mensagem-do-orcamento.ts", "src/lib/extra-no-local.ts", "src/lib/propostas-sem-resposta.ts",
      "src/lib/proposta-clyon-ao-cliente.ts", "src/lib/valor-unico.ts", "src/lib/valor-unico-ao-cliente.ts",
      "src/lib/mensagem-das-propostas.ts", "src/lib/mensagem-de-adjudicacao.ts",
    ];
    for (const f of FICHEIROS) {
      const codigo = readFileSync(join(process.cwd(), f), "utf8")
        .split(/\r?\n/)
        .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
        .join("\n");
      expect(ACIMA_DE_FFFF.test(codigo), f).toBe(false);
    }
  });
});

describe("d66: o link abre pelo api.whatsapp.com", () => {
  it("com o número internacional e o texto codificado", () => {
    const texto = mensagemDoOrcamento(BASE, NOITE);
    const l = linkDeWhatsApp("912 345 678", texto)!;
    expect(l.startsWith("https://api.whatsapp.com/send?phone=351912345678&text=")).toBe(true);
    expect(decodeURIComponent(new URL(l).searchParams.get("text") ?? "")).toBe(texto);
    expect(new URL(l).searchParams.get("text")).toBe(texto);
    expect(l).not.toContain("wa.me");
  });

  it("um número que não serve continua sem link", () => {
    expect(linkDeWhatsApp("123", "olá")).toBeNull();
    expect(linkDeWhatsApp(null, "olá")).toBeNull();
  });
});

describe("d66: os textos do Vendas", () => {
  it("o exemplo da recolha, letra a letra", () => {
    expect(mensagemDoOrcamento(BASE, NOITE)).toBe(
      [
        "Boa noite, Jason! O orçamento para a recolha de monos em Campo de Ourique é 105 € + IVA = 129,15 €.",
        `Inclui o que está nas fotografias e na descrição. O parceiro carrega e leva tudo: não tem de mexer em nada. O que aparecer a mais combina-se consigo antes de carregar, pela tabela (peça ${PECAS_EM_TEXTO}, + IVA).`,
        "Paga à CLYON depois do trabalho feito.",
        "Responda SIM e reservamos o parceiro; o dia combina-se consigo.",
      ].join("\n"),
    );
  });

  it("o valor único herda as linhas, com quem faz pela linha do pagamento", () => {
    const m = mensagemDoValorUnico(
      { nomeCliente: "Jason", servico: "esvaziamento de apartamento", servicoId: "esvaziamento_apartamento", cidade: "Odivelas", valorSemIva: 450, base: "total" },
      new Date("2026-11-15T15:00:00Z"),
    );
    expect(m).toBe(
      [
        "Boa tarde, Jason! O orçamento para o esvaziamento de apartamento em Odivelas é 450 € + IVA = 553,50 €.",
        "Inclui o que está nas fotografias e na descrição. O parceiro tira tudo e a casa fica vazia: não tem de tratar de nada. Se no dia houver mais coisas, o volume a mais combina-se consigo antes de carregar.",
        "Quem faz é um parceiro verificado da sua zona.",
        RESPONDA_SIM_CURTO,
      ].join("\n"),
    );
  });

  it("sem frase do que ganha, a linha não leva espaços a mais", () => {
    expect(oQueGanha("outro")).toBe("");
    expect(oQueGanha(null)).toBe("");
    const l = mensagemDoOrcamento({ ...BASE, servicoId: "outro" }, NOITE).split("\n")[1];
    expect(l).toBe("Inclui o que está nas fotografias e na descrição. Se houver mais a fazer, orça-se à parte e combina-se consigo antes.");
    expect(l).not.toMatch(/ {2}/);
  });

  it("com quem faz: «Responda SIM e fica reservado.»", () => {
    const m = mensagemDoOrcamento({ ...BASE, quemFaz: "Mudanças Exemplo, parceiro da CLYON" }, NOITE);
    expect(m.split("\n")[3]).toBe(`O trabalho é feito por Mudanças Exemplo, parceiro da CLYON. ${RESPONDA_SIM_COM_QUEM}`);
    expect(RESPONDA_SIM_COM_QUEM).toBe("Responda SIM e fica reservado.");
    expect(traducaoFixa(m, "en")).toContain("Reply YES and it is booked.");
  });

  it("os lembretes das 24 e das 72 horas", () => {
    expect(mensagemDoLembrete(LEMBRETE)).toBe(
      "Olá! O seu pedido #812 já tem uma proposta de um parceiro verificado: 105 € + IVA = 129,15 €. Quer que a reservemos? Responda SIM, ou veja-a na ligação do pedido que lhe enviámos. Se o dia ou o valor não lhe servirem, diga-nos e falamos com o parceiro.",
    );
    const varias = mensagemDoLembrete({ ...LEMBRETE, quantas: 3 });
    expect(varias).toContain("já tem 3 propostas de parceiros verificados, desde 105 € + IVA = 129,15 €. Quer que reservemos a mais em conta?");
    const tarde = mensagemDoLembrete({ ...LEMBRETE, fase: "72h", quantas: 1 });
    expect(tarde).toBe(
      "Olá! A proposta do pedido #812 continua válida. Se ainda quiser avançar, responda SIM e reservamos a proposta. Se o preço não serve, diga quanto queria pagar e passamos isso aos parceiros. Se já resolveu de outra forma, diga-nos e fechamos o pedido.",
    );
    expect(mensagemDoLembrete({ ...LEMBRETE, fase: "72h", quantas: 2 })).toContain("As propostas do pedido #812 continuam válidas.");
    // O 72h continua sem link.
    expect(tarde).not.toContain("link");
  });
});

describe("d66: a Vitória continua a reconhecer o SIM", () => {
  it("nenhuma das mensagens novas se lê como uma pergunta do formulário (o SIM não vira resposta a outra coisa)", () => {
    const lidas = todasAsMensagens()
      .map((t) => [t, passoDaPergunta(t)] as const)
      .filter(([, p]) => p != null);
    expect(lidas).toEqual([]);
  });

  it("o «responda SIM» em minúscula (72h) e o «fica reservado» pedem a mesma resposta", () => {
    expect(mensagemDoLembrete({ ...LEMBRETE, fase: "72h" })).toContain("responda SIM e reservamos");
    expect(mensagemDoOrcamento({ ...BASE, quemFaz: "Mudanças Exemplo, parceiro da CLYON" }, NOITE)).toMatch(/Responda SIM e fica reservado\.$/);
  });

  it("o SIM do cliente lê-se como sim — com valor único por decidir, e nas propostas", () => {
    for (const r of ["SIM", "sim", "Sim.", "sim!"]) {
      expect(eUmSimAoValorUnico(r), r).toBe(true);
      expect(decidirOValorUnico(r, [812]), r).toEqual({ tipo: "aceite", pedidoId: 812 });
      expect(lerARespostaDirecta(r)?.tipo, r).toBe("sim");
    }
  });
});

describe("d62/d63: os acertos", () => {
  it("o motor dá aos monos sem peças os 65 € de antes (com o mínimo de 60), e o topo com acesso difícil", async () => {
    expect(MONOS_SEM_PECAS_CONTADAS).toBe(65);
    const e = await calculateFastEstimate({ serviceType: "recolha_monos", description: "um mono" });
    expect([e.estimateMinWithoutVat, e.estimateMaxWithoutVat, e.estimatedPriceWithoutVat]).toEqual([RECOLHA_MINIMA_DOS_MOVEIS, 100, 65]);
    expect(RECOLHA_MINIMA_DOS_MOVEIS).toBe(60);
  }, 60_000);

  it("ao público, os monos continuam «desde 60 € + IVA (73,80 € com IVA)»", () => {
    expect(PRECOS.recolha_monos.etiqueta).toBe("desde 60 €");
    expect(etiquetaComOIvaAoLado("recolha_monos")).toBe("desde 60 € + IVA (73,80 € com IVA)");
    expect(etiquetaComOIvaAoLado("recolha_monos")).toBe(desdeSemEComIva(60));
  });

  it("os cartões de /empresas e /sobre-nos com o com IVA ao lado", () => {
    expect(etiquetaComOIvaAoLado("esvaziamento_casa")).toBe("desde 260 € + IVA (319,80 € com IVA)");
    expect(etiquetaComOIvaAoLado("recolha_entulho")).toMatch(/€\/m³ \+ IVA \(.+€\/m³ com IVA\)$/);
    expect(etiquetaComOIvaAoLado("mudanca")).toBe("referência desde 40 €/hora + IVA (49,20 €/hora com IVA)");
    expect(etiquetaComOIvaAoLado("manutencao_casa")).toMatch(/^desde \d+ € \+ IVA \([\d,]+ € com IVA\)$/);
    for (const f of ["src/app/empresas/page.tsx", "src/app/sobre-nos/page.tsx"]) {
      const s = readFileSync(join(process.cwd(), f), "utf8");
      expect(s, f).not.toMatch(/maisIva\(PRECOS/);
      expect(s, f).toContain("etiquetaComOIvaAoLado(");
    }
  });

  it("o aviso ao profissional diz a tabela da d60 pela fonte", () => {
    const t = avisoDosItens("total", "profissional")!;
    expect(t).toContain(`(${PECAS_EM_TEXTO} + IVA)`);
    expect(t).toContain("grande 65 € a primeira e 50 € as seguintes");
  });
});

describe("d64 (servidor): as peças grandes no elevador, no «Alterar o pedido»", () => {
  it("é um campo de topo da lista, e a API lista-o", () => {
    expect(CAMPOS_QUE_SE_ALTERAM).toContain("pecasNoElevador");
    const a = alteracoesParaAApp({ fase: "analise", mudanca: false, pendenteEm: null });
    expect(a.campos).toContain("pecasNoElevador");
  });

  it("lê sim, nao e nao_sei — e recusa o resto", () => {
    for (const v of ["sim", "nao", "nao_sei"] as const) {
      const r = lerAlteracao({ pecasNoElevador: v });
      expect(r.ok && r.alteracao.pecasNoElevador).toBe(v);
    }
    expect(lerAlteracao({ pecasNoElevador: "talvez" }).ok).toBe(false);
    expect(lerAlteracao({ acesso: { floor: "2", hasElevator: "yes" }, pecasNoElevador: "nao" })).toEqual({
      ok: true,
      alteracao: { acesso: { floor: "2", hasElevator: "yes" }, pecasNoElevador: "nao" },
    });
    expect(oQueMudou({ pecasNoElevador: "nao" })).toBe("as peças grandes não cabem no elevador");
  });

  it("grava-se no rawOrderJson, como o simulador, sem recalcular a estimativa (como o andar e o elevador)", () => {
    const s = readFileSync(join(process.cwd(), "src/lib/alteracoes-na-base.ts"), "utf8");
    expect(s).toContain("raw.pecasNoElevador = a.pecasNoElevador;");
    expect(s).not.toMatch(/calculateFastEstimate|estimatedPrice/);
    // Na Mesa, «Aplicar» recomeça se mudar — como o andar.
    const antes = retratoDoPedido({ rawOrderJson: JSON.stringify({ pecasNoElevador: "sim" }) });
    const depois = retratoDoPedido({ rawOrderJson: JSON.stringify({ pecasNoElevador: "nao" }) });
    expect(antes.pecasNoElevador).toBe("sim");
    expect(depois.pecasNoElevador).toBe("nao");
  });
});
