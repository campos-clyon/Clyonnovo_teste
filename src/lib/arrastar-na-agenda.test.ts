import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALTURA_DA_HORA,
  PASSO_DO_ARRASTO,
  chaveDoDia,
  horaNoAlvo,
  instanteDaChave,
} from "./agenda-em-grelha";
import { doRelogioDeLisboa, noRelogioDeLisboa } from "./hora-de-lisboa";

/**
 * ARRASTAR UM TRABALHO PARA OUTRO DIA, E GRAVAR AO LARGAR.
 *
 * "Quero também poder puxar/arrastar esses agendamentos para mudar sua data e
 * horário como na agenda e eles salvarem automático ao soltar." — 01-10-2026,
 * para a agenda do profissional e para a do backoffice.
 *
 * E a descoberta do mesmo dia: o computador do dono está em hora de França
 * (UTC+2). A grelha trabalha no relógio de Lisboa (`noRelogioDeLisboa`, à
 * entrada — commit «fuso: o site inteiro à hora de Lisboa»), e o arrasto faz o
 * caminho de volta ao gravar (`doRelogioDeLisboa`). Os testes destas contas não
 * dependem do fuso de quem os corre.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/* Só os comentários que começam a linha — um `image/*` dentro de um texto não é um. */
function semNotas(s: string): string {
  return s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
}

const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

describe("as contas do arrasto", () => {
  it("a chave do dia é o dia da parede, e volta a dar o mesmo instante", () => {
    const d = new Date(2026, 9, 3, 14, 30);
    expect(chaveDoDia(d)).toBe("2026-10-03");
    const de = instanteDaChave("2026-10-03", 14 * 60 + 30);
    expect(de?.getTime()).toBe(d.getTime());
  });

  it("uma chave estragada não dá data nenhuma", () => {
    expect(instanteDaChave("ontem", 600)).toBeNull();
  });

  it("encaixa de quarto em quarto de hora", () => {
    expect(PASSO_DO_ARRASTO).toBe(15);
    const janela = { de: 7, ate: 21 };
    /* 14:07 → 14:00; 14:08 → 14:15 */
    const y = (min: number) => 10 + ((min - 7 * 60) / 60) * ALTURA_DA_HORA;
    expect(horaNoAlvo({ y: y(14 * 60 + 7), margem: 10, janela, agarraMin: 0 })).toBe(14 * 60);
    expect(horaNoAlvo({ y: y(14 * 60 + 8), margem: 10, janela, agarraMin: 0 })).toBe(14 * 60 + 15);
  });

  it("conta com o sítio onde o bloco foi agarrado", () => {
    const janela = { de: 7, ate: 21 };
    const y = 10 + 7 * ALTURA_DA_HORA; /* o rato está nas 14:00 */
    /* agarrado 30 minutos abaixo do início: o trabalho começa às 13:30 */
    expect(horaNoAlvo({ y, margem: 10, janela, agarraMin: 30 })).toBe(13 * 60 + 30);
  });

  it("não deixa largar fora da janela de horas", () => {
    const janela = { de: 7, ate: 21 };
    expect(horaNoAlvo({ y: -500, margem: 10, janela, agarraMin: 0 })).toBe(7 * 60);
    expect(horaNoAlvo({ y: 99999, margem: 10, janela, agarraMin: 0 })).toBe(21 * 60 - PASSO_DO_ARRASTO);
  });
});

describe("o relógio de Lisboa, à ida e à volta do arrasto", () => {
  it("no Verão, 13:00 UTC são 14:00 em Lisboa", () => {
    const parede = noRelogioDeLisboa(new Date("2026-10-03T13:00:00Z"));
    expect(chaveDoDia(parede)).toBe("2026-10-03");
    expect(hm(parede)).toBe("14:00");
  });

  it("no Inverno, Lisboa está em UTC", () => {
    const parede = noRelogioDeLisboa(new Date("2026-12-10T14:00:00Z"));
    expect(hm(parede)).toBe("14:00");
  });

  it("perto da meia-noite, o dia também é o de Lisboa", () => {
    /* 23:30 UTC de 3 de Outubro já é dia 4 em Lisboa */
    expect(chaveDoDia(noRelogioDeLisboa(new Date("2026-10-03T23:30:00Z")))).toBe("2026-10-04");
  });

  it("largar às 14:00 de Lisboa grava o instante certo, seja qual for o fuso deste computador", () => {
    expect(doRelogioDeLisboa(new Date(2026, 9, 3, 14, 0))?.toISOString()).toBe("2026-10-03T13:00:00.000Z");
    expect(doRelogioDeLisboa(new Date(2026, 11, 10, 14, 0))?.toISOString()).toBe("2026-12-10T14:00:00.000Z");
  });

  it("ida e volta dá o mesmo instante", () => {
    for (const iso of ["2026-01-15T08:45:00Z", "2026-07-01T19:15:00Z", "2026-10-03T13:00:00Z"]) {
      const de = new Date(iso);
      expect(doRelogioDeLisboa(noRelogioDeLisboa(de))?.getTime()).toBe(de.getTime());
    }
  });
});

