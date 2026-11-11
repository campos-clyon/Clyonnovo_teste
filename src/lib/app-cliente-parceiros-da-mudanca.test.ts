import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TarifaDasMudancas } from "./conta-da-mudanca";
import {
  MAXIMO_DE_ESCOLHIDOS,
  ORDENACAO,
  TEXTOS_DA_LISTA,
  cartaoDoParceiro,
  type CandidatoDaMudanca,
  type ContextoDaMudanca,
} from "./lista-de-parceiros-da-mudanca";
import { instanteEmLisboa } from "./hora-de-lisboa";
import { passosDaMudancaComEscolha } from "./textos-do-pedido";
import {
  alternarParceiro,
  botaoDaLista,
  camposDaEscolha,
  corpoDaLista,
  escolhaFeita,
  linhaDaEscolha,
  listaValida,
  passosDaResposta,
  pessoasDoEcra,
  semListaParaEscolher,
  soOsDaLista,
} from "../../app-cliente/src/lib/parceiros-da-mudanca";
import {
  catalogoValido,
  corpoDoPedido,
  ecraDaLinha,
  ecrasDoPedir,
  linhasDoResumo,
  rascunhoVazio,
  type Catalogo,
  type Rascunho,
} from "../../app-cliente/src/lib/novo-pedido";
import { catalogoDaApp } from "./catalogo-da-app";

/*
 * A LISTA DOS PARCEIROS DA MUDANÇA NA APP DE CLIENTE — 11-11-2026 (ordem do
 * CEO com o sim do dono). A app mostra a lista que a rota manda (sem fazer
 * contas), leva a escolha no pedido, e sem lista segue como antes.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");

const TARIFA: TarifaDasMudancas = {
  precoHora2: 50,
  precoHora3: 65,
  minimoHoras: 3,
  precoKm: 0.6,
  kmMinimo: 10,
  kmMaximo: 80,
  caixa: 2,
  cartaoMetro: null,
  filmeRolo: 10,
  plasticoBolhaRolo: 20,
  aparecerNaLista: true,
};
const AGORA = instanteEmLisboa("2026-11-11T10:00") as Date;

function candidato(mais: Partial<CandidatoDaMudanca> = {}): CandidatoDaMudanca {
  return {
    id: 7,
    nome: "Mudanças Exemplo",
    isActive: true,
    estado: "aprovado",
    categorias: ["mudancas"],
    raioKm: 50,
    emiteFatura: true,
    emiteGuiaTransporte: false,
    guiaVerificadaEm: null,
    contaDeTeste: false,
    verificado: true,
    tarifa: TARIFA,
    notaMedia: 4.84,
    avaliacoes: 5,
    ...mais,
  } as CandidatoDaMudanca;
}
const CTX: ContextoDaMudanca = { tipologia: "T2", desmontagem: false, pessoas: 2, kmPercurso: 20, formaDePagamento: "na_plataforma", cidade: "Seixal" };
const cartao = (id: string, nome = "Mudanças Exemplo") => cartaoDoParceiro({ ...candidato({ nome }), tarifa: TARIFA }, CTX, id, AGORA)!;
/** A resposta da rota como `respostaDaLista` a escreve, passada por JSON (como chega à app). */
const resposta = (parceiros: unknown[]) =>
  JSON.parse(
    JSON.stringify({
      ok: true,
      ligado: true,
      pessoas: 2,
      tipologia: "T2",
      horas: 5.5,
      kmPercurso: 20,
      resumo: "T2 · Seixal → Almada · cerca de 5,5 h com 2 pessoas",
      recomendaTres: null,
      maximoDeEscolhidos: MAXIMO_DE_ESCOLHIDOS,
      parceiros,
      semParceiros: parceiros.length === 0 ? TEXTOS_DA_LISTA.semParceiros : null,
      ordenacao: ORDENACAO,
      textos: TEXTOS_DA_LISTA,
    }),
  );

