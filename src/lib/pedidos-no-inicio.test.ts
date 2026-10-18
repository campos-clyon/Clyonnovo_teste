import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ROTULO_DA_SECCAO, SECCOES_DO_ASSISTENTE } from "./papel-do-painel";

/**
 * A GESTÃO DOS PEDIDOS VIVE NO INÍCIO — 17-10-2026.
 *
 * *«Quero que coloque a gestão de pedido para dentro de Início, e excluir a
 * página pedidos, mantendo essa gestão geral de pedidos num único lugar,
 * Início.»* — o dono.
 *
 * O menu perde «Pedidos»; o Início desenha o «precisa de si» e, por baixo, a
 * gestão dos pedidos. «pedidos» continua a ser uma secção de ACESSO — é ela
 * que dá a gestão a um assistente, e as contas antigas têm-na guardada na base
 * (que não se toca) —, e quem lá chegava por um link antigo abre o Início.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const PAINEL = ler("src/components/admin/LegacyAdminClient.tsx");

describe("o menu e o ecrã", () => {
  it("«Pedidos» saiu do menu, e o Início ficou em Operação", () => {
    const grupos = PAINEL.slice(PAINEL.indexOf("const NAV_GRUPOS"), PAINEL.indexOf("];", PAINEL.indexOf("const NAV_GRUPOS")));
    // A «App CLYON» saiu de Operação a 18-10-2026, com a app antiga.
    expect(grupos).toContain('{ titulo: "Operação", itens: ["overview"] }');
    expect(grupos).not.toMatch(/itens: \[[^\]]*"pedidos"/);
  });

  it("a secção dos pedidos abre o ecrã do Início", () => {
    expect(PAINEL).toContain('return s === "pedidos" ? "overview" : s;');
    // Um link antigo (?section=pedidos), e a conta que só tem os pedidos.
    expect(PAINEL).toContain("setActiveSection(ecraDaSeccao(sectionParam));");
    expect(PAINEL).toContain("const ecras = seccoes.map((s) => ecraDaSeccao(s as AdminSection));");
    // Todos começam no Início, o assistente também.
    expect(PAINEL).toContain('useState<AdminSection>("overview")');
  });

  it("o Início desenha o «precisa de si» e, logo a seguir, a gestão dos pedidos", () => {
    const inicio = PAINEL.indexOf('{activeSection === "overview" && podeVer("overview") && (');
    const pedidos = PAINEL.indexOf('{naJanela("pedidos") && (');
    expect(inicio).toBeGreaterThan(-1);
    expect(pedidos).toBeGreaterThan(inicio);
    const entre = PAINEL.slice(inicio, pedidos);
    expect(entre).toContain("<AdminInicioPanel");
    // Nenhum outro ecrã pelo meio: logo a seguir.
    expect(entre.slice(1)).not.toMatch(/\{activeSection === "[a-z_]+" &&/);
    const bloco = PAINEL.slice(pedidos, pedidos + 400);
    expect(bloco).toContain('id="gestao-de-pedidos"');
    expect(PAINEL.slice(pedidos, PAINEL.indexOf("{activeSection ===", pedidos))).toContain("Pedidos do simulador");
  });

  it("o cartão dos pedidos do Início desce até à gestão, em vez de mudar de ecrã", () => {
    expect(PAINEL).toContain('document.getElementById("gestao-de-pedidos")?.scrollIntoView(');
  });

  it("o ecrã abre-se a quem tem o Início OU os pedidos, e os pedidos só a quem os tem", () => {
    expect(PAINEL).toContain('s === "overview" ? podeVer("overview") || podeVer("pedidos") : podeVer(s);');
    expect(PAINEL).toContain("const naJanela = (s: AdminSection) => ecraDaSeccao(s) === activeSection && podeVer(s);");
    expect(PAINEL).toContain("{!podeVerEcra(activeSection) ? (");
    expect(PAINEL).toContain(".filter((id) => podeVerEcra(id))");
  });

  it("os pedidos carregam e actualizam-se com o Início aberto", () => {
    expect(PAINEL).toContain('if (!naJanela("pedidos") || !token) return;');
    expect(PAINEL).toContain('{ enabled: naJanela("pedidos") && Boolean(token) }');
    expect(PAINEL).not.toMatch(/activeSection [!=]== "pedidos"/);
  });

  it("o selo dos pedidos vai no Início, e abrir o Início apaga-o", () => {
    expect(PAINEL).toContain('item.id === "overview" ? (podeVer("pedidos") ? novidades.pedidos ?? 0 : 0)');
    expect(PAINEL).toContain('if (token && naJanela("pedidos")) marcarSeccaoVista("pedidos");');
  });
});

describe("os acessos ficam como estavam", () => {
  it("«pedidos» continua a ser uma secção que se dá, e diz onde está", () => {
    expect(SECCOES_DO_ASSISTENTE).toContain("pedidos");
    expect(ROTULO_DA_SECCAO.pedidos).toBe("Pedidos (no Início)");
  });
});

describe("a página antiga /admin/pedidos", () => {
  it("manda para o Início, e a lista antiga saiu", () => {
    const pagina = ler("src/app/admin/pedidos/page.tsx");
    expect(pagina).toContain('redirect("/admin");');
    expect(existsSync(join(RAIZ, "src/app/admin/pedidos/AdminPedidosClient.tsx"))).toBe(false);
    // O detalhe de cada pedido fica: é para onde apontam os avisos por email.
    expect(existsSync(join(RAIZ, "src/app/admin/pedidos/[id]/page.tsx"))).toBe(true);
  });

  it("nenhuma ligação do site aponta para a lista que saiu", () => {
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
