import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * O SEGUIMENTO DO CLIENTE — d83 (CEO e dono, 21-11-2026).
 *
 * O calendário (horas de Lisboa, a mudança da hora, o dia seguinte), a janela
 * das 9h00 às 19h59, a regra de uma mensagem automática por dia, a leitura do
 * «1», do «2» e do «3», o fecho ao 4.º dia, os textos (e as traduções fixas),
 * as linhas da Mesa, a conversa a sério com a base fingida, e as guardas no
 * código (nunca DELETE, a fila, a purga, o cron). Nenhuma mensagem sai a
 * ninguém. Nomes e números INVENTADOS (o repositório é público).
 */

const estado = vi.hoisted(() => ({
  aEspera: false,
  cancelado: false,
  enviados: [] as string[],
  passadas: [] as string[],
  chamadas: [] as Array<{ f: string; porque?: string }>,
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
  }),
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
      estado.aEspera = true;
      estado.enviados.push(regras.textoDaConfirmacaoDoCancelamento(pedidoId));
      return { ok: true, estado: "pediu_confirmacao" };
    }),
    confirmarCancelamentoPeloSeguimento: vi.fn(async (pedidoId: number, _tel: string, texto: string) => {
      estado.chamadas.push({ f: "confirmar" });
      if (!regras.eConfirmacaoDoCancelamento(texto) || !estado.aEspera) return { ok: false, porque: "não há pergunta do CANCELAR a valer" };
      estado.cancelado = true;
      estado.aEspera = false;
      estado.enviados.push(`[cancelado #${pedidoId}]`);
      return { ok: true, estado: "cancelado" };
    }),
  };
});

import { responderAoSeguimentoDoCliente } from "./whatsapp-negociacao";
import { aUltimaSaidaE, textoDaConfirmacaoDoCancelamento } from "./validade-do-orcamento";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import {
  AS_OPCOES_DO_SEGUIMENTO,
  clienteRespondeuAoSeguimento,
  diasDoCiclo,
  eMensagemDoSeguimento,
  horaNaJanela,
  instantesDoCiclo,
  jaSaiuHojeAoCliente,
  lerRespostaAoSeguimento,
  linhaDoContacto,
  linhaDoSeguimentoNaMesa,
  naJanelaDoSeguimento,
  porqueSaiuDoPrecisaDeSi,
  proximoPassoDoSeguimento,
  seguimentoEmCurso,
  textoDaMensagem1,
  textoDaMensagem2,
  textoDaMensagem3,
  textoDoFechoDoSeguimento,
  validarVoltarEm,
  voltarPorOmissao,
  type CicloDoSeguimento,
} from "./seguimento-do-cliente";

const em = (iso: string) => new Date(iso);
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/* No Inverno, Lisboa = UTC. 22/11/2026 às 10h de Lisboa = 10:00Z. */
const VOLTAR = em("2026-11-22T10:00:00Z");
const ciclo = (c: Partial<CicloDoSeguimento> = {}): CicloDoSeguimento => ({ voltarEm: VOLTAR, canal: "whatsapp", ...c });

