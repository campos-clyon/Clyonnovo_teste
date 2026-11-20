import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assistenteComSeccoesPodeChamar } from "./papel-do-painel";
import {
  GRUPOS_DA_PROCURA,
  MAXIMO_POR_GRUPO,
  gruposQuePodeVer,
  linhaDaConversa,
  linhaDoPagamento,
  linhaDoPedido,
  seccaoQueAbre,
  soOQuePodeVer,
  type LinhaDaProcura,
} from "./procura-do-backoffice";
import { combinaComABusca, combinaComOsCampos, digitosDoTermo, juntarNumeros, telefoneNacional } from "./procurar-pedido";

/**
 * A BARRA ÚNICA DO BACKOFFICE — d79 (20-11-2026), CEO e dono.
 *
 * Uma só barra no topo de todas as secções: filtra a secção aberta e, por
 * baixo, «Em todo o backoffice». Os Leads ficam de fora; o assistente só vê o
 * que as secções dele permitem, e é o servidor que confere.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/** Sem os comentários de linha, para um comentário não fazer passar (nem chumbar) um teste. */
const semComentarios = (s: string) => s.replace(/^\s*\/\/.*$/gm, "");

describe("o telefone como as pessoas o escrevem", () => {
  it("+351, 351, 00351, espaços e pontos dão os mesmos nove dígitos", () => {
    for (const t of ["+351 912 345 678", "351912345678", "00351 912345678", "912.345.678", "912 345 678", "912-345-678"]) {
      expect(digitosDoTermo(t), t).toBe("912345678");
    }
    expect(telefoneNacional("+351912345678")).toBe("912345678");
    // Um número que não começa por 351 fica como está.
    expect(telefoneNacional("212345678")).toBe("212345678");
  });

  it("os números aos bocados juntam-se; os curtos e o #pedido não", () => {
    expect(juntarNumeros("silva +351 912 345 678")).toBe("silva 912345678");
    expect(juntarNumeros("rua 5 de outubro 12")).toBe("rua 5 de outubro 12");
    expect(juntarNumeros("#311")).toBe("#311");
    expect(juntarNumeros("2765-321")).toBe("2765-321");
  });

  it("um pedido guardado com ou sem +351 encontra-se das duas maneiras", () => {
    const comIndicativo = { id: 501, contactName: "Cliente 501", contactPhone: "+351 912 345 678" };
    const sem = { id: 502, contactName: "Cliente 502", contactPhone: "912345678" };
    for (const termo of ["+351 912 345 678", "912345678", "912.345.678", "351912345678"]) {
      expect(combinaComABusca(comIndicativo, termo), termo).toBe(true);
      expect(combinaComABusca(sem, termo), termo).toBe(true);
    }
    expect(combinaComABusca(sem, "930 000 111")).toBe(false);
  });

  it("o NIF da fatura também procura", () => {
    expect(combinaComABusca({ id: 7, contactName: "X", nif: "245 123 456" }, "245123456")).toBe(true);
  });
});

describe("o n.º do pedido, com ou sem #", () => {
  it("«#450» e «450» são o pedido 450, e não o 45 nem o 4500", () => {
    const p = (id: number) => ({ id, contactName: `Cliente ${id}` });
    expect(combinaComABusca(p(450), "#450")).toBe(true);
    expect(combinaComABusca(p(450), "450")).toBe(true);
    expect(combinaComABusca(p(45), "#450")).toBe(false);
    expect(combinaComABusca(p(4500), "#450")).toBe(false);
    expect(combinaComABusca(p(450), "pedido #450")).toBe(true);
  });

  it("numa linha qualquer, o # é um dos pedidos dela", () => {
    const levantamento = { ids: [311, 312], textos: ["TRSul"], digitos: ["PT50000201231234567890154"] };
    expect(combinaComOsCampos(levantamento, "#312")).toBe(true);
    expect(combinaComOsCampos(levantamento, "#31")).toBe(false);
    expect(combinaComOsCampos(levantamento, "trsul")).toBe(true);
    expect(combinaComOsCampos(levantamento, "")).toBe(true);
  });
});

