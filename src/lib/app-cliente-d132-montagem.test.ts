import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  camposEmFaltaNoEcra,
  catalogoValido,
  comResposta,
  corpoDaReferencia,
  corpoDoPedido,
  linhasDoResumo,
  perguntasDe,
  perguntasVisiveis,
  rascunhoVazio,
  referenciaValida,
  type Catalogo,
  type Rascunho,
} from "../../app-cliente/src/lib/novo-pedido";
import { ID_DA_PERGUNTA, nomeDaPeca, perguntasValidas, rotuloDoGrupoDePecas, tituloDoGrupoDePecas } from "../../app-cliente/src/lib/perguntas-do-pedido";
import { SERVICOS_DA_INSCRICAO } from "../../app-pro/src/lib/conta";
import { catalogoDaApp } from "./catalogo-da-app";
import { corpoDoSimuladorDoSite, lerPedidoParaReferencia, referenciaDoPedido } from "./preco-de-referencia";
import { camposDaCategoriaParaGravar, comAsLinhasDaCategoria } from "./pedido-por-categoria";
import { perguntasDoServico } from "./simulador-por-categoria";
import { CATEGORIAS_DOS_PROFISSIONAIS } from "./service-categories";
import { IDS_DAS_PECAS_DA_MONTAGEM } from "./tabela-da-montagem";

/**
 * A MONTAGEM E DESMONTAGEM DE MÓVEIS NAS APPS — d132, 26-11-2026 (o CEO e o
 * dono: «montagem e desmontagem de móveis em todo o lado»).
 *
 * App de cliente: o serviço vem da R7 com as perguntas do simulador; nenhuma
 * se perde (os ids das peças têm «_» e algarismos); o pedido leva os campos
 * do simulador do site (`operacaoDaMontagem`, `pecasDaMontagem`, …) e o site
 * escreve as linhas da montagem; a estimativa (R12) é a mesma do site para as
 * mesmas respostas; nas recolhas e na mudança, o extra de desmontar.
 * App Pro: o grupo «Montagem de móveis» no registo e nos Serviços.
 */

const viaJson = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const c = catalogoValido(viaJson(catalogoDaApp())) as Catalogo;
const base = (extra: Partial<Rascunho>): Rascunho => ({ ...rascunhoVazio(), descricao: "Montar os móveis do quarto novo", ...extra });
const responder = (r: Rascunho, respostas: Record<string, string | string[]>): Rascunho =>
  Object.entries(respostas).reduce<Rascunho>((a, [id, v]) => ({ ...a, ...comResposta(a, id, v) }), r);
/** O que a R12 devolve para o corpo que a app manda (ida e volta em JSON). */
const r12 = (r: Rascunho) => referenciaDoPedido(lerPedidoParaReferencia(viaJson(corpoDaReferencia(r, c)))!);
/** O que a R12 devolve para o corpo do simulador do site. */
const r12DoSite = (f: Parameters<typeof corpoDoSimuladorDoSite>[0]) => referenciaDoPedido(lerPedidoParaReferencia(viaJson(corpoDoSimuladorDoSite(f)))!);
/** O que o servidor grava: os campos da categoria e a descrição com as linhas por cima. */
const gravado = (order: Record<string, unknown>) => {
  const o = viaJson(order);
  Object.assign(o, camposDaCategoriaParaGravar(o));
  o.description = comAsLinhasDaCategoria(o.description, o) || o.description;
  return o;
};
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");

const montagem = responder(base({ servico: "montagem_moveis", morada: { formattedAddress: "Rua Inventada 1, Almada", city: "Almada" } }), {
  operacaoDaMontagem: "montar",
  "pecasDaMontagem.pequena": "2",
  "pecasDaMontagem.roupeiro_3": "1",
  "pecasDaMontagem.media": "0",
  fixarAParede: "1",
  retirarEmbalagens: "sim",
  cozinhaNaMontagem: "nao",
  floor: "3º",
  hasElevator: "no",
  parkingDistance: "door",
});

