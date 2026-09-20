import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { estaExpirada, propostaPendente, type Negociacao } from "./negociacao";

/**
 * A MESA DEIXA DE OFERECER O QUE O SERVIDOR RECUSA.
 *
 * O #320 mostrava «Revolution · espera resposta · 322,00 €» com um botão
 * «Aceitar 322,00 €». Carregar dava:
 *
 *   POST /api/admin/negociacoes/agir → 409 (Conflict)
 *   "Não há proposta para aceitar."
 *
 * O servidor tinha razão: aquela proposta era de 14 de Setembro, e uma
 * proposta expira 48 horas depois de ser feita — está escrito no cabeçalho do
 * próprio bloco. Quem tinha convidado era o ecrã.
 *
 * ⚠️ A CAUSA: duas definições da mesma coisa. A mesa perguntava «o `estado`
 * gravado diz “pendente”?», e esse campo continua a dizer «pendente» para
 * sempre — o prazo é uma conta sobre a data, não um carimbo na base. O motor
 * (`propostaPendente`) faz essa conta. As duas discordavam, e a que estava à
 * vista era a errada.
 *
 * Uma regra escrita duas vezes acaba sempre com dois comportamentos.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const MESA = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));

const agora = new Date("2026-09-20T02:00:00Z");
const haSeisDias = new Date("2026-09-14T14:40:51Z");
const haUmaHora = new Date("2026-09-20T01:00:00Z");

describe("o motor já sabia — e é dele que a mesa passa a ler", () => {
  it("uma proposta de há seis dias está expirada, diga o que disser o estado", () => {
    /*
     * É este o ponto: o `estado` gravado diz «pendente» e continuará a dizer.
     * Quem responde à pergunta é a data.
     */
    const velha = { por: "profissional" as const, valor: 322, criadaEm: haSeisDias, estado: "pendente" as const };
    expect(velha.estado).toBe("pendente");
    expect(estaExpirada(velha, agora)).toBe(true);
  });

  it("e por isso não há proposta pendente nenhuma para aceitar", () => {
    // Exactamente o que o servidor respondeu com 409.
    const n = {
      estado: "aberta",
      valorAcordado: null,
      propostas: [
        { por: "profissional", valor: 322, criadaEm: haSeisDias, estado: "pendente" },
      ],
    } as unknown as Negociacao;
    expect(propostaPendente(n, agora)).toBeNull();
  });

  it("uma de há uma hora continua de pé", () => {
    // A correcção não pode fechar a porta ao que funciona.
    const n = {
      estado: "aberta",
      valorAcordado: null,
      propostas: [
        { por: "profissional", valor: 329, criadaEm: haUmaHora, estado: "pendente" },
      ],
    } as unknown as Negociacao;
    expect(propostaPendente(n, agora)?.valor).toBe(329);
  });
});

describe("a mesa passa a usar a mesma conta", () => {
  it("importa a regra do motor em vez de escrever a sua", () => {
    expect(MESA).toContain('from "@/lib/negociacao"');
    expect(MESA).toContain("estaExpirada(p as PropostaDoMotor, agora)");
  });

  it("«espera resposta» deixa de contar as que caducaram", () => {
    /*
     * Era isto que punha o #320 em «Precisa de si» com uma proposta de há seis
     * dias: o pedido aparecia na fila de trabalho de quem não tinha trabalho
     * nenhum para fazer ali.
     */
    const i = MESA.indexOf("function esperaResposta");
    const corpo = MESA.slice(i, MESA.indexOf("\n}", i));
    expect(corpo).toContain("!expirou(x, agora)");
  });

  it("e o botão de aceitar também", () => {
    // Um botão que o servidor recusa é pior do que botão nenhum: ensina a
    // pessoa a desconfiar do ecrã.
    const i = MESA.indexOf("const pendenteDoProfissional");
    const corpo = MESA.slice(i, i + 400);
    expect(corpo).toContain("!expirou(x, agora)");
  });
});

describe("mas o ecrã não fica calado sobre o que aconteceu", () => {
  it("a linha diz que a proposta expirou", () => {
    // Sem isto, o cartão passava a mostrar só «aberta» e ninguém percebia que
    // tinha havido ali um valor em cima da mesa.
    expect(MESA).toContain("proposta expirada");
    expect(MESA).toContain("function propostaExpiradaDele");
  });

  it("e diz qual era o valor, e o que há a fazer a seguir", () => {
    /*
     * Responde à pergunta que a pessoa tem à frente — «então e os 322 €?» — e
     * aponta para a saída: contrapor, ou pedir-lhe outra proposta.
     */
    expect(MESA).toContain("expiraram — contraponha, ou peça-lhe outra proposta.");
  });
});
