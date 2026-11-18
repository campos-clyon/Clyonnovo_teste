import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { catalogoValido, comResposta, corpoDaReferencia, corpoDoPedido, rascunhoVazio, type Catalogo, type Rascunho } from "../../app-cliente/src/lib/novo-pedido";
import { corpoDaAlteracao, PECAS_NO_ELEVADOR as PECAS_DA_APP, perguntaAsPecasNoElevador } from "../../app-cliente/src/lib/pedidos";
import { catalogoDaApp } from "./catalogo-da-app";
import { lerPedidoParaReferencia, valorDaReferencia } from "./preco-de-referencia";
import { calculateFastEstimate, camposDoPedidoParaOMotor } from "./pricing-helper";
import { camposDaCategoriaParaGravar } from "./pedido-por-categoria";
import { kmParaOrcamento } from "./distancia-estimada";
import { PECAS_NO_ELEVADOR } from "./respostas-do-simulador";
import { TITULO_DAS_PECAS_NO_ELEVADOR } from "./simulador-por-categoria";
import { PRECO_POR_HORA, PRECO_POR_HORA_DUAS_PESSOAS } from "./tabela-das-mudancas";

/*
 * d64 e d65 — 17-11-2026 (o CEO e o dono).
 * d64: «As peças grandes cabem no elevador?» vai no pedido da app de cliente —
 * a R12 contava a escada e o servidor gravava sem ela. O valor que o cliente vê
 * é o que o backoffice grava.
 * d65: na app Pro, o valor sugerido diz o modelo do trabalho, e os exemplos da
 * hora das mudanças são os da referência pública.
 */

const viaJson = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const c = catalogoValido(viaJson(catalogoDaApp())) as Catalogo;
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const responder = (r: Rascunho, respostas: Record<string, string>): Rascunho =>
  Object.entries(respostas).reduce<Rascunho>((a, [id, v]) => ({ ...a, ...comResposta(a, id, v) }), r);

/** O que a app mostra (R12, sem IVA). */
const naApp = (r: Rascunho) => valorDaReferencia(lerPedidoParaReferencia(viaJson(corpoDaReferencia(r, c)))!);

/** O que o servidor grava: os passos da rota `/api/simulador/pedido`, com o corpo que a app manda. */
async function noServidor(r: Rascunho) {
  const order = viaJson(corpoDoPedido(r, c, { emailDaSessao: null, rascunhosAntes: 0 }).order) as Record<string, any>;
  Object.assign(order, camposDaCategoriaParaGravar(order));
  const { km } = kmParaOrcamento({ distanciaMedidaKm: null, codigoPostal: null, morada: null, cidade: null });
  const e = await calculateFastEstimate({
    serviceType: order.serviceType,
    description: order.description ?? "",
    floor: order.floor || undefined,
    hasElevator: order.hasElevator,
    parkingDistance: order.parkingDistance,
    urgency: order.urgency,
    distanceFromBase: { distanceKm: km },
    ...camposDoPedidoParaOMotor(order),
  } as Parameters<typeof calculateFastEstimate>[0]);
  return { order, valor: e.estimatedPriceWithoutVat };
}

const pecaGrandeNoTerceiro = (cabem: string, servico = "recolha_moveis") =>
  responder(
    { ...rascunhoVazio(), servico, descricao: "Um roupeiro" },
    { movelModo: "item", "itens.grande": "1", floor: "3º", hasElevator: "yes", pecasNoElevador: cabem, parkingDistance: "door" },
  );

