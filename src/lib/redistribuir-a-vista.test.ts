import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * REDISTRIBUIR, À VISTA — E UMA NEGOCIAÇÃO MORTA DEIXA DE TRANCAR O PEDIDO.
 *
 * "Eu quero redistribuir esse pedido, mude o botão «Ficha e distribuição»
 *  para fazer isso." — 21-09-2026, sobre o #355.
 *
 * O botão já existia e só aparecia quando NINGUÉM tinha sido notificado. No
 * caso comum — chegou a oito, dois responderam, nenhum serve — o dono não o
 * via. E, mesmo que o visse, carregar não fazia nada: a distribuição saltava
 * quem já tinha uma negociação, fosse ela viva ou MORTA, e no #355 todos os
 * oito tinham. «Continua sem chegar a ninguém.»
 *
 * Duas coisas mudam, e a segunda é a que vale dinheiro: o botão fica à vista
 * em qualquer estado, e uma negociação morta — perdeu para outro — deixa de
 * contar como «já tem». Quem disse que não (desistida) continua em paz.
 *
 * E UMA TERCEIRA, que é um travão: um pedido FECHADO não se redistribui. O
 * cron já tinha essa regra por escrito; a rota não a tinha, e o botão passou
 * a estar onde um pedido fechado o mostra.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const PAINEL = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
const ROTA = semComentarios(ler("src/app/api/admin/negociacoes/redistribuir/route.ts"));
const DISTRIBUIR = semComentarios(ler("src/lib/distribuir-pedido.ts"));

describe("o botão está à vista em qualquer estado", () => {
  it("«Ficha e distribuição» deixou de existir; «Redistribuir» chama a mesma função de sempre", () => {
    expect(PAINEL).not.toContain("Ficha e distribuição");
    // Duas ocorrências: a de sempre (quando ninguém foi notificado) e a nova.
    const chamadas = [...PAINEL.matchAll(/onClick=\{\(\) => redistribuir\(p\.id\)\}/g)];
    expect(chamadas.length).toBe(2);
  });

  it("e a ficha continua a um clique — não se tira um caminho para dar outro", () => {
    expect(PAINEL).toContain("onClick={() => setAEditar(p.id)}");
  });
});

describe("um pedido fechado não se redistribui", () => {
  it("a rota recusa com o nome de quem o tem, e diz o que fazer", () => {
    const i = ROTA.indexOf("export async function POST(");
    const corpo = ROTA.slice(i);
    expect(corpo).toContain('n.estado === "acordada"');
    expect(corpo).toContain("fechada.profissionalNome");
    expect(corpo).toContain("status: 409");
    // A recusa vem ANTES de distribuir — não é um aviso depois do estrago.
    expect(corpo.indexOf('n.estado === "acordada"')).toBeLessThan(corpo.indexOf("distribuirPedido("));
  });
});

describe("quem «já tem» o pedido — três casos, e não são iguais", () => {
  const i = DISTRIBUIR.indexOf("const linhasExistentes = ");
  const bloco = DISTRIBUIR.slice(i, DISTRIBUIR.indexOf("const receberam = ", i));

  it("viva não se toca; desistida fica em paz", () => {
    expect(i).toBeGreaterThan(-1);
    expect(bloco).toContain('new Set(["aberta", "aguarda_contratacao", "acordada"])');
    expect(bloco).toContain("jaTemViva.has(c.profissional.id) || disseQueNao.has(c.profissional.id)");
  });

  it("morta volta a receber — e é a linha dela que se reabre", () => {
    /*
     * Sem `reabrir` para essa linha, o `ON DUPLICATE KEY UPDATE` só fazia
     * `id = LAST_INSERT_ID(id)`: a linha continuava morta e o token novo não
     * era gravado. Ele recebia um email com um link que dava 404.
     */
    expect(bloco).toContain('n.estado === "morta"');
    expect(bloco).toContain("reabrir: reabrir || perdeuParaOutro.has(c.profissional.id)");
  });

  it("e já não existe o conjunto cego que trancava o pedido", () => {
    expect(DISTRIBUIR).not.toContain("const jaTemNegociacao = ");
  });
});

/**
 * ⚠️ QUEM PERDE O TRABALHO POR DECISÃO NOSSA VOLTA À FILA COM OS OUTROS.
 *
 * *«Ele foi para recusados mas devia voltar para a fila para todos.»*
 * — 22-09-2026, sobre o #330.
 *
 * Reabrir um pedido fechado marcava a negociação desfeita como «desistida», e
 * a razão escrita aqui era: «quem falhou um trabalho fechado não é a primeira
 * pessoa a quem se manda o mesmo trabalho outra vez». O raciocínio tinha um
 * erro na primeira palavra — **ele não falhou nada**. Quem desfez o fecho
 * fomos nós, e as razões são quase sempre outras: o cliente mudou de ideias,
 * a data mexeu, o valor estava errado.
 *
 * E era pior do que uma etiqueta injusta. Na MESMA chamada, o passo seguinte
 * lê os estados e trata «desistida» como «disse que não» — saltando-o. O
 * único profissional garantidamente interessado, o que já tinha proposto e
 * ganho, era o único que não voltava a ver o pedido.
 *
 * A Revolution propôs 180 € no #330, ficou com o trabalho, e depois de o
 * pedido reabrir não o encontrava em lado nenhum senão em «Recusados».
 */
