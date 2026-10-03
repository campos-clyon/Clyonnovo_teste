import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  propostasParaOCliente,
  mensagemDasPropostas,
  servicoComArtigo,
  trabalhoFechado,
} from "./mensagem-das-propostas";
// As fixturas trazem a taxa de origem, que é o que elas sempre significaram:
// foram escritas quando 5 % era a única taxa que existia.
import { TAXA_CLIENTE, contaDoCliente } from "./taxas-plataforma";

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

/**
 * Uma proposta de fixtura, com a conta feita pela casa e não à mão.
 *
 * Estas fixturas tinham o total escrito a dedo — «total: 286.61» — e cada vez
 * que a conta mudou foi preciso reescrever catorze números em catorze sítios,
 * à mão, sobre dinheiro. Onde o que se está a testar é a MENSAGEM e não a
 * aritmética, a conta vem de onde ela vive.
 *
 * Onde é a aritmética que está em causa, os números continuam escritos por
 * extenso nos testes — é lá que eles provam alguma coisa.
 */
const umaProposta = (
  profissional: string,
  valor: number,
) => {
  const c = contaDoCliente(valor);
  return {
    profissional,
    valor,
    taxaCliente: TAXA_CLIENTE,
    semIva: c.semIva,
    total: c.total,
    /*
     * O MODELO DE ANTES DO CORTE — 01-10-2026. Estas fixturas guardam a
     * mensagem das negociações abertas antes de `IVA_INCLUIDO_DESDE`, que
     * continuam sem IVA até ao fim. O modelo novo tem os seus testes no fim.
     */
    modelo: "sem_iva" as const,
    aPagar: c.semIva,
    // A forma de sempre: as fixturas são de antes de o cliente a escolher.
    forma: "na_plataforma" as const,
  };
};

