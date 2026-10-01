import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  andar,
  corDaPessoa,
  corDoServico,
  diasDaVista,
  dispor,
  inicioDaSemana,
  janelaDeHoras,
  periodoDaVista,
  proximoDepois,
  semanasDoMes,
  somarDias,
  tituloDoPeriodo,
  vistaValida,
} from "./agenda-em-grelha";

/**
 * AS CONTAS DA AGENDA EM GRELHA.
 *
 * "É possível melhorar essa agenda para ser mais profissional, como essa?" — e
 * a do backoffice "também". 01-10-2026. As duas agendas lêem destas funções;
 * se uma conta estiver errada aqui, está errada nas duas ao mesmo tempo, e é
 * por isso que se testam sem ecrã nenhum.
 *
 * As datas constroem-se com `new Date(ano, mês, dia)` — na hora local de quem
 * corre o teste —, como o ecrã as lê.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const dia = (a: number, m: number, d: number, h = 0, min = 0) => new Date(a, m - 1, d, h, min);
const iso = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

describe("a semana começa à segunda", () => {
  it("quinta, 1 de outubro de 2026, é da semana que começou a 28 de setembro", () => {
    expect(iso(inicioDaSemana(dia(2026, 10, 1, 15)))).toBe("2026-9-28");
  });

  it("e um domingo é o fim da semana dele, e não o princípio da seguinte", () => {
    /*
     * O exemplo do Google que veio na captura começava ao domingo — a conta
     * estava configurada para França. Em Portugal a semana é de segunda a
     * domingo, e o domingo 4 de outubro pertence à semana de 28 de setembro.
     */
    expect(iso(inicioDaSemana(dia(2026, 10, 4, 20)))).toBe("2026-9-28");
  });

  it("os sete dias da vista de semana, de segunda a domingo", () => {
    const dias = diasDaVista("semana", dia(2026, 10, 1)).map(iso);
    expect(dias).toEqual([
      "2026-9-28", "2026-9-29", "2026-9-30", "2026-10-1", "2026-10-2", "2026-10-3", "2026-10-4",
    ]);
  });
});

describe("as setas não tropeçam na mudança da hora", () => {
  it("a semana a seguir à do último domingo de outubro começa numa segunda", () => {
    /*
     * A 25 de outubro de 2026 o dia tem 25 horas. Somar 7 × 24 horas caía às 23h
     * do domingo — a semana seguinte começava num domingo, e a grelha mostrava
     * a semana errada a partir daí.
     */
    const seg = dia(2026, 10, 19);
    const seguinte = andar("semana", seg, 1);
    expect(iso(inicioDaSemana(seguinte))).toBe("2026-10-26");
    expect(iso(somarDias(dia(2026, 10, 25), 1))).toBe("2026-10-26");
  });

  it("e a de março também", () => {
    expect(iso(andar("semana", dia(2027, 3, 22), 1))).toBe("2027-3-29");
  });

  it("um mês para a frente a partir de 31 de janeiro é fevereiro, e não março", () => {
    expect(andar("mes", dia(2027, 1, 31), 1).getMonth()).toBe(1);
  });
});

describe("o título diz onde se está", () => {
  it("uma semana entre dois meses", () => {
    expect(tituloDoPeriodo("semana", dia(2026, 10, 1))).toBe("Set – out de 2026");
  });

  it("uma semana dentro de um mês", () => {
    expect(tituloDoPeriodo("semana", dia(2026, 10, 14))).toBe("Outubro de 2026");
  });

  it("uma semana entre dois anos", () => {
    expect(tituloDoPeriodo("semana", dia(2026, 12, 30))).toBe("Dez de 2026 – jan de 2027");
  });

  it("um dia e um mês", () => {
    expect(tituloDoPeriodo("dia", dia(2026, 10, 1))).toBe("Quinta-feira, 1 de outubro de 2026");
    expect(tituloDoPeriodo("mes", dia(2026, 10, 1))).toBe("Outubro de 2026");
  });
});

describe("o mês tem as semanas que precisa, e não seis sempre", () => {
  it("fevereiro de 2027 começa a uma segunda e cabe em quatro", () => {
    expect(semanasDoMes(dia(2027, 2, 10))).toHaveLength(4);
  });

  it("outubro de 2026 começa numa quinta e precisa de cinco", () => {
    const s = semanasDoMes(dia(2026, 10, 1));
    expect(s).toHaveLength(5);
    expect(iso(s[0][0])).toBe("2026-9-28");
    expect(iso(s[4][6])).toBe("2026-11-1");
  });
});

describe("as horas da grelha", () => {
  it("sem nada marcado, das 7 às 21", () => {
    expect(janelaDeHoras([])).toEqual({ de: 7, ate: 21 });
  });

  it("um trabalho às 6h abre a grelha às 6 — nunca se esconde um trabalho", () => {
    expect(janelaDeHoras([dia(2026, 10, 1, 6, 30)]).de).toBe(6);
  });

  it("um às 21h estica-a até às 23, que é onde o bloco de duas horas acaba", () => {
    expect(janelaDeHoras([dia(2026, 10, 1, 21)]).ate).toBe(23);
  });

  it("e não passa da meia-noite", () => {
    expect(janelaDeHoras([dia(2026, 10, 1, 23, 30)]).ate).toBe(24);
  });
});

