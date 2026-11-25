import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * d118 — O ENTULHO SEM GUIA FECHA, COM O AVISO ANTES (25-11-2026). Nomes e
 * pedidos inventados.
 */

import {
  AVISO_DA_GUIA_NO_ENTULHO,
  jaFoiAvisadoDaGuia,
  lerAPerguntaDaGuia,
  MOTIVO_DA_GUIA,
  perguntaDaGuiaAntesDeFechar,
  precisaDeGuia,
} from "./guia-no-entulho";
import { lerAMensagemCurtaDasPropostas, mensagemCurtaDasPropostas, type PropostaCurta } from "./propostas-curtas";
import { escolhaNaLista, lerAListaDasPropostas, mesmoValorNaLista } from "./a-escolha-e-a-desistencia";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { AVISO_AO_MODELO } from "./vitoria-agente/aviso-ao-modelo";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const DEZ = new Date("2026-11-25T10:00:00Z");
const SEM: PropostaCurta = { negociacaoId: 1, parceiro: "Ecoentulho", semIva: 40, total: 49.2, semGuia: true };
const COM: PropostaCurta = { negociacaoId: 2, parceiro: "Resíduos Inventados", semIva: 60, total: 73.8, comGuia: true };

describe("o aviso — a frase do Jurídico, antes de aceitar", () => {
  it("é a frase final, numa constante", () => {
    expect(AVISO_DA_GUIA_NO_ENTULHO).toBe(
      "Este parceiro compromete-se a entregar o entulho num centro de resíduos autorizado, mas não emite guia de resíduos (e-GAR). Se precisar de guia, por exemplo para uma empresa ou uma obra com licença, diga-me e passo a uma pessoa da equipa.",
    );
    expect(AVISO_DA_GUIA_NO_ENTULHO).not.toMatch(/\bleva\b|seguro|certificad/);
  });

  it("a proposta de entulho sem guia leva a linha; a com guia não", () => {
    const sem = mensagemCurtaDasPropostas({ pedidoId: 9118, servico: "recolha de entulho", propostas: [SEM], agora: DEZ, primeira: true });
    expect(sem).toContain(`do parceiro Ecoentulho. ${AVISO_DA_GUIA_NO_ENTULHO} Quer avançar?`);
    const com = mensagemCurtaDasPropostas({ pedidoId: 9118, servico: "recolha de entulho", propostas: [COM], agora: DEZ, primeira: true });
    expect(com).not.toContain(AVISO_DA_GUIA_NO_ENTULHO);
    expect(com).not.toContain("com guia");
  });

  it("com os dois tipos: a linha junto a cada sem guia, e «com guia» ao lado das que a têm — a numeração continua a da d111", () => {
    const t = mensagemCurtaDasPropostas({ pedidoId: 9118, servico: "recolha de entulho", propostas: [COM, SEM], agora: DEZ, primeira: true });
    expect(t.split("\n")).toEqual([
      "Bom dia! Já tem 2 propostas para o seu pedido #9118 (recolha de entulho):",
      "1) Ecoentulho: 49,20 € (40 € + IVA)",
      AVISO_DA_GUIA_NO_ENTULHO,
      "2) Resíduos Inventados: 73,80 € (60 € + IVA), com guia",
      "Qual prefere? Responda com o número.",
    ]);
    const lista = lerAListaDasPropostas(t)!;
    expect(lista.linhas.map((l) => [l.n, l.parceiro, l.valor])).toEqual([
      [1, "Ecoentulho", "49,20 € (40 € + IVA)"],
      [2, "Resíduos Inventados", "73,80 € (60 € + IVA)"],
    ]);
  });

  it("nas quatro línguas", () => {
    const t = mensagemCurtaDasPropostas({ pedidoId: 9118, servico: "recolha de entulho", propostas: [COM, SEM], agora: DEZ, primeira: true });
    for (const lingua of ["en", "fr", "es"] as const) {
      expect(traducaoFixa(t, lingua), lingua).not.toBeNull();
      expect(traducaoFixa(perguntaDaGuiaAntesDeFechar("Ecoentulho", 9118), lingua), lingua).not.toBeNull();
    }
    expect(traducaoFixa(AVISO_DA_GUIA_NO_ENTULHO, "en")).toContain("e-GAR");
  });
});

