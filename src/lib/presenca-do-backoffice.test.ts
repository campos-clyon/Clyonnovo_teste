import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FRASE_DA_TRANSPARENCIA,
  INTERVALO_DO_SINAL_MS,
  LIMITE_DE_INACTIVIDADE_MS,
  MINUTOS_SEM_INTERACCAO,
  diaDaPresenca,
  duracaoEscrita,
  oQueFazerComOSinal,
  resumoDaPresenca,
  segundosEntre,
  unirBlocos,
  type BlocoNaBase,
} from "./presenca-do-backoffice";
import { descricaoDaMarcacao, lerMarcacao, type MarcacaoNova } from "./agenda-das-assistentes";
import { MESES_DA_PRESENCA_NO_BACKOFFICE } from "./retencao";
import { assistenteComSeccoesPodeChamar, assistentePodeChamar, SECCOES_DO_ASSISTENTE } from "./papel-do-painel";

/**
 * A PRESENÇA E A AGENDA DAS ASSISTENTES — 31-10-2026 (ordem do CEO e do dono).
 *
 * «Apenas informação interna, para ter noção do tempo e da produtividade, sem
 * efeito nenhum.» O que estes testes guardam: o bloco fecha na última
 * interacção; 15 minutos sem nada não contam; o tempo escondido não conta;
 * vários separadores contam uma vez; só o administrador lê as horas; a
 * assistente só mexe na agenda dela; tudo em hora de Lisboa; 24 meses na purga.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

/* ── O navegador, de mentira: as mesmas regras do PresencaDoBackoffice ───── */

type Evento = { em: string; tipo: "interaccao" | "esconder" | "mostrar" };

/**
 * Os sinais que um separador manda: um por minuto enquanto está à vista (e
 * houve interacção há menos de 15 min), um logo na primeira interacção depois
 * de uma pausa, e um ao esconder. `desfasamento` é onde cai o relógio do minuto.
 */
function sinaisDoSeparador(eventos: Evento[], ate: string, desfasamentoS = 30): Array<{ em: number; ms: number }> {
  const t = (iso: string) => Date.parse(iso);
  const inicio = t(eventos[0].em);
  const fim = t(ate);
  const linha: Array<{ em: number; tipo: Evento["tipo"] | "minuto" }> = eventos.map((e) => ({ em: t(e.em), tipo: e.tipo }));
  for (let m = inicio + desfasamentoS * 1000; m <= fim; m += INTERVALO_DO_SINAL_MS) linha.push({ em: m, tipo: "minuto" });
  linha.sort((a, b) => a.em - b.em);

  let visivel = true;
  let ultima: number | null = null;
  let ultimoEnvio = 0;
  const sinais: Array<{ em: number; ms: number }> = [];
  const enviar = (agora: number) => {
    if (ultima === null || agora - ultima >= LIMITE_DE_INACTIVIDADE_MS) return;
    ultimoEnvio = agora;
    sinais.push({ em: agora, ms: agora - ultima });
  };
  for (const e of linha) {
    if (e.tipo === "interaccao") {
      const voltou = ultima === null || e.em - ultima >= LIMITE_DE_INACTIVIDADE_MS;
      ultima = e.em;
      if (voltou || e.em - ultimoEnvio >= INTERVALO_DO_SINAL_MS) enviar(e.em);
    } else if (e.tipo === "esconder") {
      visivel = false;
      enviar(e.em);
    } else if (e.tipo === "mostrar") {
      visivel = true;
    } else if (visivel) {
      enviar(e.em);
    }
  }
  return sinais;
}

