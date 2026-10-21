import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { choquesDoProfissional, textoDosChoques, type Marcacao } from "./choques-de-agenda";

/**
 * O PROFISSIONAL JÁ TEM UM TRABALHO A ESSA HORA — 21-10-2026. *«Coloque em
 * vermelho somente os que já têm um agendamento para aquela data e aquele
 * horário.»* — o dono, ao escolher quem faz o #476.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
// Sexta, 23/10, 15:40 em Lisboa (UTC+1).
const ALVO = { pedidoId: 476, inicio: new Date("2026-10-23T14:40:00Z") };
const m = (pedidoId: number, iso: string, duracaoMin: number | null = null, providerId = 7): Marcacao => ({
  pedidoId,
  providerId,
  inicio: new Date(iso),
  duracaoMin,
});

describe("o choque", () => {
  it("outro trabalho dele que se sobrepõe (duas horas, a da Agenda) choca", () => {
    // 14:00–16:00 em Lisboa sobrepõe-se a 15:40–17:40.
    expect(choquesDoProfissional(ALVO, 7, [m(462, "2026-10-23T13:00:00Z")])).toEqual([
      { pedidoId: 462, inicio: "2026-10-23T13:00:00.000Z" },
    ]);
    // 17:00 em Lisboa começa antes de o #476 acabar.
    expect(choquesDoProfissional(ALVO, 7, [m(463, "2026-10-23T16:00:00Z")])).toHaveLength(1);
  });

  it("encostado não choca: um acaba quando o outro começa", () => {
    // 13:40–15:40 em Lisboa acaba às 15:40.
    expect(choquesDoProfissional(ALVO, 7, [m(1, "2026-10-23T12:40:00Z")])).toEqual([]);
    // 17:40 em Lisboa começa quando o #476 acaba.
    expect(choquesDoProfissional(ALVO, 7, [m(2, "2026-10-23T16:40:00Z")])).toEqual([]);
  });

  it("conta a duração que se arrastou na Agenda", () => {
    // 10:00 com 6 horas vai até às 16:00 em Lisboa — choca; com as duas de sempre, não.
    expect(choquesDoProfissional(ALVO, 7, [m(3, "2026-10-23T09:00:00Z", 360)])).toHaveLength(1);
    expect(choquesDoProfissional(ALVO, 7, [m(3, "2026-10-23T09:00:00Z")])).toEqual([]);
  });

  it("só dele, nunca o próprio pedido, e só com hora dos dois lados", () => {
    expect(choquesDoProfissional(ALVO, 7, [m(9, "2026-10-23T14:00:00Z", null, 8)])).toEqual([]);
    expect(choquesDoProfissional(ALVO, 7, [m(476, "2026-10-23T14:40:00Z")])).toEqual([]);
    // «Só o dia» (00:00 em Lisboa) não diz a que horas.
    expect(choquesDoProfissional(ALVO, 7, [m(10, "2026-10-22T23:00:00Z")])).toEqual([]);
    expect(choquesDoProfissional({ pedidoId: 476, inicio: new Date("2026-10-22T23:00:00Z") }, 7, [m(11, "2026-10-23T09:00:00Z")])).toEqual([]);
    expect(choquesDoProfissional({ pedidoId: 476, inicio: null }, 7, [m(12, "2026-10-23T14:00:00Z")])).toEqual([]);
  });

  it("diz qual e a que horas, em Lisboa", () => {
    expect(textoDosChoques([{ pedidoId: 462, inicio: "2026-10-23T13:00:00.000Z" }])).toBe("já tem o #462 às 14:00");
  });
});

describe("onde aparece", () => {
  it("nos de valor fixo, na lista de quem aceitou; e nas negociações, no «Aceitar»", () => {
    const T = ler("src/components/admin/TrabalhoClyon.tsx");
    expect(T).toContain('<span className="text-sm font-semibold text-red-400" title="Já tem um trabalho a essa hora — escolha outro">');
    expect(ler("src/app/api/admin/trabalhos-clyon/route.ts")).toContain(
      "choquesDoProfissional({ pedidoId: o.pedidoId, inicio: o.dataAgendada }, n.providerId, marcacoes)",
    );
    const M = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(M).toContain('negociacao.choques?.length ? "bg-red-700 hover:bg-red-600" : "bg-emerald-700 hover:bg-emerald-600"');
    expect(ler("src/app/api/admin/negociacoes/route.ts")).toContain("comOsChoquesDaAgenda(await pedidosComNegociacoes(");
  });

  it("as marcações são os trabalhos contratados, não cancelados nem arquivados, de ontem para a frente", () => {
    const DB = ler("src/lib/db.ts");
    const f = DB.slice(DB.indexOf("export async function marcacoesDosProfissionais("));
    expect(f).toContain("WHERE n.estado = 'acordada'");
    expect(f).toContain("NOT IN ${ESTADOS_QUE_TIRAM_DOS_PROS_SQL}");
    expect(f).toContain("COALESCE(n.dataCombinada, o.dataAgendada) >= NOW() - INTERVAL 1 DAY");
  });
});
