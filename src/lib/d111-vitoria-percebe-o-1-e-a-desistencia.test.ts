import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * A VITÓRIA PERCEBE O «1» E A DESISTÊNCIA — d111 (CEO e dono, 24-11-2026).
 *
 * O caso: uma cliente com duas propostas respondeu «1» ao seguimento e a
 * Vitória passou à equipa; a seguir escreveu «Gostaria de escolher a proposta
 * da <parceiro> (no valor total de 92,07€)» e a Vitória calou-se. Outra
 * respondeu «Obrigado, já tenho outra opção» e a Vitória perguntou se queria
 * cancelar. Aqui: o «1» com uma proposta aceita, com duas lista e o «2» ou o
 * nome aceita; o nome depois de a Vitória ter passado à equipa no seguimento
 * aceita; a desistência clara cancela e diz que os dados serão apagados; «vou
 * pensar» e «obrigado» não cancelam; o pedido pago não cancela. A base, o
 * WhatsApp e o fecho são fingidos — nenhuma mensagem sai a ninguém. Nomes,
 * números e parceiros INVENTADOS (o repositório é público).
 */

const estado = vi.hoisted(() => ({
  enviados: [] as string[],
  entradas: [] as string[],
  passadas: [] as string[],
  chamadas: [] as Array<{ f: string; porque?: string }>,
  fechos: [] as Array<{ pedidoId: number; negociacaoId: number }>,
  cancelamentos: [] as Array<{ pedidoId: number; origem: string; mensagem?: string | null }>,
  retomadas: 0,
  propostas: [] as unknown[],
  pago: false,
  interrompida: false,
  motivo: null as string | null,
  fio: null as Array<{ direccao: string; texto: string; haSegundos: number | null }> | null,
  respondidaHaSegundos: null as number | null,
}));

vi.mock("@/lib/whatsapp-cloud", async (original) => ({
  ...(await original<typeof import("@/lib/whatsapp-cloud")>()),
  enviarTextoWhatsApp: vi.fn(async (_t: string, texto: string) => {
    estado.enviados.push(texto);
    return true;
  }),
}));

vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  interromperNumeroWhatsApp: vi.fn(async (_t: string, porque: string) => {
    estado.passadas.push(porque);
    estado.interrompida = true;
    estado.motivo = porque;
  }),
  retomarNumeroWhatsApp: vi.fn(async () => {
    estado.retomadas += 1;
    estado.interrompida = false;
  }),
  appendOrderHistory: vi.fn(async () => {}),
  whatsappLigado: vi.fn(async () => true),
  numeroBloqueadoWhatsApp: vi.fn(async () => false),
  numeroInterrompidoWhatsApp: vi.fn(async () => estado.interrompida),
  motivoDaEntregaWhatsApp: vi.fn(async () => estado.motivo),
  // O fio: as mensagens que saíram (e as que ele escreveu), há um minuto.
  mensagensDoNumeroWhatsApp: vi.fn(async () =>
    estado.fio ?? [
      ...estado.entradas.map((texto) => ({ direccao: "in", texto, criadoEm: "", haSegundos: 60 })),
      ...estado.enviados.map((texto) => ({ direccao: "out", texto, criadoEm: "", haSegundos: 60 })),
    ],
  ),
}));

vi.mock("@/lib/pedido-em-curso-na-base", async (original) => ({
  ...(await original<typeof import("@/lib/pedido-em-curso-na-base")>()),
  aEquipaNaConversa: vi.fn(async () => ({ respondidaHaSegundos: estado.respondidaHaSegundos, devolvidaHaSegundos: null })),
}));

vi.mock("@/lib/seguimento-do-cliente-na-base", async () => {
  const regras = await import("./validade-do-orcamento");
  return {
    pararSeguimento: vi.fn(async (_id: number, porque: string) => {
      estado.chamadas.push({ f: "parar", porque });
      return true;
    }),
    pedirConfirmacaoDoCancelamentoDoSeguimento: vi.fn(async (pedidoId: number) => {
      estado.chamadas.push({ f: "pedir" });
      estado.enviados.push(regras.textoDaConfirmacaoDoCancelamento(pedidoId));
      return { ok: true, estado: "pediu_confirmacao" };
    }),
    confirmarCancelamentoPeloSeguimento: vi.fn(async () => ({ ok: false, porque: "não há pergunta do CANCELAR a valer" })),
  };
});

