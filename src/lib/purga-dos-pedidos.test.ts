import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DIAS_DE_RETENCAO_DOS_PEDIDOS, DIAS_PARA_OS_ABANDONADOS } from "./retencao";

/**
 * A PURGA DOS 60 DIAS — verificada, e construída.
 *
 * "Pode confirmar se os pedidos estão a ser excluídos automaticamente após 60
 * dias? Temos de ter o histórico completo do pedido para caso de processos
 * judiciais, mas temos que eliminar as imagens e os pedidos da base de dados."
 * — 10-09-2026.
 *
 * Não estavam. O código FALAVA da purga como se existisse — o acontecimento
 * `pedido_expurgado`, a opção "só a purga automática o usa", comentários a
 * dizer "os pedidos são expurgados aos 60 dias" — e não havia cron nenhum. E
 * apagar um pedido à mão deixava as fotografias no Blob para sempre.
 *
 * Este ficheiro guarda as três coisas que não podem voltar a partir-se: que a
 * purga CORRE, que NUNCA leva dinheiro por pagar, e que as imagens saem mesmo.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DB = ler("src/lib/db.ts");
const ROTA = ler("src/app/api/cron/purgar-pedidos/route.ts");
const RETENCAO = ler("src/lib/retencao.ts");
const VERCEL = JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };

/**
 * O corpo de uma função de db.ts. Corta na PRÓXIMA declaração de topo, e não
 * numa chaveta: o ficheiro tem CRLF no Windows e LF na acção, e uma âncora
 * `"\n}\n"` só casava num dos dois. A última função do ficheiro vai até ao fim.
 */
const corpoDe = (nome: string) => {
  const i = DB.indexOf(`export async function ${nome}(`);
  expect(i, `${nome} não existe`).toBeGreaterThan(-1);
  const seguinte = DB.slice(i + 1).search(/\r?\n(export |\/\/ ──)/);
  return seguinte === -1 ? DB.slice(i) : DB.slice(i, i + 1 + seguinte);
};

describe("a purga corre", () => {
  it("tem cron, e é diário", () => {
    // Semanal, um pedido terminado a uma terça esperava até seis dias a mais.
    const cron = VERCEL.crons.find((c) => c.path === "/api/cron/purgar-pedidos");
    expect(cron).toBeDefined();
    const partes = cron!.schedule.split(" ");
    expect(partes[2]).toBe("*");
    expect(partes[4]).toBe("*");
  });

  it("falha fechada sem CRON_SECRET — aberta, era um endereço público que apaga pedidos", () => {
    expect(ROTA).toContain("process.env.CRON_SECRET");
    expect(ROTA).toContain("status: 503");
    expect(ROTA).toContain("status: 401");
  });

  it("o prazo é o da constante, e a constante são 60 dias", () => {
    expect(DIAS_DE_RETENCAO_DOS_PEDIDOS).toBe(60);
    // Sem o parêntese de fecho: a chamada ganhou um segundo argumento (a
    // trava do modo seco), e o que este teste guarda é o PRAZO vir da
    // constante — não a forma da chamada.
    expect(ROTA).toContain("purgarPedidosTerminados(DIAS_DE_RETENCAO_DOS_PEDIDOS");
  });

  it("nunca em silêncio: o que ficou por fazer é dito", () => {
    // Um tecto que não se anuncia lê-se como "estava tudo feito".
    expect(ROTA).toContain("r.restantes > 0");
    const purga = corpoDe("purgarPedidosTerminados");
    expect(purga).toContain("restantes: Math.max(0, elegiveis - ids.length)");
  });
});