/** O servidor, de mentira: aplica os sinais (de todos os separadores, pela ordem de chegada) aos blocos. */
function servidor(sinais: Array<{ em: number; ms: number }>): BlocoNaBase[] {
  const blocos: BlocoNaBase[] = [];
  for (const s of [...sinais].sort((a, b) => a.em - b.em)) {
    const ultimo = [...blocos].sort((a, b) => b.inicioEm.getTime() - a.inicioEm.getTime())[0] ?? null;
    const a = oQueFazerComOSinal(ultimo, { recebidoEm: new Date(s.em), msDesdeInteraccao: s.ms });
    if (a.tipo === "estender" && ultimo) {
      ultimo.fimEm = new Date(Math.max(ultimo.fimEm.getTime(), a.fimEm.getTime()));
      ultimo.ultimoSinalEm = new Date(Math.max(ultimo.ultimoSinalEm.getTime(), a.ultimoSinalEm.getTime()));
    } else if (a.tipo === "novo") {
      blocos.push({ inicioEm: a.inicioEm, fimEm: a.fimEm, ultimoSinalEm: a.ultimoSinalEm });
    }
  }
  return blocos;
}

const iso = (hhmmss: string, dia = "2026-11-03") => `${dia}T${hhmmss}Z`; // Inverno: Lisboa = UTC
const clique = (hhmmss: string): Evento => ({ em: iso(hhmmss), tipo: "interaccao" });
const intervalos = (b: BlocoNaBase[]) =>
  unirBlocos(b).map((x) => `${x.inicioEm.toISOString().slice(11, 19)}–${x.fimEm.toISOString().slice(11, 19)}`);
const total = (b: BlocoNaBase[]) =>
  segundosEntre(unirBlocos(b), new Date(iso("00:00:00")), new Date(iso("23:59:59")));

describe("o bloco fecha na hora da última interacção", () => {
  it("cliques às 10:00, 10:05 e 10:10, e depois nada: o bloco é 10:00–10:10, não até ao último sinal", () => {
    const sinais = sinaisDoSeparador([clique("10:00:00"), clique("10:05:00"), clique("10:10:00")], iso("10:40:00"));
    // O navegador continua a mandar até aos 15 minutos sem interacção…
    expect(Math.max(...sinais.map((s) => s.em))).toBeGreaterThan(Date.parse(iso("10:24:00")));
    expect(sinais.every((s) => s.ms < LIMITE_DE_INACTIVIDADE_MS)).toBe(true);
    // …mas esses minutos não contam.
    const blocos = servidor(sinais);
    expect(intervalos(blocos)).toEqual(["10:00:00–10:10:00"]);
    expect(total(blocos)).toBe(600);
  });

  it("um sinal sem interacção nova nunca puxa o fim do bloco para a frente", () => {
    const ultimo = { inicioEm: new Date(iso("10:00:00")), fimEm: new Date(iso("10:10:00")), ultimoSinalEm: new Date(iso("10:13:30")) };
    const a = oQueFazerComOSinal(ultimo, { recebidoEm: new Date(iso("10:14:30")), msDesdeInteraccao: 270_000 });
    expect(a.tipo === "estender" ? a.fimEm.toISOString() : null).toBe(iso("10:10:00").replace("Z", ".000Z"));
  });
});

describe(`${MINUTOS_SEM_INTERACCAO} minutos sem nada não contam`, () => {
  it("é uma constante fácil de mudar, e vale 15 minutos", () => {
    expect(MINUTOS_SEM_INTERACCAO).toBe(15);
    expect(LIMITE_DE_INACTIVIDADE_MS).toBe(15 * 60_000);
    expect(ler("src/lib/presenca-do-backoffice.ts")).toMatch(/^export const MINUTOS_SEM_INTERACCAO = 15;$/m);
  });

  it("um sinal com 15 minutos (ou mais) desde a última interacção não faz nada", () => {
    const ultimo = { inicioEm: new Date(iso("10:00:00")), fimEm: new Date(iso("10:10:00")), ultimoSinalEm: new Date(iso("10:24:30")) };
    expect(oQueFazerComOSinal(ultimo, { recebidoEm: new Date(iso("10:25:00")), msDesdeInteraccao: LIMITE_DE_INACTIVIDADE_MS }).tipo).toBe("nada");
    expect(oQueFazerComOSinal(null, { recebidoEm: new Date(iso("10:25:00")), msDesdeInteraccao: 20 * 60_000 }).tipo).toBe("nada");
  });

  it("10:00–10:10, meia hora parada, 10:40–10:50: dois blocos, 20 minutos, e a meia hora é uma ausência", () => {
    const sinais = sinaisDoSeparador(
      [clique("10:00:00"), clique("10:10:00"), clique("10:40:00"), clique("10:50:00")],
      iso("11:20:00"),
    );
    const blocos = servidor(sinais);
    expect(intervalos(blocos)).toEqual(["10:00:00–10:10:00", "10:40:00–10:50:00"]);
    expect(total(blocos)).toBe(1200);
    const dia = diaDaPresenca("2026-11-03", unirBlocos(blocos), []);
    expect(dia.ausencias.map((a) => [a.de.slice(11, 16), a.ate.slice(11, 16), a.minutos, a.aviso])).toEqual([
      ["10:10", "10:40", 30, "sem_aviso"],
    ]);
  });

  it("14 minutos a ler com a página à vista e um clique a seguir: conta", () => {
    const blocos = servidor(sinaisDoSeparador([clique("10:00:00"), clique("10:14:00")], iso("10:40:00")));
    expect(intervalos(blocos)).toEqual(["10:00:00–10:14:00"]);
  });
});

