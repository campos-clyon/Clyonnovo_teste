import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  lerBase,
  baseValida,
  etiquetaDaBase,
  basePorExtenso,
  avisoDaBase,
  BASE_POR_OMISSAO,
} from "./base-do-preco";

/**
 * "150 €" não diz o que mede.
 *
 * "Temos de ter aqui a opção de colocar valor por carga ou valor total. Deixe
 * um botão que mostra para o pro se o orçamento é por carga ou valor total."
 *
 * Numa recolha de entulho, «150 €» tanto pode ser o trabalho inteiro como cada
 * viagem ao aterro — e a diferença entre as duas leituras são três cargas, ou
 * seja 300 € que ninguém combinou. É a discussão mais cara que uma plataforma
 * destas pode ter, porque só aparece no fim: o profissional fez o trabalho a
 * contar com uma coisa, o cliente pagou a contar com outra, e ambos estavam a
 * olhar para o mesmo ecrã.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("a regra", () => {
  it("sem ninguém dizer nada, é pelo trabalho todo", () => {
    /*
     * É o que estava implícito em todos os pedidos que já existem — nenhum
     * deles foi combinado por carga — e é a leitura que não surpreende
     * ninguém: quem lê «150 €» sem mais nada assume que são 150 € e acabou.
     */
    expect(BASE_POR_OMISSAO).toBe("total");
    for (const v of [null, undefined, "", "qualquer coisa", 0, {}]) {
      expect(lerBase(v)).toBe("total");
    }
  });

  it("só aceita as duas palavras, e nada mais", () => {
    expect(baseValida("total")).toBe(true);
    expect(baseValida("carga")).toBe(true);
    for (const v of ["TOTAL", "Carga", "cargas", "hora", null]) {
      expect(baseValida(v)).toBe(false);
    }
  });

  it("o aviso existe SÓ para o preço por carga", () => {
    // Dizer «este valor é pelo trabalho todo» a quem já assumia isso é ruído,
    // e ruído em todos os cartões deixa de se ler.
    expect(avisoDaBase("total")).toBeNull();
    expect(avisoDaBase("carga")).toContain("POR CARGA");
  });

  it("a frase longa diz que há mais do que uma carga", () => {
    // «por carga» sozinho perde a parte que interessa: que o total depende de
    // quantas forem.
    expect(basePorExtenso("carga")).toContain("depende de quantas");
    expect(etiquetaDaBase("carga")).toBe("por carga");
    expect(etiquetaDaBase("total")).toBe("total");
  });
});

describe("o caminho da base do preço, do formulário aos dois ecrãs", () => {
  /*
   * É a sexta vez nesta base que um campo se perde a meio do caminho — andar
   * e elevador, `valorDesejadoCliente`, `baseLat`/`baseLng`, `mbway`,
   * `pedidoCriadoEm` — e o sintoma é sempre o mesmo: alguém preenche uma
   * coisa, a coisa grava-se, e o ecrã do outro lado jura que ela não existe.
   * Nenhum compilador apanha isto, porque cada elo está certo sozinho.
   */
  const DB = ler("src/lib/db.ts");

  it("a coluna existe e tem migração", () => {
    expect(DB).toContain("ADD COLUMN baseDoPreco VARCHAR(10)");
  });

  it("o editor pode gravá-la", () => {
    // A lista de colunas editáveis já deixou cair três campos em silêncio.
    expect(DB).toContain('"baseDoPreco"');
  });

  it("as duas consultas trazem-na", () => {
    // A do profissional e a da mesa do backoffice.
    expect(DB).toContain("o.baseDoPreco,");
    expect(DB).toContain("o.valorDesejadoCliente, o.baseDoPreco,");
  });

  it("as duas rotas do backoffice gravam-na, e passam pela validação", () => {
    for (const p of [
      "src/app/api/admin/pedidos/criar/route.ts",
      "src/app/api/admin/pedidos/[id]/editar/route.ts",
    ]) {
      const ROTA = ler(p);
      expect(ROTA).toContain("baseDoPreco: lerBase(corpo.baseDoPreco)");
      expect(ROTA).toContain('from "@/lib/base-do-preco"');
    }
  });

  it("o formulário tem os dois botões, colados ao campo do valor", () => {
    const FORM = ler("src/components/admin/RegistarPedido.tsx");
    expect(FORM).toContain('(["total", "carga"] as const).map');
    expect(FORM).toContain("Por carga");
    expect(FORM).toContain("Valor total");
    // Quem escreve o número tem de ver, no mesmo gesto, o que está a dizer.
    const i = FORM.indexOf("Valor de partida");
    expect(FORM.slice(i, i + 2000)).toContain("baseDoPreco");
  });

  it("chega ao painel do profissional — rota, tipo e ecrã", () => {
    expect(ler("src/app/api/profissionais/meus-pedidos/route.ts")).toContain("baseDoPreco:");
    expect(ler("src/app/profissionais/painel/tipos.ts")).toContain("baseDoPreco?: string | null;");
    const PAINEL = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(PAINEL).toContain('from "@/lib/base-do-preco"');
    // Na lista e no detalhe: ele decide na lista e propõe no detalhe.
    expect(PAINEL).toContain('lerBase(p.baseDoPreco) === "carga"');
    expect(PAINEL).toContain("avisoDaBase(lerBase(pedido.baseDoPreco))");
  });

  it("chega ao ecrã do cliente", () => {
    const CLIENTE = ler("src/app/pedido/[token]/page.tsx");
    expect(CLIENTE).toContain('from "@/lib/base-do-preco"');
    expect(CLIENTE).toContain("avisoDaBase(base)");
  });
});

describe("«sem IVA» está escrito onde há um número", () => {
  it("no formulário de quem regista o pedido", () => {
    expect(ler("src/components/admin/RegistarPedido.tsx")).toContain("(sem IVA)");
  });

  it("no ecrã do profissional, nos dois sítios com dinheiro", () => {
    const PAINEL = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(PAINEL).toContain("já com a taxa, sem IVA");
    expect(PAINEL).toContain("o valor é sem IVA");
  });

  it("no ecrã do cliente, junto ao valor que ele indicou", () => {
    expect(ler("src/app/pedido/[token]/page.tsx")).toContain("· sem IVA");
  });

  it("na conta que o cliente paga, cada linha diz o que é", () => {
    const PROPOSTAS = ler("src/app/pedido/[token]/PropostasRecebidas.tsx");
    expect(PROPOSTAS).toContain("valor acordado, sem IVA");
    expect(PROPOSTAS).toContain("Total a pagar");
    // O total vem de contaDoCliente, e não de uma soma escrita à mão.
    expect(PROPOSTAS).toContain("contaDoCliente(");
    expect(PROPOSTAS).not.toContain("decomporIva");
  });
});

describe("as fotografias abrem por cima, e não noutro separador", () => {
  it("a mesa usa o visor em vez de um link com target _blank", () => {
    /*
     * "Ao clicar em imagens para abrir não quero que abra uma nova janela."
     *
     * Cada prova aberta deixava um separador do domínio do armazenamento por
     * fechar. O visor já existia — é o mesmo que o profissional usa.
     */
    const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(MESA).toContain('import VisorDeFotos from "@/components/VisorDeFotos"');
    expect(MESA).toContain("<VisorDeFotos");
    // Nenhuma miniatura de prova continua a abrir um separador.
    expect(MESA).not.toContain('href={url} target="_blank"');
  });
});
