import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { instanteEmLisboa } from "./hora-de-lisboa";
import { prazoDeResposta } from "./prazo-de-resposta-do-parceiro";
import { congelarTarifa, REGRAS_DAS_MUDANCAS } from "./conta-da-mudanca";
import { mudancaEscolhida, type MudancaEscolhida } from "./mudanca-escolhida-pelo-cliente";
import {
  ACCAO_DE_CONFIRMAR_A_HORA,
  botaoConfirmo,
  erroDaConfirmacao,
  ERROS_DO_ESCOLHIDO,
  regraDoValorMaisBaixo,
  textoDaPropostaMaisBaixa,
  textoDepoisDeConfirmar,
  TEXTOS_DO_ESCOLHIDO,
} from "./escolhidos-sem-resposta";
import {
  cabeNaHora,
  corpoDaResposta,
  lerRecusa,
  primeiraRespostaDe,
  responderComoEscolhido,
  ROTA_DA_NEGOCIACAO,
  type PedirDaApp,
} from "../../app-pro/src/lib/confirmar-a-hora";

/**
 * A PARTE DA APP PRO DA d6 — 11-11-2026. Numa mudança em que o cliente o
 * escolheu, o parceiro responde na app com «Confirmo: faço por X/h + IVA» ou
 * «Propor um valor mais baixo», em vez do formulário. Uma regra, um teste:
 *
 *   1. os dois botões só na primeira resposta de uma mudança escolhida;
 *   2. confirma com UM toque: um só pedido, sem valor (o servidor lê a hora);
 *   3. depois do prazo ainda confirma, e lê a frase tardia;
 *   4. o valor mais baixo vai como proposta, e a app não decide o tecto;
 *   5. as recusas da rota: a frase dela, e os botões saem quando ela o diz;
 *   6. paridade — a app não tem frases próprias: lê as do site.
 *
 * O servidor destes testes é de mentira, mas responde com as regras e as
 * frases verdadeiras da lib do site (`escolhidos-sem-resposta.ts`).
 */

const lisboa = (quando: string) => instanteEmLisboa(quando) as Date;
const cru = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const semNotas = (f: string) =>
  cru(f)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s+/g, " ");

const ENVIADO = lisboa("2026-11-11T16:00");
const PRAZO = prazoDeResposta(ENVIADO);
const ANTES = lisboa("2026-11-11T17:00");
const DEPOIS = lisboa("2026-11-11T19:30");

const tarifa = congelarTarifa(
  { precoHora2: 40, precoHora3: 55, minimoHoras: 3, precoKm: 0.6, kmMinimo: 10, kmMaximo: 80, caixa: 2, cartaoMetro: null, filmeRolo: 10, plasticoBolhaRolo: 20, aparecerNaLista: true },
  REGRAS_DAS_MUDANCAS,
  ENVIADO,
);
const HORA_CENT = 4000;
const IVA = tarifa.regras.iva;

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
/** O trabalho como a rota `meus-pedidos` o manda à app (passado por JSON, como chega). */
const trabalho = (agora: Date, o: Record<string, unknown> = {}, estado = "aberta") => ({
  estado,
  mudancaEscolhida: JSON.parse(JSON.stringify(mudancaEscolhida(dados({ estado, ...o }), agora))) as MudancaEscolhida,
});