describe("o tempo escondido não conta", () => {
  it("clica, esconde o separador cinco minutos, volta e clica: dois blocos, sem o tempo escondido", () => {
    const sinais = sinaisDoSeparador(
      [
        clique("10:00:00"),
        clique("10:01:50"),
        { em: iso("10:02:00"), tipo: "esconder" },
        { em: iso("10:07:00"), tipo: "mostrar" },
        clique("10:09:00"),
        clique("10:12:00"),
      ],
      iso("10:40:00"),
    );
    // Escondido, não manda nada (ao voltar, os sinais com a interacção velha não fazem nada).
    expect(sinais.some((s) => s.em > Date.parse(iso("10:02:00")) && s.em < Date.parse(iso("10:07:00")))).toBe(false);
    expect(sinais.some((s) => s.em > Date.parse(iso("10:07:00")) && s.em < Date.parse(iso("10:09:00")))).toBe(true);
    const blocos = servidor(sinais);
    expect(intervalos(blocos)).toEqual(["10:00:00–10:01:50", "10:09:00–10:12:00"]);
    expect(total(blocos)).toBe(110 + 180);
  });

  it("o navegador só manda o sinal do minuto com a página à vista, e pára aos 15 minutos sem interacção", () => {
    const fonte = semComentarios(ler("src/components/admin/PresencaDoBackoffice.tsx"));
    expect(fonte).toContain('if (document.visibilityState === "visible") enviar();');
    expect(fonte).toContain("if (ms >= LIMITE_DE_INACTIVIDADE_MS) return;");
    expect(fonte).toContain('if (document.visibilityState === "hidden") enviar(true);');
    // Só o tempo desde a última interacção — nada do ecrã, nada das páginas.
    expect(fonte).toContain("body: JSON.stringify({ msDesdeInteraccao: Math.max(0, ms) })");
    // Só nas contas de assistente: o administrador não é contado.
    expect(fonte).toContain('if (papelGuardadoNoBrowser() !== "assistente") return;');
    expect(ler("src/app/admin/layout.tsx")).toContain("<PresencaDoBackoffice />");
  });
});

