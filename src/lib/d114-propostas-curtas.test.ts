import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * d114 — PROPOSTAS: POUCAS MENSAGENS, CURTAS, OS PORMENORES SÓ DEPOIS DE
 * ACEITAR (25-11-2026). Nomes, números e pedidos inventados.
 */

import { chavesDasPropostasVivas } from "./chaves-das-propostas";
import {
  cumprimento,
  lerAMensagemCurtaDasPropostas,
  mensagemCurtaDasPropostas,
  MINUTOS_ATE_A_PRIMEIRA_MENSAGEM,
  pelaMaisBarata,
  totalDoValorEscrito,
  valorCurto,
  type PropostaCurta,
} from "./propostas-curtas";
import { devidoDasPropostas, estadoDoEnvio, type PedidoParaOEnvio } from "./envio-das-propostas-ao-cliente";
import { escolhaNaLista, lerAListaDasPropostas, mesmoValorNaLista } from "./a-escolha-e-a-desistencia";
import { chaveDaAceitacao, chaveDaProposta } from "./assistente-automatico";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { AS_TRES_OPCOES, textoDoLembrete, textoDoUltimoAviso } from "./validade-do-orcamento";
import { AS_OPCOES_DO_SEGUIMENTO, textoDaMensagem1, textoDaMensagem2 } from "./seguimento-do-cliente";
import { AVISO_AO_MODELO } from "./vitoria-agente/aviso-ao-modelo";
import { diaEmLisboa } from "./hora-de-lisboa";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const MIN = 60_000;
const mais = (d: Date, m: number) => new Date(d.getTime() + m * MIN);
// 25-11-2026, 10h00 em Lisboa (UTC no Inverno).
const DEZ = new Date("2026-11-25T10:00:00Z");

const envio = (o: Partial<PedidoParaOEnvio> = {}): PedidoParaOEnvio => ({
  pedidoId: 9114,
  parceiros: 1,
  primeiraEm: DEZ,
  ultimaMudancaEm: DEZ,
  jaEnviado: false,
  base: "total",
  melhorComIva: 98.4,
  temTelemovel: true,
  novas: 1,
  ...o,
});

const TEJO: PropostaCurta = { negociacaoId: 1, parceiro: "Recolhas Tejo", semIva: 80, total: 98.4 };
const SADO: PropostaCurta = { negociacaoId: 2, parceiro: "Sado Transportes", semIva: 100, total: 123 };

describe("quando sai — 1 h, ou a 2.ª proposta, e depois uma por dia", () => {
  it("a 1.ª proposta espera 1 h", () => {
    expect(MINUTOS_ATE_A_PRIMEIRA_MENSAGEM).toBe(60);
    expect(devidoDasPropostas(envio()).toISOString()).toBe(mais(DEZ, 60).toISOString());
    expect(estadoDoEnvio(envio(), mais(DEZ, 30))).toMatchObject({ tipo: "sai", agora: false, porqueEspera: "prazo" });
    expect(estadoDoEnvio(envio(), mais(DEZ, 61))).toMatchObject({ tipo: "sai", agora: true });
  });

  it("a 2.ª antes de 1 h faz sair logo (passados os 10 min de assentar)", () => {
    const duas = envio({ parceiros: 2, segundaEm: mais(DEZ, 20), ultimaMudancaEm: mais(DEZ, 20) });
    expect(devidoDasPropostas(duas).toISOString()).toBe(mais(DEZ, 30).toISOString());
    expect(estadoDoEnvio(duas, mais(DEZ, 31))).toMatchObject({ tipo: "sai", agora: true });
  });

  it("o parceiro que aceita o valor do cliente não espera a hora", () => {
    const aceitou = envio({ aceitouEm: DEZ });
    expect(devidoDasPropostas(aceitou).toISOString()).toBe(mais(DEZ, 10).toISOString());
  });

  it("a janela: o que cai depois das 20h sai às 9h com o que houver", () => {
    const tarde = new Date("2026-11-25T19:30:00Z");
    const e = estadoDoEnvio(envio({ primeiraEm: tarde, ultimaMudancaEm: tarde }), mais(tarde, 61));
    expect(e).toMatchObject({ tipo: "sai", agora: false });
    expect(e.tipo === "sai" && e.quando.toISOString()).toBe("2026-11-26T09:00:00.000Z");
  });

  it("depois da 1.ª, as novas juntam-se numa por dia — no dia seguinte, às 9h", () => {
    const nova = envio({ ultimoEnvioEm: DEZ, primeiraEm: mais(DEZ, 60), ultimaMudancaEm: mais(DEZ, 60), novas: 1 });
    const e = estadoDoEnvio(nova, mais(DEZ, 180));
    expect(e).toMatchObject({ tipo: "sai", agora: false, porqueEspera: "amanha" });
    expect(e.tipo === "sai" && diaEmLisboa(e.quando)).toBe("2026-11-26");
    expect(e.tipo === "sai" && e.quando.toISOString()).toBe("2026-11-26T09:00:00.000Z");
    // No dia seguinte, sai.
    expect(estadoDoEnvio(nova, new Date("2026-11-26T09:05:00Z"))).toMatchObject({ tipo: "sai", agora: true });
  });

  it("a uma-por-dia de todas as rotinas também conta", () => {
    const e = estadoDoEnvio(envio(), mais(DEZ, 61), { jaSaiuHoje: true });
    expect(e).toMatchObject({ tipo: "sai", agora: false, porqueEspera: "uma_por_dia" });
  });

  it("nada sai sem propostas novas, depois de aceitar, ou depois de a equipa mandar à mão", () => {
    expect(estadoDoEnvio(envio({ novas: 0 }), mais(DEZ, 61)).tipo).toBe("ja_enviado");
    expect(estadoDoEnvio(envio({ fechado: true }), mais(DEZ, 61)).tipo).toBe("ja_enviado");
    expect(estadoDoEnvio(envio({ jaEnviado: true }), mais(DEZ, 61)).tipo).toBe("ja_enviado");
  });
});