describe("o «voltar a contactar»: a janela e a hora de Lisboa", () => {
  it("por omissão é amanhã às 10h00, em Lisboa (às 23h30 de Lisboa, amanhã é o dia seguinte de Lisboa)", () => {
    expect(voltarPorOmissao(em("2026-11-21T15:00:00Z"))).toEqual({ dia: "2026-11-22", hora: "10:00" });
    // 23h30 de Lisboa no Verão = 22h30Z: o «amanhã» é o de Lisboa.
    expect(voltarPorOmissao(em("2026-07-10T22:30:00Z"))).toEqual({ dia: "2026-07-11", hora: "10:00" });
  });

  it("só das 9h00 às 19h59", () => {
    expect(horaNaJanela("08:59")).toBe(false);
    expect(horaNaJanela("09:00")).toBe(true);
    expect(horaNaJanela("19:59")).toBe(true);
    expect(horaNaJanela("20:00")).toBe(false);
    expect(horaNaJanela("9:00")).toBe(false);
    expect(naJanelaDoSeguimento(em("2026-11-22T08:59:00Z"))).toBe(false);
    expect(naJanelaDoSeguimento(em("2026-11-22T09:00:00Z"))).toBe(true);
    expect(naJanelaDoSeguimento(em("2026-11-22T19:59:00Z"))).toBe(true);
    expect(naJanelaDoSeguimento(em("2026-11-22T20:00:00Z"))).toBe(false);
    // No Verão, as 19h30Z já são 20h30 em Lisboa.
    expect(naJanelaDoSeguimento(em("2026-07-10T19:30:00Z"))).toBe(false);
    expect(naJanelaDoSeguimento(em("2026-07-10T08:30:00Z"))).toBe(true);
  });

  it("valida: no futuro, na janela, dia que existe, até 30 dias", () => {
    const agora = em("2026-11-21T15:00:00Z");
    const ok = validarVoltarEm("2026-11-22", "10:00", agora);
    expect(ok).toEqual({ ok: true, instante: VOLTAR });
    expect(validarVoltarEm("2026-11-22", "20:00", agora).ok).toBe(false);
    expect(validarVoltarEm("2026-11-22", "08:45", agora).ok).toBe(false);
    expect(validarVoltarEm("2026-11-21", "10:00", agora).ok).toBe(false); // já passou
    expect(validarVoltarEm("2026-02-30", "10:00", agora).ok).toBe(false);
    expect(validarVoltarEm("2027-01-05", "10:00", agora).ok).toBe(false); // mais de 30 dias
    expect(validarVoltarEm(null, "10:00", agora).ok).toBe(false);
    expect(validarVoltarEm("2026-11-22", undefined, agora).ok).toBe(false);
  });

  it("no Verão, as 10h de Lisboa são as 9h UTC", () => {
    const r = validarVoltarEm("2026-07-11", "10:00", em("2026-07-10T12:00:00Z"));
    expect(r).toEqual({ ok: true, instante: em("2026-07-11T09:00:00Z") });
  });
});

