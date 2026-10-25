import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COMO_CHEGA_O_PRECO,
  comAgradecimentoDasImagens,
  disseQueMandouFotografias,
  fotosNoFio,
  mensagemDePedidoRegistado,
  primeiraPerguntaDoServico,
  recolhaNova,
  responderAsImagens,
  responderComCompreensao,
  responderNaRecolha,
  servicoDoTexto,
  type EstadoDaRecolha,
} from "./whatsapp-recolha";
import { DESCRICAO_DAS_FOTOS, pareceQuando, perguntaDirectaPeloPreco, perguntaPeloPreco } from "./leitor-da-recolha";
import { perguntaPelaDisponibilidade, QUEM_FALA, respostaADisponibilidade } from "./voz-da-vitoria";
import { imagensDaRajada, MARCA_DE_FOTOGRAFIA, MARCA_DE_VIDEO } from "./rajada-do-whatsapp";
import { passoDaPergunta } from "./reler-a-conversa";

/**
 * A VITÓRIA VÊ QUE HÁ IMAGENS — 20-10-2026.
 *
 * O dono mandou cinco conversas:
 *
 *   - a Benedita mandou duas fotografias de um sótão cheio, sem uma palavra, e
 *     não teve resposta nenhuma;
 *   - o Celso mandou quatro fotografias de sacos de entulho com «Trazer
 *     cerca de 300 sacos do sexto andar para o contentor… Valor? Quando podem
 *     efectuar o trabalho», e ninguém lhe agradeceu as imagens nem lhe
 *     respondeu ao valor;
 *   - o Horácio escreveu a morada a seguir ao «Boa tarde», antes de dizer o
 *     serviço;
 *   - um cliente mandou um vídeo de cinco segundos e ficou à espera — quem
 *     respondeu foi o dono, à mão, «Obrigado pelas imagens, qual é o
 *     endereço?»;
 *   - a do Paço de Arcos mandou a fotografia dos big bags e a morada, e ouviu
 *     «Em que posso ajudar? Diga-me o que precisa de levar ou fazer».
 *
 * *«No mínimo a gente gostaria que ela soubesse que foram enviadas imagens e
 * agradecesse — "obrigada pelas imagens" — e desse continuidade, para que no
 * final ela não peça novamente as imagens; e caso o cliente já tenha enviado a
 * morada, que não a peça novamente.»* E: *«se o cliente enviou as imagens,
 * elas mostram o que é para recolher — não precisa de estar a descrever item
 * por item.»*
 *
 * Horas das capturas menos uma (ver a memória «esta máquina não está em
 * Lisboa»).
 */

const AGORA = new Date("2026-10-20T12:43:00+01:00");

const CELSO =
  "Bom dia, no seguimento da nossa conversa telefónica do passado sábado, pretendemos o seguinte;\n" +
  "Trazer cerca de 300 sacos do sexto andar para o contentore que está na entrada do prédio,\n" +
  "Valor?\n" +
  "Quando podem efectuar o trabalho\n" +
  "Obrigado, Celso Brandão";