describe("quem entra na lista de propostas", () => {
  it("entra quem CONTRAPROPÔS", () => {
    const r = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "TRSul", propostasJson: proposta("profissional", 270) },
    ]);
    // 270 + 13,50 de taxa = 283,50 a pagar; com factura, mais 65,21 de IVA
    // = 348,71. Os dois números, porque a mensagem diz o primeiro e a linha
    // da factura diz o segundo.
    expect(r).toEqual([
      {
        profissional: "TRSul",
        valor: 270,
        taxaCliente: TAXA_CLIENTE,
        semIva: 283.5,
        total: 348.71,
        // Sem data de abertura: o modelo de antes do corte (01-10-2026).
        modelo: "sem_iva",
        aPagar: 283.5,
        forma: "na_plataforma",
      },
    ]);
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
    // 330 + 16,50 de taxa = 346,50 a pagar; 426,20 com factura.
    expect(r).toEqual([
      {
        profissional: "Sthefanny Lemos",
        valor: 330,
        taxaCliente: TAXA_CLIENTE,
        semIva: 346.5,
        total: 426.2,
        modelo: "sem_iva",
        aPagar: 346.5,
        forma: "na_plataforma",
      },
    ]);
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
      propostas: [umaProposta("X", 100)],
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
  };

  it("diz SEMPRE que os valores são sem IVA", () => {
    /*
     * É a razão de metade deste trabalho. Um cliente que leia 270 € e pague
     * 351,72 € sente-se enganado — e tem razão em sentir-se.
     *
     * Desde 17-09-2026 é ao contrário: o número que ele lê é o SEM IVA, e é
     * também o que ele paga se não pedir factura. O que acresce com factura
     * fica dito, numa linha e uma vez só.
     */
    const m = mensagemDasPropostas({
      ...base,
      propostas: [umaProposta("TRSul", 270)],
    });
    expect(m).toContain("Valores sem IVA");
    // 270 + 13,50 de taxa. É o número dele, e está na linha da proposta.
    expect(m).toContain("TRSul: 283,50 €");
    expect(m).toContain("Com factura");
  });

  it("o aviso do IVA fica encostado aos números, antes do fim", () => {
    // Numa mensagem de WhatsApp lê-se até ao pedido de resposta. Até
    // 03-10-2026 o fim era o link; desde que ele saiu, é o «diga-nos».
    const m = mensagemDasPropostas({
      ...base,
      propostas: [umaProposta("TRSul", 270)],
    });
    expect(m.indexOf("sem IVA")).toBeGreaterThan(-1);
    expect(m.indexOf("sem IVA")).toBeLessThan(m.indexOf("Diga-nos qual prefere"));
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
    const uma = mensagemDasPropostas({ ...base, propostas: [umaProposta("A", 1)] });
    expect(uma).toContain("uma proposta");
    const duas = mensagemDasPropostas({
      ...base,
      propostas: [
        umaProposta("A", 1),
        umaProposta("B", 2),
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
      propostas: [umaProposta("TRSul", 270)],
    });
    expect(m).toContain("quem faz o trabalho é o profissional que escolher");
  });

  it("o link NÃO vai lá dentro — manda-se à mão (03-10-2026)", () => {
    /*
     * «Não coloque a mensagem do link e nem o link, vamos fazer
     * manualmente.» Nem o endereço, nem a frase que o apresentava: a
     * mensagem pede-lhe que diga qual prefere, e o resto trata-se à mão.
     */
    const m = mensagemDasPropostas({
      ...base,
      propostas: [umaProposta("TRSul", 270)],
    });
    expect(m).not.toContain("http");
    expect(m).not.toContain("/pedido/");
    expect(m).not.toContain("link");
    expect(m).toContain("Diga-nos qual prefere e tratamos do resto");
  });

  it("os valores saem em português — vírgula decimal e o símbolo depois", () => {
    const m = mensagemDasPropostas({
      ...base,
      propostas: [umaProposta("TRSul", 270)],
    });
    // O número à frente do nome é o que ele paga — e desde 29-09-2026 é o
    // único: o valor do profissional deixou de ir entre parênteses.
    expect(m).toContain("TRSul: 283,50 €\n");
    expect(m).not.toContain("270,00 €");
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
  it("cada linha traz o que ele paga — um número, já com a taxa", () => {
    /*
     * "Vamos apresentar o valor proposto já com a taxa" — 29-09-2026. Até aí
     * ia o valor do profissional entre parênteses, «(270,00 € para ele mais a
     * taxa CLYON)»: a conta a ser feita à frente do cliente.
     */
    const m = mensagemDasPropostas({
      servico: "recolha de entulho",
      propostas: [umaProposta("TRSul", 270)],
    });
    expect(m).toContain("TRSul: 283,50 €\n");
    expect(m).not.toContain("para ele mais a taxa CLYON");
    expect(m).not.toContain("taxa CLYON");
    // E o imposto, para quem o liquida, numa linha à parte — não no meio dos
    // valores, que é onde ninguém o consegue ler.
    expect(m).toContain("Valores sem IVA. Com factura acrescem 23 % de IVA.");
  });

  it("o total é o mesmo venha a proposta de quem vier", () => {
    /*
     * ERA O CONTRÁRIO ATÉ 22-09-2026: o mesmo valor com regimes diferentes
     * dava 318,45 € a um cliente e 387,45 € a outro, pelo mesmo trabalho.
     * Quem factura passou a ser a CLYON, e a factura é uma só.
     */
    const isento = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "A", propostasJson: proposta("profissional", 300), regimeIva: "isento" },
    ]);
    const normal = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "B", propostasJson: proposta("profissional", 300), regimeIva: "normal" },
    ]);
    // 300 + taxa 15,00 + IVA 72,45 = 387,45, para os dois.
    expect(isento[0].total).toBe(387.45);
    expect(normal[0].total).toBe(387.45);
  });

  it("ordena pelo número que ele VÊ", () => {
    /*
     * Quem lê uma lista de preços lê-a de cima para baixo à procura do menor.
     * Se a ordem não for a dos números à vista, a lista parece desarrumada e
     * ele deixa de confiar nela.
     *
     * Ordenava-se pelo total com imposto, e com regimes diferentes as duas
     * ordens divergiam: 280 € de quem liquida IVA eram 361,62 € a pagar, e
     * 300 € de um isento eram 318,45 €. Desde que o que se mostra é o valor
     * sem IVA — 294,00 € e 315,00 € — a ordem passou a ser a dos olhos.
     */
    const r = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "Liquida IVA", propostasJson: proposta("profissional", 280), regimeIva: "normal" },
      { estado: "aberta", profissionalNome: "Isento", propostasJson: proposta("profissional", 300), regimeIva: "isento" },
    ]);
    expect(r[0].profissional).toBe("Liquida IVA");
    expect(r[0].semIva).toBe(294);
    expect(r[1].semIva).toBe(315);
    expect(r[0].semIva).toBeLessThan(r[1].semIva);
  });

  it("na dúvida sobre o regime, NÃO inventa imposto", () => {
    // Sem regime gravado conta-se como isento: anunciar 23% a quem não os
    // cobra é mostrar ao cliente um imposto que ninguém pode entregar.
    const r = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "X", propostasJson: proposta("profissional", 100) },
    ]);
    expect(r[0].total).toBe(129.15);
    // E o que ele lê é 105,00 €: o serviço mais a taxa, sem imposto nenhum.
    expect(r[0].semIva).toBe(105);
  });

  it("NÃO promete «recusar» — esse botão não existe", () => {
    /*
     * `accoesDisponiveis` dá ao cliente aceitar, contratar, propor e desistir.
     * Desistir cancela o PEDIDO INTEIRO, não uma proposta. Prometer um botão
     * que não está lá é o que o põe ao telefone.
     */
    const m = mensagemDasPropostas({
      servico: "recolha de entulho",
      propostas: [umaProposta("TRSul", 270)],
    });
    expect(m).not.toContain("recusar");
    // Sem o link, a escolha diz-se a responder (03-10-2026).
    expect(m).toContain("Diga-nos qual prefere");
  });

  it("fala do imposto numa linha à parte, e diz sempre a mesma coisa", () => {
    /*
     * Dizia «acresce só o IVA da taxa» a quem contratasse um profissional na
     * isenção do artigo 53.º. Desde 22-09-2026 quem factura é uma parceira, e a
     * frase é uma só.
     */
    const m = mensagemDasPropostas({
      servico: "recolha de entulho",
      propostas: [umaProposta("TRSul", 270)],
    });
    expect(m).toContain("Com factura acrescem 23 % de IVA.");
  });

  it("e numa lista mista diz a MESMA percentagem — porque agora é a mesma", () => {
    /*
     * Dizia «acresce o IVA de quem o liquida — nem todos os profissionais
     * cobram», porque não havia um número que servisse para os dois. Havendo
     * uma factura só, há.
     */
    const m = mensagemDasPropostas({
      servico: "recolha de entulho",
      propostas: [umaProposta("TRSul", 270), umaProposta("Oscar", 280)],
    });
    expect(m).not.toContain("nem todos os profissionais cobram");
    expect(m).toContain("Com factura acrescem 23 % de IVA.");
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
     * A lei portuguesa (DL 138/90) manda mostrar ao consumidor o preço final
     * antes de se comprometer. Até 29-09-2026 o número grande era o da
     * negociação e o total vinha por baixo, mais pequeno; desde então o
     * número grande É o total — um só, já com a taxa, sem IVA.
     */
    const ECRA = ler("src/app/pedido/[token]/PropostasRecebidas.tsx");
    // A conta vem da função, e não de um número escrito à mão no ecrã — com as
    // taxas daquela negociação.
    // E no modelo DELA — com IVA incluído desde o corte de 01-10-2026.
    expect(ECRA).toContain("precoParaOCliente(emCima, taxasDela, modeloDela)");
    expect(ECRA).toContain("{euros(precoEmCima)}");
    expect(ECRA).not.toContain("{euros(emCima)}");
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

  it("mas encontra-se, e traz os dois números certos do regime dele", () => {
    // 330 + 16,50 de taxa = 346,50 a pagar. Com factura, mais 79,70 de
    // imposto = 426,20.
    expect(trabalhoFechado(fechada)).toEqual({
      profissional: "Sthefanny Lemos",
      valor: 330,
      // A negociação não guarda taxa nenhuma nesta fixtura: vale a de origem,
      // que é o que uma linha anterior a haver coluna sempre significou.
      taxaCliente: TAXA_CLIENTE,
      semIva: 346.5,
      total: 426.2,
      // Sem data de abertura, o modelo de antes do corte (01-10-2026).
      modelo: "sem_iva",
      aPagar: 346.5,
      // Sem forma gravada, é a de sempre.
      forma: "na_plataforma",
    });
  });

  it("a mensagem deixa de convidar a escolher", () => {
    const m = mensagemDasPropostas({
      nomeCliente: "Patricia",
      servico: "esvaziamento de apartamento",
      cidade: "Setúbal",
      propostas: [],
      fechado: trabalhoFechado(fechada),
    });
    expect(m).toContain("Está combinado com Sthefanny Lemos");
    // 330 + 16,50 de taxa = 346,50, que é o que ele paga se não pedir factura.
    expect(m).toContain("346,50 € a pagar");
    // E o imposto, numa linha à parte: 426,20 com factura.
    expect(m).toContain("Com factura acrescem 23 % de IVA: 426,20 €.");
    expect(m).not.toContain("Diga-nos qual prefere");
    expect(m).not.toContain("Ainda não temos propostas");
  });

  it("e diz-lhe o que falta fazer: confirmar no fim", () => {
    /*
     * Pela plataforma, é a confirmação dele que deixa o profissional receber.
     * Dizia-o com a frase de um interruptor global — «é isso que fecha o
     * acordo dos dois lados» — a quem tinha pago a referência à CLYON.
     */
    const m = mensagemDasPropostas({
      propostas: [],
      fechado: trabalhoFechado(fechada),
    });
    expect(m).toContain("é só confirmá-lo");
    expect(m).toContain("o profissional só recebe depois dessa confirmação");
    // Sem «no link em baixo» — a mensagem já não o leva (03-10-2026).
    expect(m).not.toContain("link");
  });

  it("sem acordo nenhum, não inventa um", () => {
    expect(trabalhoFechado([{ estado: "aberta", profissionalNome: "X", propostasJson: proposta("profissional", 100) }])).toBeNull();
  });
});

