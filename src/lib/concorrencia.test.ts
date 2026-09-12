import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONCORRENCIA_CHEIA, concorrenciaDoPedido } from "./concorrencia";
import { MAX_PROPOSTAS_POR_LADO, MAX_PROPOSTAS_POR_EXTENSO } from "./negociacao";

/**
 * A BARRA DA CONCORRÊNCIA, E AS SETE PROPOSTAS.
 *
 * "Onde diz «sem proposta ainda» quero que coloque uma barra que começa verde
 * e, se for preenchida, fica vermelha — vai mudando o tom mediante a
 * quantidade de propostas que o pedido tem: de 0 verde a 7 vermelho.
 * Normalmente os pedidos têm direito a 5 propostas, vamos aumentar para 7; ao
 * fazer isso temos que mudar tudo no site, inclusive nos termos, para as
 * informações serem coerentes." — 12-09-2026.
 *
 * São duas coisas, e a segunda é a que tem dentes: o número estava escrito À
 * MÃO, por extenso, em quatro ecrãs e nos TERMOS. Mudar a constante deixava o
 * site a prometer «cinco propostas» a quem já tinha sete — e os termos são o
 * documento a que se recorre quando há desacordo.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semNotas = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("a barra enche e muda de cor", () => {
  it("zero é verde, e diz que ninguém propôs ainda", () => {
    const c = concorrenciaDoPedido(0);
    expect(c.porCento).toBe(0);
    expect(c.cls).toContain("emerald");
    expect(c.texto).toBe("sem propostas ainda");
  });

  it("cheia é vermelha", () => {
    const c = concorrenciaDoPedido(CONCORRENCIA_CHEIA);
    expect(c.porCento).toBe(100);
    expect(c.cls).toContain("red");
  });

  it("o caminho entre as duas passa por verde, lima, âmbar e laranja", () => {
    /*
     * Degraus e não degradê: um degradê contínuo obrigava a calcular a cor em
     * linha e a fugir da paleta do painel. Quatro degraus lêem-se na mesma
     * como «verde a caminho do vermelho».
     */
    const cores = Array.from({ length: CONCORRENCIA_CHEIA + 1 }, (_, n) =>
      concorrenciaDoPedido(n).cls,
    );
    expect(new Set(cores).size).toBeGreaterThanOrEqual(4);
    // E nunca anda para trás: uma vez âmbar, não volta a verde.
    const ordem = ["emerald", "lime", "amber", "orange", "red"];
    const indices = cores.map((c) => ordem.findIndex((o) => c.includes(o)));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]);
    }
  });

  it("e nunca passa dos cem, por muitas propostas que apareçam", () => {
    // A regra diz sete; a base pode ter oito por uma corrida qualquer, e uma
    // barra a 114% sai do cartão.
    expect(concorrenciaDoPedido(99).porCento).toBe(100);
    expect(concorrenciaDoPedido(-3).porCento).toBe(0);
    expect(concorrenciaDoPedido(Number.NaN).quantas).toBe(0);
  });

  it("o número vai ao lado da cor — uma cor sozinha não informa toda a gente", () => {
    /*
     * Um em cada doze homens não distingue verde de vermelho, e esta barra ia
     * ser a única coisa a dizer-lhe se o trabalho ainda está ao alcance.
     */
    expect(concorrenciaDoPedido(3).texto).toBe(`3 de ${CONCORRENCIA_CHEIA} propostas`);
    expect(concorrenciaDoPedido(CONCORRENCIA_CHEIA).texto).toContain("está cheio");
    const CARTAO = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(CARTAO).toContain("{concorrencia.texto}");
    expect(CARTAO).toContain('aria-label={`Concorrência: ${concorrencia.texto}`}');
  });

  it("a escala é a da regra, e não um número inventado", () => {
    // Duas escalas — uma para a regra e outra para o desenho — voltavam a
    // discordar ao primeiro que mudasse.
    expect(CONCORRENCIA_CHEIA).toBe(MAX_PROPOSTAS_POR_LADO);
  });
});

describe("cinco propostas passaram a sete", () => {
  it("a regra mudou no motor", () => {
    expect(MAX_PROPOSTAS_POR_LADO).toBe(7);
    expect(MAX_PROPOSTAS_POR_EXTENSO).toBe("sete");
  });

  it("e o número por extenso não pode divergir do número", () => {
    /*
     * É esta a lição do dia: o «cinco» estava escrito à mão em quatro ecrãs e
     * nos termos, e mudar a constante não os mudava. Agora a palavra deriva do
     * número e não há sítio nenhum onde os dois possam discordar.
     */
    const NEG = ler("src/lib/negociacao.ts");
    expect(NEG).toContain("POR_EXTENSO[MAX_PROPOSTAS_POR_LADO]");
  });

  it("os TERMOS dizem o mesmo que o motor — e os termos são um contrato", () => {
    const TERMOS = ler("src/app/termos/page.tsx");
    expect(TERMOS).toContain("MAX_PROPOSTAS_POR_EXTENSO");
    expect(semNotas(TERMOS)).not.toContain("cinco propostas");
  });

  it("e os quatro ecrãs que contavam a regra também", () => {
    const ecras = [
      "src/app/pedido/[token]/PropostasRecebidas.tsx",
      "src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx",
      "src/app/plataforma/pedir/components/ValoresEFaturacao.tsx",
    ];
    for (const e of ecras) {
      const t = ler(e);
      expect(t, e).toContain("MAX_PROPOSTAS_POR_EXTENSO");
      expect(semNotas(t), e).not.toContain("cinco propostas");
    }
    // E a mensagem do motor, que é a que o cliente lê quando esgota.
    expect(semNotas(ler("src/lib/negociacao.ts"))).not.toContain("as cinco propostas");
  });
});

describe("a concorrência chega ao cartão", () => {
  it("a consulta conta os OUTROS, e só os vivos", () => {
    /*
     * Um concorrente que desistiu já não é concorrência. E `c.id <> n.id`
     * porque a proposta DELE não é concorrência dele próprio — sem isso, um
     * profissional que respondesse via a barra encher por sua causa.
     */
    const DB = ler("src/lib/db.ts");
    expect(DB).toContain("AS concorrentes");
    expect(DB).toContain("c.pedidoId = n.pedidoId AND c.id <> n.id");
    expect(DB).toContain("c.estado IN ('aberta', 'aguarda_contratacao', 'acordada')");
  });

  it("e a rota manda-a, com zero quando não há", () => {
    const ROTA = ler("src/app/api/profissionais/meus-pedidos/route.ts");
    expect(ROTA).toContain("concorrentes: Number(l.concorrentes ?? 0)");
  });

  it("a barra só aparece onde ele ainda decide", () => {
    // Num trabalho já contratado, quantos concorriam é história.
    const CARTAO = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(CARTAO).toContain(
      'p.estado === "aberta" ? concorrenciaDoPedido(p.concorrentes ?? 0) : null',
    );
  });

  it("e substituiu mesmo o distintivo que lá estava", () => {
    const CARTAO = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(semNotas(CARTAO)).not.toContain('texto: "sem propostas ainda"');
  });
});
