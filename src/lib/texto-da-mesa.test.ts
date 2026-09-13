import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { textoDaMesa, euros, type LinhaDaMesa } from "./texto-da-mesa";
import { oClienteVeEsta } from "./negociacao";

/**
 * O ASSISTENTE DEIXA DE DIZER AO CLIENTE QUEM AINDA NÃO LHE RESPONDEU.
 *
 * Conversa real, pedido #311, 13-09-2026:
 *
 *   CLYON: Pedido #311 — propostas em cima da mesa:
 *          • Manuel Martins transportes: 148,57 € (à sua espera)
 *          • TRSul: sem valor ainda
 *          • Fred Teste: sem valor ainda
 *          • Nova Recolha: sem valor ainda
 *
 * Três coisas erradas numa mensagem só. Chamou «proposta» a três convites por
 * responder. Disse à cliente quem tinha o pedido dela na mão e não lhe
 * respondia. E pôs o nome de uma conta de ensaio à frente de uma cliente real.
 *
 * "O assistente não deve expor os pros que ainda não enviaram propostas."
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const propos = (nome: string, valor: number, aSuaEspera = false): LinhaDaMesa => ({
  profissionalNome: nome,
  valor,
  aSuaEspera,
});

describe("quem não propôs não tem nome", () => {
  it("a mesa do #311, como devia ter saído", () => {
    const t = textoDaMesa(311, [propos("Manuel Martins transportes", 148.57, true)], 3);

    expect(t).toContain("• Manuel Martins transportes: 148,57 € (à sua espera)");
    expect(t).toContain("Estão mais 3 profissionais a ver o seu pedido.");

    // Os nomes de quem não respondeu nem chegam a esta função.
    expect(t).not.toContain("TRSul");
    expect(t).not.toContain("Fred Teste");
    expect(t).not.toContain("Nova Recolha");
  });

  it("a palavra «proposta» não cobre quem não propôs", () => {
    // O cabeçalho dizia «propostas em cima da mesa» por cima de três linhas
    // que eram convites. Já não promete o que não está lá.
    const t = textoDaMesa(311, [propos("Manuel", 148.57)], 1);
    expect(t).toContain("o que já recebeu");
    expect(t).not.toContain("propostas em cima da mesa");
  });
});

describe("o silêncio não é resposta: diz-se quantos são", () => {
  it("sem proposta nenhuma, conta quem está a ver em vez de calar", () => {
    expect(textoDaMesa(311, [], 3)).toBe(
      "Pedido #311: ainda sem valores. Estão 3 profissionais a ver o seu pedido — aviso-o assim que chegar o primeiro.",
    );
  });

  /*
   * A CONCORDÂNCIA CONTA-SE, NÃO SE ADIVINHA.
   *
   * Foi na mesma conversa que saiu «a sua outro serviço». Um número escrito à
   * mão ao lado de um plural fixo dá «1 profissionais» com a mesma facilidade.
   */
  it("um é um: singular em todo o lado", () => {
    expect(textoDaMesa(311, [], 1)).toContain("Está um profissional a ver o seu pedido");
    expect(textoDaMesa(311, [propos("Costa", 90)], 1)).toContain(
      "Está mais um profissional a ver o seu pedido.",
    );
  });

  it("com todos respondidos, não se inventa quem está a ver", () => {
    const t = textoDaMesa(311, [propos("Costa", 90), propos("Dias", 110)], 0);
    expect(t).not.toContain("a ver o seu pedido");
  });
});

describe("o dinheiro escreve-se como em Portugal", () => {
  it("vírgula decimal e duas casas, sempre", () => {
    expect(euros(148.57)).toBe("148,57 €");
    expect(euros(90)).toBe("90,00 €");
    expect(euros(1234.5)).toBe("1234,50 €");
  });
});

describe("a regra de quem o cliente vê é uma só, para os três ecrãs", () => {
  const CEREBRO = ler("src/lib/whatsapp-negociacao.ts");

  it("o WhatsApp pergunta a negociacao.ts, não decide por sua conta", () => {
    expect(CEREBRO).toContain("oClienteVeEsta({ estado: String(n.estado), propostas: lista })");
  });

  /*
   * O caso que uma segunda redacção da regra deixaria passar: uma negociação
   * onde SÓ O CLIENTE propôs tem valor, e não é proposta nenhuma. Filtrar por
   * «tem valor» punha lá o nome de um profissional que nunca respondeu.
   */
  it("uma contraproposta do cliente não faz do profissional alguém que propôs", () => {
    expect(
      oClienteVeEsta({
        estado: "aberta",
        propostas: [
          { por: "cliente", valor: 350, criadaEm: new Date(), estado: "pendente" },
        ],
      }),
    ).toBe(false);
  });

  it("quem propôs mesmo, vê-se", () => {
    expect(
      oClienteVeEsta({
        estado: "aberta",
        propostas: [
          { por: "profissional", valor: 148.57, criadaEm: new Date(), estado: "pendente" },
        ],
      }),
    ).toBe(true);
  });
});

describe("as duas listas do WhatsApp saem do mesmo princípio", () => {
  const CEREBRO = ler("src/lib/whatsapp-negociacao.ts");

  it("a lista de desempate também só mostra quem pôs um número na mesa", () => {
    expect(CEREBRO).toContain(
      "(await alvosAccionaveis(pedidos)).filter((a) => a.valorNaMesa != null)",
    );
  });

  it("a frase «sem valor ainda» não volta a nascer em lado nenhum", () => {
    // Só o literal — um guarda que chumba quem escreve a razão da regra é um
    // guarda que acaba desligado.
    expect(CEREBRO).not.toContain('"sem valor ainda"');
    expect(ler("src/lib/texto-da-mesa.ts")).not.toContain('"sem valor ainda"');
  });

  it("um empate de valores entre pedidos vai para uma pessoa, não se fecha à sorte", () => {
    expect(CEREBRO).toContain("casam.length > 1");
    expect(CEREBRO).toContain("passarAUmaPessoa");
  });

  it("o exemplo que ensina a responder é um valor que existe mesmo na mesa", () => {
    // Era `Math.round(...)`: sobre 148,57 € sugeria «fechar 149», e 149 não
    // está na mesa — quem seguisse a sugestão fazia uma contraproposta.
    expect(CEREBRO).not.toContain("Math.round(alvos[0].valorNaMesa)");
    expect(CEREBRO).toContain('euros(alvos[0].valorNaMesa as number).replace(" €", "")');
  });
});
