import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  explicacaoDoArquivar,
  negociacaoAberta,
  perguntaAntesDeArquivar,
} from "../../app-pro/src/lib/trabalhos";

/**
 * A APP DIZ O MESMO QUE O PAINEL — 20-10-2026.
 *
 * Comparou-se o painel do site com a CLYON Pro, ecrã a ecrã, e a app divergia
 * em três sítios e não sabia arquivar. O dono: «corrige primeiro as
 * divergências e o arquivar». Cada teste lê o painel e a app e exige o mesmo.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\s+/g, " ");
const PAINEL_TRABALHOS = ler("src/app/profissionais/painel/Trabalhos.tsx");
const PAINEL_ARRUMAR = ler("src/app/profissionais/painel/arrumar.ts");

describe("arquivar e repor, como no painel", () => {
  const aberto = { estado: "aberta", confirmadoEm: null, pagoEm: null, arquivadoEm: null } as const;
  const contratado = { estado: "acordada", confirmadoEm: null, pagoEm: null, arquivadoEm: null } as const;
  const pago = { estado: "acordada", confirmadoEm: "2026-10-01T10:00:00Z", pagoEm: "2026-10-02T10:00:00Z", arquivadoEm: null } as const;
  const recusado = { estado: "desistida", confirmadoEm: null, pagoEm: null, arquivadoEm: null } as const;

  it("pergunta antes quando arquivar faz mais do que arrumar, com as palavras do painel", () => {
    const p1 = perguntaAntesDeArquivar(aberto as never)!;
    const p2 = perguntaAntesDeArquivar(contratado as never)!;
    expect(PAINEL_ARRUMAR).toContain(p1);
    expect(PAINEL_ARRUMAR).toContain(p2);
    expect(perguntaAntesDeArquivar({ ...aberto, estado: "aguarda_contratacao" } as never)).toBe(p1);
    // Terminado ou recusado: arquivar só arruma, e não pergunta nada.
    expect(perguntaAntesDeArquivar(pago as never)).toBeNull();
    expect(perguntaAntesDeArquivar(recusado as never)).toBeNull();
  });

  it("o texto por baixo do botão é o do painel, nos três casos", () => {
    for (const t of [aberto, pago, { ...recusado, arquivadoEm: "2026-10-03T10:00:00Z" }]) {
      const { titulo, texto } = explicacaoDoArquivar(t as never);
      expect(PAINEL_TRABALHOS).toContain(titulo);
      expect(PAINEL_TRABALHOS).toContain(texto);
    }
  });

  it("um pedido aberto desiste antes de se esconder — o cliente não fica à espera", () => {
    expect(negociacaoAberta(aberto as never)).toBe(true);
    expect(negociacaoAberta(contratado as never)).toBe(false);
    const ARRUMAR = ler("app-pro/src/componentes/Arrumar.tsx");
    expect(ARRUMAR.indexOf('accao: "desistir"')).toBeGreaterThan(-1);
    expect(ARRUMAR.indexOf('accao: "desistir"')).toBeLessThan(ARRUMAR.indexOf('"/api/profissionais/arquivar"'));
    expect(ler("app-pro/src/app/trabalho/[id].tsx")).toContain("<Arrumar t={t} />");
  });
});

describe("as três divergências corrigidas", () => {
  it("sem «O cliente pede fatura»: a factura é da parceira, como no painel desde 01-10", () => {
    expect(PAINEL_TRABALHOS).toContain("«O CLIENTE PRECISA DE FATURA» SAIU");
    expect(ler("app-pro/src/app/trabalho/[id].tsx")).not.toContain("valor={t.precisaFatura");
  });

  it("confirmado ou pago, o nome, o telefone e a morada do cliente saem", () => {
    expect(PAINEL_TRABALHOS).toContain('pedido.fase !== "confirmado" && pedido.fase !== "pago"');
    const APP = ler("app-pro/src/componentes/TrabalhoContratado.tsx");
    expect(APP).toContain('{t.fase === "a_confirmar" ? <OndeEComQuem t={t} /> : null}');
    // Por fazer continua com tudo (o terreno precisa da morada e do telefone).
    expect(APP).toContain("<OndeEComQuem t={t} noTerreno");
  });

  it("o MB WAY é outra forma de pagarmos, e não «vai sempre para o IBAN»", () => {
    const frase = "Outra forma de lhe pagarmos. Pode ser um número diferente do de contacto.";
    expect(ler("src/app/profissionais/painel/Perfil.tsx")).toContain(frase);
    const APP = ler("app-pro/src/app/conta/banco.tsx");
    expect(APP).toContain(`dica="${frase}"`);
    expect(APP).not.toContain("vão sempre para o IBAN");
  });
});