describe("vários separadores contam uma vez", () => {
  it("dois separadores à vista, com relógios desfasados: um bloco, os mesmos 10 minutos", () => {
    const a = sinaisDoSeparador([clique("10:00:00"), clique("10:05:00"), clique("10:10:00")], iso("10:40:00"), 30);
    const b = sinaisDoSeparador([clique("10:02:00")], iso("10:40:00"), 50);
    const blocos = servidor([...a, ...b]);
    expect(intervalos(blocos)).toEqual(["10:00:00–10:10:00"]);
    expect(total(blocos)).toBe(600);
  });

  it("dois blocos abertos no mesmo segundo (dois sinais em corrida) somam como um", () => {
    const um = { inicioEm: new Date(iso("10:00:00")), fimEm: new Date(iso("10:10:00")), ultimoSinalEm: new Date(iso("10:10:00")) };
    const outro = { ...um, fimEm: new Date(iso("10:08:00")) };
    expect(segundosEntre(unirBlocos([um, outro]), new Date(iso("00:00:00")), new Date(iso("23:59:59")))).toBe(600);
  });

  it("na base, estender nunca recua o fim (`GREATEST`), e um sinal repetido no mesmo minuto não grava", () => {
    const base = semComentarios(ler("src/lib/presenca-na-base.ts"));
    expect(base).toContain("SET fimEm = GREATEST(fimEm, ?), ultimoSinalEm = GREATEST(ultimoSinalEm, ?)");
    const ultimo = { inicioEm: new Date(iso("10:00:00")), fimEm: new Date(iso("10:05:00")), ultimoSinalEm: new Date(iso("10:05:10")) };
    expect(oQueFazerComOSinal(ultimo, { recebidoEm: new Date(iso("10:05:20")), msDesdeInteraccao: 20_000 }).tipo).toBe("nada");
  });
});

describe("hora de Lisboa", () => {
  it("no Verão, 23:30–00:30 em UTC é 00:30–01:30 em Lisboa: tudo no dia seguinte", () => {
    const b = [{ inicioEm: new Date("2026-07-14T23:30:00Z"), fimEm: new Date("2026-07-15T00:30:00Z") }];
    expect(diaDaPresenca("2026-07-14", b, []).segundos).toBe(0);
    expect(diaDaPresenca("2026-07-15", b, []).segundos).toBe(3600);
  });

  it("no Inverno, o mesmo bloco parte-se à meia-noite de Lisboa: meia hora em cada dia", () => {
    const b = [{ inicioEm: new Date("2026-11-02T23:30:00Z"), fimEm: new Date("2026-11-03T00:30:00Z") }];
    expect(diaDaPresenca("2026-11-02", b, []).segundos).toBe(1800);
    expect(diaDaPresenca("2026-11-03", b, []).segundos).toBe(1800);
  });

  it("a semana começa à segunda e o mês ao dia 1, contados em Lisboa", () => {
    const blocos: BlocoNaBase[] = [
      // Domingo 01/11 às 23:30 de Lisboa (Inverno, = UTC): da semana anterior, mas já de Novembro.
      { inicioEm: new Date("2026-11-01T23:00:00Z"), fimEm: new Date("2026-11-01T23:30:00Z"), ultimoSinalEm: new Date("2026-11-01T23:30:00Z") },
      // Terça 03/11.
      { inicioEm: new Date("2026-11-03T09:00:00Z"), fimEm: new Date("2026-11-03T10:00:00Z"), ultimoSinalEm: new Date("2026-11-03T10:00:00Z") },
    ];
    const r = resumoDaPresenca({ blocos, marcacoes: [], mes: "2026-11", agora: new Date("2026-11-03T12:00:00Z") });
    expect(r.totais).toEqual({ hoje: 3600, semana: 3600, mes: 5400 });
    expect(r.totalDoMes).toBe(5400);
    expect(r.semanas[0]).toEqual({ segunda: "2026-10-26", segundos: 1800 });
    expect(r.activaAgora).toBe(false);
  });

  it("as horas mostram-se pelo relógio de Lisboa no ecrã do administrador", () => {
    const painel = ler("src/components/admin/AdminPresencaPanel.tsx");
    expect(painel).toContain("horaEmLisboa(new Date(b.de))");
    expect(painel).not.toMatch(/\.get(Hours|Minutes|Date|Day)\(\)/);
  });
});

