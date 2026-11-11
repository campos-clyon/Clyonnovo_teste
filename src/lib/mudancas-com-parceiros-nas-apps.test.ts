import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { congelarTarifa, valorDaMudanca, type TarifaDasMudancas } from "./conta-da-mudanca";
import {
  REGRA_DA_PROPOSTA_ESCOLHIDA,
  TITULO_DA_MUDANCA_ESCOLHIDA,
  mudancaEscolhida,
  problemaDaHoraProposta,
  textoDoPrazo,
} from "./mudanca-escolhida-pelo-cliente";
import { instanteEmLisboa } from "./hora-de-lisboa";
import { PASSOS_DA_MUDANCA_COM_ESCOLHA, passosDaMudancaComEscolha } from "./textos-do-pedido";
import { valorDoCartao, valorNoCartao, type Trabalho } from "../../app-pro/src/lib/trabalhos";
import { valorNoCartao as valorNoCartaoDoPainel } from "../app/profissionais/painel/sinais-do-cartao";

/*
 * AS MUDANÇAS COM A LISTA DE PARCEIROS NAS DUAS APPS — 11-11-2026 (ordem do
 * CEO com o sim do dono). A app de cliente mostra a lista que a rota manda e
 * leva a escolha no pedido; a app Pro e o painel mostram ao parceiro escolhido
 * a equipa, a estimativa, a hora dele congelada e o prazo; a negociação não
 * deixa a hora subir acima da congelada.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
/** Sem os comentários de linha (só os que começam a linha) — ver testes-que-leem-o-codigo-fonte. */
const semComentarios = (s: string) => s.replace(/^\s*\/\/.*$/gm, "");

const TARIFA: TarifaDasMudancas = {
  precoHora2: 50,
  precoHora3: 65,
  minimoHoras: 3,
  precoKm: 0.6,
  kmMinimo: 10,
  kmMaximo: 80,
  caixa: 2,
  cartaoMetro: null,
  filmeRolo: 10,
  plasticoBolhaRolo: 20,
  aparecerNaLista: true,
};
const AGORA = instanteEmLisboa("2026-11-11T10:00") as Date;
const CONGELADA = JSON.stringify(congelarTarifa(TARIFA, undefined, AGORA));

/* ─── O lado do parceiro escolhido ────────────────────────────────────────── */

