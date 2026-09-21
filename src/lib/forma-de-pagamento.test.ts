import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  lerForma,
  formasDisponiveis,
  taxasParaAForma,
  acrescimoDaForma,
  excedeONumerario,
  PAGAR_DEPOIS_LIGADO,
  ACRESCIMO_POS_RECOLHA,
  MAXIMO_EM_NUMERARIO,
} from "./forma-de-pagamento";
import {
  contaDoCliente,
  taxasDaNegociacao,
  quantoOProfissionalRecebe,
  TAXAS_DE_ORIGEM,
} from "./taxas-plataforma";
import { quantoACLYONCobra, quantoOClientePaga } from "./eupago";
import {
  carteiraDe,
  porCobrarDe,
  recebidoEmMaoDe,
  recusaDoLevantamento,
  EXPLICACAO_DA_RECUSA,
  type TrabalhoNaCarteira,
} from "./carteira";
import { carteiraDoLivro, livroDe, movimentoDoTrabalho } from "./livro-da-carteira";

/**
 * DINHEIRO NO LOCAL, E O «PAGAR DEPOIS» ESCRITO E DESLIGADO — 21-09-2026.
 *
 * "Temos aceitar pagamento pós recolha com um acréscimo de 5 euros, caso o
 *  cliente opte por ele. E também a opção de pagamento em dinheiro no local."
 *
 * As três decisões do dono, no mesmo dia, e é a elas que estes testes se
 * agarram:
 *   · no dinheiro, a CLYON cobra os 11 % ao cliente — «Sim, os 11 % cobrados
 *     ao cliente»;
 *   · o pós-recolha fica escrito, testado e desligado;
 *   · os 5 € são da CLYON, e fica com eles.
 *
 * O QUE MAIS DÓI SE FALHAR, e é por isso que está aqui: um trabalho pago em
 * mão a aparecer como «disponível» na carteira. Um profissional que recebeu
 * 120 € em notas e vê 120 € para levantar na CLYON pede-os — e a CLYON
 * transferia dinheiro que nunca recebeu.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const semComentarios = (f: string) =>
  f.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const agora = new Date("2026-09-21T12:00:00Z");
const haDias = (d: number) => new Date(agora.getTime() - d * 86_400_000);

const emDinheiro = (p: Partial<TrabalhoNaCarteira> = {}): TrabalhoNaCarteira => ({
  negociacaoId: 1,
  estado: "acordada",
  valorAcordado: 120,
  formaDePagamento: "dinheiro",
  // O que `criarNegociacao` grava em dinheiro: os dois lados ao cliente.
  taxaCliente: "0.1100",
  taxaProfissional: "0.0000",
  confirmadoEm: haDias(1),
  ...p,
});

describe("a forma lê-se sempre para uma que se possa usar", () => {
  it("nulo, vazio ou lixo é a de sempre", () => {
    for (const v of [null, undefined, "", "cheque", 42, {}]) {
      expect(lerForma(v), String(v)).toBe("na_plataforma");
    }
  });

  it("dinheiro passa; o pós-recolha NÃO, enquanto estiver desligado", () => {
    /*
     * É a única porta por onde uma negociação podia nascer com uma forma que
     * os Termos ainda não prometem. Fica fechada aqui, para todas as
     * entradas — o formulário, o backoffice, o JSON escrito à mão.
     */
    expect(PAGAR_DEPOIS_LIGADO).toBe(false);
    expect(lerForma("dinheiro")).toBe("dinheiro");
    expect(lerForma("pos_recolha")).toBe("na_plataforma");
    expect(formasDisponiveis()).toEqual(["na_plataforma", "dinheiro"]);
  });
});

