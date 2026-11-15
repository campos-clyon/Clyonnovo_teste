import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { instanteEmLisboa } from "./hora-de-lisboa";
import {
  indisponibilidadeParaAApi,
  NOTA_DA_DATA_VAGA,
  PERGUNTA_COM_TRABALHO_MARCADO,
} from "./indisponibilidade";
import {
  corpoDaMarcacao,
  perguntaDoTrabalhoMarcado,
  ROTA_DAS_INDISPONIBILIDADES,
  TEXTOS_DA_INDISPONIBILIDADE,
  trabalhosEmCimaPorExtenso,
} from "./textos-da-indisponibilidade";
import {
  escolhaInicial,
  HORAS_DO_DIA,
  listaDe,
  marcaDoDia,
  mesesPermitidos,
  outroMes,
  passarAHora,
  podeEscolher,
  previsaoDaMarcacao,
  semanasDoMes,
  tituloDoMes,
  tocarNoDia,
  trabalhoEmCimaPorExtenso,
  type Indisponibilidade,
} from "../../app-pro/src/lib/indisponibilidades";

/**
 * A PARTE DA APP PRO DA d35 — 15-11-2026. «Dias em que não pode trabalhar» na
 * Agenda da app, igual ao painel. Uma regra, um teste:
 *
 *   1. o pedido é o do painel (`corpoDaMarcacao`), e a rota a mesma;
 *   2. antes de marcar, a app diz o que vai ficar marcado — ou o erro — pela
 *      regra do servidor, em hora de Lisboa;
 *   3. o calendário: segunda a domingo, sem dias passados, «De» e «Até»;
 *   4. as horas de meia em meia hora, sem sair do dia;
 *   5. a pergunta do trabalho marcado (409) e os trabalhos em Lisboa;
 *   6. paridade — as frases vêm de um sítio só, e a app usa a sessão dela.
 */

const lisboa = (q: string) => instanteEmLisboa(q) as Date;
const AGORA = lisboa("2026-11-15T10:00");
const cru = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const semNotas = (f: string) =>
  cru(f)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s+/g, " ");

const PAINEL = "src/app/profissionais/painel/Indisponibilidades.tsx";
const APP = "app-pro/src/componentes/Indisponibilidades.tsx";

describe("d35 na app Pro — o pedido", () => {
  it("dias inteiros sem «Até» é um dia só; com «Até», vários; umas horas não levam «Até»", () => {
    const base = escolhaInicial(AGORA);
    expect(base).toMatchObject({ soHoras: false, dia: "2026-11-15", ate: "", inicio: "09:00", fim: "13:00" });
    expect(corpoDaMarcacao({ ...base, dia: "2026-11-20" })).toEqual({ dia: "2026-11-20", ate: "2026-11-20", nota: "", confirmar: false });
    expect(corpoDaMarcacao({ ...base, dia: "2026-11-20", ate: "2026-11-24", nota: "férias" }, true)).toEqual({
      dia: "2026-11-20",
      ate: "2026-11-24",
      nota: "férias",
      confirmar: true,
    });
    const horas = corpoDaMarcacao({ ...base, soHoras: true, dia: "2026-11-20", ate: "2026-11-24", inicio: "14:00", fim: "18:00" });
    expect(horas).toEqual({ dia: "2026-11-20", inicio: "14:00", fim: "18:00", nota: "", confirmar: false });
    expect(ROTA_DAS_INDISPONIBILIDADES).toBe("/api/profissionais/indisponibilidades");
  });

  it("a forma da API é a que a app lê (o compilador confere), e uma resposta sem lista dá lista vazia", () => {
    const item: Indisponibilidade = indisponibilidadeParaAApi({
      id: 7,
      providerId: 3,
      inicioEm: lisboa("2026-11-20T00:00"),
      fimEm: lisboa("2026-11-25T00:00"),
      diaInteiro: true,
      nota: null,
    });
    expect(item).toMatchObject({ dia: "2026-11-20", ate: "2026-11-24", texto: "20/11 a 24/11", inicio: null, fim: null });
    expect(listaDe({ ok: true, indisponibilidades: [item] })).toHaveLength(1);
    expect(listaDe({ ok: true })).toEqual([]);
    expect(listaDe(null)).toEqual([]);
  });
});

