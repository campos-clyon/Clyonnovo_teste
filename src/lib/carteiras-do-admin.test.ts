import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * As carteiras, no backoffice.
 *
 * "Todos esses pedidos já foram concluídos e recebemos os pagamentos, mas não
 * tenho acesso aos dados dos pros para efectuar o pagamento deles manual, já
 * que por enquanto estamos à espera do eupago validar a nossa conta. Devíamos
 * ver o IBAN dos pros, nome completo e morada fiscal, assim como o MB WAY como
 * outra opção de pagamento. Deixe o admin ver todas as carteiras e gerir os
 * pagamentos."
 *
 * O ecrã dos Levantamentos mostra quem PEDIU para receber, e dizia "nada por
 * transferir" com 570 € por transferir. Para pedir é preciso ter IBAN gravado,
 * e dois dos três profissionais com trabalho por pagar não o têm: a fila estava
 * vazia porque ninguém conseguia entrar nela.
 */

const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const ROTA = ler("src/app/api/admin/carteiras/route.ts");
const PAINEL = ler("src/components/admin/AdminCarteirasPanel.tsx");
const SHELL = ler("src/components/admin/LegacyAdminClient.tsx");
const DB = ler("src/lib/db.ts");
const PERFIL = ler("src/app/api/profissionais/perfil/route.ts");

describe("a pergunta certa", () => {
  it("olha para quem TEM A RECEBER, e não para quem pediu", () => {
    // É a diferença entre um ecrã vazio e 570 € à espera.
    // Olha para as negociações acordadas, e não para a fila dos pedidos de
    // levantamento — é a diferença entre um ecrã vazio e 570 EUR à espera.
    expect(ROTA).toContain("n.estado = 'acordada'");
    expect(ROTA).toContain("n.pagoEm");
    expect(ROTA).not.toContain("FROM levantamentos");
  });

  it("exige admin — é a rota onde o IBAN sai inteiro", () => {
    // Em todo o resto da casa o IBAN volta encurtado. Aqui o número é o
    // produto: sem ele não há transferência.
    expect(ROTA).toContain("requireAdmin(req)");
    expect(ROTA).not.toContain("ibanEncurtado");
  });

  it("conta o líquido, e não o acordado", () => {
    // O que sai do banco é o que ele recebe, já com a taxa descontada.
    expect(ROTA).toContain("quantoOProfissionalRecebe");
  });

  it("põe à frente quem tem mais a receber", () => {
    expect(ROTA).toContain("b.totalPorPagar - a.totalPorPagar");
  });

  it("conta quem não tem por onde receber", () => {
    // Foi isto que explicou o ecrã vazio dos Levantamentos.
    expect(ROTA).toContain("c.totalPorPagar > 0 && !c.iban && !c.mbway");
  });
});

describe("marcar como pago", () => {
  it("os guardas vivem no SQL — carregar duas vezes não paga duas vezes", () => {
    const i = ROTA.indexOf("UPDATE negociacoes SET pagoEm = NOW()");
    const sql = ROTA.slice(i, i + 200);
    expect(sql).toContain("estado = 'acordada'");
    expect(sql).toContain("confirmadoEm IS NOT NULL");
    expect(sql).toContain("pagoEm IS NULL");
  });

  it("uma segunda tentativa devolve o motivo, e não um ok", () => {
    expect(ROTA).toContain("ou já foi pago");
    expect(ROTA).toContain("status: 409");
  });

  it("fica no histórico e no registo permanente, com quem marcou", () => {
    expect(ROTA).toContain("appendOrderHistory");
    expect(ROTA).toContain('acontecimento: "levantamento_pago"');
    expect(ROTA).toContain("Transferência feita fora da plataforma.");
  });

  it("o ecrã avisa que a transferência vem PRIMEIRO", () => {
    // O botão regista; não move dinheiro. Confundir os dois é pagar duas vezes
    // ou nenhuma.
    expect(PAINEL).toContain("Faça a transferência PRIMEIRO no banco");
  });
});

describe("o MB WAY", () => {
  it("tem coluna própria, e não é o telefone de contacto", () => {
    // Os dois números podem não ser o mesmo, e assumir que são é mandar
    // dinheiro para o sítio errado.
    expect(DB).toContain("ALTER TABLE providers ADD COLUMN mbway");
    expect(ROTA).toContain("p.mbway");
  });

  it("é validado ao gravar — um número errado paga a outra pessoa", () => {
    const i = PERFIL.indexOf('if ("mbway" in corpo)');
    const bloco = PERFIL.slice(i, PERFIL.indexOf('if ("iban" in corpo)', i));
    expect(bloco).toContain("digitos.length !== 9");
    expect(bloco).toContain("/^9/");
    // Apagar continua a ser possível: um campo opcional tem de se poder esvaziar.
    expect(bloco).toContain("mudancas.mbway = null;");
  });
});