describe("a app de cliente: o serviço «Montagem e desmontagem de móveis»", () => {
  it("vem da R7 com todas as perguntas do simulador — nenhuma se perde pelos ids com «_» e algarismos", () => {
    const s = c.servicos.find((x) => x.id === "montagem_moveis");
    expect(s).toBeTruthy();
    expect(s!.perguntas!.map((p) => p.id)).toEqual(perguntasDoServico("montagem_moveis").map((p) => p.id));
    for (const id of IDS_DAS_PECAS_DA_MONTAGEM) expect(s!.perguntas!.map((p) => p.id)).toContain(`pecasDaMontagem.${id}`);
    // O preço da peça vem escrito na ajuda (a R7), com o IVA ao lado.
    expect(s!.perguntas!.find((p) => p.id === "pecasDaMontagem.roupeiro_3")!.ajuda).toMatch(/com IVA/);
    // A porta dos ids: letras, algarismos, «_» e «.»; nada de espaços, barras ou começar por algarismo.
    expect(ID_DA_PERGUNTA.test("pecasDaMontagem.roupeiro_3")).toBe(true);
    for (const mau of ["3abc", "a b", "a/b", "a-b", "", "x".repeat(41)]) expect(ID_DA_PERGUNTA.test(mau), mau).toBe(false);
    expect(perguntasValidas([{ id: "a b", titulo: "X", tipo: "numero", ecra: "oque" }])).toBeNull();
  });

  it("os contadores das peças: o título do site, o nome sem o rótulo do extra", () => {
    const perguntas = perguntasDe({ servico: "montagem_moveis" }, c)!;
    expect(tituloDoGrupoDePecas("pecasDaMontagem", perguntas)).toBe("Quantas peças?");
    const recolha = perguntasDe({ servico: "recolha_moveis" }, c)!;
    expect(rotuloDoGrupoDePecas("desmontarPecas", recolha)).toBe("Desmontar antes de levar");
    expect(tituloDoGrupoDePecas("desmontarPecas", recolha)).toBe("Desmontar antes de levar (opcional)");
    expect(rotuloDoGrupoDePecas("desmontarPecas", perguntasDe({ servico: "mudanca" }, c)!)).toBe("Desmontar e montar no destino");
    expect(nomeDaPeca("Desmontar antes de levar — Peça pequena")).toBe("Peça pequena");
    expect(nomeDaPeca("Cama de casal")).toBe("Cama de casal");
  });

  it("só «O que é para fazer?» é obrigatória no «oque»; o acesso pergunta-se depois", () => {
    const r = base({ servico: "montagem_moveis" });
    expect(camposEmFaltaNoEcra(r, "oque", c).map((x) => x.campo)).toEqual(["operacaoDaMontagem"]);
    expect(camposEmFaltaNoEcra(responder(r, { operacaoDaMontagem: "desmontar" }), "oque", c)).toEqual([]);
    expect(perguntasVisiveis(r, perguntasDe(r, c)!, "acesso").map((p) => p.id)).toEqual(expect.arrayContaining(["floor", "parkingDistance"]));
  });

  it("o pedido leva os campos do simulador do site, e o site escreve as linhas da montagem", () => {
    const { order } = corpoDoPedido(montagem, c, { emailDaSessao: "fred@example.com", rascunhosAntes: 0 });
    expect(order).toMatchObject({
      serviceType: "montagem_moveis",
      operacaoDaMontagem: "montar",
      pecasDaMontagem: { pequena: 2, roupeiro_3: 1 },
      fixarAParede: 1,
      retirarEmbalagens: true,
      cozinhaNaMontagem: false,
      floor: "3º",
      hasElevator: "no",
    });
    // Só as peças de 1 para cima; nada da desmontagem das recolhas.
    expect((order.pecasDaMontagem as Record<string, number>).media).toBeUndefined();
    expect(order.desmontarPecas).toBeUndefined();
    const g = gravado(order);
    expect(g.description).toContain("Montagem: Montar — 2 × Peça pequena, 1 × Roupeiro de 3 portas.");
    expect(g.description).toContain("Extras da montagem: fixar à parede (anti-queda) 1 móvel, retirar as embalagens.");
    expect(g.description).not.toContain("Cozinha:");
    // A app não repete as linhas na descrição: escreve-as o site.
    expect(String(order.description)).not.toContain("Montagem:");
  });

  it("a estimativa (R12) é a do simulador do site para as mesmas respostas", () => {
    const naApp = r12(montagem);
    const noSite = r12DoSite({
      serviceType: "montagem_moveis",
      operacaoDaMontagem: "montar",
      pecasDaMontagem: { pequena: 2, roupeiro_3: 1 },
      fixarAParede: 1,
      retirarEmbalagens: true,
      cozinhaNaMontagem: false,
      floor: "3º",
      hasElevator: "no",
      parkingDistance: "door",
      address: { city: "Almada" },
    });
    expect(naApp.linhas).toEqual(noSite.linhas);
    expect(naApp.conta).toEqual(noSite.conta);
    // 2 × 15 + 65 = 95; 1 andar a pé a partir do 3.º +10; fixar 1 +10; embalagens +10 = 125 € + IVA.
    expect(naApp.linhas.map((l) => l.texto).join(" ")).toContain("125 € + IVA");
    const ecra = referenciaValida(viaJson(naApp))!;
    expect(ecra.linhas.length).toBeGreaterThan(0);
    expect(ecra.porque).toEqual(naApp.porque);
    // Desmontar: metade — a mesma conta nos dois lados.
    const desmontar = responder(montagem, { operacaoDaMontagem: "desmontar" });
    expect(r12(desmontar).linhas).toEqual(
      r12DoSite({ serviceType: "montagem_moveis", operacaoDaMontagem: "desmontar", pecasDaMontagem: { pequena: 2, roupeiro_3: 1 }, fixarAParede: 1, retirarEmbalagens: true, floor: "3º", hasElevator: "no", parkingDistance: "door", address: { city: "Almada" } }).linhas,
    );
  });

  it("o resumo diz as peças e os extras por extenso", () => {
    const servico = linhasDoResumo(montagem, c).find((l) => l.rotulo === "Serviço")!.texto;
    expect(servico).toContain("Montar.");
    expect(servico).toContain("2 × Peça pequena, 1 × Roupeiro de 3 portas.");
    expect(servico).toContain("Fixar à parede (anti-queda): 1 móvel.");
    expect(servico).toContain("Retirar as embalagens.");
    expect(servico).not.toContain("cozinha");
    expect(servico).not.toMatch(/€|IVA/);
  });
});

