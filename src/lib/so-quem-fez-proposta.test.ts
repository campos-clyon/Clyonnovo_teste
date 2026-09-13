import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { oClienteVeEsta, type Proposta } from "./negociacao";

/**
 * O CLIENTE SÓ VÊ QUEM FEZ PROPOSTA.
 *
 * "Não quero que apareçam todos os profissionais para os clientes, apenas os
 * que fizeram propostas." — 12-09-2026, a olhar para seis cartões com nome,
 * avaliações e «à espera da proposta dele» em cada um.
 *
 * Um pedido vai a TODOS os profissionais elegíveis da zona, e cada um abre uma
 * negociação no instante em que o recebe — mesmo que nunca lhe toque. Mostrá-las
 * todas fazia três coisas más ao mesmo tempo:
 *
 *   · enchia o ecrã de gente que não disse nada, e enterrava quem disse;
 *   · dava a entender que seis pessoas estavam a trabalhar no pedido dele
 *     quando podiam estar zero — e a decepção chega quando nenhuma responde;
 *   · dizia ao cliente A QUEM o pedido foi parar, que é informação nossa e dos
 *     profissionais, e não dele.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semNotas = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const proposta = (por: "cliente" | "profissional", estado = "pendente"): Proposta => ({
  por,
  valor: 150,
  criadaEm: "2026-09-12T10:00:00Z",
  estado: estado as Proposta["estado"],
});

describe("quem aparece, e quem não", () => {
  it("um profissional que recebeu o pedido e não disse nada NÃO aparece", () => {
    // É o caso de seis em cada seis, no minuto a seguir à distribuição.
    expect(oClienteVeEsta({ estado: "aberta", propostas: [] })).toBe(false);
  });

  it("assim que põe um número na mesa, aparece", () => {
    expect(
      oClienteVeEsta({ estado: "aberta", propostas: [proposta("profissional")] }),
    ).toBe(true);
  });

  it("e continua a aparecer depois de o cliente lhe responder", () => {
    // A vez voltou para ele, mas a proposta dele existiu — e é sobre ela que a
    // conversa continua.
    expect(
      oClienteVeEsta({
        estado: "aberta",
        propostas: [proposta("profissional", "recusada"), proposta("cliente")],
      }),
    ).toBe(true);
  });

  it("uma negociação aberta pelo CLIENTE, e ainda sem resposta dele, não aparece", () => {
    /*
     * As negociações antigas abriam com o valor do cliente já na mesa. Isso não
     * é uma proposta de ninguém: é o pedido. Mostrá-la dava ao cliente um
     * cartão com o nome de um profissional que nunca lhe respondeu.
     */
    expect(oClienteVeEsta({ estado: "aberta", propostas: [proposta("cliente")] })).toBe(false);
  });

  it("um acordo vê-se sempre", () => {
    // Depois de fechado o que interessa é COM QUEM, e essa negociação já não
    // está à espera de proposta nenhuma.
    expect(oClienteVeEsta({ estado: "acordada", propostas: [] })).toBe(true);
    expect(oClienteVeEsta({ estado: "aguarda_contratacao", propostas: [] })).toBe(true);
  });

  it("quem desistiu sem nunca propor não deixa rasto no ecrã do cliente", () => {
    expect(oClienteVeEsta({ estado: "desistida", propostas: [] })).toBe(false);
    expect(oClienteVeEsta({ estado: "morta", propostas: [] })).toBe(false);
  });
});

describe("a regra vive num sítio só", () => {
  it("os DOIS caminhos até esta lista usam a mesma função", () => {
    /*
     * Há duas portas para o mesmo ecrã — o link do email e a conta — e uma
     * regra escrita duas vezes acaba com dois comportamentos. O primeiro a
     * divergir é sempre aquele para onde ninguém está a olhar.
     */
    const LINK = ler("src/app/pedido/[token]/VistaDoPedido.tsx");
    const CONTA = ler("src/app/conta/components/OrderDetailModal.tsx");
    expect(LINK).toContain("oClienteVeEsta({ estado: n.estado");
    expect(CONTA).toContain("oClienteVeEsta({ estado: n.estado");
  });

  it("no link do email o filtro corre no SERVIDOR", () => {
    /*
     * Filtrar no browser tirava-os do ecrã e deixava-os no HTML: os nomes, as
     * notas e os trabalhos de seis pessoas que o cliente não tem nada que
     * conhecer viajavam na mesma. Aqui nem saem da base — e, de caminho,
     * poupam-se os perfis públicos que não vão ser mostrados a ninguém.
     */
    const LINK = ler("src/app/pedido/[token]/VistaDoPedido.tsx");
    const i = LINK.indexOf("await negociacoesDoPedido(pedido.id)");
    // A CHAMADA, e não o import — o import está no topo do ficheiro e a
    // comparação dava-se sempre por perdida.
    const j = LINK.indexOf("await perfilPublicoDoProfissional(");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(-1);
    // O filtro está na mesma expressão da leitura, e vem ANTES dos perfis.
    expect(LINK.slice(i, i + 200)).toContain("oClienteVeEsta");
    expect(i).toBeLessThan(j);
  });

  it("e o cabeçalho deixou de dizer «a responder» sobre quem não respondeu", () => {
    const PROPOSTAS = ler("src/app/pedido/[token]/PropostasRecebidas.tsx");
    expect(PROPOSTAS).toContain("profissionais responderam");
    expect(semNotas(PROPOSTAS)).not.toContain("profissionais} a responder");
  });

  it("sem propostas nenhumas, o ecrã diz o que está a acontecer", () => {
    // Uma lista vazia sem explicação lê-se como uma avaria. Esta frase já cá
    // estava, e passou a ser o que o cliente vê nos primeiros minutos.
    const PROPOSTAS = ler("src/app/pedido/[token]/PropostasRecebidas.tsx");
    expect(PROPOSTAS).toContain("Ainda não há propostas.");
    expect(PROPOSTAS).toContain("avisamos por email");
  });
});
