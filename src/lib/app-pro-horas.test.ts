import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { estimativaAoLado, horasPorMarcar, sufixoDoValor, valorDoCartao, type Trabalho } from "../../app-pro/src/lib/trabalhos";
import { escolhaInicial, faltaResponderAosMateriais, materiaisParaEnviar } from "../../app-pro/src/lib/materiais";

/**
 * AS HORAS NA APP PRO — 31-10-2026 (ordem do CEO com o sim do dono). Num
 * pedido por hora, cada valor leva «/hora» e o total estimado ao lado; a
 * proposta de uma mudança diz se os materiais vão incluídos; as horas marcam-se
 * pela rota do site; e o «Está feito» espera por elas.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const DETALHE = ler("app-pro/src/app/trabalho/[id].tsx");
const LISTA = ler("app-pro/src/app/(app)/index.tsx");
const CONTRATADO = ler("app-pro/src/componentes/TrabalhoContratado.tsx");
const HORAS = ler("app-pro/src/componentes/HorasDoTrabalho.tsx");

const porHora = (mais: Partial<Trabalho> = {}) =>
  ({
    estado: "aberta",
    fase: "a_negociar",
    baseDoPreco: "hora",
    horasPrevistas: 4,
    valorDaClyon: 42.38,
    sugestao: null,
    recebeSeFechado: null,
    recebeSeAceitar: null,
    propostas: "[]",
    ...mais,
  }) as unknown as Trabalho;

describe("por hora: a unidade colada ao número e o total estimado ao lado", () => {
  it("sufixo e estimativa", () => {
    expect(sufixoDoValor(porHora())).toBe("/hora");
    expect(sufixoDoValor({ baseDoPreco: "carga" })).toBe("/carga");
    expect(sufixoDoValor({ baseDoPreco: "total" })).toBe("");
    expect(estimativaAoLado(porHora(), 42.38)).toBe("≈ 169,52 € em 4 h");
    expect(estimativaAoLado({ baseDoPreco: "total" }, 100)).toBeNull();
    // Nunca menos de 3 horas.
    expect(estimativaAoLado(porHora({ horasPrevistas: 1 }), 10)).toBe("≈ 30,00 € em 3 h");
  });

  it("depois de as horas confirmadas, o fechado é o total delas (sem unidade)", () => {
    const confirmado = porHora({ estado: "acordada", porHora: { confirmadas: true } as Trabalho["porHora"] });
    expect(sufixoDoValor(confirmado, true)).toBe("");
    expect(sufixoDoValor(porHora({ estado: "acordada" }), true)).toBe("/hora");
  });

  it("o cartão da lista leva o sufixo e a estimativa", () => {
    const v = valorDoCartao(porHora({ criadaEm: new Date().toISOString() } as Partial<Trabalho>));
    if (v) {
      expect(v.sufixo).toBe("/hora");
      expect(v.estimativa).toContain("em 4 h");
    }
    expect(LISTA).toContain("valor?.sufixo");
    expect(LISTA).toContain("valor.estimativa");
  });

  it("o detalhe usa o sufixo e a estimativa em todos os valores", () => {
    expect(DETALHE).toContain("sufixoDoValor(t)");
    expect(DETALHE).toContain("estimativaAoLado(t, t.valorDaClyon)");
    expect(DETALHE).toContain("estimativaAoLado(t, s.recebeSePropuser)");
    expect(DETALHE).toContain('"Valor por hora, sem IVA"');
    expect(DETALHE).toContain("{v} €{u}");
  });
});

describe("os materiais na proposta", () => {
  it("vão no POST da proposta, a propor e a aceitar", () => {
    expect(DETALHE).toContain(
      'materiais: p.accao === "propor" || p.accao === "aceitar" ? materiaisParaEnviar(materiais) : undefined',
    );
    expect(DETALHE).toContain("<MateriaisDaProposta escolha={materiais}");
  });

  it("incluídos, à parte com os preços da tabela, ou por responder", () => {
    const e = escolhaInicial(null);
    expect(materiaisParaEnviar(e)).toBeUndefined();
    expect(faltaResponderAosMateriais("mudanca", e)).toBe(true);
    expect(faltaResponderAosMateriais("recolha_monos", e)).toBe(false);
    expect(materiaisParaEnviar({ ...e, incluidos: true })).toEqual({ incluidos: true });
    const aParte = materiaisParaEnviar({ ...e, incluidos: false, outros: [{ nome: "Mantas", preco: "5", unidade: "unidade" }] });
    expect(aParte && !aParte.incluidos && aParte.itens.map((i) => i.id)).toEqual(["caixa", "cartao_canelado", "filme", "outro-1"]);
  });
});

describe("as horas do trabalho", () => {
  it("marcam-se pela rota do site, com dois campos editáveis e o OK", () => {
    expect(HORAS).toContain('pedir<{ ok: boolean; mensagem?: string | null }>("/api/profissionais/trabalho/horas"');
    expect(HORAS).toContain("HORA_DE_INICIO");
    expect(HORAS).toContain("HORA_DE_FIM");
    expect(HORAS).toContain("agoraNoCampo()");
    expect(HORAS).toContain("GRAVAR_AS_HORAS");
    // Sem cronómetro: nada a contar sozinho.
    expect(HORAS).not.toMatch(/setInterval|setTimeout/);
  });

  it("o «Está feito» depende de podeDarPorFeito", () => {
    expect(horasPorMarcar({ baseDoPreco: "hora", porHora: { podeDarPorFeito: false } as Trabalho["porHora"] })).toBe(true);
    expect(horasPorMarcar({ baseDoPreco: "hora", porHora: { podeDarPorFeito: true } as Trabalho["porHora"] })).toBe(false);
    expect(horasPorMarcar({ baseDoPreco: "total", porHora: null })).toBe(false);
    expect(CONTRATADO).toContain("concluirVisivel(t) && horasPorMarcar(t) ? (");
    expect(CONTRATADO).toContain("MARQUE_AS_HORAS_PRIMEIRO");
  });
});