describe("d35 na app Pro — antes de marcar, pela regra do servidor", () => {
  const base = escolhaInicial(AGORA);
  it("diz o que fica marcado, como a lista o vai mostrar", () => {
    expect(previsaoDaMarcacao({ ...base, dia: "2026-11-20" }, AGORA)).toEqual({ texto: "20/11 (dia inteiro)" });
    expect(previsaoDaMarcacao({ ...base, dia: "2026-11-20", ate: "2026-11-22" }, AGORA)).toEqual({ texto: "20/11 a 22/11" });
    expect(previsaoDaMarcacao({ ...base, soHoras: true, dia: "2026-11-20", inicio: "14:00", fim: "18:30" }, AGORA)).toEqual({
      texto: "20/11, das 14:00 às 18:30",
    });
  });

  it("recusa com as frases do servidor: dia passado, mais de 60 dias, horas ao contrário, horas já passadas", () => {
    expect(previsaoDaMarcacao({ ...base, dia: "2026-11-14" }, AGORA).erro).toBe("Esse dia já passou.");
    expect(previsaoDaMarcacao({ ...base, dia: "2026-11-20", ate: "2027-01-19" }, AGORA).erro).toBe(
      "No máximo 60 dias seguidos de cada vez.",
    );
    expect(previsaoDaMarcacao({ ...base, dia: "2026-11-20", ate: "2027-01-18" }, AGORA).erro).toBeUndefined();
    expect(previsaoDaMarcacao({ ...base, soHoras: true, dia: "2026-11-20", inicio: "18:00", fim: "14:00" }, AGORA).erro).toBe(
      "A hora de fim tem de ser depois da de início.",
    );
    expect(previsaoDaMarcacao({ ...base, soHoras: true, dia: "2026-11-15", inicio: "08:00", fim: "09:30" }, AGORA).erro).toBe(
      "Essas horas já passaram.",
    );
  });

  it("hoje é o de Lisboa: às 23:30 de Lisboa ainda é o mesmo dia, seja qual for o fuso do telemóvel", () => {
    const tarde = lisboa("2026-11-15T23:30");
    expect(escolhaInicial(tarde).dia).toBe("2026-11-15");
    expect(previsaoDaMarcacao({ ...escolhaInicial(tarde) }, tarde)).toEqual({ texto: "15/11 (dia inteiro)" });
  });
});

