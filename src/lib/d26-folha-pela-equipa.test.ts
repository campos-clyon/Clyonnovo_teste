import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A FOLHA PREENCHIDA PELA EQUIPA — d26, 15-11-2026 (ordem do CEO com o sim do dono).
 *
 *   1. O quadro «Folha do trabalho» aparece num trabalho à hora mesmo sem horas
 *      (na Mesa e no cartão dos Trabalhos CLYON).
 *   2. A conta é a MESMA da app: a folha da mudança sai de `lerFolha` /
 *      `enviarAFolha`, e as outras de horas × valor por hora + material.
 *   3. No histórico fica «preenchida pela equipa (<nome>), a pedido do
 *      profissional»; o cliente lê «a pedido do parceiro».
 *   4. «Já está feito» num trabalho à hora exige a folha preenchida.
 *   5. «Validada pelo cliente por telefone» confirma em nome do cliente.
 *
 * Com a base e os avisos fingidos.
 */

const estado = vi.hoisted(() => ({
  tarifaJson: null as string | null,
  folhasGravadas: [] as unknown[][],
  horasGravadas: [] as unknown[][],
  historico: [] as Array<{ id: number; message: string; by: unknown }>,
  registos: [] as Array<Record<string, unknown>>,
}));

vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(() => {}),
}));
vi.mock("@/lib/db", () => ({
  appendOrderHistory: vi.fn(async (id: number, h: { message: string; by: unknown }) => {
    estado.historico.push({ id, message: h.message, by: h.by });
  }),
  registarSemFalhar: vi.fn(async (r: Record<string, unknown>) => {
    estado.registos.push(r);
  }),
  folhaDaNegociacao: vi.fn(async (id: number) =>
    estado.tarifaJson == null
      ? null
      : {
          id,
          pedidoId: 612,
          providerId: 7,
          estado: "acordada",
          tarifaCongeladaJson: estado.tarifaJson,
          pessoasEscolhidas: 2,
          taxaCliente: 0,
          folhaJson: null,
          folhaHistoricoJson: null,
          folhaNaMesaEm: null,
          horasContestadasEm: null,
          kmPercurso: "20",
        },
  ),
  gravarFolhaDoTrabalho: vi.fn(async (...a: unknown[]) => {
    estado.folhasGravadas.push(a);
    return true;
  }),
  gravarHorasDoTrabalho: vi.fn(async (...a: unknown[]) => {
    estado.horasGravadas.push(a);
    return true;
  }),
  confirmarHorasDoTrabalho: vi.fn(async () => true),
  contestarHorasDoTrabalho: vi.fn(async () => true),
  gravarRascunhoDaFolha: vi.fn(async () => true),
  folhasPorResponder: vi.fn(async () => []),
  marcarPassoDaFolha: vi.fn(async () => true),
  negociacaoNoTerreno: vi.fn(async () => null),
  negociacoesDoProfissional: vi.fn(async () => []),
}));
vi.mock("@/lib/avisos-ao-cliente", () => ({ avisarOClienteDoPedido: vi.fn(async () => {}) }));
vi.mock("@/lib/avisos-do-terreno", () => ({ avisarClienteDasHoras: vi.fn(async () => {}) }));
vi.mock("@/lib/avisos-do-backoffice", () => ({ avisarProfissional: vi.fn(async () => {}), avisarCliente: vi.fn(async () => {}) }));

