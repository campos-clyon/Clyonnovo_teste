import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AVALIACOES_PARA_A_COROA,
  FICHA_DA_DISTINCAO,
  MEDIA_DA_COROA,
  TRABALHOS_PARA_VETERANO,
  avaliacoesEmPalavras,
  distincoesDe,
  mediaEmPalavras,
  quantasFaltamParaACoroa,
  temCoroa,
  type ContaDoPerfil,
} from "./distincoes-do-profissional";

/**
 * A COROA DE QUEM TEM NOTA MÁXIMA.
 *
 * "Quero que deixe esse perfil mais pro, com coisas legais para eles. Caso
 * tenha nota 5, eles devem ganhar uma coroa no topo do perfil." — 14-09-2026.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const conta = (x: Partial<ContaDoPerfil> = {}): ContaDoPerfil => ({
  media: null,
  quantasAvaliacoes: 0,
  trabalhosConcluidos: 0,
  ...x,
});

describe("quem ganha a coroa", () => {
  it("cinco estrelas em três avaliações", () => {
    expect(temCoroa(conta({ media: 5, quantasAvaliacoes: 3 }))).toBe(true);
    expect(temCoroa(conta({ media: 5, quantasAvaliacoes: 40 }))).toBe(true);
  });

  it("UMA avaliação de cinco NÃO chega", () => {
    /*
     * A decisão que dá valor ao emblema. Um profissional com uma avaliação de
     * cinco tem média 5,0 — dar-lhe a coroa por isso dá-a a quem ainda não fez
     * nada, e tira-a a quem a tem por trinta trabalhos seguidos. No dia em que
     * metade dos profissionais tiver coroa, a coroa deixa de ser vista.
     */
    expect(temCoroa(conta({ media: 5, quantasAvaliacoes: 1 }))).toBe(false);
    expect(temCoroa(conta({ media: 5, quantasAvaliacoes: 2 }))).toBe(false);
    expect(AVALIACOES_PARA_A_COROA).toBe(3);
  });

  it("e PERDE-SE com a primeira nota abaixo de cinco", () => {
    // É isto que a faz valer alguma coisa. 4,9 não é 5,0.
    expect(temCoroa(conta({ media: 4.9, quantasAvaliacoes: 30 }))).toBe(false);
    expect(MEDIA_DA_COROA).toBe(5);
  });

  it("sem avaliações não há coroa nenhuma", () => {
    expect(temCoroa(conta())).toBe(false);
  });
});

describe("o que falta para a coroa", () => {
  it("diz quantas, a quem ainda a pode alcançar", () => {
    expect(quantasFaltamParaACoroa(conta({ media: 5, quantasAvaliacoes: 1 }))).toBe(2);
    expect(quantasFaltamParaACoroa(conta({ media: 5, quantasAvaliacoes: 2 }))).toBe(1);
  });

  it("zero a quem já a tem", () => {
    expect(quantasFaltamParaACoroa(conta({ media: 5, quantasAvaliacoes: 3 }))).toBe(0);
  });

  it("NULL a quem já tem uma nota abaixo de cinco — e não «faltam duas»", () => {
    /*
     * Seria mentira. Com um quatro lá dentro, mais cinco-estrelas nunca
     * devolvem a média a 5,0 — e prometer um objectivo inalcançável é pior do
     * que não prometer nada.
     */
    expect(quantasFaltamParaACoroa(conta({ media: 4.5, quantasAvaliacoes: 2 }))).toBeNull();
  });
});

describe("as outras distinções", () => {
  it("quem começou agora não fica com o perfil vazio", () => {
    expect(distincoesDe(conta())).toContain("estreante");
  });

  it("veterano é sobre quilómetros, não sobre notas", () => {
    const d = distincoesDe(conta({ trabalhosConcluidos: TRABALHOS_PARA_VETERANO }));
    expect(d).toContain("veterano");
    // Mesmo sem avaliação nenhuma: são coisas diferentes.
    expect(distincoesDe(conta({ trabalhosConcluidos: TRABALHOS_PARA_VETERANO - 1 }))).not.toContain(
      "veterano",
    );
  });

  it("a coroa e o «a caminho» não aparecem juntos", () => {
    // São o mesmo caminho em dois pontos.
    const coroado = distincoesDe(conta({ media: 5, quantasAvaliacoes: 5 }));
    expect(coroado).toContain("coroa");
    expect(coroado).not.toContain("caminho_da_coroa");
  });

  it("cada emblema diz COMO se ganha — senão é decoração", () => {
    for (const f of Object.values(FICHA_DA_DISTINCAO)) {
      expect(f.porque.length).toBeGreaterThan(20);
      expect(f.simbolo.length).toBeGreaterThan(0);
    }
  });
});

describe("os números, em palavras", () => {
  it("«5,0» e não «5» — o zero é o que faz a média parecer medida", () => {
    expect(mediaEmPalavras(5)).toBe("5,0");
    expect(mediaEmPalavras(4.75)).toBe("4,8");
    expect(mediaEmPalavras(null)).toBe("—");
  });

  it("singular e plural certos", () => {
    expect(avaliacoesEmPalavras(0)).toBe("sem avaliações");
    expect(avaliacoesEmPalavras(1)).toBe("1 avaliação");
    expect(avaliacoesEmPalavras(7)).toBe("7 avaliações");
  });
});

describe("as ligações", () => {
  const CARTAO = ler("src/app/profissionais/painel/CartaoDoPerfil.tsx");
  const PERFIL = ler("src/app/profissionais/painel/Perfil.tsx");
  const PAINEL = ler("src/app/profissionais/painel/PainelDoProfissional.tsx");

  it("a coroa está no TOPO do perfil, como ele pediu", () => {
    expect(CARTAO).toContain("FICHA_DA_DISTINCAO.coroa.simbolo");
    expect(PERFIL).toContain("<CartaoDoPerfil");
  });

  it("as avaliações passaram para dentro do perfil", () => {
    expect(PERFIL).toContain("dentroDoPerfil");
    // E deixaram de ser uma linha de menu à parte.
    expect(PAINEL).not.toContain('rotulo="Avaliações"');
  });

  it("a fotografia da viatura sobe e grava de uma vez", () => {
    // Uma fotografia pendurada à espera do Guardar é uma fotografia que se
    // perde quando ele fecha o ecrã.
    expect(PERFIL).toContain("/api/profissionais/foto-viatura");
    expect(PERFIL).toContain("function FotoDaViatura");
  });

  it("e só se aceita uma fotografia do NOSSO armazenamento", () => {
    /*
     * Sem isto, o campo era um sítio onde qualquer pessoa punha o URL que
     * quisesse — e o painel passava a carregar imagens de um servidor de outra
     * pessoa, que vê quem as abre e pode trocá-las depois de aprovadas.
     */
    const ROTA = ler("src/app/api/profissionais/perfil/route.ts");
    expect(ROTA).toContain(".public.blob.vercel-storage.com/");
  });
});