describe("o ecrã", () => {
  it("está no menu, ao lado dos Levantamentos", () => {
    expect(semComentarios(SHELL)).toContain('"carteiras"');
    expect(SHELL).toContain("<AdminCarteirasPanel />");
  });

  it("mostra as três coisas que ele pediu", () => {
    expect(PAINEL).toContain("Transferência");
    expect(PAINEL).toContain("MB WAY");
    expect(PAINEL).toContain("Morada fiscal");
    expect(PAINEL).toContain("NIF");
  });

  it("copia o IBAN em vez de o obrigar a transcrever", () => {
    // Vinte e cinco caracteres à mão são vinte e cinco ocasiões para enganar.
    expect(PAINEL).toContain("navigator.clipboard.writeText");
  });

  it("diz quando falta o titular — um nome que não bate é transferência devolvida", () => {
    expect(PAINEL).toContain("Sem titular indicado.");
  });
});

describe("os três montes", () => {
  it("cada trabalho está exactamente num deles", () => {
    /*
     * "A carteira deve mostrar os valores já pagos, por pagar, e por
     * finalizar — seriam os trabalhos acordados mas ainda não realizados."
     *
     * Faltava o terceiro, e é o que diz o que aí vem: trabalho fechado com o
     * profissional, dinheiro do cliente já cativo, mas ainda por fazer. Sem
     * ele a carteira mostrava o passado e calava o futuro.
     */
    const i = ROTA.indexOf("Três montes");
    expect(i).toBeGreaterThan(-1);
    const bloco = ROTA.slice(i, i + 700);
    // Pago sai primeiro, por finalizar a seguir, e o resto é por pagar. Cada
    // ramo termina em `continue`, para nenhum trabalho contar duas vezes.
    expect(bloco.indexOf("l.pagoEm != null")).toBeLessThan(bloco.indexOf("l.confirmadoEm == null"));
    expect((bloco.match(/continue;/g) ?? []).length).toBe(2);
  });

  it("a consulta deixou de filtrar só as confirmadas", () => {
    // Era esse filtro que escondia o terceiro monte por completo.
    expect(ROTA).not.toContain("n.estado = 'acordada' AND n.confirmadoEm IS NOT NULL");
  });

  it("distingue «por fazer» de «falta confirmar»", () => {
    // São esperas diferentes: uma é do profissional, a outra é de quem confirma.
    expect(ROTA).toContain("l.confirmadoEm == null && l.execucaoEnviadaEm != null");
    expect(PAINEL).toContain("falta confirmar");
    expect(PAINEL).toContain("por fazer");
  });

  it("o que está a decorrer NÃO tem botão de pagar", () => {
    // Não é dinheiro dele ainda: está cativo do lado do cliente. Um botão aqui
    // seria um convite a pagar por trabalho que ainda não foi feito.
    const i = PAINEL.indexOf("c.porFinalizar.map((t) => (");
    const bloco = PAINEL.slice(i, i + 1400);
    expect(bloco).not.toContain("marcarPago");
    expect(bloco).not.toContain("Já paguei");
  });

  /*
   * DEIXOU DE SER UMA LISTA E PASSOU A SER TRÊS SECÇÕES — 18-09-2026.
   *
   * *«Muitas informações nessa tela misturadas; organize tudo de modo
   * profissional.»* Estavam todos no mesmo monte e com o mesmo cartão: quem
   * tem 500 € à espera de transferência e quem nunca fez um trabalho ocupavam
   * o mesmo espaço.
   *
   * O que este teste guarda continua a ser o mesmo — quem tem dinheiro a
   * caminho não é «sem nada» e não cai no fundo. Só que agora tem secção
   * própria, com título, em vez de estar no meio de uma lista corrida.
   */
  it("quem tem trabalho a decorrer não cai no fundo com os parados", () => {
    expect(PAINEL).toContain("const aDecorrer = carteiras.filter(");

    /*
     * Procura-se só DEPOIS do início da lista. «A decorrer» aparece duas
     * vezes no ficheiro — uma dentro do cartão de cada profissional, outra
     * como título de secção — e a primeira está acima de tudo.
     */
    const lista = PAINEL.slice(PAINEL.indexOf("Ainda não há profissionais"));
    const aPagar = lista.indexOf("A pagar agora");
    const decorrer = lista.indexOf("A decorrer ·");
    const semNada = lista.indexOf("Sem movimento ·");
    expect(aPagar).toBeGreaterThan(0);
    expect(decorrer).toBeGreaterThan(aPagar);
    expect(semNada).toBeGreaterThan(decorrer);
  });

  /*
   * O que não tem nada a receber nem a caminho fica FECHADO. Não há gesto
   * nenhum a fazer com ele, e eram dezasseis a empurrar para baixo os dois que
   * interessavam.
   */
  it("os parados abrem-se por escolha, e não por omissão", () => {
    expect(PAINEL).toContain("useState(false)");
    expect(PAINEL).toContain("{verParados && (");
  });

  /*
   * ERA ISTO QUE ENCHIA O ECRÃ: duas caixas de IBAN e MB WAY, mais a morada
   * fiscal, repetidas em cada profissional — incluindo aqueles a quem não se
   * devia nada. O bloco de pagamento só faz sentido onde se vai pagar.
   */
  it("o bloco de IBAN e MB WAY só aparece em quem se vai pagar", () => {
    expect(PAINEL).toContain('{modo === "pagar" && (');
    const i = PAINEL.indexOf("Transferência");
    const abre = PAINEL.lastIndexOf('modo === "pagar"', i);
    expect(abre).toBeGreaterThan(0);
  });

  it("os três totais aparecem no topo", () => {
    expect(PAINEL).toContain("Por finalizar");
    expect(PAINEL).toContain("Por transferir");
    expect(PAINEL).toContain("Já pagos");
    // E só o do meio tem cor: é o único que exige acção hoje.
    const i = PAINEL.indexOf("Por transferir");
    expect(PAINEL.slice(Math.max(0, i - 400), i)).toContain("border-emerald-500/30");
  });
});

