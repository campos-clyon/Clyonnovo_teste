import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validarDados, CAMPOS_DE_DADOS, CAMPOS_SO_DO_ADMINISTRADOR } from "./edicao-profissional";
import { lerMbway } from "./mbway";

/*
 * OS DADOS DA PESSOA NO «EDITAR PERFIL» DO BACKOFFICE — 01-10-2026.
 *
 * «Não dá para editar outras informações mais detalhadas» — e o dono escolheu
 * «Tudo»: nome, telefone, NIF, viatura, morada fiscal, email, IBAN e MB WAY.
 * As regras são as do perfil que o profissional edita; o email e o pagamento
 * só o administrador os muda.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const erros = (r: ReturnType<typeof validarDados>) => (r.ok ? [] : r.erros.map((e) => e.campo));
const colunas = (r: ReturnType<typeof validarDados>) => (r.ok ? r.dados.colunas : {});

describe("validarDados", () => {
  it("só devolve o que veio — o resto fica como está", () => {
    const r = validarDados({ telefone: "912 345 678" });
    expect(r.ok).toBe(true);
    expect(colunas(r)).toEqual({ phone: "912 345 678" });
  });

  it("o nome: nem curto, nem com sinais, nem uma morada", () => {
    expect(colunas(validarDados({ nome: "Jorge Mudanças" }))).toEqual({ name: "Jorge Mudanças" });
    expect(erros(validarDados({ nome: "J" }))).toContain("nome");
    expect(erros(validarDados({ nome: "<script>" }))).toContain("nome");
    expect(erros(validarDados({ nome: "Rua das Flores 12" }))).toContain("nome");
  });

  it("telefone e NIF com as regras da inscrição; NIF vazio apaga-se", () => {
    expect(erros(validarDados({ telefone: "123" }))).toContain("telefone");
    expect(erros(validarDados({ nif: "123456780" }))).toContain("nif");
    expect(colunas(validarDados({ nif: "" }))).toEqual({ nif: null });
  });

  it("o email vai à parte, em minúsculas, e um email partido é recusado", () => {
    const r = validarDados({ email: "  Jorge@Exemplo.PT " });
    expect(r.ok && r.dados.email).toBe("jorge@exemplo.pt");
    expect(colunas(r)).toEqual({});
    expect(erros(validarDados({ email: "jorge" }))).toContain("email");
  });

  it("a morada fiscal: código postal normalizado, vazio apaga", () => {
    const r = validarDados({ moradaFiscal: "Rua A, 1", codigoPostalFiscal: "2725571", localidadeFiscal: "" });
    expect(colunas(r)).toEqual({ moradaFiscal: "Rua A, 1", codigoPostalFiscal: "2725-571", localidadeFiscal: null });
    expect(erros(validarDados({ codigoPostalFiscal: "27" }))).toContain("codigoPostalFiscal");
  });

  it("a viatura só com os nomes que a conta do valor por carga sabe ler", () => {
    expect(colunas(validarDados({ tipoVeiculo: "Carrinha_Media" }))).toEqual({ tipoVeiculo: "carrinha_media" });
    expect(erros(validarDados({ tipoVeiculo: "carrinha media" }))).toContain("tipoVeiculo");
    expect(colunas(validarDados({ tipoVeiculo: "" }))).toEqual({ tipoVeiculo: null });
  });

  it("o IBAN: a máscara é o que já lá está, vazio apaga, um errado é recusado", () => {
    expect(colunas(validarDados({ iban: "PT50 ···· 1234" }))).toEqual({});
    expect(colunas(validarDados({ iban: "" }))).toEqual({ iban: null });
    // O exemplo canónico de um IBAN português, e o mesmo com o último dígito trocado.
    expect(colunas(validarDados({ iban: "PT50 0002 0123 1234 5678 9015 4" }))).toEqual({
      iban: "PT50000201231234567890154",
    });
    expect(erros(validarDados({ iban: "PT50 0002 0123 1234 5678 9015 5" }))).toContain("iban");
  });

  it("o MB WAY: só dígitos, nove, a começar por 9", () => {
    expect(colunas(validarDados({ mbway: "+351 912 345 678" }))).toEqual({ mbway: "912345678" });
    expect(erros(validarDados({ mbway: "212345678" }))).toContain("mbway");
    expect(lerMbway("")).toEqual({ ok: true, valor: null });
  });
});

describe("o que só o administrador muda", () => {
  it("o email e o pagamento — e são todos campos de dados", () => {
    for (const c of ["email", "iban", "ibanTitular", "mbway"]) {
      expect(CAMPOS_SO_DO_ADMINISTRADOR as readonly string[]).toContain(c);
    }
    for (const c of CAMPOS_SO_DO_ADMINISTRADOR) {
      expect(CAMPOS_DE_DADOS as readonly string[]).toContain(c);
    }
  });

  it("a rota recusa-os a um assistente, antes de escrever o que quer que seja", () => {
    const ROTA = semNotas(ler("src/app/api/admin/profissionais/[id]/route.ts"));
    expect(ROTA).toContain(
      'CAMPOS_SO_DO_ADMINISTRADOR.some((k) => k in corpo) && colab.papel !== "admin"',
    );
    const valida = ROTA.indexOf("validarDados(corpo)");
    expect(valida).toBeGreaterThan(-1);
    // Validar depois de uma escrita deixava metade do pedido gravado.
    for (const escrita of ["definirEstadoDoProfissional(", "UPDATE providers SET city", "actualizarProfissional("]) {
      expect(ROTA.indexOf(escrita), escrita).toBeGreaterThan(valida);
    }
  });

  it("e o painel só lhos mostra para editar a ele", () => {
    const PAINEL = semNotas(ler("src/components/admin/AdminProfissionaisPanel.tsx"));
    expect(PAINEL).toContain('eAdministrador={papel === "admin"}');
    expect(PAINEL).toContain("if (eAdministrador) {");
    // Só vai o que mudou — mandar tudo voltava a validar dados antigos.
    expect(PAINEL).toContain("...dadosMudados,");
  });
});

describe("mudar o email", () => {
  const DB = ler("src/lib/db.ts");
  const i = DB.indexOf("export async function mudarEmailDoProfissional");
  const CORPO = DB.slice(i, DB.indexOf("\n}\n", i));

  it("recusa o de outra conta, e queima o link que foi para o antigo", () => {
    expect(i).toBeGreaterThan(-1);
    expect(CORPO).toContain("AND id <> ?");
    expect(CORPO).toContain("throw new EmailDeOutraConta(");
    expect(CORPO).toContain("senhaTokenHash = NULL, senhaTokenExpiraEm = NULL");
  });
});

describe("tudo o que se valida chega mesmo à base", () => {
  /*
   * A lição do MB WAY (`perfil-grava-o-que-recebe.test.ts`): uma coluna que a
   * lista de permitidas de `actualizarPerfilDoProfissional` não conhece é
   * descartada em silêncio. A lista sai do código, e não daqui.
   */
  it("cada coluna de validarDados está nas permitidas", () => {
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function actualizarPerfilDoProfissional");
    const j = DB.indexOf("];", DB.indexOf("const permitidas = [", i));
    expect(i).toBeGreaterThan(-1);
    const permitidas = [...DB.slice(i, j).matchAll(/"(\w+)"/g)].map((m) => m[1]);
    expect(permitidas.length).toBeGreaterThan(10);

    const tudo = validarDados({
      nome: "Jorge Mudanças",
      telefone: "912345678",
      nif: "",
      moradaFiscal: "Rua A, 1",
      codigoPostalFiscal: "2725-571",
      localidadeFiscal: "Sintra",
      tipoVeiculo: "camiao",
      iban: "",
      ibanTitular: "Jorge",
      mbway: "912345678",
    });
    expect(tudo.ok).toBe(true);
    const gravadas = Object.keys(colunas(tudo));
    // Todos os campos menos o email, que tem função própria.
    expect(gravadas.length).toBe(CAMPOS_DE_DADOS.length - 1);
    for (const c of gravadas) expect(permitidas, c).toContain(c);
  });
});

describe("a lista do backoffice", () => {
  const LISTA = semNotas(ler("src/app/api/admin/profissionais/route.ts"));

  it("diz se há palavra-passe, e nunca o hash", () => {
    expect(LISTA).toContain("(passwordHash IS NOT NULL) AS temPalavraPasse");
    expect(LISTA.replace("(passwordHash IS NOT NULL)", "")).not.toContain("passwordHash");
  });

  it("e o IBAN vai encurtado para o browser", () => {
    expect(LISTA).toContain("ibanEncurtado(p.iban)");
  });
});