describe("a lista na app de cliente lê a rota tal como vem", () => {
  it("os cartões, os textos e a ordem da rota — a app não escreve números", () => {
    const l = listaValida(resposta([cartao("a"), cartao("b", "Outra")]))!;
    if (!l.ligado) throw new Error("ligado");
    expect(l.parceiros.map((p) => p.id)).toEqual(["a", "b"]);
    expect(l.parceiros[0].estimativa.texto).toBe(cartao("a").estimativa.texto);
    expect(l.parceiros[0].precoHora[2]?.texto).toBe(cartao("a").precoHora[2].texto);
    expect(l.parceiros[0].precoHora[2]?.texto).toMatch(/com IVA \(.*sem IVA\)/);
    // Os textos do ecrã, todos da rota (a app lê os que mostra).
    expect(TEXTOS_DA_LISTA).toMatchObject(l.textos);
    expect(l.ordenacao).toEqual({ titulo: ORDENACAO.titulo, frase: ORDENACAO.frase });
    expect(l.maximo).toBe(MAXIMO_DE_ESCOLHIDOS);
    expect(botaoDaLista(l, 2)).toBe(`${TEXTOS_DA_LISTA.botao} (2)`);
  });

  it("desligada, sem parceiros ou com erro: segue sem o ecrã; um cartão sem IVA não entra", () => {
    expect(listaValida({ ok: true, ligado: false, parceiros: [] })).toEqual({ ligado: false });
    expect(semListaParaEscolher(listaValida({ ok: true, ligado: false }))).toBe(true);
    expect(semListaParaEscolher(listaValida(resposta([])))).toBe(true);
    expect(listaValida(resposta([]))).toMatchObject({ ligado: true, semParceiros: TEXTOS_DA_LISTA.semParceiros });
    expect(listaValida({ ok: false, error: "x" })).toBeNull();
    const semIva = { ...cartao("c"), estimativa: { texto: "100 €" } };
    const l = listaValida(resposta([semIva, cartao("d")]))!;
    expect(l.ligado && l.parceiros.map((p) => p.id)).toEqual(["d"]);
  });

  it("até três; quem sai da lista sai da escolha; «procurar mais» sempre que há parceiros e ele o marca (d6)", () => {
    expect(alternarParceiro(["a", "b", "c"], "d", 3)).toEqual(["a", "b", "c"]);
    expect(alternarParceiro(["a", "b"], "b", 3)).toEqual(["a"]);
    const l = listaValida(resposta([cartao("a")]))!;
    expect(soOsDaLista(["a", "z"], l)).toEqual(["a"]);
    expect(escolhaFeita(["a"], l, 3, true)).toEqual({ ids: ["a"], assinaturas: {}, nomes: ["Mudanças Exemplo"], pessoas: 3, procurarMais: true });
    const duas = listaValida(resposta([cartao("a"), cartao("b", "Outra")]))!;
    expect(escolhaFeita(["b", "a"], duas, 2, true)).toEqual({ ids: ["a", "b"], assinaturas: {}, nomes: ["Mudanças Exemplo", "Outra"], pessoas: 2, procurarMais: true });
    expect(escolhaFeita(["b", "a"], duas, 2, false)?.procurarMais).toBe(false);
    expect(escolhaFeita([], duas, 2, false)).toBeNull();
  });
});

const c = catalogoValido({
  ...catalogoDaApp(),
  servicos: [
    { id: "recolha_moveis", nome: "Recolha de móveis", detalhes: "moveis" },
    { id: "mudanca", nome: "Mudança", detalhes: "mudanca" },
  ],
}) as Catalogo;
const mudanca = (extra: Partial<Rascunho> = {}): Rascunho => ({
  ...rascunhoVazio(),
  servico: "mudanca",
  tipologia: "T2",
  morada: { formattedAddress: "Rua A, Seixal", city: "Seixal", lat: 38.6, lng: -9.1 },
  destino: { formattedAddress: "Rua B, Almada", city: "Almada", lat: 38.67, lng: -9.15 },
  acesso: { floor: "1", hasElevator: "sim", parkingDistance: "perto", difficultAccess: true },
  acessoDestino: { floor: "rés-do-chão", parkingDistance: "perto" },
  quando: "data",
  data: "2026-11-20",
  ...extra,
});

