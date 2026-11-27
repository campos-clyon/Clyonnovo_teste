import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { comporADescricao, entradaDoModelo, type PedidoParaADescricao, type RespostaDoModelo } from "./descricao-pelo-modelo";
import { fontesVazias, oQueSeVe, juntarOQueSeViu } from "./fontes-da-descricao";
import { eAoNivelDaRua, eLoja, eResDoChao, LOJA } from "./res-do-chao";
import { falaDaImagem, semFalarDaImagem } from "./sem-falar-da-imagem";
import { limparOQueSeVe } from "./whatsapp-imagem";
import { estimateLaborHours } from "./pricing-helper";
import { suplementoDosAndares } from "./quanto-custa";
import { numeroDoAndar, ANDARES } from "./respostas-do-simulador";
import { andaresAPe } from "./tabela-das-mudancas";
import { andarPorExtenso } from "./campos-na-descricao";
import { acessoEmPalavras } from "./pedido-completo-para-a-app";
import { andarDaResposta } from "./leitor-da-recolha";

/**
 * O RÉS-DO-CHÃO, A LOJA E O QUE SE VÊ — 27-11-2026 (d141, pedida e aprovada
 * pelo dono).
 *
 * O caso (inventado — o repositório é público, mas com a forma do #692): um
 * restaurante, o rés-do-chão marcado no formulário, e a descrição arrumada a
 * dizer «Por confirmar: o elevador; se tem elevador». E a frase das
 * fotografias a começar por «na imagem 1…».
 */

const PEDIDO: PedidoParaADescricao = {
  serviceType: "recolha_moveis",
  city: "Lisboa",
  postalCode: "1100-321",
  floor: "rés-do-chão",
  hasElevator: null,
  parkingDistance: "door",
  dataAgendada: "2026-12-02 09:00:00",
  fotos: 2,
};

const RESPOSTA: RespostaDoModelo = {
  paraLevar: ["Na imagem 1, 1 frigorífico vertical com porta de vidro", "a imagem 2 mostra prateleiras com caixas de cartão"],
  confirmarSeTambemVai: [],
  quando: "",
  estacionamento: "",
  notas: ["O restaurante fica num rés-do-chão sem elevador", "Nas fotografias vê-se um balcão para desmontar"],
  porConfirmar: ["o elevador", "se tem elevador", "o andar", "o estacionamento", "a data", "as medidas do balcão"],
};

describe("o rés-do-chão nunca pede o elevador", () => {
  for (const floor of ["rés-do-chão", "Rés-do-chão", "R/C", "0", LOJA, "Loja", "moradia térrea", "térreo"]) {
    it(`«${floor}»`, () => {
      const t = comporADescricao(RESPOSTA, fontesVazias(), { ...PEDIDO, floor });
      expect(t).not.toMatch(/elevador/i);
      expect(t).not.toMatch(/\bandar\b/i);
    });
  }

  it("o que o formulário já diz não fica «por confirmar»; o resto fica, uma vez", () => {
    const t = comporADescricao(RESPOSTA, fontesVazias(), PEDIDO);
    const linha = t.split("\n").find((l) => l.startsWith("Por confirmar:")) ?? "";
    expect(linha).toBe("Por confirmar: as medidas do balcão.");
  });

  it("num andar a sério, sem elevador no campo, pede-o — uma vez só", () => {
    const t = comporADescricao(RESPOSTA, fontesVazias(), { ...PEDIDO, floor: "2", hasElevator: null });
    const linha = t.split("\n").find((l) => l.startsWith("Por confirmar:")) ?? "";
    expect(linha.match(/elevador/g)?.length).toBe(1);
  });

  it("ao modelo diz-se que não há elevador a perguntar", () => {
    const e = entradaDoModelo(fontesVazias(), { ...PEDIDO, floor: LOJA });
    expect(e).toContain("Elevador: não há (ao nível da rua)");
    expect(e).toContain("Andar: loja (ao nível da rua)");
  });
});