const MORADA_DO_PACO = "Avenida das Tílias 52\nQuinta Nova dos Arcos\n2770-917 Paço de Arcos";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("só imagens, sem uma palavra — a Benedita e o vídeo", () => {
  it("a primeira resposta apresenta-se, agradece as imagens e pergunta só o serviço", () => {
    const r = responderAsImagens(recolhaNova(), AGORA, { jaCumprimentou: false });
    expect(r.resposta).toContain(QUEM_FALA);
    expect(r.resposta).toMatch(/\n\nObrigada pelas imagens! Para registar o pedido, diga-me só que serviço é/);
    expect(r.resposta.indexOf(QUEM_FALA)).toBeLessThan(r.resposta.indexOf("Obrigada pelas imagens"));
    expect(r.resposta).not.toContain("Em que posso ajudar");
    expect(r.estado.passo).toBe("servico");
    expect(r.estado.dados.description).toBe(DESCRICAO_DAS_FOTOS);
    expect(r.estado.dados.fotosDitas).toBe(true);
  });

  it("o vídeo depois do «Olá»: agradece sem se apresentar outra vez", () => {
    const r = responderAsImagens({ passo: "servico", dados: {} }, AGORA, { jaCumprimentou: true });
    expect(r.resposta).toMatch(/^Obrigada pelas imagens! Para registar o pedido, diga-me só que serviço é/);
    expect(r.resposta).not.toContain(QUEM_FALA);
  });

  it("a meio da conversa, agradece e segue para o que faltava", () => {
    const r = responderAsImagens(
      {
        passo: "elevador",
        dados: {
          serviceType: "recolha_moveis",
          contactName: "Benedita",
          address: "Rua da Paz 3",
          postalCode: "1000-100",
          city: "Lisboa",
          floor: "2",
        },
      },
      AGORA,
      { jaCumprimentou: true },
    );
    expect(r.estado.passo).toBe("elevador");
    expect(r.resposta).toMatch(/^Obrigada pelas imagens! .*elevador/);
  });

  it("e até ao fim não pede que conte o que há para levar, nem as imagens outra vez", () => {
    let e: EstadoDaRecolha = responderAsImagens(recolhaNova(), AGORA, { jaCumprimentou: false }).estado;
    const disse: string[] = [];
    for (const t of ["Recolha de móveis", "Benedita Lobato", "Rua da Paz 3, 2º esq, 1000-100 Lisboa", "Não", "Sim", "Para a semana", "Não"]) {
      const r = responderNaRecolha(e, t, AGORA, true, false, { fotos: 2 });
      e = r.estado;
      disse.push(r.resposta);
    }
    expect(e.passo).toBe("confirmar");
    expect(disse.join("\n")).not.toContain("Conte-me o que há para levar");
    const resumo = disse[disse.length - 1];
    expect(resumo).toContain("Descrição: as fotografias que enviou");
    expect(resumo).not.toContain("Descrição: Recolha de móveis");
    const fim = mensagemDePedidoRegistado(460, disseQueMandouFotografias(e.dados), e.dados.contactName);
    expect(fim).not.toContain("Se tiver fotografias");
  });
});

describe("imagens com texto — o Celso", () => {
  const r = responderNaRecolha(recolhaNova(), CELSO, AGORA, false, false, { fotos: 4 });
  const resposta = comAgradecimentoDasImagens(r.resposta);

  it("apresenta-se, agradece as imagens e diz o serviço que percebeu", () => {
    expect(resposta.indexOf(QUEM_FALA)).toBeGreaterThan(-1);
    expect(resposta).toContain("Obrigada pelas imagens! Com todo o gosto! Fica anotado: recolha de entulho.");
    expect(resposta.indexOf(QUEM_FALA)).toBeLessThan(resposta.indexOf("Obrigada pelas imagens"));
  });

  it("responde ao «Valor?» e ao «Quando podem efectuar o trabalho»", () => {
    expect(resposta).toContain(COMO_CHEGA_O_PRECO);
    expect(resposta).toContain(respostaADisponibilidade(false));
  });

  it("não lhe pede o andar que ele disse, nem lê «o passado sábado» como a data", () => {
    expect(r.estado.dados.floor).toBe("6");
    expect(resposta).toContain("Qual é a morada, por favor? Rua e número");
    expect(resposta).not.toContain("Rua, número e andar");
    expect(r.estado.dados.quandoTexto).toBeUndefined();
  });

  it("o «Obrigada» que a resposta já trazia passa a ser o das imagens", () => {
    expect(comAgradecimentoDasImagens("Obrigada, Judite! Qual é a morada?")).toBe(
      "Obrigada pelas imagens, Judite! Qual é a morada?",
    );
    expect(comAgradecimentoDasImagens("Obrigada! E há elevador no prédio?")).toBe(
      "Obrigada pelas imagens! E há elevador no prédio?",
    );
    expect(comAgradecimentoDasImagens("Obrigada. E a carrinha?")).toBe("Obrigada pelas imagens! E a carrinha?");
    expect(comAgradecimentoDasImagens("Obrigada, fica anotado. E o código postal?")).toBe(
      "Obrigada pelas imagens, fica anotado. E o código postal?",
    );
    expect(comAgradecimentoDasImagens("Anotado. Para quando precisa?")).toBe(
      "Obrigada pelas imagens! Anotado. Para quando precisa?",
    );
    // Uma vez só.
    expect(comAgradecimentoDasImagens(resposta)).toBe(resposta);
  });
});