describe("a app de cliente: desmontar nas recolhas e na mudança", () => {
  it("na recolha de móveis, as peças a desmontar só aparecem com «É preciso desmontar?» a sim", () => {
    const r = base({ servico: "recolha_moveis", descricao: "Um roupeiro e uma cama velhos" });
    const perguntas = perguntasDe(r, c)!;
    const ids = (x: Rascunho) => perguntasVisiveis(x, perguntas, "oque").map((p) => p.id);
    expect(perguntas.filter((p) => p.id.startsWith("desmontarPecas.")).length).toBe(IDS_DAS_PECAS_DA_MONTAGEM.length);
    expect(ids(r).some((id) => id.startsWith("desmontarPecas."))).toBe(false);
    expect(ids(responder(r, { desmontagem: "sim" })).filter((id) => id.startsWith("desmontarPecas.")).length).toBe(IDS_DAS_PECAS_DA_MONTAGEM.length);
  });

  it("a recolha leva `desmontarPecas`, o site escreve «Desmontar antes de levar», e a R12 tem a linha do extra", () => {
    const r = responder(base({ servico: "recolha_moveis", descricao: "Um roupeiro e uma cama velhos", morada: { formattedAddress: "Rua Inventada 1, Almada", city: "Almada" } }), {
      movelModo: "item",
      "itens.grande": "2",
      desmontagem: "sim",
      "desmontarPecas.roupeiro_3": "1",
      "desmontarPecas.cama_casal": "1",
      floor: "rés-do-chão",
      parkingDistance: "door",
    });
    const { order } = corpoDoPedido(r, c, { emailDaSessao: "fred@example.com", rascunhosAntes: 0 });
    expect(order.desmontarPecas).toEqual({ cama_casal: 1, roupeiro_3: 1 });
    expect(gravado(order).description).toContain("Desmontar antes de levar: 1 × Cama de casal, 1 × Roupeiro de 3 portas.");
    const ref = r12(r);
    expect(ref.linhas.map((l) => l.rotulo)).toContain("Desmontar antes de levar");
    expect(linhasDoResumo(r, c).find((l) => l.rotulo === "Serviço")!.texto).toContain("Desmontar antes de levar: 1 × Cama de casal, 1 × Roupeiro de 3 portas.");
    // Com «não» à desmontagem, as peças não seguem (mesmo que tivessem sido contadas antes).
    const sem = responder(r, { desmontagem: "nao" });
    expect(corpoDoPedido(sem, c, { emailDaSessao: "fred@example.com", rascunhosAntes: 0 }).order.desmontarPecas).toBeUndefined();
  });

  it("a mudança leva «Desmontar e montar no destino», peça a peça, e a R12 conta-o como o site", () => {
    const r = responder(base({ servico: "mudanca", descricao: "Mudança de um T2 para Setúbal" }), {
      tipologia: "T2",
      "desmontarPecas.roupeiro_4": "1",
    });
    const { order } = corpoDoPedido(r, c, { emailDaSessao: "fred@example.com", rascunhosAntes: 0 });
    expect(order.desmontarPecas).toEqual({ roupeiro_4: 1 });
    expect(gravado(order).description).toContain("Desmontar e montar no destino: 1 × Roupeiro de 4 portas ou de correr.");
    const naApp = r12(r).linhas.find((l) => l.rotulo === "Desmontar e montar no destino");
    const noSite = r12DoSite({ serviceType: "mudanca", tipologia: "T2", desmontarPecas: { roupeiro_4: 1 } }).linhas.find((l) => l.rotulo === "Desmontar e montar no destino");
    expect(naApp).toBeTruthy();
    expect(naApp).toEqual(noSite);
  });

  it("o ecrã desenha as peças em contadores, com o preço da R7 em duas linhas", () => {
    const ecra = ler("app-cliente/src/componentes/NovoPedido.tsx");
    expect(ecra).toContain("const grupoDaPeca = grupoDePecas(p.id);");
    expect(ecra).toContain("{tituloDoGrupoDePecas(grupoDaPeca, perguntas)}");
    expect(ecra).toContain("nome={nomeDaPeca(x.titulo)}");
    expect(ecra).toContain('if (p.id === "fixarAParede" && p.tipo === "numero") {');
    // O serviço tem cor e ícone próprios.
    expect(ler("app-cliente/src/tema.ts")).toContain('montagem_moveis: { tom: "indigo", icone: "build-outline" },');
  });
});