describe("a morada fiscal deixa de estar atrás do interruptor", () => {
  const PERFIL_ECRA = readFileSync(
    join(process.cwd(), "src/app/profissionais/painel/Perfil.tsx"),
    "utf8",
  );

  it("o NIF e a morada fiscal aparecem a toda a gente", () => {
    /*
     * "Falta a opção de colocar a morada fiscal, que é muitas vezes diferente
     * da actual."
     *
     * Existia — mas só aparecia a quem ligasse «Emito fatura». Fazia sentido
     * enquanto isto era só sobre facturas; deixou de fazer no dia em que
     * passámos a pagar a estas pessoas. Quem recebe dinheiro tem de ser
     * identificável, passe factura ou não.
     *
     * O TRSul tem 57 € a receber e a ficha dele diz «sem NIF · morada fiscal
     * por indicar», porque não liga um interruptor que não lhe diz respeito.
     */
    const i = PERFIL_ECRA.indexOf('{seccao === "faturacao" && (');
    const gate = PERFIL_ECRA.indexOf("{dados.emiteFatura && (", i);
    /*
     * Procura-se o ATRIBUTO, e não a etiqueta inteira.
     *
     * Era `'<Campo etiqueta="NIF">'` e partiu-se no dia em que o campo ganhou
     * um segundo atributo — o triângulo de «por preencher». O que este teste
     * guarda é a POSIÇÃO do NIF em relação ao interruptor, e não a lista de
     * propriedades que o campo tem nesse dia.
     */
    const nif = PERFIL_ECRA.indexOf('etiqueta="NIF"', i);
    const morada = PERFIL_ECRA.indexOf('etiqueta="Morada fiscal"', i);
    expect(nif).toBeGreaterThan(-1);
    expect(nif).toBeLessThan(gate);
    expect(morada).toBeLessThan(gate);
  });

  it("o regime de IVA continua atrás dele — esse só existe com factura", () => {
    const gate = PERFIL_ECRA.indexOf("{dados.emiteFatura && (");
    expect(PERFIL_ECRA.indexOf("Regime de IVA")).toBeGreaterThan(gate);
  });

  it("a Conta bancária diz onde eles estão", () => {
    // Foi lá que ele foi procurar: quem pensa em receber dinheiro pensa nessa
    // secção. Uma linha a dizer onde está poupa a procura.
    expect(PERFIL_ECRA).toContain("O NIF e a morada fiscal ficam em");
    expect(PERFIL_ECRA).toContain("Faturação e IVA");
  });

  it("continuam a ser gravados na mesma chamada", () => {
    expect(PERFIL_ECRA).toContain("moradaFiscal: dados.moradaFiscal,");
    expect(PERFIL_ECRA).toContain("codigoPostalFiscal: dados.codigoPostalFiscal,");
    expect(PERFIL_ECRA).toContain("localidadeFiscal: dados.localidadeFiscal,");
  });
});

