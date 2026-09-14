import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aindaValeAPenaAlcancar,
  resumoDoAlcance,
  DIAS_PARA_ALCANCAR,
  NOVAS_POR_PASSAGEM,
  type PedidoParaAlcancar,
} from "./alcancar-pedidos";
import { DIAS_DE_RETENCAO_DOS_PEDIDOS } from "./retencao";

/**
 * OS PEDIDOS QUE FICARAM PARA TRÁS DE QUEM CHEGOU DEPOIS.
 *
 * "Os trabalhos colocados antes da conta ser criada continua a não aparecer
 * para eles mas devia. O Revolution por ex só recebeu 1 trabalho mas cumpre
 * todos os requisitos para receber todos." — 14-09-2026.
 *
 * A distribuição corria UMA VEZ, ao promover o pedido, e nunca mais. O painel
 * já sabia e já o dizia — no #316, «4 profissionais · 1 proposta» e ao lado
 * «Hoje chegaria a 5 de 9». O quinto era o Revolution. O sistema tinha a
 * resposta escrita no ecrã e não agia sobre ela.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const AGORA = new Date("2026-09-14T10:00:00.000Z");
const diasAtras = (d: number) => new Date(AGORA.getTime() - d * 86_400_000);

const ABERTO: PedidoParaAlcancar = {
  id: 316,
  status: null,
  temAcordo: false,
  criadoEm: diasAtras(2),
};

describe("o que ainda vale a pena alcançar", () => {
  it("um pedido aberto e recente, sim", () => {
    expect(aindaValeAPenaAlcancar(ABERTO, AGORA)).toBe(true);
  });

  /*
   * DEPOIS DE CONTRATADO, O TRABALHO É DE ALGUÉM.
   *
   * Mandá-lo a um profissional novo era pô-lo a orçamentar uma coisa que já
   * não está à venda — e a perder a manhã com ela.
   */
  it("com alguém contratado, não", () => {
    expect(aindaValeAPenaAlcancar({ ...ABERTO, temAcordo: true }, AGORA)).toBe(false);
  });

  it("cancelado, concluído ou arquivado, não", () => {
    for (const status of ["cancelado", "concluido", "arquivado"]) {
      expect(aindaValeAPenaAlcancar({ ...ABERTO, status }, AGORA)).toBe(false);
    }
  });

  it("um estado que não é de arrumação não o tira da lista", () => {
    // `pendente`, `atribuido`, `em_analise` — a mesa continua a mostrá-los.
    expect(aindaValeAPenaAlcancar({ ...ABERTO, status: "pendente" }, AGORA)).toBe(true);
  });
});

describe("até quando", () => {
  /*
   * O prazo é o da retenção porque depois dele o pedido já nem existe: a purga
   * apaga-o. Um limite mais curto seria uma segunda regra a decidir o que está
   * vivo, a discordar da primeira no dia em que uma delas mudasse.
   */
  it("o prazo é o da purga, e não um número novo", () => {
    expect(DIAS_PARA_ALCANCAR).toBe(DIAS_DE_RETENCAO_DOS_PEDIDOS);
  });

  it("dentro do prazo entra; passado, não", () => {
    expect(aindaValeAPenaAlcancar({ ...ABERTO, criadoEm: diasAtras(59) }, AGORA)).toBe(true);
    expect(aindaValeAPenaAlcancar({ ...ABERTO, criadoEm: diasAtras(61) }, AGORA)).toBe(false);
  });

  it("uma data ilegível não é ressuscitada às cegas", () => {
    expect(aindaValeAPenaAlcancar({ ...ABERTO, criadoEm: "isto-nao-e-uma-data" }, AGORA)).toBe(
      false,
    );
  });
});

describe("a passagem diz o que fez, e o que deixou por fazer", () => {
  it("sem nada novo, di-lo sem inventar trabalho", () => {
    expect(resumoDoAlcance({ vistos: 40, novas: 0, pedidosComNovidade: 0, porOlhar: 0, falhados: 0 }))
      .toBe("40 pedido(s) abertos revistos — ninguém novo era elegível.");
  });

  /*
   * UM TECTO SILENCIOSO LÊ-SE COMO «ESTAVA TUDO FEITO».
   *
   * Cada negociação nova é um email no telemóvel de um profissional. O tecto
   * existe para o primeiro dia não despejar a mesa inteira em cima de toda a
   * gente — mas o que ficou de fora tem de ser dito.
   */
  it("o que ficou para a passagem seguinte é anunciado", () => {
    const t = resumoDoAlcance({
      vistos: 120,
      novas: 120,
      pedidosComNovidade: 44,
      porOlhar: 17,
      falhados: 2,
    });
    expect(t).toContain("120 negociação(ões) nova(s) em 44 pedido(s)");
    expect(t).toContain("Ficaram 17 para a passagem seguinte");
    expect(t).toContain("2 falharam");
  });

  it("há tecto, e é um número escrito com uma razão", () => {
    expect(NOVAS_POR_PASSAGEM).toBeGreaterThan(0);
  });
});

describe("está ligado ao que já existe, e não é uma segunda distribuição", () => {
  const CORREDOR = ler("src/lib/correr-o-alcance.ts");
  const CRON = ler("src/app/api/cron/alcancar-pedidos/route.ts");
  const VERCEL = ler("vercel.json");
  const DB = ler("src/lib/db.ts");

  /*
   * `distribuirPedido` já salta quem tem negociação, já mede a distância de
   * cada profissional à base dele e já manda o email. Uma segunda distribuição
   * mais simples concordava com a primeira no primeiro dia e no segundo já não.
   */
  it("chama a distribuição de sempre em vez de a copiar", () => {
    expect(CORREDOR).toContain("distribuirPedido({");
    expect(CORREDOR).toContain("coordenadasDoPedido(pedido)");
    // As duas guardas que a rota de redistribuir também tem.
    expect(CORREDOR).toContain("pedido.valorDesejadoCliente == null");
  });

  it("a consulta só traz o que está mesmo aberto", () => {
    const i = DB.indexOf("export async function pedidosAbertosParaAlcancar");
    expect(i).toBeGreaterThan(-1);
    const q = DB.slice(i, i + 2200);
    expect(q).toContain("EXISTS (SELECT 1 FROM negociacoes n WHERE n.pedidoId = o.id)");
    expect(q).toContain("a.estado = 'acordada'");
    expect(q).toContain("'cancelado', 'concluido', 'arquivado'");
  });

  it("o histórico só é escrito quando alguma coisa chegou a alguém", () => {
    // Uma linha por noite a dizer «revisto, nada a fazer» enterrava as que
    // interessam debaixo de sessenta iguais.
    expect(CORREDOR).toContain("if (d.receberam > 0) {");
  });

  it("o cron falha fechado sem o segredo", () => {
    expect(CRON).toContain("const secret = process.env.CRON_SECRET;");
    expect(CRON).toContain('{ status: 503 }');
    expect(CRON).toContain('{ status: 401 }');
  });

  it("está agendado", () => {
    expect(VERCEL).toContain("/api/cron/alcancar-pedidos");
  });
});
