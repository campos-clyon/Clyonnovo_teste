import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ROTULO_DA_SECCAO, SECCOES_DO_ASSISTENTE } from "./papel-do-painel";
import { ROTULO_DA_SECCAO_DO_PEDIDO } from "./procurar-em-todo-o-lado";

/**
 * «PEDIDOS»: NEGOCIAÇÕES, TRABALHOS CLYON E A GESTÃO DE PEDIDOS NUM ECRÃ — 19-10-2026.
 *
 * *«Pode unir Negociações, Trabalhos CLYON e Gestão de pedidos.»* — o dono,
 * que escolheu: uma secção com três separadores (a mesa, os Trabalhos CLYON,
 * todos os pedidos), «Pedidos» no menu, uma procura só para os três, e o
 * Início só com o resumo — a lista dos pedidos esteve lá de 17 a 19-10-2026.
 *
 * As três continuam a ser secções: são elas que se dão aos assistentes, que
 * acendem os selos e que os links antigos (`?section=…`) abrem.
 */
const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const PAINEL = ler("src/components/admin/LegacyAdminClient.tsx");
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const TRABALHOS = ler("src/components/admin/AdminTrabalhosClyonPanel.tsx");

describe("o menu", () => {
  it("«Pedidos» está em Operação, e a mesa e os Trabalhos CLYON saíram da Plataforma", () => {
    expect(PAINEL).toContain('{ titulo: "Operação", itens: ["overview", "pedidos"] },');
    const plataforma = PAINEL.slice(PAINEL.indexOf('titulo: "Plataforma"'), PAINEL.indexOf("]", PAINEL.indexOf('titulo: "Plataforma"')));
    expect(plataforma).not.toContain('"negociacoes_clyon"');
    expect(plataforma).not.toContain('"trabalhos_clyon"');
  });

  it("aparece a quem tem qualquer dos três, acende em qualquer dos três e soma os selos", () => {
    expect(PAINEL).toContain('.filter((id) => (id === "pedidos" ? separadoresDosPedidos.length > 0 : podeVerEcra(id)))');
    expect(PAINEL).toContain("const active = ePedidos ? ECRA_DOS_PEDIDOS.includes(activeSection) : activeSection === item.id;");
    expect(PAINEL).toContain("? separadoresDosPedidos.reduce((t, s) => t + (novidades[s] ?? 0), 0)");
    expect(PAINEL).toContain("setActiveSection(ePedidos ? abrirOsPedidos() : item.id);");
  });
});