describe("o texto — curto, humano, a mais barata primeiro", () => {
  it("uma proposta", () => {
    const t = mensagemCurtaDasPropostas({ pedidoId: 9114, nome: "Kelly Santos", servico: "recolha de monos", propostas: [TEJO], agora: DEZ, primeira: true });
    expect(t).toBe(
      "Bom dia, Kelly! 😊 Já tem a primeira proposta para o seu pedido #9114 (recolha de monos): 98,40 € (80 € + IVA), do parceiro Recolhas Tejo. Quer avançar? É só responder 1. Se preferir, espere um pouco, que podem chegar mais.",
    );
  });

  it("a nota só com avaliações", () => {
    const com = mensagemCurtaDasPropostas({ pedidoId: 9114, propostas: [{ ...TEJO, nota: { media: 4.8, quantas: 12 } }], agora: DEZ, primeira: true });
    expect(com).toContain("Tem nota 4,8 em 12 avaliações.");
    const sem = mensagemCurtaDasPropostas({ pedidoId: 9114, propostas: [{ ...TEJO, nota: { media: 0, quantas: 0 } }], agora: DEZ, primeira: true });
    expect(sem).not.toContain("Tem nota");
  });

  it("duas ou mais: a lista numerada, curta, pela mais barata", () => {
    const t = mensagemCurtaDasPropostas({ pedidoId: 9114, nome: "André", servico: "recolha de móveis", propostas: [SADO, TEJO], agora: DEZ, primeira: true });
    expect(t).toBe(
      [
        "Bom dia, André! Já tem 2 propostas para o seu pedido #9114 (recolha de móveis):",
        "1) Recolhas Tejo: 98,40 € (80 € + IVA)",
        "2) Sado Transportes: 123 € (100 € + IVA)",
        "Qual prefere? Responda com o número.",
      ].join("\n"),
    );
    expect(pelaMaisBarata([SADO, TEJO]).map((p) => p.parceiro)).toEqual(["Recolhas Tejo", "Sado Transportes"]);
  });

  it("o parceiro que aceitou o valor que o cliente propôs: curto, sem pormenores", () => {
    const t = mensagemCurtaDasPropostas({ pedidoId: 9114, nome: "Ana", servico: "recolha de monos", propostas: [{ ...TEJO, aceitou: true }], agora: new Date("2026-11-25T15:00:00Z"), primeira: false });
    expect(t).toBe("Boa tarde, Ana! Boas notícias: o parceiro Recolhas Tejo aceitou os 98,40 € (80 € + IVA) que propôs para o seu pedido #9114 (recolha de monos). Quer avançar? É só responder 1.");
  });

  it("o com IVA tem sempre o sem IVA ao lado; o isento diz o IVA que leva", () => {
    expect(valorCurto(TEJO)).toBe("98,40 € (80 € + IVA)");
    expect(valorCurto({ semIva: 85, total: 86.96, isento: true })).toBe("86,96 € (85 € + 1,96 € de IVA)");
    expect(valorCurto(TEJO, "carga")).toBe("98,40 € por carga (80 € + IVA)");
  });

  it("nenhum pormenor antes de aceitar, nem as palavras proibidas", () => {
    for (const t of [
      mensagemCurtaDasPropostas({ pedidoId: 9114, propostas: [TEJO], agora: DEZ, primeira: true }),
      mensagemCurtaDasPropostas({ pedidoId: 9114, propostas: [TEJO, SADO], agora: DEZ, primeira: false }),
      mensagemCurtaDasPropostas({ pedidoId: 9114, propostas: [{ ...TEJO, aceitou: true }], agora: DEZ, primeira: false }),
    ]) {
      expect(t).not.toMatch(/fatura|factura|taxa|adiantad|confirma-se|no local|MB WAY|IBAN|transferência|profissional|próprio dia|peça|itens/i);
      expect(t.split("\n").length).toBeLessThanOrEqual(5);
    }
  });

  it("o cumprimento pela hora de Lisboa", () => {
    expect(cumprimento(new Date("2026-11-25T09:00:00Z"), "rita")).toBe("Bom dia, Rita!");
    expect(cumprimento(new Date("2026-11-25T14:00:00Z"))).toBe("Boa tarde!");
    expect(cumprimento(new Date("2026-11-25T20:30:00Z"), "Rui")).toBe("Boa noite, Rui!");
  });
});

