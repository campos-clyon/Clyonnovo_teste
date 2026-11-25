import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIGA_QUAL_PREFERE,
  NADA_ADIANTADO_PAGA_AO_PARCEIRO,
  RESERVAMOS_A_MAIS_EM_CONTA,
  RESERVAMOS_ESTA_PROPOSTA,
  mensagemDasPropostas,
  notaDaVariante,
  propostasParaOCliente,
  varianteDasPropostas,
  varianteDoTexto,
} from "./mensagem-das-propostas";
import { textoDoOrcamentoDaMesa, type PedidoDoOrcamento } from "./texto-do-orcamento-da-mesa";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { lembreteDasPropostas, mensagemDoLembrete } from "./propostas-sem-resposta";
import { oQuePodeFazer } from "./email-proposta";
import { PEDIR_E_GRATIS_NO_EMAIL } from "./email-pedido";
import { AS_CARGAS_CONFIRMAM_SE_NO_LOCAL } from "./extra-no-local";
import { mensagemWhatsApp } from "./mensagem-whatsapp";
import { passoDaPergunta } from "./reler-a-conversa";

/**
 * d91 (23-11-2026, parte do Site) — as mensagens ao cliente, reescritas para
 * converter (relatório do Marketing, secções 3.6, 3.9, 3.11, 3.12, 3.20, 5.1).
 *
 * O #663, com dados inventados: um parceiro isento a 85 € e outro do regime
 * normal a 108 €, taxa do cliente 0 % e da plataforma 10 % (as Configs).
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const proposta = (valor: number) =>
  JSON.stringify([{ por: "profissional", valor, estado: "pendente", criadaEm: "2026-11-22T10:00:00Z" }]);

const negociacao = (id: number, nome: string, valor: number, regime: "isento" | "normal") => ({
  id,
  estado: "aberta",
  profissionalNome: nome,
  propostasJson: proposta(valor),
  taxaCliente: "0",
  taxaProfissional: "0.1000",
  criadaEm: "2026-11-22T09:00:00Z",
  noNovoModelo: true,
  regimeParaOTotal: regime,
});

const O_663 = [negociacao(1, "Transportes Normais Exemplo", 108, "normal"), negociacao(2, "Recolhas Isentas Exemplo", 85, "isento")];

const pedido = (o: Partial<PedidoDoOrcamento> = {}): PedidoDoOrcamento => ({
  id: 662,
  contactName: "Maria Inventada",
  serviceType: "recolha_monos",
  city: "Almada",
  baseDoPreco: "total",
  horasPrevistas: null,
  valorUnicoCliente: null,
  negociacoes: O_663,
  ...o,
});

const AGORA = new Date("2026-11-23T15:00:00Z");

describe("3.9 a mensagem das propostas — o caso do #663", () => {
  it("o isento e o normal, com o total primeiro e a conta à vista", () => {
    const m = mensagemDasPropostas({ propostas: propostasParaOCliente(O_663) });
    expect(m).toContain(
      "Recolhas Isentas Exemplo: 86,96 € no total — parceiro isento de IVA (85,00 € + 1,96 € de IVA da taxa da plataforma)\n",
    );
    expect(m).toContain("Transportes Normais Exemplo: 132,84 € no total (108,00 € + 24,84 € de IVA)\n");
    // Ordenadas pelo total: o isento (86,96 €) primeiro.
    expect(m.indexOf("Recolhas Isentas")).toBeLessThan(m.indexOf("Transportes Normais"));
    // Já não «85,00 € + IVA = 86,96 €», que se lia como 23 % que não estavam lá.
    expect(m).not.toContain("+ IVA =");
  });

  it("o cabeçalho, o pagamento e o fim, como no relatório", () => {
    const t = textoDoOrcamentoDaMesa(pedido(), AGORA);
    const linhas = t.split("\n");
    expect(linhas[0]).toBe("Olá, Maria!");
    expect(linhas[2]).toBe(
      "Já tem 2 propostas para a recolha de monos em Almada. O valor de cada uma é o total a pagar, com o IVA e a taxa da plataforma:",
    );
    expect(t).toContain(NADA_ADIANTADO_PAGA_AO_PARCEIRO);
    expect(t).toContain("Valores dados online, pelo que descreveu — confirmam-se no local antes de começar.");
    expect(t).toContain(DIGA_QUAL_PREFERE);
    expect(t).toContain("(basta o nome)");
    expect(t).toContain("Qualquer dúvida, é só dizer.");
    // A validade de sempre, no fim.
    expect(linhas.at(-1)).toMatch(/^Esta proposta é válida até [a-zç-]+, \d{2}\/\d{2}\.$/);
    // A frase que saiu: o «O valor a pagar é o com IVA.» já não faz falta.
    expect(t).not.toContain("O valor a pagar é o com IVA.");
  });

  it("sem promessa de «quando» se paga: nada adiantado, ao parceiro que contratar", () => {
    const todas = [
      textoDoOrcamentoDaMesa(pedido(), AGORA),
      textoDoOrcamentoDaMesa(pedido({ id: 663 }), AGORA),
      oQuePodeFazer("sexta-feira, 27/11"),
      oQuePodeFazer(null),
      PEDIR_E_GRATIS_NO_EMAIL,
    ];
    for (const t of todas) {
      expect(t, t).not.toMatch(/depois do trabalho feito/);
      expect(t, t).not.toMatch(/\bo parceiro que escolher\b/);
    }
  });

  it("uma proposta só: no singular, e «Diga-nos se quer avançar»", () => {
    const t = textoDoOrcamentoDaMesa(pedido({ negociacoes: [O_663[1]] }), AGORA);
    expect(t).toContain("Já tem uma proposta para a recolha de monos em Almada. O valor é o total a pagar, com o IVA e a taxa da plataforma:");
    expect(t).toContain("Diga-nos se quer avançar e tratamos do resto — quem faz o trabalho é o parceiro escolhido.");
  });

  it("por carga: a unidade no lugar de «no total», e o aviso das cargas", () => {
    const t = textoDoOrcamentoDaMesa(pedido({ baseDoPreco: "carga" }), AGORA);
    expect(t).toContain("Recolhas Isentas Exemplo: 86,96 € por carga — parceiro isento de IVA (85,00 € + 1,96 € de IVA da taxa da plataforma)");
    expect(t).toContain("O valor de cada uma já leva o IVA e a taxa da plataforma:");
    expect(t).toContain(AS_CARGAS_CONFIRMAM_SE_NO_LOCAL);
  });

  it("o modelo antigo e as listas misturadas ficam como estavam", () => {
    const antiga = { ...O_663[0], noNovoModelo: undefined, regimeParaOTotal: undefined, criadaEm: "2026-10-20T09:00:00Z" };
    const so = mensagemDasPropostas({ propostas: propostasParaOCliente([antiga]) });
    expect(so).toContain("+ IVA =");
    expect(so).toContain("O valor a pagar é o com IVA.");
    expect(so).not.toContain("no total");
    const mistura = mensagemDasPropostas({ propostas: propostasParaOCliente([antiga, O_663[1]]) });
    expect(mistura).toContain("Já recebemos 2 propostas");
    expect(varianteDoTexto(mistura)).toBeNull();
  });
});

describe("3.9 as traduções fixas da mensagem das propostas (o envio automático noutra língua continua a sair)", () => {
  it("inglês, francês e espanhol, linha a linha", () => {
    for (const id of [662, 663]) {
      for (const base of ["total", "carga"]) {
        const pt = textoDoOrcamentoDaMesa(pedido({ id, baseDoPreco: base }), AGORA);
        for (const l of ["en", "fr", "es"] as const) expect(traducaoFixa(pt, l), `${id} ${base} ${l}`).not.toBeNull();
      }
    }
    const uma = textoDoOrcamentoDaMesa(pedido({ id: 663, negociacoes: [O_663[1]] }), AGORA);
    for (const l of ["en", "fr", "es"] as const) expect(traducaoFixa(uma, l), l).not.toBeNull();
  });

  it("as linhas do #663, em inglês", () => {
    const en = traducaoFixa(textoDoOrcamentoDaMesa(pedido({ id: 663 }), AGORA), "en")!;
    expect(en).toContain("You have 2 quotes for your request (bulky items removal) in Almada. The price of each one is the total to pay, including VAT and the platform fee:");
    expect(en).toContain("Recolhas Isentas Exemplo: 86,96 € in total - partner exempt from VAT (85,00 € + 1,96 € VAT on the platform fee)");
    expect(en).toContain("Transportes Normais Exemplo: 132,84 € in total (108,00 € + 24,84 € VAT)");
    expect(en).toContain("If you prefer, reply YES and we will book the cheapest one, or the best-rated one up to 10% above it, if there is one.");
    expect(en).toContain("You pay nothing in advance");
    expect(en).not.toMatch(/\b(Olá|propostas|Já tem|no total|válida até)\b/);
  });

  it("em francês e em espanhol, o isento", () => {
    const pt = textoDoOrcamentoDaMesa(pedido(), AGORA);
    expect(traducaoFixa(pt, "fr")).toContain("86,96 € au total - partenaire exonéré de TVA (85,00 € + 1,96 € de TVA sur les frais de plateforme)");
    expect(traducaoFixa(pt, "es")).toContain("86,96 € en total - colaborador exento de IVA (85,00 € + 1,96 € de IVA de la tarifa de la plataforma)");
  });
});

describe("5.1 o A/B pela paridade do n.º do pedido", () => {
  it("par → A, ímpar → B; sem número, A", () => {
    expect(varianteDasPropostas(662)).toBe("A");
    expect(varianteDasPropostas(663)).toBe("B");
    expect(varianteDasPropostas("664")).toBe("A");
    expect(varianteDasPropostas(null)).toBe("A");
  });

  it("B é A com a escolha feita por ele a seguir à lista", () => {
    const a = textoDoOrcamentoDaMesa(pedido({ id: 662 }), AGORA);
    const b = textoDoOrcamentoDaMesa(pedido({ id: 663 }), AGORA);
    expect(a).not.toContain(RESERVAMOS_A_MAIS_EM_CONTA);
    expect(b).toContain(RESERVAMOS_A_MAIS_EM_CONTA);
    expect(RESERVAMOS_A_MAIS_EM_CONTA).toBe(
      "Se preferir, responda SIM e reservamos a mais em conta, ou a mais bem avaliada até 10 % acima, se houver.",
    );
    // Logo depois da lista, antes do pagamento.
    expect(b.indexOf("Transportes Normais")).toBeLessThan(b.indexOf(RESERVAMOS_A_MAIS_EM_CONTA));
    expect(b.indexOf(RESERVAMOS_A_MAIS_EM_CONTA)).toBeLessThan(b.indexOf(NADA_ADIANTADO_PAGA_AO_PARCEIRO));
    // O resto igual.
    expect(b.replace(`${RESERVAMOS_A_MAIS_EM_CONTA}\n\n`, "")).toBe(a);
    // Com uma proposta só, «esta proposta».
    expect(textoDoOrcamentoDaMesa(pedido({ id: 663, negociacoes: [O_663[1]] }), AGORA)).toContain(RESERVAMOS_ESTA_PROPOSTA);
  });

  it("a variante lê-se do texto e fica no histórico do pedido — nos três caminhos", () => {
    expect(varianteDoTexto(textoDoOrcamentoDaMesa(pedido({ id: 662 }), AGORA))).toBe("A");
    expect(varianteDoTexto(textoDoOrcamentoDaMesa(pedido({ id: 663 }), AGORA))).toBe("B");
    expect(notaDaVariante(textoDoOrcamentoDaMesa(pedido({ id: 663 }), AGORA))).toBe(" Mensagem das propostas: variante B (d91).");
    expect(notaDaVariante("Olá! Está combinado com…")).toBe("");
    const rota = ler("src/app/api/admin/negociacoes/route.ts");
    expect(rota).toContain("${resumo}${notaDaVariante(texto)}");
    expect(rota).toContain('notaDaVariante(typeof corpo.texto === "string" ? corpo.texto : null)');
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain(
      'JSON.stringify({ accao: "orcamento_enviado", pedidoId: p.id, texto: textoDoOrcamento(p) })',
    );
    // d114: a Vitória manda a mensagem curta (sem A/B); o histórico diz que foi a mensagem curta (d123: com as que foram nela).
    expect(ler("src/lib/envio-das-propostas-ao-cliente-na-base.ts")).toContain("historicoDoEnvioAutomatico(c.porDizer, actualizacao)");
  });

  it("nenhuma das duas se lê como uma pergunta do formulário (o SIM não vira resposta a outra coisa)", () => {
    for (const id of [662, 663]) expect(passoDaPergunta(textoDoOrcamentoDaMesa(pedido({ id }), AGORA))).toBeNull();
  });
});

describe("3.12 as propostas sem resposta", () => {
  const agora = new Date("2026-11-23T12:00:00Z");
  const doPedido = { id: 663, status: "pendente", serviceType: "recolha_monos", baseDoPreco: "total", propostaEnviadaEm: null, valorUnicoCliente: null };

  it("o isento: «86,96 € no total», e já não «(isento de IVA)»", () => {
    const l = lembreteDasPropostas({ ...doPedido, negociacoes: O_663.map((n) => ({ ...n, verificado: true })) } as never, agora)!;
    expect(l.valorDoCliente).toBe("86,96 € no total");
    const m = mensagemDoLembrete(l);
    expect(m).toBe(
      "Olá! O seu pedido #663 já tem 2 propostas de parceiros verificados, desde 86,96 € no total. Quer que reservemos a mais em conta? " +
        "Responda SIM, ou escolha na ligação do pedido que lhe enviámos. Não paga nada adiantado. " +
        "Se o dia ou o valor não servirem, diga-nos e falamos com os parceiros.",
    );
    expect(m).not.toContain("isento de IVA");
  });

  it("às 72 h, a comparação justa com outras empresas", () => {
    const l = { ...lembreteDasPropostas({ ...doPedido, negociacoes: O_663 } as never, agora)!, fase: "72h" as const };
    expect(mensagemDoLembrete(l)).toBe(
      "Olá! As propostas do pedido #663 continuam válidas. Se está a comparar com outras empresas, compare à vontade: " +
        "o valor de cada proposta já é o total a pagar, e não paga nada adiantado. Para avançar, responda SIM e reservamos a mais em conta. " +
        "Se o preço não serve, diga quanto queria pagar e passamos isso aos parceiros. Se já resolveu de outra forma, diga-nos e fechamos o pedido.",
    );
  });
});

describe("3.11 o email «tem uma proposta» e 3.6 o email «pedido criado»", () => {
  it("com a validade ligada, o dia; desligada, sem a 1.ª frase", () => {
    expect(oQuePodeFazer("sexta-feira, 27/11")).toBe(
      "Esta proposta é válida até sexta-feira, 27/11. Pode aceitá-la, propor outro valor ou esperar por mais propostas — e não paga nada adiantado.",
    );
    expect(oQuePodeFazer(null)).toBe("Pode aceitá-la, propor outro valor ou esperar por mais propostas — e não paga nada adiantado.");
  });

  it("já não diz que a proposta fica de pé sem prazo, e a validade vem do interruptor da d62", () => {
    const email = ler("src/lib/email-proposta.ts");
    expect(email).not.toMatch(/<p[^>]*>\s*A proposta fica de pé/);
    expect(email).toContain("oQuePodeFazer(p.validaAte ?? null)");
    const avisar = ler("src/lib/avisar-da-proposta.ts");
    expect(avisar).toContain("validaAte: await validadeDaPropostaNoEmail(new Date())");
    expect(avisar).toContain("interruptorDaValidade()).ligado");
  });

  it("o email «pedido criado» diz que pedir é grátis e que nada se paga adiantado", () => {
    expect(PEDIR_E_GRATIS_NO_EMAIL).toBe(
      "Pedir é grátis e sem compromisso. Não paga nada adiantado: quando escolher uma proposta, paga diretamente ao parceiro escolhido.",
    );
    expect(ler("src/lib/email-pedido.ts")).toContain("${PROMESSA_DO_PRAZO}\n            ${PEDIR_E_GRATIS_NO_EMAIL}");
  });
});

describe("3.20 a mensagem de contacto do painel, e as cargas «pelo parceiro»", () => {
  it("sem a CLYON a orçar, sem preço, e sem começar por «Aqui é a equipa da CLYON.»", () => {
    const m = mensagemWhatsApp({ id: 663, contactName: "Maria Inventada", serviceType: "recolha_monos", city: "Almada", fotosRecebidas: 0, precoFinal: "160" });
    expect(m).toBe(
      "Olá Maria, é da equipa da CLYON.\n\nRecebemos o seu pedido de recolha de monos (#663), em Almada.\n\n" +
        "Para os parceiros lhe darem um preço certo e sem surpresas no dia, pode enviar-nos por aqui 2 ou 3 fotografias do que é para levar?",
    );
    expect(m.startsWith("Aqui é a equipa da CLYON.")).toBe(false);
  });

  it("o número de cargas confirma-se pelo parceiro, e a tradução fixa diz o mesmo", () => {
    expect(AS_CARGAS_CONFIRMAM_SE_NO_LOCAL).toBe("O número de cargas é confirmado consigo no local, pelo parceiro, antes de começar.");
    expect(traducaoFixa(AS_CARGAS_CONFIRMAM_SE_NO_LOCAL, "en")).toBe("The number of loads is confirmed with you on site, by the partner, before starting.");
  });
});
