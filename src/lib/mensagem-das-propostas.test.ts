import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  propostasParaOCliente,
  mensagemDasPropostas,
  servicoComArtigo,
  trabalhoFechado,
} from "./mensagem-das-propostas";

/**
 * A mensagem que ele manda ao cliente com as propostas.
 *
 * "Ele gera o link mas não disponibiliza aqui para copiar e enviar. Outra
 * coisa: gostaria que ele viesse já com uma mensagem resumida para enviar ao
 * cliente sobre as propostas que ele recebeu — como no exemplo, mas informando
 * que são valores sem IVA."
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const proposta = (por: string, valor: number, estado = "pendente") =>
  JSON.stringify([{ por, valor, estado, criadaEm: "2026-08-29T10:00:00Z" }]);

describe("quem entra na lista de propostas", () => {
  it("entra quem CONTRAPROPÔS", () => {
    const r = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "TRSul", propostasJson: proposta("profissional", 270) },
    ]);
    expect(r).toEqual([{ profissional: "TRSul", valor: 270, total: 286.2 }]);
  });

  it("entra quem ACEITOU o valor do cliente", () => {
    /*
     * O número é o mesmo que o cliente pediu, mas agora tem alguém por trás
     * dele — e é isso que o torna uma proposta.
     */
    const r = propostasParaOCliente([
      {
        estado: "aguarda_contratacao",
        profissionalNome: "Sthefanny Lemos",
        propostasJson: proposta("cliente", 330, "aceite"),
      },
    ]);
    expect(r).toEqual([{ profissional: "Sthefanny Lemos", valor: 330, total: 349.8 }]);
  });

  it("NÃO entra quem ainda não respondeu", () => {
    // O #249 tem o Fred Teste assim: a nossa proposta está na mesa e ele não
    // disse nada. Anunciá-lo como proposta seria inventar uma.
    const r = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "Fred Teste", propostasJson: proposta("cliente", 330) },
    ]);
    expect(r).toEqual([]);
  });

  it("NÃO entram as negociações mortas nem as desistidas", () => {
    for (const estado of ["morta", "desistida"]) {
      expect(
        propostasParaOCliente([
          { estado, profissionalNome: "X", propostasJson: proposta("profissional", 100) },
        ]),
      ).toEqual([]);
    }
  });

  it("NÃO entra uma proposta recusada ou expirada", () => {
    for (const e of ["recusada", "expirada"]) {
      expect(
        propostasParaOCliente([
          { estado: "aberta", profissionalNome: "X", propostasJson: proposta("profissional", 100, e) },
        ]),
      ).toEqual([]);
    }
  });

  it("aguenta um JSON estragado sem partir", () => {
    expect(
      propostasParaOCliente([
        { estado: "aberta", profissionalNome: "X", propostasJson: "{isto não é json" },
        { estado: "aberta", profissionalNome: "Y", propostasJson: null },
      ]),
    ).toEqual([]);
  });

  it("vem do mais barato para o mais caro", () => {
    // Quem lê uma lista de preços no telemóvel lê-a de cima para baixo à
    // procura do menor. A escolha continua inteiramente dele.
    const r = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "Caro", propostasJson: proposta("profissional", 330) },
      { estado: "aberta", profissionalNome: "Barato", propostasJson: proposta("profissional", 270) },
    ]);
    expect(r.map((x) => x.profissional)).toEqual(["Barato", "Caro"]);
  });
});

describe("o artigo concorda com o serviço", () => {
  it("recolha é feminino, esvaziamento é masculino", () => {
    // A primeira versão escrevia "para a esvaziamento de apartamento".
    expect(servicoComArtigo("recolha de entulho")).toBe("a recolha de entulho");
    expect(servicoComArtigo("esvaziamento de apartamento")).toBe("o esvaziamento de apartamento");
  });

  it("não se adivinha pela terminação", () => {
    // «mudança» acaba em -a e é feminino; «esvaziamento» acaba em -o e é
    // masculino; «montagem» acaba em -m e também é feminino.
    expect(servicoComArtigo("montagem de móveis")).toBe("a montagem de móveis");
    expect(servicoComArtigo("mudança")).toBe("a mudança");
  });

  it("o que não conhece, NÃO ARRISCA", () => {
    // Melhor uma frase sem artigo do que uma concordância errada.
    expect(servicoComArtigo("serviço novo qualquer")).toBeNull();
    expect(servicoComArtigo(null)).toBeNull();
  });

  it("e a frase reescreve-se em volta disso", () => {
    const m = mensagemDasPropostas({
      servico: "serviço novo qualquer",
      propostas: [{ profissional: "X", valor: 100, total: 106.0 }],
      link: "https://clyon.pt/pedido/abc",
    });
    expect(m).toContain("para o seu pedido");
    expect(m).not.toContain("para a serviço");
  });
});