describe("o filtro por secção", () => {
  it("as palavras somam-se, sem acentos", () => {
    const linha = { textos: ["Júlia Castanheira", "Almada"], digitos: ["912345678"] };
    expect(combinaComOsCampos(linha, "julia almada")).toBe(true);
    expect(combinaComOsCampos(linha, "julia seixal")).toBe(false);
    expect(combinaComOsCampos(linha, "+351 912 345 678")).toBe(true);
  });

  it("cada secção lê a barra do topo, e as caixas de dentro saíram", () => {
    const paineis: Array<[string, string]> = [
      ["src/components/admin/AdminAgendaPanel.tsx", 'aria-label="Procurar na agenda"'],
      ["src/components/admin/AdminCarteirasPanel.tsx", 'aria-label="Procurar nas carteiras"'],
      ["src/components/admin/AdminNegociacoesPanel.tsx", 'aria-label="Procurar em toda a mesa"'],
      ["src/components/admin/AdminPagamentosPanel.tsx", 'placeholder="cliente, telemóvel, cidade ou #pedido"'],
      ["src/components/admin/AdminWhatsAppPanel.tsx", 'aria-label="Procurar uma conversa"'],
      ["src/components/admin/ContasPanel.tsx", 'placeholder="Pesquisar por nome, email, telefone ou cidade..."'],
      ["src/components/admin/AdminConversasPanel.tsx", 'placeholder="Procurar nome, pedido ou texto"'],
      ["src/components/admin/AdminProfissionaisPanel.tsx", 'placeholder="Procurar por nome, email, cidade ou categoria…"'],
      ["src/components/admin/financas/ListaDeTransacoes.tsx", 'placeholder="Procurar descrição ou nota"'],
    ];
    for (const [f, caixaAntiga] of paineis) {
      const codigo = ler(f);
      expect(codigo, f).not.toContain(caixaAntiga);
      expect(codigo, f).toContain("useProcuraDoBackoffice()");
      expect(codigo, f).not.toContain("<NoutrosSitios");
    }
    // As secções que não tinham procura também filtram pela barra.
    for (const f of [
      "src/components/admin/AdminLevantamentosPanel.tsx",
      "src/components/admin/AdminAssistentesPanel.tsx",
      "src/components/admin/AdminSuporteClientesPanel.tsx",
    ]) {
      const codigo = ler(f);
      expect(codigo, f).toContain("useProcuraDoBackoffice()");
      expect(codigo, f).toContain("combinaComOsCampos(");
    }
  });

  it("a caixa de «Pedidos» saiu; a barra está no cabeçalho, com o ×, e a data saiu", () => {
    const painel = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(painel).not.toContain('aria-label="Procurar nos pedidos"');
    expect(painel).toContain('aria-label="Procurar em todo o backoffice"');
    expect(painel).toContain('aria-label="Limpar a procura"');
    expect(painel).not.toContain("hojeLabel");
    expect(painel).not.toContain('weekday: "long"');
    // Só um <input type="search"> no painel, o do topo.
    expect(painel.split('type="search"').length - 1).toBe(1);
  });

  it("a procura fica no URL (?q=) e volta com o «voltar atrás»", () => {
    const painel = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(painel).toContain('if (q) p.set("q", q);');
    expect(painel).toContain("window.history.pushState(");
    expect(painel).toContain('procurarJa(sp.get("q") ?? "");');
    expect(painel).toContain('searchParams.get("q") ?? searchParams.get("procurar")');
  });

  it("espera ~250 ms depois da última tecla", () => {
    expect(ler("src/components/admin/LegacyAdminClient.tsx")).toContain("const ESPERA_DA_PROCURA_MS = 250;");
  });

  it("«Em todo o backoffice» fica por baixo da secção, menos nos Leads", () => {
    const painel = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(painel).toContain('{activeSection !== "leads" && <EmTodoOBackoffice seccao={activeSection} />}');
    expect(ler("src/components/admin/NoutrosSitios.tsx")).toContain("Em todo o backoffice");
  });
});