describe("o calendário: 1.ª, 2.ª e 3.ª à mesma hora, e o fecho ao 4.º dia", () => {
  it("os dias seguidos, à hora marcada", () => {
    expect(diasDoCiclo(ciclo())).toEqual({ mensagem1: "2026-11-22", mensagem2: "2026-11-23", mensagem3: "2026-11-24", fecho: "2026-11-25" });
    const i = instantesDoCiclo(ciclo());
    expect(i.mensagem2.toISOString()).toBe("2026-11-23T10:00:00.000Z");
    expect(i.fecho.toISOString()).toBe("2026-11-25T10:00:00.000Z");
  });

  it("a mudança da hora (25/10/2026): as 10h de Lisboa continuam a ser as 10h", () => {
    const c = ciclo({ voltarEm: em("2026-10-24T09:00:00Z") }); // sábado 10h de Verão
    const i = instantesDoCiclo(c);
    expect(i.mensagem1.toISOString()).toBe("2026-10-24T09:00:00.000Z");
    expect(i.mensagem2.toISOString()).toBe("2026-10-25T10:00:00.000Z"); // domingo, já de Inverno
    expect(i.mensagem3.toISOString()).toBe("2026-10-26T10:00:00.000Z");
    // E na Primavera (28/03/2027): das 10h de Inverno às 10h de Verão.
    const p = instantesDoCiclo(ciclo({ voltarEm: em("2027-03-27T10:00:00Z") }));
    expect(p.mensagem2.toISOString()).toBe("2027-03-28T09:00:00.000Z");
  });

  it("o passo só toca a partir da hora marcada, nunca dois no mesmo dia", () => {
    expect(proximoPassoDoSeguimento(ciclo(), em("2026-11-22T09:59:00Z"))).toBeNull();
    expect(proximoPassoDoSeguimento(ciclo(), em("2026-11-22T10:00:00Z"))).toBe("mensagem1");
    expect(proximoPassoDoSeguimento(ciclo(), em("2026-11-21T10:00:00Z"))).toBeNull();
    const m1 = ciclo({ mensagem1Em: em("2026-11-22T10:01:00Z") });
    expect(proximoPassoDoSeguimento(m1, em("2026-11-22T18:00:00Z"))).toBeNull();
    expect(proximoPassoDoSeguimento(m1, em("2026-11-23T09:45:00Z"))).toBeNull();
    expect(proximoPassoDoSeguimento(m1, em("2026-11-23T10:00:00Z"))).toBe("mensagem2");
    const m2 = ciclo({ mensagem1Em: em("2026-11-22T10:01:00Z"), mensagem2Em: em("2026-11-23T10:01:00Z") });
    expect(proximoPassoDoSeguimento(m2, em("2026-11-24T10:15:00Z"))).toBe("mensagem3");
  });

  it("o fecho: no 4.º dia à mesma hora, e só depois de a 3.ª ter saído", () => {
    const m3 = ciclo({
      mensagem1Em: em("2026-11-22T10:01:00Z"),
      mensagem2Em: em("2026-11-23T10:01:00Z"),
      mensagem3Em: em("2026-11-24T10:01:00Z"),
    });
    expect(proximoPassoDoSeguimento(m3, em("2026-11-24T20:00:00Z"))).toBeNull();
    expect(proximoPassoDoSeguimento(m3, em("2026-11-25T09:59:00Z"))).toBeNull();
    expect(proximoPassoDoSeguimento(m3, em("2026-11-25T10:00:00Z"))).toBe("arquivar");
    // Sem a 3.ª, nunca fecha.
    const sem3 = ciclo({ mensagem1Em: em("2026-11-22T10:01:00Z"), mensagem2Em: em("2026-11-23T10:01:00Z") });
    expect(proximoPassoDoSeguimento(sem3, em("2026-11-26T10:00:00Z"))).toBe("mensagem3");
  });

  it("uma mensagem atrasada empurra as outras (e sai à mesma hora, no dia seguinte)", () => {
    // A 1.ª só saiu a 23/11 (a 22 já tinha saído outra automática): a 2.ª fica para 24/11, a 3.ª 25/11, o fecho 26/11.
    const c = ciclo({ mensagem1Em: em("2026-11-23T10:00:00Z") });
    expect(diasDoCiclo(c)).toEqual({ mensagem1: "2026-11-23", mensagem2: "2026-11-24", mensagem3: "2026-11-25", fecho: "2026-11-26" });
    expect(proximoPassoDoSeguimento(c, em("2026-11-23T15:00:00Z"))).toBeNull();
    expect(proximoPassoDoSeguimento(c, em("2026-11-24T09:00:00Z"))).toBeNull();
    expect(proximoPassoDoSeguimento(c, em("2026-11-24T10:00:00Z"))).toBe("mensagem2");
  });

  it("fora da janela, acabado ou sem canal: nada", () => {
    const tarde = ciclo({ voltarEm: em("2026-11-22T19:45:00Z") });
    expect(proximoPassoDoSeguimento(tarde, em("2026-11-22T20:05:00Z"))).toBeNull();
    expect(proximoPassoDoSeguimento(ciclo({ paradoEm: em("2026-11-22T09:00:00Z") }), em("2026-11-22T10:00:00Z"))).toBeNull();
    expect(proximoPassoDoSeguimento(ciclo({ arquivadoEm: em("2026-11-22T09:00:00Z") }), em("2026-11-22T10:00:00Z"))).toBeNull();
    expect(proximoPassoDoSeguimento(ciclo({ canceladoEm: em("2026-11-22T09:00:00Z") }), em("2026-11-22T10:00:00Z"))).toBeNull();
    expect(proximoPassoDoSeguimento(ciclo({ canal: null }), em("2026-11-22T10:00:00Z"))).toBeNull();
    expect(seguimentoEmCurso(ciclo({ canal: null }))).toBe(false);
    expect(seguimentoEmCurso(ciclo())).toBe(true);
    expect(seguimentoEmCurso(ciclo({ paradoEm: em("2026-11-22T09:00:00Z") }))).toBe(false);
  });
});