describe("no dinheiro, a CLYON cobra os dois lados ao cliente", () => {
  it("as taxas gravadas passam a cliente 11 %, profissional 0", () => {
    expect(taxasParaAForma("dinheiro", TAXAS_DE_ORIGEM)).toEqual({ cliente: 0.11, profissional: 0 });
    expect(taxasParaAForma("na_plataforma", TAXAS_DE_ORIGEM)).toEqual(TAXAS_DE_ORIGEM);
  });

  it("e zero é uma taxa legítima quando se lê da base — não «em falta»", () => {
    // Se `taxaValida(0)` caísse nas taxas de origem, o profissional voltava a
    // levar 6 % de desconto num trabalho que recebeu por inteiro em mão.
    const t = taxasDaNegociacao({ taxaCliente: "0.1100", taxaProfissional: "0.0000" });
    expect(t).toEqual({ cliente: 0.11, profissional: 0 });
    expect(quantoOProfissionalRecebe(120, t)).toBe(120);
  });

  it("a referência é SÓ a parte da CLYON: 13,20 € sem factura, 16,24 € com", () => {
    /*
     * Nunca o `semIva` inteiro: 133,20 € a um cliente que acabou de dar
     * 120,00 € em notas ao profissional é cobrar o serviço duas vezes.
     */
    const t = { cliente: 0.11, profissional: 0 };
    expect(quantoACLYONCobra(120, "isento", t, false)).toBe(13.2);
    expect(quantoACLYONCobra(120, "isento", t, true)).toBe(16.24);
    // E o caminho electrónico continua a pedir o total do cliente.
    expect(quantoOClientePaga(120, "isento", TAXAS_DE_ORIGEM, false)).toBe(126);
  });
});

describe("os 5 € do pós-recolha são da CLYON, com o IVA da CLYON por cima", () => {
  it("entram na base da CLYON e nunca no valor acordado", () => {
    expect(acrescimoDaForma("pos_recolha")).toBe(ACRESCIMO_POS_RECOLHA);
    expect(acrescimoDaForma("dinheiro")).toBe(0);
    const c = contaDoCliente(120, "isento", TAXAS_DE_ORIGEM, 5);
    expect(c.servico).toBe(120);
    expect(c.taxa).toBe(6);
    expect(c.acrescimo).toBe(5);
    expect(c.ivaDaTaxa).toBe(2.53);
    expect(c.semIva).toBe(131);
    expect(c.total).toBe(133.53);
    // O profissional não vê um cêntimo dos 5 €: o acordado continua a ser 120.
    expect(quantoOProfissionalRecebe(120, TAXAS_DE_ORIGEM)).toBe(112.8);
  });

  it("com o profissional no regime normal, dá o mesmo dos dois modos", () => {
    const c = contaDoCliente(120, "normal", TAXAS_DE_ORIGEM, 5);
    expect(c.total).toBe(161.13);
    // A invariante das duas facturas sobrevive ao acréscimo.
    const doPro = Math.round((c.servico + c.ivaDoServico) * 100) / 100;
    const daClyon = Math.round((c.taxa + c.acrescimo + c.ivaDaTaxa) * 100) / 100;
    expect(Number((doPro + daClyon).toFixed(2))).toBe(c.total);
  });

  it("sem acréscimo, nenhum número muda — é o que mantém os testes antigos certos", () => {
    const antes = contaDoCliente(120, "isento");
    expect(antes.acrescimo).toBe(0);
    expect(antes.semIva).toBe(126);
    expect(antes.total).toBe(127.38);
  });
});

