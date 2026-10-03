import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DURACAO_PADRAO_MIN,
  duracaoDoArrasto,
  duracaoPorExtenso,
  duracaoValida,
  janelaDeHoras,
} from "./agenda-em-grelha";

/**
 * A DURAÇÃO DE UM TRABALHO, PUXANDO A BORDA DE BAIXO DO BLOCO — 03-10-2026.
 *
 * *«Deixe eu mudar o tempo estimado para realizar o trabalho, ex. o da Irene
 * eram 4 horas.»* Perguntado como e quem: arrastar a borda; o profissional e a
 * CLYON. Sem nada gravado, continuam a ser as duas horas do costume.
 */

const ALTURA = 48; // píxeis por hora, para as contas

describe("as contas da borda", () => {
  it("a altura passa a minutos, encaixada ao quarto de hora", () => {
    // 4 horas = 192 px; 4 h 07 arredonda para 4 h 15... 4 h 05 para 4 h.
    expect(duracaoDoArrasto({ px: 4 * ALTURA, inicioMin: 9 * 60, alturaDaHora: ALTURA })).toBe(240);
    expect(duracaoDoArrasto({ px: 4 * ALTURA + 4, inicioMin: 9 * 60, alturaDaHora: ALTURA })).toBe(240);
    expect(duracaoDoArrasto({ px: 4 * ALTURA + 10, inicioMin: 9 * 60, alturaDaHora: ALTURA })).toBe(255);
  });

  it("nunca menos de meia hora, nem mais de doze", () => {
    expect(duracaoDoArrasto({ px: 2, inicioMin: 9 * 60, alturaDaHora: ALTURA })).toBe(30);
    expect(duracaoDoArrasto({ px: -50, inicioMin: 9 * 60, alturaDaHora: ALTURA })).toBe(30);
    expect(duracaoDoArrasto({ px: 20 * ALTURA, inicioMin: 6 * 60, alturaDaHora: ALTURA })).toBe(720);
  });

  it("e não passa da meia-noite do próprio dia", () => {
    expect(duracaoDoArrasto({ px: 5 * ALTURA, inicioMin: 21 * 60, alturaDaHora: ALTURA })).toBe(180);
  });

  it("só se grava uma duração inteira, no passo e dentro dos limites", () => {
    expect(duracaoValida(240)).toBe(true);
    expect(duracaoValida(30)).toBe(true);
    expect(duracaoValida(720)).toBe(true);
    for (const mau of [0, 15, 241, 735, 90.5, "240", null, Number.NaN]) {
      expect(duracaoValida(mau), String(mau)).toBe(false);
    }
  });

  it("lê-se de relance", () => {
    expect(duracaoPorExtenso(240)).toBe("4 h");
    expect(duracaoPorExtenso(90)).toBe("1 h 30");
    expect(duracaoPorExtenso(45)).toBe("45 min");
  });

  it("a janela de horas cresce com a duração de cada trabalho", () => {
    const d = (h: number) => new Date(2026, 9, 3, h, 0);
    // Às 19h com duas horas cabe nas 21; com quatro horas estica até às 23.
    expect(janelaDeHoras([d(19)]).ate).toBe(21);
    expect(janelaDeHoras([d(19)], [240]).ate).toBe(23);
    expect(janelaDeHoras([d(9), d(19)], [DURACAO_PADRAO_MIN, 240]).ate).toBe(23);
  });
});

describe("o caminho até à base", () => {
  const ler = (p: string) =>
    readFileSync(join(process.cwd(), p), "utf8").replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "");
  const DB = ler("src/lib/db.ts");
  const PRO = ler("src/app/api/profissionais/agenda/duracao/route.ts");
  const ADMIN = ler("src/app/api/admin/agenda/duracao/route.ts");

  it("a coluna nasce vazia — vazia é «as duas horas do costume»", () => {
    expect(DB).toContain("ALTER TABLE negociacoes ADD COLUMN duracaoMinutos SMALLINT NULL DEFAULT NULL");
  });

  it("o profissional só muda a dos trabalhos dele", () => {
    expect(PRO).toContain("WHERE id = ? AND providerId = ? LIMIT 1");
    expect(PRO).toContain(
      '"UPDATE negociacoes SET duracaoMinutos = ? WHERE id = ? AND providerId = ?"',
    );
  });

  it("as duas rotas validam, e não mexem num trabalho confirmado ou pago", () => {
    for (const rota of [PRO, ADMIN]) {
      expect(rota).toContain("if (!duracaoValida(minutos))");
      expect(rota).toContain('linha.estado !== "acordada"');
      expect(rota).toContain("linha.confirmadoEm || linha.pagoEm");
    }
    expect(ADMIN).toContain("await requireAdmin(req)");
  });

  it("trocar a empresa leva a duração com o dia", () => {
    expect(DB).toContain("dataCombinada = ?, duracaoMinutos = ?,");
    expect(DB).toContain("antes.duracaoMinutos ?? null,");
  });
});

describe("a grelha e as duas agendas", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const GRELHA = ler("src/components/GrelhaDeAgenda.tsx");
  const PRO = ler("src/app/profissionais/painel/Agenda.tsx");
  const ADMIN = ler("src/components/admin/AdminAgendaPanel.tsx");

  it("a borda não começa um arrasto do bloco, e não funciona com o dedo", () => {
    const i = GRELHA.indexOf("function useEsticar(");
    expect(i).toBeGreaterThan(-1);
    const corpo = GRELHA.slice(i, GRELHA.indexOf("export function GrelhaDeAgenda(", i));
    expect(corpo).toContain('e.pointerType === "touch"');
    expect(corpo).toContain("e.stopPropagation();");
    expect(corpo).toContain("if (minutos !== antes) onDuracao(ev.id, minutos);");
  });

  it("o bloco tem a altura da duração dele", () => {
    expect(GRELHA).toContain("fimMin: Math.min(24 * 60, m + duracaoVista(e))");
    expect(GRELHA).not.toContain("m + DURACAO_PADRAO_MIN");
  });

  it("as duas agendas gravam ao largar — e só um sítio fala com cada rota", () => {
    expect(PRO).toContain("onDuracao={(id, minutos) => void esticarPorArrasto(id, minutos)}");
    expect(PRO).toContain("await gravarADuracao(id, minutos)");
    expect(ler("src/app/profissionais/painel/MarcarODia.tsx")).toContain(
      'fetch("/api/profissionais/agenda/duracao"',
    );
    expect(ADMIN).toContain("onDuracao={(id, minutos) => void esticarPorArrasto(id, minutos)}");
    expect(ADMIN).toContain("await gravarDuracaoNoBackoffice(token, id, minutos)");
    expect(ler("src/components/admin/FichaDaAgenda.tsx")).toContain(
      'fetch("/api/admin/agenda/duracao"',
    );
    // As agendas não falam com as rotas directamente.
    expect(PRO).not.toContain("fetch(");
  });

  it("e o calendário do telemóvel recebe a mesma duração", () => {
    expect(PRO).toContain("(p.duracaoMinutos ?? DURACAO_PADRAO_MIN) * 60_000");
  });
});