describe("nunca mais de uma mensagem automática por dia ao mesmo cliente", () => {
  it("conta o dia de Lisboa de qualquer mensagem (da validade, do que falta ou deste seguimento)", () => {
    const agora = em("2026-11-22T10:00:00Z");
    expect(jaSaiuHojeAoCliente([], agora)).toBe(false);
    expect(jaSaiuHojeAoCliente([null, undefined, em("2026-11-21T20:00:00Z")], agora)).toBe(false);
    expect(jaSaiuHojeAoCliente([em("2026-11-22T00:30:00Z")], agora)).toBe(true);
    // No Verão, as 23h30Z já são o dia seguinte em Lisboa.
    expect(jaSaiuHojeAoCliente([em("2026-07-10T23:30:00Z")], em("2026-07-11T10:00:00Z"))).toBe(true);
  });

  it("a validade (d62), os lembretes do que falta (d71) e o seguimento contam todos pela contagem comum (d85)", () => {
    const d62 = ler("src/lib/validade-do-orcamento-na-base.ts");
    expect(d62).toContain("if (await outrasMensagensDeHoje(telefone, agora)) {");
    expect(d62).toContain('if (await outrasMensagensDeHoje(String(p.contactPhone ?? ""), agora)) {');
    expect(d62).toContain('if (await outrasMensagensDeHoje(String(lista[0].p.contactPhone ?? ""), agora)) continue;');
    expect(d62).toContain("jaSaiuHojeUmaMensagemAutomatica({ telefone }, agora)");
    const d71 = ler("src/lib/lembrete-do-que-falta-na-base.ts");
    expect(d71).toContain("jaSaiuHojeUmaMensagemAutomatica({ telefone: p.contactPhone }, agora, { pool })");
    const base = ler("src/lib/seguimento-do-cliente-na-base.ts");
    expect(base.split("await jaSaiuHojeUmaMensagemAutomatica(").length - 1).toBe(2);
    const comum = ler("src/lib/uma-mensagem-automatica-por-dia.ts");
    for (const t of ["validadeDosOrcamentos", "lembretesDoQueFalta", "seguimentoDoCliente"]) expect(comum).toContain(`tabela: "${t}"`);
  });
});

describe("a leitura das respostas e quem responde a quê", () => {
  it("«1», «2» e «3» como no lembrete do orçamento", () => {
    expect(lerRespostaAoSeguimento("1")).toBe("avancar");
    expect(lerRespostaAoSeguimento(" 2 ")).toBe("duvidas");
    expect(lerRespostaAoSeguimento("3")).toBe("cancelar");
    expect(lerRespostaAoSeguimento("Sim")).toBe("avancar");
    expect(lerRespostaAoSeguimento("já não preciso")).toBe("cancelar");
    expect(lerRespostaAoSeguimento("Sim, mas só para a semana?")).toBeNull();
    expect(lerRespostaAoSeguimento("4")).toBeNull();
  });

  it("o cliente respondeu se escreveu depois de a equipa marcar", () => {
    const marcado = em("2026-11-21T15:00:00Z");
    expect(clienteRespondeuAoSeguimento(marcado, null)).toBe(false);
    expect(clienteRespondeuAoSeguimento(marcado, em("2026-11-21T14:59:00Z"))).toBe(false);
    expect(clienteRespondeuAoSeguimento(marcado, em("2026-11-22T10:05:00Z"))).toBe(true);
  });

  it("o «1/2/3» só responde se a última saída for o seguimento DESTE pedido", () => {
    const m1 = textoDaMensagem1({ pedidoId: 612, nome: "Ana", servico: "recolha de monos", resposta: "vai_pensar" });
    expect(eMensagemDoSeguimento(m1, 612)).toBe(true);
    expect(eMensagemDoSeguimento(m1, 61)).toBe(false);
    expect(eMensagemDoSeguimento(m1, 6120)).toBe(false);
    expect(eMensagemDoSeguimento("Olá! Responda 1 para avançar, 2 se tiver dúvidas… #612", 612)).toBe(false);
    expect(aUltimaSaidaE(textoDaConfirmacaoDoCancelamento(612), 612)).toBe("confirmacao");
  });

  it("o pedido saiu do «Precisa de si» por outro lado: o ciclo pára", () => {
    const vivo = { existe: true, status: "pendente", anonimizado: false, temAcordada: false };
    expect(porqueSaiuDoPrecisaDeSi(vivo)).toBeNull();
    expect(porqueSaiuDoPrecisaDeSi({ ...vivo, temAcordada: true })).toBe("o parceiro já foi escolhido");
    for (const s of ["cancelado", "arquivado", "rejeitado", "concluido"]) expect(porqueSaiuDoPrecisaDeSi({ ...vivo, status: s })).not.toBeNull();
    expect(porqueSaiuDoPrecisaDeSi({ ...vivo, existe: false })).not.toBeNull();
    expect(porqueSaiuDoPrecisaDeSi({ ...vivo, anonimizado: true })).not.toBeNull();
  });
});

