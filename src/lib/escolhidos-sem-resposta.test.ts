import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { instanteEmLisboa } from "./hora-de-lisboa";
import { HORAS_PARA_RESPONDER, JANELA_DE_RESPOSTA, prazoDeResposta } from "./prazo-de-resposta-do-parceiro";
import { congelarTarifa, REGRAS_DAS_MUDANCAS } from "./conta-da-mudanca";
import { mudancaEscolhida } from "./mudanca-escolhida-pelo-cliente";
import { TEXTOS_DA_LISTA } from "./lista-de-parceiros-da-mudanca";
import { avisosDoNossoLado } from "./avisos-a-equipa";
import { semRespostaDoNossoLado, type PedidoParaOLado } from "./do-nosso-lado";
import { propor, type Negociacao } from "./negociacao";
import {
  ACCAO_DE_CONFIRMAR_A_HORA,
  ACCOES_DOS_ESCOLHIDOS,
  AJUDA_DO_PROCURAR_MAIS,
  avisoSemRespostaAoCliente,
  botaoConfirmo,
  BOTOES_DA_MESA,
  cartaoDoCliente,
  correrOsEscolhidosSemResposta,
  DEPOIS_DE_CADA_SAIDA,
  erroDaConfirmacao,
  ERROS_DO_ESCOLHIDO,
  escolhidosDeJson,
  estadoNaMesa,
  LINHA_DAS_3_HORAS,
  linhaDoPrazoParaOCliente,
  naJanelaDeResposta,
  podeAbrirAMaisParceiros,
  rotuloDoPrazoTerminado,
  SAIDAS_DO_CLIENTE,
  SELO_SEM_RESPOSTA,
  semRespostaDosEscolhidos,
  textoDepoisDeConfirmar,
  textoDoPrazoTerminado,
  type DependenciasDaRotina,
  type MarcaSemResposta,
  type PedidoComEscolhidos,
} from "./escolhidos-sem-resposta";

/**
 * OS ESCOLHIDOS SEM RESPOSTA — d6, 11-11-2026. Uma regra, um teste:
 *
 *   1. a rotina corre no relógio de Lisboa (às 23h e às 02h cala-se; às 08h fala);
 *   2. o cliente é avisado UMA só vez por pedido;
 *   3. a CLYON não abre o pedido a mais parceiros sem o cliente pedir;
 *   4. o escolhido confirma num toque, com a tarifa congelada;
 *   5. os textos são os que o Produto fechou, e vivem numa só lib.
 *
 * As horas dizem-se sempre em Lisboa (`instanteEmLisboa`): esta máquina e o
 * servidor estão noutro fuso, e um `getHours` enganava.
 */

const lisboa = (quando: string) => instanteEmLisboa(quando) as Date;
const ler = (caminho: string) => readFileSync(join(process.cwd(), caminho), "utf8");

/** Escolhido às 16:00 de Lisboa: o prazo de 3 h acaba às 19:00 do mesmo dia. */
const ENVIADO = lisboa("2026-11-11T16:00");
const PRAZO = prazoDeResposta(ENVIADO);

const escolhida = (o: Record<string, unknown> = {}) => ({
  estado: "aberta",
  propostasJson: "[]",
  escolhidoPeloCliente: 1,
  prazoRespostaEm: PRAZO.toISOString(),
  profissionalNome: "Mudanças Exemplo",
  ...o,
});
const comProposta = (valor = 40) => JSON.stringify([{ por: "profissional", valor, estado: "pendente", criadaEm: ENVIADO.toISOString() }]);

const pedido = (o: Partial<PedidoComEscolhidos> = {}): PedidoComEscolhidos => ({
  id: 610,
  status: "em_negociacao",
  contactName: "Cliente de Teste",
  contactPhone: "910000000",
  contactEmail: "cliente@exemplo.test",
  procurarMais: false,
  jaAvisado: false,
  negociacoes: [escolhida()],
  ...o,
});

/** As dependências da rotina, de mentira: uma «base» em memória e os envios contados. */
function mundo(pedidos: PedidoComEscolhidos[]) {
  const marcas = new Map<number, MarcaSemResposta>();
  const enviados = { whatsapp: [] as string[], email: [] as string[], app: [] as string[], historico: [] as string[] };
  let leituras = 0;
  const deps: DependenciasDaRotina = {
    ler: async () => {
      leituras++;
      return pedidos.map((p) => ({ ...p, jaAvisado: p.jaAvisado || marcas.has(p.id) }));
    },
    reservar: async (id, marca) => {
      if (marcas.has(id)) return false;
      marcas.set(id, marca);
      return true;
    },
    ligacao: async (p) => `https://clyon.test/pedido/token-${p.id}`,
    whatsapp: async (_p, texto) => {
      enviados.whatsapp.push(texto);
      return true;
    },
    email: async (_p, e) => {
      enviados.email.push(e.assunto);
      return true;
    },
    app: async (_p, a) => {
      enviados.app.push(a.titulo);
      return true;
    },
    registar: async (id, marca, linha) => {
      marcas.set(id, marca);
      enviados.historico.push(linha);
    },
  };
  return { deps, marcas, enviados, leituras: () => leituras };
}

