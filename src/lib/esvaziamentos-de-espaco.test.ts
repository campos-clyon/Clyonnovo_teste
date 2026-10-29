import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ESVAZIAMENTO_POR_ESPACO, PRECOS, estimativaDoEspaco } from "./precos-publicos";
import { NOMES_DOS_SERVICOS, SERVICE_CATEGORIES, SERVICOS_PUBLICOS } from "./service-categories";
import { calculateFastEstimate, eCargaCompleta } from "./pricing-helper";
import { PROPOSTA_COM_FOTOGRAFIAS, precoDeReferencia, referenciaDoPedido } from "./preco-de-referencia";
import {
  PERGUNTAS_DO_ESPACO,
  acessoDificilDoEspaco,
  avisosDasCoisas,
  comLinha,
  linhaDasCoisas,
  linhaDoAcesso,
} from "./perguntas-do-espaco";
import { servicoDoTexto } from "./whatsapp-recolha";
import { linhasDoEsvaziamento } from "./quanto-custa";
import { oSeuServico } from "./servico-em-palavras";

/**
 * A GARAGEM, O SÓTÃO E A CAVE — 29-10-2026 (especificação de Produto aprovada
 * pelo dono). Os sete critérios de aceitação, e os números da grelha.
 */

const RAIZ = join(__dirname, "..", "..");
const cru = (f: string) => readFileSync(join(RAIZ, f), "utf8").replace(/\r\n/g, "\n");

describe("os nomes, as frases e a ordem", () => {
  it("em Esvaziamentos: casa, apartamento, garagem, sótão, cave — com os nomes exactos", () => {
    const ids = SERVICOS_PUBLICOS.map((c) => c.id).filter((id) => id.startsWith("esvaziamento_"));
    expect(ids).toEqual(["esvaziamento_casa", "esvaziamento_apartamento", "esvaziamento_garagem", "esvaziamento_sotao", "esvaziamento_cave"]);
    expect(NOMES_DOS_SERVICOS.esvaziamento_garagem).toBe("Esvaziamento de garagem");
    expect(NOMES_DOS_SERVICOS.esvaziamento_sotao).toBe("Esvaziamento de sótão");
    expect(NOMES_DOS_SERVICOS.esvaziamento_cave).toBe("Esvaziamento de cave");
  });

  it("as frases dizem «parceiro verificado» e nunca «profissional»", () => {
    for (const id of ["esvaziamento_garagem", "esvaziamento_sotao", "esvaziamento_cave"]) {
      const c = SERVICE_CATEGORIES.find((x) => x.id === id)!;
      expect(c.description).toMatch(/^Um parceiro verificado .* destino licenciado\.$/);
      expect(c.description).not.toMatch(/profissional/i);
    }
    expect(oSeuServico("esvaziamento_sotao")).toBe("o seu esvaziamento de sótão");
  });
});

describe("os preços", () => {
  it("as faixas da especificação, sem IVA", () => {
    const f = Object.fromEntries(ESVAZIAMENTO_POR_ESPACO.map((e) => [e.servico, e.faixas]));
    expect(f.esvaziamento_garagem).toEqual({ carrinha: { de: 120, ate: 180 }, camiao_caixa: { de: 200, ate: 280 }, camiao_lixo: { de: 300, ate: 420 } });
    expect(f.esvaziamento_sotao).toEqual({ carrinha: { de: 150, ate: 220 }, camiao_caixa: { de: 250, ate: 340 }, camiao_lixo: { de: 360, ate: 480 } });
    expect(f.esvaziamento_cave).toEqual({ carrinha: { de: 140, ate: 200 }, camiao_caixa: { de: 230, ate: 320 }, camiao_lixo: { de: 340, ate: 450 } });
    expect(PRECOS.esvaziamento_garagem).toEqual({ etiqueta: "desde 120 €", minimo: 120, maximo: 420 });
    expect(PRECOS.esvaziamento_sotao).toEqual({ etiqueta: "desde 150 €", minimo: 150, maximo: 480 });
    expect(PRECOS.esvaziamento_cave).toEqual({ etiqueta: "desde 140 €", minimo: 140, maximo: 450 });
  });

  it("a linha do cartão leva o IVA ao lado", () => {
    expect(precoDeReferencia("esvaziamento_garagem")).toBe("desde 120 € + IVA (147,60 € com IVA)");
    expect(precoDeReferencia("esvaziamento_sotao")).toBe("desde 150 € + IVA (184,50 € com IVA)");
    expect(precoDeReferencia("esvaziamento_cave")).toBe("desde 140 € + IVA (172,20 € com IVA)");
  });

  it("a tabela /precos/esvaziamento-de-casas tem as três linhas", () => {
    const linhas = linhasDoEsvaziamento().map((l) => l.oQue);
    for (const e of ["Garagem", "Sótão", "Cave"]) expect(linhas).toContain(e);
  });
});