describe("ausências: avisou, avisou depois, ou sem aviso", () => {
  const blocos = unirBlocos([
    { inicioEm: new Date(iso("09:00:00")), fimEm: new Date(iso("11:00:00")) },
    { inicioEm: new Date(iso("11:40:00")), fimEm: new Date(iso("13:00:00")) },
    { inicioEm: new Date(iso("13:10:00")), fimEm: new Date(iso("14:00:00")) },
  ]);
  const parte = (criadaEm: string) => ({
    id: 1,
    tipo: "parte" as const,
    deDia: "2026-11-03",
    ateDia: "2026-11-03",
    deHora: "11:30",
    ateHora: "12:00",
    nota: null,
    criadaEm,
  });

  it("só os vãos de 15 minutos ou mais são ausências (os 10 minutos das 13:00 não)", () => {
    const d = diaDaPresenca("2026-11-03", blocos, []);
    expect(d.ausencias).toHaveLength(1);
    expect(d.ausencias[0].minutos).toBe(40);
    expect(d.segundos).toBe(2 * 3600 + 80 * 60 + 50 * 60);
  });

  it("marcada na agenda antes de sair: avisou; marcada já depois: avisou depois", () => {
    expect(diaDaPresenca("2026-11-03", blocos, [parte(iso("08:00:00"))]).ausencias[0].aviso).toBe("avisou");
    expect(diaDaPresenca("2026-11-03", blocos, [parte(iso("12:30:00"))]).ausencias[0].aviso).toBe("avisou_depois");
  });

  it("uma folga de dia inteiro cobre o dia todo; uma marcação noutro dia não conta", () => {
    const folga = { ...parte(iso("08:00:00")), tipo: "dia" as const, deHora: null, ateHora: null };
    expect(diaDaPresenca("2026-11-03", blocos, [folga]).ausencias[0].aviso).toBe("avisou");
    const outroDia = { ...folga, deDia: "2026-11-04", ateDia: "2026-11-04" };
    expect(diaDaPresenca("2026-11-03", blocos, [outroDia]).ausencias[0].aviso).toBe("sem_aviso");
  });
});

describe("a agenda: o que se pode marcar", () => {
  const hoje = "2026-10-31";

  it("os três tipos, com as horas em HH:MM", () => {
    expect(lerMarcacao({ tipo: "dia", deDia: "2026-11-02" }, hoje)).toMatchObject({ ok: true, marcacao: { ateDia: "2026-11-02", deHora: null } });
    expect(lerMarcacao({ tipo: "parte", deDia: "2026-11-02", deHora: "14:00" }, hoje)).toMatchObject({ ok: true, marcacao: { ateHora: null } });
    expect(lerMarcacao({ tipo: "parte", deDia: "2026-11-02", deHora: "14:00", ateHora: "16:30" }, hoje)).toMatchObject({ ok: true });
    expect(lerMarcacao({ tipo: "dias", deDia: "2026-11-02", ateDia: "2026-11-05", nota: "  férias \n " }, hoje)).toMatchObject({
      ok: true,
      marcacao: { nota: "férias" },
    });
  });

  it("recusa o que não se percebe", () => {
    expect(lerMarcacao({ tipo: "parte", deDia: "2026-11-02", deHora: "25:00" }, hoje).ok).toBe(false);
    expect(lerMarcacao({ tipo: "parte", deDia: "2026-11-02", deHora: "14:00", ateHora: "13:00" }, hoje).ok).toBe(false);
    expect(lerMarcacao({ tipo: "dias", deDia: "2026-11-05", ateDia: "2026-11-02" }, hoje).ok).toBe(false);
    expect(lerMarcacao({ tipo: "dia", deDia: "2026-04-31" }, hoje).ok).toBe(false);
    expect(lerMarcacao({ tipo: "ferias", deDia: "2026-11-02" }, hoje).ok).toBe(false);
  });

  it("escreve-se como se lê", () => {
    const m = (x: Partial<MarcacaoNova>): MarcacaoNova => ({ tipo: "dia", deDia: "2026-11-02", ateDia: "2026-11-02", deHora: null, ateHora: null, nota: null, ...x });
    expect(descricaoDaMarcacao(m({}))).toBe("Folga a 02/11");
    expect(descricaoDaMarcacao(m({ tipo: "parte", deHora: "14:00" }))).toBe("02/11 a partir das 14:00");
    expect(descricaoDaMarcacao(m({ tipo: "dias", ateDia: "2026-11-05" }))).toBe("De 02/11 a 05/11");
    expect(duracaoEscrita(3 * 3600 + 5 * 60)).toBe("3 h 05 min");
  });
});

