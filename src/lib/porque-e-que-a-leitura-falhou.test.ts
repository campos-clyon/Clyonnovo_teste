import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compreenderFioComMotivo } from "./whatsapp-compreensao";

/**
 * "Corrija esse erro ao tentar reler e continuar." — 14-09-2026.
 *
 * O que aparecia no painel:
 *
 *   A leitura falhou — o Gemini não respondeu a tempo ou devolveu algo que
 *   não se lê. Tente outra vez; se voltar a acontecer, veja os registos da
 *   Vercel por «[whatsapp/compreensao]».
 *
 * Uma frase para três avarias com donos diferentes: um prazo curto de mais
 * (dá-se mais tempo), um modelo a responder fora de formato (mexe-se no aviso
 * ao modelo), e a Google a recusar a chamada — quota, modelo que não existe,
 * conteúdo bloqueado — que nem sequer era mencionada. Mandar alguém ler
 * registos da Vercel é a forma mais cara de descobrir qual delas foi.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("a leitura diz porque é que não deu", () => {
  it("sem chave, di-lo pelo nome", async () => {
    const antes = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const r = await compreenderFioComMotivo("olá", {});
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toContain("GEMINI_API_KEY");
    } finally {
      if (antes != null) process.env.GEMINI_API_KEY = antes;
    }
  });

  it("sem conversa nenhuma, não culpa o modelo", async () => {
    const antes = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "so-para-o-teste";
    try {
      const r = await compreenderFioComMotivo("   ", {});
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toBe("Não há conversa para ler.");
    } finally {
      if (antes == null) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = antes;
    }
  });
});

describe("as três avarias estão escritas à parte", () => {
  const COMPREENSAO = ler("src/lib/whatsapp-compreensao.ts");

  it("o prazo é NOSSO e distingue-se do resto", () => {
    // A corrida em `pedirJson` é a única que produz esta mensagem; tudo o que
    // não comece assim veio da Google e traz o motivo dela.
    expect(COMPREENSAO).toContain('msg.startsWith("demorou mais de")');
  });

  it("uma resposta fora de formato não se chama «não respondeu»", () => {
    expect(COMPREENSAO).toContain("respondeu, mas não em JSON que se leia");
    // E diz o que fazer: tentar outra vez não resolve um problema de formato.
    expect(COMPREENSAO).toContain("tentar outra vez costuma dar o mesmo");
  });

  it("uma recusa da Google traz o motivo dela", () => {
    expect(COMPREENSAO).toContain("A Google recusou a leitura");
  });

  /*
   * A segunda tentativa corre com um modelo mais fraco e um prazo mais curto.
   * Se falhar também, dizer «o gemini-2.0-flash demorou mais de 10 s» manda a
   * pessoa atrás do modelo errado.
   */
  it("o motivo mostrado é o do modelo bom, e não o do de reserva", () => {
    const i = COMPREENSAO.indexOf("export async function compreenderFioComMotivo");
    const corpo = COMPREENSAO.slice(i, COMPREENSAO.indexOf("export async function compreenderFio(", i));
    expect(corpo).toContain("return { ok: false, motivo: bom.motivo };");
  });
});

describe("e há tempo para a leitura acontecer", () => {
  const ROTA = ler("src/app/api/admin/whatsapp/route.ts");

  it("quem espera é uma pessoa a olhar para um botão, não um cliente no WhatsApp", () => {
    expect(ROTA).toContain("{ bom: 40, reserva: 15 }");
  });

  it("a função tem tecto para esse prazo caber", () => {
    // Sem isto, a função podia ser cortada a meio da leitura — e aí nem a
    // mensagem de erro certa chegava ao painel.
    expect(ROTA).toContain("export const maxDuration = 60;");
  });

  it("o painel deixa de mandar ler os registos da Vercel", () => {
    expect(ROTA).not.toContain("veja os registos da Vercel por «[whatsapp/compreensao]»");
    expect(ROTA).toContain("leitura.motivo");
  });
});