describe("«O cliente escolheu-o» — o bloco do parceiro escolhido (meus-pedidos)", () => {
  const prazo = instanteEmLisboa("2026-11-11T13:00") as Date;

  it("a hora dele congelada, com o com IVA ao lado, e o que recebe à hora depois da taxa (10 %, de dentro)", () => {
    const m = mudancaEscolhida({ tarifaCongeladaJson: CONGELADA, pessoasEscolhidas: 2, prazoRespostaEm: prazo, horas: 5.5, km: 30, jaRespondeu: false }, AGORA)!;
    expect(m.titulo).toBe(TITULO_DA_MUDANCA_ESCOLHIDA);
    expect(m.titulo).toBe("O cliente escolheu-o");
    expect(m.pessoas).toBe(2);
    expect(m.equipaTexto).toBe("Equipa de 2 pessoas");
    expect(m.hora).toBe(50);
    expect(m.horaTexto).toBe("A sua hora: 50,00 €/h sem IVA (61,50 €/h com IVA)");
    expect(m.recebeHora).toBe(45);
    expect(m.recebeTexto).toBe("Recebe 45,00 €/h depois da taxa da plataforma");
    expect(m.regraDaProposta).toBe(REGRA_DA_PROPOSTA_ESCOLHIDA);
  });

  it("a estimativa é a de valorDaMudanca, com a tarifa congelada (as horas e os km mínimos dele contam)", () => {
    const m = mudancaEscolhida({ tarifaCongeladaJson: CONGELADA, pessoasEscolhidas: 2, prazoRespostaEm: null, horas: 2, km: 4, jaRespondeu: false }, AGORA)!;
    const conta = valorDaMudanca(congelarTarifa(TARIFA, undefined, AGORA), { pessoas: 2, horas: 2, km: 4 });
    if (!conta.ok) throw new Error("conta");
    expect(m.estimativa?.horas).toBe(3); // o mínimo dele
    expect(m.estimativa?.km).toBe(10); // os km mínimos
    expect(conta.semIvaCent).toBe(3 * 5000 + 10 * 60);
    expect(m.estimativa?.texto).toBe("Cerca de 3 h com 2 pessoas e 10 km: 156,00 € sem IVA (191,88 € com IVA), sem o material.");
    expect(m.estimativa?.recebeTexto).toBe(`Fica-lhe cerca de ${(conta.profissionalCent / 100).toFixed(2).replace(".", ",")} €, depois da taxa da plataforma.`);
  });

  it("com 3 pessoas, a hora da equipa de 3", () => {
    const m = mudancaEscolhida({ tarifaCongeladaJson: CONGELADA, pessoasEscolhidas: 3, prazoRespostaEm: null, horas: null, km: null, jaRespondeu: false }, AGORA)!;
    expect(m.hora).toBe(65);
    expect(m.equipaTexto).toBe("Equipa de 3 pessoas");
    expect(m.estimativa).toBeNull(); // sem as horas do pedido, sem estimativa
  });

  it("o prazo: «Responda até HH:mm» no mesmo dia em Lisboa, com o dia noutro, e some depois de ele responder", () => {
    expect(textoDoPrazo(prazo, AGORA)).toEqual({ texto: "Responda até 13:00", passou: false });
    expect(textoDoPrazo(instanteEmLisboa("2026-11-12T10:00") as Date, AGORA).texto).toBe("Responda até 12/11 às 10:00");
    expect(textoDoPrazo(instanteEmLisboa("2026-11-11T09:00") as Date, AGORA)).toEqual({ texto: "O prazo terminou às 09:00. Ainda pode responder, mas o cliente já foi avisado.", passou: true });
    const respondido = mudancaEscolhida({ tarifaCongeladaJson: CONGELADA, pessoasEscolhidas: 2, prazoRespostaEm: prazo, horas: 5, km: 20, jaRespondeu: true }, AGORA)!;
    expect(respondido.prazoTexto).toBeNull();
    expect(respondido.prazoRespostaEm).toBeNull();
  });

  it("numa negociação sem tarifa congelada (ou com lixo), nada", () => {
    expect(mudancaEscolhida({ tarifaCongeladaJson: null, pessoasEscolhidas: null, prazoRespostaEm: null, horas: 5, km: 20, jaRespondeu: false })).toBeNull();
    expect(mudancaEscolhida({ tarifaCongeladaJson: "{lixo", pessoasEscolhidas: 2, prazoRespostaEm: null, horas: 5, km: 20, jaRespondeu: false })).toBeNull();
  });
});

describe("a proposta numa mudança escolhida: à hora, nunca acima da congelada", () => {
  it("igual ou abaixo passa; acima recusa com a hora dele; sem tarifa não se mete", () => {
    expect(problemaDaHoraProposta(CONGELADA, 2, 50)).toBeNull();
    expect(problemaDaHoraProposta(CONGELADA, 2, 42.5)).toBeNull();
    expect(problemaDaHoraProposta(CONGELADA, 2, 50.01)).toMatch(/50,00 € sem IVA/);
    expect(problemaDaHoraProposta(CONGELADA, 3, 65)).toBeNull();
    expect(problemaDaHoraProposta(CONGELADA, 3, 66)).not.toBeNull();
    expect(problemaDaHoraProposta(null, 2, 999)).toBeNull();
  });

  it("as duas portas do profissional (a app/painel e o link) conferem ANTES do motor da negociação", () => {
    for (const f of ["src/app/api/profissionais/negociacao/route.ts", "src/app/api/negociacao/[token]/route.ts"]) {
      const s = semComentarios(ler(f));
      const guarda = s.indexOf("await guardaDaHoraCongelada(");
      const motor = s.indexOf('propor(estadoActual, "profissional"');
      expect(guarda, f).toBeGreaterThan(0);
      expect(guarda, f).toBeLessThan(motor);
      expect(s, f).toContain("() => tarifaCongeladaDaNegociacao(negociacaoId,");
    }
  });

  it("meus-pedidos devolve o bloco, de uma leitura à parte que não derruba a lista", () => {
    const s = semComentarios(ler("src/app/api/profissionais/meus-pedidos/route.ts"));
    expect(s).toContain("mudancaEscolhida: (() => {");
    expect(s).toContain("() => mudancasEscolhidasDoProfissional(sessao.providerId),");
    expect(s).toContain("const escolhidas = await semDerrubar(");
    expect(s).toContain('jaRespondeu: l.estado !== "aberta" || jaRespondeuNaNegociacao(l.propostasJson)');
  });
});

