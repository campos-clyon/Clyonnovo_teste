import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  camposEmFalta,
  camposEmFaltaNoEcra,
  catalogoValido,
  comResposta,
  corpoDaReferencia,
  corpoDoPedido,
  linhasDoResumo,
  perguntasDe,
  rascunhoVazio,
  referenciaValida,
  semAsRespostasDoServico,
  type Catalogo,
  type Rascunho,
} from "../../app-cliente/src/lib/novo-pedido";
import { perguntasValidas } from "../../app-cliente/src/lib/perguntas-do-pedido";
import {
  corpoDoLeitor,
  recusarSugestao,
  sugestoesDoEcra,
  sugestoesValidas,
  tituloDasSugestoes,
} from "../../app-cliente/src/lib/sugestoes-do-pedido";
import { catalogoDaApp } from "./catalogo-da-app";
import { lerPedidoParaReferencia, referenciaDoPedido } from "./preco-de-referencia";
import { comAsLinhasDaCategoria, camposDaCategoriaParaGravar, PREFIXO_DO_ENTULHO } from "./pedido-por-categoria";
import { SERVICOS_COM_DESMONTAGEM } from "./simulador-por-categoria";

/**
 * A APP DE CLIENTE DESENHADA PELAS PERGUNTAS DA R7 — 03-11-2026 (decisão d1).
 * O ecrã «oque» e o «acesso» saem das `perguntas` de cada serviço; a
 * referência (R12) lê as respostas pelos mesmos ids e diz porquê; o pedido
 * leva os ids novos sem repetir linhas na descrição; as sugestões do leitor
 * só entram com «Usar isto».
 */

const viaJson = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const c = catalogoValido(viaJson(catalogoDaApp())) as Catalogo;
const base = (extra: Partial<Rascunho>): Rascunho => ({ ...rascunhoVazio(), descricao: "Entulho da obra da cozinha", ...extra });
const responder = (r: Rascunho, respostas: Record<string, string | string[]>): Rascunho =>
  Object.entries(respostas).reduce<Rascunho>((a, [id, v]) => ({ ...a, ...comResposta(a, id, v) }), r);
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
/** O que a R12 devolve para o corpo que a app manda (ida e volta em JSON). */
const r12 = (r: Rascunho) => {
  const p = lerPedidoParaReferencia(viaJson(corpoDaReferencia(r, c)));
  return referenciaDoPedido(p!);
};

