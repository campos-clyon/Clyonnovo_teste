// relógio: datas explícitas em todas as chamadas — nada aqui lê o dia de hoje.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { corpoDaResposta, fraseDoPrazo, perguntasLidas, ROTA_DA_PERGUNTA_DO_CLIENTE } from "../../app-pro/src/lib/pergunta-do-cliente";
import {
  comONadaAPagarAgora,
  perguntasDaAjuda,
  PERGUNTA_DO_NADA_A_PAGAR_AGORA,
  respostaDoNadaAPagarAgora,
} from "../../app-pro/src/lib/novo-modelo";
import { NADA_A_PAGAR_AGORA_NO_NOVO_MODELO } from "./aviso-de-oferta-clyon";
import { DIAS_PARA_PAGAR_A_DIVIDA } from "./divida-do-profissional";
import { DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO } from "./novo-modelo";
import { notasDaApp } from "./notas-das-apps";

/**
 * D3 + D4 (CEO e dono, 24-11-2026), PARTE DA APP CLYON PRO.
 * d3: o cartão «O cliente pergunta se consegue…» (Sim com «quando», e Não),
 * sobre GET/POST /api/profissionais/pergunta-do-cliente, com o texto do
 * servidor e sem números escritos na app.
 * d4: a ajuda diz «nada a pagar agora» pelas constantes do site.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/** O código sem comentários (a regra ancorada ao início da linha, como pedem as notas dos testes de código-fonte). */
const semComentarios = (t: string) =>
  t
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");

describe("d3 — o cartão da pergunta do cliente na app Pro", () => {
  it("lê só as perguntas bem formadas (um site antigo ou lixo não mostram nada)", () => {
    expect(perguntasLidas(null)).toEqual([]);
    expect(perguntasLidas({})).toEqual([]);
    expect(perguntasLidas({ perguntas: "x" })).toEqual([]);
    expect(perguntasLidas({ perguntas: [{ id: "a" }, null, { id: 7, pedidoId: 800, condicao: "até quinta", prazoEm: "2026-11-25T15:00:00Z", perguntadoEm: "x" }] })).toEqual([
      { id: 7, pedidoId: 800, condicao: "até quinta", prazoEm: "2026-11-25T15:00:00Z" },
    ]);
  });

  it("o prazo diz-se em hora de Lisboa, seja qual for o fuso do telemóvel", () => {
    // 15h00 UTC de 25-11 é 15h00 em Lisboa no Inverno.
    expect(fraseDoPrazo("2026-11-25T15:00:00Z")).toBe("Responda até 25/11 15:00, para o cliente não ficar à espera.");
    expect(fraseDoPrazo("")).toBeNull();
    expect(fraseDoPrazo("lixo")).toBeNull();
  });

  it("o «quando» só segue com o SIM, e vazio vai como nulo", () => {
    expect(corpoDaResposta(7, "sim", " quinta à tarde ")).toEqual({ perguntaId: 7, resposta: "sim", quando: "quinta à tarde" });
    expect(corpoDaResposta(7, "sim", "   ")).toEqual({ perguntaId: 7, resposta: "sim", quando: null });
    expect(corpoDaResposta(7, "nao", "quinta")).toEqual({ perguntaId: 7, resposta: "nao", quando: null });
  });

  it("usa a rota do painel, com os dois botões, e a frase de depois é a do servidor", () => {
    expect(ROTA_DA_PERGUNTA_DO_CLIENTE).toBe("/api/profissionais/pergunta-do-cliente");
    const rota = ler("src/app/api/profissionais/pergunta-do-cliente/route.ts");
    expect(rota).toContain("perguntaId");
    expect(rota).toContain("texto: r.texto");
    const c = semComentarios(ler("app-pro/src/componentes/PerguntaDoCliente.tsx"));
    expect(c).toContain("ROTA_DA_PERGUNTA_DO_CLIENTE");
    expect(c).toContain('metodo: "POST"');
    expect(c).toContain("corpoDaResposta(pergunta.id, resposta, quando)");
    expect(c).toContain('responder("sim")');
    expect(c).toContain('responder("nao")');
    expect(c).toContain("r.texto");
    expect(c).toContain("Sim, consigo");
    expect(c).toContain("Não consigo");
  });

  it("a app não escreve números: nenhum dígito nos textos do cartão", () => {
    for (const f of ["app-pro/src/componentes/PerguntaDoCliente.tsx", "app-pro/src/lib/pergunta-do-cliente.ts"]) {
      const textos = [...semComentarios(ler(f)).matchAll(/(["`])((?:\.|(?!\1).)*)\1/g)].map((m) => m[2]);
      for (const t of textos) expect(t.replace(/\$\{[^}]*\}/g, "").replace(/#/g, ""), `${f}: «${t}»`).not.toMatch(/\d/);
    }
  });

  it("aparece à entrada da app, por cima dos avisos do modelo, e não escreve a palavra «cliente» como parceiro", () => {
    const i = semComentarios(ler("app-pro/src/app/(app)/index.tsx"));
    expect(i).toContain("<PerguntaDoCliente />");
    expect(i.indexOf("<PerguntaDoCliente />")).toBeLessThan(i.indexOf("<AvisosDoNovoModelo />"));
  });

  it("a nota da atualização da Pro fala do cartão (publicada a 26-11-2026, d1)", () => {
    const pro = notasDaApp("pro")[0];
    expect(pro.id).toBe("pro-2026-11-24");
    expect(pro.nota).toContain("Sim, recebi");
    expect(pro.nota).toMatch(/cliente pergunta se consegue/);
    expect(pro.updates).toEqual(["01a217c9-c3f7-74b4-9df5-eb8b6947b51d"]); // publicada a 26-11-2026 com o sim do CEO e do dono
  });
});

describe("d4 — a ajuda da app Pro: nada a pagar agora", () => {
  it("a resposta vem das constantes, sem números à mão", () => {
    const r = respostaDoNadaAPagarAgora();
    expect(r).toContain(NADA_A_PAGAR_AGORA_NO_NOVO_MODELO);
    expect(r).toContain(`${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias no modelo novo`);
    expect(r).toContain(`${DIAS_PARA_PAGAR_A_DIVIDA} nas dívidas antigas`);
    expect(r).toMatch(/referência/);
    const fonte = semComentarios(ler("app-pro/src/lib/novo-modelo.ts"));
    const bloco = fonte.slice(fonte.indexOf("export function respostaDoNadaAPagarAgora"), fonte.indexOf("export function comONadaAPagarAgora"));
    expect(bloco.replace(/\$\{[^}]*\}/g, "")).not.toMatch(/\d/);
  });

  it("aparece no modelo novo, uma só vez, e não no antigo", () => {
    const nova = perguntasDaAjuda(null, true);
    expect(nova.filter((p) => p.resposta.includes(NADA_A_PAGAR_AGORA_NO_NOVO_MODELO))).toHaveLength(1);
    expect(perguntasDaAjuda(null, false).some((p) => p.pergunta === PERGUNTA_DO_NADA_A_PAGAR_AGORA)).toBe(false);
    // Se a lista do site (a do painel) já a trouxer, a app não a repete.
    expect(comONadaAPagarAgora(nova)).toBe(nova);
  });
});
