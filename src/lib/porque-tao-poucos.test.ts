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
