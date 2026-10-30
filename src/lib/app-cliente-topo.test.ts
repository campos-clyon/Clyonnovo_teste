import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A BARRA DE CIMA DA APP DE CLIENTE (ordem do CEO com o sim do dono,
 * 30-10-2026): a morada à esquerda, Conversas · Ajuda · Notificações à
 * direita, e «Como podemos ajudar?» por baixo. Lê o código da app.
 */
const APP = join(process.cwd(), "app-cliente", "src");
const ler = (p: string) => readFileSync(join(APP, p), "utf8").replace(/\r\n/g, "\n");
const INICIO = ler("app/(app)/index.tsx");
const MORADA = ler("app/morada.tsx");
const GUARDAR = ler("lib/morada-do-cliente.ts");

describe("a barra de cima do Início", () => {
  it("já não tem o logótipo e tem os três ícones, por esta ordem, com accessibilityLabel", () => {
    const topo = INICIO.slice(INICIO.indexOf("export const BOTOES_DO_TOPO"), INICIO.indexOf("/** Um pedido activo"));
    expect(topo).not.toContain("assets/icon.png");
    const ordem = ["chatbubble-outline", "help-buoy-outline", "notifications-outline"].map((i) => topo.indexOf(`icone: "${i}"`));
    expect(ordem.every((n) => n > 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    for (const r of ["Conversas", "Ajuda", "Notificações"]) expect(topo).toContain(`rotulo: "${r}"`);
    expect(topo).toContain("accessibilityLabel={selo ?");
    expect(topo).toMatch(/width: 44, height: 44/);
    expect(topo).toContain("quantosComNovidade(pedidos)");
  });

  it("mostra a morada com a setinha, a cortar com «…», ou «Escolher morada»", () => {
    expect(INICIO).toContain('name="chevron-down"');
    expect(INICIO).toContain('ellipsizeMode="tail"');
    expect(INICIO).toContain("morada ?? SEM_MORADA");
    expect(GUARDAR).toContain('SEM_MORADA = "Escolher morada"');
  });

  it("a pesquisa «Como podemos ajudar?» abre o Descobrir", () => {
    expect(INICIO).toContain("Como podemos ajudar?");
    expect(INICIO).toContain('router.push("/servicos")');
  });
});

describe("a morada", () => {
  it("procura pela rota do site /api/maps/autocomplete com { input }", () => {
    expect(MORADA).toContain('ROTA_DAS_SUGESTOES = "/api/maps/autocomplete"');
    expect(MORADA).toContain('metodo: "POST", corpo: { input: q }');
    expect(MORADA).toContain("guardarMorada(m, ligado)");
  });

  it("guarda na conta (addressLine) com sessão e no cofre do telemóvel sempre", () => {
    expect(GUARDAR).toContain('pedir("/api/users/me", { metodo: "PATCH", corpo: { addressLine: m.formattedAddress } })');
    expect(GUARDAR).toContain("guardarNoCofre(CHAVE_DA_MORADA");
    expect(ler("lib/sessao.ts")).toContain("apagarDoCofre(CHAVE_DA_MORADA)");
  });

  it("vem preenchida no Pedir quando o rascunho ainda não tem morada", () => {
    const novo = ler("componentes/NovoPedido.tsx");
    expect(novo).toContain("lerMoradaGuardada().then");
    expect(novo).toContain("mudar({ morada: m })");
  });
});

describe("os ecrãs da barra", () => {
  it("existem e estão no Stack", () => {
    const layout = ler("app/_layout.tsx");
    for (const n of ["morada", "conversas", "ajuda", "notificacoes"]) expect(layout).toContain(`name="${n}"`);
  });

  it("Conversas tem só a CLYON (pelo WhatsApp), pronta para mais linhas", () => {
    const c = ler("app/conversas.tsx");
    expect(c).toContain("CLYON — suporte");
    expect(c).toContain("whatsappDaClyon()");
    expect(c.match(/titulo: "/g)?.length).toBe(1);
  });

  it("a Ajuda e o Perfil usam o mesmo componente, sem duplicar as linhas", () => {
    expect(ler("app/ajuda.tsx")).toContain("<LinhasDaAjuda />");
    const perfil = ler("app/(app)/perfil.tsx");
    expect(perfil).toContain("<LinhasDaAjuda />");
    expect(perfil).not.toContain("/info/como-funciona");
  });

  it("Notificações mostra as novidades dos pedidos e, sem sessão, uma frase", () => {
    const n = ler("app/notificacoes.tsx");
    expect(n).toContain("p.novidade");
    expect(n).toContain("Entre na sua conta");
  });
});