describe("a morada que veio antes do serviço não se volta a pedir", () => {
  it("a do Paço de Arcos, com a fotografia na mesma rajada", () => {
    const r = responderNaRecolha(recolhaNova(), MORADA_DO_PACO, AGORA, false, false, { fotos: 1 });
    expect(r.estado.passo).toBe("servico");
    expect(r.estado.dados.postalCode).toBe("2770-917");
    expect(r.estado.dados.city).toBe("Paço de Arcos");
    expect(r.estado.dados.quandoTexto).toBeUndefined();
    const primeira = primeiraPerguntaDoServico(r.estado.dados, 1, false, AGORA);
    expect(primeira).toMatch(/\n\nObrigada pelas imagens! Fica anotada a morada\. Para registar o pedido, diga-me só que serviço é/);
    const depois = responderNaRecolha(r.estado, "Recolha de entulho", AGORA, true, false, { fotos: 1 });
    expect(["morada", "codigoPostal"]).not.toContain(depois.estado.passo);
    expect(depois.resposta).not.toContain("Qual é a morada");
  });

  it("e em duas rajadas: a fotografia primeiro, a morada a seguir", () => {
    const so = responderAsImagens(recolhaNova(), AGORA, { jaCumprimentou: false });
    const r = responderNaRecolha(so.estado, MORADA_DO_PACO, AGORA, true, false, { fotos: 1 });
    expect(r.resposta).toMatch(/^Obrigada, fica anotada a morada\. Para registar o pedido, diga-me só que serviço é/);
    expect(r.resposta).not.toContain("o que é para levar");
  });

  it("pelo caminho do Gemini, sem se apresentar outra vez — o Horácio", () => {
    const r = responderComCompreensao(
      { passo: "servico", dados: {} },
      { intencao: "informar", campos: { morada: "Estrada da Torre Velha 28, Lumiar, Lisboa" } },
      AGORA,
      { texto: "Estrada da torre velha 28 Lumiar Lisboa\n🙏", jaCumprimentou: true },
    );
    expect(r.resposta).not.toContain(QUEM_FALA);
    expect(r.resposta).not.toContain("Em que posso ajudar");
    expect(r.resposta).toMatch(/^Obrigada, fica anotada a morada\. E o que é para levar ou fazer\?/);
  });

  it("e a quem mandou imagens, pelo Gemini, pergunta-se só o serviço", () => {
    const so = responderAsImagens(recolhaNova(), AGORA, { jaCumprimentou: false });
    const r = responderComCompreensao(
      so.estado,
      {
        intencao: "informar",
        campos: { morada: "Avenida das Tílias 52, Quinta Nova dos Arcos", codigoPostal: "2770-917 Paço de Arcos" },
      },
      AGORA,
      { texto: MORADA_DO_PACO, jaCumprimentou: true, fotos: 1 },
    );
    expect(r.resposta).toMatch(/^Obrigada, fica anotada a morada\. Para registar o pedido, diga-me só que serviço é/);
  });

  it("as perguntas novas reconhecem-se no fio", () => {
    expect(passoDaPergunta("Obrigada pelas imagens! Para registar o pedido, diga-me só que serviço é — recolha…")).toBe("servico");
    expect(passoDaPergunta("Obrigada, fica anotada a morada. E o que é para levar ou fazer? Diga-me à vontade")).toBe("servico");
    expect(passoDaPergunta("Qual é a morada, por favor? Rua e número, e o código postal se o tiver")).toBe("morada");
  });
});

describe("o que parece uma data e não é", () => {
  it("uma quinta com nome, uma rua com data no nome, um dia que já passou", () => {
    expect(pareceQuando(MORADA_DO_PACO)).toBe(false);
    expect(pareceQuando("no seguimento da nossa conversa telefónica do passado sábado")).toBe(false);
    expect(pareceQuando("Rua 25 de Abril 10, Almada")).toBe(false);
    expect(pareceQuando("Moro na Quinta do Conde")).toBe(false);
    expect(pareceQuando("falámos na semana passada")).toBe(false);
  });

  it("e as datas a sério continuam a ler-se", () => {
    for (const t of ["quinta-feira", "na quinta de manhã", "sábado", "no dia 25 de abril", "para a semana", "amanhã"]) {
      expect(pareceQuando(t), t).toBe(true);
    }
  });
});