describe("em dinheiro, a mensagem diz quem recebe o quê — 29-09-2026", () => {
  /*
   * Em dinheiro são duas entregas: o serviço em notas ao profissional e a
   * comissão da CLYON por referência. A mensagem dizia um número só e «para
   * que serve confirmar» com a frase de quem pagou à CLYON — a quem nunca vai
   * pagar o serviço à CLYON.
   *
   * As taxas são as que uma negociação em dinheiro grava: a do cliente leva a
   * parte do profissional (`taxasParaAForma`), e a dele é zero.
   */
  const EM_DINHEIRO = { taxaCliente: "0.11", taxaProfissional: "0", formaDePagamento: "dinheiro" };

  it("a forma viaja com a proposta, lida da coluna", () => {
    const [p] = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "Rui", propostasJson: proposta("profissional", 120), ...EM_DINHEIRO },
    ]);
    expect(p.forma).toBe("dinheiro");
    // 120 + 11 % = 133,20: o número dele, como o ecrã do pedido o mostra.
    expect(p.semIva).toBe(133.2);
  });

  it("o fecho diz o que vai em notas e o que vai por referência", () => {
    const fechado = trabalhoFechado([
      { estado: "acordada", profissionalNome: "Rui", propostasJson: proposta("cliente", 120, "aceite"), ...EM_DINHEIRO },
    ]);
    const m = mensagemDasPropostas({ propostas: [], fechado });
    expect(m).toContain("Está combinado com Rui: 133,20 € a pagar.");
    expect(m).toContain("Paga 120,00 € em dinheiro ao profissional, no local");
    expect(m).toContain("13,20 € de taxa à CLYON");
    // Em dinheiro a factura é só da taxa: a linha dos 23 % sobre tudo não sai.
    expect(m).not.toContain("Com factura acrescem 23 % de IVA: ");
    // E confirmar não lhe «liberta» dinheiro nenhum para o profissional.
    expect(m).toContain("é só confirmá-lo");
    expect(m).not.toContain("o profissional só recebe depois");
  });

  it("a lista diz a forma, e a factura só da taxa", () => {
    const propostas = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "Rui", propostasJson: proposta("profissional", 120), ...EM_DINHEIRO },
    ]);
    const m = mensagemDasPropostas({ propostas });
    expect(m).toContain("Rui: 133,20 €");
    expect(m).toContain("Paga o valor do serviço ao profissional, em dinheiro, no fim do trabalho.");
    expect(m).toContain("Com factura, acrescem 23 % de IVA sobre a taxa da CLYON.");
    // Sem voltar ao «(X € para ele mais a taxa)» — o preço dele é um número só.
    expect(m).not.toContain("para ele mais a taxa");
  });
});

