import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  avisoAcimaDoValorUnico,
  diferencaEmTexto,
  escolherPorMim,
  mensagemDoValorUnico,
  valorUnicoComIva,
  valorUnicoSugerido,
  type CandidatoAoValorUnico,
} from "./valor-unico";
import { valorUnicoDaLinha, valorUnicoParaOCliente } from "./valor-unico-ao-cliente";
import { negociacoesParaOCliente, temValorUnico } from "./negociacoes-para-o-cliente";

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
/* 15-11 às 15h em Lisboa: «Boa tarde». */
const AGORA = new Date("2026-11-15T15:00:00Z");

describe("d39 — o valor único sugerido", () => {
  it("a mediana das propostas abertas: 125 / 140 / 150 → 140", () => {
    expect(valorUnicoSugerido([150, 125, 140])).toBe(140);
  });

  it("com duas, a média, arredondada a 5 €", () => {
    expect(valorUnicoSugerido([125, 140])).toBe(135); // 132,5 → 135
    expect(valorUnicoSugerido([120, 130])).toBe(125);
  });

  it("arredonda sempre a 5 €", () => {
    expect(valorUnicoSugerido([143])).toBe(145);
    expect(valorUnicoSugerido([142])).toBe(140);
    expect(valorUnicoSugerido([100, 110, 121, 300])).toBe(115); // (110 + 121) / 2 = 115,5
  });

  it("sem propostas, nada a sugerir; e nunca 0 €", () => {
    expect(valorUnicoSugerido([])).toBeNull();
    expect(valorUnicoSugerido([Number.NaN, 0, -3])).toBeNull();
    expect(valorUnicoSugerido([2])).toBe(5);
  });

  it("a Mesa passa a sugestão ao «Passar a valor fixo», pelas propostas que o cliente veria", () => {
    const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(MESA).toContain("valorUnicoSugerido(propostasParaOCliente(p.negociacoes).map((x) => x.semIva))");
    expect(MESA).toMatch(/<FormularioDaOferta[\s\S]{0,400}valorInicial=\{valorSugerido/);
  });
});

describe("d39 B — a mensagem do valor único (WhatsApp e email)", () => {
  const m = mensagemDoValorUnico(
    { nomeCliente: "Ana Teste", servico: "recolha de móveis", servicoId: "recolha_moveis", cidade: "Almada", valorSemIva: 140, base: "total" },
    AGORA,
  );

  it("serviço e zona, o valor com o IVA ao lado, quem faz e «Responda SIM»", () => {
    expect(m).toContain("Ana.");
    expect(m).toContain("Aqui é a CLYON.");
    expect(m).toContain("Para a recolha de móveis em Almada: 140,00 € + IVA = 172,20 €.");
    expect(m).toContain("Quem faz é um parceiro verificado da sua zona — quando aceitar, dizemos-lhe quem é, o dia e como pagar.");
    expect(m).toContain("Responda SIM para aceitar.");
  });

  it("o que cobre e os itens a mais pela tabela das peças (fonte única)", () => {
    expect(m).toContain("cobre o que está nas fotografias e na descrição");
    expect(m).toContain("tabela das peças");
    expect(m).toMatch(/15[^0-9][\s\S]*30[^0-9][\s\S]*50[^0-9][\s\S]*IVA/);
  });

  it("sem nomes nem lista, e nunca o sem IVA sozinho", () => {
    expect(m).not.toMatch(/propostas?\b/i);
    expect(m).not.toMatch(/\d,\d\d € sem IVA/);
    expect(valorUnicoComIva(140)).toBe("140,00 € + IVA = 172,20 €");
  });

  it("por hora, a unidade agarrada ao número", () => {
    const h = mensagemDoValorUnico({ nomeCliente: null, servico: "mudança", servicoId: "mudanca", cidade: null, valorSemIva: 50, base: "hora" }, AGORA);
    expect(h).toContain("Para a mudança: 50,00 € + IVA = 61,50 € por hora.");
  });

  it("o email usa as mesmas linhas", () => {
    const ROTA = ler("src/app/api/admin/negociacoes/route.ts");
    expect(ROTA).toContain("linhas: linhasDoValorUnico(");
    expect(ler("src/lib/email-proposta.ts")).toContain("export async function avisarClienteDoValorUnico(");
  });
});

describe("d39 B — «Escolher por mim»", () => {
  const c = (id: number, nome: string, semIva: number, media: number | null, quantas = 3, verificado = true): CandidatoAoValorUnico => ({
    negociacaoId: id,
    nome,
    semIva,
    nota: media == null ? null : { media, quantas },
    verificado,
  });

  it("o mais bem avaliado entre os que pediram até ao valor único", () => {
    const s = escolherPorMim([c(1, "A", 125, 4.2), c(2, "B", 140, 4.9), c(3, "C", 150, 5)], 140);
    expect(s?.candidato.nome).toBe("B");
    expect(s?.acimaDoValorUnico).toBe(false);
    expect(s?.diferenca).toBe(0);
  });

  it("sem avaliações, o mais barato dos que cabem; a diferença fica à vista", () => {
    const s = escolherPorMim([c(1, "A", 125, null), c(2, "B", 130, null)], 140);
    expect(s?.candidato.nome).toBe("A");
    expect(s?.diferenca).toBe(15);
    expect(diferencaEmTexto(140, 125)).toBe("reserva para imprevistos: +15,00 € (fica na parte da CLYON)");
  });

  it("ninguém cabe: o mais barato, e avisa-se antes de aceitar", () => {
    const s = escolherPorMim([c(1, "A", 160, 5), c(2, "B", 150, 3)], 140);
    expect(s?.candidato.nome).toBe("B");
    expect(s?.acimaDoValorUnico).toBe(true);
    expect(s?.diferenca).toBe(-10);
    expect(diferencaEmTexto(140, 150)).toBe("reserva para imprevistos: −10,00 € (a parte da CLYON desce)");
    expect(avisoAcimaDoValorUnico("B", 150, 140)).toContain("mais do que o valor único");
  });

  it("só parceiros verificados", () => {
    expect(escolherPorMim([c(1, "A", 100, 5, 3, false)], 140)).toBeNull();
    expect(escolherPorMim([c(1, "A", 100, 5, 3, false), c(2, "B", 130, 4)], 140)?.candidato.nome).toBe("B");
  });

  it("a Mesa avisa antes de aceitar, nos dois «Aceitar»", () => {
    const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(MESA).toContain("const acima = avisoDoValorUnico(pedido, negociacao);");
    expect(MESA).toContain('if (accao === "aceitar" && avisoAntesDeAceitar && !window.confirm(avisoAntesDeAceitar)) return;');
    expect(MESA).toContain("avisoAntesDeAceitar={avisoDoValorUnico(pedido, negociacao)}");
    // O «Enviar orçamento» e o «Enviar pela CLYON» usam a mensagem do valor único.
    expect(MESA).toContain("if (p.valorUnicoCliente != null && !trabalhoFechado(p.negociacoes)) {");
  });
});

describe("d39 B — o cliente só vê o valor único até a CLYON escolher", () => {
  const linhas = [
    { estado: "aberta", propostasJson: JSON.stringify([{ por: "profissional", valor: 125, estado: "pendente" }]), profissionalNome: "A" },
    { estado: "aberta", propostasJson: JSON.stringify([{ por: "profissional", valor: 150, estado: "pendente" }]), profissionalNome: "B" },
  ];

  it("com valor único, as propostas não saem; só a contratada", () => {
    expect(negociacoesParaOCliente(linhas, false).length).toBe(2);
    expect(negociacoesParaOCliente(linhas, false, 140)).toEqual([]);
    expect(negociacoesParaOCliente(linhas, false, "140.00")).toEqual([]);
    expect(negociacoesParaOCliente(linhas, false, 1)).toEqual([]);
    const comAcordo = [
      ...linhas,
      { estado: "acordada", propostasJson: JSON.stringify([{ por: "profissional", valor: 125, estado: "aceite" }]), profissionalNome: "A" },
    ];
    expect(negociacoesParaOCliente(comAcordo, false, 140).map((n) => n.estado)).toEqual(["acordada"]);
    expect(temValorUnico(null)).toBe(false);
    expect(temValorUnico(0)).toBe(false);
  });

  it("o bloco do cliente diz o valor com o IVA e quem faz", () => {
    const t = valorUnicoParaOCliente(140, "total");
    expect(t.valor).toBe("140,00 € + IVA = 172,20 €");
    expect(t.quemFaz).toContain("parceiro verificado da sua zona");
    expect(valorUnicoDaLinha("140.00")).toBe(140);
    expect(valorUnicoDaLinha(null)).toBeNull();
  });

  it("todas as portas passam a marca: o link, a conta, a app e a lista", () => {
    expect(ler("src/lib/vista-do-pedido.ts")).toContain("pedido.valorUnicoCliente,");
    expect(ler("src/lib/pedidos-da-conta.ts")).toContain("negociacoesParaOCliente(linhas, pedido.trabalhoClyon, pedido.valorUnico)");
    expect(ler("src/lib/pedidos-do-cliente.ts")).toContain("(o.valorUnicoCliente IS NOT NULL) AS valorUnico,");
    expect(ler("src/lib/pedidos-do-cliente.ts")).toContain("negociacoesParaOCliente(cruas, trabalhoClyon, r.valorUnico)");
    expect(ler("src/lib/conta-server.ts")).toContain("(o.valorUnicoCliente IS NOT NULL) AS valorUnico, o.valorUnicoCliente,");
    expect(ler("src/app/api/users/me/orders/route.ts")).toContain("(o.valorUnicoCliente IS NOT NULL) AS valorUnico,");
    expect(ler("src/app/pedido/[token]/VistaDoPedido.tsx")).toContain("valorUnicoParaOCliente(v, base)");
  });

  it("pelo lado do cliente, nenhuma proposta se aceita, contrapropõe nem recusa", () => {
    const AGIR = ler("src/lib/agir-como-cliente.ts");
    expect(AGIR).toContain('["aceitar", "contratar", "propor", "recusar", "desistir"].includes(String(accao))');
    expect(AGIR).toContain("return falha(409, VALOR_UNICO_PELA_CLYON);");
  });

  it("as propostas que chegam depois não lhe são anunciadas; a Vitória não as conta", () => {
    expect(ler("src/lib/avisar-da-proposta.ts")).toMatch(/quemPropos === "profissional" && valorUnicoDaLinha\(/);
    expect(ler("src/lib/db.ts")).toContain("AND o.valorUnicoCliente IS NULL");
  });
});

describe("d39 B — a base", () => {
  const DB = ler("src/lib/db.ts");
  it("a migração é aditiva e a versão sobe", () => {
    expect(DB).toContain("ALTER TABLE simulatorOrders ADD COLUMN valorUnicoCliente DECIMAL(10,2) NULL DEFAULT NULL");
    expect(DB).toContain("ALTER TABLE simulatorOrders ADD COLUMN valorUnicoEm DATETIME NULL DEFAULT NULL");
    // 30 nesta decisão; as seguintes (d46…) só a sobem.
    expect(Number(DB.match(/const MIGRATION_VERSION = (\d+);/)?.[1])).toBeGreaterThanOrEqual(30);
  });
  it("grava-se só num pedido que negoceia, aberto e sem contratado — e as negociações não mudam", () => {
    const g = DB.slice(DB.indexOf("export async function gravarValorUnico("), DB.indexOf("export async function parceirosParaOValorUnico("));
    expect(g).toContain("WHERE id = ? AND valorFixoClyon IS NULL");
    expect(g).toContain("n.estado = 'acordada'");
    expect(g).not.toMatch(/UPDATE negociacoes/);
  });
});
