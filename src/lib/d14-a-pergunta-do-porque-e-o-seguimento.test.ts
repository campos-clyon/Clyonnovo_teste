import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  diasDoCiclo,
  eMensagemDoSeguimento,
  jaSaiuHojeAoCliente,
  lerRespostaAoSeguimento,
  proximoPassoDoSeguimento,
  textoDaMensagem3,
  type CicloDoSeguimento,
} from "./seguimento-do-cliente";
import { lerOPorque, mensagemDepoisDeCancelar } from "./porque-cancelou";
import { instanteEmLisboa, diaEmLisboa } from "./hora-de-lisboa";

/**
 * d14 (parte I&D, 27-11-2026) — a pergunta do porquê (d126) na 3.ª mensagem do
 * seguimento. Duas garantias verificadas, e uma colisão que decide ONDE a
 * pergunta pode ir. Pedidos e nomes INVENTADOS (o repositório é público).
 *
 *  1. Nunca duas mensagens no mesmo dia: o calendário do ciclo e a regra «uma
 *     por dia ao mesmo contacto» contam passos e datas, nunca o texto; uma
 *     pergunta DENTRO da 3.ª mensagem é a mesma mensagem.
 *  2. O «não contactar» (d93) manda sobre o envio, não sobre o texto: o que
 *     entra na 3.ª mensagem sai pelo mesmo portão e não o contorna.
 *  3. COLISÃO: a 3.ª mensagem já traz «1 escolher o parceiro, 2 outra data, 3
 *     cancelar». As respostas «1», «2» e «3» do porquê (o valor, a data, já
 *     resolvi) leem-se de outra maneira — e a leitura do porquê corre ANTES de
 *     todo o resto na conversa. Duas listas numeradas na mesma mensagem não
 *     se podem responder; por isso a pergunta NÃO entra na 3.ª mensagem (vai na
 *     mensagem do fecho, a do 4.º dia, que não traz opções).
 */

const lisboa = (s: string) => instanteEmLisboa(s)!;
const CICLO: CicloDoSeguimento = { voltarEm: lisboa("2026-12-01T10:00"), canal: "whatsapp" };

describe("d14 — nunca duas mensagens no mesmo dia (o calendário não lê o texto)", () => {
  it("do dia marcado ao fecho, em cada dia de Lisboa sai no máximo um passo, à mesma hora", () => {
    const c: CicloDoSeguimento = { ...CICLO };
    const dias = new Map<string, string[]>();
    // Percorre 8 dias, de hora a hora (o relógio da rotina), a gravar o que sairia.
    for (let h = 0; h < 8 * 24; h++) {
      const agora = new Date(lisboa("2026-12-01T00:00").getTime() + h * 3600_000);
      const passo = proximoPassoDoSeguimento(c, agora);
      if (!passo) continue;
      const dia = diaEmLisboa(agora);
      dias.set(dia, [...(dias.get(dia) ?? []), passo]);
      if (passo === "mensagem1") c.mensagem1Em = agora;
      if (passo === "mensagem2") c.mensagem2Em = agora;
      if (passo === "mensagem3") c.mensagem3Em = agora;
      if (passo === "arquivar") c.arquivadoEm = agora;
    }
    expect([...dias.values()].every((p) => p.length === 1)).toBe(true);
    expect([...dias.values()].flat()).toEqual(["mensagem1", "mensagem2", "mensagem3", "arquivar"]);
    expect(diasDoCiclo(c).mensagem3 < diasDoCiclo(c).fecho).toBe(true);
  });

  it("a regra «uma por dia» conta datas de envio, não textos: o texto da 3.ª não a muda", () => {
    const ontem = lisboa("2026-12-02T10:00");
    const hoje = lisboa("2026-12-03T10:00");
    expect(jaSaiuHojeAoCliente([ontem], hoje)).toBe(false);
    expect(jaSaiuHojeAoCliente([ontem, lisboa("2026-12-03T09:15")], hoje)).toBe(true);
    const f = readFileSync(join(__dirname, "seguimento-do-cliente-na-base.ts"), "utf8").replace(/\r\n/g, "\n");
    // O envio de um passo passa pelo portão da regra, antes de gerar o texto.
    expect(f.indexOf("jaSaiuHojeUmaMensagemAutomatica({ telefone: p.contactPhone")).toBeGreaterThan(0);
    expect(f.indexOf("jaSaiuHojeUmaMensagemAutomatica({ telefone: p.contactPhone")).toBeLessThan(f.indexOf("const texto = textoDoPassoDoSeguimento("));
  });
});

describe("d14 — o «não contactar» manda no envio, não no texto", () => {
  it("o porquê só se pergunta depois de um CANCELAR confirmado: ninguém mais o regista", () => {
    const registam = ["cancelar-pelo-cliente-na-base.ts"];
    for (const f of registam) expect(readFileSync(join(__dirname, f), "utf8")).toContain("registarAPerguntaDoPorque");
    for (const f of ["seguimento-do-cliente-na-base.ts", "seguimento-do-cliente.ts", "lembrete-do-que-falta-na-base.ts"]) {
      expect(readFileSync(join(__dirname, f), "utf8"), f).not.toContain("registarAPerguntaDoPorque");
    }
  });
  it("a mensagem depois de cancelar continua a ser UMA só (o porquê vai lá dentro, sem segunda mensagem)", () => {
    const m = mensagemDepoisDeCancelar([684], { dados: "apagados" });
    expect(m).toContain("1. o valor");
    expect(m).toContain("4. outro motivo");
  });
});

describe("d14 — a colisão que impede a pergunta de ir na 3.ª mensagem", () => {
  it("o «1», o «2» e o «3» têm duas leituras diferentes", () => {
    expect(lerRespostaAoSeguimento("1")).toBe("avancar");
    expect(lerRespostaAoSeguimento("2")).toBe("duvidas");
    expect(lerRespostaAoSeguimento("3")).toBe("cancelar");
    expect(lerOPorque("1")).toBe("valor");
    expect(lerOPorque("2")).toBe("data");
    expect(lerOPorque("3")).toBe("resolvido");
  });
  it("a 3.ª mensagem continua só com as opções do seguimento (nada de segunda lista numerada)", () => {
    const t = textoDaMensagem3({ pedidoId: 684, nome: "Ana Exemplo", servico: "recolha de monos", resposta: "vai_pensar" });
    expect(t).toContain("Responda 1 para escolher o parceiro, 2 se precisar de outra data, ou 3 para cancelar.");
    expect(t).not.toMatch(/1\. o valor|4\. outro motivo|já resolvi/i);
    expect(eMensagemDoSeguimento(t, 684)).toBe(true);
  });
  it("a leitura do porquê corre antes de todo o resto, por isso uma pergunta aberta engoliria o «1» do seguimento", () => {
    const f = readFileSync(join(__dirname, "whatsapp-negociacao.ts"), "utf8").replace(/\r\n/g, "\n");
    const doPorque = f.indexOf("lerARespostaAoPorque(telefone, conteudo.texto");
    const doSeguimento = f.indexOf("lerRespostaAoSeguimento");
    expect(doPorque).toBeGreaterThan(0);
    // Ou o seguimento só se lê depois (ordem), ou nem se lê aqui: em qualquer caso o porquê não vem depois dele.
    if (doSeguimento > 0) expect(doPorque).toBeLessThan(doSeguimento);
  });
});