describe("a numeração bate com a d111 — o «1», o «2», o nome e o valor", () => {
  const agente = (p: PropostaCurta, n: number) =>
    ({
      n,
      negociacaoId: p.negociacaoId,
      pedidoId: 9114,
      parceiro: p.parceiro,
      estado: "proposta_do_parceiro",
      comoOClienteVe: `${p.semIva.toFixed(2).replace(".", ",")} € + IVA = ${p.total.toFixed(2).replace(".", ",")} €`,
      base: "total",
    }) as never;

  it("a lista lê-se pela porta da d111, e o «2» é a 2.ª que ele viu (a mais cara)", () => {
    const t = mensagemCurtaDasPropostas({ pedidoId: 9114, propostas: [SADO, TEJO], agora: DEZ, primeira: true });
    const lista = lerAListaDasPropostas(t)!;
    expect(lista.pedidoId).toBe(9114);
    expect(lista.linhas.map((l) => [l.n, l.parceiro])).toEqual([
      [1, "Recolhas Tejo"],
      [2, "Sado Transportes"],
    ]);
    // As propostas do agente vêm por outra ordem: o número é o da lista que ele viu.
    const r = escolhaNaLista("2", lista.linhas, [agente(SADO, 1), agente(TEJO, 2)]);
    expect(r.tipo === "escolheu" && (r.proposta as { parceiro: string }).parceiro).toBe("Sado Transportes");
    const pelo = escolhaNaLista("A da Recolhas Tejo", lista.linhas, [agente(SADO, 1), agente(TEJO, 2)]);
    expect(pelo.tipo === "escolheu" && (pelo.proposta as { parceiro: string }).parceiro).toBe("Recolhas Tejo");
  });

  it("o «1» à mensagem de uma só proposta aceita-a — e o valor que ele viu é o de agora", () => {
    const t = mensagemCurtaDasPropostas({ pedidoId: 9114, propostas: [TEJO], agora: DEZ, primeira: true });
    const lista = lerAListaDasPropostas(t)!;
    expect(lista.linhas).toEqual([{ n: 1, parceiro: "Recolhas Tejo", valor: "98,40 € (80 € + IVA)" }]);
    const r = escolhaNaLista("1", lista.linhas, [agente(TEJO, 1)]);
    expect(r.tipo).toBe("escolheu");
    expect(mesmoValorNaLista("98,40 € (80 € + IVA)", agente(TEJO, 1))).toBe(true);
    expect(mesmoValorNaLista("90 € (73,17 € + IVA)", agente(TEJO, 1))).toBe(false);
    expect(totalDoValorEscrito("75,00 € + IVA = 92,07 €")).toBe(92.07);
  });

  it("o «aceitou» também se lê, e o «1» fecha-o", () => {
    const t = mensagemCurtaDasPropostas({ pedidoId: 9114, propostas: [{ ...TEJO, aceitou: true }], agora: DEZ, primeira: false });
    expect(lerAMensagemCurtaDasPropostas(t)?.linhas[0]).toMatchObject({ n: 1, parceiro: "Recolhas Tejo" });
  });
});

