import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import {
  avisoAEquipaDaMensagem,
  avisoAoClienteDaResposta,
  avisoAoParceiroDaAlteracao,
  chaveDoAvisoAoCliente,
  eHojeOuAmanha,
  linhaDaMensagemNoPedido,
  mensagemPorResponder,
  motivoDaEquipa,
  pedeAlteracao,
  quandoAvisarOCliente,
  VITORIA_NO_HISTORICO,
} from "./mensagem-no-suporte";
import {
  avisoDaRespostaNoSuporte,
  decidirNoSuporte,
  lerNoSuporte,
  respostaDePassarAEquipa,
} from "./vitoria-agente/resposta-no-suporte";
import type { ClienteDoClaude } from "./vitoria-agente/cliente";
import { motivoParaBloquearAResposta } from "./vitoria-agente/intencao";
import { conversaDoHistorico, porResponder, type ConversaDeSuporte } from "./conversas-de-suporte";
import { correrOsAvisosDaEquipa, type AvisoAEquipa, type DependenciasDosAvisos } from "./avisos-a-equipa";
import { recebeOAviso } from "./avisos-a-equipa-na-base";
import { diaEmLisboa, horaEmLisboa } from "./hora-de-lisboa";

/*
 * d140 (aprovada pelo dono, 27-11-2026) — UMA MENSAGEM NO SUPORTE NUNCA FICA
 * CALADA. O caso: uma cliente escreveu DENTRO do pedido #668 (Suporte › «No
 * pedido») a pedir trabalho a mais; a Vitória não respondeu (só tratava o
 * WhatsApp) e a equipa só a viu no dia seguinte. O modelo é fingido (nunca se
 * chama a API num teste) e nada sai a ninguém. Sem dados reais.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PEDIDO = 668;
const PEDE_MAIS = "Boa tarde, além do sofá queria que levassem também mais duas cadeiras e uma mesa. É possível?";
const historico = (...entradas: object[]) => JSON.stringify(entradas);
const doCliente = (message: string, createdAt: string) => ({ type: "client_reply", by: { id: 0, nome: "Cliente Exemplo", role: "cliente" }, message, createdAt });
const daClyon = (message: string, createdAt: string, extra: object = {}) => ({ type: "message_to_client", by: { id: 3, nome: "Equipa", role: "admin" }, message, createdAt, ...extra });

/** Um cliente fingido do Claude que devolve este JSON. */
function fingido(json: object | string, stop: Anthropic.Beta.BetaMessage["stop_reason"] = "end_turn"): ClienteDoClaude & { pedidos: unknown[] } {
  const pedidos: unknown[] = [];
  return {
    pedidos,
    beta: {
      messages: {
        create: async (p) => {
          pedidos.push(p);
          return {
            id: "msg_x",
            type: "message",
            role: "assistant",
            model: "fingido",
            stop_reason: stop,
            content: [{ type: "text", text: typeof json === "string" ? json : JSON.stringify(json) }],
            usage: { input_tokens: 10, output_tokens: 10 },
          } as unknown as Anthropic.Beta.BetaMessage;
        },
      },
    },
  };
}

