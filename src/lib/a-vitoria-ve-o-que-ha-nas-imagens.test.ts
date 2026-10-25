import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aplicarOQueSeViu,
  comAgradecimentoDasImagens,
  fotosNoFio,
  recolhaNova,
  responderAsImagens,
  responderComCompreensao,
  responderNaRecolha,
  resumo,
  servicoVistoNasImagens,
  type DadosDaRecolha,
} from "./whatsapp-recolha";
import { DESCRICAO_DAS_FOTOS } from "./leitor-da-recolha";
import { QUEM_FALA } from "./voz-da-vitoria";
import {
  eAUltimaDaRajada,
  eMarcaDeImagem,
  imagensDaRajada,
  oQueSeViuNaFotografia,
  oQueSeViuNaRajada,
  textoDaRajada,
} from "./rajada-do-whatsapp";
import { limparOQueSeVe, verAImagem } from "./whatsapp-imagem";
import { recolhaPeloFio } from "./reler-a-conversa";

/**
 * A VITÓRIA VÊ O QUE HÁ NAS IMAGENS — 21-10-2026.
 *
 * Na véspera aprendeu a agradecê-las. Perguntei ao dono se queria que ela
 * também visse o que mostram — o Gemini consegue, com custo por imagem —, e
 * ele respondeu «Sim, quero».
 *
 * O Gemini diz numa frase o que se vê; a frase fica no fio a seguir à marca
 * («[fotografia] cerca de 30 sacos de entulho numa sala»), vai para a
 * descrição do pedido, e quando o cliente ainda não disse o serviço a
 * Vitória adivinha-o — e diz que adivinhou, para ele corrigir.
 */

