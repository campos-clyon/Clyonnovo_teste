import { describe, it, expect } from "vitest";
import {
  validarAvaliacao,
  mediaDasAvaliacoes,
  MAXIMO_DO_COMENTARIO,
} from "./avaliacao-profissional";

const erros = (r: ReturnType<typeof validarAvaliacao>) =>
  r.ok ? [] : r.erros.map((e) => e.campo);

describe("validarAvaliacao", () => {
  it("aceita de 1 a 5", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(validarAvaliacao({ estrelas: n }).ok).toBe(true);
    }
  });

  it("recusa fora do intervalo e o que não é inteiro", () => {
    for (const n of [0, 6, -1, 3.5, "quatro", null, undefined, NaN]) {
      expect(erros(validarAvaliacao({ estrelas: n }))).toContain("estrelas");
    }
  });

  // Obrigar o comentário faria a maior parte das pessoas não avaliar de todo,
  // e uma nota sem texto continua a valer.
  it("o comentário é opcional", () => {
    const r = validarAvaliacao({ estrelas: 5 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dados.comentario).toBeNull();
  });

  it("corta um comentário demasiado longo em vez de o recusar", () => {
    const r = validarAvaliacao({ estrelas: 4, comentario: "x".repeat(2000) });
    if (r.ok) expect(r.dados.comentario?.length).toBe(MAXIMO_DO_COMENTARIO);
  });

  it("um comentário só de espaços é o mesmo que não haver", () => {
    const r = validarAvaliacao({ estrelas: 4, comentario: "   " });
    if (r.ok) expect(r.dados.comentario).toBeNull();
  });

  it("não rebenta com lixo", () => {
    for (const lixo of [null, undefined, "texto", 42, [], {}]) {
      expect(validarAvaliacao(lixo).ok).toBe(false);
    }
  });
});

describe("mediaDasAvaliacoes", () => {
  it("sem avaliações não há média", () => {
    expect(mediaDasAvaliacoes([])).toEqual({ media: null, quantas: 0 });
  });

  it("arredonda a uma casa", () => {
    expect(mediaDasAvaliacoes([{ estrelas: 5 }, { estrelas: 4 }, { estrelas: 4 }])).toEqual({
      media: 4.3,
      quantas: 3,
    });
  });

  // Uma linha corrompida na base não pode empurrar a média para fora da
  // escala — e uma média de 7,2 estrelas destrói a confiança em todas as
  // outras.
  it("ignora valores impossíveis", () => {
    const r = mediaDasAvaliacoes([
      { estrelas: 5 },
      { estrelas: 99 },
      { estrelas: 0 },
      { estrelas: NaN },
    ]);
    expect(r).toEqual({ media: 5, quantas: 1 });
  });
});