describe("a grelha arrasta", () => {
  const GRELHA = semNotas(ler("src/components/GrelhaDeAgenda.tsx"));

  it("só com o rato ou a caneta — no telemóvel o dedo faz deslizar a página", () => {
    expect(GRELHA).toContain('e.pointerType === "touch"');
  });

  it("os trabalhos fixos não se agarram", () => {
    expect(GRELHA).toMatch(/ev\.fixo/);
    expect(GRELHA).toMatch(/!e\.fixo/);
  });

  it("o clique que o browser dispara ao largar não abre o cartão", () => {
    expect(GRELHA).toContain("engolirClique");
  });

  it("o Escape a meio cancela", () => {
    expect(GRELHA).toContain('k.key === "Escape"');
  });

  it("as colunas e as casas do mês dizem que dia são", () => {
    expect(GRELHA.match(/data-dia=\{chave\}/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("as duas agendas gravam ao largar, em hora de Lisboa", () => {
  const PRO = semNotas(ler("src/app/profissionais/painel/Agenda.tsx"));
  const ADMIN = semNotas(ler("src/components/admin/AdminAgendaPanel.tsx"));

  it.each([
    ["do profissional", PRO],
    ["do backoffice", ADMIN],
  ])("a agenda %s converte ao entrar e ao gravar", (_n, src) => {
    expect(src).toContain("onMover=");
    expect(src).toMatch(/const inicio = noRelogioDeLisboa\(new Date\(movidos\[/);
    expect(src).toMatch(/useState\(\(\) => noRelogioDeLisboa\(new Date\(\)\)\)/);
    /* `useAgora` já devolve o relógio de Lisboa: convertê-lo outra vez punha o «agora» fora do sítio. */
    expect(src).not.toMatch(/noRelogioDeLisboa\(useAgora\(\)\)/);
    expect(src).toContain("doRelogioDeLisboa(parede)");
  });

  it("o profissional grava pela mesma função do «Mudar o dia ou a hora»", () => {
    expect(PRO).toContain("gravarODia(id, novo.toISOString())");
    expect(PRO).not.toContain("fetch(");
  });

  it("o backoffice grava pela mesma função da ficha, e os feitos não se movem", () => {
    expect(ADMIN).toContain("gravarDiaNoBackoffice(token, id, novo)");
    expect(ADMIN).toContain('fixo: t.estado === "feito"');
  });

  it("a legenda das pessoas conta o período em hora de Lisboa", () => {
    expect(ADMIN).toContain("const d = noRelogioDeLisboa(new Date(t.quando));");
  });

  it("há um só sítio que fala com cada rota", () => {
    const fala = (rota: string) =>
      [
        "src/app/profissionais/painel/Agenda.tsx",
        "src/app/profissionais/painel/MarcarODia.tsx",
        "src/components/admin/AdminAgendaPanel.tsx",
        "src/components/admin/FichaDaAgenda.tsx",
      ].filter((f) => semNotas(ler(f)).includes(`fetch("${rota}", {\n      method: "POST"`));
    expect(fala("/api/profissionais/agenda")).toEqual(["src/app/profissionais/painel/MarcarODia.tsx"]);
    expect(fala("/api/admin/agenda")).toEqual(["src/components/admin/FichaDaAgenda.tsx"]);
  });
});

describe("os levantamentos arrumados", () => {
  const ECRA = semNotas(ler("src/components/admin/AdminLevantamentosPanel.tsx"));

  it("filtram com as mesmas peças dos pagamentos", () => {
    expect(ECRA).toContain('from "@/lib/filtros-dos-pagamentos"');
    for (const peca of ["PERIODOS", "intervaloDoPeriodo", "dentroDoIntervalo", "agrupar"]) {
      expect(ECRA).toContain(peca);
    }
  });

  it("separam o que falta transferir do que já saiu e do recusado", () => {
    expect(ECRA).toMatch(/type Separador = "pedido" \| "pago" \| "recusado"/);
  });

  it("perguntam antes de dar por transferido", () => {
    const i = ECRA.indexOf("async function processar");
    const corpo = ECRA.slice(i, ECRA.indexOf("setOcupado(l.id)", i));
    expect(corpo).toContain('estado === "pago"');
    expect(corpo).toContain("window.confirm(");
    expect(corpo).toContain("PRIMEIRO no banco");
  });
});
