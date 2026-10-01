import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  comissaoDaClyon,
  contaDoCliente,
  quantoOProfissionalRecebe,
  type Taxas,
} from "./taxas-plataforma";
import {
  baseDoPrecoDoCliente,
  precoParaOCliente,
  precoPossivel,
  valorDaPropostaDoCliente,
} from "./preco-do-cliente";
import { quotaDaClyon, taxaDoProfissionalParaAQuota } from "./quota-da-clyon";

/**
 * O CLIENTE VÊ O PREÇO JÁ COM A TAXA — 29-09-2026.
 *
 * "Vamos mudar como cobramos para simplificar tudo: invés de cobrar 5 % do
 *  cliente depois, vamos apresentar o valor proposto já com a taxa. Ex.: o pro
 *  propôs 350, para o cliente vai aparecer 367,5 que foi proposto, para o pro
 *  327,08 — assim a CLYON mantém-se a ganhar os 11 %."
 *
 * Três coisas mudaram, e cada uma tem aqui a sua guarda:
 *   · o cliente vê UM número por proposta — o que paga, sem IVA;
 *   · o que o cliente escreve é também um preço dele, e vira o valor do
 *     profissional antes de entrar no motor;
 *   · a comissão pensa-se como «11 % do que o cliente paga» — 5 % ao cliente
 *     e 6,55 % ao profissional —, e todos os ecrãs do profissional fazem a
 *     conta com as taxas DA NEGOCIAÇÃO, e não com as de origem.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const NOVAS: Taxas = { cliente: 0.05, profissional: 0.0655 };
const EM_DINHEIRO: Taxas = { cliente: 0.1155, profissional: 0 };
/*
 * ESTE FICHEIRO GUARDA O MODELO DE 29-09-2026 — sem IVA. Desde 01-10-2026 o
 * modelo é obrigatório em todas as funções do preço, e as negociações abertas
 * antes de `IVA_INCLUIDO_DESDE` continuam nele até ao fim. O modelo novo
 * (IVA incluído) tem os testes em `iva-incluido.test.ts`.
 */
const SEM = "sem_iva" as const;

describe("o exemplo do dono, ao cêntimo", () => {
  it("350 € do profissional → o cliente vê 367,50 € → o profissional recebe 327,08 €", () => {
    expect(precoParaOCliente(350, NOVAS, SEM)).toBe(367.5);
    expect(quantoOProfissionalRecebe(350, NOVAS)).toBe(327.08);
    expect(comissaoDaClyon(350, NOVAS)).toBe(40.42);
  });

  it("e a CLYON fica com 11 % do que o cliente paga", () => {
    expect(Math.round(quotaDaClyon(NOVAS) * 10000) / 100).toBe(11);
    expect(Math.round((40.42 / 367.5) * 1000) / 10).toBe(11);
  });

  it("os 6,55 % saem dos 11 % e dos 5 %, e não de uma conta de cabeça", () => {
    expect(taxaDoProfissionalParaAQuota(0.05, 0.11)).toBe(0.0655);
  });

  it("com as taxas de antes (5 % e 6 %) a CLYON ficava com 10,48 % do que ele pagava", () => {
    expect(Math.round(quotaDaClyon({ cliente: 0.05, profissional: 0.06 }) * 10000) / 100).toBe(10.48);
  });

  it("o total com factura é o preço dele mais 23 %", () => {
    expect(contaDoCliente(350, NOVAS).total).toBe(452.03);
  });
});

describe("o preço que ele escreve vira o valor do profissional", () => {
  it("367,50 volta a ser 350", () => {
    expect(baseDoPrecoDoCliente(367.5, NOVAS, SEM)).toBe(350);
  });

  it("300 € a pagar são 285,71 € do profissional — e dão 300,00 € outra vez", () => {
    const base = baseDoPrecoDoCliente(300, NOVAS, SEM)!;
    expect(base).toBe(285.71);
    expect(precoParaOCliente(base, NOVAS, SEM)).toBe(300);
  });

  it("um preço sem volta exacta fica um cêntimo abaixo — nunca acima", () => {
    // 238,09 € dá 249,99 € e 238,10 € dá 250,01 €: os 250,00 € ficam no meio.
    expect(precoPossivel(250, NOVAS, SEM)).toBe(249.99);
    for (let preco = 1; preco <= 3000; preco++) {
      const ficou = precoPossivel(preco, NOVAS, SEM)!;
      expect(ficou).toBeLessThanOrEqual(preco);
      expect(preco - ficou).toBeLessThan(0.015);
    }
  });

  it("e isso é a excepção: um preço redondo em cada vinte e um", () => {
    // Cerca de cem em 2100. Não exactamente cem: a vírgula flutuante deixa
    // chegar um ou outro que a conta no papel diria que não.
    let umCentimoAbaixo = 0;
    for (let preco = 1; preco <= 2100; preco++) {
      if (precoPossivel(preco, NOVAS, SEM) !== preco) umCentimoAbaixo++;
    }
    expect(umCentimoAbaixo).toBeGreaterThanOrEqual(95);
    expect(umCentimoAbaixo).toBeLessThanOrEqual(105);
  });

  it("em dinheiro a volta faz-se com as taxas de lá — 390,43 € são 350 € em mão", () => {
    expect(precoParaOCliente(350, EM_DINHEIRO, SEM)).toBe(390.43);
    expect(baseDoPrecoDoCliente(390.43, EM_DINHEIRO, SEM)).toBe(350);
  });

  it("zero, negativo ou lixo não são preço nenhum", () => {
    expect(baseDoPrecoDoCliente(0, NOVAS, SEM)).toBeNull();
    expect(baseDoPrecoDoCliente(-5, NOVAS, SEM)).toBeNull();
    expect(baseDoPrecoDoCliente(Number.NaN, NOVAS, SEM)).toBeNull();
  });
});

