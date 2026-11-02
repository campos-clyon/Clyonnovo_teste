import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lerDataPreferida } from "./pedido-da-app-de-cliente";
import { catalogoDaApp } from "./catalogo-da-app";
import { rotuloDoCartao, soAEscolhida } from "../../app-cliente/src/lib/escolha-recolhida";
import {
  catalogoValido,
  corpoDoPedido,
  DIAS_NO_CALENDARIO,
  diaPossivel,
  diasParaEscolher,
  HORAS_DO_CALENDARIO,
  horaPorExtenso,
  linhaDaHora,
  mesesDoCalendario,
  nomeDoMes,
  primeiroDiaPossivel,
  rascunhoValido,
  rascunhoVazio,
  semanasDoMes,
  textoDoQuando,
  ultimoDiaPossivel,
  type Catalogo,
  type Rascunho,
} from "../../app-cliente/src/lib/novo-pedido";

/**
 * A ESCOLHA RECOLHIDA E O CALENDÁRIO DO MÊS NO PEDIR DA APP DE CLIENTE —
 * ordem do CEO com o sim do dono, 02-11-2026.
 *
 * 1. Numa lista de escolha única com perguntas a seguir no mesmo ecrã, depois
 *    de escolher fica só a escolhida, num cartão com «Mudar».
 * 2. «Escolher no calendário» é só outra forma de escolher o dia: os mesmos
 *    dias que os botões rápidos (e que o site aceita), a mesma `dataPreferida`;
 *    a hora (8h00–20h00, de 30 em 30 min, Lisboa) vai na descrição.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const viaJson = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const c = catalogoValido(viaJson(catalogoDaApp())) as Catalogo;
// 23h30 de 2 de novembro em Lisboa (inverno, UTC+0): amanhã é dia 3, mesmo que a máquina esteja noutro fuso.
const AGORA = new Date("2026-11-02T23:30:00Z");

describe("a escolha recolhida", () => {
  it("só recolhe com `recolher`, com uma escolha válida, e não enquanto o cliente está a mudar", () => {
    const ids = ["pouco", "quarto", "varias"];
    expect(soAEscolhida(true, "quarto", ids, false)).toBe(true);
    expect(soAEscolhida(true, "quarto", ids, true)).toBe(false);
    expect(soAEscolhida(false, "quarto", ids, false)).toBe(false);
    expect(soAEscolhida(true, undefined, ids, false)).toBe(false);
    expect(soAEscolhida(true, "outra", ids, false)).toBe(false);
  });

  it("o cartão diz a pergunta, a escolha e «Mudar»", () => {
    expect(rotuloDoCartao("Enche uma carrinha", "Quanto há para levar?")).toBe("Quanto há para levar: Enche uma carrinha. Mudar");
    expect(rotuloDoCartao("2.º")).toBe("2.º. Mudar");
  });

  it("o Escolhas recolhe para o cartão e anima a mudança; fora do Pedir não muda nada", () => {
    const ui = ler("app-cliente/src/componentes/ui.tsx");
    expect(ui).toContain("recolher = false,");
    expect(ui).toContain("soAEscolhida(");
    expect(ui).toContain("<EscolhaFeita");
    expect(ui).toContain("LayoutAnimation.configureNext(LayoutAnimation.create(200,");
    expect(ler("app-cliente/src/componentes/AlterarOPedido.tsx")).not.toContain("recolher");
  });

  it("no Pedir recolhem o serviço e todas as listas com perguntas a seguir no mesmo ecrã", () => {
    const np = ler("app-cliente/src/componentes/NovoPedido.tsx");
    // O serviço (o 1.º bloco de «O que precisa?»).
    expect(np).toMatch(/function EscolherServico[\s\S]*?soAEscolhida\(true, servico\.id[\s\S]*?<EscolhaFeita/);
    for (const campo of ["volume", "acessoDoEspaco", "entulho", "entulhoVolume", "tipologia"]) {
      expect(np, campo).toContain(`<Escolhas recolher campo="${campo}"`);
    }
    expect(np).toMatch(/recolher\n\s*rotulo="Como prefere indicar\?"/);
    expect(np).toMatch(/recolher\n\s*rotulo="Quanto é\?"/);
    expect(np).toContain('<Escolhas recolher rotulo="Em que andar está?"');
    expect(np).toContain('<Escolhas recolher rotulo="Há elevador?"');
    expect(np).toContain('<Escolhas recolher={comDificil} rotulo="A carrinha fica perto?"');
    expect(np).toContain('recolher={r.quando === "data" || d === "manutencao"}');
    // As que fecham o ecrã (nada a seguir) não recolhem.
    expect(np).not.toMatch(/recolher[^\n]*\n?[^\n]*rotulo="É preciso desmontar móveis\?"/);
    expect(np).not.toMatch(/<Escolhas recolher[^>]*rotulo="Repetir o serviço\?"/);
  });
});

describe("o calendário do mês", () => {
  it("os mesmos dias que os botões rápidos: de amanhã em Lisboa até ao último, os outros desligados", () => {
    const rapidos = diasParaEscolher(AGORA);
    expect(primeiroDiaPossivel(AGORA)).toBe("2026-11-03");
    expect(rapidos[0].dia).toBe("2026-11-03");
    expect(ultimoDiaPossivel(AGORA)).toBe(rapidos[rapidos.length - 1].dia);
    expect(rapidos).toHaveLength(DIAS_NO_CALENDARIO);
    const doCalendario = mesesDoCalendario(AGORA)
      .flatMap((m) => semanasDoMes(m, AGORA).flat())
      .filter((x): x is NonNullable<typeof x> => !!x && x.possivel)
      .map((x) => x.dia);
    expect(doCalendario).toEqual(rapidos.map((x) => x.dia));
    expect(diaPossivel("2026-11-02", AGORA)).toBe(false);
    expect(diaPossivel("2026-11-01", AGORA)).toBe(false);
  });

  it("todos os dias que o calendário deixa escolher o site aceita (e os desligados recusa)", () => {
    for (const m of mesesDoCalendario(AGORA)) {
      for (const x of semanasDoMes(m, AGORA).flat()) {
        if (!x) continue;
        const lido = lerDataPreferida(x.dia, AGORA);
        if (x.possivel) expect(lido.ok, x.dia).toBe(true);
        else if (x.dia <= "2026-11-02") expect(lido.ok, x.dia).toBe(false);
      }
    }
  });

  it("os meses: de novembro a janeiro, com as setas só até aí; as semanas de segunda a domingo", () => {
    expect(mesesDoCalendario(AGORA)).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(nomeDoMes("2026-11")).toBe("novembro de 2026");
    const nov = semanasDoMes("2026-11", AGORA);
    // 1 de novembro de 2026 é domingo: seis lugares vazios antes.
    expect(nov[0].slice(0, 6).every((x) => x === null)).toBe(true);
    expect(nov[0][6]?.dia).toBe("2026-11-01");
    expect(nov.every((s) => s.length === 7)).toBe(true);
    expect(nov.flat().filter(Boolean)).toHaveLength(30);
  });

  it("as horas: das 8h00 às 20h00, de 30 em 30 minutos", () => {
    expect(HORAS_DO_CALENDARIO).toHaveLength(25);
    expect(HORAS_DO_CALENDARIO[0]).toBe("08:00");
    expect(HORAS_DO_CALENDARIO[1]).toBe("08:30");
    expect(HORAS_DO_CALENDARIO[24]).toBe("20:00");
    expect(horaPorExtenso("08:30")).toBe("8h30");
    expect(horaPorExtenso("14:00")).toBe("14h00");
  });

  it("o dia e a hora aparecem no resumo; a `dataPreferida` é a mesma e a hora vai na descrição", () => {
    const r: Rascunho = {
      ...rascunhoVazio(),
      servico: "esvaziamento_casa",
      descricao: "Sofá, cama e três caixas.",
      quando: "data",
      data: "2026-11-13",
      hora: "10:30",
    };
    expect(textoDoQuando(r)).toBe("sexta-feira, 13 de novembro, às 10h30");
    expect(textoDoQuando({ ...r, hora: undefined })).toBe("sexta-feira, 13 de novembro");
    expect(linhaDaHora(r)).toBe("Hora preferida: 10h30 (hora de Lisboa).");
    const { order } = corpoDoPedido(r, c, { emailDaSessao: null, rascunhosAntes: 0 });
    expect(order.dataPreferida).toBe("2026-11-13");
    expect(order.urgency).toBeUndefined();
    expect(String(order.description)).toContain("Hora preferida: 10h30 (hora de Lisboa).");
    // Sem «data à escolha», a hora não vai.
    expect(linhaDaHora({ ...r, quando: "amanha" })).toBeNull();
    const semHora = corpoDoPedido({ ...r, hora: undefined }, c, { emailDaSessao: null, rascunhosAntes: 0 }).order;
    expect(String(semHora.description)).not.toContain("Hora preferida");
  });

  it("um rascunho guardado com uma hora inválida perde só a hora", () => {
    const guardado = { ...rascunhoVazio(), descricao: "x", quando: "data", data: "2026-11-13", hora: "07:15" };
    expect(rascunhoValido(guardado)?.hora).toBeUndefined();
    expect(rascunhoValido({ ...guardado, hora: "19:30" })?.hora).toBe("19:30");
  });

  it("o ecrã «Quando?» tem o botão por baixo dos dias rápidos e o calendário numa folha", () => {
    const np = ler("app-cliente/src/componentes/NovoPedido.tsx");
    expect(np).toContain('titulo="Escolher no calendário"');
    expect(np).toContain('seta("chevron-forward", "Mês seguinte"');
    expect(np).toContain("disabled={!x.possivel}");
    expect(np).toContain("hora de Lisboa");
    expect(np.indexOf('<Marcado campo="data">')).toBeLessThan(np.indexOf('titulo="Escolher no calendário"'));
  });
});
