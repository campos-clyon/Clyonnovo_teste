import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHEGADA_CONFIRMADA,
  escolherAChegada,
  HORAS_PARA_CONFIRMAR_A_CHEGADA,
  lerAChegada,
  motivoDeVariasChegadas,
  PECA_A_CONFIRMACAO_DA_CHEGADA,
  type ChegadaPorConfirmar,
} from "./chegada-pelo-whatsapp";
import { textoChegou } from "./avisos-do-terreno";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { VIAGEM_CONFIRMADA_DESDE } from "./viagem-ate-ao-cliente";
import type { NegociacaoNoTerreno } from "./db";

/**
 * A CONVERSA DA OFÉLIA, OU DO CHEGUEI — d3, 31-10-2026 (ordem do CEO com o sim do dono).
 *
 * O caso: o parceiro marca «Cheguei» na app Pro; o cliente do WhatsApp recebe
 * «Rui chegou à sua morada…» e não tinha como confirmar — o «Sim, ele já está
 * cá» levava de volta o ponto de situação, e o «Está feito» ficava preso.
 * Nomes e números INVENTADOS (o repositório é público).
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/* Só os comentários que começam a linha — ver a memória dos testes que lêem o código. */
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const DEPOIS = new Date(VIAGEM_CONFIRMADA_DESDE.getTime() + 3_600_000);
const AGORA = new Date(DEPOIS.getTime() + 3_600_000);

const N = (o: Partial<NegociacaoNoTerreno> = {}): NegociacaoNoTerreno =>
  ({
    id: 901,
    pedidoId: 777,
    providerId: 7,
    estado: "acordada",
    valorAcordado: "120",
    ajustesJson: null,
    execucaoEnviadaEm: null,
    confirmadoEm: null,
    pagoEm: null,
    aCaminhoEm: DEPOIS,
    proximoEm: DEPOIS,
    chegouEm: AGORA,
    chegadaConfirmadaEm: null,
    formaDePagamento: null,
    taxaCliente: null,
    taxaProfissional: null,
    createdAt: DEPOIS,
    ofertaClyon: null,
    profissionalNome: "Rui Exemplo",
    profissionalEmail: "rui@exemplo.test",
    profissionalTelefone: null,
    contactName: "Ofélia Valdeira",
    contactEmail: null,
    contactPhone: "910000000",
    serviceType: "recolha_monos",
    baseDoPreco: null,
    valorFixoClyon: null,
    ...o,
  }) as NegociacaoNoTerreno;

const C = (o: Partial<ChegadaPorConfirmar> = {}): ChegadaPorConfirmar => ({
  negociacaoId: 901,
  pedidoId: 777,
  providerId: 7,
  aCaminhoEm: DEPOIS,
  proximoEm: DEPOIS,
  chegouEm: AGORA,
  chegadaConfirmadaEm: null,
  ofertaClyon: null,
  valorFixoClyon: null,
  ...o,
});

