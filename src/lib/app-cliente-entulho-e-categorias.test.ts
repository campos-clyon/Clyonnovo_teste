import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  camposEmFalta,
  catalogoValido,
  corpoDaReferencia,
  corpoDoPedido,
  linhasDoResumo,
  pedeDesmontagem,
  rascunhoVazio,
  type Catalogo,
  type Rascunho,
} from "../../app-cliente/src/lib/novo-pedido";
import { catalogoDaApp } from "./catalogo-da-app";
import { contaDaReferencia, lerPedidoParaReferencia, linhaEscrita, referenciaDoPedido } from "./preco-de-referencia";
import { camposDoEntulhoEmSacosDeObra, emSacosDeObra, sacosDeObraDoEntulho, SACOS_POR_BIG_BAG, TIPOS_DE_SACO } from "./sacos-de-entulho";

/**
 * O ENTULHO E AS CATEGORIAS NA APP DE CLIENTE — 03-11-2026, o dono a testar:
 *
 * *«As categorias ainda não estão 100% adaptadas às suas características: o
 * simulador de entulho pergunta se é preciso desmontar! Pergunta 2 vezes se o
 * entulho está em sacos, não especifica qual saco (25 a 30 kg, de 50, 20 ou
 * big bags), pergunta número de peças. E mesmo tendo indicado 50 sacos ele não
 * calcula e continua a falar do valor genérico, 10 sacos de 40 a 50 €.»*
 *
 * E: «Quanto há para levar?» com o veículo de cada volume.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const c = catalogoValido(catalogoDaApp()) as Catalogo;
const base = (extra: Partial<Rascunho>): Rascunho => ({ ...rascunhoVazio(), descricao: "Sacos de 25 a 30kg", ...extra });
const entulho = (extra: Partial<Rascunho>) => base({ servico: "recolha_entulho", ...extra });
const campos = (r: Rascunho) => camposEmFalta(r, 1, c).map((x) => x.campo);
/** O que a R12 responde ao corpo que a app manda — a volta inteira. */
const r12 = (r: Rascunho) => referenciaDoPedido(lerPedidoParaReferencia(JSON.parse(JSON.stringify(corpoDaReferencia(r, c))))!);

describe("o entulho não pergunta a desmontagem", () => {
  it("nem no ecrã, nem no resumo, nem no pedido — mesmo com um «Sim» que ficou de outro serviço", () => {
    const r = entulho({ entulho: "ensacado", tipoDeSaco: "obra", sacos: "50", desmontagem: true });
    expect(pedeDesmontagem(r, c)).toBe(false);
    expect(linhasDoResumo(r, c).map((l) => l.rotulo)).not.toContain("Desmontagem");
    expect(corpoDoPedido(r, c, { emailDaSessao: "a@b.pt", rascunhosAntes: 0 }).order.needsDismantling).toBeUndefined();
    expect(corpoDaReferencia(r, c)?.desmontagem).toBeUndefined();
    // Onde há móveis, continua.
    for (const servico of ["recolha_moveis", "recolha_monos", "esvaziamento_apartamento", "mudanca"]) expect(pedeDesmontagem({ servico }, c), servico).toBe(true);
    // A garagem, o sótão e a cave continuam sem ela (d5).
    expect(pedeDesmontagem({ servico: "esvaziamento_garagem" }, c)).toBe(false);
    expect(ler("app-cliente/src/componentes/NovoPedido.tsx")).toContain("{pedeDesmontagem(r, c) ? (");
  });

  it("mudar de serviço apaga as respostas do anterior (os sacos, o tipo de saco, a desmontagem)", () => {
    const np = ler("app-cliente/src/componentes/NovoPedido.tsx");
    const bloco = np.slice(np.indexOf("const PERGUNTAS_DO_SERVICO_EM_BRANCO"), np.indexOf("};", np.indexOf("const PERGUNTAS_DO_SERVICO_EM_BRANCO")));
    for (const campo of ["entulho:", "tipoDeSaco:", "entulhoModo:", 'sacos: ""', "entulhoVolume:", "tipologia:", "desmontagem:"]) expect(bloco, campo).toContain(campo);
    expect(np.match(/\.\.\.PERGUNTAS_DO_SERVICO_EM_BRANCO/g)).toHaveLength(2);
  });
});