vi.mock("@/lib/vitoria-agente/accoes-na-base", async (original) => ({
  ...(await original<typeof import("@/lib/vitoria-agente/accoes-na-base")>()),
  propostasParaEscolherDeVerdade: vi.fn(async () => estado.propostas),
  pedidoParaOFechoDeVerdade: vi.fn(async () => ({ status: "pendente", baseDoPreco: "total", temValorUnicoPorDecidir: false, temAcordada: false, jaPago: false })),
}));

vi.mock("@/lib/cancelar-pelo-cliente-na-base", async (original) => {
  const regras = await import("./cancelar-pelo-cliente");
  return {
    ...(await original<typeof import("@/lib/cancelar-pelo-cliente-na-base")>()),
    pedidosAbertosDoTelefone: vi.fn(async () => [612]),
    // As guardas de verdade (`porqueFicaComAEquipa`) sobre um pedido fingido.
    cancelarEApagarNaHora: vi.fn(async (pedidoId: number, o: { origem: string; mensagem?: string | null }) => {
      const fica = regras.porqueFicaComAEquipa({
        existe: true,
        status: "pendente",
        anonimizado: false,
        contratado: false,
        dataMarcada: false,
        pago: estado.pago,
        referenciaViva: false,
        faturado: false,
      });
      if (fica) return { ok: false, porque: fica, daEquipa: true };
      estado.cancelamentos.push({ pedidoId, origem: o.origem, mensagem: o.mensagem });
      estado.enviados.push(o.mensagem ?? regras.mensagemDoCancelamentoPeloCliente(pedidoId));
      return { ok: true, encerradas: 2, conversaApagada: true, mensagemPor: "whatsapp" };
    }),
  };
});

vi.mock("@/lib/whatsapp-negociacao", async (original) => ({
  ...(await original<typeof import("@/lib/whatsapp-negociacao")>()),
  pedidosDoTelefone: vi.fn(async () => [612]),
  fecharAEscolhaDoCliente: vi.fn(async (_t: string, pedidoId: number, negociacaoId: number) => {
    estado.fechos.push({ pedidoId, negociacaoId });
    estado.enviados.push(`[fechado #${pedidoId} com a negociação #${negociacaoId}]`);
    return true;
  }),
}));

import { responderAoSeguimentoDoCliente } from "./whatsapp-negociacao";
import { escolhaNumaConversaEntregue, oCodigoLeEstaResposta, responderALista, tratarADesistencia } from "./a-escolha-e-a-desistencia-no-whatsapp";
import {
  desisteClaramente,
  escolhaDita,
  lerAListaDasPropostas,
  mensagemDaDesistencia,
  pedidoDaEntregaPeloSeguimento,
  pedidoDoMotivoDoSeguimento,
  pedidoDaUltimaSaida,
  QUAL_QUER_ESCOLHER,
  textoDaListaDasPropostas,
} from "./a-escolha-e-a-desistencia";
import { textoDaMensagem1, textoDaMensagem2 } from "./seguimento-do-cliente";
import { PASSO_O_CANCELAMENTO_A_EQUIPA } from "./cancelar-pelo-cliente";
import { MENSAGEM_DE_PASSAR_A_UMA_PESSOA } from "./voz-da-vitoria";
import { MARCA_DE_MAO } from "./rajada-do-whatsapp";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { quemResponde } from "./vitoria-agente/ao-vivo";
import type { PropostaComOValorDoParceiro } from "./vitoria-agente/propostas-do-agente";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const TEL = "351910000111";
const PEDIDO = 612;
const M1 = textoDaMensagem1({ pedidoId: PEDIDO, nome: "Ana", servico: "recolha de monos", resposta: "vai_pensar" });

function proposta(n: number, negociacaoId: number, parceiro: string, semIva: number, total: number): PropostaComOValorDoParceiro {
  const v = (x: number) => x.toFixed(2).replace(".", ",");
  return {
    n,
    negociacaoId,
    pedidoId: PEDIDO,
    parceiro,
    estado: "proposta_do_parceiro",
    regime: "com_iva",
    fatura: "com IVA",
    conta: { trabalhoSemIva: semIva, ivaDoTrabalho: 0, taxaDaPlataformaSemIva: 0, ivaDaTaxa: 0, semIva, iva: total - semIva, total },
    comoOClienteVe: `${v(semIva)} € + IVA = ${v(total)} €`,
    explicacaoDoIva: "",
    base: "total",
    mudouEm: null,
    trabalhoClyon: false,
    valorDoParceiro: semIva,
  };
}

