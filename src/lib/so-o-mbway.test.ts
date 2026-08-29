import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guardar o MB WAY não pode exigir voltar a escrever o IBAN.
 *
 * "Já tenho o IBAN salvo, só quero colocar o MB WAY."
 *
 * O ecrã só devolve os últimos quatro dígitos — «LT72 ···· 0473» — e a caixa
 * mostrava-se vazia por causa disso. Mas o ESTADO continuava a ter a máscara lá
 * dentro, e era a máscara que seguia para o servidor: chegava um IBAN cheio de
 * pontos medianos, falhava a validação, e a resposta era «IBAN inválido.
 * Confirme os dígitos» a alguém que não tinha escrito dígito nenhum.
 *
 * Nada no ecrã dizia o que estava errado, porque nada estava errado do lado
 * dele.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const PERFIL = ler("src/app/profissionais/painel/Perfil.tsx");
const ROTA = ler("src/app/api/profissionais/perfil/route.ts");

describe("o IBAN por tocar não viaja", () => {
  it("o ecrã não envia a chave quando o campo está como veio", () => {
    // Sem a chave, o servidor guarda o que já tem. Com ela, valida.
    expect(PERFIL).toContain('const porTocar = dados.iban.includes("·");');
    expect(PERFIL).toContain("...(porTocar ? {} : { iban: dados.iban })");
  });

  it("o MB WAY e o titular seguem sempre", () => {
    // São eles que ele veio cá mudar.
    const i = PERFIL.indexOf("const porTocar");
    const bloco = PERFIL.slice(i, i + 400);
    expect(bloco).toContain("ibanTitular: dados.ibanTitular");
    expect(bloco).toContain("mbway: dados.mbway");
  });

  it("o servidor ignora uma máscara em vez de a recusar", () => {
    /*
     * O travão do lado de lá, para nenhum outro caminho tropeçar no mesmo
     * sítio. Ignorar é seguro: o ponto mediano não existe em IBAN nenhum, por
     * isso isto nunca pode ser uma conta a sério a ser descartada.
     */
    expect(ROTA).toContain('if (bruto.includes("·")) {');
    expect(ROTA).toContain("/* mantém-se o que está gravado */");
  });

  it("apagar o campo continua a apagar o IBAN", () => {
    // Escrever por cima troca de conta; apagar o texto apaga-a. As duas
    // continuam a funcionar — o que mudou foi só o caso de não se lhe tocar.
    expect(ROTA).toContain("} else if (!bruto) {");
    expect(ROTA).toContain("mudancas.iban = null;");
  });
});

describe("um enfeite não derruba o painel", () => {
  const PEDIDOS = ler("src/app/api/profissionais/meus-pedidos/route.ts");

  it("o contexto do cliente falha em silêncio", () => {
    // "Cliente desde X · N trabalhos" é agradável de ter; a lista é o painel
    // inteiro. Ele não pode perder tudo por causa de uma linha de enfeite.
    expect(PEDIDOS).toContain("[profissionais/meus-pedidos] contexto do cliente");
  });

  it("as distâncias falham em silêncio", () => {
    // Saem de uma API da Google e de uma tabela de cache: duas coisas que
    // podem estar em baixo sem o painel ter culpa.
    expect(PEDIDOS).toContain("[profissionais/meus-pedidos] distancias");
    expect(PEDIDOS).toContain("medidas = linhas.map(() => null);");
  });

  it("quando falha mesmo, a mensagem diz o que fazer", () => {
    // "Erro ao listar" é uma parede: quem a lê fica sem saber por onde começar.
    expect(PEDIDOS).toContain("Tente outra vez dentro de um minuto");
    expect(PEDIDOS).toContain("detalhe:");
    expect(PEDIDOS).not.toContain('{ error: "Erro ao listar" }');
  });
});

describe("a consulta garante as tabelas que lê", () => {
  it("negociacoesDoProfissional migra também os pedidos", () => {
    /*
     * Lê sete colunas de `simulatorOrders` e não garantia nenhuma. Enquanto as
     * colunas já existirem passa despercebido; no dia em que se acrescenta uma
     * nova — como aconteceu com `baseDoPreco` — e o painel do profissional é a
     * primeira coisa aberta, a consulta parte com "Unknown column".
     */
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function negociacoesDoProfissional");
    const bloco = DB.slice(i, DB.indexOf("const [rows]", i));
    expect(bloco).toContain("await ensureNegociacoesTable();");
    expect(bloco).toContain("await ensureSimulatorOrdersTable();");
  });
});
