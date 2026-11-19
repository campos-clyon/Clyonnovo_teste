import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { faixaDoValorAPassar, linhaDoValorAPassar, PAGAR_A_CLYON } from "./como-recebe-no-novo-modelo";
import { PAGAR_O_VALOR_EM_ATRASO } from "./valor-em-atraso";

/*
 * d6 (CEO e dono, 19-11-2026): a faixa do Início do que o parceiro tem a passar
 * à CLYON vem já escrita do servidor (`novoModelo.faixa` da carteira), e o
 * painel e a app CLYON Pro desenham a mesma. Com 1 trabalho, a linha do
 * servidor; com vários, «X € de N trabalhos · o primeiro prazo é dd/mm».
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

// 19-11-2026, 12h em Lisboa (UTC no Inverno).
const AGORA = new Date("2026-11-19T12:00:00Z");
const valor = (total: number, prazoAte: string | null) => {
  const l = linhaDoValorAPassar({ total, prazoAte: prazoAte ? new Date(prazoAte) : null, paga: false }, AGORA);
  return { total, prazoAte, estado: l.estado, linha: l.linha, comReserva: false };
};

describe("d6) a faixa do valor a passar à CLYON", () => {
  it("sem nada a passar não há faixa", () => {
    expect(faixaDoValorAPassar([], AGORA)).toBeNull();
    expect(faixaDoValorAPassar([{ total: 0, prazoAte: null }], AGORA)).toBeNull();
  });

  it("1 trabalho: o título é a linha do servidor, e o dia num só formato", () => {
    const v = valor(12.3, "2026-11-22T23:00:00Z");
    const f = faixaDoValorAPassar([v], AGORA)!;
    expect(f.titulo).toBe(v.linha);
    expect(f.titulo).toBe("A passar à CLYON · 12,30 € até 22/11");
    expect(f.texto).toBe(
      "A taxa da plataforma e o IVA dela de 1 trabalho: pague até 22/11. Depois do prazo, não pode aceitar nem enviar propostas até pagar.",
    );
    expect(f.botao).toBe(PAGAR_A_CLYON);
    expect(f).toMatchObject({ estado: "a_passar", total: 12.3, emAtraso: 0, trabalhos: 1 });
  });

  it("2 trabalhos no prazo: «X € de 2 trabalhos · o primeiro prazo é dd/mm» — sem «pague tudo até»", () => {
    const f = faixaDoValorAPassar([valor(12.3, "2026-11-23T10:00:00Z"), valor(12.3, "2026-11-21T10:00:00Z")], AGORA)!;
    expect(f.titulo).toBe("24,60 € de 2 trabalhos · o primeiro prazo é 21/11");
    expect(f.texto).toContain("Cada trabalho tem o seu prazo: 4 dias depois de ficar confirmado.");
    expect(f.texto).not.toMatch(/pague até/);
    expect(f.texto).not.toMatch(/em atraso/i);
    expect(f.botao).toBe(PAGAR_A_CLYON);
    expect(f).toMatchObject({ estado: "a_passar", total: 24.6, emAtraso: 0, trabalhos: 2, primeiroPrazo: "2026-11-21T10:00:00Z" });
  });

  it("2 trabalhos, 1 em atraso: o que está em atraso diz-se à parte, e não soma o que está no prazo", () => {
    const f = faixaDoValorAPassar([valor(10, "2026-11-18T10:00:00Z"), valor(14.6, "2026-11-22T10:00:00Z")], AGORA)!;
    expect(f.estado).toBe("em_atraso");
    expect(f.titulo).toBe("24,60 € de 2 trabalhos · o primeiro prazo é 18/11");
    expect(f.texto).toContain("Em atraso: 10,00 € (1 trabalho); o resto ainda está no prazo.");
    expect(f.botao).toBe(PAGAR_O_VALOR_EM_ATRASO);
    expect(f.emAtraso).toBe(10);
  });

  it("1 trabalho em atraso: a linha «Em atraso» do servidor e o botão do atraso", () => {
    const f = faixaDoValorAPassar([valor(10, "2026-11-18T10:00:00Z")], AGORA)!;
    expect(f.titulo).toBe("Em atraso · 10,00 € · o prazo era 18/11");
    expect(f.botao).toBe(PAGAR_O_VALOR_EM_ATRASO);
  });

  it("um valor sem o estado (site antigo na lista) decide-se pelo prazo", () => {
    const f = faixaDoValorAPassar([{ total: 10, prazoAte: "2026-11-18T10:00:00Z" }], AGORA)!;
    expect(f.estado).toBe("em_atraso");
  });

  it("a rota da carteira manda-a em `novoModelo.faixa` (nula em stand-by), e o painel desenha-a tal como vem", () => {
    const rota = semComentarios(ler("src/app/api/profissionais/carteira/route.ts"));
    expect(rota).toContain("faixa: s.emStandBy ? null : faixaDoValorAPassar(valores, agoraDoNovoModelo),");
    const painel = semComentarios(ler("src/app/profissionais/painel/PainelDoProfissional.tsx"));
    expect(painel).toContain("{carteira.novoModelo.faixa.titulo}");
    expect(painel).toContain("{carteira.novoModelo.faixa.texto}");
    expect(painel).toContain("{carteira.novoModelo.faixa.botao}");
  });
});