describe("a mensagem", () => {
  const base = {
    nomeCliente: "Patricia Antunes",
    servico: "esvaziamento de apartamento",
    cidade: "Setúbal",
    link: "https://clyon.pt/pedido/abc123",
  };

  it("diz SEMPRE que os valores são sem IVA", () => {
    /*
     * É a razão de metade deste trabalho. Um cliente que leia 270 € e pague
     * 351,72 € sente-se enganado — e tem razão em sentir-se.
     */
    const m = mensagemDasPropostas({
      ...base,
      propostas: [{ profissional: "TRSul", valor: 270, total: 286.2 }],
    });
    expect(m).toContain("sem IVA");
    expect(m).toContain("total a pagar");
  });

  it("o aviso do IVA fica ANTES do link, encostado aos números", () => {
    // Numa mensagem de WhatsApp, o que vem depois do link não se lê.
    const m = mensagemDasPropostas({
      ...base,
      propostas: [{ profissional: "TRSul", valor: 270, total: 286.2 }],
    });
    expect(m.indexOf("sem IVA")).toBeLessThan(m.indexOf(base.link));
  });

  it("trata pelo primeiro nome", () => {
    // "Olá, Patricia" lê-se melhor do que o nome completo.
    const m = mensagemDasPropostas({ ...base, propostas: [] });
    expect(m).toContain("Olá, Patricia!");
    expect(m).not.toContain("Antunes");
  });

  it("sem nome, cumprimenta na mesma", () => {
    // Melhor do que um espaço em branco onde devia estar uma pessoa.
    const m = mensagemDasPropostas({ ...base, nomeCliente: null, propostas: [] });
    expect(m).toContain("Olá!");
  });

  it("singular e plural, com o número certo", () => {
    const uma = mensagemDasPropostas({ ...base, propostas: [{ profissional: "A", valor: 1, total: 1.06 }] });
    expect(uma).toContain("uma proposta");
    const duas = mensagemDasPropostas({
      ...base,
      propostas: [
        { profissional: "A", valor: 1, total: 1.06 },
        { profissional: "B", valor: 2, total: 2.12 },
      ],
    });
    expect(duas).toContain("2 propostas");
  });

  it("SEM propostas diz a verdade, em vez de inventar", () => {
    // É a mensagem que ele manda quando o cliente pergunta «então?».
    const m = mensagemDasPropostas({ ...base, propostas: [] });
    expect(m).toContain("Ainda não temos propostas");
    expect(m).not.toContain("€");
  });

  it("a CLYON não diz que faz o trabalho", () => {
    // Regra de voz do site: quem executa é o profissional.
    const m = mensagemDasPropostas({
      ...base,
      propostas: [{ profissional: "TRSul", valor: 270, total: 286.2 }],
    });
    expect(m).toContain("quem faz o trabalho é o profissional que escolher");
  });

  it("o link vai lá dentro, inteiro", () => {
    const m = mensagemDasPropostas({
      ...base,
      propostas: [{ profissional: "TRSul", valor: 270, total: 286.2 }],
    });
    expect(m).toContain(base.link);
  });

  it("os valores saem em português — vírgula decimal e o símbolo depois", () => {
    const m = mensagemDasPropostas({
      ...base,
      propostas: [{ profissional: "TRSul", valor: 270, total: 286.2 }],
    });
    expect(m).toContain("TRSul: 270,00 €");
  });
});

describe("o link volta a aparecer para copiar", () => {
  const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");

  it("recarrega depois de gerar — senão a caixa nunca aparece", () => {
    /*
     * "Ele gera o link mas não disponibiliza aqui para copiar e enviar."
     *
     * A caixa só se mostra quando o marcador de versão bate certo com o
     * `linkExpiraEm` da lista. `reenviar` guardava o marcador NOVO e a lista
     * continuava com o `linkExpiraEm` ANTIGO: nunca coincidiam, o ecrã concluía
     * que o link tinha morrido, e escondia o que ele acabara de gerar.
     */
    const i = MESA.indexOf("async function linkParaOCliente");
    const bloco = MESA.slice(i, i + 2200);
    expect(bloco).toContain("await carregar(true);");
    // E a recarga tem de vir ANTES de se copiar, para o ecrã já estar certo.
    expect(bloco.indexOf("await carregar(true);")).toBeLessThan(
      bloco.indexOf("navigator.clipboard.writeText"),
    );
  });

  it("o guarda da versão CONTINUA a existir", () => {
    // Serve para apanhar um token rodado noutro sítio — foi o que matou o link
    // da D. Sónia. Só precisava de comparar com dados frescos.
    expect(MESA).toContain("String(p.linkExpiraEm) !== versaoDoLink[chaveCliente]");
  });

  it("a caixa traz a mensagem pronta, e um botão só para ela", () => {
    expect(MESA).toContain("mensagem={mensagemDasPropostas({");
    expect(MESA).toContain("Mensagem pronta a enviar");
    expect(MESA).toContain("Copiar mensagem");
  });

  it("a mensagem mostra-se INTEIRA antes de ser copiada", () => {
    // É texto que sai em nome da casa para um cliente: quem o manda tem de o
    // poder ler antes.
    expect(MESA).toContain("whitespace-pre-wrap");
  });

  it("o serviço vai em palavras, e não no código do motor", () => {
    // "recolha_entulho" numa mensagem de WhatsApp é linguagem de base de dados
    // a escapar-se para a frente de quem não a devia ver.
    expect(MESA).toContain("function nomeDoServico(id: string | null): string | null {");
    expect(MESA).toContain("servico: nomeDoServico(p.serviceType)");
  });
});

