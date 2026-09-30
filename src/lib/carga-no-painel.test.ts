import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cargaParaEste, fraseDaCarga } from "./carga-da-carrinha";

/**
 * O QUE UMA CARGA VALE NA CARRINHA DELE, DO SERVIDOR ATÉ AO ECRÃ.
 *
 * "Os profissionais devem responder se a carrinha deles é pequena, média ou
 * grande, e vamos usar essa informação para dizer o valor por carga exclusivo
 * para a conta dele." — 29-09-2026.
 *
 * ESTE FICHEIRO GUARDA A PARTE QUE NÃO SE VÊ NUM ECRÃ: que a conta sai do
 * MESMO número que o cartão mostra grande, e que ela NÃO mexe no valor que ele
 * aceita. As duas coisas que, ao perderem-se, não dão erro nenhum — dão um
 * preço errado em silêncio.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/** O ficheiro sem comentários: um teste não se pode dar por satisfeito com uma nota. */
function semNotas(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const ROTA = semNotas(ler("src/app/api/profissionais/meus-pedidos/route.ts"));
const PAINEL = semNotas(ler("src/app/profissionais/painel/Trabalhos.tsx"));

describe("a frase que ele lê", () => {
  it("a carrinha grande não ganha frase nenhuma — o valor escrito já é o dela", () => {
    /*
     * Uma linha a dizer «na sua carrinha grande: 350 € por carga, 1 carga» em
     * cima do próprio número 350 € é ruído no sítio mais caro do ecrã.
     */
    expect(fraseDaCarga(cargaParaEste(350, "carrinha_grande"))).toBeNull();
    expect(fraseDaCarga(cargaParaEste(350, "camiao"))).toBeNull();
    expect(fraseDaCarga(null)).toBeNull();
  });

  it("a pequena lê os dois números dela, e ambos aparecem na frase", () => {
    const f = fraseDaCarga(cargaParaEste(350, "carrinha_pequena"))!;
    expect(f.titulo).toBe("Na sua carrinha pequena");
    expect(f.texto).toContain("150,00 €");
    expect(f.texto).toContain("2 cargas e meia");
    expect(f.curto).toContain("150,00 €");
    expect(f.curto).toContain("2 cargas e meia");
  });

  it("a média também", () => {
    const f = fraseDaCarga(cargaParaEste(350, "carrinha_media"))!;
    expect(f.titulo).toBe("Na sua carrinha média");
    expect(f.texto).toContain("250,00 €");
    expect(f.texto).toContain("1 carga e meia");
  });

  it("e manda-o combinar as cargas, que é a única coisa que fecha isto", () => {
    /*
     * A conta diz-lhe quantas viagens esperar. Só o cliente é que as confirma —
     * e é entre os dois que o total se fecha, porque a plataforma cobra o valor
     * acordado e não o multiplica por nada.
     */
    const f = fraseDaCarga(cargaParaEste(350, "carrinha_pequena"))!;
    expect(f.texto.toLowerCase()).toContain("combine");
  });
});

describe("de onde sai o número", () => {
  /**
   * A CHAMADA INTEIRA, e não os primeiros 700 caracteres dela.
   *
   * A primeira versão desta guarda procurava `quantoOProfissionalRecebe` numa
   * fatia de tamanho fixo — e PASSOU com o bruto ali metido à mão, porque os
   * outros ramos da mesma expressão chegavam para a satisfazer. Descoberto ao
   * mutar o ficheiro de propósito: a mutação não chumbou nada.
   *
   * Agora a fatia acaba onde a chamada acaba, e o que se procura é o contrário
   * — um ramo que entregue o valor em bruto.
   */
  const chamadaDaCarga = (() => {
    const i = ROTA.indexOf("cargaNaSuaCarrinha:");
    if (i < 0) return null;
    const fim = ROTA.indexOf("\n        ),", i);
    return fim > i ? ROTA.slice(i, fim) : null;
  })();

  it("sai do LÍQUIDO, o mesmo que o cartão mostra grande", () => {
    /*
     * O cartão mostra sempre o líquido dele. Uma conta feita sobre o bruto
     * punha «150,00 € por carga» ao lado de um «332,50 €» — dois números na
     * mesma linha com uma proporção que não bate, que é a maneira mais rápida
     * de ele deixar de acreditar nos dois.
     */
    expect(chamadaDaCarga, "cargaNaSuaCarrinha desapareceu da rota").not.toBeNull();
    /*
     * Nenhum ramo entrega o valor em bruto. `acordado != null` e
     * `minimo != null` são as CONDIÇÕES e ficam de fora pelo lookahead — o que
     * se proíbe é `? acordado` ou `: minimo`, que é a forma exacta que a
     * mutação tomou.
     */
    expect(chamadaDaCarga!, "um ramo entrega o valor em bruto").not.toMatch(
      /[?:]\s*(acordado|minimo)\b(?!\s*!=)/,
    );
    expect(chamadaDaCarga!).not.toMatch(/[?:]\s*Number\(l\.valorDesejadoCliente\)/);
    expect(chamadaDaCarga!).toContain("quantoOProfissionalRecebe");
  });

  it("e da carrinha que ele declarou, lida uma vez para a lista inteira", () => {
    expect(ROTA).toMatch(/carrinhaDele\s*=\s*perfil\?\.tipoVeiculo/);
    expect(ROTA).toMatch(/cargaParaEste\(\s*valorEscrito\s*,\s*carrinhaDele\s*\)/);
  });

  it("e só quando o pedido é por carga", () => {
    const i = ROTA.indexOf("const cargaSegura");
    expect(i).toBeGreaterThan(-1);
    expect(ROTA.slice(i, i + 300)).toMatch(/lerBase\([^)]*\)\s*!==\s*"carga"/);
  });
});

