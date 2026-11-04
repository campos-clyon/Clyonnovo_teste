import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONCELHOS_DA_COBERTURA,
  concelhoDoCodigoPostal,
  concelhoDoPedido,
  concelhoDoPonto,
  concelhoDoTexto,
  concelhoPorId,
} from "./concelhos-da-cobertura";
import {
  coberturaPorConcelho,
  corDaCobertura,
  pedidosPorConcelho,
  type NegociacaoParaACobertura,
  type ParceiroParaACobertura,
} from "./cobertura-por-concelho";
import {
  lerOrigemDaCandidatura,
  limparOrigemDaCandidatura,
  origemParaACandidatura,
} from "./origem-da-candidatura";

/**
 * A COBERTURA POR CONCELHO E O RECRUTAMENTO POR ZONA — 04-11-2026 (d16).
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("os concelhos", () => {
  it("os 16 de hoje, pela ordem da ordem, e Vila Franca de Xira e Mafra na Fase B", () => {
    expect(CONCELHOS_DA_COBERTURA.map((c) => c.nome)).toEqual([
      "Lisboa", "Almada", "Seixal", "Sintra", "Oeiras", "Setúbal", "Barreiro", "Amadora", "Cascais", "Montijo",
      "Odivelas", "Palmela", "Sesimbra", "Alcochete", "Loures", "Moita", "Vila Franca de Xira", "Mafra",
    ]);
    expect(CONCELHOS_DA_COBERTURA.filter((c) => c.faseB).map((c) => c.id)).toEqual(["vila-franca-de-xira", "mafra"]);
  });

  it("nenhum código postal cai em dois concelhos", () => {
    for (let cp = 1000; cp <= 2999; cp++) {
      const donos = CONCELHOS_DA_COBERTURA.filter((c) => c.codigosPostais.some(([de, ate]) => cp >= de && cp <= ate));
      expect(donos.length, String(cp)).toBeLessThanOrEqual(1);
    }
  });

  it("o código postal diz o concelho, também nas excepções de Lisboa", () => {
    const casos: Array<[string, string]> = [
      ["1000-001", "lisboa"], ["1495-123", "oeiras"], ["1675-001", "odivelas"], ["1885-001", "loures"],
      ["2845-123", "seixal"], ["2865", "seixal"], ["2860-001", "moita"], ["2835-001", "moita"], ["2830-001", "barreiro"],
      ["2825-001", "almada"], ["2735-001", "sintra"], ["2745-001", "sintra"], ["2700-001", "amadora"],
      ["2780-001", "oeiras"], ["2750-001", "cascais"], ["2870-001", "montijo"], ["2890-001", "alcochete"],
      ["2900-001", "setubal"], ["2925-001", "setubal"], ["2955-001", "palmela"], ["2975-001", "sesimbra"],
      ["2615-001", "vila-franca-de-xira"], ["2640-001", "mafra"], ["2685-001", "loures"], ["2620-001", "odivelas"],
    ];
    for (const [cp, id] of casos) expect(concelhoDoCodigoPostal(cp), cp).toBe(id);
    expect(concelhoDoCodigoPostal("4000-001")).toBeNull();
    // Num texto, só o código inteiro: quatro algarismos soltos podem ser a porta.
    expect(concelhoDoCodigoPostal("Lote 2845", true)).toBeNull();
    expect(concelhoDoCodigoPostal("Rua X, 2845-123 Amora", true)).toBe("seixal");
  });

  it("o nome da terra, a mais comprida primeiro, e Lisboa só se mais nada aparecer", () => {
    expect(concelhoDoTexto("Amora")).toBe("seixal");
    expect(concelhoDoTexto("Santo António dos Cavaleiros")).toBe("loures");
    expect(concelhoDoTexto("Santo António da Charneca")).toBe("barreiro");
    expect(concelhoDoTexto("Portela de Carnaxide")).toBe("oeiras");
    expect(concelhoDoTexto("Póvoa de Santa Iria")).toBe("vila-franca-de-xira");
    expect(concelhoDoTexto("Santa Iria de Azóia")).toBe("loures");
    expect(concelhoDoTexto("Baixa da Banheira")).toBe("moita");
    expect(concelhoDoTexto("Rua de Lisboa 5, Amadora")).toBe("amadora");
    expect(concelhoDoTexto("Lisboa")).toBe("lisboa");
    expect(concelhoDoTexto("Porto")).toBeNull();
  });

  it("o pedido: o código postal ganha ao nome, e o ponto no mapa é o último recurso", () => {
    expect(concelhoDoPedido({ postalCode: "2845-123", city: "Lisboa" })).toBe("seixal");
    expect(concelhoDoPedido({ city: "Corroios" })).toBe("seixal");
    expect(concelhoDoPedido({ address: "Rua da Liberdade 10, Cacém" })).toBe("sintra");
    expect(concelhoDoPedido({ lat: 38.79, lng: -9.31 })).toBe("sintra");
    expect(concelhoDoPonto({ lat: 41.15, lng: -8.61 })).toBeNull();
    expect(concelhoDoPedido({})).toBeNull();
  });

  it("o id da zona aceita o nome com acentos", () => {
    expect(concelhoPorId("Setúbal")?.id).toBe("setubal");
    expect(concelhoPorId("vila franca de xira")?.id).toBe("vila-franca-de-xira");
    expect(concelhoPorId("porto")).toBeNull();
  });
});

describe("a conta do quadro", () => {
  const agora = new Date("2026-11-04T12:00:00Z");
  const diasAtras = (d: number, h = 0) => new Date(agora.getTime() - d * 86_400_000 - h * 3_600_000).toISOString();
  const SINTRA = CONCELHOS_DA_COBERTURA.find((c) => c.id === "sintra")!.centro;
  const parceiro = (id: number, x: Partial<ParceiroParaACobertura> = {}): ParceiroParaACobertura => ({
    id,
    estado: "aprovado",
    isActive: 1,
    raioKm: 50,
    baseLat: SINTRA.lat + 0.02,
    baseLng: SINTRA.lng,
    ...x,
  });
  /** Um trabalho feito há `d` dias, com a proposta 1 h depois do envio. */
  const trabalho = (providerId: number, pedidoId: number, d: number): NegociacaoParaACobertura => ({
    providerId,
    pedidoId,
    estado: "acordada",
    createdAt: diasAtras(d, 2),
    propostasJson: JSON.stringify([{ por: "profissional", valor: 100, criadaEm: diasAtras(d, 1), estado: "aceite" }]),
    execucaoEnviadaEm: diasAtras(d),
  });

  it("a cor: 2 ou mais fortes = verde, 1 = amarelo, 0 = vermelho", () => {
    expect(corDaCobertura(3)).toBe("verde");
    expect(corDaCobertura(2)).toBe("verde");
    expect(corDaCobertura(1)).toBe("amarelo");
    expect(corDaCobertura(0)).toBe("vermelho");
  });

  it("forte é de base perto, com 2 trabalhos em 30 dias e a responder em 6 h; as contas de teste não contam", () => {
    const negociacoes = [trabalho(1, 101, 3), trabalho(1, 102, 10), trabalho(2, 103, 5), trabalho(2, 104, 20), trabalho(9, 105, 2), trabalho(9, 106, 4)];
    const um = coberturaPorConcelho({ parceiros: [parceiro(1), parceiro(9, { deTeste: true })], negociacoes, pedidos: [], agora });
    const sintra = um.linhas.find((l) => l.id === "sintra")!;
    expect(sintra.fortes).toBe(1);
    expect(sintra.cor).toBe("amarelo");
    expect(sintra.basePerto).toBe(1);
    const dois = coberturaPorConcelho({ parceiros: [parceiro(1), parceiro(2)], negociacoes, pedidos: [], agora });
    expect(dois.linhas.find((l) => l.id === "sintra")!.cor).toBe("verde");
    // Longe (Setúbal fica a mais de 25 km de Sintra): no raio grande, mas não perto.
    const setubal = dois.linhas.find((l) => l.id === "setubal")!;
    expect(setubal.basePerto).toBe(0);
    expect(setubal.cor).toBe("vermelho");
  });

  it("no raio pelo raio de cada um; pendentes e suspensos ficam de fora", () => {
    const r = coberturaPorConcelho({
      parceiros: [parceiro(1, { raioKm: 10 }), parceiro(2, { raioKm: 200 }), parceiro(3, { estado: "pendente" })],
      negociacoes: [],
      pedidos: [],
      agora,
    });
    expect(r.linhas.find((l) => l.id === "sintra")!.noRaio).toBe(2);
    expect(r.linhas.find((l) => l.id === "setubal")!.noRaio).toBe(1);
  });

  it("activos em 14 e em 30 dias: uma proposta ou um trabalho na janela", () => {
    const proposta = (providerId: number, d: number): NegociacaoParaACobertura => ({
      providerId,
      pedidoId: 200 + providerId,
      estado: "aberta",
      createdAt: diasAtras(d, 1),
      propostasJson: JSON.stringify([{ por: "profissional", valor: 90, criadaEm: diasAtras(d), estado: "pendente" }]),
    });
    const r = coberturaPorConcelho({
      parceiros: [parceiro(1), parceiro(2), parceiro(3)],
      negociacoes: [proposta(1, 2), proposta(2, 20), proposta(3, 45)],
      pedidos: [],
      agora,
    });
    const sintra = r.linhas.find((l) => l.id === "sintra")!;
    expect(sintra.activos14).toBe(1);
    expect(sintra.activos30).toBe(2);
  });

  it("os pedidos de 30 dias do concelho, a 1.ª proposta em menos de 6 h e os fechados", () => {
    const pedidos = [
      { id: 1, createdAt: diasAtras(2, 10), postalCode: "2735-001" },
      { id: 2, createdAt: diasAtras(3, 10), postalCode: "2735-002" },
      { id: 3, createdAt: diasAtras(4, 10), city: "Queluz", status: "concluido" },
      { id: 4, createdAt: diasAtras(40), postalCode: "2735-003" },
      { id: 5, createdAt: diasAtras(1), city: "Porto" },
      { id: 6, createdAt: diasAtras(1), postalCode: "2735-004", deTeste: true },
    ];
    const negociacoes: NegociacaoParaACobertura[] = [
      // #1: proposta 1 h depois, e contratado.
      { providerId: 1, pedidoId: 1, estado: "acordada", createdAt: diasAtras(2, 10), propostasJson: JSON.stringify([{ por: "profissional", valor: 1, criadaEm: diasAtras(2, 9), estado: "aceite" }]) },
      // #2: proposta 8 h depois.
      { providerId: 1, pedidoId: 2, estado: "aberta", createdAt: diasAtras(3, 10), propostasJson: JSON.stringify([{ por: "profissional", valor: 1, criadaEm: diasAtras(3, 2), estado: "pendente" }]) },
    ];
    const r = coberturaPorConcelho({ parceiros: [parceiro(1)], negociacoes, pedidos, agora });
    const sintra = r.linhas.find((l) => l.id === "sintra")!;
    expect(sintra.pedidos30).toBe(3);
    expect(sintra.comPropostaEm6h).toBe(1);
    expect(sintra.percentagemEm6h).toBe(33);
    expect(sintra.fechados).toBe(2);
    expect(r.pedidosSemConcelho).toBe(1);
  });

  it("para a página de recrutamento: só os concelhos com o mínimo", () => {
    const pedidos = [
      ...Array.from({ length: 5 }, (_, i) => ({ id: i, createdAt: null, postalCode: "2735-001" })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: 10 + i, createdAt: null, postalCode: "2750-001" })),
    ];
    expect(pedidosPorConcelho(pedidos, 5)).toEqual({ sintra: 5 });
  });
});