describe("os critérios de aceitação", () => {
  const base = { city: "Lisboa", address: { city: "Lisboa" }, distanceFromBase: { distanceKm: 10 }, floor: "rés-do-chão", hasElevator: "", parkingDistance: "door" };

  it("3 — garagem, pouca coisa, ao nível da rua, carrinha à porta: 120–180 € (147,60–221,40 € com IVA), nunca 220", async () => {
    const r = await calculateFastEstimate({ ...base, serviceType: "esvaziamento_garagem", volumeTier: "carrinha", acessoDoEspaco: "rua", description: "Garagem" } as never);
    expect(r.estimateMinWithoutVat).toBe(120);
    expect(r.estimateMaxWithoutVat).toBe(180);
    expect(r.estimatedPriceWithoutVat).toBeGreaterThanOrEqual(120);
    expect(r.estimatedPriceWithoutVat).toBeLessThanOrEqual(180);
    expect(r.estimatedPriceWithoutVat).not.toBe(220);
    const linha = referenciaDoPedido({ servico: "esvaziamento_garagem", volume: "carrinha" }).linhas.map((l) => l.texto).join(" ");
    expect(linha).toContain("120 – 180 € + IVA (147,60 – 221,40 € com IVA)");
  });

  it("4 — sótão, cheio, com alçapão: o topo da faixa (480 €), nunca acima", async () => {
    const r = await calculateFastEstimate({ ...base, floor: "4º+", hasElevator: "no", parkingDistance: "difficult", serviceType: "esvaziamento_sotao", volumeTier: "camiao_lixo", acessoDoEspaco: "alcapao", description: "Sótão" } as never);
    expect(r.estimatedPriceWithoutVat).toBe(480);
    expect(r.estimateMaxWithoutVat).toBe(480);
    expect(estimativaDoEspaco("esvaziamento_sotao", "camiao_lixo", true)?.valor).toBe(480);
  });

  it("5 — «não sei» não tem número e pede fotografias", async () => {
    expect(estimativaDoEspaco("esvaziamento_cave", "incerto")).toBeNull();
    const linhas = referenciaDoPedido({ servico: "esvaziamento_cave", volume: "incerto" }).linhas.map((l) => l.texto);
    expect(linhas).toContain(PROPOSTA_COM_FOTOGRAFIAS);
    const r = await calculateFastEstimate({ ...base, serviceType: "esvaziamento_cave", volumeTier: "incerto", acessoDoEspaco: "rua", description: "Cave" } as never);
    expect(r.status).toBe("needs_more_info");
  });

  it("só a faixa «cheio» é carga completa nestes três", () => {
    expect(eCargaCompleta("esvaziamento_garagem", "carrinha", 4)).toBe(false);
    expect(eCargaCompleta("esvaziamento_garagem", "camiao_caixa", 10)).toBe(false);
    expect(eCargaCompleta("esvaziamento_garagem", "camiao_lixo", 18)).toBe(true);
    expect(eCargaCompleta("esvaziamento_casa", "carrinha", 4)).toBe(true);
    expect(eCargaCompleta("recolha_monos", undefined, 8)).toBe(true);
  });

  it("2 — no máximo 4 perguntas por tipo (quantidade, acesso, o que lá está, e o andar/estacionamento que já existem)", () => {
    for (const [id, p] of Object.entries(PERGUNTAS_DO_ESPACO)) {
      // quantidade + acesso + estacionamento, mais «o que lá está» ou o andar
      const n = 3 + (p.coisas ? 1 : 0) + (p.perguntaOAndar ? 1 : 0);
      expect(n, id).toBeLessThanOrEqual(4);
    }
    expect(PERGUNTAS_DO_ESPACO.esvaziamento_sotao.perguntaOAndar).toBe(true);
    expect(PERGUNTAS_DO_ESPACO.esvaziamento_sotao.coisas).toBeUndefined();
  });

  it("6 — cada resposta escreve uma linha na descrição", () => {
    let d = comLinha("Tem uma bicicleta velha.", "Acesso: ", linhaDoAcesso("esvaziamento_sotao", "alcapao"));
    expect(d).toBe("Acesso: alçapão com escada de abrir.\nTem uma bicicleta velha.");
    d = comLinha(d, "Acesso: ", linhaDoAcesso("esvaziamento_sotao", "escada_normal"));
    expect(d.match(/Acesso:/g)?.length).toBe(1);
    expect(linhaDasCoisas("esvaziamento_cave", ["pneus", "humidade"])).toBe("No espaço há: pneus, coisas molhadas ou com bolor.");
    expect(avisosDasCoisas("esvaziamento_garagem", ["quimicos", "pneus"])).toHaveLength(2);
  });

  it("o acesso difícil: alçapão, escada estreita, mais de 10 degraus, parque com horário, estacionamento longe", () => {
    expect(acessoDificilDoEspaco("esvaziamento_sotao", "alcapao")).toBe(true);
    expect(acessoDificilDoEspaco("esvaziamento_sotao", "escada_estreita")).toBe(true);
    expect(acessoDificilDoEspaco("esvaziamento_cave", "mais_de_10_degraus")).toBe(true);
    expect(acessoDificilDoEspaco("esvaziamento_garagem", "parque_com_horario")).toBe(true);
    expect(acessoDificilDoEspaco("esvaziamento_garagem", "rua", "over_30m")).toBe(true);
    expect(acessoDificilDoEspaco("esvaziamento_garagem", "rua", "door")).toBe(false);
  });

  it("7 — nenhum texto novo diz «profissional»", () => {
    for (const f of [
      "src/lib/perguntas-do-espaco.ts",
      "src/app/simulador/components/PerguntasDoEspaco.tsx",
    ]) {
      const semComentarios = cru(f)
        .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(semComentarios, f).not.toMatch(/profissiona/i);
    }
  });
});

describe("a Vitória percebe os três", () => {
  it("pelas palavras", () => {
    expect(servicoDoTexto("Preciso de esvaziar a garagem")).toBe("esvaziamento_garagem");
    expect(servicoDoTexto("queria limpar o sótão, está cheio de tralha")).toBe("esvaziamento_sotao");
    expect(servicoDoTexto("tenho a cave cheia de coisas velhas")).toBe("esvaziamento_cave");
    // O sofá na garagem continua a ser uma recolha.
    expect(servicoDoTexto("quero que levem o sofá que está na garagem")).not.toBe("esvaziamento_garagem");
  });
});