describe("os textos ao cliente", () => {
  const d = { pedidoId: 612, nome: "ana maria", servico: "recolha de monos", resposta: "vai_pensar" as const };
  const textos = [
    textoDaMensagem1(d),
    textoDaMensagem1({ ...d, resposta: "nao_atendeu" }),
    textoDaMensagem1({ ...d, resposta: "outra_data" }),
    textoDaMensagem2(d),
    textoDaMensagem3(d),
    textoDoFechoDoSeguimento(612),
    textoDaMensagem1({ ...d, nome: null }),
  ];

  it("a 1.ª é a do texto base: o primeiro nome, o pedido, o serviço e as três opções", () => {
    // d91 (3.18 e 5.3): o 612 (par) leva a variante A — o risco que se tira.
    expect(textoDaMensagem1(d)).toBe(
      "Olá, Ana! Ficou de pensar no seu pedido #612 (recolha de monos). Se ajudar a decidir: o valor da proposta já é o total a pagar, não paga nada adiantado, e o que aparecer a mais no dia só se faz com o seu acordo. Ainda quer avançar? Responda 1 para escolher o parceiro, 2 se precisar de outra data, ou 3 para cancelar.",
    );
    expect(textoDaMensagem3(d)).toContain("Se não tivermos resposta, o pedido fecha amanhã e, para avançar depois, terá de pedir propostas de novo.");
    expect(textoDoFechoDoSeguimento(612)).toContain("pode voltar a pedir quando quiser");
    for (const t of textos.slice(0, 5)) expect(t).toContain(AS_OPCOES_DO_SEGUIMENTO);
  });

  it("sem emoji (d66), sem «profissional» e sem a CLYON a fazer o trabalho", () => {
    for (const t of textos) {
      expect(t).not.toMatch(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u);
      expect(t).not.toMatch(/profissional/i);
      expect(t).not.toMatch(/\b(levamos|recolhemos|fazemos)\b/i);
    }
  });

  for (const lingua of ["en", "fr", "es"] as const) {
    it(`têm tradução fixa em ${lingua} (sem ela, passariam à equipa)`, () => {
      for (const t of textos) expect(traducaoFixa(t, lingua), t).not.toBeNull();
      expect(traducaoFixa(textoDaMensagem1(d), "en")).toContain("Reply 1 to choose the partner");
    });
  }
});