describe("o pedido da app leva a escolha, e a lista pede-se com o mesmo corpo", () => {
  it("o ecrã dos parceiros fica entre o «quando» e o contacto, só na mudança e só com lista", () => {
    const e = ecrasDoPedir(mudanca(), c);
    expect(e.indexOf("parceiros")).toBe(e.indexOf("quando") + 1);
    expect(e.indexOf("parceiros")).toBe(e.indexOf("contacto") - 1);
    expect(ecrasDoPedir(mudanca({ semListaDeParceiros: true }), c)).not.toContain("parceiros");
    expect(ecrasDoPedir({ servico: "recolha_moveis" }, c)).not.toContain("parceiros");
  });

  it("a lista lê as moradas, a casa, a desmontagem e o dia do corpo do pedido — como a rota do pedido a refaz", () => {
    const { order } = corpoDoPedido(mudanca(), c, { emailDaSessao: null, rascunhosAntes: 0 });
    expect(corpoDaLista(order, 3)).toEqual({
      origem: { lat: 38.6, lng: -9.1, morada: "Rua A, Seixal", cidade: "Seixal" },
      destino: { lat: 38.67, lng: -9.15, morada: "Rua B, Almada", cidade: "Almada" },
      tipologia: "T2",
      desmontagem: true,
      pessoas: 3,
      data: "2026-11-20",
    });
    // A leitura da rota do pedido (pedidoDaListaDoPedido) é a mesma: o acesso difícil num dos lados.
    expect(ler("src/lib/mudanca-com-parceiros-escolhidos.ts")).toContain(
      "desmontagem: ao?.difficultAccess === true || ad?.difficultAccess === true || order.desmontagem === true,",
    );
    expect(corpoDaLista({ originAddress: { formattedAddress: "x" } }, 2)).toBeNull();
  });

  it("com a escolha, vão os ids opacos, a equipa e o «procurar mais»; sem lista, nada disso", () => {
    const parceiros = { ids: ["a", "b"], nomes: ["A", "B"], pessoas: 3 as const, procurarMais: false };
    const com = corpoDoPedido(mudanca({ parceiros }), c, { emailDaSessao: "x@y.pt", rascunhosAntes: 0 }).order;
    expect(com).toMatchObject({ parceirosEscolhidos: ["a", "b"], pessoas: 3, procurarMaisParceiros: false });
    const sem = corpoDoPedido(mudanca({ parceiros, semListaDeParceiros: true }), c, { emailDaSessao: null, rascunhosAntes: 0 }).order;
    expect(sem.parceirosEscolhidos).toBeUndefined();
    expect(camposDaEscolha(undefined)).toEqual({});
    // E o resumo diz a quem vai, com o caminho de volta ao ecrã.
    const linha = linhasDoResumo(mudanca({ parceiros }), c).find((l) => l.rotulo === "Parceiros");
    expect(linha?.texto).toBe(linhaDaEscolha(parceiros));
    expect(linha?.texto).toBe("A e B (equipa de 3)");
    expect(ecraDaLinha(linha!)).toBe("parceiros");
  });

  it("depois de enviar, a app mostra os passos que a rota do pedido manda", () => {
    expect(passosDaResposta(JSON.parse(JSON.stringify(passosDaMudancaComEscolha(2))))).toEqual(passosDaMudancaComEscolha(2));
    expect(passosDaResposta(undefined)).toBeNull();
    expect(passosDaResposta([{ texto: "sem título" }])).toBeNull();
  });

  it("o ecrã da app chama a rota da lista, sem sessão, e volta à lista quando a rota do pedido recusa a escolha", () => {
    const s = ler("app-cliente/src/componentes/NovoPedido.tsx");
    expect(s).toContain("pedir<unknown>(ROTA_DOS_PARCEIROS, { metodo: \"POST\", corpo, semSessao: true })");
    expect(s).toContain("e instanceof ErroDaApi && voltaALista(e.corpo)");
    expect(ler("app-cliente/src/lib/parceiros-da-mudanca.ts")).toContain('corpoDoErro?.campo === "parceirosEscolhidos" || corpoDoErro?.campo === "pessoas"');
    expect(s).toContain('irPara("parceiros", { parceiros: undefined, semListaDeParceiros: undefined });');
    expect(ler("app-cliente/src/lib/parceiros-da-mudanca.ts")).toContain('export const ROTA_DOS_PARCEIROS = "/api/mudancas/parceiros";');
  });
});

describe("as horas em intervalo e o T3 só com 3 pessoas, na app (11-11-2026)", () => {
  const T3: ContextoDaMudanca = { ...CTX, tipologia: "T3", pessoas: 2 };
  const cartaoT3 = cartaoDoParceiro({ ...candidato(), tarifa: TARIFA }, T3, "t3", AGORA)!;
  const respostaT3 = JSON.parse(JSON.stringify({ ...resposta([cartaoT3]), pessoas: 3, soComTres: true, tipologia: "T3" }));

  it("a app lê a equipa da rota: num T3 o ecrã mostra 3 e a escolha vai com 3", () => {
    const l = listaValida(respostaT3)!;
    if (!l.ligado) throw new Error("ligado");
    expect(l.soComTres).toBe(true);
    expect(pessoasDoEcra(l, 2)).toBe(3);
    expect(escolhaFeita(["t3"], l, 2, false)).toMatchObject({ pessoas: 3 });
    expect(l.parceiros[0].horasTexto).toBe("Entre 7 e 9 h com 3 pessoas");
  });

  it("as caixas e o embalamento: a linha vem da rota, e o pedido leva-os só se os pedir", () => {
    const l = listaValida(respostaT3)!;
    if (!l.ligado) throw new Error("ligado");
    expect(l.textos.pedirEmbalamento).toBe("Também preciso de caixas e embalamento");
    expect(l.parceiros[0].embalamento?.texto).toBe(cartaoT3.embalamento?.texto);
    expect(l.parceiros[0].estimativaComEmbalamento?.texto).toBe(cartaoT3.estimativaComEmbalamento?.texto);
    const com = escolhaFeita(["t3"], l, 3, false, true)!;
    expect(camposDaEscolha(com)).toMatchObject({ embalamento: true, pessoas: 3 });
    expect(camposDaEscolha(escolhaFeita(["t3"], l, 3, false)!)).not.toHaveProperty("embalamento");
  });

  it("o ecrã esconde as 2 pessoas num T3 ou maior e mostra a opção das caixas", () => {
    const ecra = readFileSync(join(process.cwd(), "app-cliente/src/componentes/ParceirosDaMudanca.tsx"), "utf8");
    expect(ecra).toContain('l?.soComTres ? EQUIPAS.filter((e) => e.id === "3") : EQUIPAS');
    expect(ecra).toContain("l.textos.pedirEmbalamento");
  });
});