describe("as perguntas da R7 na app", () => {
  it("todos os serviços do catálogo trazem as perguntas, e a desmontagem só onde a R7 a põe", () => {
    for (const s of c.servicos) {
      expect(s.perguntas, s.id).not.toBeNull();
      const temDesmontagem = s.perguntas!.some((p) => p.id === "desmontagem");
      expect(temDesmontagem, s.id).toBe(SERVICOS_COM_DESMONTAGEM.includes(s.id));
    }
  });

  it("o filtro de sempre vale para tudo, menos a opção «bigbag» de «Que sacos são?»", () => {
    const entulho = perguntasDe({ servico: "recolha_entulho" }, c)!;
    expect(entulho.find((p) => p.id === "tipoDeSaco")!.opcoes.map((o) => o.id)).toEqual(["pequeno", "bigbag"]);
    const falsas = perguntasValidas([
      { id: "outra", titulo: "Que medida?", tipo: "escolha", obrigatoria: true, ecra: "oque", opcoes: [{ id: "bigbag", nome: "Big bag" }, { id: "x", nome: "Um contentor" }, { id: "y", nome: "Uma carrinha" }] },
      { id: "tipoDeSaco", titulo: "Que sacos são?", tipo: "escolha", obrigatoria: true, ecra: "oque", opcoes: [{ id: "bigbag", nome: "Big bags" }, { id: "hoje", nome: "Recolha hoje" }] },
    ])!;
    expect(falsas[0].opcoes.map((o) => o.id)).toEqual(["y"]);
    expect(falsas[1].opcoes.map((o) => o.id)).toEqual(["bigbag"]);
    expect(perguntasValidas([])).toBeNull();
    expect(perguntasValidas("lixo")).toBeNull();
  });

  it("o entulho em 3 perguntas: como está → que sacos → quantos", () => {
    const r = base({ servico: "recolha_entulho" });
    expect(camposEmFaltaNoEcra(r, "oque", c).map((x) => x.campo)).toEqual(["entulho"]);
    const ens = responder(r, { entulho: "ensacado" });
    expect(camposEmFaltaNoEcra(ens, "oque", c).map((x) => x.campo)).toEqual(["tipoDeSaco"]);
    const bb = responder(ens, { tipoDeSaco: "bigbag" });
    expect(camposEmFaltaNoEcra(bb, "oque", c).map((x) => x.campo)).toEqual(["quantidade"]);
    expect(camposEmFaltaNoEcra(responder(bb, { quantidade: "2" }), "oque", c)).toEqual([]);
    // Parte e parte: pelo menos um saco ao todo.
    const misto = responder(r, { entulho: "misto", ensacados: "0", porEnsacar: "0" });
    expect(camposEmFaltaNoEcra(misto, "oque", c).map((x) => x.campo)).toEqual(["ensacados"]);
    // A granel: quanto ocupa, pela grelha.
    expect(camposEmFaltaNoEcra(responder(r, { entulho: "chao" }), "oque", c).map((x) => x.campo)).toEqual(["entulhoVolume"]);
    expect(camposEmFaltaNoEcra(responder(r, { entulho: "chao", entulhoVolume: "ate3" }), "oque", c)).toEqual([]);
  });

  it("o acesso pelas perguntas: o elevador só acima do rés-do-chão", () => {
    const r = base({ servico: "recolha_entulho", morada: { formattedAddress: "Rua Inventada 1, Almada" } });
    expect(camposEmFaltaNoEcra(r, "acesso", c).map((x) => x.campo)).toEqual(["floor", "parkingDistance"]);
    expect(camposEmFaltaNoEcra(responder(r, { floor: "3º" }), "acesso", c).map((x) => x.campo)).toEqual(["hasElevator", "parkingDistance"]);
    expect(camposEmFaltaNoEcra(responder(r, { floor: "rés-do-chão", parkingDistance: "door" }), "acesso", c)).toEqual([]);
  });
});