describe("as linhas da Mesa", () => {
  it("o passo de cada mensagem, e o fecho", () => {
    expect(linhaDoSeguimentoNaMesa(ciclo(), true)).toBe(
      "Seguimento: 1.ª mensagem a 22/11 às 10h · 2.ª a 23/11 às 10h · 3.ª a 24/11 às 10h · fecha a 25/11 às 10h",
    );
    expect(linhaDoSeguimentoNaMesa(ciclo({ mensagem1Em: em("2026-11-22T10:00:00Z"), mensagem2Em: em("2026-11-23T10:00:00Z") }), true)).toBe(
      "Seguimento: 1.ª enviada a 22/11 10:00 · 2.ª enviada a 23/11 10:00 · 3.ª a 24/11 às 10h · fecha a 25/11 às 10h",
    );
    expect(linhaDoSeguimentoNaMesa(ciclo({ voltarEm: em("2026-11-22T14:30:00Z") }), true)).toContain("1.ª mensagem a 22/11 às 14h30");
  });

  it("com o interruptor desligado, «enviaria» e «fecharia»", () => {
    expect(linhaDoSeguimentoNaMesa(ciclo(), false)).toBe(
      "Seguimento: 1.ª mensagem enviaria a 22/11 às 10h · 2.ª enviaria a 23/11 às 10h · 3.ª enviaria a 24/11 às 10h · fecharia a 25/11 às 10h",
    );
  });

  it("parado, respondido, arquivado, sem envio", () => {
    expect(linhaDoSeguimentoNaMesa({ ...ciclo(), paradoEm: em("2026-11-23T11:00:00Z"), respondeuEm: em("2026-11-23T11:00:00Z") }, true)).toBe(
      "Seguimento parado: o cliente respondeu a 23/11 — é connosco",
    );
    expect(
      linhaDoSeguimentoNaMesa({ ...ciclo(), paradoEm: em("2026-11-23T11:00:00Z"), respondeuEm: em("2026-11-23T11:00:00Z"), paradoPorque: "«2» — quer outra data" }, true),
    ).toContain("(«2» — quer outra data)");
    expect(linhaDoSeguimentoNaMesa({ ...ciclo(), arquivadoEm: em("2026-11-25T10:00:00Z") }, true)).toContain("o cliente não respondeu ao seguimento");
    expect(linhaDoSeguimentoNaMesa({ ...ciclo(), canal: null, semEnvioPorque: "conta de teste, não se envia" }, true)).toContain("conta de teste");
  });

  it("o contacto: quando, quem, a resposta e o «volta a contactar»", () => {
    expect(linhaDoContacto({ em: "2026-11-21T15:00:00Z", por: "Ana", resposta: "vai_pensar", voltarEm: "2026-11-22T10:00:00Z" })).toBe(
      "Falámos a 21/11 (Ana): vai pensar — volta a contactar 22/11 às 10h",
    );
    expect(linhaDoContacto({ em: "2026-11-21T15:00:00Z", por: "Ana", resposta: "nao_atendeu", nota: "caixa de correio", voltarEm: "2026-11-22T10:00:00Z" })).toBe(
      "Tentámos falar a 21/11 (Ana): não atendeu — volta a contactar 22/11 às 10h · «caixa de correio»",
    );
    expect(linhaDoContacto({ em: "2026-11-21T15:00:00Z", por: "Ana", resposta: "quer_cancelar" })).toBe("Falámos a 21/11 (Ana): quer cancelar — pedido cancelado");
    expect(linhaDoContacto({ em: "2026-11-21T15:00:00Z", por: "Ana", resposta: null })).toBe("Seguimento parado à mão a 21/11 (Ana)");
  });
});

/* ── A conversa, a sério, com a base fingida ──────────────────────────────── */

const TEL = "351910000000";
const PEDIDO = 612;
const M1 = textoDaMensagem1({ pedidoId: PEDIDO, nome: "Ana", servico: "recolha de monos", resposta: "vai_pensar" });