describe("o acesso do assistente — o servidor confere", () => {
  it("o administrador vê todos os grupos", () => {
    expect(gruposQuePodeVer("admin", null)).toEqual(GRUPOS_DA_PROCURA.map((g) => g.id));
  });

  it("um assistente só do WhatsApp só recebe as conversas", () => {
    expect(gruposQuePodeVer("assistente", ["whatsapp"])).toEqual(["whatsapp"]);
  });

  it("sem os Pedidos nem a Mesa, não há pedidos; com a Agenda, só a agenda", () => {
    const g = gruposQuePodeVer("assistente", ["agenda"]);
    expect(g).toEqual(["agenda"]);
    expect(g).not.toContain("pedidos");
    expect(gruposQuePodeVer("assistente", [])).toEqual([]);
    expect(gruposQuePodeVer("assistente", ["leads"])).toEqual([]);
  });

  it("à saída só ficam os grupos que pode ver, e no máximo de cada um", () => {
    const linha = (n: number): LinhaDaProcura => ({ chave: `l${n}`, titulo: "x", detalhe: null, etiqueta: null, abrir: null, pedidoId: null });
    const tudo = {
      pedidos: Array.from({ length: 30 }, (_, i) => linha(i)),
      whatsapp: [linha(1)],
      clientes: [linha(2)],
    };
    const fora = soOQuePodeVer(tudo, ["whatsapp"]);
    expect(Object.keys(fora)).toEqual(["whatsapp"]);
    expect(soOQuePodeVer(tudo, ["pedidos"]).pedidos).toHaveLength(MAXIMO_POR_GRUPO.pedidos);
  });

  it("a rota lê as secções do assistente na base e filtra antes e depois de ler", () => {
    const rota = semComentarios(ler("src/app/api/admin/procurar/route.ts"));
    expect(rota).toContain("await requireAdmin(req)");
    expect(rota).toContain("await assistentePorId(colab.id)");
    expect(rota).toContain("gruposQuePodeVer(colab.papel, seccoes)");
    expect(rota).toContain("soOQuePodeVer(await procurarNoBackoffice(termo, grupos), grupos)");
    expect(rota).not.toMatch(/export async function (POST|PATCH|DELETE|PUT)/);
  });

  it("a base só é lida para os grupos pedidos", () => {
    const base = ler("src/lib/procura-do-backoffice-na-base.ts");
    for (const g of ["profissionais", "clientes", "pagamentos", "whatsapp", "agenda", "documentos"]) {
      expect(base, g).toContain(`quer("${g}")`);
    }
    // A base só lê; nem cria tabelas.
    expect(base).not.toMatch(/\b(INSERT|UPDATE|DELETE|CREATE|ALTER)\b/);
  });

  it("qualquer secção com grupo chega à rota; os Leads não", () => {
    for (const s of ["pedidos", "negociacoes_clyon", "agenda", "pagamentos", "carteiras", "whatsapp", "profissionais", "contas"]) {
      expect(assistenteComSeccoesPodeChamar([s], "/api/admin/procurar", "GET"), s).toBe(true);
    }
    expect(assistenteComSeccoesPodeChamar(["leads"], "/api/admin/procurar", "GET")).toBe(false);
  });
});

describe("os Leads ficam de fora", () => {
  it("não há grupo de leads nem se lê a tabela", () => {
    expect(GRUPOS_DA_PROCURA.map((g) => g.id as string)).not.toContain("leads");
    expect(ler("src/lib/procura-do-backoffice-na-base.ts")).not.toMatch(/FROM\s+leads\b/i);
    expect(ler("src/lib/procura-do-backoffice.ts")).not.toMatch(/seccoes: \[[^\]]*"leads"/);
  });

  it("nos Leads não há barra do topo (a caixa deles fica)", () => {
    const painel = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(painel).toContain('{activeSection !== "leads" && (\n              <div role="search"');
  });
});

describe("a referência Multibanco e as linhas", () => {
  it("uma referência com espaços dá os dígitos para procurar", () => {
    expect(digitosDoTermo("123 456 789")).toBe("123456789");
  });

  it("a rota procura a referência, o MB WAY e o trid nos pagamentos", () => {
    const base = ler("src/lib/procura-do-backoffice-na-base.ts");
    expect(base).toContain('SO_DIGITOS_SQL("pg.referencia")');
    expect(base).toContain('SO_DIGITOS_SQL("pg.telemovel")');
    expect(base).toContain('"pg.trid = ?", "pg.transacaoId = ?"');
  });

  it("um pagamento abre nos Pagamentos (ou nas Finanças) pelo pedido", () => {
    const l = linhaDoPagamento({ id: 9, pedidoId: 311, metodo: "multibanco", estado: "pago", valor: 61.5, referencia: "123456789", entidade: "11249", profissional: "TRSul" });
    expect(l.abrir).toEqual({ seccoes: ["pagamentos", "carteiras"], procura: "#311" });
    expect(l.detalhe).toContain("Ref. 123456789");
    expect(seccaoQueAbre(l.abrir, (s) => s === "carteiras")).toBe("carteiras");
    expect(seccaoQueAbre(l.abrir, () => false)).toBeNull();
  });

  it("um pedido da Mesa abre na Mesa — ou em Todos os pedidos, sem a Mesa", () => {
    const l = linhaDoPedido({
      pedidoId: 450,
      cliente: "Ana",
      telefone: "912345678",
      servico: "recolha_moveis",
      cidade: "Almada",
      estado: "pendente",
      origem: "negociacao",
      seccao: "negociacoes_clyon",
      profissional: null,
      criadoEm: null,
    });
    expect(seccaoQueAbre(l.abrir, () => true)).toBe("negociacoes_clyon");
    expect(seccaoQueAbre(l.abrir, (s) => s === "pedidos")).toBe("pedidos");
    expect(l.abrir?.procura).toBe("#450");
  });

  it("a conversa do WhatsApp abre pelo número sem o indicativo", () => {
    const l = linhaDaConversa({ telefone: "351912345678", ultimaEm: null, mensagens: 3, nome: "Ana" });
    expect(l.abrir).toEqual({ seccoes: ["whatsapp"], procura: "912345678" });
  });
});
