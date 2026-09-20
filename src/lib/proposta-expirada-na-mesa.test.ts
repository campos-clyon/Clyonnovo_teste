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
 *
 * ── E NO DIA SEGUINTE O PRAZO FOI-SE — 20-09-2026 ─────────────────────────
 *
 * "Remova o tempo, já que os pedidos vão ser apagados em 60 dias."
 *
 * O #320 tinha três valores em cima da mesa e dois já não se podiam aceitar. A
 * mesa passou a dizer a verdade (é o que este ficheiro guarda), e a verdade era
 * má: o cliente demorou quatro dias a decidir, como as pessoas demoram, e
 * perdeu duas propostas por isso. Quem apaga propostas velhas passa a ser só a
 * purga dos 60 dias.
 *
 * O QUE ESTE FICHEIRO CONTINUA A GUARDAR, e é a parte que vale: a mesa lê a
 * regra do motor em vez de escrever a sua. Isso não mudou nem deve mudar — é
 * por isso que a mesa acompanhou o interruptor sem se lhe tocar. O que mudou
 * foi a resposta do motor, e é isso que os dois primeiros testes dizem agora.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const MESA = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));

const agora = new Date("2026-09-20T02:00:00Z");
const haSeisDias = new Date("2026-09-14T14:40:51Z");
const haUmaHora = new Date("2026-09-20T01:00:00Z");

describe("o motor manda, e hoje o motor diz que não expira", () => {
  it("uma proposta de há seis dias já NÃO está expirada", () => {
    /*
     * Era `true` até 20-09-2026. O `estado` gravado sempre disse «pendente» —
     * o que deixou de haver é uma conta sobre a data a contradizê-lo.
     */
    const velha = { por: "profissional" as const, valor: 322, criadaEm: haSeisDias, estado: "pendente" as const };
    expect(velha.estado).toBe("pendente");
    expect(estaExpirada(velha, agora)).toBe(false);
  });

  it("e por isso os 322 € do #320 voltam a estar em cima da mesa", () => {
    // O caso que deu 409 — e que hoje passa.
    const n = {
      estado: "aberta",
      valorAcordado: null,
      propostas: [
        { por: "profissional", valor: 322, criadaEm: haSeisDias, estado: "pendente" },
      ],
    } as unknown as Negociacao;
    expect(propostaPendente(n, agora)?.valor).toBe(322);
  });

  it("uma de há uma hora continua de pé", () => {
    // Já passava antes do interruptor, e continua a passar depois: é o teste
    // que garante que nenhuma das duas mudanças fechou a porta ao caso normal.
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
  /*
   * ESTE BLOCO É O QUE IMPORTA A LONGO PRAZO. Com o prazo desligado, `expirou`
   * devolve sempre `false` e nada disto se vê no ecrã — mas é exactamente por
   * a mesa ler a regra do motor que ela acompanhou o interruptor sem uma linha
   * de trabalho. No dia em que o prazo voltar, volta tudo junto.
   */
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