describe("só o administrador lê as horas", () => {
  it("a rota das horas é só do administrador, e o assistente nem lá chega", () => {
    const rota = semComentarios(ler("src/app/api/admin/presenca/route.ts"));
    expect(rota).toContain("const { err } = await requireAdminGeral(req);");
    expect(rota).not.toMatch(/\brequireAdmin\(/);
    expect(assistentePodeChamar("/api/admin/presenca", "GET")).toBe(false);
    expect(assistenteComSeccoesPodeChamar([...SECCOES_DO_ASSISTENTE], "/api/admin/presenca", "GET")).toBe(false);
  });

  it("o sinal da assistente é dela (o id sai do token) e a resposta nunca traz horas", () => {
    const rota = semComentarios(ler("src/app/api/admin/sessao/presenca/route.ts"));
    expect(rota).toContain("await registarSinalDePresenca(colab.id, ms);");
    expect(rota).not.toMatch(/corpo\.(colaboradorId|id)\b/);
    expect(rota).toContain('if (colab.papel !== "assistente") return NextResponse.json({ ok: true, conta: false });');
    expect(rota).not.toMatch(/segundos|blocos|totais|resumoDaPresenca/);
  });

  it("o ecrã das horas está só na secção «Assistentes» do administrador; a agenda dela não as mostra", () => {
    const painel = ler("src/components/admin/LegacyAdminClient.tsx");
    const i = painel.indexOf('{activeSection === "equipa" && papel === "admin" && (');
    expect(i).toBeGreaterThan(-1);
    const j = painel.indexOf("<AdminPresencaPanel");
    expect(j).toBeGreaterThan(i);
    expect(painel.slice(i, j)).not.toMatch(/\{activeSection === "(?!equipa)/);
    expect(painel.match(/<AdminPresencaPanel/g)).toHaveLength(1);
    const agenda = ler("src/components/admin/MinhaAgenda.tsx");
    expect(agenda).not.toContain("/api/admin/presenca");
    expect(agenda).not.toMatch(/duracaoEscrita|segundos/);
  });

  it("a assistente é informada na conta dela", () => {
    expect(FRASE_DA_TRANSPARENCIA).toBe("O backoffice regista os períodos em que está activa, só como informação interna.");
    const painel = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(painel).toMatch(/papel === "assistente" && \(\s*<p[^>]*>\{FRASE_DA_TRANSPARENCIA\}<\/p>/);
  });
});

describe("o selo de «Assistentes»: uma marcação nova", () => {
  it("conta pela coluna que existe na tabela, e só o administrador o vê", () => {
    const db = semComentarios(ler("src/lib/db.ts"));
    expect(db).toContain("SELECT COUNT(*) AS n FROM ausenciasDosAssistentes WHERE actualizadaEm > ?");
    const criar = ler("src/lib/presenca-na-base.ts");
    const tabela = criar.slice(criar.indexOf("CREATE TABLE IF NOT EXISTS ausenciasDosAssistentes"));
    expect(tabela.slice(0, tabela.indexOf(") ENGINE"))).toMatch(/^\s*actualizadaEm\s+DATETIME NOT NULL,/m);
    const rota = semComentarios(ler("src/app/api/admin/novidades/route.ts"));
    expect(rota).toContain("contadas.equipa = 0;");
  });
});

/* ── A base, de mentira: regista o SQL ──────────────────────────────────── */

const base = { sql: [] as Array<{ sql: string; params: unknown[] }> };
vi.mock("mysql2/promise", () => ({
  default: {
    createPool: () => ({
      execute: async (sql: string, params: unknown[] = []) => {
        const limpo = sql.replace(/\s+/g, " ").trim();
        base.sql.push({ sql: limpo, params });
        if (limpo.startsWith("SELECT COUNT(*)")) return [[{ n: 2 }], []];
        if (limpo.startsWith("DELETE")) return [{ affectedRows: 3 }, []];
        if (limpo.startsWith("UPDATE")) return [{ affectedRows: 1 }, []];
        if (limpo.startsWith("INSERT")) return [{ insertId: 5 }, []];
        return [[], []];
      },
    }),
  },
}));

// Importar o db.ts leva uns segundos no meio da suite inteira: prazo largo.
const PRAZO = 120_000;

describe("a assistente só mexe na agenda dela", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://teste/teste";
    base.sql = [];
  });
  const marcacao: MarcacaoNova = { tipo: "dia", deDia: "2026-11-02", ateDia: "2026-11-02", deHora: null, ateHora: null, nota: null };

  it("alterar e apagar só tocam numa marcação com o id dela", async () => {
    const { alterarMarcacao, apagarMarcacao, agendaDe } = await import("./presenca-na-base");
    await alterarMarcacao(7, 99, marcacao);
    await apagarMarcacao(7, 99);
    await agendaDe(7);
    const escritas = base.sql.filter((s) => /^(UPDATE|DELETE) /.test(s.sql));
    expect(escritas).toHaveLength(2);
    for (const e of escritas) {
      expect(e.sql).toMatch(/WHERE id = \? AND colaboradorId = \?$/);
      expect(e.params.slice(-2)).toEqual([99, 7]);
    }
    const leitura = base.sql.find((s) => s.sql.includes("FROM ausenciasDosAssistentes WHERE colaboradorId = ?"));
    expect(leitura?.params).toEqual([7]);
  }, PRAZO);

  it("a rota tira a conta do token em todas as acções, e não é para o administrador", () => {
    const rota = semComentarios(ler("src/app/api/admin/sessao/agenda/route.ts"));
    for (const chamada of ["agendaDe(colab.id)", "apagarMarcacao(colab.id, id)", "criarMarcacao(colab.id,", "alterarMarcacao(colab.id, id,"]) {
      expect(rota, chamada).toContain(chamada);
    }
    expect(rota).not.toMatch(/corpo\??\.colaboradorId/);
    expect(rota).toContain('return papel === "assistente"');
  });
});

describe("a retenção: 24 meses", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://teste/teste";
    base.sql = [];
  });

  it("o prazo vive em retencao.ts", () => {
    expect(MESES_DA_PRESENCA_NO_BACKOFFICE).toBe(24);
  });

  it("a seco só conta; a sério apaga os blocos e as marcações com mais de 24 meses", async () => {
    const { purgarPresencaAntiga } = await import("./presenca-na-base");
    expect(await purgarPresencaAntiga(MESES_DA_PRESENCA_NO_BACKOFFICE, { aSerio: false })).toBe(4);
    expect(base.sql.some((s) => s.sql.startsWith("DELETE"))).toBe(false);
    base.sql = [];
    expect(await purgarPresencaAntiga(MESES_DA_PRESENCA_NO_BACKOFFICE, { aSerio: true })).toBe(6);
    expect(base.sql.map((s) => s.sql).filter((s) => s.startsWith("DELETE"))).toEqual([
      "DELETE FROM presencaNoBackoffice WHERE fimEm < NOW() - INTERVAL 24 MONTH LIMIT 5000",
      "DELETE FROM ausenciasDosAssistentes WHERE ateDia < DATE_FORMAT(NOW() - INTERVAL 24 MONTH, '%Y-%m-%d') LIMIT 5000",
    ]);
  }, PRAZO);

  it("corre na purga da noite, por passoSecundario, e conta para o «nada apagado»", () => {
    const rota = semComentarios(ler("src/app/api/cron/purgar-pedidos/route.ts"));
    const passo = rota.indexOf("purgarPresencaAntiga(MESES_DA_PRESENCA_NO_BACKOFFICE, { aSerio: armada })");
    expect(passo).toBeGreaterThan(rota.indexOf("purgarPedidosTerminados("));
    expect(rota.slice(passo - 200, passo)).toContain("passoSecundario(");
    const i = rota.search(/const nadaParaFazer =\r?\n\s*passosQueFalharam\.length === 0/);
    expect(rota.slice(i, i + 700)).toContain("presencaApagada === 0 &&");
  });
});