describe("a referência que se adapta (R12) e o pedido", () => {
  const entulho = responder(base({ servico: "recolha_entulho", morada: { formattedAddress: "Rua Inventada 1, Almada", city: "Almada" } }), {
    entulho: "ensacado",
    tipoDeSaco: "pequeno",
    quantidade: "40",
    floor: "3º",
    hasElevator: "no",
    parkingDistance: "door",
  });

  it("a R12 lê as respostas pelos ids e devolve o porquê; a app guarda-o", () => {
    const corpo = corpoDaReferencia(entulho, c)!;
    expect(corpo).toMatchObject({ servico: "recolha_entulho", entulho: "ensacado", tipoDeSaco: "pequeno", quantidade: 40, floor: "3º", hasElevator: "no", localidade: "Almada" });
    const ref = r12(entulho);
    const naApp = referenciaValida(viaJson(ref))!;
    expect(naApp.linhas.length).toBeGreaterThan(0);
    // d4 (03-11-2026): 40 sacos × 4,00–4,80 € = 160–192 € e o 3.º andar sem elevador, +45 €:
    // 205 – 237 € + IVA (252,15 – 291,51 € com IVA).
    expect(naApp.linhas.map((l) => l.texto).join(" ")).toContain("252,15 – 291,51 € com IVA");
    /*
     * O porquê do entulho traz agora a conta, com «+ IVA» em cada número («40 sacos ×
     * 4,00–4,80 € = 160–192 € + IVA», «3.º andar sem elevador: +45 € + IVA»). A app
     * de hoje deita fora as linhas com «€» (novo-pedido.ts) e a Engenharia — Apps vai
     * passar a mostrá-las: aceitam-se as duas formas. O que a app guarda vem da R12, e
     * uma linha com «€» acaba sempre em «+ IVA» (ou leva o com IVA entre parênteses).
     */
    expect(ref.porque).toEqual(["40 sacos × 4,00–4,80 € = 160–192 € + IVA", "3.º andar sem elevador: +45 € + IVA"]);
    for (const p of naApp.porque ?? []) {
      expect(ref.porque).toContain(p);
      if (/€/.test(p)) expect(p).toMatch(/€ \+ IVA(\.|$| \([^)]*com IVA\))/);
    }
  });

  it("uma pergunta escondida não vai à R12 nem ao pedido", () => {
    const r = responder(entulho, { entulho: "chao" });
    const corpo = corpoDaReferencia(r, c)!;
    expect(corpo.tipoDeSaco).toBeUndefined();
    expect(corpo.quantidade).toBeUndefined();
    expect(corpoDoPedido(r, c, { emailDaSessao: "a@b.pt", rascunhosAntes: 0 }).order.quantidade).toBeUndefined();
  });

  it("o pedido leva os ids novos, sem repetir as linhas na descrição (o site escreve-as uma vez)", () => {
    const { order } = corpoDoPedido({ ...entulho, desmontagem: true }, c, { emailDaSessao: "a@b.pt", rascunhosAntes: 0 });
    expect(order).toMatchObject({ entulho: "ensacado", entulhoState: "ensacado", tipoDeSaco: "pequeno", quantidade: 40, floor: "3º", hasElevator: "no" });
    expect(order.needsDismantling).toBeUndefined();
    expect(String(order.description)).not.toMatch(/^Entulho:|^Sacos:/m);
    const gravado = { ...order, ...camposDaCategoriaParaGravar(order) };
    const descricao = comAsLinhasDaCategoria(order.description, gravado);
    expect(descricao.split("\n").filter((l) => l.startsWith(PREFIXO_DO_ENTULHO))).toHaveLength(1);
    expect(gravado.entulhoQuantidade).toBe("40");
  });

  it("a manutenção: o trabalho, quanto e os materiais; a repetição no campo de sempre", () => {
    const r = responder(base({ servico: "manutencao_casa" }), { tipoDeTrabalho: "pintura", quantoTrabalho: "uma_divisao", materiais: "parceiro", repeticao: "quinzenal" });
    expect(camposEmFaltaNoEcra(r, "oque", c)).toEqual([]);
    const { order } = corpoDoPedido(r, c, { emailDaSessao: null, rascunhosAntes: 0 });
    expect(order).toMatchObject({ tipoDeTrabalho: "pintura", quantoTrabalho: "uma_divisao", materiais: "parceiro", repeticao: "quinzenal", recurrenceFrequency: "quinzenal" });
    expect(order.needsDismantling).toBeUndefined();
    const servico = linhasDoResumo(r, c).find((l) => l.rotulo === "Serviço")!;
    expect(servico.texto).toContain("Pintura");
  });

  it("a mudança: o acesso de cada lado nas perguntas «origem.» e «destino.»", () => {
    const r = responder(base({ servico: "mudanca" }), {
      tipologia: "T2",
      "origem.floor": "2º",
      "origem.hasElevator": "no",
      "destino.floor": "rés-do-chão",
      "destino.difficultAccess": "sim",
      "destino.accessNotes": "Rua só a pé",
    });
    expect(r.acesso).toMatchObject({ floor: "2º", hasElevator: "no" });
    expect(r.acessoDestino).toMatchObject({ floor: "rés-do-chão", difficultAccess: true, accessNotes: "Rua só a pé" });
    const corpo = corpoDaReferencia(r, c)!;
    expect(corpo).toMatchObject({ tipologia: "T2", origem: { floor: "2º", hasElevator: "no" }, destino: { floor: "rés-do-chão" } });
  });

  it("trocar de serviço deixa as respostas de antes", () => {
    const r = { ...entulho, ...semAsRespostasDoServico(), servico: "recolha_monos" };
    expect(r.respostas).toBeUndefined();
    expect(r.entulho).toBeUndefined();
    expect(r.acesso.floor).toBe("3º");
  });
});