/** A porta de tratarMensagemDoCliente → seguimentosDoTelefone: só responde se a última saída é deste pedido. */
async function oClienteEscreve(texto: string): Promise<void> {
  const ultima = estado.enviados[estado.enviados.length - 1] ?? null;
  if (estado.cancelado) return;
  const responde = eMensagemDoSeguimento(ultima, PEDIDO) || (estado.aEspera && aUltimaSaidaE(ultima, PEDIDO) === "confirmacao");
  if (!responde) return;
  await responderAoSeguimentoDoCliente(TEL, texto, { pedidoId: PEDIDO, aEsperaDeCancelar: estado.aEspera });
}

beforeEach(() => {
  estado.aEspera = false;
  estado.cancelado = false;
  estado.enviados = [M1];
  estado.passadas = [];
  estado.chamadas = [];
});
afterEach(() => vi.clearAllMocks());

describe("a conversa do seguimento", () => {
  it("«1» → o ciclo pára e passa à equipa, para escolher o parceiro", async () => {
    await oClienteEscreve("1");
    expect(estado.chamadas).toEqual([{ f: "parar", porque: "«1» — quer avançar: escolher o parceiro" }]);
    expect(estado.passadas[0]).toContain("#612");
    expect(estado.passadas[0]).toContain("escolher o parceiro");
  });

  it("«2» → o ciclo pára e passa à equipa (outra data)", async () => {
    await oClienteEscreve("2");
    expect(estado.chamadas[0]).toEqual({ f: "parar", porque: "«2» — quer outra data" });
    expect(estado.passadas[0]).toContain("outra data");
  });

  it("«3» → só pergunta; o CANCELAR cancela, uma vez", async () => {
    await oClienteEscreve("3");
    expect(estado.enviados.at(-1)).toBe(textoDaConfirmacaoDoCancelamento(612));
    expect(estado.enviados.at(-1)?.startsWith("Confirma que quer cancelar o pedido #612? Responda CANCELAR.")).toBe(true);
    expect(estado.cancelado).toBe(false);
    expect(estado.passadas).toEqual([]);
    // Outro «3» à espera: nem pergunta outra vez, nem cancela.
    await oClienteEscreve("3");
    expect(estado.chamadas.map((c) => c.f)).toEqual(["pedir"]);
    await oClienteEscreve("CANCELAR");
    expect(estado.cancelado).toBe(true);
    expect(estado.enviados.at(-1)).toBe("[cancelado #612]");
    await oClienteEscreve("CANCELAR");
    expect(estado.chamadas.filter((c) => c.f === "confirmar")).toHaveLength(1);
  });

  it("o CANCELAR sem a pergunta feita não cancela: pergunta primeiro", async () => {
    await oClienteEscreve("CANCELAR");
    expect(estado.cancelado).toBe(false);
    expect(estado.chamadas.map((c) => c.f)).toEqual(["pedir"]);
  });

  it("outra coisa qualquer → pára e passa à equipa", async () => {
    await oClienteEscreve("Ligue-me amanhã, por favor");
    expect(estado.chamadas[0].f).toBe("parar");
    expect(estado.passadas[0]).toContain("Respondeu ao seguimento do pedido #612");
  });

  it("com outra mensagem pelo meio, o «3» não responde ao seguimento", async () => {
    estado.enviados.push("Obrigada, já passei à equipa, que lhe responde em breve.");
    await oClienteEscreve("3");
    expect(estado.chamadas).toEqual([]);
  });
});

/* ── As guardas no código ─────────────────────────────────────────────────── */