const TEJO = proposta(1, 3801, "Recolhas Tejo", 74.85, 92.07);
const SUL = proposta(2, 3802, "Monos do Sul", 90, 110.7);

const seguimento = (texto: string) => responderAoSeguimentoDoCliente(TEL, texto, { pedidoId: PEDIDO, aEsperaDeCancelar: false });

beforeEach(() => {
  estado.enviados = [M1];
  estado.entradas = [];
  estado.passadas = [];
  estado.chamadas = [];
  estado.fechos = [];
  estado.cancelamentos = [];
  estado.retomadas = 0;
  estado.propostas = [TEJO, SUL];
  estado.pago = false;
  estado.interrompida = false;
  estado.motivo = null;
  estado.fio = null;
  estado.respondidaHaSegundos = null;
});
afterEach(() => vi.clearAllMocks());

/* ── O «1» ────────────────────────────────────────────────────────────────── */

describe("o «1» ao seguimento", () => {
  it("com UMA proposta: aceita-a pelo fecho de sempre, sem passar à equipa", async () => {
    estado.propostas = [TEJO];
    await seguimento("1");
    expect(estado.fechos).toEqual([{ pedidoId: PEDIDO, negociacaoId: 3801 }]);
    expect(estado.passadas).toEqual([]);
    expect(estado.chamadas[0].f).toBe("parar");
    expect(estado.enviados).not.toContain(MENSAGEM_DE_PASSAR_A_UMA_PESSOA);
  });

  it("com DUAS: a lista numerada (o parceiro e o total com IVA) e «Qual quer escolher?» — e o «2» aceita a segunda", async () => {
    await seguimento("1");
    expect(estado.fechos).toEqual([]);
    expect(estado.passadas).toEqual([]);
    const lista = estado.enviados.at(-1) ?? "";
    // A cabeça numa linha à parte: o nome da empresa (inventado) não fica ao lado do número do pedido.
    const cabeca = "Tem 2 propostas para o pedido #612:";
    expect(lista).toBe(
      [cabeca, "1. Recolhas Tejo: 74,85 € + IVA = 92,07 €", "2. Monos do Sul: 90,00 € + IVA = 110,70 €", QUAL_QUER_ESCOLHER].join("\n"),
    );
    expect(lerAListaDasPropostas(lista)?.linhas.map((l) => l.parceiro)).toEqual(["Recolhas Tejo", "Monos do Sul"]);
    estado.entradas.push("2");
    expect(await responderALista(TEL, "2")).toBe(true);
    expect(estado.fechos).toEqual([{ pedidoId: PEDIDO, negociacaoId: 3802 }]);
    expect(estado.passadas).toEqual([]);
  });

  it("com DUAS: o nome (a frase do caso, com o valor) aceita essa", async () => {
    await seguimento("1");
    expect(await responderALista(TEL, "Gostaria de escolher a proposta da Recolhas Tejo (no valor total de 92,07€)")).toBe(true);
    expect(estado.fechos).toEqual([{ pedidoId: PEDIDO, negociacaoId: 3801 }]);
    expect(estado.passadas).toEqual([]);
  });

  it("com DUAS: «a da Monos do Sul», «a primeira» e «fico com a de 110,70» também", async () => {
    for (const [dito, neg] of [
      ["A da Monos do Sul", 3802],
      ["a primeira", 3801],
      ["fico com a de 110,70", 3802],
    ] as const) {
      estado.enviados = [M1];
      estado.fechos = [];
      await seguimento("1");
      expect(await responderALista(TEL, dito), dito).toBe(true);
      expect(estado.fechos, dito).toEqual([{ pedidoId: PEDIDO, negociacaoId: neg }]);
    }
  });

  it("à lista, um número que não está nela pergunta outra vez (com a lista); uma pergunta qualquer segue a conversa de sempre", async () => {
    await seguimento("1");
    expect(await responderALista(TEL, "5")).toBe(true);
    expect(estado.enviados.at(-1)?.startsWith("Não percebi qual das propostas do pedido #612 quer escolher:")).toBe(true);
    expect(estado.fechos).toEqual([]);
    expect(await responderALista(TEL, "Inclui o transporte até ao ecocentro?")).toBe(false);
  });

  it("à lista, se o valor mudou entretanto não fecha: a equipa confirma", async () => {
    await seguimento("1");
    estado.propostas = [TEJO, proposta(2, 3802, "Monos do Sul", 80, 98.4)];
    expect(await responderALista(TEL, "2")).toBe(true);
    expect(estado.fechos).toEqual([]);
    expect(estado.passadas[0]).toContain("a proposta mudou");
  });

  it("sem propostas: passa à equipa, como antes (com o motivo do seguimento)", async () => {
    estado.propostas = [];
    await seguimento("1");
    expect(estado.fechos).toEqual([]);
    expect(estado.passadas[0]).toContain("#612");
    expect(estado.passadas[0]).toContain("ao seguimento");
  });

  it("acima de 500 € com IVA (o limite do fecho pela Vitória) não fecha: anota a escolha e passa à equipa", async () => {
    estado.propostas = [proposta(1, 3803, "Recolhas Tejo", 450, 553.5)];
    await seguimento("1");
    expect(estado.fechos).toEqual([]);
    expect(estado.passadas[0]).toContain("acima de 500 €");
    expect(estado.enviados.at(-1)).toContain("Anotei que escolheu Recolhas Tejo");
  });

  it("a escolha por palavras ao próprio seguimento aceita essa", async () => {
    await seguimento("Gostaria de escolher a proposta da Monos do Sul");
    expect(estado.fechos).toEqual([{ pedidoId: PEDIDO, negociacaoId: 3802 }]);
    expect(estado.passadas).toEqual([]);
  });
});