describe("o que se vê, sem «na imagem 1»", () => {
  it("a descrição fala das coisas, não das fotografias", () => {
    const t = comporADescricao(RESPOSTA, fontesVazias(), PEDIDO);
    expect(t).not.toMatch(/imagem|fotografia|vê-se/i);
    expect(t).toContain("Para levar: 1 frigorífico vertical com porta de vidro, prateleiras com caixas de cartão.");
    expect(t).toContain("balcão para desmontar");
  });

  it("as muletas, onde quer que venham", () => {
    const casos: Array<[string, string]> = [
      ["Na imagem 1, um frigorífico", "Um frigorífico"],
      ["nas fotografias 2 e 3: caixas de cartão", "caixas de cartão"],
      ["A imagem mostra um sofá de três lugares", "Um sofá de três lugares"],
      ["sofá (imagem 2)", "sofá"],
      ["Imagem 1: colchão", "Colchão"],
      ["vê-se um balcão de inox", "um balcão de inox"],
      ["2 cadeiras; na foto 3, uma mesa", "2 cadeiras; uma mesa"],
    ];
    for (const [antes, depois] of casos) {
      expect(semFalarDaImagem(antes), antes).toBe(depois);
      expect(falaDaImagem(antes), antes).toBe(true);
    }
    expect(falaDaImagem("1 frigorífico vertical com porta de vidro")).toBe(false);
  });

  it("a frase do modelo das imagens e o que vai à descrição também se limpam", () => {
    expect(limparOQueSeVe("A fotografia mostra 3 sacos de entulho numa sala.")).toBe("3 sacos de entulho numa sala");
    const f = juntarOQueSeViu(fontesVazias(), "https://exemplo.pt/a.jpg", "na imagem 1, um frigorífico vertical", new Date("2026-11-27T10:00:00Z"));
    expect(oQueSeVe(f)).toEqual(["um frigorífico vertical"]);
  });
});

describe("a loja, ao nível da rua", () => {
  it("é reconhecida, e conta como ao nível da rua", () => {
    expect(eLoja(LOJA)).toBe(true);
    expect(eLoja("Loja (ao nível da rua)")).toBe(true);
    expect(eAoNivelDaRua(LOJA)).toBe(true);
    expect(eResDoChao(LOJA)).toBe(false);
    expect(eAoNivelDaRua("2º")).toBe(false);
  });

  it("no preço é o rés-do-chão: sem andares", () => {
    const rc = suplementoDosAndares({ floor: "rés-do-chão", hasElevator: null, parkingDistance: "door" } as never, { pecasGrandes: 2 });
    const loja = suplementoDosAndares({ floor: LOJA, hasElevator: "no", parkingDistance: "door" } as never, { pecasGrandes: 2 });
    expect(loja).toEqual(rc);
    expect(loja.andaresAPe).toBe(0);
    const mud = { serviceType: "mudanca", tipologia: "T2" };
    expect(estimateLaborHours({ ...mud, originAccess: { floor: LOJA, hasElevator: "no" } } as never)).toBe(
      estimateLaborHours({ ...mud, originAccess: { floor: "rés-do-chão" } } as never),
    );
    expect(numeroDoAndar(LOJA)).toBe(0);
    expect(andaresAPe(LOJA, "no")).toBe(0);
  });

  it("está nas opções do andar (simulador, R12, apps) e escreve-se por extenso", () => {
    expect(ANDARES.map((a) => a.id)).toEqual(["rés-do-chão", LOJA, "1º", "2º", "3º", "4º+"]);
    expect(andarPorExtenso(LOJA)).toBe("loja (ao nível da rua)");
    expect(acessoEmPalavras({ floor: LOJA, hasElevator: "no" })).toBe("loja (ao nível da rua)");
  });

  it("os formulários têm a opção e escondem o elevador", () => {
    const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
    for (const p of ["src/app/simulador/SimulatorThreePhaseForm.tsx", "src/app/plataforma/pedir/FormularioDePedido.tsx"]) {
      const F = ler(p);
      expect(F, p).toContain('<option value="loja">Loja (ao nível da rua)</option>');
      expect(F, p).not.toMatch(/[!=]== "rés-do-chão"/);
    }
    const R = ler("src/components/admin/RegistarPedido.tsx");
    expect(R).toContain("checked={eLoja(f.floor)}");
    expect(R).toContain("checked={eLoja(f.andarDestino)}");
    expect(R).toContain("{!eAoNivelDaRua(f.floor) && (");
    expect(R).toContain("{!eAoNivelDaRua(f.andarDestino) && (");
  });
});

describe("a Vitória percebe a loja", () => {
  it("«é uma loja» é o rés-do-chão — e o elevador não se pergunta", () => {
    for (const r of ["loja", "É uma loja", "numa loja ao nível da rua", "rés-do-chão"]) expect(andarDaResposta(r), r).toBe("0");
  });
});