describe("a comissão da casa", () => {
  it("vem das DUAS pontas, e não de uma", () => {
    /*
     * "Coloque também os ganhos da CLYON."
     *
     * 5% que o cliente paga a mais e 6% que se desconta ao profissional. Não
     * se lê nem do que entra nem do que sai: é a diferença entre os dois, e
     * não estava em lado nenhum do backoffice.
     */
    // Sem o parêntese de fecho: ganhou o argumento das taxas da negociação.
    expect(ROTA).toContain("comissaoDaClyon(acordado");
    // O valor acordado e SEM IVA desde 29-08-2026: o facturado ao cliente tem
    // de levar o imposto de quem factura, ou fica 23% abaixo do que ha mesmo.
    expect(ROTA).toContain("contaDoCliente(acordado, regimeDeIva(l.regimeIva)");
  });

  it("segue os mesmos três estados do dinheiro deles", () => {
    // Uma comissão de trabalho por fazer ainda não é ganho: é promessa.
    expect(ROTA).toContain("const clyon = { porFinalizar: 0, ganha: 0, fechada: 0, faturado: 0 };");
    expect(ROTA).toContain("clyon.porFinalizar = Math.round(");
    expect(ROTA).toContain("clyon.ganha = Math.round(");
    expect(ROTA).toContain("clyon.fechada = Math.round(");
  });

  it("só conta como facturado o que o cliente já pagou", () => {
    // O trabalho por fazer não entra: o dinheiro está cativo, não facturado.
    const i = ROTA.indexOf("if (l.confirmadoEm == null) {");
    const bloco = ROTA.slice(i, ROTA.indexOf("continue;", i));
    expect(bloco).toContain("clyon.porFinalizar");
    expect(bloco).not.toContain("clyon.faturado");
  });

  it("o número fechado é o que tem destaque — é o único que é mesmo ganho", () => {
    const i = PAINEL.indexOf("A comissão da CLYON");
    const bloco = PAINEL.slice(i, i + 1800);
    expect(bloco).toContain("Fechada");
    expect(bloco).toContain("trabalho feito e pago");
    // Os outros dois ficam em cinzento; só este é branco.
    expect(bloco).toContain('text-xl font-bold text-white">{euros(clyon.fechada)}');
  });

  it("mostra o facturado ao cliente, para dar escala à comissão", () => {
    expect(PAINEL).toContain("facturados aos clientes até hoje");
  });
});

/**
 * RECONHECER O TRABALHO ANTES DE CARREGAR EM «JÁ PAGUEI».
 *
 * *«Para eu dizer se já paguei preciso saber de qual se trata: nome do
 * cliente, número e localidade. Também quem realizou.»* — 18-09-2026.
 *
 * O botão tira dinheiro da conta da CLYON com base no reconhecimento de quem
 * carrega nele. «#325 · Recolha de móveis · Carcavelos» não chega: quem paga
 * tem a transferência no homebanking de um lado e esta lista do outro, e o que
 * faz a ponte entre as duas é o nome e o telefone.
 */
describe("o trabalho é reconhecível", () => {
  it("a consulta traz quem contratou, onde e quando", () => {
    for (const coluna of ["o.contactName", "o.contactPhone", "o.address", "o.scheduledDate"]) {
      expect(semComentarios(ROTA), coluna).toContain(coluna);
    }
  });

  it("e a resposta leva-os até ao ecrã", () => {
    for (const campo of ["cliente:", "telefoneDoCliente:", "morada:", "profissional:"]) {
      expect(semComentarios(ROTA), campo).toContain(campo);
    }
  });

  /*
   * Os dois blocos — «por pagar» e «a decorrer» — mostram o mesmo trabalho e
   * só diferem no botão da direita. Duas cópias da identificação acabavam com
   * dois formatos, e um deles a ficar para trás.
   */
  /*
   * Juntaram-se numa só a 18-09-2026: os dois blocos passaram a usar a mesma
   * `LinhaDoTrabalho`, e a identificação vive lá dentro uma vez. É mais forte
   * do que duas cópias iguais — não há como divergirem.
   */
  it("os dois montes usam a mesma linha, e não duas cópias", () => {
    const sem = semComentarios(PAINEL);
    expect(sem).toContain("function QuemOndeQuando");
    expect(sem).toContain("function LinhaDoTrabalho");
    expect(sem.match(/<QuemOndeQuando t=\{t\} \/>/g) ?? []).toHaveLength(1);
    // Os dois montes montam-na: o que muda é o botão da direita.
    expect(sem).toContain("pagavel />");
    expect(sem).toContain("pagavel={false}");
  });

  it("o telemóvel do cliente liga-se com um toque", () => {
    // Metade destas dúvidas resolve-se com uma chamada. Obrigar a copiar o
    // número é a diferença entre ligar e deixar para depois.
    expect(PAINEL).toContain("href={`tel:${t.telefoneDoCliente");
  });
});