describe("o que conta como terminado, e o que nunca se purga", () => {
  const purga = corpoDe("purgarPedidosTerminados");

  it("os que acabaram, aos 60 dias", () => {
    expect(purga).toContain(
      "COALESCE(o.status, 'pendente') IN ('concluido', 'cancelado', 'arquivado')",
    );
  });

  /*
   * E OS ABANDONADOS, AOS 90.
   *
   * "Vamos apagar os pendentes após 90 dias." — 14-09-2026. O estado por
   * omissão é `pendente`, e um pedido que o cliente abandona a meio ficava lá
   * para sempre, com a morada e as fotografias de dentro de casa dele. Eram os
   * únicos que a purga nunca tocava — e são a maioria dos antigos.
   *
   * Noventa e não sessenta porque estes não têm data de fim: um `pendente` de
   * há 60 dias ainda pode ser um cliente que voltou de férias.
   */
  it("e os abandonados a meio, aos 90 — com um prazo próprio", () => {
    expect(purga).toContain(
      "COALESCE(o.status, 'pendente') NOT IN ('concluido', 'cancelado', 'arquivado')",
    );
    expect(purga).toContain("INTERVAL ${abandonados} DAY");
    expect(DIAS_PARA_OS_ABANDONADOS).toBe(90);
    expect(DIAS_PARA_OS_ABANDONADOS).toBeGreaterThan(DIAS_DE_RETENCAO_DOS_PEDIDOS);
  });

  it("o cron passa-lhe os dois prazos", () => {
    expect(ROTA).toContain("diasDosAbandonados: DIAS_PARA_OS_ABANDONADOS");
  });

  it("conta a partir de quando terminou, não de quando nasceu", () => {
    // `updatedAt` e não `createdAt`: qualquer edição atrasa a purga. É a
    // direcção certa de errar.
    expect(purga).toContain("${relogio} < NOW() - INTERVAL");
    expect(purga).not.toContain("o.createdAt <");
  });

  /*
   * E O RELÓGIO É O DA ÚLTIMA COISA QUE ACONTECEU — ao pedido OU às
   * negociações dele.
   *
   * Era só `o.updatedAt`, e `gravarNegociacao` não lhe toca: uma negociação
   * podia estar a andar — propostas a chegar, o cliente a responder — com o
   * relógio do pedido parado há noventa dias. A purga levava-a por baixo de
   * uma conversa viva.
   */
  it("uma negociação a mexer atrasa a purga do pedido", () => {
    expect(purga).toContain("const relogio = `GREATEST(");
    expect(purga).toContain("SELECT MAX(g2.updatedAt) FROM negociacoes g2 WHERE g2.pedidoId = o.id");
  });

  /*
   * O TESTE QUE IMPORTA, E QUE FICOU MAIS APERTADO A 14-09-2026.
   *
   * Era «nunca um pedido com dinheiro POR PAGAR»: `acordada` sem `pagoEm`. Um
   * trabalho já pago continuava a poder ser purgado — e a carteira do
   * profissional é CALCULADA a partir destas linhas (ver `carteiraDe`), por
   * isso apagá-la tirava-lhe o total ganho e o movimento que explica o saldo.
   *
   * "Quero que garanta que os valores gerados pelos trabalhos concluídos não
   * sejam apagados das contas dos pros nem da nossa base."
   *
   * Agora é qualquer `acordada`, paga ou não: um pedido que produziu trabalho
   * não se purga, seja qual for a idade dele.
   */
  it("NUNCA leva um pedido que produziu trabalho — pago ou por pagar", () => {
    expect(purga).toContain("NOT EXISTS");
    expect(purga).toContain("g.estado IN ('acordada', 'aguarda_contratacao')");
    // A guarda antiga era mais fraca e deixava passar o que já estava pago.
    expect(purga).not.toContain("g.estado = 'acordada' AND g.pagoEm IS NULL");
  });

  /*
   * E PROTEGE PELA PROVA, NÃO PELA PALAVRA DO ESTADO.
   *
   * Uma primeira versão desta guarda dizia só `estado = 'acordada'`, e tinha
   * um buraco que três revisores independentes encontraram no mesmo dia:
   * `matarNegociacoesDoPedido` (db.ts) põe TODAS as negociações de um pedido
   * em 'morta' — sem olhar a `pagoEm`, `confirmadoEm` ou `execucaoEnviadaEm` —
   * e `cancelarPedido` chama-a sempre. Cancelar um pedido com trabalho feito e
   * PAGO desarmava a guarda, e sessenta dias depois o dinheiro saía da conta do
   * profissional.
   *
   * Um valor combinado, um trabalho entregue, uma confirmação ou um pagamento
   * são factos: ficam nas colunas e nenhum cancelar os apaga. O estado é uma
   * palavra que muda.
   */
  it("e o cancelar não a desarma — protege pelas colunas do dinheiro", () => {
    expect(purga).toContain("g.valorAcordado IS NOT NULL");
    expect(purga).toContain("g.execucaoEnviadaEm IS NOT NULL");
    expect(purga).toContain("g.confirmadoEm IS NOT NULL");
    expect(purga).toContain("g.pagoEm IS NOT NULL");
  });

  it("o cron tem tempo para a passagem inteira e para escrever o que fez", () => {
    // A linha de resumo é escrita no FIM: sem tecto, uma passagem cheia era
    // cortada a meio e a única prova de que a purga correu não chegava a ser
    // escrita.
    expect(ROTA).toContain("export const maxDuration");
  });

  it("não desarma o guarda de dentro", () => {
    // A guarda está no SELECT; a de `deleteSimulatorOrder` fica por cima dela.
    expect(purga).not.toContain("mesmoComTrabalhoEmCurso");
  });

  it("um de cada vez, pela mesma porta do botão — é o que deixa o retrato", () => {
    expect(purga).toContain("await deleteSimulatorOrder(id, {");
    expect(purga).toContain('acontecimento: "pedido_expurgado"');
    expect(purga).toContain('autorTipo: "sistema"');
    // Um que falhe não pára os outros.
    expect(purga).toContain("falhados.push({ pedidoId: id");
  });
});