describe("o corpo do pedido diz em que moeda vem", () => {
  it("`preco` é o do cliente, e faz-se a volta", () => {
    expect(valorDaPropostaDoCliente({ preco: "300" }, NOVAS, SEM)).toBe(285.71);
    expect(valorDaPropostaDoCliente({ preco: "367,50" }, NOVAS, SEM)).toBe(350);
  });

  it("`valor` é de um ecrã aberto antes da mudança, e lê-se como sempre se leu", () => {
    expect(valorDaPropostaDoCliente({ valor: "300" }, NOVAS, SEM)).toBe(300);
    expect(valorDaPropostaDoCliente({ valor: 280 }, NOVAS, SEM)).toBe(280);
  });

  it("sem número nenhum, o motor recebe NaN e diz «Indique um valor.»", () => {
    expect(valorDaPropostaDoCliente({}, NOVAS, SEM)).toBeNaN();
    expect(valorDaPropostaDoCliente({ preco: "abc" }, NOVAS, SEM)).toBeNaN();
  });

  it("as duas portas do cliente fazem a volta com as taxas — e o modelo — DAQUELA negociação", () => {
    const LINK = semComentarios(ler("src/app/api/negociacao/[token]/route.ts"));
    const CONTA = semComentarios(ler("src/app/api/users/me/negociacao/route.ts"));
    // Com IVA incluído desde o corte de 01-10-2026: o modelo é o da linha.
    const VOLTA =
      /valorDaPropostaDoCliente\(\s*corpo,\s*taxasDaNegociacao\(linha\),\s*modeloDaNegociacao\(linha\.createdAt\),?\s*\)/;
    expect(LINK).toMatch(VOLTA);
    expect(CONTA).toMatch(VOLTA);
    // E só o cliente: o profissional continua a escrever o valor dele.
    expect(LINK).toContain('lado === "cliente"');
  });

  it("o ecrã do cliente manda `preco`, e mostra no botão o número que fica", () => {
    const ECRA = semComentarios(ler("src/app/pedido/[token]/PropostasRecebidas.tsx"));
    expect(ECRA).toContain("preco,");
    expect(ECRA).toContain("ajustar={(v) => precoPossivel(v, taxasDela, modeloDela)}");
    expect(ECRA).toContain("referencia={precoEmCima}");
  });
});