describe("1. a rotina corre no relógio de Lisboa", () => {
  it("o prazo de 3 h conta só entre as 8h e as 21h de Lisboa", () => {
    expect(HORAS_PARA_RESPONDER).toBe(3);
    expect(JANELA_DE_RESPOSTA).toEqual({ abre: 8, fecha: 21 });
    expect(PRAZO.toISOString()).toBe(lisboa("2026-11-11T19:00").toISOString());
    // Um pedido das 20h00 acaba às 10h00 do dia seguinte.
    expect(prazoDeResposta(lisboa("2026-11-11T20:00")).toISOString()).toBe(lisboa("2026-11-12T10:00").toISOString());
  });

  it("às 23h e às 02h de Lisboa não lê nem envia; às 08h avisa o que passou de noite", async () => {
    // Todos disseram que não às 22h: trata-se logo, mas o cliente só é avisado de dia.
    const m = mundo([pedido({ negociacoes: [escolhida({ estado: "desistida" })] }), pedido({ id: 611 })]);

    for (const hora of ["2026-11-11T23:00", "2026-11-12T02:00", "2026-11-12T07:59"]) {
      const r = await correrOsEscolhidosSemResposta(m.deps, lisboa(hora));
      expect(r.naJanela, hora).toBe(false);
      expect(r.avisados, hora).toEqual([]);
    }
    expect(m.leituras()).toBe(0);
    expect(m.enviados.whatsapp).toEqual([]);

    const r = await correrOsEscolhidosSemResposta(m.deps, lisboa("2026-11-12T08:00"));
    expect(r.naJanela).toBe(true);
    expect(r.avisados).toEqual([610, 611]);
    expect(m.enviados.whatsapp).toHaveLength(2);
  });

  it("a janela é a de Lisboa seja qual for o fuso do servidor (23h de Lisboa são 23h UTC no Inverno e 22h UTC no Verão)", () => {
    expect(naJanelaDeResposta(new Date("2026-11-11T23:00:00Z"))).toBe(false);
    expect(naJanelaDeResposta(new Date("2026-11-12T02:00:00Z"))).toBe(false);
    expect(naJanelaDeResposta(new Date("2026-11-12T08:00:00Z"))).toBe(true);
    expect(naJanelaDeResposta(new Date("2026-11-12T20:59:00Z"))).toBe(true);
    expect(naJanelaDeResposta(new Date("2026-11-12T21:00:00Z"))).toBe(false);
    // No Verão Lisboa está em UTC+1: as 08h00 de Lisboa são as 07h00 UTC.
    expect(naJanelaDeResposta(new Date("2026-07-01T07:00:00Z"))).toBe(true);
    expect(naJanelaDeResposta(new Date("2026-07-01T06:59:00Z"))).toBe(false);
    expect(naJanelaDeResposta(new Date("2026-07-01T20:00:00Z"))).toBe(false);
  });

  it("a rota é horária, está no vercel.json e na lista das rotinas, e usa a hora de Lisboa (sem getHours)", () => {
    const vercel = JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };
    expect(vercel.crons).toContainEqual({ path: "/api/cron/escolhidos-sem-resposta", schedule: "5 * * * *" });
    expect(ler("src/lib/rotinas.ts")).toContain('nome: "escolhidos-sem-resposta"');
    expect(ler("src/app/api/cron/escolhidos-sem-resposta/route.ts")).toContain("correrARotinaDosEscolhidos");
    for (const f of [
      "src/lib/escolhidos-sem-resposta.ts",
      "src/lib/escolhidos-sem-resposta-regra.ts",
      "src/lib/escolhidos-sem-resposta-na-mesa.ts",
      "src/lib/escolhidos-sem-resposta-do-escolhido.ts",
      "src/lib/escolhidos-sem-resposta-no-servidor.ts",
    ]) {
      expect(ler(f), f).not.toMatch(/\.getHours\(|\.getDate\(|toLocale(Time|Date)?String\(/);
    }
  });
});

describe("2. a regra e o aviso ao cliente, uma só vez", () => {
  it("sem resposta = o prazo passou e ninguém pôs um número; com um a confirmar, nada", () => {
    const antes = lisboa("2026-11-11T18:59");
    const depois = lisboa("2026-11-11T19:01");
    expect(semRespostaDosEscolhidos([escolhida()], antes)).toBeNull();
    expect(semRespostaDosEscolhidos([escolhida()], depois)).toMatchObject({ caso: "sem_resposta", escolhidos: 1 });
    // Dois escolhidos, um confirmou: o cliente já tem o que decidir.
    expect(semRespostaDosEscolhidos([escolhida(), escolhida({ propostasJson: comProposta() })], depois)).toBeNull();
    // Todos disseram que não: logo, sem esperar pelo prazo.
    expect(semRespostaDosEscolhidos([escolhida({ estado: "desistida" })], antes)).toMatchObject({ caso: "disseram_que_nao" });
    // Um disse que não e o outro calou-se: espera-se pelo prazo.
    expect(semRespostaDosEscolhidos([escolhida({ estado: "desistida" }), escolhida()], antes)).toBeNull();
    expect(semRespostaDosEscolhidos([escolhida({ estado: "desistida" }), escolhida()], depois)).toMatchObject({ caso: "sem_resposta", escolhidos: 2 });
    // Uma negociação que não foi escolhida pelo cliente não conta.
    expect(semRespostaDosEscolhidos([escolhida({ escolhidoPeloCliente: 0 })], depois)).toBeNull();
  });

  it("avisa o cliente uma só vez: repetir a rotina não envia segundo aviso", async () => {
    const m = mundo([pedido()]);
    const primeira = await correrOsEscolhidosSemResposta(m.deps, lisboa("2026-11-11T19:05"));
    expect(primeira.avisados).toEqual([610]);
    expect(m.enviados.whatsapp).toHaveLength(1);
    expect(m.enviados.email).toHaveLength(1);
    expect(m.enviados.app).toHaveLength(1);
    expect(m.marcas.get(610)).toMatchObject({ saiu: true, canais: ["whatsapp", "email", "app"], caso: "sem_resposta", escolhidos: 1 });
    expect(m.enviados.historico[0]).toBe(
      "Prazo de resposta terminou às 19:00 sem resposta dos escolhidos (Mudanças Exemplo). Cliente avisado por WhatsApp, email, aviso na app.",
    );

    for (const hora of ["2026-11-11T20:05", "2026-11-12T08:05", "2026-11-12T09:05"]) {
      const r = await correrOsEscolhidosSemResposta(m.deps, lisboa(hora));
      expect(r.avisados, hora).toEqual([]);
    }
    expect(m.enviados.whatsapp).toHaveLength(1);
    expect(m.enviados.email).toHaveLength(1);
    expect(m.enviados.app).toHaveLength(1);
  });

  it("duas passagens ao mesmo tempo: só quem reserva a marca fala", async () => {
    const m = mundo([pedido()]);
    const agora = lisboa("2026-11-11T19:05");
    const [a, b] = await Promise.all([correrOsEscolhidosSemResposta(m.deps, agora), correrOsEscolhidosSemResposta(m.deps, agora)]);
    expect([...a.avisados, ...b.avisados]).toEqual([610]);
    expect(m.enviados.whatsapp).toHaveLength(1);
  });

  it("não avisa antes do prazo, nem com resposta, nem num pedido cancelado (um cancelado fica cancelado)", async () => {
    const m = mundo([
      pedido({ id: 1, negociacoes: [escolhida({ prazoRespostaEm: lisboa("2026-11-11T20:30").toISOString() })] }),
      pedido({ id: 2, negociacoes: [escolhida({ propostasJson: comProposta() })] }),
      pedido({ id: 3, status: "cancelado" }),
      pedido({ id: 4, status: "arquivado" }),
    ]);
    const r = await correrOsEscolhidosSemResposta(m.deps, lisboa("2026-11-11T19:05"));
    expect(r.porAvisar).toBe(0);
    expect(m.enviados.whatsapp).toEqual([]);
  });

  it("se nenhum canal sair, fica marcado na mesma (não repete) e a Mesa lê «fale com ele»", async () => {
    const m = mundo([pedido({ negociacoes: [escolhida(), escolhida({ profissionalNome: "Outra" })] })]);
    m.deps.whatsapp = async () => false;
    m.deps.email = async () => {
      throw new Error("o email caiu");
    };
    m.deps.app = async () => false;
    const agora = lisboa("2026-11-11T19:05");
    const r = await correrOsEscolhidosSemResposta(m.deps, agora);
    expect(r.semCanal).toEqual([610]);
    const marca = m.marcas.get(610) as MarcaSemResposta;
    expect(marca.saiu).toBe(false);
    const mesa = estadoNaMesa([escolhida(), escolhida()], { em: null, procurarMais: false, marca, decisao: null, enviadoAMais: null }, agora);
    expect(mesa?.linha).toBe("Nenhum dos 2 escolhidos respondeu até 11/11, 19:00. O aviso ao cliente NÃO saiu: fale com ele.");
    expect((await correrOsEscolhidosSemResposta(m.deps, lisboa("2026-11-11T20:05"))).porAvisar).toBe(0);
  });

  it("o aviso leva as três saídas e a ligação do pedido, diz «parceiro» e não leva valores", () => {
    const a = avisoSemRespostaAoCliente({
      pedidoId: 610,
      caso: "sem_resposta",
      nomes: ["Mudanças Exemplo"],
      jaPediuAClyon: false,
      nomeDoCliente: "Ana Silva",
      ligacao: "https://clyon.test/pedido/abc",
    });
    expect(a.whatsapp).toBe(
      "O parceiro Mudanças Exemplo ainda não respondeu ao seu pedido de mudança #610.\n\n" +
        "Pode esperar mais um pouco, escolher outro parceiro da lista ou pedir à CLYON que procure por si. Diga-nos o que prefere aqui:\n" +
        "https://clyon.test/pedido/abc",
    );
    expect(a.email.assunto).toBe("A sua mudança #610: o parceiro ainda não respondeu");
    expect(a.email.abertura).toBe("Olá, Ana,\n\nO parceiro Mudanças Exemplo ainda não respondeu ao seu pedido de mudança. Tinha 3 horas para o fazer.");
    expect(a.email.blocos.map((b) => b.titulo)).toEqual([SAIDAS_DO_CLIENTE.pedirAClyon, SAIDAS_DO_CLIENTE.escolherOutro, SAIDAS_DO_CLIENTE.esperar]);
    expect(a.app).toEqual({ titulo: "O parceiro ainda não respondeu", texto: "Mudança #610: pode esperar, escolher outro ou pedir à CLYON que procure por si." });

    const dois = avisoSemRespostaAoCliente({ pedidoId: 7, caso: "sem_resposta", nomes: ["A", "B"], jaPediuAClyon: true, ligacao: "L" });
    expect(dois.whatsapp).toBe(
      "Os parceiros que escolheu para a sua mudança #7 ainda não responderam.\n\n" +
        "A CLYON já está a procurar mais parceiros, como pediu. Entretanto pode esperar ou escolher outro parceiro da lista:\nL",
    );
    expect(dois.email.blocos.map((b) => b.titulo)).toEqual([SAIDAS_DO_CLIENTE.escolherOutro, SAIDAS_DO_CLIENTE.esperar]);

    const nao = avisoSemRespostaAoCliente({ pedidoId: 7, caso: "disseram_que_nao", nomes: ["A", "B"], jaPediuAClyon: false, ligacao: "L" });
    expect(nao.whatsapp.startsWith("Os parceiros que escolheu não podem fazer a sua mudança #7.")).toBe(true);
    expect(nao.email.assunto).toBe("A sua mudança #7: escolha outro parceiro");
    expect(nao.email.blocos.map((b) => b.titulo)).toEqual([SAIDAS_DO_CLIENTE.pedirAClyon, SAIDAS_DO_CLIENTE.escolherOutro]);

    for (const texto of [a.whatsapp, a.email.abertura, dois.whatsapp, nao.whatsapp, ...a.email.blocos.map((b) => b.texto)]) {
      expect(texto).not.toMatch(/profissiona/i);
      expect(texto).not.toMatch(/€/);
    }
  });
});

describe("3. a CLYON não abre o pedido a mais parceiros sem o cliente pedir", () => {
  const semPedir = { em: ENVIADO.toISOString(), procurarMais: false, marca: null, decisao: null, enviadoAMais: null };
  const depois = lisboa("2026-11-11T19:30");

  it("num pedido com escolhidos só se envia a mais com o pedido do cliente: na lista, no aviso ou registado pela equipa", () => {
    expect(podeAbrirAMaisParceiros(null)).toBe(true); // um pedido sem lista segue como sempre
    expect(podeAbrirAMaisParceiros(semPedir)).toBe(false);
    expect(podeAbrirAMaisParceiros({ ...semPedir, decisao: { saida: "esperar", em: depois.toISOString(), por: "cliente" } })).toBe(false);
    expect(podeAbrirAMaisParceiros({ ...semPedir, decisao: { saida: "escolher_outro", em: depois.toISOString(), por: "cliente" } })).toBe(false);
    expect(podeAbrirAMaisParceiros({ ...semPedir, procurarMais: true })).toBe(true);
    expect(podeAbrirAMaisParceiros({ ...semPedir, decisao: { saida: "pedir_a_clyon", em: depois.toISOString(), por: "cliente" } })).toBe(true);
    expect(podeAbrirAMaisParceiros({ ...semPedir, decisao: { saida: "pedir_a_clyon", em: depois.toISOString(), por: "equipa", operador: "Rita" } })).toBe(true);
  });

  it("a rotina não tem por onde abrir o pedido: só lê, reserva, avisa e regista", async () => {
    const m = mundo([pedido()]);
    await correrOsEscolhidosSemResposta(m.deps, depois);
    expect(Object.keys(m.deps).sort()).toEqual(["app", "email", "ler", "ligacao", "registar", "reservar", "whatsapp"]);
    const servidor = ler("src/lib/escolhidos-sem-resposta-no-servidor.ts");
    expect(servidor).not.toContain('from "./distribuir-pedido"');
    // O único envio dali é aos parceiros que o cliente escolher na lista do pedido.
    expect(servidor).toContain("enviarAOutrosEscolhidos");
    expect(ler("src/app/api/cron/escolhidos-sem-resposta/route.ts")).not.toMatch(/distribuir|redistribuir/);
  });

  it("a rota de redistribuir recusa enquanto o cliente não pedir, e regista o envio quando pede", () => {
    const rota = ler("src/app/api/admin/negociacoes/redistribuir/route.ts");
    const guarda = rota.indexOf("!podeAbrirAMaisParceiros(escolhidos)");
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(rota.indexOf("await distribuirPedido("));
    expect(rota).toContain("soAPedidoDoCliente: true");
    expect(rota).toContain("registarEnvioAMais(pedidoId, r.receberam)");
  });

  it("a Mesa: o selo, a linha de cada caso e o botão «Enviar a mais profissionais» só activo quando o cliente pediu", () => {
    const negs = [escolhida()];
    const marca: MarcaSemResposta = { avisadoEm: lisboa("2026-11-11T19:05").toISOString(), prazoEm: PRAZO.toISOString(), escolhidos: 1, caso: "sem_resposta", canais: ["whatsapp"], saiu: true };
    expect(SELO_SEM_RESPOSTA).toBe("escolhidos sem resposta");
    expect(BOTOES_DA_MESA.enviarAMais).toBe("Enviar a mais profissionais");
    expect(rotuloDoPrazoTerminado(PRAZO)).toBe("sem resposta · prazo terminou 11/11, 19:00");

    expect(estadoNaMesa(negs, semPedir, lisboa("2026-11-11T18:00"))).toMatchObject({ selo: false, linha: null, podeEnviarAMais: false });
    expect(estadoNaMesa(negs, { ...semPedir, marca }, depois)).toEqual({
      selo: true,
      linha: "O escolhido não respondeu até 11/11, 19:00. Cliente avisado às 19:05; ainda não disse o que prefere.",
      podeEnviarAMais: false,
      podeRegistarOPedido: true,
    });
    expect(estadoNaMesa(negs, { ...semPedir, marca, decisao: { saida: "esperar", em: lisboa("2026-11-11T19:20").toISOString(), por: "cliente" } }, depois)).toMatchObject({
      selo: true,
      linha: "O cliente prefere esperar pelos escolhidos (disse-o às 19:20).",
      podeEnviarAMais: false,
    });
    expect(estadoNaMesa(negs, { ...semPedir, marca, procurarMais: true, decisao: { saida: "pedir_a_clyon", em: lisboa("2026-11-11T19:20").toISOString(), por: "cliente" } }, depois)).toEqual({
      selo: true,
      linha: "O cliente pediu à CLYON que procure mais parceiros (às 19:20). Falta enviar o pedido a mais profissionais.",
      podeEnviarAMais: true,
      podeRegistarOPedido: false,
    });
    expect(
      estadoNaMesa(negs, { ...semPedir, marca, procurarMais: true, decisao: { saida: "pedir_a_clyon", em: lisboa("2026-11-11T19:20").toISOString(), por: "equipa", operador: "Rita" } }, depois)?.linha,
    ).toBe("O cliente pediu à CLYON que procure mais parceiros (registado por Rita às 19:20). Falta enviar o pedido a mais profissionais.");
    // Marcou a opção na lista: entra na Mesa logo, sem esperar pelo prazo.
    expect(estadoNaMesa(negs, { ...semPedir, procurarMais: true }, lisboa("2026-11-11T16:05"))).toEqual({
      selo: false,
      linha: "O cliente pediu também à CLYON que procure mais parceiros. Falta enviar o pedido a mais profissionais.",
      podeEnviarAMais: true,
      podeRegistarOPedido: false,
    });
    // Depois de enviar a mais, o selo apaga-se.
    expect(estadoNaMesa(negs, { ...semPedir, marca, procurarMais: true, enviadoAMais: { em: lisboa("2026-11-11T19:40").toISOString(), quantos: 4 } }, lisboa("2026-11-11T19:45"))).toMatchObject({
      selo: false,
      linha: "Enviado a mais 4 profissionais às 19:40, a pedido do cliente.",
    });
    // Escolheu outro: o selo apaga-se até o prazo novo passar.
    const novoPrazo = lisboa("2026-11-12T10:00");
    const comOutro = [escolhida(), escolhida({ prazoRespostaEm: novoPrazo.toISOString(), profissionalNome: "Outra" })];
    const escolheu = { ...semPedir, marca, decisao: { saida: "escolher_outro" as const, em: depois.toISOString(), por: "cliente" as const, nomes: ["Outra"], prazoEm: novoPrazo.toISOString() } };
    expect(estadoNaMesa(comOutro, escolheu, lisboa("2026-11-11T20:00"))).toMatchObject({ selo: false, linha: "O cliente escolheu mais 1: resposta até 12/11, 10:00." });
    expect(estadoNaMesa(comOutro, escolheu, lisboa("2026-11-12T10:01"))?.selo).toBe(true);
    // Um pedido sem escolhidos não tem nada disto; um fechado não acende nem deixa enviar.
    expect(estadoNaMesa([escolhida({ escolhidoPeloCliente: 0 })], null, depois)).toBeNull();
    expect(estadoNaMesa(negs, { ...semPedir, procurarMais: true }, depois, true)).toEqual({ selo: false, linha: null, podeEnviarAMais: false, podeRegistarOPedido: false });
  });

  it("o aviso à equipa sai quando o cliente já foi avisado, e outra vez quando ele pede à CLYON", () => {
    const base: PedidoParaOLado = { id: 610, status: "em_negociacao", origem: "simulador", contactEmail: null, negociacoes: [escolhida()] as PedidoParaOLado["negociacoes"] };
    const marca = { avisadoEm: lisboa("2026-11-11T19:05").toISOString(), prazoEm: PRAZO.toISOString(), escolhidos: 1, caso: "sem_resposta", canais: ["whatsapp"], saiu: true };
    const json = (o: Record<string, unknown>) => JSON.stringify({ em: ENVIADO.toISOString(), procurarMais: false, semResposta: null, decisao: null, enviadoAMais: null, ...o });

    // Prazo passado, cliente ainda por avisar: está na Mesa, mas o aviso à equipa espera pelo do cliente.
    const semMarca = semRespostaDoNossoLado([{ ...base, escolhidosJson: json({}) }], depois);
    expect(semMarca).toHaveLength(1);
    expect(avisosDoNossoLado(semMarca, depois)).toEqual([]);

    const avisado = avisosDoNossoLado(semRespostaDoNossoLado([{ ...base, escolhidosJson: json({ semResposta: marca }) }], depois), depois);
    expect(avisado).toHaveLength(1);
    expect(avisado[0]).toMatchObject({ titulo: "Escolhidos sem resposta", seccao: "mesa", pedidoId: 610 });
    expect(avisado[0].corpo).toBe("#610 · Mudança: o escolhido pelo cliente não respondeu em 3 horas. O cliente foi avisado.");

    const falhou = avisosDoNossoLado(semRespostaDoNossoLado([{ ...base, escolhidosJson: json({ semResposta: { ...marca, canais: [], saiu: false } }) }], depois), depois);
    expect(falhou[0].corpo).toBe("#610 · Mudança: escolhidos sem resposta e o aviso ao cliente não saiu. Fale com o cliente.");

    const pediu = avisosDoNossoLado(
      semRespostaDoNossoLado(
        [{ ...base, escolhidosJson: json({ semResposta: marca, procurarMais: true, decisao: { saida: "pedir_a_clyon", em: lisboa("2026-11-11T19:20").toISOString(), por: "cliente" } }) }],
        depois,
      ),
      depois,
    );
    expect(pediu[0].corpo).toBe("#610 · Mudança: o cliente pediu à CLYON que procure mais parceiros. Falta enviar o pedido.");
    // É uma espera nova (desde o pedido dele), para o aviso sair segunda vez.
    expect(pediu[0].desde.toISOString()).toBe(lisboa("2026-11-11T19:20").toISOString());
    expect(avisado[0].desde.toISOString()).toBe(PRAZO.toISOString());

    // Enviado a mais, ou pedido fechado: deixa de estar do nosso lado.
    expect(semRespostaDoNossoLado([{ ...base, escolhidosJson: json({ semResposta: marca, procurarMais: true, enviadoAMais: { em: depois.toISOString(), quantos: 3 } }) }], depois)).toEqual([]);
    expect(semRespostaDoNossoLado([{ ...base, status: "cancelado", escolhidosJson: json({ semResposta: marca }) }], depois)).toEqual([]);
  });

  it("o cartão do cliente: as três saídas, e o que fica depois de cada uma", () => {
    const negs = [escolhida()];
    const depoisDoPrazo = lisboa("2026-11-11T19:30");
    expect(cartaoDoCliente(negs, semPedir, lisboa("2026-11-11T18:00"))).toBeNull();
    expect(linhaDoPrazoParaOCliente(negs, lisboa("2026-11-11T18:00"))).toBe("O parceiro que escolheu tem até às 19:00 para responder.");
    expect(linhaDoPrazoParaOCliente([escolhida(), escolhida()], lisboa("2026-11-10T18:00"))).toBe("Os parceiros que escolheu têm até 11/11 às 19:00 para responder.");
    expect(linhaDoPrazoParaOCliente(negs, depoisDoPrazo)).toBeNull();

    const c = cartaoDoCliente(negs, semPedir, depoisDoPrazo);
    expect(c).toMatchObject({ titulo: "O parceiro Mudanças Exemplo ainda não respondeu", linha: "O prazo de 3 horas terminou às 19:00. O que prefere?" });
    expect(c?.botoes).toEqual([
      { accao: ACCOES_DOS_ESCOLHIDOS.esperar, texto: "Esperar mais um pouco", principal: false },
      { accao: ACCOES_DOS_ESCOLHIDOS.listaParaEscolherOutro, texto: "Escolher outro parceiro", principal: false },
      { accao: ACCOES_DOS_ESCOLHIDOS.pedirAClyon, texto: "Pedir à CLYON que procure", principal: true },
    ]);
    expect(cartaoDoCliente([escolhida(), escolhida()], semPedir, lisboa("2026-11-12T09:00"))).toMatchObject({
      titulo: "Os parceiros que escolheu ainda não responderam",
      linha: "O prazo de 3 horas terminou a 11/11 às 19:00. O que prefere?",
    });
    // Já tinha pedido à CLYON na lista: sai o botão 3, entra a linha.
    const jaPediu = cartaoDoCliente(negs, { ...semPedir, procurarMais: true }, depoisDoPrazo);
    expect(jaPediu?.botoes.map((b) => b.texto)).toEqual(["Esperar mais um pouco", "Escolher outro parceiro"]);
    expect(jaPediu?.nota).toBe("A CLYON já está a procurar mais parceiros, como pediu.");
    // Todos disseram que não: não há «esperar».
    const nao = cartaoDoCliente([escolhida({ estado: "desistida" })], semPedir, lisboa("2026-11-11T17:00"));
    expect(nao).toMatchObject({ titulo: "Os parceiros que escolheu não podem fazer esta mudança", linha: "O que prefere?" });
    expect(nao?.botoes.map((b) => b.texto)).toEqual(["Escolher outro parceiro", "Pedir à CLYON que procure"]);
    // Depois de cada botão.
    const esperou = cartaoDoCliente(negs, { ...semPedir, decisao: { saida: "esperar", em: depoisDoPrazo.toISOString(), por: "cliente" } }, depoisDoPrazo);
    expect(esperou).toMatchObject({ depois: DEPOIS_DE_CADA_SAIDA.esperar, botoes: [] });
    expect(esperou?.ligacoes.map((b) => b.texto)).toEqual(["Escolher outro parceiro", "Pedir à CLYON que procure"]);
    expect(cartaoDoCliente(negs, { ...semPedir, procurarMais: true, decisao: { saida: "pedir_a_clyon", em: depoisDoPrazo.toISOString(), por: "cliente" } }, depoisDoPrazo)).toMatchObject({
      depois: DEPOIS_DE_CADA_SAIDA.pedirAClyon,
      botoes: [],
      ligacoes: [],
    });
    // Um parceiro respondeu, ou o pedido fechou: o cartão sai.
    expect(cartaoDoCliente([escolhida({ propostasJson: comProposta() })], semPedir, depoisDoPrazo)).toBeNull();
    expect(cartaoDoCliente(negs, semPedir, depoisDoPrazo, true)).toBeNull();
  });

  it("as três saídas passam por agirComoCliente (link, conta e app), e só o cliente as faz", () => {
    const agir = ler("src/lib/agir-como-cliente.ts");
    for (const accao of Object.values(ACCOES_DOS_ESCOLHIDOS)) expect(agir, accao).toContain(`"${accao}"`);
    expect(agir).toContain("eAccaoDosEscolhidos(accao)");
    const servidor = ler("src/lib/escolhidos-sem-resposta-no-servidor.ts");
    // Um cancelado fica cancelado, e depois de um parceiro responder já não é preciso.
    expect(servidor).toContain("if (fechado) return falha(409, ERROS_DO_CLIENTE.jaFechado");
    expect(servidor).toContain("if (!semRespostaDosEscolhidos(l.negociacoes, agora))");
    // Quem escolhe outro passa pela mesma conferência do pedido: a lista de agora e o preço visto.
    expect(servidor).toContain("conferirEscolha(a.corpo.parceiros, lista.escolhiveis)");
    expect(servidor).toContain("conferirAssinaturasDoPreco(a.corpo.assinaturas, conferida.escolhidos, agora)");
  });
});

describe("4. o escolhido confirma num toque, com a tarifa congelada", () => {
  const tarifa = congelarTarifa(
    { precoHora2: 40, precoHora3: 55, minimoHoras: 3, precoKm: 0.6, kmMinimo: 10, kmMaximo: 80, caixa: 2, cartaoMetro: null, filmeRolo: 10, plasticoBolhaRolo: 20, aparecerNaLista: true },
    REGRAS_DAS_MUDANCAS,
    ENVIADO,
  );
  const dados = (o: Record<string, unknown> = {}) => ({
    tarifaCongeladaJson: JSON.stringify(tarifa),
    pessoasEscolhidas: 2,
    prazoRespostaEm: PRAZO,
    horas: null,
    km: null,
    jaRespondeu: false,
    estado: "aberta",
    propostasJson: "[]",
    ...o,
  });

  it("o botão diz a hora dele, e a acção não leva valor: o servidor lê a hora congelada", () => {
    expect(botaoConfirmo(4000)).toBe("Confirmo: faço por 40,00 €/h + IVA");
    const m = mudancaEscolhida(dados(), lisboa("2026-11-11T17:00"));
    expect(m?.primeiraResposta).toMatchObject({
      accao: ACCAO_DE_CONFIRMAR_A_HORA,
      confirmar: "Confirmo: faço por 40,00 €/h + IVA",
      proporMaisBaixo: "Propor um valor mais baixo",
      naoEstouInteressado: "Não estou interessado",
      rotuloDoValor: "Valor por hora, sem IVA",
      regraDoValorMaisBaixo: "Escreva um valor por hora abaixo da sua hora (40,00 € sem IVA). Para ficar na sua hora, volte atrás e confirme.",
      enviarProposta: "Enviar proposta",
      voltar: "Voltar",
    });
    expect(m?.rotuloDoPrazo).toBe("Responda até 19:00");
    // Equipa de 3: a hora das três pessoas.
    expect(mudancaEscolhida(dados({ pessoasEscolhidas: 3 }), lisboa("2026-11-11T17:00"))?.primeiraResposta?.confirmar).toBe("Confirmo: faço por 55,00 €/h + IVA");

    const rota = ler("src/app/api/profissionais/negociacao/route.ts");
    // O valor da confirmação nasce da tarifa congelada na base, nunca do corpo do pedido.
    expect(rota).toMatch(/horaConfirmada = \{\s*cent: horaCongeladaCent\(tarifa, pessoasDaEscolha\(congelada\.pessoasEscolhidas\)\)/);
    expect(rota).toContain('resultado = propor(estadoActual, "profissional", horaConfirmada.cent / 100, agora);');
    // E o cliente recebe o aviso de proposta de sempre.
    expect(rota).toContain('if ((corpo.accao === "propor" || confirmaAHora) && nova.valorAcordado == null)');
    // O painel envia a acção sem valor.
    const painel = ler("src/app/profissionais/painel/ConfirmarAHora.tsx");
    expect(painel).toContain("onClick={() => void agir(textos.accao)}");
    expect(ler("src/app/profissionais/painel/Trabalhos.tsx")).toContain("<ConfirmarAHora");
  });

  it("confirmar é uma proposta à hora congelada, num só pedido ao motor", () => {
    const aberta: Negociacao = { estado: "aberta", valorAcordado: null, propostas: [] };
    const r = propor(aberta, "profissional", 4000 / 100, lisboa("2026-11-11T17:00"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.negociacao.propostas).toHaveLength(1);
    expect(r.negociacao.propostas[0]).toMatchObject({ por: "profissional", valor: 40, estado: "pendente" });
    // Depois de confirmar: a frase no lugar dos botões, e os botões saem.
    const depois = mudancaEscolhida(dados({ jaRespondeu: true, propostasJson: JSON.stringify(r.negociacao.propostas) }), lisboa("2026-11-11T17:05"));
    expect(depois?.primeiraResposta).toBeNull();
    expect(depois?.respostaTexto).toBe("Confirmou: 40,00 €/h + IVA (49,20 €/h com IVA). O cliente está a escolher — avisamos assim que decidir.");
  });

  it("depois do prazo ainda confirma, e lê a variante tardia", () => {
    const tarde = lisboa("2026-11-11T19:40");
    const m = mudancaEscolhida(dados(), tarde);
    expect(m?.prazoPassou).toBe(true);
    expect(m?.prazoTexto).toBe("O prazo terminou às 19:00. Ainda pode responder, mas o cliente já foi avisado.");
    expect(m?.rotuloDoPrazo).toBe("Prazo terminado");
    expect(m?.primeiraResposta?.confirmar).toBe("Confirmo: faço por 40,00 €/h + IVA");
    expect(textoDoPrazoTerminado(PRAZO, lisboa("2026-11-12T09:00"))).toBe("O prazo terminou a 11/11 às 19:00. Ainda pode responder, mas o cliente já foi avisado.");
    expect(erroDaConfirmacao({ estado: "aberta", propostasJson: "[]", estadoDoPedido: "em_negociacao", pedidoFechado: false })).toBeNull();

    const r = propor({ estado: "aberta", valorAcordado: null, propostas: [] }, "profissional", 40, tarde);
    if (!r.ok) throw new Error("o motor recusou");
    expect(mudancaEscolhida(dados({ jaRespondeu: true, propostasJson: JSON.stringify(r.negociacao.propostas) }), tarde)?.respostaTexto).toBe(
      "Confirmou depois do prazo: 40,00 €/h + IVA (49,20 €/h com IVA). O cliente já tinha sido avisado de que não havia resposta; recebe agora a sua confirmação.",
    );
    expect(textoDepoisDeConfirmar(4000, 0.23, true)).toContain("Confirmou depois do prazo: 40,00 €/h + IVA (49,20 €/h com IVA).");
  });

  it("um valor mais baixo lê a frase da proposta; a partir da segunda, o ecrã é o da negociação", () => {
    const uma = JSON.stringify([{ por: "profissional", valor: 36, estado: "pendente", criadaEm: ENVIADO.toISOString() }]);
    expect(mudancaEscolhida(dados({ jaRespondeu: true, propostasJson: uma }), lisboa("2026-11-11T17:00"))?.respostaTexto).toBe(
      "A sua proposta de 36,00 €/h + IVA (44,28 €/h com IVA) está com o cliente. Avisamos quando ele responder.",
    );
    const duas = JSON.stringify([
      { por: "profissional", valor: 40, estado: "recusada", criadaEm: ENVIADO.toISOString() },
      { por: "cliente", valor: 30, estado: "recusada", criadaEm: ENVIADO.toISOString() },
      { por: "profissional", valor: 36, estado: "pendente", criadaEm: ENVIADO.toISOString() },
    ]);
    expect(mudancaEscolhida(dados({ jaRespondeu: true, propostasJson: duas }), lisboa("2026-11-11T17:00"))?.respostaTexto).toBeNull();
  });

  it("não confirma num pedido cancelado, fechado, contratado a outro, já respondido ou recusado por ele", () => {
    const base = { estado: "aberta", propostasJson: "[]", estadoDoPedido: "em_negociacao", pedidoFechado: false };
    expect(erroDaConfirmacao({ ...base, estadoDoPedido: "cancelado", pedidoFechado: true })).toEqual({ erro: ERROS_DO_ESCOLHIDO.cancelado, semBotoes: true });
    expect(erroDaConfirmacao({ ...base, estado: "morta" })).toEqual({ erro: "O cliente já escolheu outro profissional para esta mudança. Este pedido fechou para si.", semBotoes: true });
    expect(erroDaConfirmacao({ ...base, estadoDoPedido: "arquivado", pedidoFechado: true })).toEqual({ erro: "Este pedido já fechou. Já não pode responder.", semBotoes: true });
    expect(erroDaConfirmacao({ ...base, propostasJson: comProposta() })?.erro).toBe("Já confirmou este pedido. A sua resposta está com o cliente.");
    expect(erroDaConfirmacao({ ...base, estado: "aguarda_contratacao" })?.erro).toBe(ERROS_DO_ESCOLHIDO.jaConfirmou);
    expect(erroDaConfirmacao({ ...base, estado: "desistida" })?.erro).toBe("Disse que não estava interessado neste pedido. Já não pode confirmar.");
    // A rota pergunta antes de tudo o resto, e grava com a guarda de quem decidiu primeiro.
    const rota = ler("src/app/api/profissionais/negociacao/route.ts");
    expect(rota.indexOf("erroDaConfirmacao({")).toBeLessThan(rota.indexOf("const compromete ="));
    expect(rota).toContain("pedidoFechado: pedidoFechado(estadoDoPedido)");
    expect(rota).toContain("{ estado: linha.estado, pedidoId: linha.pedidoId }");
  });
});

describe("5. os textos vivem numa só lib, e a lista diz as 3 horas", () => {
  it("a linha das 3 horas e a ajuda da opção vêm da lib, com as horas lidas das constantes", () => {
    expect(LINHA_DAS_3_HORAS).toBe(
      "Os parceiros que escolher têm 3 horas para responder, entre as 8h e as 21h. " +
        "Se nenhum responder, avisamos: pode esperar, escolher outro ou pedir à CLYON que procure por si.",
    );
    expect(TEXTOS_DA_LISTA.prazo).toBe(LINHA_DAS_3_HORAS);
    expect(TEXTOS_DA_LISTA.procurarMais).toBe("Pedir também à CLYON que procure mais parceiros");
    expect(TEXTOS_DA_LISTA.procurarMaisAjuda).toBe(AJUDA_DO_PROCURAR_MAIS);
    expect(AJUDA_DO_PROCURAR_MAIS).toBe("Além dos que escolher, o pedido vai a outros parceiros da sua zona, que respondem com o preço de cada um.");
    // «Verificado» só junto de um parceiro com as três confirmações (regra q da orquestra): aqui não se diz de todos.
    for (const texto of [AJUDA_DO_PROCURAR_MAIS, DEPOIS_DE_CADA_SAIDA.pedirAClyon, LINHA_DAS_3_HORAS]) expect(texto).not.toMatch(/verificad/i);
    const lib = ler("src/lib/escolhidos-sem-resposta.ts");
    expect(lib).toContain("têm ${HORAS_PARA_RESPONDER} horas para responder, entre as ${JANELA_DE_RESPOSTA.abre}h e as ${JANELA_DE_RESPOSTA.fecha}h");
  });

  it("o simulador mostra a linha e a opção sempre que há parceiros (não só com um)", () => {
    const ecra = ler("src/app/simulador/components/ParceirosDaMudanca.tsx");
    expect(ecra).toContain("{textos?.prazo && ");
    expect(ecra).toContain("textos.procurarMaisAjuda");
    expect(ecra).toContain("procurarMais: parceiros.length > 0 && procurarMais,");
    expect(ecra).not.toContain("parceiros.length === 1");
  });

  it("a lib importa-se por uma porta só, e por dentro cada leitor tem o seu ficheiro", () => {
    const porta = ler("src/lib/escolhidos-sem-resposta.ts");
    for (const parte of ["regra", "na-mesa", "do-escolhido"]) expect(porta).toContain(`export * from "./escolhidos-sem-resposta-${parte}";`);
    // Ao cliente diz-se «parceiro»: no ficheiro dele não há «profissional» em frase nenhuma.
    const frases = porta.split("\n").filter((linha) => !/^\s*(\*|\/\*|\/\/)/.test(linha)).join("\n");
    expect(frases).not.toMatch(/(?<!\p{L})profissiona(l|is)(?!\p{L})/iu);
    // Ninguém importa os ficheiros de dentro: só a porta (e ela a eles).
    for (const f of [
      "src/lib/do-nosso-lado.ts",
      "src/lib/avisos-a-equipa.ts",
      "src/lib/mudanca-escolhida-pelo-cliente.ts",
      "src/lib/lista-de-parceiros-da-mudanca.ts",
      "src/lib/escolhidos-sem-resposta-no-servidor.ts",
      "src/app/api/profissionais/negociacao/route.ts",
      "src/app/api/admin/negociacoes/route.ts",
      "src/app/api/admin/negociacoes/redistribuir/route.ts",
      "src/components/EscolhidosSemResposta.tsx",
      "src/components/admin/EscolhidosNaMesa.tsx",
      "src/app/profissionais/painel/ConfirmarAHora.tsx",
    ]) {
      expect(ler(f), f).not.toMatch(/escolhidos-sem-resposta-(regra|na-mesa|do-escolhido)"/);
    }
  });

  it("os ecrãs lêem os textos da lib ou da rota — não os escrevem", () => {
    const frases = ["Esperar mais um pouco", "Pedir à CLYON que procure", "escolhidos sem resposta", "Enviar a mais profissionais", "Confirmo: faço por", "Propor um valor mais baixo"];
    for (const f of [
      "src/components/EscolhidosSemResposta.tsx",
      "src/components/admin/EscolhidosNaMesa.tsx",
      "src/app/profissionais/painel/ConfirmarAHora.tsx",
      "src/app/pedido/[token]/VistaDoPedido.tsx",
    ]) {
      const semComentarios = ler(f)
        .split("\n")
        .filter((linha) => !/^\s*(\*|\/\*|\/\/|\{\/\*)/.test(linha))
        .join("\n");
      for (const frase of frases) expect(semComentarios, `${f}: «${frase}»`).not.toContain(frase);
    }
    expect(escolhidosDeJson('{"em":null,"procurarMais":true,"semResposta":null,"decisao":null,"enviadoAMais":null}')).toEqual({
      em: null,
      procurarMais: true,
      marca: null,
      decisao: null,
      enviadoAMais: null,
    });
    expect(escolhidosDeJson(null)).toBeNull();
  });
});