/** O erro da API da app (`ErroDaApi` em app-pro/src/lib/api.ts), pela forma. */
class ErroDeMentira extends Error {
  constructor(
    message: string,
    readonly estado: number,
    readonly corpo: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/**
 * A rota da negociação, de mentira: guarda o estado de UMA negociação e
 * responde como a verdadeira (`src/app/api/profissionais/negociacao/route.ts`),
 * com as funções da lib do site.
 */
function servidor(agora: Date, inicio: { estado?: string; estadoDoPedido?: string | null; avisos?: string[] } = {}) {
  const pedidos: Array<{ caminho: string; corpo: Record<string, unknown> }> = [];
  let propostas: Array<{ por: string; valor: number; estado: string; criadaEm: string }> = [];
  const estado = inicio.estado ?? "aberta";
  const pedir: PedirDaApp = async <T,>(caminho: string, opcoes?: { metodo?: "POST"; corpo?: unknown }) => {
    const corpo = (opcoes?.corpo ?? {}) as Record<string, unknown>;
    pedidos.push({ caminho, corpo });
    if (opcoes?.metodo !== "POST") throw new ErroDeMentira("Método não permitido.", 405);
    if (inicio.avisos && corpo.avisosAceites !== true) throw new ErroDeMentira("Leia os avisos.", 409, { avisos: inicio.avisos });
    const depoisDoPrazo = propostas.length === 0 && PRAZO.getTime() < agora.getTime();
    if (corpo.accao === ACCAO_DE_CONFIRMAR_A_HORA) {
      const naoPode = erroDaConfirmacao({
        estado,
        propostasJson: JSON.stringify(propostas),
        estadoDoPedido: inicio.estadoDoPedido ?? null,
        pedidoFechado: inicio.estadoDoPedido === "concluido",
      });
      if (naoPode) throw new ErroDeMentira(naoPode.erro, 409, { error: naoPode.erro, semBotoes: naoPode.semBotoes });
      propostas = [{ por: "profissional", valor: HORA_CENT / 100, estado: "pendente", criadaEm: agora.toISOString() }];
      return { ok: true, confirmou: true, depoisDoPrazo, texto: textoDepoisDeConfirmar(HORA_CENT, IVA, depoisDoPrazo), estado, propostas } as T;
    }
    if (corpo.accao === "propor") {
      const valor = Number(corpo.valor);
      if (Math.round(valor * 100) > HORA_CENT) throw new ErroDeMentira("Pode propor esse valor ou menos, à hora — nunca mais.", 409, { acimaDaHora: true });
      propostas = [...propostas, { por: "profissional", valor, estado: "pendente", criadaEm: agora.toISOString() }];
      return { ok: true, texto: textoDaPropostaMaisBaixa(Math.round(valor * 100), IVA), estado, propostas } as T;
    }
    if (corpo.accao === "desistir") return { ok: true, estado: "desistida", propostas } as T;
    throw new ErroDeMentira("Acção desconhecida.", 400);
  };
  return { pedir, pedidos, propostasJson: () => JSON.stringify(propostas) };
}

describe("1. os dois botões só na primeira resposta de uma mudança escolhida", () => {
  it("com o prazo a correr: os textos da rota, tal como o painel os lê", () => {
    const t = trabalho(ANTES);
    expect(primeiraRespostaDe(t)).toEqual({
      accao: ACCAO_DE_CONFIRMAR_A_HORA,
      confirmar: botaoConfirmo(HORA_CENT),
      proporMaisBaixo: TEXTOS_DO_ESCOLHIDO.proporMaisBaixo,
      naoEstouInteressado: TEXTOS_DO_ESCOLHIDO.naoEstouInteressado,
      rotuloDoValor: TEXTOS_DO_ESCOLHIDO.rotuloDoValor,
      regraDoValorMaisBaixo: regraDoValorMaisBaixo(HORA_CENT),
      enviarProposta: TEXTOS_DO_ESCOLHIDO.enviarProposta,
      voltar: TEXTOS_DO_ESCOLHIDO.voltar,
    });
    // (O espaço antes do € é o do `formatarEuros`, que não parte de linha.)
    expect(primeiraRespostaDe(t)?.confirmar).toMatch(/^Confirmo: faço por 40,00\s€\/h \+ IVA$/);
  });

  it("depois do prazo os botões continuam lá (ainda pode responder)", () => {
    const t = trabalho(DEPOIS);
    expect(t.mudancaEscolhida.prazoPassou).toBe(true);
    expect(primeiraRespostaDe(t)?.accao).toBe(ACCAO_DE_CONFIRMAR_A_HORA);
  });

  it("já respondeu, a negociação já não está aberta, ou não é uma mudança escolhida: o ecrã de sempre", () => {
    expect(primeiraRespostaDe(trabalho(ANTES, { jaRespondeu: true }))).toBeNull();
    expect(primeiraRespostaDe(trabalho(ANTES, {}, "desistida"))).toBeNull();
    expect(primeiraRespostaDe(trabalho(ANTES, {}, "aguarda_contratacao"))).toBeNull();
    expect(primeiraRespostaDe({ ...trabalho(ANTES), estado: "morta" })).toBeNull();
    expect(primeiraRespostaDe({ estado: "aberta", mudancaEscolhida: null })).toBeNull();
    expect(primeiraRespostaDe({ estado: "aberta" })).toBeNull();
  });

  it("o ecrã do trabalho mostra-os em vez do formulário, e só nesse caso", () => {
    const ECRA = semNotas("app-pro/src/app/trabalho/[id].tsx");
    expect(ECRA).toContain("const primeira = primeiraRespostaDe(t);");
    const ramo = ECRA.slice(ECRA.indexOf("if (escolhida && primeira) {"), ECRA.indexOf("const valorProposto = lerValor(texto);"));
    expect(ramo).toContain("<ConfirmarAHora");
    expect(ramo).toContain("textos={primeira}");
    expect(ramo).toContain("hora={escolhida.hora}");
    expect(ramo).toContain("aoMudar={recarregar}");
    // Sem o formulário de negociação neste ramo: nem o campo, nem os atalhos, nem as propostas por usar.
    expect(ramo).not.toContain("<TextInput");
    expect(ramo).not.toContain("propostas por usar");
    expect(ramo).not.toContain("MateriaisDaProposta");
    // O ramo fecha antes do formulário de sempre.
    expect(ramo.trim().endsWith("}")).toBe(true);
  });
});

describe("2. confirma com um toque", () => {
  it("um só pedido à rota da negociação, com a acção da rota e SEM valor", async () => {
    const s = servidor(ANTES);
    const t = trabalho(ANTES);
    const textos = primeiraRespostaDe(t)!;
    const r = await responderComoEscolhido(s.pedir, 77, textos, { tipo: "confirmar" });
    expect(s.pedidos).toHaveLength(1);
    expect(s.pedidos[0].caminho).toBe(ROTA_DA_NEGOCIACAO);
    expect(ROTA_DA_NEGOCIACAO).toBe("/api/profissionais/negociacao");
    expect(s.pedidos[0].corpo).toEqual({ negociacaoId: 77, accao: "confirmar_hora", avisosAceites: false });
    expect("valor" in s.pedidos[0].corpo).toBe(false);
    expect(r).toEqual({ ok: true, confirmou: true, depoisDoPrazo: false, texto: textoDepoisDeConfirmar(HORA_CENT, IVA, false) });
  });

  it("a frase que fica é a da rota, e é a mesma que a lista traz depois (`respostaTexto`)", async () => {
    const s = servidor(ANTES);
    const r = await responderComoEscolhido(s.pedir, 77, primeiraRespostaDe(trabalho(ANTES))!, { tipo: "confirmar" });
    const depois = trabalho(ANTES, { jaRespondeu: true, propostasJson: s.propostasJson() });
    expect(primeiraRespostaDe(depois)).toBeNull();
    expect(r.ok && r.texto).toBe(depois.mudancaEscolhida.respostaTexto);
    expect(depois.mudancaEscolhida.respostaTexto).toMatch(/^Confirmou: 40,00\s€\/h \+ IVA \(49,20\s€\/h com IVA\)\./);
  });

  it("o botão do ecrã faz isso mesmo: um toque em «confirmar» chama a regra, sem pergunta no meio", () => {
    const C = semNotas("app-pro/src/componentes/ConfirmarAHora.tsx");
    expect(C).toContain('<Botao titulo={textos.confirmar} ocupado={aEnviar} aoCarregar={() => void agir({ tipo: "confirmar" })} />');
    expect(C).toContain("const r = await responderComoEscolhido(pedir, negociacaoId, textos, resposta, avisosAceites);");
    // Um segundo toque enquanto o primeiro vai a caminho não envia outra vez.
    expect(C).toContain("if (aEnviar) return;");
    // Depois, a frase da rota no lugar dos botões, e a lista volta a ler-se.
    expect(C).toContain("if (r.texto) setFeito(r.texto);");
    expect(C).toContain('if (feito) return <Mensagem tom="bom" texto={feito} />;');
    expect(C).toContain("await aoMudar();");
  });

  it("o corpo de cada resposta: confirmar nunca leva valor; propor leva o dele; sair não leva nada", () => {
    const textos = { accao: ACCAO_DE_CONFIRMAR_A_HORA };
    expect(corpoDaResposta(5, textos, { tipo: "confirmar" })).toEqual({ negociacaoId: 5, accao: ACCAO_DE_CONFIRMAR_A_HORA, avisosAceites: false });
    expect(corpoDaResposta(5, textos, { tipo: "confirmar" }, true)).toEqual({ negociacaoId: 5, accao: ACCAO_DE_CONFIRMAR_A_HORA, avisosAceites: true });
    expect(corpoDaResposta(5, textos, { tipo: "propor", valor: 35.5 })).toEqual({ negociacaoId: 5, accao: "propor", valor: 35.5, avisosAceites: false });
    expect(corpoDaResposta(5, textos, { tipo: "desistir" })).toEqual({ negociacaoId: 5, accao: "desistir", avisosAceites: false });
  });
});

describe("3. depois do prazo ainda confirma", () => {
  it("lê a variante tardia, a mesma que a lista traz depois", async () => {
    const s = servidor(DEPOIS);
    const r = await responderComoEscolhido(s.pedir, 77, primeiraRespostaDe(trabalho(DEPOIS))!, { tipo: "confirmar" });
    expect(r).toEqual({ ok: true, confirmou: true, depoisDoPrazo: true, texto: textoDepoisDeConfirmar(HORA_CENT, IVA, true) });
    expect(r.ok && r.texto).toMatch(/^Confirmou depois do prazo: /);
    const depois = trabalho(DEPOIS, { jaRespondeu: true, propostasJson: s.propostasJson() });
    expect(depois.mudancaEscolhida.respostaTexto).toBe(r.ok ? r.texto : "");
  });

  it("o prazo terminado lê-se em texto corrido (a frase é comprida), e a frase de depois de responder fica à vista", () => {
    const ECRA = semNotas("app-pro/src/app/trabalho/[id].tsx");
    expect(ECRA).toContain("{m.prazoTexto && m.prazoPassou ? <Text style={{ color: c.suave, lineHeight: 20 }}>{m.prazoTexto}</Text> : null}");
    expect(ECRA).toContain('{m.prazoTexto && !m.prazoPassou ? <Etiqueta texto={m.prazoTexto} tom="aviso" /> : null}');
    expect(ECRA).toContain('{m.respostaTexto ? <Mensagem tom="bom" texto={m.respostaTexto} /> : null}');
    expect(trabalho(DEPOIS).mudancaEscolhida.prazoTexto).toBe("O prazo terminou às 19:00. Ainda pode responder, mas o cliente já foi avisado.");
  });
});

describe("4. «Propor um valor mais baixo»", () => {
  it("vai como proposta, com o valor dele, e a frase é a da rota", async () => {
    const s = servidor(ANTES);
    const r = await responderComoEscolhido(s.pedir, 77, primeiraRespostaDe(trabalho(ANTES))!, { tipo: "propor", valor: 35 });
    expect(s.pedidos).toEqual([{ caminho: ROTA_DA_NEGOCIACAO, corpo: { negociacaoId: 77, accao: "propor", valor: 35, avisosAceites: false } }]);
    expect(r).toEqual({ ok: true, confirmou: false, depoisDoPrazo: false, texto: textoDaPropostaMaisBaixa(3500, IVA) });
    const depois = trabalho(ANTES, { jaRespondeu: true, propostasJson: s.propostasJson() });
    expect(depois.mudancaEscolhida.respostaTexto).toBe(r.ok ? r.texto : "");
  });

  it("acima da hora dele quem recusa é o servidor, com a frase dele; a app só não mostra o que receberia", async () => {
    const s = servidor(ANTES);
    const r = await responderComoEscolhido(s.pedir, 77, primeiraRespostaDe(trabalho(ANTES))!, { tipo: "propor", valor: 45 });
    expect(r).toEqual({ ok: false, erro: "Pode propor esse valor ou menos, à hora — nunca mais.", semBotoes: false });
    expect(cabeNaHora(45, 40)).toBe(false);
    expect(cabeNaHora(40, 40)).toBe(true);
    expect(cabeNaHora(39.99, 40)).toBe(true);
    expect(cabeNaHora(0, 40)).toBe(false);
    expect(cabeNaHora(null, 40)).toBe(false);
  });
});

describe("5. as recusas da rota", () => {
  it("contratado a outro, cancelado ou fechado: a frase da rota e os botões saem", async () => {
    for (const [inicio, frase] of [
      [{ estado: "morta" }, ERROS_DO_ESCOLHIDO.contratouOutro],
      [{ estadoDoPedido: "cancelado" }, ERROS_DO_ESCOLHIDO.cancelado],
      [{ estadoDoPedido: "concluido" }, ERROS_DO_ESCOLHIDO.fechado],
    ] as const) {
      const s = servidor(ANTES, inicio);
      expect(await responderComoEscolhido(s.pedir, 77, { accao: ACCAO_DE_CONFIRMAR_A_HORA }, { tipo: "confirmar" })).toEqual({ ok: false, erro: frase, semBotoes: true });
    }
  });

  it("já confirmou (um segundo toque noutro aparelho): a frase da rota, e os botões ficam", async () => {
    const s = servidor(ANTES);
    const textos = { accao: ACCAO_DE_CONFIRMAR_A_HORA };
    await responderComoEscolhido(s.pedir, 77, textos, { tipo: "confirmar" });
    expect(await responderComoEscolhido(s.pedir, 77, textos, { tipo: "confirmar" })).toEqual({ ok: false, erro: ERROS_DO_ESCOLHIDO.jaConfirmou, semBotoes: false });
  });

  it("os avisos antes de se comprometer: lê-os, e o mesmo pedido volta com `avisosAceites`", async () => {
    const s = servidor(ANTES, { avisos: ["guia_por_verificar"] });
    const textos = { accao: ACCAO_DE_CONFIRMAR_A_HORA };
    expect(await responderComoEscolhido(s.pedir, 77, textos, { tipo: "confirmar" })).toEqual({ ok: false, avisos: ["guia_por_verificar"] });
    const r = await responderComoEscolhido(s.pedir, 77, textos, { tipo: "confirmar" }, true);
    expect(r.ok).toBe(true);
    expect(s.pedidos[1].corpo).toEqual({ negociacaoId: 77, accao: ACCAO_DE_CONFIRMAR_A_HORA, avisosAceites: true });
    const C = semNotas("app-pro/src/componentes/ConfirmarAHora.tsx");
    expect(C).toContain("aoCarregar={() => void agir(porConfirmar.resposta, true)}");
  });

  it("sem resposta nenhuma (sem rede): a frase da lib do site, e nunca lança", async () => {
    const semRede: PedirDaApp = async () => {
      throw new TypeError("Network request failed");
    };
    expect(await responderComoEscolhido(semRede, 77, { accao: ACCAO_DE_CONFIRMAR_A_HORA }, { tipo: "confirmar" })).toEqual({
      ok: false,
      erro: ERROS_DO_ESCOLHIDO.rede,
      semBotoes: false,
    });
    expect(lerRecusa(new ErroDeMentira("", 500))).toEqual({ ok: false, erro: ERROS_DO_ESCOLHIDO.rede, semBotoes: false });
  });

  it("o erro que a regra lê pela forma é o `ErroDaApi` da app", () => {
    const API = semNotas("app-pro/src/lib/api.ts");
    expect(API).toContain("export class ErroDaApi extends Error { constructor( message: string, readonly estado: number, readonly corpo: Record<string, unknown> = {}, )");
  });
});

describe("6. paridade — a app não tem frases próprias: lê as do site", () => {
  const C = semNotas("app-pro/src/componentes/ConfirmarAHora.tsx");
  const REGRA = semNotas("app-pro/src/lib/confirmar-a-hora.ts");
  const PAINEL = semNotas("src/app/profissionais/painel/ConfirmarAHora.tsx");

  it("os mesmos textos da rota nos mesmos sítios, no painel e na app", () => {
    for (const campo of ["confirmar", "proporMaisBaixo", "naoEstouInteressado", "rotuloDoValor", "regraDoValorMaisBaixo", "enviarProposta", "voltar"]) {
      expect(PAINEL, `painel: textos.${campo}`).toContain(`textos.${campo}`);
      expect(C, `app: textos.${campo}`).toContain(`textos.${campo}`);
    }
    // A acção também é a da rota (no painel `textos.accao`; na app, pela regra).
    expect(PAINEL).toContain("agir(textos.accao)");
    expect(REGRA).toContain('if (r.tipo === "confirmar") return { negociacaoId, accao: textos.accao, avisosAceites };');
    // O que recebe se descer, com as mesmas palavras do painel.
    expect(PAINEL).toContain("Recebe {euros(quantoOProfissionalRecebe(numero, taxas))}/h, já com a taxa.");
    expect(C).toContain("Recebe {euros(quantoOProfissionalRecebe(numero, taxas))}/h, já com a taxa.");
  });

  it("nenhuma frase da lib está escrita à mão na app (nem os botões, nem as regras, nem os erros)", () => {
    const frases = [
      ...Object.values(TEXTOS_DO_ESCOLHIDO),
      ...Object.values(ERROS_DO_ESCOLHIDO),
      "Confirmo: faço por",
      "Escreva um valor por hora abaixo da sua hora",
      "Confirmou depois do prazo",
      "O cliente está a escolher",
      "está com o cliente. Avisamos quando ele responder",
      "O prazo terminou",
    ];
    for (const frase of frases) {
      expect(C, frase).not.toContain(frase);
      expect(REGRA, frase).not.toContain(frase);
    }
    // A de sem rede vem importada da porta única da lib.
    expect(REGRA).toContain('import { ERROS_DO_ESCOLHIDO } from "../../../src/lib/escolhidos-sem-resposta";');
    expect(REGRA).not.toContain('"confirmar_hora"');
  });

  it("o tipo dos textos é o do site, não uma cópia", () => {
    expect(REGRA).toContain('import type { MudancaEscolhida } from "../../../src/lib/mudanca-escolhida-pelo-cliente";');
    expect(REGRA).toContain('export type TextosDaPrimeiraResposta = NonNullable<MudancaEscolhida["primeiraResposta"]>;');
  });
});
