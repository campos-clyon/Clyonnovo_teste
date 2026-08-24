import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ESTADOS_DO_PROFISSIONAL, estadoValido } from "./edicao-profissional";
import { carteiraDe } from "./carteira";

/**
 * Apagar a conta de um profissional.
 *
 * É a acção mais irreversível do backoffice. O que estes testes protegem não é
 * o desenho do botão — é o conjunto de coisas que, se saírem daqui em silêncio,
 * fazem desaparecer dinheiro de alguém ou o histórico de quem nem sequer é
 * parte nisto.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");
const ROTA = ler("src/app/api/admin/profissionais/[id]/route.ts");
const LISTA = ler("src/app/api/admin/profissionais/route.ts");
const PAINEL = ler("src/components/admin/AdminProfissionaisPanel.tsx");

/** O corpo de `apagarProfissional`, sem os comentários que o explicam. */
const CORPO = (() => {
  const i = DB.indexOf("export async function apagarProfissional(");
  expect(i, "apagarProfissional não encontrada").toBeGreaterThan(-1);
  return DB.slice(i).replace(/\/\*[\s\S]*?\*\//g, "");
})();

describe("os guardas do apagar", () => {
  it("exige que a conta esteja suspensa", () => {
    // Suspender é o que trava a distribuição. Sem esse passo, um pedido novo
    // pode chegar-lhe a meio do apagar.
    expect(CORPO).toContain('p.estado !== "suspenso"');
  });

  it("recusa quando há dinheiro em qualquer um dos três estados", () => {
    /*
     * Cativo, disponível e a caminho. Faltar um só destes é apagar a conta de
     * alguém a quem se deve — e a dívida fica sem nome nem IBAN para a pagar.
     */
    expect(CORPO).toContain("carteira.cativo > 0");
    expect(CORPO).toContain("carteira.disponivel > 0");
    expect(CORPO).toContain("carteira.aCaminho > 0");
  });

  it("recusa quando há um trabalho contratado por confirmar", () => {
    expect(CORPO).toMatch(/estado === "acordada" && n\.confirmadoEm == null/);
  });

  it("lê as negociações sem passar pelos pedidos", () => {
    /*
     * ESTE É O SUBTIL.
     *
     * `negociacoesDoProfissional` faz `JOIN simulatorOrders`, e é INNER: uma
     * negociação cujo pedido já foi expurgado desaparece dela. Como os pedidos
     * são apagados aos 60 dias, um profissional com dinheiro por levantar de um
     * trabalho antigo apareceria a não dever nada — e a conta seria apagada com
     * o saldo lá dentro.
     */
    expect(CORPO).not.toContain("negociacoesDoProfissional");
    expect(CORPO).toMatch(/FROM negociacoes WHERE providerId = \?/);
  });

  it("usa o mesmo cálculo de carteira que o profissional vê", () => {
    // Reescrever a soma em SQL faria com que, mais cedo ou mais tarde, os dois
    // números discordassem. O que decide apagar uma conta não pode ser o que
    // está errado.
    expect(CORPO).toContain("carteiraDe(");
  });

  it("verifica e apaga dentro da mesma transacção, com a linha trancada", () => {
    expect(CORPO).toContain("beginTransaction");
    expect(CORPO).toContain("FOR UPDATE");
  });
});

describe("o que sobra depois de apagar", () => {
  it("mantém a linha quando há história, e só a esvazia", () => {
    /*
     * Um trabalho feito em Julho continua a existir para o CLIENTE que o pagou,
     * e as negociações apontam a esta linha por número. Removê-la fazia
     * desaparecer o trabalho do histórico de quem não pediu nada.
     */
    expect(CORPO).toContain("temPassado");
    expect(CORPO).toContain("Profissional removido");
    expect(CORPO).toMatch(/DELETE FROM providers WHERE id = \?/);
  });

  it("limpa tudo o que identifica a pessoa, incluindo o slug", () => {
    // O slug é único na tabela e leva o nome lá dentro: sobreviveria a tudo o
    // resto se ninguém se lembrasse dele.
    for (const campo of [
      "email = NULL",
      "phone = NULL",
      "nif = NULL",
      "passwordHash = NULL",
      "iban = NULL",
      "ibanTitular = NULL",
      "moradaFiscal = NULL",
    ]) {
      expect(CORPO, `${campo} não é limpo`).toContain(campo);
    }
    expect(CORPO).toContain("slug = CONCAT('removido-', id)");
  });

  it("fecha a porta dos convites por usar", () => {
    // Um convite por usar é uma entrada deixada aberta para uma conta que já
    // não existe.
    expect(CORPO).toContain("DELETE FROM convitesProfissionais");
  });

  it("anonimiza o registo permanente em vez de o apagar", () => {
    expect(CORPO).toContain('anonimizarRegisto({ providerId }, "conta_profissional")');
    expect(CORPO).toContain('acontecimento: "conta_apagada"');
    // O registo do próprio apagar entra na transacção: se o apagar for atrás,
    // a linha que diz que aconteceu vai atrás também.
    expect(CORPO).toContain("registarNaTransaccao");
  });
});

describe("a rota", () => {
  it("exige a palavra escrita à mão", () => {
    expect(ROTA).toContain('corpo.confirmacao !== "APAGAR"');
  });

  it("recebe a confirmação no corpo e não na barra de endereço", () => {
    // Um `?nome=` fica no histórico do browser, nos registos do servidor e em
    // qualquer proxy pelo meio — e o que aqui se escreve é o nome de alguém.
    const delet = ROTA.slice(ROTA.indexOf("export async function DELETE"));
    expect(delet).toContain("req.json()");
    expect(delet).not.toContain("searchParams");
  });

  it("distingue pendências de avaria", () => {
    // 409 e o motivo por extenso: o admin precisa de saber o que resolver antes
    // de tentar outra vez. Um 500 mandava-o procurar no sítio errado.
    expect(ROTA).toContain("ContaComPendencias");
    expect(ROTA).toMatch(/status:\s*409/);
  });
});

describe("o que fica de fora da vista", () => {
  it("as linhas apagadas saem da lista do painel", () => {
    // Sem isto, "Profissional removido" ficava na lista para sempre.
    expect(LISTA).toContain("estado <> 'apagado'");
  });

  it("'apagado' não é um estado que o PATCH consiga pôr", () => {
    /*
     * Só `apagarProfissional` o põe, e só depois de correr os guardas. Se
     * entrasse na lista dos estados válidos, qualquer chamada ao PATCH passava
     * a poder esconder um profissional do painel sem verificação nenhuma — com
     * o dinheiro dele lá dentro.
     */
    expect(ESTADOS_DO_PROFISSIONAL as readonly string[]).not.toContain("apagado");
    expect(estadoValido("apagado")).toBe(false);
  });

  it("o botão só aparece depois de suspender", () => {
    expect(PAINEL).toContain('p.estado === "suspenso" && !aApagar');
  });

  it("o botão de confirmar não liga sem a palavra certa", () => {
    expect(PAINEL).toContain('palavra !== "APAGAR"');
  });
});

describe("a carteira que o guarda consulta", () => {
  it("conta como devido o trabalho confirmado e ainda não levantado", () => {
    // Se este caso desse zero, uma conta com dinheiro por levantar passava o
    // guarda e desaparecia com ele.
    const carteira = carteiraDe(
      [
        {
          negociacaoId: 1,
          estado: "acordada",
          valorAcordado: 100,
          execucaoEnviadaEm: new Date("2026-06-01"),
          confirmadoEm: new Date("2026-06-02"),
          pagoEm: null,
        } as never,
      ],
      [],
      new Date("2026-08-23"),
    );
    expect(carteira.disponivel).toBeGreaterThan(0);
  });

  it("conta como devido o dinheiro ainda cativo", () => {
    const carteira = carteiraDe(
      [
        {
          negociacaoId: 1,
          estado: "acordada",
          valorAcordado: 100,
          execucaoEnviadaEm: new Date("2026-08-22"),
          confirmadoEm: null,
          pagoEm: null,
        } as never,
      ],
      [],
      new Date("2026-08-23"),
    );
    expect(carteira.cativo).toBeGreaterThan(0);
  });
});


describe("as tabelas que o apagar toca", () => {
  it("a pushSubscriptions é garantida antes da transacção", () => {
    /*
     * Ela só nasce quando alguém activa notificações. Em produção ninguém
     * tinha activado, a tabela não existia, e o DELETE dela estoirava a
     * transacção inteira — "Erro ao apagar a conta" por causa de uma tabela
     * de avisos vazia. Foi o primeiro apagar a sério a encontrá-lo.
     */
    const corpoP = DB.slice(DB.indexOf("export async function apagarProfissional"));
    expect(corpoP.slice(0, 2000)).toContain("ensurePushSubscriptionsTable()");
    const corpoC = DB.slice(DB.indexOf("export async function apagarContaDeCliente"));
    expect(corpoC.slice(0, 2000)).toContain("ensurePushSubscriptionsTable()");
  });
});