/**
 * COM IVA INCLUÍDO — 01-10-2026.
 *
 * "Preços com IVA incluído: o cliente vê um número só por proposta, já com a
 *  taxa da CLYON e com 23 % de IVA. Ex.: profissional propõe 350 € → cliente
 *  vê 452,03 €." As negociações abertas a partir de `IVA_INCLUIDO_DESDE`
 *  dizem esse número, sem linha de factura; as de antes, o de sempre.
 */
describe("com IVA incluído (negociações abertas desde o corte)", () => {
  const DEPOIS = "2026-10-05T10:00:00Z";
  const ANTES = "2026-09-25T10:00:00Z";
  const NOVAS = { taxaCliente: "0.05", taxaProfissional: "0.0655" };

  it("350 € do profissional chegam ao cliente como 452,03 €, IVA incluído", () => {
    const [p] = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "Rui", propostasJson: proposta("profissional", 350), criadaEm: DEPOIS, ...NOVAS },
    ]);
    expect(p.modelo).toBe("iva_incluido");
    expect(p.aPagar).toBe(452.03);
    const m = mensagemDasPropostas({ propostas: [p] });
    // E desde 03-10-2026 com o sem IVA à frente — o que se paga é o do fim.
    expect(m).toContain("Rui: 367,50 € + IVA = 452,03 €");
    expect(m).toContain("O valor a pagar é o com IVA.");
    expect(m).not.toContain("Com factura acrescem");
    expect(m).not.toContain("Valores sem IVA");
  });

  it("a mesma proposta, aberta antes do corte, continua a 367,50 € sem IVA", () => {
    const [p] = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "Rui", propostasJson: proposta("profissional", 350), criadaEm: ANTES, ...NOVAS },
    ]);
    expect(p.modelo).toBe("sem_iva");
    expect(p.aPagar).toBe(367.5);
    const m = mensagemDasPropostas({ propostas: [p] });
    expect(m).toContain("Rui: 367,50 €");
    expect(m).toContain("Valores sem IVA. Com factura acrescem 23 % de IVA.");
  });

  it("uma lista dos dois lados do corte diz cada um, e explica os dois", () => {
    const propostas = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "Rui", propostasJson: proposta("profissional", 350), criadaEm: DEPOIS, ...NOVAS },
      { estado: "aberta", profissionalNome: "Ana", propostasJson: proposta("profissional", 300), criadaEm: ANTES, ...NOVAS },
    ]);
    const m = mensagemDasPropostas({ propostas });
    expect(m).toContain("Rui: 367,50 € + IVA = 452,03 €");
    expect(m).toContain("Ana: 315,00 €\n");
    expect(m).toContain("Nos valores com «+ IVA» paga-se o total");
  });

  it("em dinheiro, o fecho diz uma entrega só — tudo ao profissional", () => {
    const fechado = trabalhoFechado([
      {
        estado: "acordada",
        profissionalNome: "Rui",
        propostasJson: proposta("cliente", 350, "aceite"),
        criadaEm: DEPOIS,
        formaDePagamento: "dinheiro",
        ...NOVAS,
      },
    ]);
    const m = mensagemDasPropostas({ propostas: [], fechado });
    expect(m).toContain("Está combinado com Rui: 367,50 € + IVA = 452,03 € a pagar.");
    expect(m).toContain("pago em dinheiro ao profissional, no local");
    expect(m).not.toContain("de taxa à CLYON");
    expect(m).not.toContain("por referência");
  });
});