describe("nunca se repete — a mesma chave nos três caminhos", () => {
  it("a chave de cada proposta é a de sempre (a proposta pendente e a aceitação)", () => {
    const negociacoes = [
      { id: 71, estado: "aberta", profissionalNome: "Recolhas Tejo", propostasJson: JSON.stringify([{ por: "profissional", valor: 80, estado: "pendente", criadaEm: DEZ.toISOString() }]) },
      { id: 72, estado: "aguarda_contratacao", profissionalNome: "Sado Transportes", valorAcordado: 100, propostasJson: "[]" },
      { id: 73, estado: "desistida", profissionalNome: "Outro", propostasJson: "[]" },
    ];
    expect(chavesDasPropostasVivas(negociacoes, DEZ).map((c) => c.chave)).toEqual([chaveDaProposta(71, 1), chaveDaAceitacao(72, 100)]);
  });

  it("a proposta nova e o «aceitou» já não saem um a um (o imediato e a passagem)", () => {
    const NEG = ler("src/lib/whatsapp-negociacao.ts");
    for (const f of ["export async function propostaParaOWhatsApp(", "export async function aceitacaoParaOWhatsApp("]) {
      const corpo = NEG.slice(NEG.indexOf(f), NEG.indexOf("enviarBotoesWhatsApp(", NEG.indexOf(f)));
      expect(corpo).toContain("if (A_ROTINA_DIZ_AS_PROPOSTAS) return false;");
    }
    const AA = ler("src/lib/assistente-automatico.ts");
    expect(AA).toContain('if (A_ROTINA_DIZ_AS_PROPOSTAS && (n.especie === "proposta_nova" || n.especie === "pro_aceitou")) continue;');
    expect(AA).toContain('if (A_ROTINA_DIZ_AS_PROPOSTAS && (especie === "proposta_nova" || especie === "pro_aceitou")) {');
  });

  it("a rotina marca as que disse, conta só as que ele não ouviu, e a conversa livre e a lista da d111 também marcam", () => {
    const BASE = ler("src/lib/envio-das-propostas-ao-cliente-na-base.ts");
    expect(BASE).toContain("const novas = vivas.filter((v) => !ditas.has(v.chave)).length;");
    const envio = BASE.slice(BASE.indexOf("export async function enviarAsPropostasAoCliente("));
    expect(envio.indexOf("enviarTextoManualWhatsApp(telefone, texto")).toBeLessThan(envio.indexOf("await marcarPropostasDitas(telefone, pedidoId, c.chaves);"));
    expect(ler("src/lib/vitoria-agente/ao-vivo-na-base.ts")).toContain("marcarAsPropostasNomeadas(telefone, texto)");
    expect(ler("src/lib/a-escolha-e-a-desistencia-no-whatsapp.ts")).toContain("await marcarAsPropostasNomeadas(telefone, texto);");
    // Na dúvida (a base falhou), todas contam como ditas: não se repete nada.
    expect(BASE).toContain("return new Set(limpas);");
  });

  it("só sai com os dois interruptores: «Enviar as propostas ao cliente» e «Avisar de propostas»", () => {
    const BASE = ler("src/lib/envio-das-propostas-ao-cliente-na-base.ts");
    expect(BASE).toContain('return await assistentePode("propostas");');
    for (const f of ["export async function rotinaDasPropostas(", "export async function passagemDasPropostas(", "export async function enviarAsPropostasAoCliente("]) {
      const corpo = BASE.slice(BASE.indexOf(f), BASE.indexOf("\n}\n", BASE.indexOf(f)));
      expect(corpo).toContain("podeDizerAsPropostas()");
    }
  });
});