describe("reabrir devolve o pedido à fila de toda a gente", () => {
  const i = ROTA.indexOf("const fechada");
  const bloco = ROTA.slice(i, ROTA.indexOf("if (pedido.valorDesejadoCliente", i));

  it("a negociação desfeita fica MORTA, e não desistida", () => {
    expect(i).toBeGreaterThan(-1);
    expect(bloco).toContain('estado: "morta"');
    /*
     * ⚠️ A palavra proibida é a que fazia a distribuição saltá-lo. «morta»
     * quer dizer «o pedido voltou ao mercado e ele volta a recebê-lo»;
     * «desistida» quer dizer «ele disse que não», e ele não disse nada.
     */
    expect(bloco).not.toContain('estado: "desistida"');
  });

  it("e a distribuição que corre a seguir reabre-lhe mesmo a linha", () => {
    // Sem isto, mudar a palavra na rota não chegava: é `perdeuParaOutro` que
    // transforma uma linha morta numa negociação nova, com token e email.
    expect(DISTRIBUIR).toContain('n.estado === "morta"');
    expect(DISTRIBUIR).toContain("reabrir: reabrir || perdeuParaOutro.has(c.profissional.id)");
  });

  it("o aviso diz que ele volta — porque antes dizia o contrário", () => {
    const ecra = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(ecra).toContain("incluindo {reabrirPendente.nome}");
    expect(ecra).not.toContain("não o volta a receber");
  });
});

/**
 * «NINGUÉM NOVO» NÃO É «NINGUÉM».
 *
 * O ecrã dizia «continua sem chegar a ninguém de 9 profissionais activos»
 * quando o pedido estava nas mãos dos nove — só não havia mais nenhum para
 * acrescentar. Lia-se como avaria, e mandava procurar um problema que não
 * existia. O resumo do histórico já distinguia as duas coisas; era só este
 * ecrã que deitava fora o número.
 */
describe("o ecrã conta os que já o tinham", () => {
  it("usa o `jaTinham` que a rota já devolvia", () => {
    expect(PAINEL).toContain("dados.jaTinham");
    expect(PAINEL).toContain("Nenhum profissional NOVO para avisar");
  });
});

/**
 * ⚠️ A DÍVIDA DOS QUE JÁ FICARAM PRESOS.
 *
 * Corrigir a regra não desprende o #330: a linha «desistida» já está gravada,
 * e a distribuição — com razão — lê-a como «ele disse que não». Sem uma saída,
 * os pedidos reabertos antes de 22-09-2026 ficavam trancados para sempre.
 *
 * «Quem disse que não fica em paz» continua a valer. É uma regra sobre o que a
 * distribuição faz SOZINHA, e não sobre o que uma pessoa pode decidir a olhar
 * para um caso concreto — por isso o botão vive na linha DELE, e não no botão
 * geral de redistribuir.
 */
describe("voltar a mandar a um profissional que já saiu", () => {
  it("só a quem saiu — e passa por «morta», que é o caminho de sempre", () => {
    const i = ROTA.indexOf("const voltarAMandar");
    expect(i).toBeGreaterThan(-1);
    const bloco = ROTA.slice(i, ROTA.indexOf("if (pedido.valorDesejadoCliente", i));
    expect(bloco).toContain('alvo.estado !== "desistida" && alvo.estado !== "morta"');
    expect(bloco).toContain('estado: "morta"');
    expect(bloco).toContain("status: 409");
  });

  /*
   * Não salta regra nenhuma: quem decide se ele continua elegível, lhe dá
   * token novo e lhe manda o email é a distribuição, a seguir. Isto só desfaz
   * um «não» que ele nunca disse.
   */
  it("acontece ANTES da distribuição, para ela o apanhar", () => {
    const flip = ROTA.indexOf("const voltarAMandar");
    const distribui = ROTA.indexOf("await distribuirPedido(");
    expect(flip).toBeLessThan(distribui);
  });

  it("o botão aparece só nas linhas de quem saiu", () => {
    expect(PAINEL).toContain('n.estado === "desistida" || n.estado === "morta"');
    expect(PAINEL).toContain("redistribuir(p.id, false, n.id)");
  });

  it("fica escrito no histórico do pedido quem o fez", () => {
    expect(ler("src/app/api/admin/negociacoes/redistribuir/route.ts")).toContain(
      "voltou a pôr o pedido na fila de",
    );
  });
});
