import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * OS AVISOS QUE ESTAVAM PAGOS E NÃO CHEGAVAM A NINGUÉM.
 *
 * O projeto tinha o service worker, o `push-client.ts`, as duas rotas de
 * subscrição, a tabela `pushSubscriptions`, as chaves VAPID e o `webpush.ts`
 * pronto a enviar — e ZERO chamadas a `sendPushToUser` em todo o código. Um
 * cliente que activasse os avisos no ecrã das notificações não recebia nunca
 * nenhum. Infraestrutura completa a servir para nada.
 *
 * E o profissional, a quem os avisos mais valem, nem sequer os podia activar:
 * as rotas só conheciam a sessão do NextAuth, que é a do cliente.
 */

const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const lerNu = (p: string) => semComentarios(ler(p));

const AVISOS = ler("src/lib/avisar-por-push.ts");
const AVISOS_NU = lerNu("src/lib/avisar-por-push.ts");
const PROPOSTA = lerNu("src/lib/avisar-da-proposta.ts");
const DISTRIBUIR = lerNu("src/lib/distribuir-pedido.ts");
const TRABALHO = lerNu("src/app/api/profissionais/trabalho/route.ts");
const NEGOCIACAO = lerNu("src/app/api/negociacao/[token]/route.ts");
const SUBSCREVER = lerNu("src/app/api/push/subscribe/route.ts");
const CANCELAR = lerNu("src/app/api/push/unsubscribe/route.ts");
const CARTAO = lerNu("src/app/profissionais/painel/AvisosNoTelemovel.tsx");
const PAINEL = lerNu("src/app/profissionais/painel/PainelDoProfissional.tsx");

describe("os quatro momentos estão mesmo ligados", () => {
  it("ao cliente, quando um profissional propõe", () => {
    // O aviso mais rentável: uma proposta que fica duas horas por ver já não é
    // a primeira, e a primeira ganha quase sempre.
    expect(PROPOSTA).toContain("avisarClientePorPush");
  });

  it("ao cliente, quando o trabalho é dado por feito", () => {
    expect(TRABALHO).toContain("avisarClienteDoTrabalhoFeitoPorPush");
  });

  it("ao profissional, quando entra um pedido na zona dele", () => {
    expect(DISTRIBUIR).toContain("avisarProfissionalDePedidoPorPush");
  });

  it("ao profissional, quando o cliente fecha com ele", () => {
    expect(NEGOCIACAO).toContain("avisarProfissionalContratadoPorPush");
  });

  it("e são só quatro — a lista é fechada de propósito", () => {
    /*
     * Uma notificação que chega quando não devia é desligada, e leva consigo as
     * que importavam: não há segunda oportunidade de pedir a permissão.
     * Acrescentar um quinto momento obriga a passar por aqui e a olhar para os
     * outros quatro ao fazê-lo.
     */
    const exportadas = AVISOS_NU.match(/export async function (\w+)/g) ?? [];
    expect(exportadas).toHaveLength(4);
  });
});

describe("o aviso vai depois do que interessa, e nunca em vez dele", () => {
  it("o push do pedido novo vem a seguir ao email, não no lugar dele", () => {
    // O email é o registo e chega a toda a gente; o push é a velocidade e só
    // chega a quem o pediu. Trocar um pelo outro deixava sem aviso nenhum
    // quem nunca activou nada — que hoje são todos.
    // As CHAMADAS, e não os imports: os dois nomes aparecem no topo do
    // ficheiro por ordem alfabética, que não diz nada sobre a ordem de envio.
    const email = DISTRIBUIR.indexOf("await avisarProfissional({");
    const push = DISTRIBUIR.indexOf("await avisarProfissionalDePedidoPorPush({");
    expect(email).toBeGreaterThan(-1);
    expect(push).toBeGreaterThan(email);
  });

  it("nenhum dos avisos pode rebentar o que o chamou", () => {
    // Chegam depois de a proposta já estar gravada. Um push que falhe não
    // pode transformar-se num erro para quem acabou de propor.
    expect(AVISOS).toContain("NUNCA LANÇA");
    expect(AVISOS_NU).toContain("if (!dados.email) return;");
  });
});

describe("as notificações não se empilham no ecrã de bloqueio", () => {
  it("as propostas do mesmo pedido substituem-se", () => {
    // Cinco profissionais a propor davam cinco notificações empilhadas às sete
    // da manhã. Com a mesma etiqueta fica uma, e é a mais recente.
    expect(AVISOS_NU).toContain("tag: `proposta-${dados.pedidoId}`");
  });

  it("os pedidos novos partilham uma etiqueta só", () => {
    // Se entrarem três enquanto ele conduz, o que interessa é que abra o
    // painel — não que leia três avisos.
    expect(AVISOS_NU).toContain('tag: "pedido-novo"');
  });
});

describe("o profissional passou a poder activá-los", () => {
  it("as rotas de push conhecem as duas sessões, e não só a do cliente", () => {
    for (const [nome, f] of [
      ["subscrever", SUBSCREVER],
      ["cancelar", CANCELAR],
    ] as const) {
      expect(f, `${nome} não conhece a sessão do profissional`).toContain(
        "verificarSessaoDoProfissional",
      );
      expect(f).toContain("emailDeQuemPede");
    }
  });

  it("a tabela continua a ser a mesma — não nasceu uma segunda", () => {
    // `pushSubscriptions` guarda por email, e o profissional também tem email.
    // Não faltava tabela; faltava deixá-lo entrar.
    expect(SUBSCREVER).toContain("savePushSubscription");
    expect(SUBSCREVER).toContain("perfilDoProfissional");
  });

  it("o cartão aparece no painel dele, à cabeça do menu", () => {
    expect(PAINEL).toContain("<AvisosNoTelemovel />");
    const i = PAINEL.indexOf("<AvisosNoTelemovel />");
    const j = PAINEL.indexOf('rotulo="Avaliações"');
    expect(i).toBeLessThan(j);
  });

  it("o pedido de permissão desaparece quando ele decide", () => {
    // Um pedido que fica para sempre no ecrã deixa de ser pedido e passa a ser
    // incómodo — e um incómodo é recusado.
    expect(CARTAO).toContain("dispensar");
    expect(CARTAO).toContain("Agora não");
    expect(CARTAO).toContain("if (dispensado) return null;");
  });

  it("e quem os liga consegue desligá-los", () => {
    // Uma definição que se liga e não se desliga é uma armadilha.
    expect(CARTAO).toContain("disablePush");
    expect(CARTAO).toContain("Desligar");
  });

  it("num browser sem suporte não se mostra nada", () => {
    expect(CARTAO).toContain("if (!suportado) return null;");
  });
});

describe("o que se escreve no ecrã de bloqueio", () => {
  it("não revela o valor que o cliente queria pagar", () => {
    /*
     * O que o cliente disse que contava gastar é informação da negociação.
     * Pô-lo no ecrã de bloqueio ancorava a proposta do profissional antes de
     * ele sequer abrir o pedido.
     */
    const corpo = AVISOS_NU.slice(AVISOS_NU.indexOf("avisarProfissionalDePedidoPorPush"));
    expect(corpo.slice(0, 600)).not.toContain("valorDesejado");
  });

  it("o toque leva ao sítio certo, e não à página inicial", () => {
    expect(AVISOS_NU).toContain("/pedido/${dados.token}");
    expect(AVISOS_NU).toContain("/profissionais/pedidos/${dados.token}");
  });
});