/* ── O nome depois de a Vitória ter passado à equipa ─────────────────────── */

describe("o nome depois de a conversa ter passado à equipa pelo seguimento", () => {
  const MOTIVO_DE_ANTES = "Pedido #612: respondeu «1» ao seguimento — quer avançar, escolher o parceiro com ele";
  const fioDoCaso = (extra: Array<{ direccao: string; texto: string; haSegundos: number | null }> = []) => [
    { direccao: "out", texto: M1, haSegundos: 900 },
    { direccao: "in", texto: "1", haSegundos: 880 },
    { direccao: "out", texto: MENSAGEM_DE_PASSAR_A_UMA_PESSOA, haSegundos: 870 },
    ...extra,
    { direccao: "in", texto: "Gostaria de escolher a proposta da Recolhas Tejo (no valor total de 92,07€)", haSegundos: 5 },
  ];

  it("entregue pela Vitória (o motivo de antes da d111) e sem resposta de uma pessoa: retoma e aceita", async () => {
    estado.interrompida = true;
    estado.motivo = MOTIVO_DE_ANTES;
    estado.fio = fioDoCaso();
    expect(await escolhaNumaConversaEntregue(TEL, "Gostaria de escolher a proposta da Recolhas Tejo (no valor total de 92,07€)")).toBe(true);
    expect(estado.retomadas).toBe(1);
    expect(estado.fechos).toEqual([{ pedidoId: PEDIDO, negociacaoId: 3801 }]);
  });

  it("na dúvida (o nome bate nas duas), retoma e pergunta qual, com a lista", async () => {
    estado.interrompida = true;
    estado.motivo = MOTIVO_DE_ANTES;
    estado.fio = fioDoCaso();
    estado.propostas = [TEJO, proposta(2, 3802, "Recolhas Tejo Sul", 90, 110.7)];
    expect(await escolhaNumaConversaEntregue(TEL, "Quero escolher a proposta da Recolhas Tejo")).toBe(true);
    expect(estado.fechos).toEqual([]);
    expect(lerAListaDasPropostas(estado.enviados.at(-1))?.pedidoId).toBe(PEDIDO);
  });

  it("uma pessoa respondeu à mão depois (ou carregou em «Já respondi»): fica com a equipa", async () => {
    estado.interrompida = true;
    estado.motivo = MOTIVO_DE_ANTES;
    estado.fio = fioDoCaso([{ direccao: "out", texto: `${MARCA_DE_MAO} Bom dia, já vejo isso`, haSegundos: 300 }]);
    expect(await escolhaNumaConversaEntregue(TEL, "Gostaria de escolher a proposta da Recolhas Tejo")).toBe(false);
    estado.fio = fioDoCaso();
    estado.respondidaHaSegundos = 120;
    expect(await escolhaNumaConversaEntregue(TEL, "Gostaria de escolher a proposta da Recolhas Tejo")).toBe(false);
    expect(estado.retomadas).toBe(0);
    expect(estado.fechos).toEqual([]);
  });

  it("entregue por outro motivo (não o seguimento) ou sem nomear uma proposta: não mexe", async () => {
    estado.interrompida = true;
    estado.motivo = "Cliente insatisfeito com o atendimento — responder já";
    estado.fio = fioDoCaso();
    expect(await escolhaNumaConversaEntregue(TEL, "Gostaria de escolher a proposta da Recolhas Tejo")).toBe(false);
    estado.motivo = MOTIVO_DE_ANTES;
    expect(await escolhaNumaConversaEntregue(TEL, "Bom dia, a que horas vêm?")).toBe(false);
    expect(estado.retomadas).toBe(0);
  });

  it("os motivos do seguimento, de agora e de antes, reconhecem-se; os outros não", () => {
    expect(pedidoDoMotivoDoSeguimento(MOTIVO_DE_ANTES)).toBe(612);
    expect(pedidoDoMotivoDoSeguimento("Pedido #612: quer outra data («2» ao seguimento)")).toBe(612);
    expect(pedidoDoMotivoDoSeguimento("Respondeu ao seguimento do pedido #612 — responder")).toBe(612);
    expect(pedidoDoMotivoDoSeguimento("Pedido #612: disse que já não precisa (seguimento) — cancelar à mão")).toBe(612);
    expect(pedidoDoMotivoDoSeguimento("Pedido #612: o cliente disse que ia pensar — sem seguimento automático (desligado)")).toBeNull();
    expect(pedidoDoMotivoDoSeguimento("Cliente a perder a paciência — responder já")).toBeNull();
    expect(pedidoDaEntregaPeloSeguimento({ motivo: MOTIVO_DE_ANTES, fio: [] })).toBeNull();
  });
});

