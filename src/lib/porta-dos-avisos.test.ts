import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ⚠️ DUAS AVARIAS COM O MESMO SILÊNCIO.
 *
 * *«Me ajude com passo a passo para corrigir isso.»* — 22-09-2026, sobre um
 * pagamento de 42 € que entrou no euPago e nunca chegou aqui.
 *
 * Quando um aviso não aparece, há duas histórias possíveis:
 *
 *   · o euPago NÃO ESTÁ A CHAMAR — endereço errado, ou no canal errado;
 *   · o euPago ESTÁ A CHAMAR e nós é que recusamos — segredo em falta, ou um
 *     que já não é o dele.
 *
 * Uma resolve-se no backoffice deles, a outra no nosso. Até aqui apareciam
 * exactamente iguais: nada. E quem procura sem saber qual é passa a tarde a
 * mexer no sítio errado.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const WEBHOOK = "src/app/api/pagamentos/webhook/route.ts";
const BASE = "src/lib/pagamentos-na-base.ts";
const PAINEL = "src/components/admin/AdminPagamentosPanel.tsx";

describe("quem bateu e não entrou fica registado", () => {
  const CODIGO = semComentarios(ler(WEBHOOK));

  it("as duas recusas são anotadas — as duas que são nossas", () => {
    // Sem segredo configurado, e assinatura que não confere. São as únicas
    // duas portas por onde um aviso verdadeiro se perde por culpa nossa.
    const anotacoes = CODIGO.match(/anotarRecusa\(/g) ?? [];
    expect(anotacoes.length).toBe(2);
  });

  /*
   * ⚠️ O CORPO NÃO SE GUARDA. Quem chega ao ponto da recusa ainda NÃO provou
   * ser o euPago — guardar o que mandou era guardar texto de qualquer pessoa
   * da internet numa tabela nossa. Fica o quê, o quando e o tamanho.
   */
  it("não guarda o que veio no corpo de quem não se identificou", () => {
    const tabela = semComentarios(ler(BASE));
    const i = tabela.indexOf("CREATE TABLE IF NOT EXISTS avisosRecusados");
    expect(i).toBeGreaterThan(-1);
    const criacao = tabela.slice(i, tabela.indexOf(")", tabela.indexOf("recebidoEm", i)));
    expect(criacao).not.toContain("corpo");
    expect(criacao).toContain("porque");
    expect(criacao).toContain("tamanho");
  });

  /*
   * Uma falha a escrever o registo não pode fazer perder um pagamento: o que
   * importa é a resposta que o euPago recebe, para ele voltar.
   */
  it("anotar uma recusa nunca rebenta", () => {
    const base = ler(BASE);
    const i = base.indexOf("export async function anotarRecusa");
    const corpo = base.slice(i, base.indexOf("export type EstadoDoWebhook", i));
    expect(corpo).toContain("try {");
    expect(corpo).toContain("catch");
  });

  it("a recusa é anotada ANTES de se responder, ou não chega a ser anotada", () => {
    for (const resposta of ["return VOLTA(", "status: 401"]) {
      const fim = CODIGO.indexOf(resposta);
      const anotacao = CODIGO.lastIndexOf("anotarRecusa(", fim);
      expect(anotacao, resposta).toBeGreaterThan(-1);
      expect(anotacao, resposta).toBeLessThan(fim);
    }
  });
});

describe("o painel diz qual das duas avarias é", () => {
  const ECRA = ler(PAINEL);
  const CODIGO = semComentarios(ECRA);

  it("«está a chamar e recusamos» tem precedência sobre tudo", () => {
    /*
     * É o que está a acontecer AGORA, é nosso, e tem conserto imediato. Um
     * histórico de avisos antigos aceites não pode esconder isso.
     */
    const corpo = CODIGO.slice(CODIGO.indexOf("function PortaDosAvisos"));
    const recusa = corpo.indexOf("w.recusas24h > 0");
    const aceite = corpo.indexOf("w.aceites > 0");
    expect(recusa).toBeGreaterThan(-1);
    expect(aceite).toBeGreaterThan(recusa);
  });

  /*
   * Ancorado em frases que não partem de linha. O JSX quebra o texto onde
   * calha, e uma frase longa dá um teste que chumba quando alguém formata o
   * ficheiro — não quando alguém apaga a explicação.
   */
  it("e diz onde é o conserto, em vez de dizer só que há um problema", () => {
    expect(ECRA).toContain("o que não bate é o segredo");
    expect(ECRA).toContain("Nunca chegou nenhum aviso");
    expect(ECRA).toContain("Webhooks 2.0 no canal de produção");
  });

  it("um painel antigo sem este campo não rebenta", () => {
    // A rota é de outro deploy que o ecrã: durante uns minutos, um não tem o
    // que o outro manda. Um ecrã de dinheiro não pode ficar branco por isso.
    expect(CODIGO).toContain("webhook?: EstadoDoWebhook");
    expect(CODIGO).toContain("estado.webhook && <PortaDosAvisos");
  });
});
