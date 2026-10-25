import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MINIMO_DE_HORAS,
  POR_ANDAR_SEM_ELEVADOR,
  PRECO_POR_HORA,
  PRECO_POR_HORA_COM_IVA,
  andaresAPe,
  deslocacao,
  horasEstimadas,
  orcamentoDaMudanca,
  tipologiaDoTexto,
  valorDePartidaPorHora,
} from "./tabela-das-mudancas";
import { avisoDaBase, baseValida, etiquetaDaBase, lerBase, precoComBase } from "./base-do-preco";
import { calculateFastEstimate, estimateLaborHours } from "./pricing-helper";
import { precoParaOCliente } from "./preco-do-cliente";
import { TAXAS_DE_ORIGEM } from "./taxas-plataforma";
import { mensagemDasPropostas, propostasParaOCliente, SAO_PRECOS_POR_HORA } from "./mensagem-das-propostas";
import { porHoraSeFor } from "./sugestao-ajustada";
import { haAcrescimoPorItem } from "./itens-a-mais";
import { notaDoPrecoPara } from "./whatsapp-recolha";

/**
 * AS MUDANÇAS À HORA — 13-10-2026, a tabela do dono e as decisões dele:
 * 50 € sem IVA por hora (o que o cliente paga), mínimo 3 horas, km acima de
 * 50 a 1,30 € ida e volta, 15 € por pessoa e andar sem elevador, horas pela
 * tipologia, e publicado no site.
 */

describe("a tabela", () => {
  it("50 € + IVA por hora, mínimo 3 horas", () => {
    expect(PRECO_POR_HORA).toBe(50);
    expect(PRECO_POR_HORA_COM_IVA).toBe(61.5);
    expect(MINIMO_DE_HORAS).toBe(3);
  });

  it("as horas pela tipologia, nunca abaixo do mínimo", () => {
    expect(horasEstimadas("T0")).toBe(3);
    expect(horasEstimadas("T2")).toBe(4);
    expect(horasEstimadas("T3")).toBe(5);
    expect(horasEstimadas("T4+")).toBe(7);
    expect(horasEstimadas("T2", true)).toBe(5);
    expect(horasEstimadas(null)).toBe(3);
  });

  it("a tipologia lê-se das palavras do cliente", () => {
    expect(tipologiaDoTexto("É um T2 pequeno")).toBe("T2");
    expect(tipologiaDoTexto("moradia V3")).toBe("T3");
    expect(tipologiaDoTexto("um T5 com sótão")).toBe("T4+");
    expect(tipologiaDoTexto("um estúdio")).toBe("T0");
    expect(tipologiaDoTexto("só alguns móveis")).toBe("itens");
    // «tv 32 polegadas» não é um T3
    expect(tipologiaDoTexto("duas tv de 32 polegadas")).toBeNull();
  });

  it("a deslocação: incluída até 50 km; acima, todos os km ida e volta a 1,30 €", () => {
    expect(deslocacao(30)).toBe(0);
    expect(deslocacao(50)).toBe(0);
    expect(deslocacao(80)).toBe(208);
  });

  it("cada andar sem elevador são 15 € por pessoa — 45 € a equipa de 3", () => {
    expect(POR_ANDAR_SEM_ELEVADOR).toBe(45);
    expect(andaresAPe("3", "no")).toBe(3);
    expect(andaresAPe("3", "yes")).toBe(0);
    expect(andaresAPe("0", "no")).toBe(0);
    expect(andaresAPe("-1", "no")).toBe(0);
  });

  it("um T2 de um 3º sem elevador para um r/c, a 80 km", () => {
    const c = orcamentoDaMudanca({
      tipologia: "T2",
      kmPercurso: 80,
      origem: { floor: "3", hasElevator: "no" },
      destino: { floor: "0", hasElevator: "no" },
      materiais: { caixa: 20, fita: 2 },
    });
    expect(c.horas).toBe(4);
    expect(c.maoDeObra).toBe(200);
    expect(c.deslocacao).toBe(208);
    expect(c.custoDosAndares).toBe(135);
    expect(c.materiais).toBe(44);
    expect(c.totalSemIva).toBe(587);
    expect(c.totalComIva).toBe(722.01);
  });

  it("o valor de partida é o do profissional: com a taxa de 5 %, dá os 50 € ao cliente", () => {
    const v = valorDePartidaPorHora(TAXAS_DE_ORIGEM);
    expect(v).toBe(47.62);
    expect(precoParaOCliente(v, TAXAS_DE_ORIGEM, "sem_iva")).toBe(50);
  });
});

describe("«por hora» é uma base, ao lado de «total» e «por carga»", () => {
  it("lê-se, diz-se e avisa", () => {
    expect(baseValida("hora")).toBe(true);
    expect(lerBase("hora")).toBe("hora");
    expect(etiquetaDaBase("hora")).toBe("por hora");
    expect(precoComBase("47,62 €", "hora")).toBe("47,62 € por hora");
    expect(avisoDaBase("hora")).toMatch(/POR HORA/);
  });

  it("à hora não há acréscimo por item — o que aparecer a mais paga-se nas horas", () => {
    expect(haAcrescimoPorItem("hora")).toBe(false);
    expect(haAcrescimoPorItem("total")).toBe(true);
  });

  it("a mensagem das propostas diz «por hora» e o mínimo", () => {
    const m = mensagemDasPropostas({
      propostas: propostasParaOCliente([
        {
          estado: "pendente",
          profissionalNome: "TRSul",
          propostasJson: JSON.stringify([{ por: "profissional", valor: 47.62, estado: "pendente", criadaEm: "2026-10-13T10:00:00Z" }]),
          criadaEm: "2026-10-13T09:00:00Z",
        },
      ]),
      base: "hora",
    });
    expect(m).toMatch(/TRSul: .* por hora/);
    expect(m).toContain(SAO_PRECOS_POR_HORA);
  });
});