describe("os pormenores só na confirmação, depois de aceitar", () => {
  it("a confirmação junta, curtos, os itens a mais, o «confirma-se no local» e o «nada adiantado»", () => {
    const NEG = ler("src/lib/whatsapp-negociacao.ts");
    const fecho = NEG.slice(NEG.indexOf("async function fecharPeloCliente("), NEG.indexOf("/** Recusar pelo cliente"));
    expect(fecho).toContain('alvo.base === "total" ? extraNoLocal(servicoDoPedido, "total") : ""');
    expect(fecho).toContain("ORCAMENTO_A_DISTANCIA,");
    expect(fecho).toContain('novo ? NAO_PAGA_NADA_ADIANTADO : ""');
    expect(fecho).toContain("${pormenores}");
    // O pagamento, a fatura e a isenção continuam lá.
    expect(fecho).toContain("quemPassaAFatura(alvo.linha)");
    expect(fecho).toContain("pagaAoContratado(");
  });

  it("o lembrete da validade e o seguimento ficam curtos, com as opções letra a letra", () => {
    const d = { pedidoId: 9114, nome: "Ana", servico: "recolha de monos", parceiro: "Recolhas Tejo", semIva: 80, total: 98.4, validaAte: "2026-11-27" } as never;
    for (const t of [textoDoLembrete(d), textoDoLembrete({ ...(d as object), pedidoId: 9115 } as never), textoDoUltimoAviso(d)]) {
      expect(t).toContain("O parceiro Recolhas Tejo faz por 98,40 € com IVA (80 € + IVA).");
      expect(t).toContain(AS_TRES_OPCOES);
      expect(t).not.toMatch(/adiantad|taxa|fatura|Tem nota/);
    }
    expect(AS_TRES_OPCOES.slice(0, 23)).toBe("Responda 1 para avançar");
    const s = { pedidoId: 9114, nome: "Ana", servico: "recolha de monos", resposta: "vai_pensar" } as never;
    for (const t of [textoDaMensagem1(s), textoDaMensagem2(s)]) {
      expect(t).toContain(AS_OPCOES_DO_SEGUIMENTO);
      expect(t).not.toMatch(/adiantad|taxa|IVA/);
    }
  });

  it("o aviso ao modelo: as propostas curtas e sem pormenores antes de aceitar", () => {
    expect(AVISO_AO_MODELO).toContain("AS PROPOSTAS, CURTAS");
    expect(AVISO_AO_MODELO).toContain("«1) Parceiro: 98,40 € (80 € + IVA)»");
    expect(AVISO_AO_MODELO).toContain("vão na confirmação, depois de aceitar");
  });
});

describe("os estrangeiros recebem o mesmo, pelas traduções fixas", () => {
  const textos = [
    mensagemCurtaDasPropostas({ pedidoId: 9114, nome: "Kelly", servico: "recolha de monos", propostas: [TEJO], agora: DEZ, primeira: true }),
    mensagemCurtaDasPropostas({ pedidoId: 9114, nome: "Kelly", servico: "recolha de monos", propostas: [{ ...TEJO, nota: { media: 4.5, quantas: 3 } }], agora: DEZ, primeira: false }),
    mensagemCurtaDasPropostas({ pedidoId: 9114, servico: "recolha de monos", propostas: [TEJO, SADO, { negociacaoId: 3, parceiro: "Isento Lda", semIva: 85, total: 86.96, isento: true }], agora: DEZ, primeira: true }),
    mensagemCurtaDasPropostas({ pedidoId: 9114, nome: "Kelly", servico: "recolha de monos", propostas: [{ ...TEJO, aceitou: true }], agora: DEZ, primeira: false }),
    mensagemCurtaDasPropostas({ pedidoId: 9114, servico: "recolha de monos", propostas: [TEJO], agora: DEZ, primeira: true, unidade: "carga" }),
  ];

  it("em inglês, francês e espanhol, com o IVA traduzido", () => {
    for (const t of textos) {
      for (const lingua of ["en", "fr", "es"] as const) {
        const fixa = traducaoFixa(t, lingua);
        expect(fixa, `${lingua}: ${t}`).not.toBeNull();
        expect(fixa).not.toMatch(/Já tem|Quer avançar|Responda com/);
      }
      expect(traducaoFixa(t, "en")).toMatch(/VAT/);
      expect(traducaoFixa(t, "fr")).toMatch(/TTC|TVA/);
    }
    expect(traducaoFixa(textos[0], "en")).toContain("98,40 € (80 € + VAT), from the partner Recolhas Tejo.");
  });
});