import { congelarTarifa, REGRAS_DAS_MUDANCAS, type TarifaDasMudancas } from "./conta-da-mudanca";
import { historicoParaVer, lerFolha, lerHistoricoDaFolha, type ContextoDaFolha } from "./folha-da-mudanca";
import { faltaAFolha, fimPelasHoras, horasFaturadas, totalDasHoras } from "./horas-do-trabalho";
import { preencherPelaEquipa } from "./horas-no-servidor";
import { enviarAFolha } from "./folha-no-servidor";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const TARIFA: TarifaDasMudancas = {
  precoHora2: 40,
  precoHora3: 55,
  minimoHoras: 3,
  precoKm: 0.5,
  kmMinimo: 0,
  kmMaximo: 80,
  caixa: 2,
  cartaoMetro: null,
  filmeRolo: 10,
  plasticoBolhaRolo: null,
  aparecerNaLista: true,
};
const CONGELADA = congelarTarifa(TARIFA, REGRAS_DAS_MUDANCAS, new Date("2026-11-11T10:00:00Z"));
const AGORA = new Date("2026-11-12T10:00:00Z");
const PELA_EQUIPA = {
  nome: "Ana",
  textoDaEquipa: "preenchida pela equipa (Ana), a pedido do profissional",
  textoAoCliente: "preenchida pela equipa da CLYON (Ana), a pedido do parceiro",
};
const LINHA = {
  id: 55,
  pedidoId: 612,
  providerId: 7,
  profissionalNome: "Prestador de teste",
  estado: "acordada",
  confirmadoEm: null,
  chegouEm: null,
  valorAcordado: 40,
  taxaCliente: 0,
  taxaProfissional: 0.1,
  horasMarcadasEm: null,
  horasConfirmadasEm: null,
  materiaisJson: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(estado, { tarifaJson: null, folhasGravadas: [], horasGravadas: [], historico: [], registos: [] });
});

describe("d26 — o quadro aparece sem horas", () => {
  it("na Mesa, num trabalho à hora ainda por dar por feito, mesmo sem horas marcadas", () => {
    const mesa = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(mesa).toContain('lerBase(p.baseDoPreco) === "hora" && (horasMarcadas(acordada) || !acordada.confirmadoEm) && (');
    expect(mesa).not.toContain('lerBase(p.baseDoPreco) === "hora" && horasMarcadas(acordada) && (');
  });
  it("no cartão dos Trabalhos CLYON à hora", () => {
    const c = ler("src/components/admin/TrabalhoClyon.tsx");
    expect(c).toContain("{a && porHora && (");
    expect(c).toContain("<HorasNaMesa");
  });
  it("o quadro sem horas mostra «Preencher a folha» e o formulário da equipa", () => {
    const h = ler("src/components/admin/HorasNaMesa.tsx");
    expect(h).toContain("if (r && (!r.marcadas || !r.resumo)) {");
    expect(h).toContain('botaoPreencher("Preencher a folha")');
    expect(h).toContain("ou total de horas");
    expect(h).toContain("Validada pelo cliente por telefone");
    expect(h).toContain('accao: "preencher"');
    expect(h).toContain('accao: "validar_telefone"');
  });
});

