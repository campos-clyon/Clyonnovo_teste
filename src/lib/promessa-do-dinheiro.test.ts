import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  A_PLATAFORMA_COBRA,
  COMO_SE_PAGA,
  PROMESSA,
  PROMESSA_POR_FORMA,
  promessaDaForma,
  prazoAutomaticoPorExtenso,
  prazoDoEmailPorExtenso,
} from "./pagamento-na-plataforma";
import { FORMA_EM_PALAVRAS, FORMAS } from "./forma-de-pagamento";

/**
 * CADA UM LÊ O QUE LHE ACONTECE A ELE — o que se diz sobre o dinheiro.
 *
 * ESTE TESTE MUDOU DE REGRA A 29-09-2026, e a regra antiga está aqui para não
 * voltar por engano.
 *
 * Era um guarda do interruptor `A_PLATAFORMA_COBRA`: enquanto estivesse em
 * falso, nenhum texto podia dizer que a CLYON recebia o dinheiro — e todos
 * diziam, com orgulho, «é a ele que o paga, no fim; a CLYON não recebe esse
 * dinheiro». Era verdade quando foi escrito. Deixou de ser a 17-09-2026, no
 * dia em que os pagamentos passaram a entrar numa conta da CLYON pelo euPago,
 * com a referência gerada no backoffice. A 21-09-2026 o cliente passou a
 * escolher a forma no pedido: pela plataforma, ou em dinheiro ao profissional.
 *
 * O interruptor ficou em falso por outra razão (o cliente não paga sozinho
 * pelo link — «fica só o backoffice») e continuou a escolher os textos. O
 * resultado era o mesmo ecrã a dizer «Pagamento recebido — o valor fica
 * connosco até confirmar» e, logo por baixo, «a CLYON não recebe esse
 * dinheiro».
 *
 * A REGRA DE AGORA, a que este ficheiro guarda:
 *
 *   · a quem paga EM DINHEIRO, nenhum texto diz que o valor fica com a CLYON,
 *     cativo, retido, ou disponível numa carteira;
 *   · a quem paga PELA PLATAFORMA, nenhum texto diz que a CLYON não recebe o
 *     dinheiro, nem que é ao profissional que se paga;
 *   · quando não se sabe a forma (páginas públicas, recrutamento, carteiras
 *     que juntam as duas), diz-se as duas — e o «fica com a CLYON» vem sempre
 *     preso a «pela plataforma».
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * Sem os comentários — e há duas razões para isso. Os comentários que
 * explicam porque é que uma frase saiu citam-na, e têm direito a fazê-lo; e o
 * que um comentário conta não pode fazer um teste passar nem chumbar.
 */
const semComentarios = (t: string) =>
  t.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