describe("o motor usa a tabela", () => {
  it("as horas de uma mudança vêm da tipologia, e não das 7 fixas", () => {
    expect(estimateLaborHours({ serviceType: "mudanca", description: "Mudança de um T2" })).toBe(4);
    expect(estimateLaborHours({ serviceType: "mudanca", tipologia: "T4+" })).toBe(7);
    expect(estimateLaborHours({ serviceType: "mudanca" })).toBe(3);
  });

  it("um T1 sem nada de especial: 3 h a 50 € = 150 € sem IVA", async () => {
    const e = await calculateFastEstimate({ serviceType: "mudanca", tipologia: "T1" });
    expect(e.estimatedPriceWithoutVat).toBe(150);
  });

  it("a sugestão ao profissional, num pedido à hora, é por hora", () => {
    const s = porHoraSeFor({
      horas: 4,
      pessoas: 3,
      custoHoraPessoa: 9,
      custoKm: 0.5,
      kmDeCarro: 10,
      custoCombustivel: 5,
      custoPessoal: 108,
      custosFixos: 17,
      seguroDeRisco: 0,
      riscoPercent: 0,
      custoMinimo: 130,
      margem: 0.5,
      precoSugerido: 195,
      recebeSePropuser: 183.3,
      lucroEstimado: 53.3,
      porCarga: false,
      porHora: true,
      comOsSeusCustos: false,
      semDistancia: false,
      pressupostos: [],
    });
    expect(s.precoSugerido).toBe(48.75);
    expect(s.custoMinimo).toBe(32.5);
    expect(s.pressupostos.at(-1)).toMatch(/^Por hora:/);
  });
});

describe("o assistente do WhatsApp diz a tabela a quem pergunta o preço de uma mudança", () => {
  it("numa mudança, a nota do preço leva a hora; nos outros serviços, não", () => {
    expect(notaDoPrecoPara("quanto custa?", "quando", false, "mudanca")).toContain("50 € + IVA por hora · mínimo 3 horas");
    expect(notaDoPrecoPara("quanto custa?", "quando", false, "recolha_moveis")).not.toContain("por hora");
  });
});

describe("o site publica a tabela", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  it("a página das mudanças, as das cidades e as dos tipos mostram o preço à hora", () => {
    expect(ler("src/app/mudancas/page.tsx")).toContain("<TabelaDasMudancas />");
    expect(ler("src/components/mudancas/PaginaDeTipoDeMudanca.tsx")).toContain("<TabelaDasMudancas compacta />");
    expect(ler("src/app/mudancas/[cidade]/page.tsx")).toContain("{PRECO_DA_MUDANCA_CURTO}");
    expect(ler("src/lib/precos-publicos.ts")).toContain('mudanca: { etiqueta: "50 €/hora + IVA", minimo: 150 }');
    expect(ler("src/lib/mudancas-cidades.ts")).not.toMatch(/Não há tabela/);
  });

  it("o simulador pergunta o tamanho da casa e mostra a estimativa", () => {
    const S = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
    expect(S).toContain('updateField("tipologia", t)');
    expect(S).toContain("orcamentoDaMudanca({");
  });

  it("os pedidos de mudança nascem à hora — do simulador, do WhatsApp e do backoffice", () => {
    expect(ler("src/app/api/simulador/pedido/route.ts")).toContain('...(eMudanca ? ({ baseDoPreco: "hora" }');
    expect(ler("src/lib/registar-pedido-por-whatsapp.ts")).toContain('baseDoPreco: porHora ? "hora" : "total"');
    expect(ler("src/components/admin/RegistarPedido.tsx")).toContain('if (v === "mudanca") novo.baseDoPreco = "hora";');
  });

  it("a ajuda do backoffice diz a hora que o servidor grava, e não a das taxas de origem (25-10-2026)", () => {
    const R = ler("src/components/admin/RegistarPedido.tsx");
    // Sem taxas, `valorDePartidaPorHora()` contava com as de origem: 47,62 € em vez dos 50,00 € gravados.
    expect(R).not.toContain("valorDePartidaPorHora()");
    expect(R).toContain('fetch("/api/admin/pedidos/criar", { cache: "no-store"');
    expect(R).toContain("d.valorDePartidaPorHora");
    const C = ler("src/app/api/admin/pedidos/criar/route.ts");
    const get = C.slice(C.indexOf("export async function GET("), C.indexOf("export async function POST("));
    expect(C.indexOf("export async function GET(")).toBeGreaterThan(-1);
    // O mesmo cálculo que o POST faz com o campo vazio.
    expect(get).toContain("valorDePartidaPorHora(await taxasActuais().catch(() => undefined))");
    expect(C.slice(C.indexOf("export async function POST("))).toContain(
      "valorDePartidaPorHora(await taxasActuais().catch(() => undefined))",
    );
  });
});
