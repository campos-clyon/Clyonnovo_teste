import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SECCOES_COM_AVISO,
  eSeccaoComAviso,
  pedidosComRespostaDoProfissional,
  type NegociacaoParaOSelo,
} from "./novidades-do-backoffice";

/**
 * «DEVE TER SEMPRE NOTIFICAÇÕES» — 17-10-2026.
 *
 * O dono escolheu mais quatro secções com selo: Negociações, Trabalhos CLYON,
 * Pagamentos e Contas. E a Agenda, que já o tinha, nunca acendeu: a consulta
 * pedia uma coluna que não existe (`actualizadaEm`), e o erro ficava calado.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (f: string) =>
  f.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");
const DB = ler("src/lib/db.ts");
const NOVIDADES = semComentarios(
  DB.slice(DB.indexOf("export async function contarNovidades("), DB.indexOf("/* ── A PAPELEIRA DO SUPORTE")),
);

describe("as secções com selo", () => {
  it("são as dez, com as quatro novas — e «Assistentes» desde 31-10-2026", () => {
    for (const s of ["negociacoes_clyon", "trabalhos_clyon", "pagamentos", "contas", "equipa"]) {
      expect(eSeccaoComAviso(s), s).toBe(true);
    }
    expect(SECCOES_COM_AVISO).toHaveLength(11);
  });

  it("cada uma tem a sua conta em `contarNovidades`", () => {
    // Desde 19-10-2026 conta os pedidos e guarda quais (o «onde»).
    expect(NOVIDADES).toContain("const ids = quaisPedidosComRespostaDoProfissional(");
    expect(NOVIDADES).toContain("saida.negociacoes_clyon = ids.length;");
    for (const s of ["trabalhos_clyon", "pagamentos", "contas"]) {
      expect(NOVIDADES, s).toContain(`"${s}",\n`);
    }
  });
});

describe("a Agenda", () => {
  it("conta pelo `updatedAt`, que existe — `actualizadaEm` é só um alias noutras consultas", () => {
    const i = NOVIDADES.indexOf('"agenda",');
    const consulta = NOVIDADES.slice(i, NOVIDADES.indexOf("[desde.agenda]", i));
    expect(consulta).toContain("AND updatedAt > ?");
    expect(consulta).not.toContain("actualizadaEm");
  });
});

describe("as Negociações: o que um profissional fez desde que se olhou", () => {
  const desde = new Date("2026-10-17T10:00:00Z");
  const antes = "2026-10-17 09:00:00";
  const depois = "2026-10-17 11:00:00";
  const n = (x: Partial<NegociacaoParaOSelo>): NegociacaoParaOSelo => ({
    pedidoId: 1,
    estado: "aberta",
    propostasJson: null,
    updatedAt: depois,
    execucaoEnviadaEm: null,
    confirmadoEm: null,
    ...x,
  });
  const proposta = (por: string, estado = "pendente") => JSON.stringify([{ por, valor: 90, criadaEm: depois, estado }]);

  it("aceitou, propôs, ou disse que está feito — conta", () => {
    expect(pedidosComRespostaDoProfissional([n({ estado: "aguarda_contratacao" })], desde)).toBe(1);
    expect(pedidosComRespostaDoProfissional([n({ propostasJson: proposta("profissional") })], desde)).toBe(1);
    expect(
      pedidosComRespostaDoProfissional([n({ estado: "acordada", execucaoEnviadaEm: new Date(depois.replace(" ", "T") + "Z") })], desde),
    ).toBe(1);
  });

  it("a proposta do cliente, a já respondida, ou a de antes de se olhar — não conta", () => {
    expect(pedidosComRespostaDoProfissional([n({ propostasJson: proposta("cliente") })], desde)).toBe(0);
    expect(pedidosComRespostaDoProfissional([n({ propostasJson: proposta("profissional", "aceite") })], desde)).toBe(0);
    expect(pedidosComRespostaDoProfissional([n({ estado: "aguarda_contratacao", updatedAt: antes })], desde)).toBe(0);
    expect(
      pedidosComRespostaDoProfissional([n({ estado: "acordada", execucaoEnviadaEm: depois, confirmadoEm: depois })], desde),
    ).toBe(0);
    expect(pedidosComRespostaDoProfissional([n({ propostasJson: "não é json" })], desde)).toBe(0);
  });

  it("conta pedidos, não negociações — é um cartão por pedido", () => {
    expect(
      pedidosComRespostaDoProfissional(
        [n({ estado: "aguarda_contratacao" }), n({ estado: "aguarda_contratacao" }), n({ pedidoId: 2, estado: "aguarda_contratacao" })],
        desde,
      ),
    ).toBe(2);
  });

  it("só olha para os pedidos da mesa: sem Trabalhos CLYON nem fechados", () => {
    const i = NOVIDADES.indexOf("saida.negociacoes_clyon");
    const consulta = NOVIDADES.slice(NOVIDADES.lastIndexOf("SELECT", i), i);
    expect(consulta).toContain("o.valorFixoClyon IS NULL");
    expect(consulta).toContain("o.status NOT IN ('cancelado','concluido','arquivado')");
  });
});

describe("Trabalhos CLYON, Pagamentos e Contas", () => {
  const consulta = (s: string) => {
    const i = NOVIDADES.indexOf(`"${s}",\n`);
    return NOVIDADES.slice(i, NOVIDADES.indexOf(");", i));
  };

  it("Trabalhos CLYON: os de «Por atribuir», e o que eu próprio ofereci não me acende o selo", () => {
    const c = consulta("trabalhos_clyon");
    expect(c).toContain("o.valorFixoClyon IS NOT NULL");
    expect(c).toContain("a.estado = 'acordada'");
    expect(c).toContain("r.acontecimento = 'pedido_distribuido'");
    expect(c).toContain("r.autorNome <> ?");
    expect(c).toContain("i.estado = 'aguarda_contratacao'");
    expect(ler("src/app/api/admin/novidades/route.ts")).toContain("contarNovidades(desde, { nome: colab.nome }, onde)");
  });

  it("Pagamentos: só o que chegou sozinho pelo euPago, e não as contas de teste", () => {
    const c = consulta("pagamentos");
    expect(c).toContain("pg.metodo IN ('mbway','multibanco')");
    expect(c).toContain("pg.deTeste = 0");
  });

  it("e o painel abre em «Recebidos», que é onde eles estão", () => {
    const painel = ler("src/components/admin/AdminPagamentosPanel.tsx");
    expect(painel).toContain('useState<Separador>(novosRecebidos > 0 ? "recebidos" : "por_receber")');
    expect(painel).toContain('if (novosRecebidos > 0) setSeparador("recebidos");');
    expect(ler("src/components/admin/LegacyAdminClient.tsx")).toContain(
      "<AdminPagamentosPanel novosRecebidos={novasAoAbrir.pagamentos ?? 0} />",
    );
  });

  it("Contas: as novas, sem as apagadas", () => {
    expect(consulta("contas")).toContain("FROM users WHERE deletedAt IS NULL AND createdAt > ?");
  });
});