describe("um número só, em todo o lado onde o cliente lê", () => {
  const CLIENTE = [
    "src/lib/whatsapp-negociacao.ts",
    "src/lib/assistente-automatico.ts",
    "src/lib/mensagem-das-propostas.ts",
    "src/lib/conta-em-palavras.ts",
    "src/app/pedido/[token]/PropostasRecebidas.tsx",
  ];

  it("ninguém volta a escrever «X para ele mais a taxa CLYON»", () => {
    for (const f of CLIENTE) {
      expect(semComentarios(ler(f)), f).not.toContain("para ele mais a taxa CLYON");
      expect(semComentarios(ler(f)), f).not.toContain("Com a taxa CLYON, fica em");
    }
  });

  it("o histórico do cliente conta-se na moeda dele", () => {
    const ECRA = semComentarios(ler("src/app/pedido/[token]/PropostasRecebidas.tsx"));
    expect(ECRA).toContain("valorVisto={(v) => precoParaOCliente(v, taxasDela, modeloDela)}");
    const HIST = ler("src/components/HistoricoDaNegociacao.tsx");
    expect(HIST).toContain("euros(valorVisto ? valorVisto(e.valor) : e.valor)");
  });

  it("no WhatsApp, a proposta e a aceitação chegam com o preço dele — e o botão também", () => {
    const CEREBRO = semComentarios(ler("src/lib/whatsapp-negociacao.ts"));
    expect(CEREBRO).toContain("const preco = precoParaOCliente(dados.valor, taxas, modelo);");
    // Com a unidade quando o pedido é por carga (30-09-2026).
    expect(CEREBRO).toContain("propõe ${precoComBase(euros(preco), dados.base)}");
    expect(CEREBRO).toContain("aceitou os ${precoComBase(euros(preco), dados.base)}");
    expect(CEREBRO).toContain("titulo: tituloDeFechar(preco, dados.base)");
    expect(CEREBRO).not.toContain("Math.round(dados.valor)");
    // O botão tem os cêntimos do preço dele — 367,50 €, e não «368 €».
    expect(CEREBRO).toContain('const escrito = euros(preco).replace(",00 €", " €");');
  });

  it("no WhatsApp, a contraproposta dele entra como o que ele paga", () => {
    const CEREBRO = semComentarios(ler("src/lib/whatsapp-negociacao.ts"));
    expect(CEREBRO).toContain("const valor = baseDoPrecoDoCliente(preco, taxas, modelo);");
    expect(CEREBRO).toContain('propor(estado, "cliente", valor, new Date())');
    expect(CEREBRO).toContain("Contraproposta de ${precoComBase(euros(ficou), baseDele)} enviada");
  });

  it("o email e o aviso no telemóvel levam o preço dele; o do profissional, o valor dele", () => {
    const AVISO = semComentarios(ler("src/lib/avisar-da-proposta.ts"));
    expect(AVISO).toContain("const preco = precoParaOCliente(dados.valor, taxas, modelo);");
    expect(AVISO).toContain("valor: preco,");
    const EMAIL = semComentarios(ler("src/lib/email-proposta.ts"));
    expect(EMAIL).toContain('Tem uma proposta de ${precoComBase(euros(p.preco), p.base ?? "total")}');
  });
});

describe("o profissional lê o líquido com as taxas DA NEGOCIAÇÃO dele", () => {
  /*
   * Com as taxas de origem escritas no código (6 %), a mudança para 6,55 %
   * deixava sete sítios a prometer-lhe 329 € de um trabalho que lhe deixa
   * 327,08 € — por escrito, em emails. Uma chamada com um só argumento é uma
   * chamada que usa as de origem.
   */
  const UM_ARGUMENTO = /quantoOProfissionalRecebe\((?:[^(),]|\([^()]*\))*\)/g;
  const DO_PROFISSIONAL = [
    "src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx",
    "src/app/profissionais/painel/Trabalhos.tsx",
    "src/lib/email-proposta.ts",
    "src/lib/sugestao-para-o-profissional.ts",
    "src/lib/sugestao-ajustada.ts",
    "src/app/api/admin/negociacoes/reenviar/route.ts",
  ];

  it("nenhum destes ecrãs chama a conta sem as taxas", () => {
    for (const f of DO_PROFISSIONAL) {
      expect(semComentarios(ler(f)).match(UM_ARGUMENTO) ?? [], f).toEqual([]);
    }
  });

  it("quem contrata é o cliente — e as taxas são as da linha, não as de `doProfissional`", () => {
    const LINK = semComentarios(ler("src/app/api/negociacao/[token]/route.ts"));
    expect(LINK).not.toContain("taxasDaNegociacao(doProfissional)");
    expect(LINK).toContain("quantoOProfissionalRecebe(nova.valorAcordado, taxasDaNegociacao(linha))");
  });

  it("o email de trabalho confirmado exige as taxas", () => {
    expect(ler("src/lib/avisar-confirmacao.ts")).toContain("taxas: taxasDaNegociacao(n),");
  });
});

describe("o backoffice pensa como o dono", () => {
  const ADMIN = ler("src/components/admin/LegacyAdminClient.tsx");

  it("os campos são o acréscimo ao cliente e a parte da CLYON no que ele paga", () => {
    expect(ADMIN).toContain('ajuda: "do que o cliente paga"');
    expect(ADMIN).toContain("profissionalDosCampos(");
    expect(ADMIN).toContain("taxaDoProfissionalParaAQuota(c, q)");
  });

  it("e mostra o exemplo dos 350 € feito com as funções que contam a sério", () => {
    // No modelo de hoje — com IVA incluído desde 01-10-2026, e o IVA à parte da CLYON.
    expect(ADMIN).toContain("precoDoCliente(350, t, modeloDeHoje())");
    expect(ADMIN).toContain("quantoOProfissionalRecebe(350, t)");
  });
});