describe("e o que ela NÃO faz", () => {
  it("não mexe no valor que ele aceita", () => {
    /*
     * A PARTE MAIS IMPORTANTE DESTE FICHEIRO.
     *
     * Nenhum sítio do sistema multiplica o valor pelo número de cargas: o
     * `baseDoPreco: "carga"` é uma etiqueta, e a plataforma cobra o
     * `valorAcordado` tal e qual. Se a conta da carrinha entrasse no
     * `querPagar` ou no `recebeSeAceitar`, um profissional de carrinha pequena
     * aceitava 150 € e fazia duas viagens e meia por 150 € — exactamente o
     * contrário do que isto serve para evitar.
     *
     * Para o ajustado passar a ser o valor acordado, o número de cargas tem de
     * viajar COM o acordo: coluna na negociação, mesa, página do cliente e
     * factura. É uma decisão do dono, e até ela ser tomada esta linha tem de
     * chumbar quem a tentar por dedução.
     */
    const i = ROTA.indexOf("querPagar:");
    expect(i).toBeGreaterThan(-1);
    const dinheiro = ROTA.slice(i, ROTA.indexOf("taxas: taxasDela"));
    expect(dinheiro.length).toBeGreaterThan(50);
    expect(dinheiro, "querPagar/recebeSeAceitar deixaram de ser intocados").not.toMatch(/carga/i);
  });

  it("e a plataforma continua a não multiplicar cargas em sítio nenhum", () => {
    /*
     * A premissa de que tudo isto depende. No dia em que alguém escrever a
     * multiplicação, é este teste que obriga a rever a decisão acima em vez de
     * a deixar ficar por esquecimento.
     */
    const pagamentos = semNotas(ler("src/lib/pagamento-na-plataforma.ts"));
    expect(pagamentos).not.toMatch(/\*\s*cargas|cargas\s*\*/);
  });
});

describe("e onde ele a lê", () => {
  it("no cartão, colado ao «por carga» — a versão curta", () => {
    expect(PAINEL).toContain("p.cargaNaSuaCarrinha.curto");
  });

  it("e no detalhe, por extenso, logo depois do aviso de combinar as cargas", () => {
    /*
     * A ORDEM É A DA DECISÃO: o aviso diz-lhe para combinar um número, e o
     * bloco diz-lhe qual é. Separados, o aviso era um conselho sem resposta.
     */
    const avisoEm = PAINEL.indexOf("avisoDaBase(lerBase(pedido.baseDoPreco))");
    const blocoEm = PAINEL.indexOf("pedido.cargaNaSuaCarrinha.texto");
    expect(avisoEm).toBeGreaterThan(-1);
    expect(blocoEm).toBeGreaterThan(avisoEm);
  });

  it("e também pelo link do email, que é onde ele vê o pedido primeiro", () => {
    /*
     * "O link do email e o painel são a mesma negociação e têm de dizer o mesmo
     * número" — a regra que já estava escrita na própria página, para a
     * sugestão. Vale igual para isto: ter a conta só no painel era tê-la depois
     * da decisão, porque é do email que ele abre um pedido novo.
     */
    const pagina = semNotas(ler("src/app/profissionais/pedidos/[token]/page.tsx"));
    expect(pagina).toContain("fraseDaCarga");
    expect(pagina).toMatch(/carrinhaDele\s*=\s*profissional\?\.tipoVeiculo/);
    /* E também sobre o líquido — nunca sobre o bruto. */
    const i = pagina.indexOf("fraseDaCarga(cargaParaEste(");
    expect(i).toBeGreaterThan(-1);
    expect(pagina.slice(Math.max(0, i - 600), i)).toContain("quantoOProfissionalRecebe");
  });

  it("e o perfil deixa-o escolher a carrinha, da lista canónica", () => {
    const perfil = semNotas(ler("src/app/profissionais/painel/Perfil.tsx"));
    expect(perfil).toContain("TIPOS_DE_VEICULO.map");
    expect(perfil, "a escolha não ia no Guardar").toMatch(/gravar\(\{[\s\S]{0,400}tipoVeiculo/);
  });
});