const AGORA = new Date("2026-10-21T10:15:00+01:00");
const ENTULHO = "cerca de 30 sacos de entulho numa sala";
const MORADA_DO_PACO = "Avenida das Tílias 52\nQuinta Nova dos Arcos\n2770-917 Paço de Arcos";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("a frase do modelo, limpa", () => {
  it("sem aspas, sem «Na imagem» nem «Vejo», sem ponto final, em minúscula", () => {
    expect(limparOQueSeVe("«Cerca de 30 sacos de entulho numa sala.»")).toBe(ENTULHO);
    expect(limparOQueSeVe("Na imagem, um sofá de três lugares e uma mesa.")).toBe("um sofá de três lugares e uma mesa");
    expect(limparOQueSeVe("Vejo três big bags com terra")).toBe("três big bags com terra");
  });

  it("«(nada)» — uma captura de ecrã, uma pessoa — não é nada para levar", () => {
    expect(limparOQueSeVe("(nada)")).toBeNull();
    expect(limparOQueSeVe("nada.")).toBeNull();
    expect(limparOQueSeVe("")).toBeNull();
  });

  describe("sem chave do Gemini", () => {
    const chave = process.env.GEMINI_API_KEY;
    afterEach(() => {
      if (chave === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = chave;
    });
    it("não se vê nada, e não atira", async () => {
      delete process.env.GEMINI_API_KEY;
      await expect(verAImagem("aGVsbG8=", "image/jpeg")).resolves.toBeNull();
    });
  });
});

describe("a fotografia com o que se viu continua a ser uma fotografia", () => {
  const fio = [
    { id: 1, direccao: "out", texto: "Bom dia! Aqui é a Vitória…" },
    { id: 2, direccao: "in", texto: `[fotografia] ${ENTULHO}` },
    { id: 3, direccao: "in", texto: `[fotografia] ${ENTULHO}` },
    { id: 4, direccao: "in", texto: "[fotografia] um lavatório partido" },
    { id: 5, direccao: "in", texto: "[fotografia]" },
  ];

  it("conta como imagem, e não como palavras dele", () => {
    expect(eMarcaDeImagem(`[fotografia] ${ENTULHO}`)).toBe(true);
    expect(imagensDaRajada(fio)).toBe(4);
    expect(fotosNoFio(fio)).toBe(4);
    expect(textoDaRajada(fio)).toBe("");
    expect(eAUltimaDaRajada(5, fio)).toBe(true);
  });

  it("e o que se viu lê-se, sem repetidos", () => {
    expect(oQueSeViuNaFotografia(`[fotografia] ${ENTULHO}`)).toBe(ENTULHO);
    expect(oQueSeViuNaFotografia("[fotografia]")).toBeNull();
    expect(oQueSeViuNaRajada(fio)).toEqual([ENTULHO, "um lavatório partido"]);
  });
});

describe("o que se viu entra na recolha", () => {
  it("é a descrição — no lugar do «ver as fotografias», ou a seguir ao que ele escreveu", () => {
    const d: DadosDaRecolha = { serviceType: "recolha_entulho", description: DESCRICAO_DAS_FOTOS };
    expect(aplicarOQueSeViu(d, [ENTULHO])).toBeNull();
    expect(d.description).toBe(`Nas imagens: ${ENTULHO}.`);
    const e: DadosDaRecolha = { serviceType: "recolha_entulho", description: "É para tirar do 6.º andar" };
    aplicarOQueSeViu(e, [ENTULHO]);
    aplicarOQueSeViu(e, [ENTULHO]);
    expect(e.description).toBe(`É para tirar do 6.º andar\nNas imagens: ${ENTULHO}.`);
  });

  it("adivinha o serviço quando ainda não se sabe — e só então", () => {
    const d: DadosDaRecolha = {};
    expect(aplicarOQueSeViu(d, [ENTULHO])).toBe("recolha_entulho");
    expect(d.serviceType).toBe("recolha_entulho");
    const m: DadosDaRecolha = { serviceType: "recolha_moveis" };
    expect(aplicarOQueSeViu(m, [ENTULHO])).toBeNull();
    expect(m.serviceType).toBe("recolha_moveis");
    expect(aplicarOQueSeViu({}, ["um terraço com várias coisas encostadas à parede"])).toBeNull();
  });

  it("e diz que adivinhou, para ele corrigir", () => {
    expect(servicoVistoNasImagens("recolha_entulho")).toBe(
      "Pelo que vejo, é recolha de entulho — fica anotado; se for outra coisa, diga-me.",
    );
  });
});

describe("só fotografias, vistas", () => {
  it("apresenta-se, agradece, diz o que viu e segue para o que falta", () => {
    const r = responderAsImagens(recolhaNova(), AGORA, { jaCumprimentou: false, visto: [ENTULHO] });
    expect(r.resposta.indexOf(QUEM_FALA)).toBeGreaterThan(-1);
    expect(r.resposta).toContain(
      "\n\nObrigada pelas imagens! Pelo que vejo, é recolha de entulho — fica anotado; se for outra coisa, diga-me.\n\n",
    );
    expect(r.estado.dados.serviceType).toBe("recolha_entulho");
    expect(r.estado.dados.description).toBe(`Nas imagens: ${ENTULHO}.`);
    expect(r.estado.passo).not.toBe("servico");
    expect(r.estado.passo).not.toBe("descricao");
    expect(r.resposta).not.toContain("Para registar o pedido, diga-me só que serviço é");
  });

  it("sem serviço que se perceba, pergunta-o como ontem — e o que se viu fica na descrição", () => {
    const r = responderAsImagens(recolhaNova(), AGORA, {
      jaCumprimentou: true,
      visto: ["um terraço com várias coisas encostadas à parede"],
    });
    expect(r.resposta).toMatch(/^Obrigada pelas imagens! Para registar o pedido, diga-me só que serviço é/);
    expect(r.estado.dados.description).toBe("Nas imagens: um terraço com várias coisas encostadas à parede.");
  });
});

describe("fotografias vistas com texto", () => {
  it("o Paço de Arcos: a fotografia dos big bags e a morada — já não se pergunta o serviço", () => {
    const r = responderNaRecolha(recolhaNova(), MORADA_DO_PACO, AGORA, false, false, {
      fotos: 1,
      visto: ["três big bags com terra e pedras num jardim"],
    });
    expect(r.estado.dados.serviceType).toBe("recolha_entulho");
    expect(r.estado.dados.postalCode).toBe("2770-917");
    expect(r.estado.passo).not.toBe("servico");
    expect(["morada", "codigoPostal"]).not.toContain(r.estado.passo);
    const resposta = comAgradecimentoDasImagens(r.resposta);
    expect(resposta.indexOf(QUEM_FALA)).toBeLessThan(resposta.indexOf("Obrigada pelas imagens!"));
    expect(resposta).toContain(
      "Obrigada pelas imagens! Pelo que vejo, é recolha de entulho — fica anotado; se for outra coisa, diga-me.",
    );
  });

  it("e pelo caminho do Gemini também", () => {
    const r = responderComCompreensao(
      recolhaNova(),
      {
        intencao: "informar",
        campos: { morada: "Avenida das Tílias 52, Quinta Nova dos Arcos", codigoPostal: "2770-917 Paço de Arcos" },
      },
      AGORA,
      { texto: MORADA_DO_PACO, fotos: 1, visto: ["três big bags com terra e pedras num jardim"] },
    );
    expect(r.estado.dados.serviceType).toBe("recolha_entulho");
    expect(r.resposta).toContain("Pelo que vejo, é recolha de entulho — fica anotado; se for outra coisa, diga-me.");
    expect(r.resposta.indexOf(QUEM_FALA)).toBeGreaterThan(-1);
  });

  it("quando ele diz o serviço, manda o que ele disse — o que se viu fica na descrição", () => {
    const r = responderNaRecolha(recolhaNova(), "Recolha de móveis, por favor", AGORA, false, false, {
      fotos: 1,
      visto: [ENTULHO],
    });
    expect(r.estado.dados.serviceType).toBe("recolha_moveis");
    expect(r.resposta).toContain("Fica anotado: recolha de móveis.");
    expect(r.resposta).not.toContain("Pelo que vejo");
    expect(r.estado.dados.description).toContain(`Nas imagens: ${ENTULHO}.`);
  });

  it("e o resumo devolve-lhe o que se viu", () => {
    const d: DadosDaRecolha = {
      serviceType: "recolha_entulho",
      contactName: "Celso",
      description: `Nas imagens: ${ENTULHO}.`,
      entulhoQuantidade: "30 sacos",
    };
    expect(resumo(d)).toContain(`Descrição: Nas imagens: ${ENTULHO}.`);
  });
});

describe("o «Reler» lê o que se viu", () => {
  it("as fotografias vistas entram na recolha relida, com ou sem texto na mesma rajada", () => {
    const criadoEm = AGORA.toISOString();
    const r = recolhaPeloFio(
      [
        { direccao: "in", texto: `[fotografia] ${ENTULHO}`, criadoEm },
        { direccao: "out", texto: "Obrigada pelas imagens! Pelo que vejo, é recolha de entulho — fica anotado.", criadoEm },
        { direccao: "in", texto: "[fotografia] um lavatório partido", criadoEm },
        { direccao: "in", texto: "Celso", criadoEm },
      ],
      AGORA,
    );
    expect(r.dados.serviceType).toBe("recolha_entulho");
    expect(r.dados.description).toContain(`Nas imagens: ${ENTULHO}.`);
    expect(r.dados.description).toContain("Nas imagens: um lavatório partido.");
  });
});

describe("a rota vê a fotografia, com conta", () => {
  const ROTA = semComentarios(ler("src/app/api/whatsapp/ponte/route.ts"));

  it("ao mesmo tempo que a guarda, e passa o que se viu à Vitória", () => {
    expect(ROTA).toMatch(
      /await Promise\.all\(\[\s*guardarFotoDoClienteNoPedido\(telefone, Buffer\.from\(fotoBase64, "base64"\), fotoMime\),\s*verEAnotarAFotografia\(telefone, daFoto, fotoBase64, fotoMime, pedidos\.length > 0\),\s*\]\)/,
    );
    expect(ROTA).toContain("const visto = agora.length > 0 ? oQueSeViuNaRajada(agora) : [];");
  });

  it("só de quem não tem pedido, com a recolha ligada, e só as primeiras da rajada", () => {
    const i = ROTA.indexOf("async function verEAnotarAFotografia(");
    const corpo = ROTA.slice(i, ROTA.indexOf("\n}", i));
    expect(corpo).toContain("if (id == null || temPedido) return;");
    expect(corpo).toContain('if (!(await assistentePode("recolher"))) return;');
    expect(corpo).toContain("if (imagensDaRajada(fio) > IMAGENS_VISTAS_POR_RAJADA) return;");
    expect(corpo).toContain("if (visto) await anotarOQueSeViuNaFotografiaWhatsApp(id, visto);");
  });

  it("e só escreve por cima de uma marca nua — nunca do que o cliente escreveu", () => {
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function anotarOQueSeViuNaFotografiaWhatsApp(");
    expect(DB.slice(i, i + 800)).toContain("WHERE id = ? AND texto = '[fotografia]'");
  });
});
