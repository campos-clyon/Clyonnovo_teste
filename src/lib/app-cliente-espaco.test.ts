import { describe, expect, it } from "vitest";
import {
  camposEmFalta,
  catalogoValido,
  corpoDaReferencia,
  corpoDoPedido,
  rascunhoVazio,
  type Catalogo,
  type Rascunho,
} from "../../app-cliente/src/lib/novo-pedido";
import { catalogoDaApp } from "./catalogo-da-app";
import { lerPedidoParaReferencia, referenciaDoPedido } from "./preco-de-referencia";
import { NOMES_DAS_FAIXAS, eEsvaziamentoDeEspaco } from "./precos-publicos";
import {
  PERGUNTAS_DO_ESPACO,
  RESPOSTAS_DA_QUANTIDADE,
  acessoDificilDoEspaco,
  linhaDaQuantidade,
  linhaDasCoisas,
  linhaDoAcesso,
} from "./perguntas-do-espaco";

/**
 * O TESTE DE CONTRATO DA APP DE CLIENTE COM O SIMULADOR DO SITE — d5, 31-10-2026.
 *
 * Para cada serviço do catálogo (R7), o corpo que a app manda à R12 passa pela
 * leitura do servidor (`lerPedidoParaReferencia`, depois de ir e vir em JSON) e
 * tem de dar exactamente as linhas que o simulador do site mostra para as
 * mesmas escolhas (`referenciaDoPedido` com o que o `PrecoDeReferencia` do
 * simulador lhe passa). Na garagem, no sótão e na cave, em todas as
 * combinações de quantidade, acesso e estacionamento; e as linhas que a app
 * escreve na descrição do pedido são as do simulador.
 */

const viaJson = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const c = catalogoValido(viaJson(catalogoDaApp())) as Catalogo;
const ESTACIONAMENTOS = [undefined, "door", "under_20m", "over_30m", "difficult"] as const;
const base = (extra: Partial<Rascunho>): Rascunho => ({ ...rascunhoVazio(), descricao: "Coisas para levar", ...extra });

/** As linhas que a R12 devolve para o corpo que a app manda. */
function linhasDaApp(r: Rascunho) {
  const corpo = corpoDaReferencia(r, c);
  const lido = lerPedidoParaReferencia(viaJson(corpo));
  expect(lido, r.servico).not.toBeNull();
  return referenciaDoPedido(lido!);
}

/** As linhas que o simulador do site mostra (src/app/simulador/SimulatorThreePhaseForm.tsx, PrecoDeReferencia). */
function linhasDoSite(servico: string, volume?: string, acesso?: string, estacionamento?: string) {
  return referenciaDoPedido({
    servico,
    volume: eEsvaziamentoDeEspaco(servico) ? volume : undefined,
    acessoDificil: acessoDificilDoEspaco(servico, acesso, estacionamento),
  });
}

/** Todos os subconjuntos de uma lista (as coisas do espaço são poucas). */
const subconjuntos = <T,>(l: readonly T[]): T[][] => l.reduce<T[][]>((acc, x) => [...acc, ...acc.map((s) => [...s, x])], [[]]);

