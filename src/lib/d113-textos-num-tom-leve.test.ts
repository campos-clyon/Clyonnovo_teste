import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AS_TRES_OPCOES,
  aUltimaSaidaE,
  textoDoFechoAoCliente,
  textoDoLembrete,
  textoDoUltimoAviso,
} from "./validade-do-orcamento";
import {
  AS_OPCOES_DO_SEGUIMENTO,
  eMensagemDoSeguimento,
  textoDaMensagem1,
  textoDaMensagem2,
  textoDaMensagem3,
  textoDoFechoDoSeguimento,
} from "./seguimento-do-cliente";
import { mensagemAutomaticaDoQueFalta, mensagemDoQueFalta } from "./mensagem-do-que-falta";
import { textoDoArquivo, textoDoLembrete1, textoDoLembrete2, textoDoLembrete3 } from "./lembrete-do-que-falta";
import { eEnvioDeModelo, pedidoDoEnvioDeModelo } from "./envio-de-modelo";
import { MENSAGEM_DE_PASSAR_A_UMA_PESSOA } from "./voz-da-vitoria";
import { AVISO_AO_MODELO } from "./vitoria-agente/aviso-ao-modelo";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { MARCA_DE_MAO } from "./rajada-do-whatsapp";

/**
 * d113 — OS TEXTOS FIXOS DA VITÓRIA NUM TOM LEVE, DO DIA A DIA (25-11-2026).
 * Nomes, números e parceiros inventados.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const AGORA = new Date("2026-11-25T10:00:00Z");
const LEMBRETE = { pedidoId: 612, nome: "Rosalinda", servico: "recolha de monos", semIva: 100, total: 123, parceiro: "Recolhas Exemplo", validaAte: "2026-11-27" };
const SEGUIMENTO = { pedidoId: 612, nome: "Rosalinda", servico: "recolha de monos", resposta: "vai_pensar" as const };
const PEDIDO = { id: 812, serviceType: "recolha_monos", city: "Almada" };
const FALTAS = ["fotografias", "andar"] as const;

const todos = (): string[] => {
  const ms: string[] = [];
  for (const id of [612, 613]) {
    for (const unidade of [null, "carga", "hora"] as const) {
      const d = { ...LEMBRETE, pedidoId: id, unidade };
      ms.push(textoDoLembrete(d), textoDoUltimoAviso(d), textoDoLembrete({ ...d, parceiro: null, validaAte: null }));
    }
    for (const resposta of ["vai_pensar", "nao_atendeu", "outra_data"] as const) {
      const d = { ...SEGUIMENTO, pedidoId: id, resposta };
      ms.push(textoDaMensagem1(d), textoDaMensagem2(d), textoDaMensagem3(d));
    }
  }
  ms.push(textoDoFechoAoCliente(612), textoDoFechoDoSeguimento(612), MENSAGEM_DE_PASSAR_A_UMA_PESSOA);
  ms.push(textoDoLembrete1(PEDIDO, [...FALTAS], AGORA), textoDoLembrete2(PEDIDO, [...FALTAS], AGORA), textoDoLembrete3(PEDIDO, [...FALTAS], AGORA), textoDoArquivo(PEDIDO, AGORA));
  return ms;
};

describe("os oito textos, como ficaram", () => {
  it("1. o lembrete da validade: ficou a pensar? o parceiro faz por X com IVA (Y + IVA), sem nada adiantado, vale até", () => {
    expect(textoDoLembrete(LEMBRETE)).toBe(
      // d114: mais curto — o valor, o parceiro, até quando vale e a pergunta.
      "Olá, Rosalinda! Ficou a pensar no seu pedido #612 (recolha de monos)? O parceiro Recolhas Exemplo faz por 123 € com IVA (100 € + IVA). " +
        `Vale até sexta-feira, 27/11. ${AS_TRES_OPCOES}`,
    );
  });

  it("2. o último aviso: não queria que perdesse; se não disser nada até amanhã às 18h, fecha", () => {
    expect(textoDoUltimoAviso(LEMBRETE)).toBe(
      "Olá, Rosalinda! Não queria que perdesse o orçamento do pedido #612 (recolha de monos). O parceiro Recolhas Exemplo faz por 123 € com IVA (100 € + IVA). " +
        `Se não me disser nada até amanhã às 18h, o pedido fecha. ${AS_TRES_OPCOES}`,
    );
  });

  it("3. o fecho: como não tive notícias, fechei; é só responder e volto a abri-lo", () => {
    expect(textoDoFechoAoCliente(612)).toBe("Como não tive notícias, fechei o pedido #612. Se ainda precisar, é só responder e volto a abri-lo.");
  });

  it("4. o «Pedir o que falta» automático é a Vitória; o da equipa fica tal e qual", () => {
    const auto = mensagemAutomaticaDoQueFalta(PEDIDO, [...FALTAS]);
    expect(auto.startsWith("Olá! Aqui é a Vitória, a assistente automática da CLYON.")).toBe(true);
    expect(auto).toContain("Falta pouco para o seu pedido #812 (recolha de monos em Almada) seguir para os parceiros da sua zona. Só preciso de:");
    expect(auto.endsWith("Pode mandar só uma parte. Se preferir falar com uma pessoa, diga.")).toBe(true);
    expect(textoDoLembrete1(PEDIDO, [...FALTAS], AGORA)).toBe(auto);
    // O envio à mão da equipa: o mesmo texto de sempre, e a d86 reconhece os dois.
    const daEquipa = mensagemDoQueFalta(PEDIDO, [...FALTAS], AGORA);
    expect(daEquipa).toContain("Aqui é a equipa da CLYON.");
    expect(daEquipa).toContain("Pode responder a esta mensagem com o que falta.");
    expect(daEquipa.endsWith("Obrigado,\nEquipa CLYON")).toBe(true);
    expect(pedidoDoEnvioDeModelo(`${MARCA_DE_MAO} ${daEquipa}`)).toBe(812);
    expect(pedidoDoEnvioDeModelo(auto)).toBe(812);
    // Uma conversa da equipa com «Pode mandar só uma parte» não é um envio de modelo.
    expect(eEnvioDeModelo(`${MARCA_DE_MAO} Olá! Pode mandar só uma parte do pedido #812.`)).toBe(false);
  });

  it("5. o seguimento, 1.ª: já conseguiu pensar? o valor é o total, sem nada adiantado, extra só com o seu ok", () => {
    expect(textoDaMensagem1(SEGUIMENTO)).toBe(
      // d114: curto — a pergunta e as opções; os pormenores vão na confirmação depois de aceitar.
      "Olá, Rosalinda! Já conseguiu pensar no seu pedido #612 (recolha de monos)? " + AS_OPCOES_DO_SEGUIMENTO,
    );
  });

  it("6. o seguimento, 3.ª: não volto a insistir; se não disser nada, fecha amanhã", () => {
    expect(textoDaMensagem3(SEGUIMENTO)).toBe(
      `Olá, Rosalinda! Sobre o seu pedido #612 (recolha de monos): não volto a insistir. Se não me disser nada, o pedido fecha amanhã. ${AS_OPCOES_DO_SEGUIMENTO}`,
    );
  });

  it("7. passar a uma pessoa: combinado, vou chamar uma pessoa da equipa — com o horário de todo o lado", () => {
    expect(MENSAGEM_DE_PASSAR_A_UMA_PESSOA).toBe("Combinado, vou chamar uma pessoa da equipa, que lhe responde aqui (de segunda a sábado, das 8h às 20h).");
    expect(ler("src/lib/promessas-publicas.ts")).toMatch(/segunda a sábado, das 0?8[h:]0?0? às 20[h:]/);
  });

  it("8. a proposta nova: chegou uma proposta para o serviço certo; serve-lhe, ou prefere propor outro valor?", () => {
    const fonte = ler("src/lib/assistente-automatico.ts");
    expect(fonte).toContain("`${ola} Chegou uma proposta de ${pro} para ${servico}: `");
    expect(fonte).toContain("Serve-lhe, ou prefere propor outro valor${comIvaNaResposta(modelo)}?");
    expect(fonte).toContain("const servico = oSeuServico(p.serviceType);");
    expect(fonte).not.toContain("Acabou de receber uma proposta");
  });
});

describe("as frases que o código lê ficam letra a letra", () => {
  it("«Responda 1 para avançar» (os primeiros 23 caracteres) e o reconhecimento do lembrete", () => {
    expect(AS_TRES_OPCOES.slice(0, 23)).toBe("Responda 1 para avançar");
    for (const id of [612, 613]) {
      expect(aUltimaSaidaE(textoDoLembrete({ ...LEMBRETE, pedidoId: id }), id)).toBe("lembrete");
      expect(aUltimaSaidaE(textoDoUltimoAviso({ ...LEMBRETE, pedidoId: id }), id)).toBe("lembrete");
    }
  });

  it("AS_OPCOES_DO_SEGUIMENTO, letra a letra, e o seguimento reconhece-se", () => {
    expect(AS_OPCOES_DO_SEGUIMENTO).toBe("Responda 1 para escolher o parceiro, 2 se precisar de outra data, ou 3 para cancelar.");
    for (const t of [textoDaMensagem1(SEGUIMENTO), textoDaMensagem2(SEGUIMENTO), textoDaMensagem3(SEGUIMENTO)]) {
      expect(eMensagemDoSeguimento(t, 612)).toBe(true);
    }
  });
});

describe("as regras que não podem falhar", () => {
  it("«parceiro», nunca «profissional»; sem «no próprio dia»; sem «IA» nem «virtual»; no máximo um emoji", () => {
    for (const t of todos()) {
      expect(t).not.toMatch(/profissiona/i);
      expect(t).not.toMatch(/pr[oó]prio dia/i);
      expect(t).not.toMatch(/\bIA\b|virtual|intelig[eê]ncia artificial/i);
      expect((t.match(/\p{Extended_Pictographic}/gu) ?? []).length).toBeLessThanOrEqual(1);
    }
  });

  it("o preço sem IVA nunca aparece sozinho", () => {
    for (const t of todos()) {
      const semIva = t.match(/[\d ,]+ € \+ IVA/g) ?? [];
      const comIva = t.match(/[\d ,]+ € com IVA/g) ?? [];
      expect(comIva.length, t).toBeGreaterThanOrEqual(semIva.length);
    }
  });

  it("o trabalho é do parceiro, nunca da CLYON", () => {
    for (const t of todos()) expect(t).not.toMatch(/\b(levamos|recolhemos|fazemos|carregamos)\b/i);
  });

  it("português de Portugal, sem o do Brasil", () => {
    for (const t of todos()) expect(t).not.toMatch(/\bvocê\b|\bseu time\b|\bcelular\b|\bequipe\b|\bgostaria de te\b|\bestá sendo\b/i);
  });
});

describe("as traduções fixas — sem elas, o cliente estrangeiro não recebe a mensagem", () => {
  it("as frases novas da validade, do seguimento e da passagem a uma pessoa, em inglês, francês e espanhol", () => {
    const ms = todos().filter((t) => !t.includes("Só preciso de:") && !t.includes("continua guardado") && !t.includes("Ainda falta:") && !t.includes("arquivei"));
    for (const l of ["en", "fr", "es"] as const) {
      expect(ms.filter((m) => traducaoFixa(m, l) == null), l).toEqual([]);
    }
    expect(traducaoFixa(textoDoUltimoAviso(LEMBRETE), "fr")).toContain("Je ne voudrais pas que vous perdiez le devis de la demande n° 612");
    expect(traducaoFixa(textoDoFechoAoCliente(612), "es")).toBe(
      "Como no he tenido noticias, he cerrado el pedido n.º 612. Si todavía lo necesita, basta con responder y lo vuelvo a abrir.",
    );
  });
});

describe("o aviso ao modelo", () => {
  it("escreve como uma pessoa simpática ao telemóvel, frases curtas, sem jargão, sem repetir o cliente", () => {
    expect(AVISO_AO_MODELO).toContain("Escreve como uma pessoa simpática a escrever ao telemóvel");
    expect(AVISO_AO_MODELO).toContain("Frases curtas, palavras do dia a dia, uma ideia por frase.");
    expect(AVISO_AO_MODELO).toContain("«taxa da plataforma» só quando for mesmo preciso");
    expect(AVISO_AO_MODELO).toContain("Não repitas o que o cliente acabou de dizer");
    expect(AVISO_AO_MODELO).toContain("No máximo um emoji");
    expect(AVISO_AO_MODELO).toContain("Português de Portugal (nunca o do Brasil)");
  });
});
