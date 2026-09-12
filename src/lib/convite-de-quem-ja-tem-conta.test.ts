import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * "PORQUE ESTÁ ESTE CONVITE SEM RESPOSTA SE AS 2 CONTAS JÁ FORAM CRIADAS?"
 * — 12-09-2026, a olhar para um ecrã que dizia «4 convites à espera de
 * resposta» sobre gente que estava inscrita e aprovada na lista logo abaixo.
 *
 * A pergunta certa, e a resposta era um defeito com meses.
 *
 * HÁ DUAS PORTAS PARA ALGUÉM SE TORNAR PROFISSIONAL, e só uma fechava a porta
 * atrás de si:
 *
 *   · o convite é enviado, a pessoa preenche o formulário da inscrição, e a
 *     rota da inscrição gasta o convite — `marcarConviteUsado`;
 *   · a CANDIDATURA é aprovada no painel, que chama `criarProfissional`
 *     directamente e nunca soube que havia um convite para aquele email.
 *
 * Pela segunda porta, o convite ficava "por usar" para sempre. E como ele
 * tinha nascido justamente dessa candidatura — as linhas diziam «Candidatura
 * pelo site (#1)» e «(#2)» — a porta errada era a mais provável das duas.
 *
 * O que isso custava não era só um ecrã confuso: era um botão "Reenviar" ao
 * lado do nome de quem já tem conta, e um número no topo que mentia sobre o
 * trabalho que faltava fazer.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");
const CANDIDATURAS = ler("src/app/api/admin/candidaturas/route.ts");
const INSCRICAO = ler("src/app/api/profissionais/inscricao/route.ts");

describe("as duas portas fecham as duas", () => {
  it("a inscrição por convite continua a gastar o convite", () => {
    // Este caminho sempre funcionou, e é o que não se pode partir ao corrigir
    // o outro.
    expect(INSCRICAO).toContain("await marcarConviteUsado(convite.id, id);");
  });

  it("a aprovação de uma candidatura passou a fechar o convite também", () => {
    expect(CANDIDATURAS).toContain("consumirConvitesDoEmail");
    // Nos DOIS ramos: o que cria a conta, e o que encontra uma conta já feita.
    const quantas = CANDIDATURAS.split("consumirConvitesDoEmail(").length - 1;
    expect(quantas).toBeGreaterThanOrEqual(2);
  });

  it("e falhar a arrumar não desfaz a conta que acabou de ser criada", () => {
    /*
     * A conta já existe quando isto corre. Um convite por fechar é um ecrã
     * confuso; um erro devolvido aqui era uma candidatura aprovada que o
     * painel dá por falhada, e alguém a tentar outra vez.
     */
    const i = CANDIDATURAS.indexOf("const convitesFechados = await consumirConvitesDoEmail(");
    expect(i).toBeGreaterThan(-1);
    expect(CANDIDATURAS.slice(i, i + 220)).toContain("catch(");
  });

  it("quem aprova fica a saber que arrumou alguma coisa", () => {
    // Sem isto, a correcção seria invisível: o painel dizia o mesmo de sempre
    // e ninguém sabia porque é que a lista encolheu.
    expect(CANDIDATURAS).toContain("convite(s) por usar arrumado(s)");
  });
});

describe("fecha-se pelo EMAIL, e não pelo id do convite", () => {
  it("porque quem aprova a candidatura não tem o convite na mão", () => {
    expect(DB).toContain("export async function consumirConvitesDoEmail(");
    const i = DB.indexOf("export async function consumirConvitesDoEmail(");
    const corpo = DB.slice(i, i + 1200);
    expect(corpo).toContain("LOWER(TRIM(email)) = ?");
    // Só os que ainda estão vivos: um convite já usado ou anulado não se
    // reescreve, e a data dele é o registo de quando aconteceu.
    expect(corpo).toContain("usadoEm IS NULL AND revogadoEm IS NULL");
    // O email vai normalizado dos dois lados — "Ana@Gmail.com " é a mesma
    // pessoa que "ana@gmail.com".
    expect(corpo).toContain('.trim().toLowerCase()');
  });

  it("devolve quantos fechou", () => {
    const i = DB.indexOf("export async function consumirConvitesDoEmail(");
    expect(DB.slice(i, i + 1200)).toContain("return Number(res.affectedRows ?? 0);");
  });
});

describe("os que ficaram órfãos antes da correcção", () => {
  it("arrumam-se sozinhos quando alguém abre a lista", () => {
    /*
     * A correcção acima só vale daqui para a frente. Os convites que já
     * estavam órfãos continuariam a encher a lista dos que esperam resposta —
     * e a resposta a "porque está este convite sem resposta?" continuaria a
     * ser "porque ninguém o foi lá fechar à mão".
     */
    expect(DB).toContain("async function arrumarConvitesDeQuemJaTemConta(");
    const i = DB.indexOf("async function arrumarConvitesDeQuemJaTemConta(");
    const corpo = DB.slice(i, i + 1400);
    expect(corpo).toContain("JOIN providers p ON LOWER(TRIM(p.email)) = LOWER(TRIM(c.email))");
    expect(corpo).toContain("WHERE c.usadoEm IS NULL AND c.revogadoEm IS NULL");
  });

  it("é ESCRITA, e não maquilhagem do ecrã", () => {
    /*
     * Esconder as linhas na leitura deixava o mesmo engano em todos os outros
     * sítios que leiam a tabela. A linha passa a dizer a verdade.
     */
    const i = DB.indexOf("async function arrumarConvitesDeQuemJaTemConta(");
    expect(DB.slice(i, i + 1400)).toContain("UPDATE convitesProfissionais c");
  });

  it("corre ANTES de a lista ser lida, e nunca a impede de aparecer", () => {
    const i = DB.indexOf("export async function listarConvites(");
    const corpo = DB.slice(i, i + 900);
    expect(corpo).toContain("await arrumarConvitesDeQuemJaTemConta();");
    expect(corpo.indexOf("arrumarConvitesDeQuemJaTemConta")).toBeLessThan(
      corpo.indexOf("SELECT * FROM convitesProfissionais"),
    );
    // Uma arrumação que falhe não pode calar a lista inteira.
    const a = DB.indexOf("async function arrumarConvitesDeQuemJaTemConta(");
    expect(DB.slice(a, a + 1400)).toContain(".catch(");
  });
});
