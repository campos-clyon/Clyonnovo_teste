import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SECCOES_DA_MESA,
  assistenteComSeccoesPodeChamar,
  normalizarSeccoes,
  seccoesGuardadas,
} from "./papel-do-painel";

/**
 * A MESA E OS TRABALHOS CLYON NUM SÓ — fase 1, 20-10-2026.
 *
 * *«Que seja recebido e criado tudo num lugar só, em que a gente só decide se
 * ele será um trabalho com valor fixo ou de negociação entre os
 * profissionais.»* — o dono. Decidiu também juntar as duas permissões.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const REGISTO = ler("src/components/admin/RegistarPedido.tsx");
const TRABALHOS = ler("src/components/admin/AdminTrabalhosClyonPanel.tsx");
const ASSISTENTES = ler("src/components/admin/AdminAssistentesPanel.tsx");

describe("a permissão da Mesa é uma só", () => {
  it("quem tem uma das duas metades fica com as duas — ao gravar e ao ler", () => {
    expect([...SECCOES_DA_MESA]).toEqual(["negociacoes_clyon", "trabalhos_clyon"]);
    expect(normalizarSeccoes(["negociacoes_clyon"])).toEqual(["negociacoes_clyon", "trabalhos_clyon"]);
    expect(normalizarSeccoes(["agenda", "trabalhos_clyon"])).toEqual(["negociacoes_clyon", "trabalhos_clyon", "agenda"]);
    expect(seccoesGuardadas(JSON.stringify(["trabalhos_clyon"]))).toEqual(["negociacoes_clyon", "trabalhos_clyon"]);
    // Sem nenhuma, não ganha nenhuma.
    expect(normalizarSeccoes(["agenda"])).toEqual(["agenda"]);
  });

  it("e as rotas abrem-se das duas: quem só tinha o valor fixo responde na Mesa", () => {
    const so = seccoesGuardadas(JSON.stringify(["trabalhos_clyon"]));
    expect(assistenteComSeccoesPodeChamar(so, "/api/admin/negociacoes/agir", "POST")).toBe(true);
    const outra = seccoesGuardadas(JSON.stringify(["negociacoes_clyon"]));
    expect(assistenteComSeccoesPodeChamar(outra, "/api/admin/trabalhos-clyon", "PATCH")).toBe(true);
  });

  it("no painel dos Assistentes é uma caixa só, e desmarcá-la tira as duas", () => {
    expect(ASSISTENTES).toContain('SECCOES_DO_ASSISTENTE.filter((s) => s !== "trabalhos_clyon")');
    expect(ASSISTENTES).toContain("{SECCOES_A_ESCOLHER.map((s) => {");
    expect(ASSISTENTES).toContain("? normalizarSeccoes([...valor, s])");
    expect(ASSISTENTES).toContain("!(SECCOES_DA_MESA.includes(s) && SECCOES_DA_MESA.includes(x))");
  });
});

describe("o «Por decidir»", () => {
  it("é o antigo «Por enviar», e diz que tudo entra ali", () => {
    const i = MESA.indexOf('chave: "porEnviar",');
    const bloco = MESA.slice(i, MESA.indexOf("visivelEm", i));
    expect(bloco).toContain('titulo: "Por decidir",');
    expect(bloco).toContain("site, WhatsApp ou registado aqui");
  });

  it("cada linha tem as duas escolhas: «Valor fixo» primeiro, depois a «Negociação» com o seu valor", () => {
    const linha = MESA.slice(MESA.indexOf("function PedidosPorPromover("));
    const fixo = linha.indexOf("          Valor fixo\n");
    const caixa = linha.indexOf('placeholder="conta CLYON"');
    const negociacao = linha.indexOf("        Negociação\n");
    expect(fixo).toBeGreaterThan(-1);
    expect(fixo).toBeLessThan(caixa);
    expect(caixa).toBeLessThan(negociacao);
    expect(linha).not.toContain("          Trabalho CLYON\n");
  });
});

describe("um só registo, que acaba na mesma escolha", () => {
  it("o passo 2 pergunta «Como segue?» quando quem chama dá o valor fixo", () => {
    expect(REGISTO).toContain("escolherValorFixo?: (r: { id: number; alcance: Alcance | null; valorDePartida: number | null }) => ReactNode;");
    expect(REGISTO).toContain("Como segue?");
    expect(REGISTO).toContain('{escolherValorFixo ? "Negociação — enviar aos profissionais" : "Enviar aos profissionais"}');
    expect(REGISTO).toContain('{escolherValorFixo ? "Decidir depois" : "Deixar só no backoffice"}');
  });

  it("a Mesa passa-o, com o formulário de sempre", () => {
    const i = MESA.indexOf("escolherValorFixo={");
    expect(i).toBeGreaterThan(-1);
    const corpo = MESA.slice(i, MESA.indexOf("/>", MESA.indexOf("<FormularioDaOferta", i)));
    expect(corpo).toContain("podeOferecerTrabalhoClyon");
    expect(corpo).toContain("onOferecido={(msg) => void trabalhoClyonOferecido(msg)}");
  });

  it("e os Trabalhos CLYON já não têm registo próprio", () => {
    expect(TRABALHOS).not.toContain("oferta={(r) => (");
    expect(TRABALHOS).toContain("Registe-o na Mesa");
  });
});