describe("d35 na app Pro — o calendário", () => {
  it("segunda a domingo: novembro de 2026 começa num domingo", () => {
    const semanas = semanasDoMes("2026-11");
    expect(semanas.every((s) => s.length === 7)).toBe(true);
    expect(semanas[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(semanas[1][0]).toBe("2026-11-02");
    expect(semanas.flat().filter(Boolean)).toHaveLength(30);
    expect(semanas.at(-1)?.[0]).toBe("2026-11-30");
    expect(tituloDoMes("2026-11")).toBe("Novembro de 2026");
    expect(outroMes("2026-12", 1)).toBe("2027-01");
    expect(outroMes("2026-01", -1)).toBe("2025-12");
  });

  it("só de hoje até um ano para a frente", () => {
    expect(podeEscolher("2026-11-14", "2026-11-15")).toBe(false);
    expect(podeEscolher("2026-11-15", "2026-11-15")).toBe(true);
    expect(podeEscolher("2027-11-15", "2026-11-15")).toBe(true);
    expect(podeEscolher("2027-11-16", "2026-11-15")).toBe(false);
    expect(mesesPermitidos("2026-11-15")).toEqual({ primeiro: "2026-11", ultimo: "2027-11" });
  });

  it("primeiro toque é «De», o seguinte (depois) é «Até», e um terceiro recomeça", () => {
    let e = { ...escolhaInicial(AGORA), dia: "", ate: "" };
    e = tocarNoDia(e, "2026-11-20");
    expect([e.dia, e.ate]).toEqual(["2026-11-20", ""]);
    e = tocarNoDia(e, "2026-11-23");
    expect([e.dia, e.ate]).toEqual(["2026-11-20", "2026-11-23"]);
    expect(marcaDoDia(e, "2026-11-20")).toBe("ponta");
    expect(marcaDoDia(e, "2026-11-21")).toBe("meio");
    expect(marcaDoDia(e, "2026-11-23")).toBe("ponta");
    expect(marcaDoDia(e, "2026-11-24")).toBeNull();
    e = tocarNoDia(e, "2026-11-25");
    expect([e.dia, e.ate]).toEqual(["2026-11-25", ""]);
    e = tocarNoDia(e, "2026-11-18");
    expect([e.dia, e.ate]).toEqual(["2026-11-18", ""]);
    const horas = tocarNoDia({ ...e, soHoras: true }, "2026-11-30");
    expect([horas.dia, horas.ate]).toEqual(["2026-11-30", ""]);
  });
});

describe("d35 na app Pro — as horas", () => {
  it("meia em meia hora, das 00:00 às 23:30, sem sair do dia", () => {
    expect(HORAS_DO_DIA).toHaveLength(48);
    expect(passarAHora("09:00", 1)).toBe("09:30");
    expect(passarAHora("09:00", -1)).toBe("08:30");
    expect(passarAHora("00:00", -1)).toBe("00:00");
    expect(passarAHora("23:30", 1)).toBe("23:30");
  });
});

describe("d35 na app Pro — em cima de um trabalho marcado", () => {
  const conflito = {
    error: PERGUNTA_COM_TRABALHO_MARCADO,
    precisaConfirmar: true,
    pergunta: PERGUNTA_COM_TRABALHO_MARCADO,
    trabalhos: [
      { pedidoId: 512, negociacaoId: 90, quando: lisboa("2026-11-21T09:00").toISOString() },
      { pedidoId: 498, negociacaoId: 91, quando: lisboa("2026-11-22T00:00").toISOString() },
    ],
  };
  it("lê o 409 da rota, e só esse", () => {
    const p = perguntaDoTrabalhoMarcado(409, conflito);
    expect(p?.pergunta).toBe(PERGUNTA_COM_TRABALHO_MARCADO);
    expect(p?.trabalhos.map((t) => t.pedidoId)).toEqual([512, 498]);
    expect(perguntaDoTrabalhoMarcado(400, conflito)).toBeNull();
    expect(perguntaDoTrabalhoMarcado(409, { error: "outra coisa" })).toBeNull();
    expect(trabalhosEmCimaPorExtenso(p!.trabalhos)).toBe("Trabalhos: #512, #498");
  });

  it("na app, cada trabalho com o dia e a hora de Lisboa (só o dia, quando não tem hora)", () => {
    expect(trabalhoEmCimaPorExtenso(conflito.trabalhos[0])).toBe("#512 · 21/11, às 09:00");
    expect(trabalhoEmCimaPorExtenso(conflito.trabalhos[1])).toBe("#498 · 22/11");
    expect(trabalhoEmCimaPorExtenso({ pedidoId: 1, quando: "nada" })).toBe("#1");
    // No Verão (UTC+1) a hora de Lisboa continua a ser a escrita.
    expect(trabalhoEmCimaPorExtenso({ pedidoId: 2, quando: lisboa("2027-07-10T14:30").toISOString() })).toBe("#2 · 10/07, às 14:30");
  });
});

describe("d35 — paridade entre o painel e a app Pro", () => {
  const painel = semNotas(PAINEL);
  const app = semNotas(APP);

  it("as frases vêm de um sítio só: nenhum dos dois as escreve à mão", () => {
    for (const fonte of [painel, app]) {
      expect(fonte).toContain("TEXTOS_DA_INDISPONIBILIDADE as T");
      expect(fonte).toContain("corpoDaMarcacao(");
      expect(fonte).toContain("ROTA_DAS_INDISPONIBILIDADES");
      for (const frase of [
        TEXTOS_DA_INDISPONIBILIDADE.titulo,
        TEXTOS_DA_INDISPONIBILIDADE.marcarIndisponivel,
        TEXTOS_DA_INDISPONIBILIDADE.explicacao,
        TEXTOS_DA_INDISPONIBILIDADE.diasInteiros,
        TEXTOS_DA_INDISPONIBILIDADE.umasHoras,
        TEXTOS_DA_INDISPONIBILIDADE.nota,
      ]) {
        expect(fonte).not.toContain(frase);
      }
    }
    for (const chave of ["titulo", "marcarIndisponivel", "explicacao", "diasInteiros", "umasHoras", "ateOpcional", "nota", "desmarcar", "marcar", "cancelar"]) {
      expect(painel).toContain(`T.${chave}`);
      expect(app).toContain(`T.${chave}`);
    }
  });

  it("a app vai pela sessão dela (o token no cabeçalho, por `pedir`), não por fetch", () => {
    expect(app).toContain("pedir<RespostaDasIndisponibilidades>(ROTA_DAS_INDISPONIBILIDADES");
    expect(app).toContain('metodo: "DELETE"');
    expect(app).not.toMatch(/\bfetch\(/);
    // A pergunta do 409 mostra-se e repete-se com confirmar: true.
    expect(app).toContain("perguntaDoTrabalhoMarcado(e.estado, e.corpo)");
    expect(app).toContain("marcar(true)");
  });

  it("o tema escuro: nenhuma cor escrita à mão no ecrã novo", () => {
    expect(app).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(app).toContain("useCores()");
  });

  it("na Agenda por cima de tudo, mesmo vazia — como no painel", () => {
    const agenda = semNotas("app-pro/src/app/(app)/agenda.tsx");
    const onde = agenda.indexOf("<Indisponibilidades />");
    expect(onde).toBeGreaterThan(0);
    expect(onde).toBeLessThan(agenda.indexOf("{vazia ? ("));
    expect(semNotas("src/app/profissionais/painel/Agenda.tsx")).toContain("<Indisponibilidades />");
  });

  it("a nota do pedido no cartão do Feed e no pedido, com o nome do campo da API", () => {
    expect(semNotas("src/app/api/profissionais/meus-pedidos/route.ts")).toContain("indisponibilidadeNoPedido:");
    expect(semNotas("app-pro/src/app/(app)/index.tsx")).toContain("{t.indisponibilidadeNoPedido}");
    expect(semNotas("app-pro/src/app/trabalho/[id].tsx")).toContain("{t.indisponibilidadeNoPedido}");
    expect(semNotas("src/app/profissionais/painel/Trabalhos.tsx")).toContain("{pedido.indisponibilidadeNoPedido}");
    expect(semNotas("app-pro/src/lib/trabalhos.ts")).toContain("indisponibilidadeNoPedido?: string | null;");
    expect(NOTA_DA_DATA_VAGA).toBe("Tem indisponibilidade nesses dias.");
  });
});
