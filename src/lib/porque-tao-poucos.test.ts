import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { porqueFicaramDeFora, resumoDaDistribuicao } from "./distribuir-pedido";

/**
 * «Porquê só um?» — a pergunta que o ecrã não respondia.
 *
 * "Por qual motivo esse pedido foi enviado apenas para 1 parceiro?"
 *
 * O #241 — recolha de entulho em Carnaxide, com fatura pedida — chegou a uma
 * profissional. A mesa dizia «1 profissional · 1 proposta» e calava-se; o
 * histórico dizia «Chegou a 1 profissional(is) de 4 activos» e calava-se
 * também. A resposta existia, e era determinística, mas só se chegava lá
 * correndo a regra à mão contra a base de dados — que foi o que eu tive de
 * fazer para lhe responder:
 *
 *   Sthefanny Lemos    entra
 *   Manuel Martins     não faz recolha de entulho
 *   Fred Teste         não passa fatura
 *   TRSul              não passa fatura
 *
 * Estava tudo calculado dentro do resultado da distribuição, e era deitado
 * fora em todos os casos menos um: quando não chegava a NINGUÉM. É a mesma
 * correcção que o ecrã de registar pedidos já tinha levado — uma contagem sem
 * explicação transforma cada envio numa adivinha.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const ROTA = ler("src/app/api/admin/negociacoes/alcance/route.ts");

describe("os motivos por extenso", () => {
  it("traduz as chaves para português", () => {
    const t = porqueFicaramDeFora({ nao_emite_fatura: 2, categoria_diferente: 1 });
    expect(t).toContain("2 não passam fatura");
    expect(t).toContain("1 não fazem este serviço");
  });

  it("o motivo mais comum vem primeiro — é o que tem mais conserto", () => {
    const t = porqueFicaramDeFora({ categoria_diferente: 1, nao_emite_fatura: 3 });
    expect(t.indexOf("não passam fatura")).toBeLessThan(t.indexOf("não fazem este serviço"));
  });

  it("os zeros não aparecem", () => {
    expect(porqueFicaramDeFora({ inactivo: 0, nao_aprovado: 0 })).toBe("");
  });
});

describe("o histórico do envio passa a dizer porquê", () => {
  it("mesmo quando chegou a alguém — era este o caso do #241", () => {
    const texto = resumoDaDistribuicao({
      receberam: 1,
      avisados: 1,
      falhados: 0,
      candidatos: 4,
      motivos: { nao_emite_fatura: 2, categoria_diferente: 1 },
    } as never);
    expect(texto).toContain("Chegou a 1");
    expect(texto).toContain("os outros 3 ficam de fora");
    expect(texto).toContain("não passam fatura");
  });

  it("e quando não chegou a ninguém, continua a dizer", () => {
    const texto = resumoDaDistribuicao({
      receberam: 0,
      avisados: 0,
      falhados: 0,
      candidatos: 4,
      motivos: { fora_de_alcance: 4 },
    } as never);
    expect(texto).toContain("NAO chegou");
    expect(texto).toContain("fora do raio deles");
  });

  it("sem ninguém de fora, não inventa uma explicação", () => {
    const texto = resumoDaDistribuicao({
      receberam: 4,
      avisados: 4,
      falhados: 0,
      candidatos: 4,
      motivos: {},
    } as never);
    expect(texto).not.toContain("ficam de fora");
    expect(texto).toContain("Todos avisados");
  });
});

describe("o «porquê?» na mesa", () => {
  it("é um pedido de cada vez, e só quando alguém pergunta", () => {
    // Calcular o alcance é medir a distância de cada profissional a cada
    // pedido, e a lista tem dezenas. Fazê-lo sempre seria pagar caro por uma
    // pergunta que se faz uma vez por semana.
    expect(PAINEL).toContain("async function porquePoucos(pedidoId: number)");
    expect(PAINEL).toContain("/api/admin/negociacoes/alcance?pedidoId=");
    expect(PAINEL).toContain('"porquê?"');
  });

  it("não abre o cartão ao carregar — é uma pergunta, não uma navegação", () => {
    const i = PAINEL.indexOf("void porquePoucos(p.id);");
    expect(PAINEL.slice(Math.max(0, i - 120), i)).toContain("e.stopPropagation();");
  });

  it("responde com a regra de HOJE, e diz que é isso", () => {
    /*
     * Quem faz esta pergunta quer saber o que tem conserto agora: aprovar
     * aquele profissional, ou pedir-lhe a fatura, muda quem recebe o próximo.
     * O histórico do envio guarda o que aconteceu na altura.
     */
    expect(PAINEL).toContain("Hoje chegaria a");
    expect(ROTA).toContain("avaliarAlcance");
    expect(ROTA).toContain("requireAdmin");
  });

  it("quando não há ninguém de fora, diz isso em vez de uma lista vazia", () => {
    expect(PAINEL).toContain("não há ninguém de fora");
  });
});