describe("o número do cartão do parceiro escolhido, igual na app Pro e no painel", () => {
  const m = mudancaEscolhida({ tarifaCongeladaJson: CONGELADA, pessoasEscolhidas: 2, prazoRespostaEm: null, horas: 5, km: 20, jaRespondeu: false }, AGORA)!;
  const t = { valorDaClyon: 300, sugestao: null, mudancaEscolhida: m } as unknown as Trabalho;

  it("nos novos, o que recebe à hora — no lugar do valor da CLYON", () => {
    expect(valorNoCartao(t, "novos")).toBe(45);
    expect(valorNoCartaoDoPainel(t as never, "novos")).toBe(45);
    expect(valorNoCartao({ ...t, mudancaEscolhida: null }, "novos")).toBe(300);
    expect(valorNoCartaoDoPainel({ ...t, mudancaEscolhida: null } as never, "novos")).toBe(300);
  });

  it("o cartão da app diz «a sua hora · recebe», à hora", () => {
    const v = valorDoCartao({
      ...(t as object),
      estado: "aberta",
      fase: "a_negociar",
      propostas: "[]",
      valorAcordado: null,
      recebeSeFechado: null,
      recebeSeAceitar: null,
      baseDoPreco: "hora",
      arquivadoEm: null,
      ofertaClyon: null,
    } as unknown as Trabalho);
    expect(v?.valor).toBe(45);
    expect(v?.legenda).toBe("a sua hora · recebe");
    expect(v?.sufixo).toBe("/hora");
  });

  it("o ecrã da app e o painel mostram os textos da API, sem contas próprias", () => {
    const app = ler("app-pro/src/app/trabalho/[id].tsx");
    for (const campo of ["m.titulo", "m.equipaTexto", "m.estimativa.texto", "m.horaTexto", "m.recebeTexto", "m.prazoTexto", "escolhida.regraDaProposta"]) {
      expect(app).toContain(campo);
    }
    const painel = ler("src/app/profissionais/painel/Trabalhos.tsx");
    for (const campo of ["mudancaEscolhida.titulo", "mudancaEscolhida.horaTexto", "mudancaEscolhida.recebeTexto", "mudancaEscolhida.prazoTexto"]) {
      expect(painel).toContain(campo);
    }
  });
});

describe("depois de enviar, os passos dizem a quantos parceiros o pedido foi (site e resposta do pedido)", () => {
  it("«O pedido já seguiu para os N parceiros que escolheu», no simulador e na resposta da rota", () => {
    expect(passosDaMudancaComEscolha(2)[0].titulo).toBe("O pedido já seguiu para os 2 parceiros que escolheu");
    expect(passosDaMudancaComEscolha(1)[0].titulo).toBe("O pedido já seguiu para o parceiro que escolheu");
    expect(passosDaMudancaComEscolha(3).slice(1)).toEqual(PASSOS_DA_MUDANCA_COM_ESCOLHA.slice(1));
    const rota = semComentarios(ler("src/app/api/simulador/pedido/route.ts"));
    expect(rota).toContain("passos: escolhaDaMudanca ? passosDaMudancaComEscolha(escolhaDaMudanca.escolhidos.length) : undefined,");
    expect(ler("src/app/simulador/SimulatorThreePhaseForm.tsx")).toContain("passosDaMudancaComEscolha(foiAosEscolhidos)[0]");
  });
});
