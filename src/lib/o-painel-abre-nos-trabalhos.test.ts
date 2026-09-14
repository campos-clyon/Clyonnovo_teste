import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O PAINEL ABRE NO QUE ELE VEM CÁ VER.
 *
 * "Faça com que as contas, ao abrir ou recarregar, sempre abram Os meus
 * trabalhos por padrão." — 14-09-2026.
 *
 * Abrir no menu obrigava a um toque para chegar ao único ecrã que interessa a
 * quem entra — e num telemóvel esse toque acontecia dez vezes por dia.
 *
 * "Remova as setinhas." Estavam em todas as linhas de todos os menus a dizer o
 * que a linha já dizia.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PAINEL = ler("src/app/profissionais/painel/PainelDoProfissional.tsx");
const PORTAL = ler("src/components/portal/Portal.tsx");

describe("abre nos trabalhos", () => {
  it("sem nada no endereço, o ecrã é «trabalhos»", () => {
    expect(PAINEL).toContain('params.get("ecra") ?? "trabalhos"');
  });

  it("e «menu» deixou de ser a omissão", () => {
    expect(semNotas(PAINEL)).not.toContain('params.get("ecra") ?? "menu"');
  });
});

describe("mas a hierarquia do «voltar» não se parte", () => {
  /*
   * O cuidado que esta mudança exigia. O menu continua a ser um ecrã, agora
   * com endereço próprio. Sem isso, o «voltar» de uma secção caía no endereço
   * sem query — que passou a querer dizer «trabalhos» — e a hierarquia que ele
   * descreveu (trabalho → lista → menu → site) perdia um degrau: de dentro do
   * perfil, voltar levava aos trabalhos e nunca ao menu.
   */
  it("o menu tem endereço próprio", () => {
    expect(PAINEL).toContain("?ecra=menu");
  });

  it("abrir qualquer ecrã escreve sempre a query, incluindo o menu", () => {
    expect(PAINEL).toContain("`/profissionais/painel?ecra=${destino}`");
    // O caso especial que mandava o menu para o endereço vazio desapareceu.
    expect(semNotas(PAINEL)).not.toContain('destino === "menu" ? "/profissionais/painel"');
  });

  it("e voltar de uma secção vai ao MENU, e não aos trabalhos", () => {
    expect(PAINEL).toContain('router.push("/profissionais/painel?ecra=menu")');
  });
});

describe("as setinhas", () => {
  it("saíram da linha de menu — e de todos os menus com ela", () => {
    /*
     * A `LinhaDeMenu` é partilhada: o painel do profissional, a conta do
     * cliente, o instalar-no-telemóvel. Tirá-la só num deixava a aplicação a
     * falar duas línguas.
     */
    expect(PORTAL).toContain("export function LinhaDeMenu");
    expect(PORTAL).not.toContain("<ChevronRight");
  });

  it("e o ícone deixou de ser importado", () => {
    // Um import que ninguém usa é lixo que o próximo a passar tenta perceber.
    expect(PORTAL).not.toContain("ChevronRight,");
  });

  it("a seta de VOLTAR fica — essa diz para onde se vai", () => {
    // Só as da direita saíram: a da esquerda, no cabeçalho de um ecrã
    // interior, é o gesto de sair dele.
    expect(PORTAL).toContain("ChevronLeft");
  });
});
