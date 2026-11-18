import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  APROVADO_E_CONFIRMADO_PELA_MESMA_PESSOA,
  SO_O_ADMINISTRADOR_APROVA,
  confirmacoesEmFalta,
  confirmouAlgumaDasTres,
  estaVerificado,
  mesmaPessoa,
  porVerificar,
  porqueNaoPodeAprovar,
} from "./parceiro-verificado";
import { pedeOAdministrador } from "./edicao-profissional";

/**
 * APROVAR COM AS TRÊS CONFIRMAÇÕES — 04-11-2026 (d10.2).
 *
 * Aprovar exige o NIF, a identidade e o contacto já confirmados; só o
 * administrador aprova e verifica a guia; fica registado quem fez cada passo.
 * Desde 18-11-2026 (d68, «na empresa só tem 1 admin») sem os «dois pares de
 * olhos»: quem confirmou pode aprovar, e o registo da aprovação diz-o. Os aprovados de antes não perdem a
 * aprovação: ficam «por verificar», e o selo continua a ser só das três.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const tresPorAna = {
  estado: "pendente",
  nifConfirmadoEm: "2026-11-03T10:00:00Z",
  nifConfirmadoPor: "Ana",
  identidadeConfirmadaEm: "2026-11-03T10:05:00Z",
  identidadeConfirmadaPor: "Ana",
  contactoConfirmadoEm: "2026-11-03T10:10:00Z",
  contactoConfirmadoPor: "Ana",
};
const ADMIN = { nome: "Rui", papel: "admin" };
const ASSISTENTE = { nome: "Ana", papel: "assistente" };

describe("quem pode aprovar", () => {
  it("só o administrador", () => {
    expect(porqueNaoPodeAprovar(tresPorAna, ASSISTENTE)).toBe(SO_O_ADMINISTRADOR_APROVA);
  });

  it("e só com as três confirmações já feitas — e diz quais faltam", () => {
    const semContacto = { ...tresPorAna, contactoConfirmadoEm: null, contactoConfirmadoPor: null };
    expect(confirmacoesEmFalta(semContacto)).toEqual(["Contacto"]);
    expect(porqueNaoPodeAprovar(semContacto, ADMIN)).toContain("Contacto");
    expect(porqueNaoPodeAprovar({ estado: "pendente" }, ADMIN)).toContain("NIF, Identidade, Contacto");
  });

  it("e também por quem fez as confirmações (d68: há um só administrador) — e sabe-se que foi", () => {
    const umaPeloAdmin = { ...tresPorAna, identidadeConfirmadaPor: " rui " };
    expect(porqueNaoPodeAprovar(umaPeloAdmin, ADMIN)).toBeNull();
    expect(porqueNaoPodeAprovar(tresPorAna, ADMIN)).toBeNull();
    expect(confirmouAlgumaDasTres(umaPeloAdmin, ADMIN.nome)).toBe(true);
    expect(confirmouAlgumaDasTres(tresPorAna, ADMIN.nome)).toBe(false);
    // As três continuam obrigatórias, mesmo para quem as fez.
    expect(porqueNaoPodeAprovar({ ...umaPeloAdmin, nifConfirmadoEm: null }, ADMIN)).toContain("NIF");
  });

  it("a frase dos «dois pares de olhos» saiu do ecrã e da rota", () => {
    for (const f of [
      "src/lib/parceiro-verificado.ts",
      "src/components/admin/AdminProfissionaisPanel.tsx",
      "src/app/api/admin/profissionais/[id]/route.ts",
    ]) {
      expect(ler(f), f).not.toContain("Peça a outra pessoa");
      expect(ler(f), f).not.toContain("QUEM_CONFIRMA_NAO_APROVA");
      expect(ler(f), f).not.toContain("QUEM_APROVOU_NAO_CONFIRMA");
    }
  });

  it("a mesma pessoa conta-se pelo nome, sem maiúsculas nem espaços a mais; vazio nunca é a mesma", () => {
    expect(mesmaPessoa("Ana  Silva", " ana silva")).toBe(true);
    expect(mesmaPessoa("Ana", "Rita")).toBe(false);
    expect(mesmaPessoa("", "")).toBe(false);
    expect(mesmaPessoa(null, null)).toBe(false);
  });

  it("aprovar e verificar a guia são decisões do administrador; o resto não", () => {
    expect(pedeOAdministrador({ estado: "aprovado" })).toBe("aprovar");
    expect(pedeOAdministrador({ verificarGuia: true })).toBe("verificar_guia");
    expect(pedeOAdministrador({ estado: "suspenso" })).toBeNull();
    expect(pedeOAdministrador({ confirmacoes: { nif: true } })).toBeNull();
  });
});

describe("os aprovados de antes", () => {
  it("não perdem a aprovação: ficam «por verificar» até terem as três, e o selo continua só com as três", () => {
    const aprovadoSem = { estado: "aprovado", nifConfirmadoEm: "2026-11-01" };
    expect(porVerificar(aprovadoSem)).toBe(true);
    expect(estaVerificado(aprovadoSem)).toBe(false);
    const aprovadoCom = { ...tresPorAna, estado: "aprovado" };
    expect(porVerificar(aprovadoCom)).toBe(false);
    expect(estaVerificado(aprovadoCom)).toBe(true);
    expect(porVerificar({ ...tresPorAna, estado: "pendente" })).toBe(false);
  });

  it("nada na base os desaprova: a migração só acrescenta colunas", () => {
    const db = ler("src/lib/db.ts");
    expect(db).toContain('name: "aprovadoEm"');
    expect(db).toContain('name: "aprovadoPor"');
    expect(db).not.toMatch(/UPDATE providers SET estado = 'pendente'/);
  });
});

describe("a rota cumpre-o antes de escrever, e regista quem foi", () => {
  const rota = ler("src/app/api/admin/profissionais/[id]/route.ts");

  it("a regra corre antes de qualquer escrita", () => {
    const regra = rota.indexOf("const soDoAdministrador = pedeOAdministrador(corpo);");
    expect(regra).toBeGreaterThan(-1);
    for (const escrita of ["await mudarEmailDoProfissional(", "await actualizarPerfilDoProfissional(", "await definirEstadoDoProfissional(", "await verificarGuiaDeTransporte("]) {
      expect(rota.indexOf(escrita), escrita).toBeGreaterThan(regra);
    }
    expect(rota).toContain('soDoAdministrador && colab.papel !== "admin"');
    expect(rota).toContain("porqueNaoPodeAprovar(actual, { nome: colab.nome, papel: colab.papel })");
    expect(rota).not.toContain("porqueNaoPodeConfirmar");
  });

  it("aprovar pela mesma pessoa que confirmou fica no registo da aprovação (d68)", () => {
    expect(APROVADO_E_CONFIRMADO_PELA_MESMA_PESSOA).toBe("aprovado e confirmado pela mesma pessoa");
    expect(rota).toContain("mesmaPessoaConfirmouEAprova = confirmouAlgumaDasTres(actual, colab.nome)");
    const marca = 'acontecimento: "profissional_aprovado"';
    const i = rota.indexOf(marca);
    expect(i).toBeGreaterThan(rota.indexOf("await definirEstadoDoProfissional("));
    const bloco = rota.slice(i, i + 600);
    expect(bloco).toContain("providerId,");
    expect(bloco).toContain("APROVADO_E_CONFIRMADO_PELA_MESMA_PESSOA");
  });

  it("aprovar grava quem aprovou e quando", () => {
    expect(rota).toContain("definirEstadoDoProfissional(providerId, corpo.estado, colab.nome)");
    const db = ler("src/lib/db.ts");
    const f = db.slice(db.indexOf("export async function definirEstadoDoProfissional"));
    expect(f.slice(0, 1200)).toContain("aprovadoEm = NOW(), aprovadoPor = ?");
    expect(ler("src/app/api/admin/profissionais/route.ts")).toContain("aprovadoEm, aprovadoPor");
  });

  it("o backoffice mostra «por verificar», quem aprovou, e o porquê de não poder aprovar", () => {
    const painel = ler("src/components/admin/AdminProfissionaisPanel.tsx");
    expect(painel).toContain("por verificar");
    expect(painel).toContain("Aprovado por {p.aprovadoPor}");
    expect(painel).toContain("disabled={ocupado || naoPodeAprovar != null}");
    expect(painel).toContain('{ id: "sem_confirmacoes", nome: "Aprovados por verificar" }');
  });
});