describe("o caso do #668: trabalho a mais pedido dentro do pedido", () => {
  it("é da equipa (o código decide, não o modelo), e pede uma alteração ao parceiro", () => {
    expect(motivoDaEquipa(PEDE_MAIS)).toBe("Pede trabalho a mais");
    expect(pedeAlteracao(PEDE_MAIS)).toBe(true);
  });

  it("mesmo que o modelo diga que responde sozinho, passa à equipa e diz que a equipa confirma", () => {
    const d = decidirNoSuporte(
      { resposta: "Claro, levamos tudo pelo mesmo valor!", passarAEquipa: false, motivo: "" },
      { pedidoId: PEDIDO, motivoDasRegras: motivoDaEquipa(PEDE_MAIS) },
    );
    expect(d.tipo).toBe("equipa");
    expect(d.texto).toBe(respostaDePassarAEquipa(PEDIDO));
    expect(d.texto).toContain("equipa da CLYON confirma");
    expect(d.texto).toContain(`#${PEDIDO}`);
    if (d.tipo === "equipa") expect(d.motivo).toBe("Pede trabalho a mais");
  });

  it("ao passar, aproveita a frase do modelo só se disser que a equipa confirma, sem euros", () => {
    const boa = "Obrigada! Anotei as duas cadeiras e a mesa. Uma pessoa da equipa da CLYON confirma consigo aqui no pedido.";
    expect(decidirNoSuporte({ resposta: boa, passarAEquipa: true, motivo: "trabalho a mais" }, { pedidoId: PEDIDO, motivoDasRegras: "Pede trabalho a mais" }).texto).toBe(boa);
    const comEuros = "Uma pessoa da equipa confirma, mas fica em 40 €.";
    expect(decidirNoSuporte({ resposta: comEuros, passarAEquipa: true, motivo: "" }, { pedidoId: PEDIDO, motivoDasRegras: "Pede trabalho a mais" }).texto).toBe(
      respostaDePassarAEquipa(PEDIDO),
    );
  });

  it("a frase fixa passa a guarda de sempre", () => {
    expect(motivoParaBloquearAResposta(respostaDePassarAEquipa(PEDIDO), false)).toBeNull();
  });

  it("a mensagem fica por responder depois da resposta da Vitória que passou à equipa — e sai com a resposta da equipa", () => {
    const h1 = historico(doCliente(PEDE_MAIS, "2026-11-26 17:40:00"));
    expect(mensagemPorResponder(h1)).toEqual({ desde: "2026-11-26 17:40:00", motivo: null });
    const h2 = historico(
      doCliente(PEDE_MAIS, "2026-11-26 17:40:00"),
      { type: "message_to_client", by: VITORIA_NO_HISTORICO, message: respostaDePassarAEquipa(PEDIDO), createdAt: "2026-11-26 17:40:20", passaAEquipa: true, motivo: "Pede trabalho a mais" },
    );
    expect(mensagemPorResponder(h2)).toEqual({ desde: "2026-11-26 17:40:00", motivo: "Pede trabalho a mais" });
    const h3 = historico(...JSON.parse(h2), daClyon("Confirmámos com o parceiro: fica tudo no mesmo dia.", "2026-11-27 09:10:00"));
    expect(mensagemPorResponder(h3)).toBeNull();
    // Um histórico estragado não é «por responder».
    expect(mensagemPorResponder("{não é json")).toBeNull();
  });

  it("no Suporte, a conversa continua com o ponto «por responder»", () => {
    const h = historico(
      doCliente(PEDE_MAIS, "2026-11-26 17:40:00"),
      { type: "message_to_client", by: VITORIA_NO_HISTORICO, message: respostaDePassarAEquipa(PEDIDO), createdAt: "2026-11-26 17:40:20", passaAEquipa: true, motivo: "x" },
    );
    const c: ConversaDeSuporte = { chave: `pedido:${PEDIDO}`, origem: "pedido", quem: "x", contacto: null, pedidoId: PEDIDO, assunto: null, mensagens: conversaDoHistorico(h) };
    expect(c.mensagens.map((m) => m.de)).toEqual(["eles", "clyon"]);
    expect(porResponder(c)).toBe(true);
  });

  it("a linha da Mesa diz há quanto tempo", () => {
    expect(linhaDaMensagemNoPedido("2026-11-26 17:40:00", new Date("2026-11-27T09:40:00Z"))).toBe("Mensagem no pedido por responder há 16 h");
    expect(linhaDaMensagemNoPedido("2026-11-25 09:00:00", new Date("2026-11-27T09:40:00Z"))).toBe("Mensagem no pedido por responder há 2 dias");
  });
});

