import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MARCA_DE_AUDIO,
  MARCA_DE_FOTOGRAFIA,
  eAUltimaDaRajada,
  textoDaRajada,
} from "./rajada-do-whatsapp";
import {
  PEDIR_PARA_ESCREVER,
  limparTranscricao,
  mimeParaOGemini,
  transcreverAudio,
} from "./whatsapp-audio";

/**
 * OS ÁUDIOS, OUVIDOS — 06-10-2026.
 *
 * «Quando um cliente manda um áudio, o que faz o assistente?» — «Ouve e
 * responde.» Até aqui a ponte deitava-os fora (não tinham texto), e o cliente
 * ficava sem resposta sem o painel saber que ele tinha falado.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

describe("o que o Gemini ouviu entra na rajada como texto", () => {
  it("a marca sai antes de o cérebro ler", () => {
    const fio = [
      { id: 1, direccao: "out", texto: "Com quem estou a falar?" },
      { id: 2, direccao: "in", texto: `${MARCA_DE_AUDIO} Chamo-me David e é para tirar entulho` },
    ];
    expect(textoDaRajada(fio)).toBe("Chamo-me David e é para tirar entulho");
    expect(eAUltimaDaRajada(2, fio)).toBe(true);
  });

  it("um áudio que não se ouviu não é texto, e não cala a mensagem escrita antes dele", () => {
    const fio = [
      { id: 1, direccao: "in", texto: "Bom dia" },
      { id: 2, direccao: "in", texto: MARCA_DE_AUDIO },
      { id: 3, direccao: "in", texto: MARCA_DE_FOTOGRAFIA },
    ];
    expect(textoDaRajada(fio)).toBe("Bom dia");
    expect(eAUltimaDaRajada(1, fio)).toBe(true);
  });
});

describe("a transcrição", () => {
  const chave = process.env.GEMINI_API_KEY;
  afterEach(() => {
    if (chave === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = chave;
  });

  it("sem fala que se perceba, não há texto — e o cliente ouve que pode escrever", () => {
    expect(limparTranscricao("(vazio)")).toBeNull();
    expect(limparTranscricao("  vazio ")).toBeNull();
    expect(limparTranscricao("")).toBeNull();
    expect(limparTranscricao("«Quero tirar um sofá»")).toBe("Quero tirar um sofá");
    expect(PEDIR_PARA_ESCREVER).toMatch(/áudio/);
    expect(PEDIR_PARA_ESCREVER).toMatch(/escrever/);
  });

  it("as notas de voz do WhatsApp chegam ao Gemini com um tipo que ele conhece", () => {
    expect(mimeParaOGemini("audio/ogg; codecs=opus")).toBe("audio/ogg");
    expect(mimeParaOGemini("audio/mpeg")).toBe("audio/mp3");
    expect(mimeParaOGemini(null)).toBe("audio/ogg");
  });

  it("sem chave não se chama ninguém, e devolve-se nada", async () => {
    delete process.env.GEMINI_API_KEY;
    expect(await transcreverAudio("AAAA", "audio/ogg")).toBeNull();
  });
});

describe("a ponte manda os áudios ao site, e não os deita fora", () => {
  const PONTE = semComentarios(ler("ponte-whatsapp/index.js"));

  it("as notas de voz e os ficheiros de áudio vão ao site", () => {
    expect(PONTE).toMatch(/msg\.hasMedia && \(msg\.type === "ptt" \|\| msg\.type === "audio"\)/);
    expect(PONTE).toMatch(/audio: cabe \? \{ base64: media\.data, mime: media\.mimetype \|\| "audio\/ogg" \} : \{\}/);
  });

  it("e vão ANTES do «sem texto, nada», que era onde morriam", () => {
    const audio = PONTE.indexOf('msg.type === "ptt"');
    const semTexto = PONTE.indexOf("if (!texto) return;");
    expect(audio).toBeGreaterThan(-1);
    expect(semTexto).toBeGreaterThan(audio);
  });

  it("a legenda de uma fotografia que não descarregou segue como texto", () => {
    const i = PONTE.indexOf("não descarregou — a página do WhatsApp Web mudou");
    expect(i).toBeGreaterThan(-1);
    const resto = PONTE.slice(i, PONTE.indexOf("return;", i));
    expect(resto).toContain('site("POST", { telefone, texto: legenda })');
  });
});

describe("o site ouve, responde, e pede para escrever quando não ouve", () => {
  const ROTA = semComentarios(ler("src/app/api/whatsapp/ponte/route.ts"));

  it("o que se ouviu vai pela rajada, com a marca no fio", () => {
    const i = ROTA.indexOf('await import("@/lib/whatsapp-audio")');
    expect(i).toBeGreaterThan(-1);
    const bloco = ROTA.slice(i, ROTA.indexOf("} else if (fotoBase64) {", i));
    expect(bloco).toContain("await transcreverAudio(audioBase64, audioMime)");
    expect(bloco).toContain("`${MARCA_DE_AUDIO} ${ouvido}`");
    expect(bloco).toContain("await responderARajada(telefone, id, ouvido);");
    expect(bloco).toContain("await enviarTextoWhatsApp(telefone, PEDIR_PARA_ESCREVER)");
  });

  it("numa conversa entregue a uma pessoa, fica só a marca — não se transcreve nem se responde", () => {
    const i = ROTA.indexOf("if (await numeroInterrompidoWhatsApp(telefone)) {");
    const bloco = ROTA.slice(i, ROTA.indexOf("return NextResponse.json({ meu: true, paraEnviar: [] });", i));
    expect(bloco).toContain('registarMensagemWhatsApp(telefone, "in", MARCA_DE_AUDIO)');
    expect(bloco).not.toContain("transcreverAudio");
    expect(bloco).not.toContain("enviarTextoWhatsApp");
  });
});

describe("o painel diz porque é que uma conversa está entregue", () => {
  const PAINEL = semComentarios(ler("src/components/admin/AdminWhatsAppPanel.tsx"));

  it("o motivo aparece na linha, mesmo com mensagens", () => {
    expect(PAINEL).toMatch(
      /const mostraMotivo =\s*\(l\.estado === "entregue" \|\| l\.estado === "bloqueada"\) && Boolean\(l\.nota\);/,
    );
    const i = PAINEL.indexOf("{mostraMotivo && (");
    expect(i).toBeGreaterThan(-1);
    // Antes da última mensagem, e não no lugar dela.
    expect(PAINEL.indexOf("{l.ultimaMensagem ? (", i)).toBeGreaterThan(i);
    expect(PAINEL.slice(i, i + 600)).toContain('"Entregue a si: "');
  });
});