describe("d26 — a conta é a mesma da app", () => {
  it("numa mudança com a lista: a folha gravada é a de lerFolha, e igual à que o parceiro enviaria", async () => {
    estado.tarifaJson = JSON.stringify(CONGELADA);
    const corpo = { dia: "2026-11-11", inicio: "09:00", fim: "13:10", km: "20", materiais: { caixas: "10" } };
    const r = await preencherPelaEquipa({ linha: LINHA as never, porHora: true, trabalhoClyon: false, pelaEquipa: PELA_EQUIPA, corpo, agora: AGORA });
    expect(r.status).toBe(200);
    const pelaEquipa = estado.folhasGravadas[0][2] as { folhaJson: string; valorDasHoras: number };

    const ctx: ContextoDaFolha = { tarifa: CONGELADA, pessoasEscolhidas: 2, kmDoPercurso: 20, valorPorHoraAcordado: 40, diaPorOmissao: "2026-11-11" };
    const daApp = lerFolha(corpo, ctx, AGORA);
    if (!daApp.ok) throw new Error(daApp.erro);
    expect(JSON.parse(pelaEquipa.folhaJson).conta).toEqual(daApp.folha.conta);
    expect(pelaEquipa.valorDasHoras).toBe(daApp.folha.conta.semIvaCent / 100);

    // O caminho do parceiro (enviarAFolha, o da app e do painel) grava a mesma folha.
    await enviarAFolha({
      providerId: 7,
      nome: "Prestador de teste",
      negociacaoId: 55,
      pedidoId: 612,
      folhaNaBase: { folhaJson: null, horasContestadasEm: null } as never,
      ctx,
      linha: LINHA as never,
      corpo,
      agora: AGORA,
    });
    const peloParceiro = estado.folhasGravadas[1][2] as { folhaJson: string };
    expect(peloParceiro.folhaJson).toBe(pelaEquipa.folhaJson);
  });

  it("nos outros (e nos Trabalhos CLYON): horas × valor por hora, ao quarto de hora e com o mínimo de 3 h", async () => {
    const r = await preencherPelaEquipa({
      linha: { ...LINHA, valorAcordado: 50, ofertaClyon: "todos" } as never,
      porHora: true,
      trabalhoClyon: true,
      pelaEquipa: PELA_EQUIPA,
      corpo: { dia: "2026-11-11", inicio: "09:00", fim: "13:10" },
      agora: AGORA,
    });
    expect(r.status).toBe(200);
    const g = estado.horasGravadas[0][2] as { horasFaturadas: number; valorDasHoras: number; valorPorHora: number };
    expect(g.horasFaturadas).toBe(horasFaturadas(250));
    expect(g.valorDasHoras).toBe(totalDasHoras(50, 4.25, 0));
    expect(g.valorDasHoras).toBe(212.5);

    await preencherPelaEquipa({
      linha: { ...LINHA, valorAcordado: 50 } as never,
      porHora: true,
      trabalhoClyon: true,
      pelaEquipa: PELA_EQUIPA,
      corpo: { dia: "2026-11-11", inicio: "09:00", fim: "10:30" },
      agora: AGORA,
    });
    expect((estado.horasGravadas[1][2] as { valorDasHoras: number }).valorDasHoras).toBe(150);
  });

  it("o total de horas dá o fim", () => {
    expect(fimPelasHoras("09:00", "4,5")).toBe("13:30");
    expect(fimPelasHoras("22:00", 3)).toBe("01:00");
    expect(fimPelasHoras("09:00", "")).toBeNull();
    expect(fimPelasHoras("9h", 3)).toBeNull();
    expect(fimPelasHoras("09:00", 30)).toBeNull();
  });
});