describe("d5 — o contrato da app de cliente com o simulador do site", () => {
  it("o catálogo da app tem todos os serviços da R7, e os três espaços com as perguntas", () => {
    expect(c.servicos.map((s) => s.id)).toEqual(catalogoDaApp().servicos.map((s) => s.id));
    for (const s of c.servicos) expect(!!s.espaco, s.id).toBe(eEsvaziamentoDeEspaco(s.id));
  });

  it("para cada serviço do catálogo, a app e o simulador dão as mesmas linhas", () => {
    for (const s of c.servicos) {
      if (s.espaco) continue;
      const extra: Partial<Rascunho> = s.detalhes === "moveis" ? { movelModo: "carga", volume: "carrinha" } : {};
      expect(linhasDaApp(base({ servico: s.id, ...extra })), s.id).toEqual(linhasDoSite(s.id));
    }
  });

  it("garagem, sótão e cave: em todas as combinações, «Para o que escolheu» com o IVA ao lado, igual ao site", () => {
    let combinacoes = 0;
    for (const servico of Object.keys(PERGUNTAS_DO_ESPACO)) {
      for (const q of RESPOSTAS_DA_QUANTIDADE) {
        for (const a of PERGUNTAS_DO_ESPACO[servico].acesso.opcoes) {
          for (const est of ESTACIONAMENTOS) {
            const r = base({ servico, volume: q.valor, acessoDoEspaco: a.valor, acesso: { parkingDistance: est } });
            const app = linhasDaApp(r);
            expect(app, `${servico} ${q.valor} ${a.valor} ${est}`).toEqual(linhasDoSite(servico, q.valor, a.valor, est));
            expect(app.linhas.map((l) => l.rotulo)).toContain("Para o que escolheu");
            for (const l of app.linhas) expect(l.texto, l.rotulo).toMatch(/com IVA|Proposta com fotografias/);
            combinacoes++;
          }
        }
      }
    }
    expect(combinacoes).toBe(3 * 4 * 3 * 5);
  });

  it("os nomes da quantidade são os das faixas do site, não os da app", () => {
    for (const servico of Object.keys(PERGUNTAS_DO_ESPACO)) {
      const e = c.servicos.find((s) => s.id === servico)!.espaco!;
      expect(e.quantidade.opcoes.map((o) => o.nome)).toEqual(RESPOSTAS_DA_QUANTIDADE.map((r) => r.texto));
      expect(e.quantidade.opcoes.slice(0, 3).map((o) => o.nome)).toEqual(Object.values(NOMES_DAS_FAIXAS));
      expect(e.acesso.titulo).toBe(PERGUNTAS_DO_ESPACO[servico].acesso.titulo);
    }
  });

  it("as linhas da descrição e os campos do pedido são os do simulador, para todas as respostas", () => {
    for (const servico of Object.keys(PERGUNTAS_DO_ESPACO)) {
      const p = PERGUNTAS_DO_ESPACO[servico];
      const coisas = (p.coisas ?? []).map((o) => o.valor);
      for (const q of RESPOSTAS_DA_QUANTIDADE) {
        for (const a of p.acesso.opcoes) {
          for (const escolha of p.coisas ? subconjuntos(coisas) : [[]]) {
            const r = base({ servico, volume: q.valor, acessoDoEspaco: a.valor, coisasDoEspaco: escolha, acesso: { floor: "rés-do-chão", parkingDistance: "door" } });
            const { order } = corpoDoPedido(r, c, { emailDaSessao: "a@b.pt", rascunhosAntes: 0 });
            const linhas = String(order.description).split("\n");
            const doSite = [linhaDaQuantidade(q.valor), linhaDoAcesso(servico, a.valor), linhaDasCoisas(servico, escolha)].filter(Boolean);
            expect(linhas.slice(0, doSite.length), `${servico} ${escolha.join(",")}`).toEqual(doSite);
            expect(linhas.at(-1)).toBe("Coisas para levar");
            expect(order).toMatchObject({ serviceType: servico, volumeTier: q.valor, acessoDoEspaco: a.valor });
            expect(order.coisasDoEspaco).toEqual(escolha.length > 0 ? escolha : undefined);
            expect(order.quantityExact).toBeUndefined();
            expect(order.needsDismantling).toBeUndefined();
            if (!p.perguntaOAndar) expect(order).toMatchObject({ floor: "rés-do-chão", hasElevator: undefined });
          }
        }
      }
    }
  });

  it("a quantidade e o acesso são obrigatórios, como no simulador; a garagem e a cave não pedem o andar", () => {
    const g = base({ servico: "esvaziamento_garagem" });
    expect(camposEmFalta(g, 1, c).map((x) => x.campo)).toEqual(["volume", "acessoDoEspaco"]);
    expect(camposEmFalta(g, 1, c)[1].texto).toBe("Responda a «Onde fica a garagem?»");
    expect(camposEmFalta({ ...g, volume: "carrinha", acessoDoEspaco: "rua" }, 1, c)).toEqual([]);
    const m = { formattedAddress: "Rua Inventada 1, Almada" };
    expect(camposEmFalta({ ...g, morada: m, acesso: { parkingDistance: "door" } }, 2, c)).toEqual([]);
    // O sótão pergunta o andar e o elevador.
    expect(camposEmFalta(base({ servico: "esvaziamento_sotao", morada: m, acesso: { parkingDistance: "door" } }), 2, c).map((x) => x.campo)).toEqual(["acesso"]);
  });

  it("uma R7 antiga, sem as perguntas, não parte a app: o serviço volta a ser um esvaziamento qualquer", () => {
    const antigo = viaJson(catalogoDaApp()) as unknown as { servicos: Array<Record<string, unknown>> };
    for (const s of antigo.servicos) delete s.espaco;
    const velho = catalogoValido(antigo) as Catalogo;
    expect(velho.servicos.every((s) => s.espaco === null)).toBe(true);
    expect(corpoDaReferencia(base({ servico: "esvaziamento_garagem", volume: "carrinha" }), velho)).toMatchObject({ volume: undefined });
  });
});