describe("as guardas no código", () => {
  const BASE = ler("src/lib/seguimento-do-cliente-na-base.ts");
  const semComentarios = BASE.replace(/^[ \t]*(\*|\/\/|\/\*).*$/gm, "");

  it("arquivar nunca apaga: nenhum DELETE, e o arquivo é o estado «arquivado»", () => {
    expect(semComentarios).not.toMatch(/\bDELETE\b/i);
    expect(semComentarios).not.toMatch(/deleteSimulatorOrder|apagarPedido/);
    // d94: com o motivo que vai na notificação a cada parceiro.
    expect(BASE).toContain('await updateSimulatorOrder(p.id, { status: "arquivado" }, { motivo: FECHADO_SEM_RESPOSTA });');
    expect(BASE).toContain('await gravarMotivoDoFecho(p.id, "sem_resposta", null, null)');
    expect(BASE).toContain("textoDoFechoAoParceiro(p.id)");
    expect(BASE).toContain('porque: "fechado_sem_resposta"');
  });

  it("reserva na base antes de enviar, e repõe se falhar", () => {
    expect(BASE).toContain("if (Number(reserva.affectedRows) !== 1) return { ok: false, porque: \"este passo já foi dado (ou está a ser dado) por outra passagem\" };");
    expect(BASE).toContain("UPDATE seguimentoDoCliente SET ${coluna} = NULL, ultimaFalha = ? WHERE pedidoId = ?");
    expect(BASE).toContain("enviarAvisoWhatsApp(tel, texto, { semLinguaErrada: true })");
  });

  it("as colunas que se usam estão no CREATE TABLE", () => {
    const criar = BASE.slice(BASE.indexOf("CREATE TABLE IF NOT EXISTS seguimentoDoCliente ("), BASE.indexOf("seguimentoDoClienteVez ("));
    for (const c of [
      "pedidoId", "marcadoEm", "marcadoPor", "resposta", "voltarEm", "canal", "semEnvioPorque", "mensagem1Em", "mensagem2Em",
      "mensagem3Em", "arquivadoEm", "canceladoEm", "paradoEm", "paradoPorque", "respondeuEm", "porEnviar", "porEnviarDesde",
      "ultimaFalha", "cancelarPedidoEm", "anonimizarAPartirDe", "contactosJson",
    ]) {
      expect(criar, c).toMatch(new RegExp(`\\n\\s+${c}\\s`));
    }
  });

  it("o interruptor de emergência está LIGADO sem linha e desligado com a base a falhar", () => {
    expect(BASE).toContain("if (!l) return { ligado: true, mudadoEm: null, porQuem: null };");
    expect(BASE).toContain("return { ligado: false, mudadoEm: null, porQuem: null };");
  });

  it("contas de teste não recebem nada", () => {
    expect(BASE).toContain('if (eDeTeste(p.contactName, p.contactEmail, emailsDeTeste)) return { canal: null, porque: "conta de teste, não se envia" };');
  });

  it("os cancelados pelo seguimento entram na purga dos cancelados (7 dias depois)", () => {
    expect(ler("src/lib/validade-do-orcamento-na-base.ts")).toContain('{ tabela: "seguimentoDoCliente", autor: "seguimento do cliente"');
    expect(BASE).toContain("anonimizarAPartirDe = NOW() + INTERVAL ${DIAS_ATE_ANONIMIZAR_O_CANCELADO} DAY");
  });

  it("a rotina de 15 em 15 minutos, a passagem na ponte e a conversa da Vitória", () => {
    const vercel = JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };
    expect(vercel.crons).toContainEqual({ path: "/api/cron/seguimento-do-cliente", schedule: "*/15 * * * *" });
    expect(ler("src/app/api/whatsapp/ponte/route.ts")).toContain("await passagemDoSeguimento();");
    const vitoria = ler("src/lib/whatsapp-negociacao.ts");
    const d62 = vitoria.indexOf("await responderAoLembreteDoOrcamento(telefone, conteudo.texto, ciclos);");
    const d83 = vitoria.indexOf("await seguimento.seguimentosDoTelefone(telefone)");
    expect(d62).toBeGreaterThan(0);
    expect(d83).toBeGreaterThan(d62);
  });

  it("na Mesa: o botão, e os em seguimento fora da conta do «Precisa de si»", () => {
    const mesa = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(mesa).toContain('(chave === "n1" ? emSeguimentoNoN1.length : 0)');
    expect(mesa).toContain("Em seguimento · {emSeguimentoNoN1.length}");
    expect(ler("src/components/admin/SeguimentoDoCliente.tsx")).toContain("Falei com o cliente");
  });
});