describe("d26 — o histórico diz quem a preencheu", () => {
  it("na folha da mudança: a equipa lê o nome e «a pedido do profissional», o cliente «a pedido do parceiro»", async () => {
    estado.tarifaJson = JSON.stringify(CONGELADA);
    await preencherPelaEquipa({
      linha: LINHA as never,
      porHora: true,
      trabalhoClyon: false,
      pelaEquipa: PELA_EQUIPA,
      corpo: { dia: "2026-11-11", inicio: "09:00", fim: "13:00", km: "20" },
      agora: AGORA,
    });
    const edicao = (estado.folhasGravadas[0][2] as { edicao: Record<string, unknown> }).edicao;
    expect(edicao.por).toBe("clyon");
    expect(String(edicao.texto)).toContain("preenchida pela equipa (Ana), a pedido do profissional");
    const h = lerHistoricoDaFolha(JSON.stringify([edicao]));
    expect(historicoParaVer(h)[0].texto).toContain("preenchida pela equipa (Ana), a pedido do profissional");
    expect(historicoParaVer(h, "cliente")[0].texto).toContain("a pedido do parceiro");
    expect(historicoParaVer(h, "cliente")[0].texto).not.toContain("profissional");
    expect(estado.historico[0].message).toContain("preenchida pela equipa (Ana), a pedido do profissional");
    expect(estado.historico[0].by).toBeNull();
    expect(estado.registos[0]).toMatchObject({ autorTipo: "clyon", autorNome: "Ana" });
  });

  it("nos outros: no histórico do pedido e no registo", async () => {
    await preencherPelaEquipa({
      linha: { ...LINHA, valorAcordado: 50 } as never,
      porHora: true,
      trabalhoClyon: true,
      pelaEquipa: PELA_EQUIPA,
      corpo: { dia: "2026-11-11", inicio: "09:00", fim: "12:00" },
      agora: AGORA,
    });
    expect(estado.historico[0].message).toContain("Folha do trabalho de Prestador de teste preenchida pela equipa (Ana), a pedido do profissional");
    expect(estado.registos[0]).toMatchObject({ autorTipo: "clyon", autorNome: "Ana" });
  });

  it("a rota escreve as frases com o nome de quem está no backoffice, e só administradores gravam", () => {
    const rota = ler("src/app/api/admin/negociacoes/horas/route.ts");
    expect(rota).toContain("textoDaEquipa: `preenchida pela equipa (${nome}), a pedido do profissional`");
    expect(rota).toContain("pelaEquipa: { nome: porQuem, papel, ...textosDaFolhaPelaEquipa(porQuem) }");
    expect(rota).toMatch(/export async function POST\(req: NextRequest\) \{\n  const \{ err, colab \} = await requireAdminGeral\(req\);/);
  });
});

describe("d26 — o que não se preenche", () => {
  it("fora de um trabalho à hora, já dado por feito, ou com as horas confirmadas", async () => {
    const p = (linha: object, porHora = true) =>
      preencherPelaEquipa({ linha: { ...LINHA, ...linha } as never, porHora, trabalhoClyon: false, pelaEquipa: PELA_EQUIPA, corpo: { inicio: "09:00", fim: "12:00" }, agora: AGORA });
    expect((await p({}, false)).status).toBe(409);
    expect((await p({ confirmadoEm: new Date() })).status).toBe(409);
    expect((await p({ horasConfirmadasEm: new Date() })).status).toBe(409);
    expect((await p({ estado: "aguarda_contratacao" })).status).toBe(409);
    expect(estado.horasGravadas).toHaveLength(0);
  });
});

describe("d26 — «Já está feito» exige a folha", () => {
  it("faltaAFolha: só num trabalho à hora sem horas", () => {
    expect(faltaAFolha(true, {})).toBe(true);
    expect(faltaAFolha(true, { horasMarcadasEm: new Date() })).toBe(false);
    expect(faltaAFolha(false, {})).toBe(false);
  });
  it("as duas rotas da equipa recusam, e o cartão mostra a mensagem com o botão", () => {
    const clyon = ler("src/app/api/admin/trabalhos-clyon/confirmar/route.ts");
    expect(clyon).toContain('if (faltaAFolha(lerBase(linha.baseDoPreco) === "hora", linha)) {');
    expect(clyon).toContain("(SELECT o.baseDoPreco FROM simulatorOrders o WHERE o.id = n.pedidoId) AS baseDoPreco");
    const agir = ler("src/app/api/admin/negociacoes/agir/route.ts");
    expect(agir).toContain('if (faltaAFolha(lerBase((pedido as { baseDoPreco?: unknown }).baseDoPreco) === "hora", linha as never)) {');
    const c = ler("src/components/admin/TrabalhoClyon.tsx");
    expect(c).toContain("onClick={() => confirmarComFolha(a, true)}");
    expect(c).toContain("{FALTA_A_FOLHA}");
    expect(c).toContain("setAbrirFolha((x) => x + 1)");
  });
  it("«Validada pelo cliente por telefone» confirma em nome do cliente, com a folha vista", () => {
    const rota = ler("src/app/api/admin/negociacoes/horas/route.ts");
    expect(rota).toMatch(/accao === "validar_telefone"[\s\S]*?por: "cliente",\n\s*onde: validadaPorTelefone\(porQuem\),[\s\S]*?marcaVista: corpo\.marcaDaFolha,/);
  });
});
