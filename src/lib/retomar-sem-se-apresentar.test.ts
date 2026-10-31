import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mensagemDaReleitura, recolhaPeloFio } from "./reler-a-conversa";
import { perguntaParaContinuar, resumo, type DadosDaRecolha } from "./whatsapp-recolha";
import { DESCRICAO_DAS_FOTOS } from "./leitor-da-recolha";
import { QUEM_FALA } from "./voz-da-vitoria";
import { servicoEmPalavras } from "./servico-em-palavras";

/**
 * RETOMAR SEM SE APRESENTAR OUTRA VEZ — 23-10-2026.
 *
 * A Ofélia escreveu «Bom dia», a Vitória apresentou-se e perguntou o que era;
 * ela respondeu «Envio as fotos e um vídeo», mandou-os, e a conversa parou. O
 * dono carregou em «Reler e continuar», e a mensagem que ia sair era:
 *
 *   «Vamos continuar de onde ficámos.
 *    Bom dia! Aqui é a Vitória, assistente online da CLYON 😊
 *    Vou recolher as informações do seu pedido…
 *    Para registar o pedido, diga-me só que serviço é…»
 *
 * *«Ela iria praticamente começar do zero, ela iria apresentar-se novamente,
 * sendo que já tinha feito isso. Queria que ela fizesse um resumo do que já
 * foi feito e desse continuidade — qual era já a próxima pergunta. E que essa
 * mensagem pudesse ser editada por mim, para caso ela errasse.»* — o dono.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("a retoma não se apresenta outra vez", () => {
  it("a Ofélia: diz que já tem as imagens, e pergunta só o serviço", () => {
    const d: DadosDaRecolha = { description: DESCRICAO_DAS_FOTOS, fotosDitas: true };
    const m = mensagemDaReleitura(d, "servico", []);
    expect(m).not.toContain(QUEM_FALA);
    expect(m).not.toContain("Vou recolher as informações");
    expect(m).toBe(
      "Para não lhe perguntar nada duas vezes, já tenho: as imagens que enviou.\n\n" +
        "Para registar o pedido, diga-me só que serviço é — recolha de entulho, de móveis ou de monos, esvaziar uma casa, uma mudança…",
    );
  });

  it("sem nada sabido, continua — e pergunta o serviço sem a apresentação", () => {
    const m = mensagemDaReleitura({}, "servico", []);
    expect(m).toBe(
      "Vamos continuar de onde ficámos.\n\nDiga-me o que precisa de levar ou fazer, à vontade e pelas suas palavras.",
    );
    expect(perguntaParaContinuar("servico", {})).not.toContain(QUEM_FALA);
  });

  it("com o que já se sabe, o resumo e a pergunta seguinte", () => {
    const d: DadosDaRecolha = { serviceType: "recolha_moveis", contactName: "Ofélia", fotosDitas: true };
    const m = mensagemDaReleitura(d, "morada", []);
    expect(m).toMatch(
      new RegExp(`^Para não lhe perguntar nada duas vezes, já tenho: ${servicoEmPalavras("recolha_moveis")} · Ofélia · as imagens que enviou\\.\\n\\nQual é a morada`),
    );
  });

  it("quando a releitura recuperou alguma coisa, diz que releu", () => {
    const m = mensagemDaReleitura({ serviceType: "recolha_moveis", contactName: "Ofélia" }, "morada", ["nome"]);
    expect(m).toMatch(/^Já reli a nossa conversa — .* Não precisa de repetir nada\.\n\nQual é a morada/);
  });

  it("e com tudo respondido, é o resumo", () => {
    const d: DadosDaRecolha = { serviceType: "recolha_moveis", contactName: "Ofélia" };
    expect(mensagemDaReleitura(d, "confirmar", [])).toBe(resumo(d));
  });

  it("a conversa dela, relida, dá a retoma certa", () => {
    const criadoEm = "2026-10-23T10:37:00Z";
    const fio = [
      { direccao: "in", texto: "Bom dia", criadoEm },
      {
        direccao: "out",
        texto:
          "Bom dia! Aqui é a Vitória, assistente online da CLYON 😊\nVou recolher as informações do seu pedido para os meus colegas avaliarem e lhe darem o orçamento.\n\nEm que posso ajudar? Diga-me o que precisa de levar ou fazer, à vontade e pelas suas palavras.",
        criadoEm,
      },
      { direccao: "in", texto: "Envio as fotos e um vídeo", criadoEm },
      {
        direccao: "out",
        texto:
          "Obrigada, fica anotado. Para registar o pedido, diga-me só que serviço é - recolha de entulho, de móveis ou de monos, esvaziar uma casa, uma mudança…",
        criadoEm,
      },
      { direccao: "in", texto: "[vídeo]", criadoEm },
      { direccao: "in", texto: "[fotografia]", criadoEm },
      { direccao: "in", texto: "[fotografia]", criadoEm },
      { direccao: "in", texto: "Sim", criadoEm },
      { direccao: "in", texto: "Será que esta visível", criadoEm },
      { direccao: "in", texto: "Ok", criadoEm },
    ];
    const lida = recolhaPeloFio(fio, new Date("2026-10-23T10:45:00Z"));
    expect(lida.passo).toBe("servico");
    const m = mensagemDaReleitura(lida.dados, lida.passo, []);
    expect(m).not.toContain(QUEM_FALA);
    expect(m).toContain("as imagens que enviou");
    expect(m).toContain("diga-me só que serviço é");
  });
});

describe("a mensagem edita-se antes de sair", () => {
  const ROTA = semComentarios(ler("src/app/api/admin/whatsapp/route.ts"));
  const PAINEL = ler("src/components/admin/AdminWhatsAppPanel.tsx");

  it("a rota manda o texto editado no lugar do proposto — com e sem leitura", () => {
    expect(ROTA).toContain('const editado = typeof corpo.texto === "string" ? corpo.texto.trim().slice(0, 4000) : "";');
    expect(ROTA).toContain("await enviarTextoWhatsApp(telefone, editado || proposta);");
    expect(ROTA).toContain("await enviarTextoWhatsApp(telefone, editado || r.mensagem);");
    // E sem leitura, a mesma retoma — já não a pergunta com a apresentação.
    expect(ROTA).toContain("const proposta = retoma(dados, passo, []);");
    expect(ROTA).not.toContain("perguntaDo(passo, dados, !compreensaoDisponivel())");
  });

  it("o painel mostra-a numa caixa editável, e manda o que lá estiver", () => {
    expect(PAINEL).toContain("value={textoDaReleitura}");
    expect(PAINEL).toContain("onChange={(e) => setTextoDaReleitura(e.target.value)}");
    expect(PAINEL).toContain("void reler(l.telefone, true, releitura.propostas ? undefined : textoDaReleitura)");
    expect(PAINEL).toContain('body: JSON.stringify({ accao: "relerConversa", telefone, confirmar, texto: confirmar ? texto : undefined }),');
    expect(PAINEL).toContain("Repor o texto da Vitória");
  });
});
