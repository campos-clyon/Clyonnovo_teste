import { describe, it, expect } from "vitest";
import { tipoDoFicheiro } from "./tipo-ficheiro";

describe("tipoDoFicheiro — o tipo declarado manda quando é válido", () => {
  it("aceita os formatos da lista", () => {
    for (const t of ["image/jpeg", "image/png", "image/webp", "image/heic", "video/mp4", "video/quicktime"]) {
      const r = tipoDoFicheiro("foto.jpg", t);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.origem).toBe("declarado");
    }
  });
});

/**
 * A regressão que isto existe para não voltar.
 *
 * O `type` de um File vem do browser e nem sempre é preenchido: fotos de
 * certas galerias de telemóvel, HEIC em Android, ficheiros vindos de
 * aplicações. Ao exigir o tipo declarado, estava a recusar fotos legítimas de
 * quem estava mesmo a pedir orçamento.
 */
describe("sem tipo declarado — a extensão decide, em vez de recusar", () => {
  it.each([
    ["foto.jpg", "image/jpeg"],
    ["FOTO.JPEG", "image/jpeg"],
    ["imagem.PNG", "image/png"],
    ["telemovel.heic", "image/heic"],
    ["clip.mov", "video/quicktime"],
    ["video.mp4", "video/mp4"],
  ])("%s sem tipo → %s", (nome, esperado) => {
    const r = tipoDoFicheiro(nome, "");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tipo).toBe(esperado);
      expect(r.origem).toBe("extensao");
    }
  });

  it("null e undefined são tratados como vazio, não rebentam", () => {
    expect(tipoDoFicheiro("a.png", null).ok).toBe(true);
    expect(tipoDoFicheiro("a.png", undefined).ok).toBe(true);
  });

  it("um tipo declarado que não conhecemos ainda cai na extensão", () => {
    // Alguns telemóveis mandam application/octet-stream para HEIC
    const r = tipoDoFicheiro("IMG_0042.heic", "application/octet-stream");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tipo).toBe("image/heic");
  });
});

describe("continua a ser uma lista fechada", () => {
  it("recusa executáveis e documentos, com ou sem tipo", () => {
    for (const nome of ["virus.exe", "macro.docm", "script.sh", "pagina.html", "x.svg"]) {
      expect(tipoDoFicheiro(nome, "").ok).toBe(false);
      expect(tipoDoFicheiro(nome, "image/png-falso").ok).toBe(false);
    }
  });

  it("um .exe que se declare imagem não passa pela extensão", () => {
    const r = tipoDoFicheiro("foto.exe", "");
    expect(r.ok).toBe(false);
  });

  it("SVG fica de fora — é um documento que executa script", () => {
    expect(tipoDoFicheiro("logo.svg", "image/svg+xml").ok).toBe(false);
  });

  it("um ficheiro sem extensão nenhuma e sem tipo é recusado com razão legível", () => {
    const r = tipoDoFicheiro("ficheiro", "");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("sem tipo e sem extensão");
  });
});