describe("a leitura que o Celso pediu", () => {
  it("«Valor?» numa linha é a pergunta pelo preço", () => {
    expect(perguntaDirectaPeloPreco("Valor?")).toBe(true);
    expect(perguntaDirectaPeloPreco("E o preço?")).toBe(true);
    expect(perguntaPeloPreco(CELSO)).toBe(true);
    expect(perguntaDirectaPeloPreco("Gostaria de pedir um orçamento à CLYON.")).toBe(false);
  });

  it("«Quando podem efectuar o trabalho» é a pergunta pela disponibilidade", () => {
    expect(perguntaPelaDisponibilidade("Quando podem efectuar o trabalho")).toBe(true);
    expect(perguntaPelaDisponibilidade("quando é que conseguem vir")).toBe(true);
    expect(perguntaPelaDisponibilidade("Quando puder, diga-me")).toBe(false);
  });

  it("sacos para o contentor são entulho; sacos de roupa não", () => {
    expect(servicoDoTexto(CELSO)).toBe("recolha_entulho");
    expect(servicoDoTexto("tenho uns sacos de roupa para doar")).not.toBe("recolha_entulho");
  });
});

describe("a rajada e a ponte trazem as imagens até à Vitória", () => {
  it("as imagens da rajada contam-se desde a nossa última resposta, vídeos incluídos", () => {
    const fio = [
      { id: 1, direccao: "in", texto: MARCA_DE_FOTOGRAFIA },
      { id: 2, direccao: "out", texto: "Obrigada pelas imagens!" },
      { id: 3, direccao: "in", texto: MARCA_DE_FOTOGRAFIA },
      { id: 4, direccao: "in", texto: MARCA_DE_VIDEO },
      { id: 5, direccao: "in", texto: "Rua da Paz 3" },
    ];
    expect(imagensDaRajada(fio)).toBe(2);
    expect(fotosNoFio(fio)).toBe(3);
  });

  it("a ponte manda os vídeos, e as fotografias que não descarrega", () => {
    const PONTE = ler("ponte-whatsapp/index.js");
    const video = PONTE.indexOf('if (msg.type === "video") {');
    expect(video).toBeGreaterThan(-1);
    expect(PONTE.slice(video, PONTE.indexOf("return;", video))).toContain(
      'site("POST", { telefone, midia: "video", texto: legenda })',
    );
    const falhou = PONTE.indexOf("não descarregou — a página do WhatsApp Web mudou");
    expect(PONTE.slice(falhou, PONTE.indexOf("return;", falhou))).toContain(
      'site("POST", { telefone, midia: "foto", texto: legenda })',
    );
  });

  it("a rota responde a toda a imagem, com ou sem legenda, com ou sem bytes", () => {
    const ROTA = semComentarios(ler("src/app/api/whatsapp/ponte/route.ts"));
    expect(ROTA).toContain("await responderARajada(telefone, daLegenda ?? daFoto, texto);");
    expect(ROTA).toContain("await responderARajada(telefone, daLegenda ?? daImagem, texto);");
    // A da fotografia já não está fechada num «se houver legenda».
    expect(ROTA).not.toMatch(/if \(texto\.trim\(\)\) \{\s*const id = await registarMensagemWhatsApp\(telefone, "in", texto\)[^}]*responderARajada/);
    expect(ROTA).toContain('corpo.midia === "video"');
    expect(ROTA).toContain('await tratarMensagemDoCliente(telefone, { tipo: "texto", texto: junto, imagens, visto });');
  });

  it("o cérebro passa as imagens à recolha, e cala-se nos caminhos que só leem palavras", () => {
    const NEG = semComentarios(ler("src/lib/whatsapp-negociacao.ts"));
    expect(NEG).toContain("recolherPedidoPorWhatsApp(telefone, conteudo.texto, conteudo.imagens, conteudo.visto)");
    expect(NEG.match(/if \(soImagens\) return;/g)?.length).toBe(4);
    expect(NEG).toContain(
      "if (!texto.trim()) return responderAsImagens(e, agora, { jaCumprimentou: jaCumprimentouNesteFio(fio), visto });",
    );
    expect(NEG).toContain("resposta: comAgradecimentoDasImagens(r.resposta)");
    expect(NEG).toContain("primeiraPerguntaDoServico(sabido, imagensNovas, !compreensaoDisponivel(), agora)");
  });
});