describe("redistribuir para alcançar quem entrou depois", () => {
  /*
   * "Tem como eu enviar esses pedidos para todos? Adicionei outros pros que
   * devem ver todos os pedidos disponíveis." — 12-09-2026.
   *
   * A rota de redistribuir existia e prometia isto por escrito: «correr outra
   * vez é seguro, só entram os que faltavam». O código fazia o contrário —
   * gerava um token novo para TODA a gente e mandava email e push com ele.
   *
   * E o token novo não era gravado: sem `reabrir`, o ON DUPLICATE KEY do
   * `criarNegociacao` só faz `id = LAST_INSERT_ID(id)` e não toca no
   * `acessoTokenHash`. Quem já tinha o pedido recebia um link que dava 404, e
   * o histórico escrevia «todos avisados por email» por cima disso.
   */

  it("quem já tem o pedido não conta como chegada nem como email falhado", () => {
    const texto = resumoDaDistribuicao({
      receberam: 3,
      avisados: 3,
      jaTinham: 4,
      falhados: 0,
      candidatos: 7,
      motivos: {},
    } as never);
    expect(texto).toContain("Chegou a 3");
    expect(texto).toContain("4 já o tinha(m)");
    // Sete candidatos, três novos, quatro já o tinham: ninguém ficou de fora.
    expect(texto).not.toContain("ficam de fora");
  });

  it("sem ninguém novo, di-lo em vez de dizer que não chegou a ninguém", () => {
    // «NÃO chegou a nenhum profissional» sobre um pedido que sete pessoas
    // já têm na mão manda alguém procurar uma avaria que não existe.
    const texto = resumoDaDistribuicao({
      receberam: 0,
      avisados: 0,
      jaTinham: 7,
      falhados: 0,
      candidatos: 7,
      motivos: {},
    } as never);
    expect(texto).toContain("Nenhum profissional NOVO");
    expect(texto).toContain("7 já o tinha(m)");
    expect(texto).not.toContain("NAO chegou");
  });

  it("sem o campo, a conta não vai a NaN", () => {
    /*
     * Este resumo é chamado com objectos montados à mão em três rotas. Um
     * `undefined` não daria erro — daria «os outros NaN ficam de fora» escrito
     * no registo permanente do pedido.
     */
    const texto = resumoDaDistribuicao({
      receberam: 1,
      avisados: 1,
      falhados: 0,
      candidatos: 4,
      motivos: { fora_de_alcance: 3 },
    } as never);
    expect(texto).not.toContain("NaN");
    expect(texto).toContain("os outros 3 ficam de fora");
  });

  it("a distribuição pergunta quem já tem antes de criar seja o que for", () => {
    const D = readFileSync(join(process.cwd(), "src/lib/distribuir-pedido.ts"), "utf8");
    expect(D).toContain("const jaTemNegociacao = reabrir");
    expect(D).toContain("negociacoesDoPedido(pedido.id)");
    // E com `reabrir` continua a alcançar toda a gente: aí o token É reposto.
    expect(D).toContain("new Set<number>()");
  });
});

describe("reenviar em lote, da barra dos marcados", () => {
  /*
   * "Eu marquei, agora preciso da opção de reenviar pedido." — 12-09-2026.
   *
   * A barra dos seleccionados dava três saídas — desmarcar, arquivar, apagar
   * — e todas tiravam pedidos da frente. Nenhuma os punha a andar, que é o que
   * se quer fazer a seis pedidos parados quando entram profissionais novos.
   */
  const PAINEL_NEG = ler("src/components/admin/AdminNegociacoesPanel.tsx");

  it("a barra tem o botão, e diz o que faz a quem já o tem", () => {
    expect(PAINEL_NEG).toContain("Reenviar aos profissionais");
    expect(PAINEL_NEG).toContain("onClick={redistribuirMarcados}");
    expect(PAINEL_NEG).toContain("Quem já os recebeu não é avisado outra vez");
  });

  it("vai um de cada vez, e não seis em paralelo", () => {
    /*
     * Cada redistribuição mede a distância de cada profissional ao pedido e
     * manda emails. Seis ao mesmo tempo num serverless partilhado é pedir
     * throttling — e quem vê metade falhar em paralelo não sabe qual metade.
     */
    const i = PAINEL_NEG.indexOf("async function redistribuirMarcados");
    const corpo = PAINEL_NEG.slice(i, i + 2600);
    expect(corpo).toContain("for (const id of ids)");
    expect(corpo).not.toContain("Promise.all");
  });

  it("conta o que chegou, em vez de dizer «feito»", () => {
    // Reenviar seis e ver a barra fechar-se não diz se alguém os recebeu. Se
    // forem zero envios novos, o problema não é o botão.
    const i = PAINEL_NEG.indexOf("async function redistribuirMarcados");
    const corpo = PAINEL_NEG.slice(i, i + 2600);
    expect(corpo).toContain("envio(s) novo(s) a profissionais");
    expect(corpo).toContain("não chegaram a ninguém novo");
  });
});