describe("dois trabalhos à mesma hora ficam lado a lado", () => {
  const e = (id: string, de: number, ate: number) => ({ item: id, inicioMin: de, fimMin: ate });

  it("às 9h e às 9h30, duas colunas", () => {
    const r = dispor([e("a", 540, 660), e("b", 570, 690)]);
    const a = r.find((x) => x.item === "a")!;
    const b = r.find((x) => x.item === "b")!;
    expect(a.colunas).toBe(2);
    expect(b.colunas).toBe(2);
    expect(a.coluna).not.toBe(b.coluna);
  });

  it("um a seguir ao outro, sem se tocarem, ficam cada um com a largura toda", () => {
    const r = dispor([e("a", 540, 660), e("b", 660, 780)]);
    expect(r.every((x) => x.colunas === 1 && x.coluna === 0)).toBe(true);
  });

  it("três em cadeia: o primeiro e o terceiro não se tocam, e partilham uma coluna", () => {
    /*
     * 9h–11h, 10h–12h e 11h–13h. O terceiro já pode ir para a coluna do
     * primeiro, que acabou às 11h — são duas colunas, e não três.
     */
    const r = dispor([e("a", 540, 660), e("b", 600, 720), e("c", 660, 780)]);
    expect(r.every((x) => x.colunas === 2)).toBe(true);
    expect(r.find((x) => x.item === "c")!.coluna).toBe(r.find((x) => x.item === "a")!.coluna);
  });

  it("ninguém fica de fora", () => {
    const entradas = [e("a", 540, 660), e("b", 540, 660), e("c", 540, 660), e("d", 900, 1020)];
    expect(dispor(entradas)).toHaveLength(4);
  });
});

describe("o período à vista e o próximo trabalho", () => {
  it("a semana vai de segunda à meia-noite até à segunda seguinte, exclusive", () => {
    const p = periodoDaVista("semana", dia(2026, 10, 1))!;
    expect(iso(p.de)).toBe("2026-9-28");
    expect(iso(p.ate)).toBe("2026-10-5");
  });

  it("a lista não tem período — mostra tudo", () => {
    expect(periodoDaVista("lista", dia(2026, 10, 1))).toBeNull();
  });

  it("o próximo é o mais cedo depois do fim do período", () => {
    const r = proximoDepois([dia(2026, 10, 20), dia(2026, 10, 8, 9), dia(2026, 9, 1)], dia(2026, 10, 5));
    expect(r && iso(r)).toBe("2026-10-8");
  });
});

describe("as cores", () => {
  it("a mesma pessoa tem sempre a mesma cor — hoje, amanhã, com ou sem filtro", () => {
    expect(corDaPessoa(12)).toEqual(corDaPessoa(12));
    expect(corDaPessoa(12)).not.toEqual(corDaPessoa(13));
  });

  it("um serviço que não se conhece não parte nada", () => {
    expect(corDoServico("servico_que_nao_existe").bloco).toContain("slate");
    expect(corDoServico(null).bloco).toContain("slate");
  });

  it("⚠️ e nenhuma tem a palavra «bg-cyan-», que o globals.css apanha", () => {
    /*
     * O `globals.css` impõe a cor do texto aos botões ciano: branco no
     * `bg-cyan-600`/`700`, a cor da marca no `bg-cyan-50`. Os blocos desta
     * grelha são botões e escolhem a sua própria cor — o bloco claro quer
     * texto quase preto sobre `cyan-50`, e a regra pô-lo-ia azul-petróleo.
     *
     * Até 01-10-2026 era pior: a regra procurava um PEDAÇO da classe e apanhava
     * qualquer «bg-cyan-» (no escuro, o número do dia de hoje ficava branco
     * sobre ciano). Isso foi corrigido no globals.css (`globals-ciano.test.ts`),
     * mas o motivo acima chega para o ciano ficar aqui em hexadecimal.
     */
    for (const f of ["src/lib/agenda-em-grelha.ts", "src/components/GrelhaDeAgenda.tsx"]) {
      const codigo = ler(f)
        .split("\n")
        .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
        .join("\n");
      expect(codigo, f).not.toMatch(/bg-cyan-\d/);
    }
  });
});

describe("as vistas", () => {
  it("só as quatro que existem", () => {
    for (const v of ["dia", "semana", "mes", "lista"]) expect(vistaValida(v)).toBe(true);
    for (const v of ["", "ano", null, 3, "Semana"]) expect(vistaValida(v)).toBe(false);
  });
});

describe("as duas agendas usam a MESMA grelha", () => {
  /*
   * Uma grelha do profissional e outra do backoffice escritas à parte
   * divergiam no dia em que alguém corrigisse uma — e a semana de um passava a
   * não ser a semana do outro.
   */
  it("o painel do profissional", () => {
    const pro = ler("src/app/profissionais/painel/Agenda.tsx");
    expect(pro).toContain('from "@/components/GrelhaDeAgenda"');
    expect(pro).toContain('tema="claro"');
  });

  it("e o backoffice", () => {
    const admin = ler("src/components/admin/AdminAgendaPanel.tsx");
    expect(admin).toContain('from "@/components/GrelhaDeAgenda"');
    expect(admin).toContain('tema="escuro"');
    /* Lá, a cor diz o profissional — a pergunta é «quem está onde». */
    expect(admin).toContain("corDaPessoa(t.providerId)");
  });

  it("e nenhuma perdeu a lista — é a quarta vista", () => {
    const pro = ler("src/app/profissionais/painel/Agenda.tsx");
    const admin = ler("src/components/admin/AdminAgendaPanel.tsx");
    expect(pro).toContain('vista === "lista"');
    expect(admin).toContain('vista !== "lista"');
  });

  it("e no profissional, tocar num bloco abre o cartão de sempre, com todas as acções", () => {
    const pro = ler("src/app/profissionais/painel/Agenda.tsx");
    expect(pro).toContain("onAbrir={setAberto}");
    expect(pro).toContain("cartao(pAberto,");
    expect(pro).toContain('role="dialog"');
  });
});