describe("o total vai na mensagem, e não escondido atrás do link", () => {
  /*
   * O painel de juízes apanhou o que eu tinha falhado: no ecrã do cliente, o
   * cartão de cada proposta mostra o valor CRU e a conta inteira só aparece
   * DEPOIS de contratar. Com o IVA a acrescer, ele decidia a olhar para 270 €
   * e descobria 348,30 € a seguir ao clique — 29% acima.
   *
   * Foi a mudança do IVA que abriu esse buraco. A mensagem tapa-o antes de ele
   * abrir seja o que for, e o ecrã foi corrigido a par.
   */
  it("cada linha traz o valor E o total", () => {
    const m = mensagemDasPropostas({
      servico: "recolha de entulho",
      propostas: [{ profissional: "TRSul", valor: 270, total: 348.3 }],
      link: "https://clyon.pt/pedido/abc",
    });
    expect(m).toContain("TRSul: 270,00 € — total a pagar 348,30 €");
  });

  it("o total sai do regime de QUEM FACTURA, e não de uma conta fixa", () => {
    // O mesmo valor com regimes diferentes dá totais diferentes.
    const isento = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "A", propostasJson: proposta("profissional", 300), regimeIva: "isento" },
    ]);
    const normal = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "B", propostasJson: proposta("profissional", 300), regimeIva: "normal" },
    ]);
    expect(isento[0].total).toBe(318);
    expect(normal[0].total).toBe(387);
  });

  it("ordena pelo TOTAL e não pela base", () => {
    /*
     * Com regimes diferentes as duas ordens divergem: 280 € de quem liquida
     * IVA são 361,20 € a pagar, e 300 € de um isento são 318 €. Ordenar pela
     * base punha o mais caro primeiro e dizia-lhe que era o mais barato.
     */
    const r = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "Base baixa, total alto", propostasJson: proposta("profissional", 280), regimeIva: "normal" },
      { estado: "aberta", profissionalNome: "Base alta, total baixo", propostasJson: proposta("profissional", 300), regimeIva: "isento" },
    ]);
    expect(r[0].profissional).toBe("Base alta, total baixo");
    expect(r[0].total).toBeLessThan(r[1].total);
    expect(r[0].valor).toBeGreaterThan(r[1].valor);
  });

  it("na dúvida sobre o regime, NÃO inventa imposto", () => {
    // Sem regime gravado conta-se como isento: anunciar 23% a quem não os
    // cobra é mostrar ao cliente um imposto que ninguém pode entregar.
    const r = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "X", propostasJson: proposta("profissional", 100) },
    ]);
    expect(r[0].total).toBe(106);
  });

  it("NÃO promete «recusar» — esse botão não existe", () => {
    /*
     * `accoesDisponiveis` dá ao cliente aceitar, contratar, propor e desistir.
     * Desistir cancela o PEDIDO INTEIRO, não uma proposta. Prometer um botão
     * que não está lá é o que o põe ao telefone.
     */
    const m = mensagemDasPropostas({
      servico: "recolha de entulho",
      propostas: [{ profissional: "TRSul", valor: 270, total: 286.2 }],
      link: "https://clyon.pt/pedido/abc",
    });
    expect(m).not.toContain("recusar");
    expect(m).toContain("aceita a proposta que preferir");
  });

  it("fala do imposto sem anunciar 23% a toda a gente", () => {
    // Metade dos profissionais está na isenção do artigo 53.º.
    const m = mensagemDasPropostas({
      servico: "recolha de entulho",
      propostas: [{ profissional: "TRSul", valor: 270, total: 286.2 }],
      link: "https://clyon.pt/pedido/abc",
    });
    expect(m).toContain("nem todos os profissionais cobram");
    expect(m).not.toContain("23%");
  });
});