describe("a app Pro: o grupo «Montagem de móveis»", () => {
  it("o registo e os Serviços escolhem da lista única, que já tem a montagem", () => {
    expect(SERVICOS_DA_INSCRICAO).toBe(CATEGORIAS_DOS_PROFISSIONAIS);
    const g = SERVICOS_DA_INSCRICAO.find((x) => x.id === "montagem_de_moveis");
    expect(g).toMatchObject({ label: "Montagem de móveis", servicos: ["montagem_moveis"] });
    expect(ler("app-pro/src/app/registo.tsx")).toContain("{SERVICOS_DA_INSCRICAO.map((s) => {");
    expect(ler("app-pro/src/app/conta/servicos.tsx")).toContain("const escolhas = SERVICOS_DA_INSCRICAO;");
    // A jardinagem continua fora.
    expect(SERVICOS_DA_INSCRICAO.flatMap((x) => x.servicos)).not.toContain("jardinagem");
  });

  it("um pedido de montagem chega ao profissional com as linhas da montagem na descrição", () => {
    const g = gravado(corpoDoPedido(montagem, c, { emailDaSessao: "fred@example.com", rascunhosAntes: 0 }).order);
    const pro = ler("app-pro/src/app/trabalho/[id].tsx");
    expect(pro).toContain("<DescricaoDoPedido texto={t.description} />");
    expect(String(g.description).split("\n")[0]).toBe("Montagem: Montar — 2 × Peça pequena, 1 × Roupeiro de 3 portas.");
  });
});
