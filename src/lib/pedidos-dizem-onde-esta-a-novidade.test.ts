import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  pedidosComRespostaDoProfissional,
  quaisPedidosComRespostaDoProfissional,
  type NegociacaoParaOSelo,
} from "./novidades-do-backoffice";

/**
 * «TINHA UMA NOTIFICAÇÃO EM PEDIDOS, MAS QUANDO ABRI NÃO DISSE ONDE ERA» — 19-10-2026.
 *
 * O selo contava, não dizia quais; o menu abria no último separador, e abrir
 * apagava o número. Agora a rota devolve QUAIS pedidos (o «onde»), o menu
 * abre onde está a novidade, e o topo de «Pedidos» mostra-os, pedido a pedido.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const DB = ler("src/lib/db.ts");
const NOVIDADES = DB.slice(DB.indexOf("export async function contarNovidades("), DB.indexOf("/* ── A PAPELEIRA DO SUPORTE"));
const ROTA = ler("src/app/api/admin/novidades/route.ts");
const PAINEL = ler("src/components/admin/LegacyAdminClient.tsx");

describe("quais, e não só quantos", () => {
  const desde = new Date("2026-10-19T10:00:00Z");
  const n = (pedidoId: number, estado: string): NegociacaoParaOSelo => ({
    pedidoId,
    estado,
    propostasJson: null,
    updatedAt: "2026-10-19 11:00:00",
    execucaoEnviadaEm: null,
    confirmadoEm: null,
  });

  it("os pedidos da Mesa vêm pelo número, do mais recente, e contam o mesmo", () => {
    const linhas = [n(450, "aguarda_contratacao"), n(461, "aguarda_contratacao"), n(450, "aguarda_contratacao")];
    expect(quaisPedidosComRespostaDoProfissional(linhas, desde)).toEqual([461, 450]);
    expect(pedidosComRespostaDoProfissional(linhas, desde)).toBe(2);
  });

  it("nas três secções de «Pedidos» a consulta devolve os pedidos e guarda-os no «onde»", () => {
    expect(NOVIDADES).toContain("onde?: Record<string, number[]>,");
    expect(NOVIDADES).toContain("if (onde) onde[seccao] = ids.slice(0, 20);");
    expect(NOVIDADES).toMatch(/await quais\(\n\s+"pedidos",\n\s+`SELECT id FROM simulatorOrders/);
    expect(NOVIDADES).toMatch(/await quais\(\n\s+"trabalhos_clyon",\n\s+`SELECT o\.id FROM simulatorOrders o/);
    expect(NOVIDADES).toContain("if (onde) onde.negociacoes_clyon = ids.slice(0, 20);");
    // E, desde 26-10-2026 (d25), o que está por fazer nos Pagamentos (`porFazer`).
    expect(ROTA).toContain("return NextResponse.json({ novidades: { ...nenhumaNovidade(), ...contadas }, onde, porFazer });");
  });
});

describe("o ecrã diz onde", () => {
  it("o menu abre «Pedidos» no separador que tem novidade", () => {
    // A Mesa conta as duas metades dela desde 20-10-2026.
    expect(PAINEL).toContain("separadoresDosPedidos.find((s) => novasNoSeparador(s) > 0) ??");
  });

  it("guarda quais havia ao abrir, antes de o selo se apagar", () => {
    expect(PAINEL).toContain("setOndeAoAbrir((m) => ({ ...m, ...Object.fromEntries(metades.map((x) => [x, onde[x] ?? []])) }));");
    expect(PAINEL).toContain("setOnde((o) => (o[seccao]?.length ? { ...o, [seccao]: [] } : o));");
  });

  it("o topo de «Pedidos» mostra-os, pedido a pedido, e um clique leva lá", () => {
    expect(PAINEL).toContain("Novidades desde a última vez que abriu:");
    expect(PAINEL).toContain("((s === activeSection ? ondeAoAbrir[x] : onde[x]) ?? []).map((id) => ({ s, x, id })),");
    expect(PAINEL).toContain("handlePedidoSearch(`#${id}`);");
  });
});