describe("o fecho — já não trava; sem o aviso, pergunta primeiro", () => {
  it("o aviso no fio (até 14 dias) deixa fechar; sem ele, não", () => {
    expect(jaFoiAvisadoDaGuia([{ direccao: "out", texto: `Bom dia! ${AVISO_DA_GUIA_NO_ENTULHO}`, haSegundos: 3600 }])).toBe(true);
    expect(jaFoiAvisadoDaGuia([{ direccao: "in", texto: AVISO_DA_GUIA_NO_ENTULHO, haSegundos: 60 }])).toBe(false);
    expect(jaFoiAvisadoDaGuia([{ direccao: "out", texto: AVISO_DA_GUIA_NO_ENTULHO, haSegundos: 20 * 86400 }])).toBe(false);
    expect(jaFoiAvisadoDaGuia([])).toBe(false);
  });

  it("a pergunta antes de fechar diz a linha e o «1» (ou o «sim») fecha-a, pela porta da d111", () => {
    const p = perguntaDaGuiaAntesDeFechar("Ecoentulho", 9118);
    expect(p).toBe(`${AVISO_DA_GUIA_NO_ENTULHO} Quer avançar com o parceiro Ecoentulho no pedido #9118? É só responder 1.`);
    expect(lerAPerguntaDaGuia(p)).toEqual({ pedidoId: 9118, parceiro: "Ecoentulho" });
    const lista = lerAMensagemCurtaDasPropostas(p)!;
    const agente = { n: 1, negociacaoId: 1, pedidoId: 9118, parceiro: "Ecoentulho", comoOClienteVe: "40,00 € + IVA = 49,20 €", base: "total" } as never;
    expect(escolhaNaLista("1", lista.linhas, [agente]).tipo).toBe("escolheu");
    expect(escolhaNaLista("Sim", lista.linhas, [agente]).tipo).toBe("escolheu");
    expect(mesmoValorNaLista(lista.linhas[0].valor, agente)).toBe(true);
    // E o aviso da pergunta conta como dado: o «1» a seguir fecha.
    expect(jaFoiAvisadoDaGuia([{ direccao: "out", texto: p, haSegundos: 60 }])).toBe(true);
  });

  it("o fecho pela Vitória já não passa à equipa por «Guia por verificar»", () => {
    const NEG = ler("src/lib/whatsapp-negociacao.ts");
    const fecho = NEG.slice(NEG.indexOf("async function fecharPeloCliente("), NEG.indexOf("/** Recusar pelo cliente"));
    expect(fecho).not.toContain('"Guia por verificar - quis fechar"');
    const bloco = fecho.slice(fecho.indexOf("if (await guiaImpedeANegociacao(alvo.negociacaoId)) {"));
    expect(bloco.indexOf("g.jaFoiAvisadoDaGuia(fioDaGuia)")).toBeGreaterThan(-1);
    expect(bloco.indexOf("g.perguntaDaGuiaAntesDeFechar(alvo.profissionalNome, alvo.pedidoId)")).toBeGreaterThan(-1);
    // Quem marcou no pedido que precisa de guia passa a uma pessoa.
    expect(bloco).toContain("passarAUmaPessoa(telefone, g.MOTIVO_DA_GUIA, g.PASSO_A_GUIA_A_UMA_PESSOA)");
  });

  it("a verificação da guia no backoffice fica como estava", () => {
    expect(ler("src/app/api/admin/negociacoes/agir/route.ts")).toContain("guiaImpedeANegociacao(negociacaoId)");
    expect(ler("src/app/api/admin/trabalhos-clyon/escolher/route.ts")).toContain("guiaImpedeANegociacao(negociacaoId)");
  });
});

describe("quem precisa de guia passa a uma pessoa", () => {
  it("«preciso de guia», «sou empresa», «é para uma obra com licença», «exijo o comprovativo de entrega»", () => {
    for (const t of [
      "Preciso de guia de resíduos",
      "vocês passam guia?",
      "Precisamos da e-GAR",
      "Sou empresa",
      "É para uma empresa",
      "É uma obra com licença",
      "Exijo o comprovativo de entrega",
      "Preciso de um certificado de entrega dos resíduos",
    ]) {
      expect(precisaDeGuia(t), t).toBe(true);
    }
  });

  it("o «entulho de obras» sozinho, e o resto da conversa, não", () => {
    for (const t of ["É entulho de obras", "São 20 sacos de entulho da obra da casa de banho", "Sim", "1", "Quanto custa?", "Fico com a mais barata"]) {
      expect(precisaDeGuia(t), t).toBe(false);
    }
  });

  it("na conversa: só num pedido de entulho aberto, com o motivo «Precisa de guia de resíduos»", () => {
    expect(MOTIVO_DA_GUIA).toBe("Precisa de guia de resíduos");
    const NEG = ler("src/lib/whatsapp-negociacao.ts");
    const i = NEG.indexOf("if (g.precisaDeGuia(conteudo.texto)) {");
    expect(i).toBeGreaterThan(-1);
    const bloco = NEG.slice(i, i + 700);
    expect(bloco).toContain("await temPedidoDeEntulhoAberto(telefone)");
    expect(ler("src/lib/guia-no-entulho-na-base.ts")).toContain("servicoExigeGuia(p?.serviceType ?? null)");
    expect(bloco).toContain("passarAUmaPessoa(telefone, g.MOTIVO_DA_GUIA, g.PASSO_A_GUIA_A_UMA_PESSOA)");
    // Antes da lista da d111 (o «1» a um pedido de quem precisa de guia não fecha).
    expect(i).toBeLessThan(NEG.indexOf("await d111.responderALista(telefone, conteudo.texto)"));
  });

  it("a conversa livre: a verdade curta, nunca seguro nem certificação, e passa quem precisa", () => {
    expect(AVISO_AO_MODELO).toContain("compromete-se a entregar o entulho num centro de resíduos autorizado e não emite guia de resíduos (e-GAR)");
    expect(AVISO_AO_MODELO).toContain("Nunca prometas seguro nem certificação");
    expect(AVISO_AO_MODELO).toContain("«Precisa de guia de resíduos»");
  });
});