/** Todos os `.ts`/`.tsx` de produção — sem testes. */
function ficheirosDeProducao(dir = "src", acc: string[] = []): string[] {
  for (const nome of readdirSync(join(process.cwd(), dir))) {
    const rel = `${dir}/${nome}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) {
      ficheirosDeProducao(rel, acc);
    } else if (/\.tsx?$/.test(nome) && !nome.includes(".test.")) {
      acc.push(rel);
    }
  }
  return acc;
}

const PRODUCAO = ficheirosDeProducao();

/** O que não se diz a quem paga em dinheiro: que guardamos o valor. */
const GUARDA_O_VALOR =
  /fica com a CLYON|fica connosco|fica do lado da CLYON|cativ|retid|guardad[oa] (na|pela|connosco)|dispon[ií]ve(l|is) na sua carteira/i;

/** O que não se diz a quem paga pela plataforma: que a CLYON não recebe. */
const A_CLYON_NAO_RECEBE =
  /n[ãa]o recebe esse dinheiro|CLYON n[ãa]o recebe|a CLYON n[ãa]o o tem|é a ele que (o )?paga|Quem lhe paga é o cliente|paga-lhe diretamente/i;

const campos = (o: object) => Object.entries(o) as Array<[string, string]>;

describe("o interruptor manda na porta do cliente, e não no que se diz", () => {
  it("continua desligado — o cliente não paga sozinho pelo link", () => {
    /*
     * «Fica só o backoffice» — decisão do dono a 21-09-2026. Se este teste
     * chumbar porque alguém pôs `true`, a pergunta é se o dono decidiu abrir
     * a cobrança pelo site; os textos já não dependem disto.
     */
    expect(A_PLATAFORMA_COBRA).toBe(false);
  });

  it("nenhum texto é escolhido por ele", () => {
    // Aparece uma vez no código do ficheiro: na declaração. Um
    // `A_PLATAFORMA_COBRA ? … : …` era voltar a escolher as frases com ele.
    const codigo = semComentarios(ler("src/lib/pagamento-na-plataforma.ts"));
    expect(codigo.match(/A_PLATAFORMA_COBRA/g)).toHaveLength(1);
    expect(codigo).not.toMatch(/A_PLATAFORMA_COBRA\s*\?/);
  });
});

describe("a regra — cada um lê o que lhe acontece a ele", () => {
  it("a quem paga em dinheiro, nunca que a CLYON guarda o valor", () => {
    for (const [campo, texto] of campos(PROMESSA_POR_FORMA.dinheiro)) {
      expect(texto, `dinheiro.${campo}`).not.toMatch(GUARDA_O_VALOR);
    }
  });

  it("a quem paga pela plataforma, nunca que a CLYON não recebe", () => {
    for (const [campo, texto] of campos(PROMESSA_POR_FORMA.na_plataforma)) {
      expect(texto, `na_plataforma.${campo}`).not.toMatch(A_CLYON_NAO_RECEBE);
      expect(texto, `na_plataforma.${campo}`).not.toMatch(/em dinheiro|em notas/i);
    }
  });

  it("pela plataforma diz-se, onde importa, que o valor fica com a CLYON até confirmar", () => {
    const p = PROMESSA_POR_FORMA.na_plataforma;
    expect(p.clienteEmCurso).toContain("fica com a CLYON");
    expect(p.clienteDepoisDePagar).toContain("fica connosco até confirmar");
    expect(p.proAoFechar).toContain("depois de ele confirmar");
  });

  it("e nenhum texto põe saldo disponível sem o pagamento ter entrado", () => {
    /*
     * O prazo dos sete dias e a confirmação ficaram como estavam (decisão por
     * tomar pelo dono). O que não se promete é que confirmar, só por si, põe
     * dinheiro na carteira: sem o pagamento do cliente, não há o que pôr.
     */
    for (const [campo, texto] of [
      ...campos(PROMESSA_POR_FORMA.na_plataforma),
      ...campos(PROMESSA),
    ]) {
      if (/dispon[ií]vel/i.test(texto)) expect(texto, campo).toMatch(/pagamento/);
    }
  });

  it("em dinheiro, as frases são as do dono", () => {
    // `FORMA_EM_PALAVRAS` é a fonte de verdade: o que o cliente leu ao
    // escolher é o que lê depois.
    const d = PROMESSA_POR_FORMA.dinheiro;
    expect(d.whatsappAntesDeAceitar).toBe(FORMA_EM_PALAVRAS.dinheiro.cliente);
    expect(d.emailProAoContratar).toBe(FORMA_EM_PALAVRAS.dinheiro.profissional);
    expect(d.clienteEmCurso).toContain(FORMA_EM_PALAVRAS.dinheiro.cliente);
    expect(d.proAoFechar).toContain(FORMA_EM_PALAVRAS.dinheiro.profissional);
  });

  it("pela plataforma, o WhatsApp diz como e quando se paga", () => {
    expect(PROMESSA_POR_FORMA.na_plataforma.whatsappAntesDeAceitar).toBe(
      "Depois de aceitar, recebe a referência MB WAY ou Multibanco para pagar à CLYON; o " +
        "profissional só recebe depois de confirmar que o trabalho está feito.",
    );
  });

  it("a forma lê-se da coluna como ela vem da base", () => {
    expect(promessaDaForma(null, "iva_incluido")).toBe(PROMESSA_POR_FORMA.na_plataforma);
    expect(promessaDaForma(undefined, "iva_incluido")).toBe(PROMESSA_POR_FORMA.na_plataforma);
    expect(promessaDaForma("dinheiro", "iva_incluido")).toBe(PROMESSA_POR_FORMA.dinheiro);
    expect(promessaDaForma("lixo", "iva_incluido")).toBe(PROMESSA_POR_FORMA.na_plataforma);
    // O pagar-depois está desligado: quem o pedir lê a forma de sempre.
    expect(promessaDaForma("pos_recolha", "iva_incluido")).toBe(PROMESSA_POR_FORMA.na_plataforma);
    /*
     * ANTES DO IVA INCLUÍDO (01-10-2026), o dinheiro de 21-09-2026: o cliente
     * dá o serviço em notas e paga a taxa por referência. A plataforma não
     * mudou de texto com o IVA.
     */
    expect(promessaDaForma("dinheiro", "sem_iva")).not.toBe(PROMESSA_POR_FORMA.dinheiro);
    expect(promessaDaForma("dinheiro", "sem_iva").whatsappAntesDeAceitar).toContain("por referência");
    expect(promessaDaForma(null, "sem_iva")).toBe(PROMESSA_POR_FORMA.na_plataforma);
    // E a regra da casa vale nos dois: a quem paga em dinheiro, nunca que a CLYON guarda o valor.
    for (const [campo, texto] of Object.entries(promessaDaForma("dinheiro", "sem_iva"))) {
      expect(texto, campo).not.toMatch(GUARDA_O_VALOR);
    }
  });

  it("nenhuma forma fica com um texto por escrever", () => {
    for (const f of FORMAS) {
      for (const [campo, texto] of campos(PROMESSA_POR_FORMA[f])) {
        expect(texto.trim(), `${f}.${campo}`).not.toBe("");
      }
    }
  });
});

describe("quando não se sabe a forma, dizem-se as duas", () => {
  it("o texto genérico é o canónico", () => {
    expect(COMO_SE_PAGA).toContain("No pedido escolhe como prefere pagar: pela plataforma");
    expect(COMO_SE_PAGA).toContain("recebe uma referência MB WAY ou Multibanco");
    expect(COMO_SE_PAGA).toContain("o valor fica com a CLYON até confirmar que o trabalho está feito");
    expect(COMO_SE_PAGA).toContain("em dinheiro, ao profissional, no fim do trabalho");
    // Com IVA incluído (01-10-2026): o mesmo preço, sem nada à parte — é o
    // profissional que entrega à CLYON o IVA e a comissão.
    expect(COMO_SE_PAGA).toContain("o mesmo preço, com IVA, sem nada a pagar à parte");
  });

  it("sem a percentagem da comissão escrita à mão", () => {
    // Sai das taxas de cada negociação, que mudam no backoffice. Um número
    // escrito aqui ficava certo para uns pedidos e errado para os seguintes.
    expect(COMO_SE_PAGA).not.toMatch(/\d+\s*%/);
  });

  it("cada texto genérico que fala de dinheiro fala das duas formas", () => {
    for (const campo of [
      "clienteCorpo",
      "faqComoSePaga",
      "proCorpo",
      "proComoRecebe",
      "recrutamentoCorpo",
    ] as const) {
      expect(PROMESSA[campo], campo).toMatch(/pela plataforma/i);
      expect(PROMESSA[campo], campo).toMatch(/em dinheiro/i);
    }
  });

  it("e o «fica com a CLYON» vem sempre preso a «pela plataforma»", () => {
    for (const [campo, texto] of campos(PROMESSA)) {
      if (/fica com a CLYON/.test(texto)) expect(texto, campo).toMatch(/pela plataforma/);
    }
  });

  it("nenhum texto genérico diz que a CLYON não recebe", () => {
    for (const [campo, texto] of campos(PROMESSA)) {
      expect(texto, campo).not.toMatch(A_CLYON_NAO_RECEBE);
    }
  });

  it("a carteira do cliente já não diz «retido» nem «combinado» ao total", () => {
    expect(PROMESSA.clienteRotuloDoTotal).toBe("Em curso");
    expect(PROMESSA.proRotuloDoCativo).toBe("Por receber");
    // Corrigir a promessa não podia virar esconder a comissão.
    expect(PROMESSA.proCorpo).toContain("taxa da CLYON descontada");
  });

  it("no recrutamento promete-se o acordo escrito, e não uma garantia", () => {
    expect(PROMESSA.recrutamentoTitulo).not.toMatch(/garantid/i);
    expect(PROMESSA.recrutamentoCorpo).toContain("acordado antes de sair de casa");
  });
});

describe("quem sabe a forma do trabalho usa-a", () => {
  it("os ecrãs, os emails e as mensagens de um trabalho lêem `promessaDaForma`", () => {
    for (const f of [
      "src/app/pedido/[token]/PropostasRecebidas.tsx",
      "src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx",
      "src/components/PagarTrabalho.tsx",
      "src/components/admin/AdminNegociacoesPanel.tsx",
      "src/lib/email-trabalho.ts",
      "src/lib/mensagem-das-propostas.ts",
      "src/lib/whatsapp-negociacao.ts",
      "src/lib/assistente-automatico.ts",
    ]) {
      expect(semComentarios(ler(f)), f).toContain("promessaDaForma(");
    }
  });

  it("e a forma chega-lhes — da base até ao ecrã", () => {
    /*
     * O ecrã do pedido já sabia dividir a conta em dinheiro e nunca recebia a
     * forma: nem o link do email nem a conta a passavam. Sem ela, toda a gente
     * lia a versão de quem paga pela plataforma.
     */
    expect(ler("src/app/pedido/[token]/VistaDoPedido.tsx")).toContain(
      "formaDePagamento: n.formaDePagamento",
    );
    expect(ler("src/app/conta/components/OrderDetailModal.tsx")).toContain(
      "formaDePagamento: n.formaDePagamento",
    );
    for (const f of ["src/app/api/users/me/orders/route.ts", "src/lib/conta-server.ts"]) {
      expect(ler(f), f).toContain("n.formaDePagamento");
    }
    expect(ler("src/app/pedido/[token]/PropostasRecebidas.tsx")).toContain(
      "formaDePagamento={acordada.formaDePagamento",
    );
  });

  it("os emails de um trabalho recebem a forma de quem os chama", () => {
    expect(semComentarios(ler("src/app/api/negociacao/[token]/route.ts"))).toContain(
      "formaDePagamento: linha.formaDePagamento",
    );
    expect(semComentarios(ler("src/app/api/profissionais/trabalho/route.ts"))).toContain(
      "formaDePagamento: trabalho.formaDePagamento",
    );
  });

  it("os sítios que falam de dinheiro sem trabalho à frente continuam na fonte única", () => {
    for (const f of [
      "src/app/conta/components/Carteira.tsx",
      "src/app/profissionais/painel/Carteira.tsx",
      "src/app/contactos/page.tsx",
      "src/app/profissionais/page.tsx",
      "src/app/servicos/[slug]/page.tsx",
      "src/lib/como-funciona-para-o-profissional.ts",
      "src/lib/ajuda-plataforma.ts",
    ]) {
      expect(ler(f), `${f} não lê a fonte única`).toContain("pagamento-na-plataforma");
    }
  });
});

describe("o WhatsApp deixou de prometer «só paga depois»", () => {
  /*
   * «Só paga depois de o trabalho estar feito e confirmado» ia a toda a gente
   * — e a quem paga pela plataforma chega uma referência logo a seguir a
   * fechar. Diz-se agora como e quando, conforme a forma.
   */
  for (const f of ["src/lib/whatsapp-negociacao.ts", "src/lib/assistente-automatico.ts"]) {
    it(`${f} diz o que é verdade para a forma de quem lê`, () => {
      const codigo = semComentarios(ler(f));
      expect(codigo).not.toContain("Só paga depois");
      expect(codigo).toContain("whatsappAntesDeAceitar");
    });
  }
});

describe("as promessas que são falsas em qualquer forma não voltam", () => {
  /*
   * São as literais da versão da caução, e continuam falsas: a CLYON não
   * «liberta» nada por o cliente carregar num botão (entrega o que recebeu),
   * não há garantia de pagamento, e nenhum saldo é «cativo» sem o dinheiro
   * ter entrado.
   */
  const FALSAS = [
    "fica retido",
    "está retido na",
    "valor fica do lado da CLYON",
    "paga logo à CLYON",
    "liberta o pagamento",
    "pagamento foi libertado",
    "pagamento é libertado",
    "valor é libertado",
    "é libertado quando",
    "Valor cativo",
    "dinheiro ainda está cá",
  ];

  it("nenhuma sobrevive em código de produção", () => {
    const reincidentes: string[] = [];
    for (const f of PRODUCAO) {
      const codigo = semComentarios(ler(f));
      for (const frase of FALSAS) {
        if (codigo.includes(frase)) reincidentes.push(`${f} → «${frase}»`);
      }
    }
    expect(reincidentes, `A promessa voltou em:\n${reincidentes.join("\n")}`).toEqual([]);
  });

  it("nem a garantia de pagamento, com maiúscula ou sem ela", () => {
    // Havia duas em minúsculas que o teste antigo não via: no ecrã da
    // negociação do profissional e nas perguntas frequentes dele.
    const reincidentes = PRODUCAO.filter((f) => /pagamento garantido/i.test(semComentarios(ler(f))));
    expect(reincidentes).toEqual([]);
  });
});

describe("os prazos escrevem-se por extenso, e no singular certo", () => {
  it("um dia é «1 dia», dois são «2 dias»", () => {
    expect(prazoAutomaticoPorExtenso(1)).toContain("1 dia.");
    expect(prazoAutomaticoPorExtenso(2)).toContain("2 dias");
    expect(prazoDoEmailPorExtenso(1)).toContain("1 dia.");
    expect(prazoDoEmailPorExtenso(7)).toContain("7 dias");
  });

  it("meio dia arredonda para cima — nunca se anuncia menos prazo do que há", () => {
    // Dizer «0 dias» a quem ainda tem parte da tarde é apressá-lo sem razão.
    expect(prazoAutomaticoPorExtenso(0.2)).toContain("1 dia");
    expect(prazoAutomaticoPorExtenso(6.1)).toContain("7 dias");
  });

  it("falam do trabalho, e não de libertar dinheiro", () => {
    expect(prazoAutomaticoPorExtenso(3)).not.toContain("libertado");
    expect(prazoDoEmailPorExtenso(3)).not.toContain("libertado");
    expect(prazoAutomaticoPorExtenso(3)).toContain("o trabalho é dado por concluído");
  });
});