describe("d64 — as peças grandes no elevador, no pedido da app de cliente", () => {
  it("a pergunta está na R7 dos móveis e a app responde-a", () => {
    const s = c.servicos.find((x) => x.id === "recolha_moveis")!;
    expect(s.perguntas!.some((p) => p.id === "pecasNoElevador")).toBe(true);
  });

  for (const cabem of ["nao", "sim", "nao_sei"]) {
    it(`«${cabem}»: a R12 da app e o valor que o servidor grava são o mesmo`, async () => {
      const r = pecaGrandeNoTerceiro(cabem);
      const { order, valor } = await noServidor(r);
      expect(order.pecasNoElevador).toBe(cabem);
      expect(valor).not.toBeNull();
      expect(valor).toBe(naApp(r));
    }, 60_000);
  }

  it("«não cabem» conta a escada nos dois lados (o caso que divergia)", async () => {
    const nao = await noServidor(pecaGrandeNoTerceiro("nao"));
    const sim = await noServidor(pecaGrandeNoTerceiro("sim"));
    expect(nao.valor!).toBeGreaterThan(sim.valor!);
  }, 60_000);

  it("no R/C a pergunta não aparece, e uma resposta de antes não vai no pedido", () => {
    const r = responder(pecaGrandeNoTerceiro("nao"), { floor: "rés-do-chão" });
    expect(corpoDoPedido(r, c, { emailDaSessao: null, rascunhosAntes: 0 }).order.pecasNoElevador).toBeUndefined();
  });

  it("o «Alterar o pedido»: as mesmas respostas do simulador, só quando a API a lista, e só acima do R/C com elevador", () => {
    expect(PECAS_DA_APP.map((o) => o.id)).toEqual(PECAS_NO_ELEVADOR.map((o) => o.id));
    expect(perguntaAsPecasNoElevador(["acesso", "pecasNoElevador"], { floor: "2º", hasElevator: "yes" })).toBe(true);
    expect(perguntaAsPecasNoElevador(["acesso", "pecasNoElevador"], { floor: "2º", hasElevator: "small" })).toBe(true);
    // Um servidor que ainda não a lê recusaria a alteração inteira: sem ela na lista, não se pergunta.
    expect(perguntaAsPecasNoElevador(["acesso"], { floor: "2º", hasElevator: "yes" })).toBe(false);
    expect(perguntaAsPecasNoElevador([], { floor: "2º", hasElevator: "yes" })).toBe(false);
    expect(perguntaAsPecasNoElevador(["pecasNoElevador"], { floor: "rés-do-chão" })).toBe(false);
    expect(perguntaAsPecasNoElevador(["pecasNoElevador"], { floor: "2º", hasElevator: "no" })).toBe(false);
    const limites = { primeiroDia: "2026-11-18", ultimoDia: "2027-05-16" };
    expect(corpoDaAlteracao({ acesso: { floor: "2º", hasElevator: "yes" }, pecasNoElevador: "nao" }, limites)).toEqual({
      corpo: { acesso: { floor: "2º", hasElevator: "yes" }, pecasNoElevador: "nao" },
    });
    expect(corpoDaAlteracao({ pecasNoElevador: "talvez" }, limites)).toEqual({ erro: "Diga o que quer mudar." });
    const folha = ler("app-cliente/src/componentes/AlterarOPedido.tsx");
    expect(folha).toContain(`rotulo="${TITULO_DAS_PECAS_NO_ELEVADOR}"`);
    expect(folha).toContain("perguntaAsPecasNoElevador(campos, acesso)");
  });
});

describe("d65 — a app Pro pelo modelo do trabalho e pela referência das mudanças", () => {
  const detalhe = ler("app-pro/src/app/trabalho/[id].tsx");

  it("o valor sugerido: «descontada» só no modelo de antes; no de 15-11, «fica consigo; a taxa da plataforma passa-a à CLYON», como o painel", () => {
    expect(detalhe).toContain("t.noNovoModelo === true");
    // As mesmas frases do painel, palavra por palavra (o número grande está logo por cima).
    const painel = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(painel).toContain(`"já com a taxa da plataforma descontada · o valor é sem IVA"`);
    /*
     * d4 (18-11-2026): no modelo de 15-11 o painel diz a frase única que a rota
     * serve (`fraseDoValorNoNovoModelo`, «fica consigo; a taxa da plataforma e o
     * IVA dela passam à CLYON»). A app ainda tem a de antes escrita à mão até ao
     * próximo EAS Update das Apps — a excepção temporária da orquestra.
     */
    expect(painel).toContain("pedido.fraseDoValorNoNovoModelo ??");
    expect(detalhe).toMatch(/fraseDoValorNoNovoModelo|"fica consigo; a taxa da plataforma passa-a à CLYON · o valor é sem IVA"/);
    expect(detalhe).toContain('"já com a taxa da plataforma descontada · o valor é sem IVA"');
  });

  it("os exemplos da hora são os da referência pública (40 e 55 €/h), não números à mão", () => {
    expect([PRECO_POR_HORA_DUAS_PESSOAS, PRECO_POR_HORA]).toEqual([40, 55]);
    const m = ler("app-pro/src/app/conta/mudancas.tsx");
    expect(m).toContain("placeholder={`ex.: ${PRECO_POR_HORA_DUAS_PESSOAS}`}");
    expect(m).toContain("placeholder={`ex.: ${PRECO_POR_HORA}`}");
    expect(m).not.toMatch(/placeholder="ex\.: (45|60)"/);
  });
});