/* ── A desistência ───────────────────────────────────────────────────────── */

describe("a desistência clara cancela; o resto não", () => {
  it("«Obrigado, já tenho outra opção» ao seguimento: cancela já e diz que foi cancelado e que os dados serão apagados", async () => {
    await seguimento("Obrigado, já tenho outra opção");
    expect(estado.cancelamentos).toEqual([{ pedidoId: PEDIDO, origem: "desistencia", mensagem: mensagemDaDesistencia(PEDIDO) }]);
    const msg = estado.enviados.at(-1) ?? "";
    expect(msg).toContain("#612 foi cancelado");
    expect(msg).toContain("os dados do pedido serão apagados");
    expect(msg).toContain("pode pedir de novo quando quiser");
    expect(msg.startsWith("Obrigada")).toBe(true);
    expect(estado.chamadas.map((c) => c.f)).not.toContain("pedir");
    expect(estado.passadas).toEqual([]);
  });

  it("à lista e a uma proposta também («já contratei outra empresa»)", async () => {
    await seguimento("1");
    expect(await responderALista(TEL, "Já contratei outra empresa, obrigada")).toBe(true);
    expect(estado.cancelamentos.map((c) => c.origem)).toEqual(["desistencia"]);
    estado.enviados = [
      "Recolhas Tejo propõe 92,07 € para a sua recolha de monos (pedido #612).\n\nO valor já leva o IVA e a taxa da plataforma.",
    ];
    estado.cancelamentos = [];
    expect(await tratarADesistencia(TEL, "Já contratei outra empresa")).toBe(true);
    expect(estado.cancelamentos.map((c) => c.pedidoId)).toEqual([612]);
  });

  it("sem uma mensagem das propostas por último, a desistência não é daqui (segue a conversa de sempre)", async () => {
    estado.enviados = ["Obrigada, já passei à equipa, que lhe responde em breve."];
    expect(await tratarADesistencia(TEL, "Já tenho outra opção")).toBe(false);
    expect(estado.cancelamentos).toEqual([]);
  });

  it("«vou pensar», «obrigado», «ainda estou a decidir» e «vou ver» NÃO cancelam", async () => {
    for (const t of ["vou pensar", "Obrigado", "Ainda estou a decidir", "vou ver", "Obrigada pela informação"]) {
      expect(desisteClaramente(t), t).toBe(false);
      estado.enviados = [M1];
      await seguimento(t);
      expect(estado.cancelamentos, t).toEqual([]);
    }
  });

  it("d129: o «3» do menu cancela logo, sem pedir o CANCELAR — e a mensagem é a do porquê (d126)", async () => {
    await seguimento("3");
    expect(estado.chamadas.map((c) => c.f)).not.toContain("pedir");
    expect(estado.cancelamentos).toEqual([{ pedidoId: 612, origem: "desistencia", mensagem: null }]);
  });

  it("o pedido pago não cancela: vai à equipa, com a frase de sempre", async () => {
    estado.pago = true;
    await seguimento("Já não preciso, obrigado");
    expect(estado.cancelamentos).toEqual([]);
    expect(estado.passadas[0]).toContain("o pedido já tem um pagamento");
    expect(estado.passadas[0]).toContain("tratar à mão");
    expect(estado.enviados.at(-1)).toBe(PASSO_O_CANCELAMENTO_A_EQUIPA);
  });

  it("as frases claras, em português, inglês, francês e espanhol", () => {
    for (const t of [
      "Obrigado, já tenho outra opção",
      "Já contratei outra empresa",
      "já escolhi outra empresa, obrigada",
      "Já não preciso",
      "já não preciso do serviço, obrigado",
      "Já resolvi, obrigada",
      "Não estou interessado",
      "Já tenho quem faça",
      "Optei por outra proposta",
      "We already found someone else, thanks",
      "Not interested anymore",
      "We don't need it anymore",
      "All sorted now",
      "Nous avons déjà trouvé quelqu'un",
      "Plus besoin, merci",
      "Ya contraté a otra empresa",
      "Ya no lo necesito, gracias",
    ]) {
      expect(desisteClaramente(t), t).toBe(true);
    }
  });

  it("as que não são claras: perguntas, condições, «mas», «talvez», uma parte do serviço", () => {
    for (const t of [
      "Já não preciso?",
      "Se calhar já não preciso",
      "Talvez já tenha outra opção",
      "Já tenho outra proposta, mas prefiro a vossa",
      "Já não preciso da desmontagem",
      "Ainda não decidi",
      "3",
      "CANCELAR",
      "Vou ter de avançar com outra empresa se não me responderem",
      "Já fiz as fotografias",
    ]) {
      expect(desisteClaramente(t), t).toBe(false);
    }
  });
});