describe("«Percebemos na sua descrição: …» — nunca preencher em silêncio", () => {
  const r = base({ servico: "recolha_entulho", descricao: "Tenho dois big bags cheios no 3.º andar, sem elevador" });
  const doLeitor = {
    ok: true,
    sugestoes: [
      { campo: "entulho", valor: "ensacado", confianca: 0.9, porque: "Diz que já estão cheios.", origem: "descricao" },
      { campo: "tipoDeSaco", valor: "bigbag", confianca: 0.9, porque: "Fala de dois big bags.", origem: "descricao" },
      { campo: "quantidade", valor: 2, confianca: 0.8, porque: "São dois.", origem: "descricao" },
      { campo: "floor", valor: "3º", confianca: 0.9, porque: "No 3.º andar.", origem: "descricao" },
      { campo: "hasElevator", valor: "no", confianca: 0.9, porque: "Alugamos um contentor.", origem: "descricao" },
      { campo: "desmontagem", valor: true, confianca: 0.9, porque: "x", origem: "descricao" },
      { campo: "entulhoVolume", valor: "ate99", confianca: 0.9, porque: "x", origem: "descricao" },
      { campo: "inventado", valor: "x", confianca: 1, porque: "x", origem: "descricao" },
    ],
  };

  it("o corpo do leitor: o serviço, a descrição, as respostas e só as fotografias enviadas", () => {
    const comFotos = { ...r, fotos: [{ uri: "a", estado: "enviada" as const, url: "https://x/a.jpg", tipo: "image/jpeg" }, { uri: "b", estado: "falhou" as const }] };
    expect(corpoDoLeitor(comFotos, c)).toMatchObject({ servico: "recolha_entulho", fotografias: ["https://x/a.jpg"] });
    expect(corpoDoLeitor({ ...r, descricao: "olá" }, c)).toBeNull();
  });

  it("só as sugestões que respondem a uma pergunta da categoria, com uma opção que ela aceita", () => {
    const antes = JSON.stringify(r);
    const l = sugestoesValidas(doLeitor, r, c);
    expect(JSON.stringify(r)).toBe(antes);
    expect(l.map((s) => s.chave)).toEqual(["entulho=ensacado", "tipoDeSaco=bigbag", "quantidade=2", "floor=3º", "hasElevator=no"]);
    expect(l.find((s) => s.pergunta === "hasElevator")!.porque).toBeNull();
    expect(l.find((s) => s.pergunta === "tipoDeSaco")!.porque).toBe("Fala de dois big bags.");
    expect(tituloDasSugestoes(l)).toBe("Percebemos na sua descrição:");
    // Cada ecrã mostra as suas.
    expect(sugestoesDoEcra(l, r, c, "oque").map((s) => s.pergunta)).toEqual(["entulho", "tipoDeSaco", "quantidade"]);
    expect(sugestoesDoEcra(l, r, c, "acesso").map((s) => s.pergunta)).toEqual(["floor", "hasElevator"]);
  });

  it("«Usar isto» responde; «Não» anota e não volta; o que já respondeu não se sugere", () => {
    const l = sugestoesValidas(doLeitor, r, c);
    const usada = { ...r, ...comResposta(r, "entulho", "ensacado") };
    expect(sugestoesValidas(doLeitor, usada, c).some((s) => s.pergunta === "entulho")).toBe(false);
    const recusada = { ...r, ...recusarSugestao(r, l.find((s) => s.pergunta === "tipoDeSaco")!) };
    expect(sugestoesValidas(doLeitor, recusada, c).some((s) => s.pergunta === "tipoDeSaco")).toBe(false);
  });

  it("o ecrã só usa a sugestão quando ele toca em «Usar isto»", () => {
    const ecra = ler("app-cliente/src/componentes/NovoPedido.tsx");
    expect(ecra).toContain('titulo="Usar isto"');
    expect(ecra).toContain('titulo="Não"');
    const efeito = ecra.slice(ecra.indexOf("O leitor do pedido (d1)"), ecra.indexOf("O percurso da mudança"));
    expect(efeito).toContain("setSugestoes(sugestoesValidas(");
    expect(efeito).not.toContain("comResposta");
    expect(ecra).toContain("<FaixaDaReferencia referencia={referencia} />");
    expect(ecra).toContain("<PorqueDaReferencia porque={referencia.porque} />");
  });
});

describe("os campos de antes continuam", () => {
  it("o que falta no passo 1 com as perguntas: a descrição continua a contar", () => {
    const r = responder(base({ servico: "recolha_entulho", descricao: "curta" }), { entulho: "chao", entulhoVolume: "ate1" });
    expect(camposEmFalta(r, 1, c).map((x) => x.campo)).toEqual(["descricao"]);
  });
});