describe("a carteira: pago em mão nunca é «disponível»", () => {
  it("um trabalho em dinheiro, feito, vai para recebidoEmMao — e só para lá", () => {
    const c = carteiraDe([emDinheiro()], [], agora);
    expect(c.recebidoEmMao).toBe(120);
    expect(c.disponivel).toBe(0);
    expect(c.porCobrar).toBe(0);
    expect(c.cativo).toBe(0);
    expect(c.totalGanho).toBe(120);
  });

  it("ainda por fazer, não é dinheiro de ninguém", () => {
    const c = carteiraDe([emDinheiro({ confirmadoEm: null, execucaoEnviadaEm: null })], [], agora);
    expect(c.recebidoEmMao).toBe(0);
    expect(c.totalGanho).toBe(0);
  });

  it("e o levantamento diz o que é, em vez de «não tem esse valor disponível»", () => {
    const c = carteiraDe([emDinheiro()], [], agora);
    expect(recusaDoLevantamento(50, c, true, false)).toBe("pago_em_mao");
    expect(EXPLICACAO_DA_RECUSA.pago_em_mao).toContain("em dinheiro");
  });

  it("o livro não escreve movimento nenhum — nada passou pela CLYON", () => {
    expect(movimentoDoTrabalho({ ...emDinheiro(), providerId: 1 })).toBeNull();
  });

  it("e os dois caminhos da carteira continuam a dar exactamente o mesmo", () => {
    /*
     * `carteiraDoLivro` não vê negociações: recebe o por cobrar E o recebido
     * em mão de fora, das mesmas funções. Se um dia divergirem, foi um dos
     * caminhos que deixou de contar um trabalho.
     */
    const trabalhos = [emDinheiro(), emDinheiro({ negociacaoId: 2, formaDePagamento: null, taxaCliente: null, taxaProfissional: null })];
    const hoje = carteiraDe(trabalhos, [], agora);
    const livro = livroDe(1, trabalhos, []);
    const doLivro = carteiraDoLivro(livro, agora, porCobrarDe(trabalhos), recebidoEmMaoDe(trabalhos, agora));
    expect(doLivro).toEqual(hoje);
    expect(hoje.recebidoEmMao).toBe(120);
  });
});

describe("o tecto legal ao numerário", () => {
  it("é uma constante só, verificada no acordado", () => {
    expect(MAXIMO_EM_NUMERARIO).toBe(3000);
    expect(excedeONumerario(2999.99)).toBe(false);
    expect(excedeONumerario(3000)).toBe(true);
    expect(excedeONumerario(null)).toBe(false);
  });

  it("e a correcção do valor também o verifica — «combinado a 135, o trabalho foram 230»", () => {
    const rota = semComentarios(ler("src/app/api/admin/negociacoes/valor/route.ts"));
    expect(rota).toContain("excedeONumerario(novo)");
  });
});

describe("a forma atravessa a casa inteira, e é congelada com as taxas", () => {
  it("a distribuição passa-a a cada negociação que nasce", () => {
    const d = semComentarios(ler("src/lib/distribuir-pedido.ts"));
    expect(d).toContain("formaDePagamento: lerForma(pedido.formaDePagamento)");
    const db = semComentarios(ler("src/lib/db.ts"));
    expect(db).toContain("taxasParaAForma(forma, await taxasParaUmaNegociacaoNova())");
  });

  it("o cliente escolhe ao pedir, e o backoffice também a grava", () => {
    // Os clientes do telefone entram pelo backoffice — e são os que mais
    // escolhem dinheiro. Sem isto a forma ficava nula exactamente para eles.
    const publica = semComentarios(ler("src/app/plataforma/pedir/components/ValoresEFaturacao.tsx"));
    expect(publica).toContain("formasDisponiveis()");
    const admin = semComentarios(ler("src/app/api/admin/pedidos/criar/route.ts"));
    expect(admin).toContain("formaDePagamento: lerForma(corpo.formaDePagamento)");
  });

  it("o profissional é avisado ANTES de propor — e é aviso, não filtro", () => {
    const e = semComentarios(ler("src/lib/profissional-elegivel.ts"));
    expect(e).toContain('avisos.push("cliente_paga_em_dinheiro")');
    expect(e).not.toContain('motivos.push("cliente_paga_em_dinheiro")');
  });

  it("e o backoffice cobra só a parte da CLYON quando foi em mão", () => {
    const rota = semComentarios(ler("src/app/api/admin/pagamentos/criar/route.ts"));
    expect(rota).toContain('t.formaDePagamento === "dinheiro"');
    expect(rota).toContain("quantoACLYONCobra(");
  });

  it("a frase dos 11 % «a facturar ao profissional» morreu", () => {
    // Dizia «comissão CLYON 13,20 € (a facturar ao profissional)» — os dois
    // lados somados, mandados facturar a um só.
    const mesa = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
    expect(mesa).not.toContain('{" (a facturar ao profissional)"}');
  });
});