describe("as imagens saem mesmo — também quando se apaga à mão", () => {
  const apagar = corpoDe("deleteSimulatorOrder");

  it("recolhe as fotografias do pedido E as da prova de execução", () => {
    // Antes só as de conta apagada saíam, e só as do pedido. As provas —
    // fotografias de dentro de casa — ficavam no Blob para sempre.
    expect(apagar).toContain("filesJson");
    expect(apagar).toContain("n.provaJson");
    expect(apagar).toContain("prova.fotos");
  });

  it("apaga do Blob DEPOIS de a transacção fechar", () => {
    // Uma chamada de rede a meio dela prende a linha enquanto se espera pela
    // internet — a mesma regra do apagamento de conta.
    const commit = apagar.indexOf("await conn.commit();");
    const blob = apagar.indexOf("apagarFotosDoBlob(fotos)");
    expect(commit).toBeGreaterThan(-1);
    expect(blob).toBeGreaterThan(commit);
  });

  it("o registo guarda QUANTAS havia, não quais", () => {
    expect(apagar).toContain("fotografias: fotos.length");
    expect(apagar).not.toContain("fotos: fotos,");
  });

  it("o retrato distingue prazo de decisão", () => {
    expect(apagar).toContain('contexto.acontecimento ?? "pedido_apagado"');
  });
});

describe("a trava: modo seco enquanto não houver cópia de segurança", () => {
  const purga = corpoDe("purgarPedidosTerminados");

  it("por omissão NÃO apaga — arma-se de propósito, não por esquecimento", () => {
    /*
     * A auditoria de 11-09-2026 apanhou o que faltava a este trabalho: um cron
     * diário e irreversível sem prova de que exista cópia de segurança de onde
     * recuperar. A condição está apertada, mas "apertada" não é "reversível".
     *
     * O sentido do `!== false` é a decisão: quem chama sem dizer nada apaga
     * (é o contrato da função), e quem decide é a ROTA, que lê a variável e
     * por omissão NÃO arma. Assim a função continua honesta e o cron seguro.
     */
    expect(RETENCAO).toContain("export function purgaArmada()");
    expect(RETENCAO).toContain('=== "sim"');
    expect(ROTA).toContain("const armada = purgaArmada();");
    // Sem o fecho: a chamada ganhou o segundo prazo, o dos abandonados.
    expect(ROTA).toContain("aSerio: armada,");
  });

  it("a seco devolve o que APAGARIA, e sai antes de apagar", () => {
    const seco = purga.indexOf("if (!aSerio) {");
    expect(seco).toBeGreaterThan(-1);
    // O `return` do modo seco vem ANTES do ciclo que chama o apagar.
    expect(seco).toBeLessThan(purga.indexOf("await deleteSimulatorOrder(id, {"));
    expect(purga).toContain("aSerio: false");
  });

  it("conta as fotografias sem lhes tocar", () => {
    // O número que interessa ver antes de armar é o das imagens: é o espaço.
    expect(purga).toContain("await contarFotografiasDe(ids)");
    expect(DB).toContain("async function contarFotografiasDe(");
  });

  it("a seco regista SEMPRE, mesmo o zero — é o número que se quer ver", () => {
    expect(ROTA).toContain("|| !r.aSerio");
    expect(ROTA).toContain("MODO SECO");
    expect(ROTA).toContain("PURGA_ARMADA=sim");
  });

  it("e o .env.example diz que está travada e porquê", () => {
    const EXEMPLO = ler(".env.example");
    expect(EXEMPLO).toMatch(/^PURGA_ARMADA=/m);
    expect(EXEMPLO).toContain("MODO SECO");
    expect(EXEMPLO).toContain("cópia de segurança");
  });
});