describe("o que é da equipa e o que a Vitória responde sozinha", () => {
  it("queixas, cancelar, valor, alterações e pedir uma pessoa passam", () => {
    expect(motivoDaEquipa("O parceiro partiu-me a porta, quero apresentar queixa")).toBe("Queixa do cliente");
    expect(motivoDaEquipa("Quero cancelar e que me devolvam o sinal")).toBe("Quer cancelar");
    expect(motivoDaEquipa("Podem fazer um desconto?")).toBe("Fala de mudar o valor");
    expect(motivoDaEquipa("Dá para mudar o dia para sexta?")).toMatch(/alteração/);
    expect(motivoDaEquipa("Podemos remarcar?")).toMatch(/alteração/);
    expect(motivoDaEquipa("Queria falar com uma pessoa")).toBe("Pede para falar com uma pessoa");
  });

  it("uma dúvida geral ou um obrigado não passam", () => {
    expect(motivoDaEquipa("Passam fatura?")).toBeNull();
    expect(motivoDaEquipa("Obrigada!")).toBeNull();
    expect(pedeAlteracao("Passam fatura?")).toBe(false);
  });

  it("sem leitura, com a guarda a barrar, ou com o modelo a passar: a frase fixa e um motivo", () => {
    const sem = decidirNoSuporte(null, { pedidoId: PEDIDO, motivoDasRegras: null, erro: "sem a chave do Claude" });
    expect(sem).toMatchObject({ tipo: "equipa", texto: respostaDePassarAEquipa(PEDIDO) });
    if (sem.tipo === "equipa") expect(sem.motivo).toContain("sem a chave do Claude");
    const barrada = decidirNoSuporte({ resposta: "O profissional chega no próprio dia.", passarAEquipa: false, motivo: "" }, { pedidoId: PEDIDO, motivoDasRegras: null });
    expect(barrada.tipo).toBe("equipa");
    const ok = decidirNoSuporte({ resposta: "Sim, há sempre fatura: a do trabalho, do parceiro, e a da taxa da plataforma.", passarAEquipa: false, motivo: "" }, { pedidoId: PEDIDO, motivoDasRegras: null });
    expect(ok).toEqual({ tipo: "responder", texto: "Sim, há sempre fatura: a do trabalho, do parceiro, e a da taxa da plataforma." });
  });

  it("o mesmo cérebro da d129: o prompt único, os limites, e que aqui é o Suporte do pedido", () => {
    const aviso = avisoDaRespostaNoSuporte(new Date("2026-11-27T10:00:00Z"));
    expect(aviso).toContain("OS LIMITES");
    expect(aviso).toContain("Suporte de um pedido");
    expect(aviso).toContain("Trabalho a mais");
    expect(aviso).not.toMatch(/inteligência artificial(?! nem)/i);
  });

  it("a leitura vai ao modelo uma vez, com o aviso em cache, e lê o JSON", async () => {
    const c = fingido({ resposta: "Há sempre fatura.", passarAEquipa: false, motivo: "" });
    const r = await lerNoSuporte(
      { agora: new Date(), pedido: { id: PEDIDO, servico: "recolha_monos", estado: "pendente", dia: null, contratado: false }, conversa: [], ultima: "Passam fatura?" },
      c,
    );
    expect(r.erro).toBeNull();
    expect(r.leitura).toEqual({ resposta: "Há sempre fatura.", passarAEquipa: false, motivo: "" });
    expect(c.pedidos).toHaveLength(1);
    const p = c.pedidos[0] as { system: Array<{ cache_control?: unknown }>; messages: Array<{ content: string }> };
    expect(p.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(p.messages[0].content).toContain(`#${PEDIDO}`);
    const recusou = await lerNoSuporte({ agora: new Date(), pedido: { id: 1, servico: null, estado: null, dia: null, contratado: false }, conversa: [], ultima: "x" }, fingido("{}", "refusal"));
    expect(recusou.leitura).toBeNull();
  });
});

describe("os avisos", () => {
  it("ao cliente: curto, com a ligação; um por pedido e por dia; das 9h às 20h, senão às 9h", () => {
    expect(avisoAoClienteDaResposta(PEDIDO, "https://clyon.pt/conta")).toBe(`Respondemos à sua mensagem no pedido #${PEDIDO}: https://clyon.pt/conta`);
    const tarde = new Date("2026-11-26T17:40:00Z"); // 17:40 em Lisboa (inverno, UTC+0)
    expect(quandoAvisarOCliente(tarde)).toBe(tarde);
    const noite = new Date("2026-11-26T21:30:00Z");
    const as9 = quandoAvisarOCliente(noite);
    expect(diaEmLisboa(as9)).toBe("2026-11-27");
    expect(horaEmLisboa(as9)).toBe("09:00");
    const madrugada = new Date("2026-11-27T06:00:00Z");
    expect(diaEmLisboa(quandoAvisarOCliente(madrugada))).toBe("2026-11-27");
    expect(horaEmLisboa(quandoAvisarOCliente(madrugada))).toBe("09:00");
    // A noite e a manhã seguinte dão o mesmo dia: um aviso só.
    expect(chaveDoAvisoAoCliente(PEDIDO, as9)).toBe(chaveDoAvisoAoCliente(PEDIDO, new Date("2026-11-27T11:00:00Z")));
  });

  it("ao parceiro: só hoje ou amanhã, curto e sem contactos", () => {
    const agora = new Date("2026-11-26T17:40:00Z");
    expect(eHojeOuAmanha("2026-11-27 08:00:00", agora)).toBe(true);
    expect(eHojeOuAmanha("2026-11-26 15:00:00", agora)).toBe(true);
    expect(eHojeOuAmanha("2026-11-29 08:00:00", agora)).toBe(false);
    expect(eHojeOuAmanha(null, agora)).toBe(false);
    const t = avisoAoParceiroDaAlteracao(PEDIDO, `${PEDE_MAIS} Liguem para 912 345 678.`);
    expect(t.startsWith(`CLYON · O cliente do #${PEDIDO} pediu uma alteração: `)).toBe(true);
    expect(t.endsWith("A equipa confirma consigo.")).toBe(true);
    expect(t).not.toContain("912");
  });

  it("à equipa: só o n.º e o motivo, e chega a quem tem o Suporte ou a Mesa", () => {
    const a = avisoAEquipaDaMensagem({ origem: "pedido", id: PEDIDO, quem: "cliente", passouAEquipa: true, motivo: "Pede trabalho a mais" });
    expect(a.titulo).toBe(`Mensagem no pedido #${PEDIDO}`);
    expect(a.corpo).toContain("Pede trabalho a mais");
    const conta = (seccoes: string[], isAdmin = 0) => ({ id: 1, isAdmin, funcao: "assistente", active: 1, seccoesJson: JSON.stringify(seccoes) });
    expect(recebeOAviso(conta(["suporte"]), "suporte")).toBe(true);
    expect(recebeOAviso(conta(["negociacoes_clyon"]), "suporte")).toBe(true);
    expect(recebeOAviso(conta(["whatsapp"]), "suporte")).toBe(false);
    expect(recebeOAviso({ ...conta([], 1), funcao: null }, "suporte")).toBe(true);
  });

  it("guardado fora de horas, sai na passagem das 08h só se ainda estiver por responder", async () => {
    const guardado: AvisoAEquipa = {
      chave: `suporte:p${PEDIDO}`, tipo: "suporte", pedidoId: PEDIDO, telefone: null, desde: new Date("2026-11-27T06:00:00Z"),
      seccao: "suporte", titulo: "t", corpo: "c", url: "/admin?section=suporte",
    };
    const marcados: string[] = [];
    const deps = (porResponder: boolean): DependenciasDosAvisos => ({
      lerDoNossoLado: async () => [],
      lerPorDecidir: async () => [],
      reservar: async () => true,
      entregasPorEnviar: async () => [guardado],
      aindaEntregue: async () => false,
      suporteAindaPorResponder: async () => porResponder,
      marcarEnviado: async (chave, como) => void marcados.push(`${chave}:${como}`),
      enviar: async () => 1,
    });
    const as8 = new Date("2026-11-27T08:05:00Z");
    expect((await correrOsAvisosDaEquipa(deps(true), as8)).entregasEnviadas).toBe(1);
    expect(marcados.pop()).toBe(`suporte:p${PEDIDO}:enviado`);
    await correrOsAvisosDaEquipa(deps(false), as8);
    expect(marcados.pop()).toBe(`suporte:p${PEDIDO}:dispensado`);
  });
});

describe("as ligações no código", () => {
  it("as duas portas do cliente (conta do site e app) chamam a Vitória depois de responder, com `after`", () => {
    for (const f of ["src/app/api/users/me/orders/[id]/reply/route.ts", "src/app/api/cliente/pedidos/[id]/resposta/route.ts"]) {
      const c = semComentarios(ler(f));
      expect(c).toContain("after(() => depoisDeOClienteEscrever(");
    }
    const conversa = semComentarios(ler("src/lib/conversa-com-a-clyon.ts"));
    // O que o «pedir o que falta» já respondeu não volta a ser respondido.
    expect(conversa).toContain("if (!r.ok || r.respondidaPeloQueFalta) return;");
  });

  it("o pedido de ajuda da plataforma avisa a equipa já", () => {
    expect(semComentarios(ler("src/app/api/profissionais/ajuda/route.ts"))).toContain('depoisDaAjudaDaPlataforma(id, "parceiro")');
  });

  it("a Mesa põe as mensagens no pedido em «Precisa de si», e o cron envia os avisos guardados", () => {
    const painel = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
    expect(painel).toContain('fetch("/api/admin/negociacoes/mensagens-no-pedido"');
    expect(painel).toContain('b.chave === "n1" && mensagensNoPedido.length > 0');
    expect(painel).toContain("linhaDaMensagemNoPedido(m.desde, relogioDasMensagens)");
    expect(painel).toContain('outrosSemPropostas.length + mensagensForaDoN1.length');
    expect(semComentarios(ler("src/app/api/cron/assistente/route.ts"))).toContain("enviarOsAvisosDoSuportePendentes()");
  });

  it("a resposta da Vitória fica no histórico do pedido, e nunca se chama «IA» ao cliente", () => {
    const base = semComentarios(ler("src/lib/mensagem-no-suporte-na-base.ts"));
    expect(base).toContain('type: "message_to_client"');
    expect(base).toContain("passaAEquipa: true, motivo: decisao.motivo");
    expect(base).toContain('VITORIA_SUPORTE');
    expect(respostaDePassarAEquipa(PEDIDO)).not.toMatch(/\b(IA|virtual|intelig[êe]ncia artificial)\b/i);
  });
});