describe("o recrutamento por zona", () => {
  it("a zona do anúncio vai com a origem — só um dos 18", () => {
    const o = origemParaACandidatura(null, null, "sintra");
    expect(o.zona).toBe("sintra");
    expect(origemParaACandidatura(null, null, "porto").zona).toBeUndefined();
    expect(limparOrigemDaCandidatura({ codigo: "D0", zona: "Cascais" })?.zona).toBe("cascais");
    expect(limparOrigemDaCandidatura({ codigo: "D0", zona: "<script>" })?.zona).toBeUndefined();
    expect(lerOrigemDaCandidatura({ codigo: "D0", zona: "sintra" })).toContain("zona: Sintra");
  });

  it("o formulário lê ?zona=, e a página só diz o número com o mínimo", () => {
    expect(ler("src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx")).toContain('.get("zona")');
    const pagina = ler("src/app/quero-ser-parceiro/page.tsx");
    expect(pagina).toContain("pedidosDoMesPorConcelho(MINIMO_PARA_MOSTRAR)");
    expect(pagina).toContain("<ProcuraNaZona porConcelho={doMesPorConcelho} />");
    const zona = ler("src/app/quero-ser-parceiro/ProcuraNaZona.tsx");
    expect(zona).toContain("na sua zona ({zona.nome}) este mês");
    expect(ler("src/lib/pedidos-da-semana.ts")).toContain("export const MINIMO_PARA_MOSTRAR = 5;");
  });

  it("o quadro é só do backoffice e só de leitura", () => {
    const rota = ler("src/app/api/admin/profissionais/cobertura/route.ts");
    expect(rota).toContain("await requireAdmin(req)");
    expect(rota).not.toMatch(/export async function (POST|PATCH|PUT|DELETE)/);
    expect(ler("src/components/admin/AdminProfissionaisSeccao.tsx")).toContain("<CoberturaPorConcelho />");
  });
});
