import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eDaEquipa, MARCA_DE_MAO, semMarcaDeMao, textoDaRajada } from "./rajada-do-whatsapp";

/**
 * AS RESPOSTAS À MÃO FICAM ESCRITAS — 21-10-2026.
 *
 * *«Estamos perdidos entre quais pedidos já foram respondidos, quais já foram
 * resolvidos, quais ainda falta responder.»* — o dono, com 193 conversas em
 * «Entregues a si». Quando alguém respondia à mão no telemóvel, a ponte só
 * avisava o site de que tinha havido resposta — sem o texto. O fio ficava
 * com a pergunta do cliente por responder para sempre, e não havia forma de
 * saber quem já tinha tido resposta.
 *
 * Agora a ponte manda o que se escreveu, e o site guarda-o como saída com a
 * marca «[à mão]» à frente.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("a marca", () => {
  it("diz que foi a equipa, e sai para se ler o texto", () => {
    expect(eDaEquipa(`${MARCA_DE_MAO} Gilberto pode-nos dizer aqui qual a data desejada pff`)).toBe(true);
    expect(eDaEquipa("Boa tarde! Aqui é a Vitória")).toBe(false);
    expect(semMarcaDeMao(`${MARCA_DE_MAO} sim`)).toBe("sim");
    expect(semMarcaDeMao("Olá")).toBe("Olá");
  });

  it("e uma resposta à mão fecha a rajada do cliente, como as da Vitória", () => {
    const fio = [
      { id: 1, direccao: "in", texto: "Esse valor é pra retirada em Carnaxide e entrega em São Domingos de Benfica correto?" },
      { id: 2, direccao: "out", texto: `${MARCA_DE_MAO} sim` },
      { id: 3, direccao: "in", texto: "Combinado" },
      { id: 4, direccao: "in", texto: "Podemos prosseguir" },
    ];
    expect(textoDaRajada(fio)).toBe("Combinado\nPodemos prosseguir");
  });
});

describe("a ponte manda o que se escreveu à mão", () => {
  const PONTE = ler("ponte-whatsapp/index.js");

  it("com o aviso de que a conversa passou a uma pessoa", () => {
    expect(PONTE).toContain('await site("POST", { telefone, accao: "interromper", daMao: textoDaMao(msg) })');
  });

  it("o texto tal e qual; um anexo ou uma chamada, pelo que são", () => {
    const i = PONTE.indexOf("function textoDaMao(msg)");
    const corpo = PONTE.slice(i, PONTE.indexOf("\n}", i));
    expect(corpo).toContain('case "chat":');
    expect(corpo).toContain('return comLegenda("[imagem]");');
    expect(corpo).toContain('return "[chamada]";');
  });
});

describe("o site guarda-o como saída da equipa", () => {
  const ROTA = semComentarios(ler("src/app/api/whatsapp/ponte/route.ts"));

  it("antes de entregar a conversa, e só quando vem texto", () => {
    const i = ROTA.indexOf('if (corpo.accao === "interromper") {');
    const bloco = ROTA.slice(i, ROTA.indexOf("return NextResponse.json({ ok: true });", i));
    expect(bloco).toContain('const daMao = typeof corpo.daMao === "string" ? corpo.daMao.trim() : "";');
    expect(bloco).toMatch(/if \(daMao\) \{[\s\S]*registarMensagemWhatsApp\(telefone, "out", `\$\{MARCA_DE_MAO\} \$\{daMao\}`\)/);
    expect(bloco.indexOf("registarMensagemWhatsApp(telefone, \"out\"")).toBeLessThan(
      bloco.indexOf("interromperNumeroWhatsApp(telefone"),
    );
  });

  it("e o painel mostra-a com a etiqueta «à mão»", () => {
    const PAINEL = ler("src/components/admin/AdminWhatsAppPanel.tsx");
    expect(PAINEL).toContain("{saida && eDaEquipa(m.texto) && (");
    expect(PAINEL).toContain("{saida ? semMarcaDeMao(m.texto) : m.texto}");
  });
});
