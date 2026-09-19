import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * CORRIGIR UMA CANDIDATURA ANTES DE A APROVAR.
 *
 * "Eu tenho que ter o poder de editar antes de aprovar." — 19-09-2026.
 * "Por exemplo, o prestador escreveu errado a palavra «remodeklação»."
 *
 * Aprovar CRIA A CONTA com exactamente o que o candidato escreveu: o nome vai
 * para o perfil público — que é a página dele no Google —, o email é por onde
 * ele entra e recebe o link da palavra-passe, o telefone é por onde o cliente
 * lhe liga, e a cidade é de onde sai a base a partir da qual se mede o raio.
 *
 * O que chega de um formulário aberto chega como as pessoas escrevem:
 * «estofos kid lda» em minúsculas, um telefone com espaços a mais, e
 * «remodeklação». Até aqui a única saída era aprovar primeiro e corrigir
 * depois na ficha do profissional — com o email já enviado e o nome errado já
 * gravado.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const LIB = semComentarios(ler("src/lib/candidaturas.ts"));
const ROTA = semComentarios(ler("src/app/api/admin/candidaturas/route.ts"));
const PAINEL = semComentarios(ler("src/components/admin/AdminCandidaturasPanel.tsx"));

describe("a correcção grava onde tem de gravar", () => {
  it("todos os campos que a aprovação vai usar", () => {
    /*
     * Cada um destes entra em `criarProfissional`. Um campo que se veja no
     * ecrã e não se possa corrigir é pior do que não haver edição nenhuma:
     * dá a entender que ficou arranjado.
     */
    const f = LIB.slice(LIB.indexOf("export async function actualizarCandidatura"));
    for (const campo of ["nome", "email", "telefone", "cidade", "tipoVeiculo", "servicosJson"]) {
      expect(f, `falta ${campo}`).toContain(`${campo} = ?`);
    }
  });

  it("e o texto livre, que é onde o «remodeklação» estava", () => {
    const f = LIB.slice(LIB.indexOf("export async function actualizarCandidatura"));
    expect(f).toContain("mensagem = ?");
  });

  it("SÓ enquanto não estiver tratada", () => {
    /*
     * Depois de aprovada existe uma conta, e é ela que manda. Editar aqui
     * mudava um registo histórico e não mudava nada do que interessa — dois
     * sítios a discordar sobre a mesma pessoa.
     */
    const f = LIB.slice(LIB.indexOf("export async function actualizarCandidatura"));
    expect(f).toContain("WHERE id = ? AND estado IN ('nova', 'convidada')");
  });

  it("e diz se gravou ou não, em vez de fingir que sim", () => {
    // `affectedRows` a zero é uma candidatura já tratada, e o ecrã tem de o
    // dizer: senão ele corrige, carrega em guardar, e nada muda.
    const f = LIB.slice(LIB.indexOf("export async function actualizarCandidatura"));
    expect(f).toContain("affectedRows");
  });
});

describe("a rota", () => {
  const PATCH = (() => {
    const i = ROTA.indexOf("export async function PATCH");
    const j = ROTA.indexOf("export async function", i + 10);
    return j === -1 ? ROTA.slice(i) : ROTA.slice(i, j);
  })();

  it("é PATCH e não POST — o POST desta rota APROVA", () => {
    /*
     * O POST cria uma conta e manda um email a uma pessoa. Uma correcção de
     * texto e uma aprovação a partilharem verbo era um engano à espera de
     * acontecer.
     */
    expect(ROTA).toContain("export async function PATCH");
    expect(PATCH).toContain("actualizarCandidatura(");
    expect(PATCH).not.toContain("criarProfissional");
    expect(PATCH).not.toContain("enviarEmailDeAprovacao");
  });

  it("pede sessão de administrador, como todas as outras", () => {
    expect(PATCH).toContain("requireAdmin(req)");
  });

  it("não deixa passar um email impossível", () => {
    // É para ele que sai o link da palavra-passe: um `@gmail.con` aprovado é
    // uma conta que ninguém abre e um candidato que nunca mais aparece.
    expect(PATCH).toContain("Esse email não parece um email.");
  });

  it("nem um nome vazio", () => {
    expect(PATCH).toContain("O nome não pode ficar vazio.");
  });

  it("e só aceita serviços e veículos que existem", () => {
    // A lista do ecrã é a mesma, mas o corpo do pedido é de quem o mandar.
    expect(PATCH).toContain("SERVICE_CATEGORIES.map((c) => c.id)");
    expect(PATCH).toContain("tipoDeVeiculoValido(veiculo)");
  });

  it("e explica o que fazer quando já foi tratada", () => {
    expect(PATCH).toContain("corrija na ficha do profissional");
  });
});

describe("o ecrã", () => {
  it("tem o botão, e ANTES do que aprova", () => {
    /*
     * A ordem dos botões é a ordem do trabalho: primeiro confere-se e
     * corrige-se, depois é que se cria a conta e sai o email.
     */
    expect(PAINEL).toContain("Editar");
    expect(PAINEL.indexOf("abrirEdicao(c)")).toBeLessThan(
      PAINEL.indexOf("Aprovar e dar acesso"),
    );
  });

  it("abre com o que lá está, e não com campos vazios", () => {
    // Um formulário vazio obriga a reescrever o que estava certo — e é a
    // reescrever que se perde o apelido de alguém.
    expect(PAINEL).toContain("setRascunho({");
    expect(PAINEL).toContain("nome: c.nome,");
    expect(PAINEL).toContain("email: c.email,");
  });

  it("e o ciclo de 30 segundos pára enquanto ele escreve", () => {
    /*
     * Sem isto, a lista renovava-se por baixo de uma correcção a meio e o
     * nome que ele estava a arranjar voltava ao que estava.
     */
    expect(PAINEL).toContain("paused: aEditar !== null");
  });

  it("uma de cada vez", () => {
    // Duas abertas ao mesmo tempo num ecrã que se actualiza sozinho é como se
    // perde o que se estava a escrever.
    expect(PAINEL).toContain("const [aEditar, setAEditar] = useState<number | null>(null);");
  });

  it("e guardar NÃO aprova — o ecrã di-lo por extenso", () => {
    expect(PAINEL).toContain("Guardar não aprova nada");
  });
});