/**
 * OS DOIS NÚMEROS — 03-10-2026.
 *
 * «Quero que mostre o valor sem IVA e o valor com IVA, para o cliente saber
 * o que está pagando.» Cada proposta diz o sem IVA e o com IVA; o que se
 * paga continua a ser um, o do fim da linha.
 */
describe("os dois números, sem e com IVA", () => {
  const DEPOIS = "2026-10-05T10:00:00Z";
  const NOVAS = { taxaCliente: "0.05", taxaProfissional: "0.0655" };

  it("cada linha diz de que é feito o preço, e acaba no que se paga", () => {
    const propostas = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "Rui", propostasJson: proposta("profissional", 350), criadaEm: DEPOIS, ...NOVAS },
      { estado: "aberta", profissionalNome: "Ana", propostasJson: proposta("profissional", 280), criadaEm: DEPOIS, ...NOVAS },
    ]);
    const m = mensagemDasPropostas({ propostas });
    // 280 + 5 % = 294,00 sem IVA; mais 67,62 de IVA = 361,62.
    expect(m).toContain("Ana: 294,00 € + IVA = 361,62 €\n");
    expect(m).toContain("Rui: 367,50 € + IVA = 452,03 €\n");
    expect(m).toContain("O valor a pagar é o com IVA.");
    // O número sem IVA nunca vai sozinho: vai sempre com o «+ IVA =».
    expect(m).not.toMatch(/: 294,00 €\n/);
  });

  it("antes do corte continua um número só, o sem IVA", () => {
    const [p] = propostasParaOCliente([
      { estado: "aberta", profissionalNome: "Ana", propostasJson: proposta("profissional", 280), criadaEm: "2026-09-25T10:00:00Z", ...NOVAS },
    ]);
    const m = mensagemDasPropostas({ propostas: [p] });
    expect(m).toContain("Ana: 294,00 €\n");
    expect(m).not.toContain("+ IVA =");
  });

  it("o trabalho fechado diz os dois, e sem link", () => {
    const fechado = trabalhoFechado([
      { estado: "acordada", profissionalNome: "Rui", propostasJson: proposta("cliente", 350, "aceite"), criadaEm: DEPOIS, ...NOVAS },
    ]);
    const m = mensagemDasPropostas({ servico: "recolha de entulho", propostas: [], fechado });
    expect(m).toContain("Está combinado com Rui para a recolha de entulho: 367,50 € + IVA = 452,03 € a pagar.");
    expect(m).not.toContain("link");
    expect(m).not.toContain("http");
  });

  it("sem propostas, promete o aviso — e não um link", () => {
    const m = mensagemDasPropostas({ servico: "recolha de entulho", propostas: [] });
    expect(m).toContain("Ainda não temos propostas para a recolha de entulho. Assim que chegarem, avisamos.");
    expect(m).not.toContain("responder aqui");
  });
});
