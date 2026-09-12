import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * UM CONVITE POR USAR NÃO É UMA CANDIDATURA TRATADA.
 *
 * "Vamos liberar esses pedidos que foram preenchidos no formulário."
 * — 12-09-2026, a olhar para quatro convites à espera de resposta.
 *
 * A 11-09-2026 o fluxo mudou: aprovar uma candidatura deixou de mandar um
 * convite para um segundo formulário e passou a criar a conta. Mas as linhas
 * criadas ANTES ficaram no estado `convidada` — e essas pessoas ficaram num
 * sítio onde ninguém as via:
 *
 *   · não entravam em «por tratar», porque o filtro era `estado === "nova"`;
 *   · mostravam um visto verde, como as aprovadas;
 *   · e não tinham botão nenhum.
 *
 * Ou seja: escreveram tudo no formulário, receberam um link, não lhe tocaram,
 * e do lado de cá pareciam despachadas. Quatro pessoas paradas a dizer que
 * queriam trabalhar connosco.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const PAINEL = ler("src/components/admin/AdminCandidaturasPanel.tsx");
const ROTA = ler("src/app/api/admin/candidaturas/route.ts");
const INSCRICAO = ler("src/app/api/profissionais/inscricao/route.ts");

describe("uma convidada volta para a fila de quem espera", () => {
  it("conta como POR TRATAR, e não como tratada", () => {
    expect(PAINEL).toContain(
      'const porTratar = candidaturas.filter((c) => c.estado === "nova" || c.estado === "convidada");',
    );
    // E «tratadas» passa a ser só o que está mesmo decidido.
    expect(PAINEL).toContain(
      'const tratadas = candidaturas.filter((c) => c.estado === "aprovada" || c.estado === "recusada");',
    );
  });

  it("entra na contagem do distintivo — é o que faz alguém reparar", () => {
    expect(PAINEL).toContain("{porTratar.length}");
    expect(PAINEL).not.toContain("const novas = ");
  });

  it("deixa de mostrar o visto verde", () => {
    /*
     * O visto era a mentira. Dizia «está feito» sobre uma pessoa que não tem
     * conta nenhuma.
     */
    expect(PAINEL).toContain('{c.estado === "aprovada" && (');
    expect(PAINEL).not.toContain('{(c.estado === "aprovada" || c.estado === "convidada") && (');
  });

  it("e diz o que «convidada» quer dizer hoje", () => {
    // «convidada» sozinho lia-se como despachada.
    expect(PAINEL).toContain("convite antigo por usar — ainda sem conta");
  });
});

describe("e ganha o botão que lhe faltava", () => {
  it("aprovar aparece também nas convidadas", () => {
    expect(PAINEL).toContain('{(c.estado === "nova" || c.estado === "convidada") && (');
  });

  it("com o nome do que faz — criar a conta, não convidar outra vez", () => {
    expect(PAINEL).toContain(
      '{c.estado === "convidada" ? "Criar a conta agora" : "Aprovar e dar acesso"}',
    );
  });

  it("a rota aceita-o sem mudar nada: não olha ao estado de partida", () => {
    /*
     * `aprovar` só recusa o que não conhece, e `marcarCandidatura` actualiza
     * pelo id. Não foi preciso backend novo — o caminho já estava aberto e
     * era o ecrã que não lá chegava.
     */
    expect(ROTA).toContain('if (accao !== "aprovar" && accao !== "convidar") {');
    expect(ROTA).toContain("const jaExiste = await profissionalPorEmail(candidatura.email);");
  });
});

describe("o convite antigo que fica por aí", () => {
  it("clicado depois disto, não cria um segundo profissional", () => {
    /*
     * A conta nova não revoga o convite velho — o elo entre os dois só existe
     * em texto, na nota («Candidatura pelo site (#1)»), e revogar coisas a
     * partir de texto é como se apagam as erradas.
     *
     * Não é preciso: a inscrição recusa um email que já é profissional. O pior
     * caso é a pessoa ver «já existe» num link velho, que é a verdade.
     */
    const i = INSCRICAO.indexOf("const jaExiste = await profissionalPorEmail(d.email);");
    expect(i).toBeGreaterThan(-1);
    expect(INSCRICAO.slice(i, i + 400)).toContain("409");
  });
});