describe("já em sacos: que sacos são e quantos — sem «Quanto é?» outra vez", () => {
  it("o catálogo tem os sacos de obra, os de 20 e de 50 kg e os big bags (como medida), sem números", () => {
    expect(c.tiposDeSaco.map((t) => t.nome)).toEqual(["Sacos de obra (25 a 30 kg)", "Sacos de 20 kg", "Sacos de 50 kg", "Big bags", "Não sei"]);
    expect(c.tiposDeSaco.find((t) => t.id === "bigbag")).toMatchObject({ unidade: "big bags" });
    expect(c.tiposDeSaco.find((t) => t.id === "bigbag")?.aviso).toContain(`cada big bag conta como ${SACOS_POR_BIG_BAG} sacos de obra`);
    // O estado do entulho continua sem o big bag (não é um estado: é uma medida).
    expect(c.entulho.map((o) => o.id)).toEqual(["ensacado", "chao", "misto", "unknown"]);
  });

  it("em sacos pergunta o tipo e a quantidade; no chão, como se conta", () => {
    expect(campos(entulho({ entulho: "ensacado" }))).toEqual(["tipoDeSaco", "sacos"]);
    expect(campos(entulho({ entulho: "ensacado" }))).not.toContain("entulhoModo");
    expect(campos(entulho({ entulho: "ensacado", tipoDeSaco: "obra", sacos: "50" }))).toEqual([]);
    expect(camposEmFalta(entulho({ entulho: "ensacado", tipoDeSaco: "bigbag" }), 1, c)[0].texto).toBe("Diga quantos big bags são.");
    expect(campos(entulho({ entulho: "chao" }))).toEqual(["entulhoModo"]);
    expect(campos(entulho({ entulho: "chao", entulhoModo: "sacos", sacos: "30" }))).toEqual([]);
    expect(campos(entulho({ entulho: "chao", entulhoModo: "volume" }))).toEqual(["entulhoVolume"]);
    const np = ler("app-cliente/src/componentes/NovoPedido.tsx");
    expect(np).toContain('<Escolhas recolher campo="tipoDeSaco" rotulo="Que sacos são?"');
    expect(np).toContain("{r.entulho && !eEntulhoEmSacos(r.entulho) ? (");
    expect(np).toContain("`Quantos ${unidade}?`");
  });

  it("o resumo e o pedido dizem o tipo de saco", () => {
    const r = entulho({ entulho: "ensacado", tipoDeSaco: "bigbag", sacos: "3" });
    expect(linhasDoResumo(r, c)[0].texto).toBe("Recolha de entulho · Entulho: Já está em sacos. Tipo de saco: Big bags. Quantidade: 3 big bags.");
    expect(corpoDoPedido(r, c, { emailDaSessao: "a@b.pt", rascunhosAntes: 0 }).order).toMatchObject({
      entulhoState: "ensacado",
      entulhoTipoDeSaco: "bigbag",
      entulhoQuantidade: "3",
    });
  });
});