describe("a conversa da Ofélia (o cheguei)", () => {
  it("o WhatsApp do «Cheguei» acaba a pedir o SIM", () => {
    const t = textoChegou(N(), AGORA);
    expect(t).toContain("Rui chegou à sua morada");
    expect(t.endsWith(PECA_A_CONFIRMACAO_DA_CHEGADA)).toBe(true);
    expect(PECA_A_CONFIRMACAO_DA_CHEGADA).toBe("Quando o vir, responda SIM para confirmar que chegou.");
  });

  it("numa viagem de antes da regra, ou num Trabalho CLYON, não se pede nada", () => {
    const antes = new Date(VIAGEM_CONFIRMADA_DESDE.getTime() - 60_000);
    expect(textoChegou(N({ aCaminhoEm: antes }), AGORA)).not.toContain("responda SIM");
    expect(textoChegou(N({ ofertaClyon: "directa" }), AGORA)).not.toContain("responda SIM");
  });

  it("o «SIM» e as formas de dizer que ele chegou confirmam", () => {
    for (const s of ["SIM", "Sim", "sim!", "Sim, ele já está cá", "Já chegou", "já chegou obrigada", "Está cá 👍", "Confirmo", "sim já chegou", "Yes", "Oui", "Sí"]) {
      expect(lerAChegada(s), s).toBe("confirma");
    }
  });

  it("«ainda não chegou» não confirma — passa a uma pessoa", () => {
    for (const s of ["Não", "Ainda não chegou", "ainda não", "Não vejo ninguém"]) expect(lerAChegada(s), s).toBe("ainda_nao");
  });

  it("o resto não é sobre a chegada e segue o caminho de sempre", () => {
    for (const s of ["Ok, obrigada", "A que horas vem?", "Quero outra recolha", "", "Tenho mais um sofá para levar, pode ser?"]) {
      expect(lerAChegada(s), s).toBeNull();
    }
  });

  it("presa ao trabalho do «Cheguei»: um só, esse; nenhum, nada; dois, uma pessoa", () => {
    expect(escolherAChegada([C()])).toEqual({ tipo: "um", chegada: C() });
    expect(escolherAChegada([])).toBeNull();
    // Já confirmada, de antes da regra, ou de um Trabalho CLYON: não conta.
    expect(escolherAChegada([C({ chegadaConfirmadaEm: AGORA })])).toBeNull();
    expect(escolherAChegada([C({ aCaminhoEm: new Date(VIAGEM_CONFIRMADA_DESDE.getTime() - 60_000) })])).toBeNull();
    expect(escolherAChegada([C({ valorFixoClyon: 200 })])).toBeNull();
    expect(escolherAChegada([C(), C({ negociacaoId: 902, pedidoId: 778 })])).toEqual({ tipo: "varios", pedidos: [777, 778] });
    expect(motivoDeVariasChegadas([777, 778])).toContain("#777 e #778");
  });

  it("a Vitória agradece com a frase combinada, e as duas frases têm tradução fixa", () => {
    expect(CHEGADA_CONFIRMADA).toBe("Obrigada! Fica confirmado — o parceiro já pode avançar.");
    for (const l of ["en", "fr", "es"] as const) {
      expect(traducaoFixa(CHEGADA_CONFIRMADA, l), l).not.toBeNull();
      expect(traducaoFixa(PECA_A_CONFIRMACAO_DA_CHEGADA, l), l).not.toBeNull();
    }
    expect(traducaoFixa(PECA_A_CONFIRMACAO_DA_CHEGADA, "en")).toContain("reply YES");
  });

  it("no cérebro: lê-se antes do aviso da data e da negociação, só no número dele e nas 6 h", () => {
    expect(HORAS_PARA_CONFIRMAR_A_CHEGADA).toBe(6);
    const neg = semNotas(ler("src/lib/whatsapp-negociacao.ts"));
    const corpo = neg.slice(neg.indexOf("export async function tratarMensagemDoCliente("));
    const aChegada = corpo.indexOf("chegada.lerAChegada(conteudo.texto)");
    expect(aChegada).toBeGreaterThan(-1);
    expect(aChegada).toBeLessThan(corpo.indexOf("avisoDeDataRecente(telefone, HORAS_PARA_RESPONDER_AO_AVISO)"));
    expect(aChegada).toBeLessThan(corpo.indexOf("const pedidos = await pedidosDoTelefone(telefone);"));
    expect(corpo).toContain("chegadasPorConfirmarDoTelefone(telefone, chegada.HORAS_PARA_CONFIRMAR_A_CHEGADA)");
    expect(corpo).toContain(`onde: "pelo WhatsApp", autorTipo: "cliente"`);
    expect(corpo).toContain("await enviarTextoWhatsApp(telefone, chegada.CHEGADA_CONFIRMADA);");
    expect(corpo).toContain("await avisarProfissionalDaChegadaConfirmada(quem);");

    const db = ler("src/lib/db.ts");
    const f = db.slice(db.indexOf("export async function chegadasPorConfirmarDoTelefone"), db.indexOf("/** Uma negociação com o que o terreno e o ajuste precisam"));
    expect(f).toContain("n.chegouEm IS NOT NULL AND n.chegadaConfirmadaEm IS NULL");
    expect(f).toContain("n.chegouEm >= NOW() - INTERVAL ? HOUR");
    expect(f).toContain("RIGHT(REGEXP_REPLACE(COALESCE(o.contactPhone, ''), '[^0-9]', ''), 9) = ?");
  });

  it("uma porta só para gravar: histórico, registo e o aviso ao profissional", () => {
    const c = ler("src/lib/confirmar-a-chegada.ts");
    expect(c).toContain("const gravou = await confirmarChegadaPeloCliente(c.negociacaoId, c.pedidoId);");
    expect(c).toContain("Cliente confirmou a chegada (negociação #${c.negociacaoId}, ${c.onde}).");
    expect(c).toContain(`acontecimento: "chegada_confirmada"`);
    expect(c).toContain(`title: "O cliente confirmou que chegou"`);
    expect(ler("src/lib/agir-como-cliente.ts")).toContain("await confirmarAChegada({ ...quem, onde: NA_PORTA[a.porta]");
  });
});