describe("o ecrã", () => {
  it("três separadores, pela ordem escolhida, cada um uma secção", () => {
    expect(PAINEL).toContain('const ECRA_DOS_PEDIDOS: AdminSection[] = ["negociacoes_clyon", "trabalhos_clyon", "pedidos"];');
    expect(PAINEL).toContain('negociacoes_clyon: "Mesa das negociações",');
    expect(PAINEL).toContain('pedidos: "Todos os pedidos",');
    expect(PAINEL).toContain("const separadoresDosPedidos = ECRA_DOS_PEDIDOS.filter((s) => podeVer(s));");
    expect(PAINEL).toContain('<div role="tablist" aria-label="Pedidos"');
  });

  it("cada secção volta a ser o seu ecrã — os pedidos já não abrem o Início", () => {
    expect(PAINEL).not.toContain('return s === "pedidos" ? "overview" : s;');
    expect(PAINEL).toContain("const podeVerEcra = (s: AdminSection) => podeVer(s);");
    expect(PAINEL).not.toContain('document.getElementById("gestao-de-pedidos")?.scrollIntoView(');
    expect(PAINEL).toContain("onAbrir={(s) => setActiveSection(s as AdminSection)}");
  });

  it("uma procura só: em cima, e os três separadores lêem-na", () => {
    const topo = PAINEL.slice(PAINEL.indexOf("{ECRA_DOS_PEDIDOS.includes(activeSection) && ("));
    expect(topo.slice(0, 2500)).toContain("onChange={(e) => handlePedidoSearch(e.target.value)}");
    expect(PAINEL).toContain("<AdminTrabalhosClyonPanel busca={pedidoSearch} onBusca={handlePedidoSearch} />");
    expect(PAINEL).toMatch(/<AdminNegociacoesPanel[^>]*busca=\{pedidoSearch\}[^>]*onBusca=\{handlePedidoSearch\}/);
    // A lista de todos os pedidos já não tem caixa própria.
    expect(PAINEL).not.toContain('placeholder="Pesquisar por nome, telefone, morada, serviço..."');
  });

  it("a mesa e os Trabalhos CLYON escondem a caixa deles quando a procura vem de fora", () => {
    for (const [nome, f] of [
      ["mesa", MESA],
      ["trabalhos", TRABALHOS],
    ] as const) {
      expect(f, nome).toContain("const procuraDeFora = buscaDeFora !== undefined;");
      expect(f, nome).toContain("const busca = procuraDeFora ? buscaDeFora : buscaPropria;");
      expect(f, nome).toContain("{!procuraDeFora && (");
    }
  });

  it("chegar por um link, ou por «Abrir em…», leva a procura para o separador certo", () => {
    expect(PAINEL).toContain("if (procurarParam && ECRA_DOS_PEDIDOS.includes(sectionParam)) {");
    expect(PAINEL).toContain("if (ECRA_DOS_PEDIDOS.includes(seccao as AdminSection)) {");
  });

  it("abrir um separador é vê-lo: o selo apaga-se pela secção aberta", () => {
    expect(PAINEL).toContain("if (token) marcarSeccaoVista(activeSection);");
    expect(PAINEL).not.toContain('if (token && naJanela("pedidos")) marcarSeccaoVista("pedidos");');
  });
});

describe("os nomes", () => {
  it("os acessos dos assistentes dizem onde fica cada um", () => {
    expect(SECCOES_DO_ASSISTENTE.slice(0, 4)).toEqual(["overview", "pedidos", "negociacoes_clyon", "trabalhos_clyon"]);
    expect(ROTULO_DA_SECCAO.pedidos).toBe("Pedidos › Todos os pedidos");
    // A Mesa é uma permissão só desde 20-10-2026 (uma caixa no painel dos Assistentes).
    expect(ROTULO_DA_SECCAO.negociacoes_clyon).toBe("Pedidos › Mesa (negociação e valor fixo)");
    expect(ROTULO_DA_SECCAO.trabalhos_clyon).toBe("Pedidos › Mesa (valor fixo)");
  });

  it("o «Abrir em…» diz o nome do separador", () => {
    expect(ROTULO_DA_SECCAO_DO_PEDIDO).toEqual({
      trabalhos_clyon: "Trabalhos CLYON",
      negociacoes_clyon: "Mesa das negociações",
      pedidos: "Todos os pedidos",
    });
  });
});

describe("a página antiga /admin/pedidos", () => {
  it("manda para «Pedidos», e o detalhe de cada pedido fica", () => {
    expect(ler("src/app/admin/pedidos/page.tsx")).toContain('redirect("/admin?section=pedidos");');
    expect(existsSync(join(RAIZ, "src/app/admin/pedidos/AdminPedidosClient.tsx"))).toBe(false);
    // O detalhe de cada pedido fica: é para onde apontam os avisos por email.
    expect(existsSync(join(RAIZ, "src/app/admin/pedidos/[id]/page.tsx"))).toBe(true);
  });

  it("nenhuma ligação do site aponta para a lista antiga", () => {
    const achadas: string[] = [];
    const varrer = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        const p = join(dir, nome);
        if (statSync(p).isDirectory()) varrer(p);
        else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) {
          const t = readFileSync(p, "utf8");
          if (/["'`]\/admin\/pedidos["'`?#]/.test(t)) achadas.push(p.replace(RAIZ, ""));
        }
      }
    };
    varrer(join(RAIZ, "src"));
    expect(achadas).toEqual([]);
  });
});