describe("a conta em sacos de obra (a grelha), pelo peso", () => {
  it("20 kg são 0,8 de um saco de obra, 50 kg são 2, um big bag 38 — arredondado para cima", () => {
    expect(emSacosDeObra(50, "obra")).toBe(50);
    expect(emSacosDeObra(50, "pequeno")).toBe(40);
    expect(emSacosDeObra(51, "pequeno")).toBe(41);
    expect(emSacosDeObra(5, "grande")).toBe(10);
    expect(emSacosDeObra(3, "bigbag")).toBe(114);
    expect(emSacosDeObra(50, "nao_sei")).toBe(50);
    expect(emSacosDeObra(50, "desconhecido")).toBe(50);
    expect(TIPOS_DE_SACO.find((t) => t.id === "bigbag")?.sacosDeObra).toBe(SACOS_POR_BIG_BAG);
  });

  it("no misto, os já cheios contam pelo tipo e os por ensacar são de obra; o volume é o do simulador", () => {
    expect(sacosDeObraDoEntulho({ estado: "misto", tipoDeSaco: "bigbag", ensacados: 2, porEnsacar: 10 })).toBe(86);
    expect(sacosDeObraDoEntulho({ estado: "chao", modo: "volume", volume: "carrinha" })).toBe(40);
    expect(sacosDeObraDoEntulho({ estado: "chao", modo: "incerto" })).toBeNull();
    expect(ler("src/app/simulador/SimulatorThreePhaseForm.tsx")).toContain("const map: Record<string, number> = SACOS_POR_VOLUME_DO_ENTULHO;");
  });

  it("o servidor passa o pedido da app a sacos de obra, e guarda o que ela disse", () => {
    expect(camposDoEntulhoEmSacosDeObra({ serviceType: "recolha_entulho", entulhoState: "ensacado", entulhoTipoDeSaco: "bigbag", entulhoQuantidade: "3" })).toEqual({
      entulhoQuantidade: "114",
      entulhoQuantidadeNoTipo: "3",
      entulhoQuantidadeBigBags: "3",
    });
    expect(camposDoEntulhoEmSacosDeObra({ serviceType: "recolha_entulho", entulhoState: "ensacado", entulhoTipoDeSaco: "obra", entulhoQuantidade: "50" })).toEqual({});
    expect(camposDoEntulhoEmSacosDeObra({ serviceType: "recolha_entulho", entulhoState: "chao", entulhoVolume: "camiao_caixa" })).toEqual({ entulhoQuantidade: "120" });
    // O simulador do site já manda sacos de obra, sem tipo: fica como está.
    expect(camposDoEntulhoEmSacosDeObra({ serviceType: "recolha_entulho", entulhoState: "ensacado", entulhoQuantidade: "76", entulhoVolume: "carrinha" })).toEqual({});
    expect(camposDoEntulhoEmSacosDeObra({ serviceType: "recolha_monos", entulhoTipoDeSaco: "bigbag", entulhoQuantidade: "3" })).toEqual({});
    const rota = ler("src/app/api/simulador/pedido/route.ts");
    expect(rota).toContain("Object.assign(order, camposDoEntulhoEmSacosDeObra(order));");
    // E o motor recebe os sacos: sem eles, «quantidade de sacos de entulho» ficava em falta.
    expect(rota).toContain("entulhoQuantidade: (order as { entulhoQuantidade?: string }).entulhoQuantidade,");
    expect(rota.indexOf("camposDoEntulhoEmSacosDeObra(order)")).toBeLessThan(rota.indexOf("calculateFastEstimate({"));
  });
});

describe("o preço de referência faz a conta com a quantidade", () => {
  it("50 sacos: a linha da grelha para 50 sacos, e não a genérica dos 10 sacos", () => {
    const r = r12(entulho({ entulho: "ensacado", tipoDeSaco: "obra", sacos: "50" }));
    expect(r.linhas.map(linhaEscrita)).toEqual(["Para 50 sacos de obra (≈ 1,25 m³): desde 180 € + IVA (221,40 € com IVA)"]);
    expect(r.conta).toEqual({ servico: "desde 180 €", iva: "desde 41,40 €", ivaRotulo: "IVA (23 %)", total: "desde 221,40 €" });
    expect(JSON.stringify(r)).not.toContain("10 sacos");
  });

  it("os outros sacos, os big bags, o misto e o volume", () => {
    const linha = (extra: Partial<Rascunho>) => r12(entulho(extra)).linhas.map(linhaEscrita);
    expect(linha({ entulho: "ensacado", tipoDeSaco: "bigbag", sacos: "3" })).toEqual(["Para 3 big bags (≈ 114 sacos de obra, 2,85 m³): desde 411 € + IVA (505,53 € com IVA)"]);
    expect(linha({ entulho: "ensacado", tipoDeSaco: "pequeno", sacos: "50" })).toEqual(["Para 50 sacos de 20 kg (≈ 40 sacos de obra, 1 m³): desde 120 € + IVA (147,60 € com IVA)"]);
    expect(linha({ entulho: "ensacado", tipoDeSaco: "obra", sacos: "8" })).toEqual(["Para 8 sacos de obra: 40 – 50 € + IVA (49,20 – 61,50 € com IVA)"]);
    expect(linha({ entulho: "misto", tipoDeSaco: "obra", ensacados: "4", porEnsacar: "6" })).toEqual([
      "Para 4 sacos de obra e 6 por ensacar (≈ 10 sacos de obra): 40 – 50 € + IVA (49,20 – 61,50 € com IVA)",
    ]);
    expect(linha({ entulho: "chao", entulhoModo: "volume", entulhoVolume: "camiao_caixa" })).toEqual(["Para o volume que escolheu (≈ 3 m³): desde 432 € + IVA (531,36 € com IVA)"]);
    // Acima de 5 m³, a proposta sai das fotografias — e a linha continua com o valor com IVA (a app deita fora as que não o têm).
    expect(linha({ entulho: "chao", entulhoModo: "volume", entulhoVolume: "camiao_lixo" })[0]).toMatch(/mais de 5 m³, a proposta sai das fotografias: desde 144 €\/m³ \+ IVA \(177,12 €\/m³ com IVA\)$/);
  });

  it("sem quantidade (ou «não tenho a certeza»), fica a genérica, como antes", () => {
    expect(r12(entulho({ entulho: "chao", entulhoModo: "incerto" })).linhas[0].rotulo).toBe("Preço de referência");
    expect(contaDaReferencia({ servico: "recolha_entulho" })).toBeNull();
  });
});