/* ── Os textos, as traduções e a ligação ao resto ─────────────────────────── */

describe("os textos, as traduções fixas e as portas", () => {
  it("a mensagem da desistência e a lista têm tradução fixa (sem ela, a conversa passaria à equipa)", () => {
    const lista = textoDaListaDasPropostas(612, [TEJO, SUL]);
    const deNovo = textoDaListaDasPropostas(612, [TEJO, SUL], true);
    for (const lingua of ["en", "fr", "es"] as const) {
      expect(traducaoFixa(mensagemDaDesistencia(612), lingua), lingua).toMatch(/612/);
      expect(traducaoFixa(lista, lingua), lingua).not.toBeNull();
      expect(traducaoFixa(deNovo, lingua), lingua).not.toBeNull();
    }
  });

  it("sem «profissional», sem emoji, e a CLYON não faz o trabalho", () => {
    for (const t of [mensagemDaDesistencia(612), textoDaListaDasPropostas(612, [TEJO, SUL]), textoDaListaDasPropostas(612, [TEJO], true)]) {
      expect(t).not.toMatch(/profissional/i);
      expect(t).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
      expect(t).not.toMatch(/\b(carregamos|levamos|fazemos o trabalho)\b/i);
    }
  });

  it("a que pedido responde a desistência: o seguimento, a lista, uma proposta", () => {
    expect(pedidoDaUltimaSaida(M1)).toBe(612);
    expect(pedidoDaUltimaSaida(textoDaMensagem2({ pedidoId: 612, nome: null, servico: "recolha de monos", resposta: "vai_pensar" }))).toBe(612);
    expect(pedidoDaUltimaSaida(textoDaListaDasPropostas(612, [TEJO, SUL]))).toBe(612);
    expect(pedidoDaUltimaSaida("Recolhas Tejo propõe 92,07 € para a sua recolha de monos (pedido #612).")).toBe(612);
    expect(pedidoDaUltimaSaida("Obrigada, já passei à equipa, que lhe responde em breve.")).toBeNull();
    expect(pedidoDaUltimaSaida(`${MARCA_DE_MAO} Sobre o pedido #612: Recolhas Tejo propõe 92,07 € (pedido #612)`)).toBeNull();
  });

  it("uma escolha precisa de um verbo de escolha; uma pergunta ou uma recusa não são", () => {
    expect(escolhaDita("Gostaria de escolher a proposta da Recolhas Tejo", [TEJO, SUL])).toEqual({ tipo: "escolheu", proposta: TEJO });
    expect(escolhaDita("A Recolhas Tejo vem de manhã?", [TEJO, SUL])).toBeNull();
    expect(escolhaDita("Recolhas Tejo ainda não me respondeu", [TEJO, SUL])).toBeNull();
    expect(escolhaDita("Não quero a da Recolhas Tejo", [TEJO, SUL])).toBeNull();
    expect(escolhaDita("Quero escolher uma das propostas", [TEJO, SUL])).toEqual({ tipo: "duvida" });
  });

  it("com a Vitória agente ligada, estas respostas ficam com o código", async () => {
    const base = { temPedidos: true, interrompida: false, recolhaEmCurso: false, imagens: 0, videos: 0, perguntaDeDadosAEspera: false };
    expect(quemResponde({ ...base, texto: "Obrigado, já tenho outra opção", oCodigoLe: true }).quem).toBe("regras");
    expect(quemResponde({ ...base, texto: "Obrigado, já tenho outra opção" }).quem).toBe("agente");
    const fio = [{ direccao: "out", texto: M1, haSegundos: 60 }];
    expect(await oCodigoLeEstaResposta("Obrigado, já tenho outra opção", fio)).toBe(true);
    expect(await oCodigoLeEstaResposta("Gostaria de escolher a proposta da Recolhas Tejo", fio)).toBe(true);
    expect(await oCodigoLeEstaResposta("O valor inclui o transporte", fio)).toBe(false);
    const daLista = [{ direccao: "out", texto: textoDaListaDasPropostas(612, [TEJO, SUL]), haSegundos: 60 }];
    expect(await oCodigoLeEstaResposta("a segunda", daLista)).toBe(true);
  });

  it("as portas: a desistência antes da impaciência, a lista na conversa, e a conversa entregue na ponte e no webhook", () => {
    const vitoria = ler("src/lib/whatsapp-negociacao.ts");
    const desistencia = vitoria.indexOf("await d111.tratarADesistencia(telefone, conteudo.texto)");
    expect(desistencia).toBeGreaterThan(0);
    expect(vitoria.indexOf("await d111.responderALista(telefone, conteudo.texto)")).toBeGreaterThan(desistencia);
    expect(vitoria.indexOf("if (estaAPerderAPaciencia(conteudo.texto))")).toBeGreaterThan(desistencia);
    expect(vitoria.indexOf("await escolhaNumaConversaEntregue(telefone, conteudo.texto)")).toBeGreaterThan(0);
    expect(vitoria.indexOf("await escolhaNumaConversaEntregue(telefone, conteudo.texto)")).toBeLessThan(desistencia);
    expect(ler("src/app/api/whatsapp/ponte/route.ts")).toContain("escolhaNumaConversaEntregue(telefone, texto)");
    // O cancelamento é o caminho único da d93/d94, com a origem e a mensagem da d111.
    const no = ler("src/lib/a-escolha-e-a-desistencia-no-whatsapp.ts");
    expect(no).toContain('origem: "desistencia"');
    expect(no).toContain("mensagem: opcoes.comOPorque ? null : mensagemDaDesistencia(pedidoId)");
    // O fecho é o do botão «Fechar» (fecharPeloCliente).
    expect(vitoria).toMatch(/export async function fecharAEscolhaDoCliente[\s\S]{0,400}await fecharPeloCliente\(telefone, alvo\);/);
  });
});