describe("a marca de versão do link sobrevive à base de dados", () => {
  /*
   * A CAUSA DE FUNDO, que eu tinha falhado e a verificação adversarial
   * apanhou.
   *
   * A validade do token serve de marca de versão e compara-se COMO TEXTO. Mas
   * a coluna `acessoTokenExpiraEm` é DATETIME, sem casas decimais: o que se
   * escreve com milissegundos volta sem eles, e o MySQL ainda arredonda para o
   * segundo seguinte quando a fracção passa de meio. Medido contra produção:
   *
   *   escrito   2026-09-28T13:26:38.829Z
   *   lido      2026-09-28T13:26:39.000Z
   *
   * Duas datas do mesmo instante, dois textos diferentes — a comparação nunca
   * podia dar igual, e a caixa de copiar nunca podia aparecer. Recarregar a
   * lista não resolvia nada.
   */
  it("a validade nasce sem milissegundos", () => {
    const ACESSO = ler("src/lib/pedido-acesso.ts");
    expect(ACESSO).toContain("expiraEm.setMilliseconds(0);");
  });

  it("e isso vale para TODOS os caminhos, porque a função é uma só", () => {
    // Distribuição, criação pelo backoffice, pedido do simulador e reenvio
    // partilham `gerarTokenDeAcesso`. Corrigir na origem arruma os quatro.
    const ACESSO = ler("src/lib/pedido-acesso.ts");
    const i = ACESSO.indexOf("export function gerarTokenDeAcesso");
    const j = ACESSO.indexOf("}", ACESSO.indexOf("return { token", i));
    expect(ACESSO.slice(i, j)).toContain("setMilliseconds(0)");
  });
});

describe("o cliente vê o total ANTES de carregar no botão", () => {
  it("o cartão da proposta mostra o que sai da carteira", () => {
    /*
     * O número grande continua a ser o da negociação — é sobre esse que os
     * dois estão a discutir. O total vem por baixo, mais pequeno, a dizer o
     * que ele paga. A lei portuguesa (DL 138/90) manda mostrar ao consumidor o
     * preço final antes de se comprometer.
     */
    const ECRA = ler("src/app/pedido/[token]/PropostasRecebidas.tsx");
    expect(ECRA).toContain("contaDoCliente(emCima, regimeDeIva(n.regimeIva)).total");
    expect(ECRA).toContain("a pagar");
  });
});

describe("quando o trabalho já está fechado", () => {
  /*
   * Descoberto ao correr contra a base: o #249 tinha duas propostas de manhã e
   * ao fim da tarde estava contratado com a Sthefanny — as outras duas mortas.
   * A mensagem continuava a convidá-lo a "aceitar a proposta que preferir",
   * sobre uma escolha que ele já tinha feito.
   */
  const fechada = [
    {
      estado: "acordada",
      profissionalNome: "Sthefanny Lemos",
      propostasJson: proposta("cliente", 330, "aceite"),
      regimeIva: "normal",
    },
    { estado: "morta", profissionalNome: "TRSul", propostasJson: proposta("profissional", 270) },
  ];

  it("um acordo NÃO é uma proposta em cima da mesa", () => {
    expect(propostasParaOCliente(fechada)).toEqual([]);
  });

  it("mas encontra-se, e traz o total certo do regime dele", () => {
    // 330 + 75,90 de IVA + 19,80 de taxa = 425,70.
    expect(trabalhoFechado(fechada)).toEqual({
      profissional: "Sthefanny Lemos",
      valor: 330,
      total: 425.7,
    });
  });

  it("a mensagem deixa de convidar a escolher", () => {
    const m = mensagemDasPropostas({
      nomeCliente: "Patricia",
      servico: "esvaziamento de apartamento",
      cidade: "Setúbal",
      propostas: [],
      fechado: trabalhoFechado(fechada),
      link: "https://clyon.pt/pedido/abc",
    });
    expect(m).toContain("Está combinado com Sthefanny Lemos");
    expect(m).toContain("425,70 € a pagar");
    expect(m).not.toContain("aceita a proposta que preferir");
    expect(m).not.toContain("Ainda não temos propostas");
  });

  it("e diz-lhe o que falta fazer: confirmar no fim", () => {
    // É a confirmação dele que liberta o pagamento ao profissional.
    const m = mensagemDasPropostas({
      propostas: [],
      fechado: trabalhoFechado(fechada),
      link: "https://clyon.pt/pedido/abc",
    });
    expect(m).toContain("confirma-o quando estiver feito");
  });

  it("sem acordo nenhum, não inventa um", () => {
    expect(trabalhoFechado([{ estado: "aberta", profissionalNome: "X", propostasJson: proposta("profissional", 100) }])).toBeNull();
  });
});