describe("o esvaziamento de casa e de apartamento pergunta a casa, e não o número de peças", () => {
  it("as casas da grelha do site; o apartamento sem a moradia", () => {
    const casas = (id: string) => c.servicos.find((s) => s.id === id)?.tipologias?.map((t) => t.nome);
    expect(casas("esvaziamento_apartamento")).toEqual(["T0 ou T1", "T2", "T3 ou T4"]);
    expect(casas("esvaziamento_casa")).toEqual(["T0 ou T1", "T2", "T3 ou T4", "Moradia completa"]);
    expect(casas("recolha_monos")).toBeUndefined();
    expect(casas("esvaziamento_garagem")).toBeUndefined();
  });

  it("pede a casa, mostra a linha dela no preço, e o «número de peças» só nos monos e nos móveis", () => {
    const r = base({ servico: "esvaziamento_apartamento", volume: "camiao_caixa" });
    expect(campos(r)).toEqual(["tipologia"]);
    const t2 = { ...r, tipologia: "T2", quantidadeExacta: "12" };
    expect(campos(t2)).toEqual([]);
    expect(r12(t2).linhas.map(linhaEscrita)).toEqual(["Para um T2: 320 – 420 € + IVA (393,60 – 516,60 € com IVA)"]);
    const { order } = corpoDoPedido(t2, c, { emailDaSessao: "a@b.pt", rascunhosAntes: 0 });
    expect(order).toMatchObject({ volumeTier: "camiao_caixa", tipologiaDoEsvaziamento: "T2" });
    // Nem a `tipologia` da mudança (o motor lê-a como horas), nem o número de peças.
    expect(order.tipologia).toBeUndefined();
    expect(order.quantityExact).toBeUndefined();
    expect(linhasDoResumo(t2, c)[0].texto).toBe("Esvaziamento de apartamento · Casa: T2. Quantidade estimada: Enche a caixa de um camião.");
    const np = ler("app-cliente/src/componentes/NovoPedido.tsx");
    expect(np).toContain('<Escolhas recolher campo="tipologia" rotulo="O tamanho da casa" opcoes={casas}');
    expect(np).toMatch(/\{d !== "esvaziamento" \? \(\s*<Campo rotulo="Número de peças \(opcional\)"/);
  });
});

describe("«Quanto há para levar?» com o veículo de cada volume", () => {
  it("cada volume tem a sua ilustração (da casa, a 1x, 2x e 3x), e «Não tenho a certeza» o ponto de interrogação", () => {
    const v = ler("app-cliente/src/componentes/Veiculos.tsx");
    for (const id of ["carrinha", "camiao_caixa", "camiao_lixo"]) {
      expect(v).toContain(`${id}: require("../../assets/veiculos/${id}.png"),`);
      for (const f of [`${id}.png`, `${id}@2x.png`, `${id}@3x.png`, `${id}.svg`]) {
        const caminho = join(process.cwd(), "app-cliente/assets/veiculos", f);
        expect(existsSync(caminho), f).toBe(true);
        // Pequenas: nada que pese na app nem nas actualizações.
        expect(statSync(caminho).size, f).toBeLessThan(20_000);
      }
    }
    expect(v).toContain("<Interrogacao diametro={50} />");
  });

  it("nas três perguntas de volume, em cartões de duas colunas, e a escolha feita com o veículo", () => {
    const np = ler("app-cliente/src/componentes/NovoPedido.tsx");
    expect(np.match(/ilustracao=\{comVeiculo\}/g)).toHaveLength(3);
    const ui = ler("app-cliente/src/componentes/ui.tsx");
    expect(ui).toContain("ilustracao(o.id, { escolhida, pequena: false })");
    expect(ui).toContain("icone={ilustracao ? ilustracao(escolhidaAgora.id, { escolhida: true, pequena: true }) ?? undefined : undefined}");
    expect(ui).toContain("flexBasis: opcoes.length === 3 ? 90 : 140,");
  });
});
