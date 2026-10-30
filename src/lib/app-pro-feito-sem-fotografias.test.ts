import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  FOTOGRAFIAS_SAO_OPCIONAIS as NA_APP_OPCIONAIS,
  QUEM_CONFIRMA_O_TRABALHO as NA_APP_QUEM_CONFIRMA,
  depoisDeMarcar,
  esperaPelaClyon,
  obrigadoDoFeito,
  type Fase,
  type MeusPedidos,
  type RespostaDoFeito,
} from "../../app-pro/src/lib/trabalhos";
import { pedirEmDemo } from "../../app-pro/src/lib/demo";
import {
  DIAS_ATE_LIBERTAR_SOZINHO,
  FOTOGRAFIAS_SAO_OPCIONAIS,
  OBRIGADO_DEPOIS_DE_FEITO,
  QUEM_CONFIRMA_O_TRABALHO,
  diasAteLibertar,
  faseDoTrabalho,
  porConfirmarComOCliente,
  type Trabalho as TrabalhoDoSite,
} from "./trabalho";
import { PERGUNTAS_DO_PROFISSIONAL } from "./ajuda-plataforma";
import { COMO_RECEBE, PASSOS_DO_PROFISSIONAL } from "./como-funciona-para-o-profissional";

/**
 * O TERCEIRO EAS UPDATE DE 25–26-10-2026 (d22, sobre a build 13, sem build nova).
 *
 * O site deixou de exigir fotografias no «está feito» (f61c110e): sem elas o
 * trabalho não fecha sozinho, e um colega da CLYON confirma com o cliente. A
 * app instalada ainda prendia o botão até haver uma fotografia, dizia «Precisa
 * de pelo menos uma fotografia», e contava os dias até à libertação de um
 * trabalho que já não tem prazo. Aqui guarda-se que a app diz o mesmo que o
 * painel e que lê a resposta nova da rota.
 */

const cru = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
/** Sem comentários, com a regra ancorada ao início da linha (tirar-comentarios-sem-comer-codigo). */
const semNotas = (f: string) =>
  cru(f)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s+/g, " ");

const CONTRATADO = semNotas("app-pro/src/componentes/TrabalhoContratado.tsx");
const PAINEL = semNotas("src/app/profissionais/painel/Trabalhos.tsx");

/** Todos os ficheiros de código da app, para procurar o que não pode voltar. */
function ficheirosDaApp(pasta = "app-pro/src"): string[] {
  const fora: string[] = [];
  for (const nome of readdirSync(join(process.cwd(), pasta))) {
    const caminho = `${pasta}/${nome}`;
    if (statSync(join(process.cwd(), caminho)).isDirectory()) fora.push(...ficheirosDaApp(caminho));
    else if (/\.(ts|tsx)$/.test(nome)) fora.push(caminho);
  }
  return fora;
}

describe("as frases são as do painel, vindas do mesmo sítio", () => {
  it("a app usa as constantes de src/lib/trabalho.ts, e não cópias", () => {
    expect(NA_APP_OPCIONAIS).toBe(FOTOGRAFIAS_SAO_OPCIONAIS);
    expect(NA_APP_QUEM_CONFIRMA).toBe(QUEM_CONFIRMA_O_TRABALHO);
    expect(FOTOGRAFIAS_SAO_OPCIONAIS).toBe("Se puder, junte fotografias — ajudam, mas não são obrigatórias.");
    expect(QUEM_CONFIRMA_O_TRABALHO).toBe("Um colega da CLYON vai confirmar com o cliente se o trabalho foi feito.");
    expect(cru("app-pro/src/lib/trabalhos.ts")).toContain('from "../../../src/lib/trabalho";');
  });

  /*
   * 28-10-2026 (d4): o painel passou a dizer os dois caminhos numa linha
   * (`quemConfirmaAntesDeMarcar`), e a app também, no EAS Update de
   * 29-10-2026 — a mesma frase, na mesma ordem.
   */
  it("a caixa «Quando estiver feito» diz que as fotografias são opcionais, na app e no painel", () => {
    for (const ecra of [CONTRATADO, PAINEL]) {
      expect(ecra).toContain("Marque como feito quando acabar. {FOTOGRAFIAS_SAO_OPCIONAIS}");
    }
    expect(PAINEL).toContain("{quemConfirmaAntesDeMarcar(Boolean(pedido.ofertaClyon))}");
    expect(CONTRATADO).toContain("{quemConfirmaAntesDeMarcar(Boolean(t.ofertaClyon))}");
    expect(CONTRATADO).not.toContain("Marque como feito quando acabar. {QUEM_CONFIRMA_O_TRABALHO}");
    expect(CONTRATADO).not.toContain("Fotografe o trabalho acabado");
  });
});

describe("o botão funciona sem fotografias", () => {
  it("só espera pelas que ainda estão a subir, e pelo ajuste à espera", () => {
    expect(CONTRATADO).toContain("desactivado={fotosAEnviar || pendente}");
    expect(CONTRATADO).not.toMatch(/fotos\.length === 0 \|\|/);
  });

  it("nenhum ecrã da app volta a exigir uma fotografia para dar o trabalho por feito", () => {
    const ficheiros = ficheirosDaApp();
    expect(ficheiros.length).toBeGreaterThan(20);
    for (const f of ficheiros) {
      expect(semNotas(f), f).not.toContain("pelo menos uma fotografia");
    }
  });

  it("manda o que a rota aceita — as fotografias podem ir vazias", () => {
    expect(CONTRATADO).toContain('pedir<RespostaDoFeito>("/api/profissionais/trabalho"');
    expect(CONTRATADO).toContain("corpo: { negociacaoId: t.negociacaoId, fotos, nota: nota.trim() }");
    const ROTA = semNotas("src/app/api/profissionais/trabalho/route.ts");
    expect(ROTA).not.toContain("Envie pelo menos uma fotografia");
  });

  it("antes do «Sim», diz o que acontece: sem fotografias o cliente não é avisado", () => {
    expect(depoisDeMarcar("o cliente", 0)).toBe(`Depois disto o valor já não muda. ${QUEM_CONFIRMA_O_TRABALHO}`);
    expect(depoisDeMarcar("a CLYON", 0)).not.toContain("avisad");
    // Com fotografias diz-se o prazo, como a frase da rota a seguir (28-10-2026, d4).
    expect(depoisDeMarcar("o cliente", 2)).toBe(
      `Depois disto o valor já não muda, e o cliente é avisado para confirmar — se não disser nada, fica confirmado ao fim de ${DIAS_ATE_LIBERTAR_SOZINHO} dias.`,
    );
    expect(depoisDeMarcar("a CLYON", 1)).toBe(
      `Depois disto o valor já não muda, e a CLYON é avisada para confirmar — fica confirmado ao fim de ${DIAS_ATE_LIBERTAR_SOZINHO} dias no máximo.`,
    );
    expect(CONTRATADO).toContain("{depoisDeMarcar(quem, fotos.length)}");
  });
});

describe("depois de marcar, a app mostra a frase da rota", () => {
  it("a da resposta, e a mesma do site se não vier", () => {
    expect(obrigadoDoFeito({ ok: true, mensagem: "Obrigado. Frase nova do site." })).toBe("Obrigado. Frase nova do site.");
    expect(obrigadoDoFeito({ ok: true })).toBe(OBRIGADO_DEPOIS_DE_FEITO);
    expect(obrigadoDoFeito({ ok: true, mensagem: "  " })).toBe(OBRIGADO_DEPOIS_DE_FEITO);
    expect(obrigadoDoFeito({ ok: true, mensagem: 7 })).toBe(OBRIGADO_DEPOIS_DE_FEITO);
    expect(obrigadoDoFeito(null)).toBe(OBRIGADO_DEPOIS_DE_FEITO);
    expect(OBRIGADO_DEPOIS_DE_FEITO).toBe(
      "Obrigado. Um colega da CLYON vai confirmar com o cliente se o trabalho foi feito.",
    );
  });

  it("a rota devolve essa frase, e o ecrã guarda-a por cima da troca de fase", () => {
    // Desde 28-10-2026 (d4) a frase é a do caminho certo — `mensagemDepoisDeFeito`.
    expect(semNotas("src/app/api/profissionais/trabalho/route.ts")).toContain("mensagem: mensagemDepoisDeFeito({");
    expect(CONTRATADO).toContain("aoMarcar(obrigadoDoFeito(r));");
    // Fica no TrabalhoContratado: a caixa do «está feito» sai quando o trabalho passa a «à espera».
    expect(CONTRATADO).toContain("const [obrigado, setObrigado] = useState<string | null>(null);");
    expect(CONTRATADO).toContain('{obrigado ? <Mensagem tom="bom" texto={obrigado} /> : null}');
    expect(CONTRATADO).toContain(
      // Desde 30-10-2026 o «está feito» só aparece com as duas confirmações da chegada (viagem-ate-ao-cliente.ts).
      '{obrigado ? ( <Mensagem tom="bom" texto={obrigado} /> ) : concluirVisivel(t) ? ( <EstaFeito t={t} aoMarcar={setObrigado} /> ) : null}',
    );
  });
});

describe("sem prazo, a app não conta dias", () => {
  const agora = new Date("2026-10-26T12:00:00.000Z");
  const feito = (provaJson: string | null): TrabalhoDoSite => ({
    estado: "acordada",
    execucaoEnviadaEm: "2026-10-25T10:00:00.000Z",
    confirmadoEm: null,
    pagoEm: null,
    provaJson,
  });
  const casos: Array<[string, string | null]> = [
    ["sem fotografias", JSON.stringify({ fotos: [], nota: "", em: "2026-10-25T10:00:00.000Z" })],
    ["sem prova nenhuma (dado por feito pela CLYON)", null],
    ["com fotografias", JSON.stringify({ fotos: ["https://x.public.blob.vercel-storage.com/a.jpg"], nota: "", em: "x" })],
  ];

  it("lê o `diasAteLibertar` do site e decide como o painel decide", () => {
    for (const [nome, prova] of casos) {
      const t = feito(prova);
      // O que a rota meus-pedidos manda à app: a fase e os dias, decididos no site.
      const naApp = { fase: faseDoTrabalho(t) as Fase, diasAteLibertar: diasAteLibertar(t, agora) };
      expect(esperaPelaClyon(naApp), nome).toBe(porConfirmarComOCliente(t));
    }
  });

  it("só em «à espera da confirmação»", () => {
    expect(esperaPelaClyon({ fase: "a_confirmar", diasAteLibertar: null })).toBe(true);
    expect(esperaPelaClyon({ fase: "a_confirmar", diasAteLibertar: 6.2 })).toBe(false);
    expect(esperaPelaClyon({ fase: "a_confirmar", diasAteLibertar: 0 })).toBe(false);
    for (const fase of ["a_executar", "confirmado", "pago", "a_negociar"] as const) {
      expect(esperaPelaClyon({ fase, diasAteLibertar: null }), fase).toBe(false);
    }
  });

  // Desde 29-10-2026 (d4) a frase é a do painel: `aEsperaDaConfirmacao`, com o prazo que o site mandou.
  it("mostra a espera pela CLYON no lugar do prazo", () => {
    expect(CONTRATADO).toContain("semFotografias: esperaPelaClyon(t),");
    expect(CONTRATADO).toContain("diasAteLibertar: t.diasAteLibertar,");
    expect(CONTRATADO).not.toContain("Math.ceil(t.diasAteLibertar)");
  });
});

describe("a Ajuda e o Como funciona da app levam os textos novos", () => {
  it("os ecrãs lêem as listas do site, e não cópias", () => {
    // Desde 29-10-2026 (d8) com a taxa da rota: `perguntasDoProfissional(taxas)`, como o painel.
    expect(cru("app-pro/src/app/conta/ajuda.tsx")).toMatch(
      /perguntasDoProfissional,[\s\S]*?from "\.\.\/\.\.\/\.\.\/\.\.\/src\/lib\/ajuda-plataforma";/,
    );
    expect(cru("app-pro/src/app/conta/como-funciona.tsx")).toMatch(
      /PASSOS_DO_PROFISSIONAL,[\s\S]*?from "\.\.\/\.\.\/\.\.\/\.\.\/src\/lib\/como-funciona-para-o-profissional";/,
    );
  });

  it("as listas já dizem que as fotografias são opcionais e quem confirma sem elas", () => {
    const prova = PASSOS_DO_PROFISSIONAL.find((p) => p.chave === "prova");
    expect(prova?.titulo).toBe("Faz o trabalho e marca-o como feito");
    expect(prova?.texto).toContain(FOTOGRAFIAS_SAO_OPCIONAIS);
    expect(prova?.texto).toContain("um colega da CLYON confirma com o cliente");
    const respostas = PERGUNTAS_DO_PROFISSIONAL.map((p) => p.resposta).join(" ");
    expect(respostas).toContain("Sem fotografias, a CLYON confirma com o cliente");
    expect(COMO_RECEBE.map((c) => c.texto).join(" ")).toContain("sem fotografias, até a CLYON o confirmar com o cliente");
  });
});

describe("o modo de demonstração responde como a rota nova", () => {
  it("sem fotografias: a frase, zero fotografias e nenhum prazo", async () => {
    const r = await pedirEmDemo<RespostaDoFeito>("/api/profissionais/trabalho", "POST", {
      negociacaoId: 904,
      fotos: [],
      nota: "",
    });
    expect(r).toEqual({ ok: true, mensagem: OBRIGADO_DEPOIS_DE_FEITO, fotografias: 0, confirmacaoAutomaticaEmDias: null });
    const { pedidos } = await pedirEmDemo<MeusPedidos>("/api/profissionais/meus-pedidos", "GET", undefined);
    const t = pedidos.find((p) => p.negociacaoId === 904);
    expect(t?.fase).toBe("a_confirmar");
    expect(t && esperaPelaClyon(t)).toBe(true);
  });

  it("com fotografias: o prazo de sempre", async () => {
    const r = await pedirEmDemo<RespostaDoFeito>("/api/profissionais/trabalho", "POST", {
      negociacaoId: 901,
      fotos: ["https://x.public.blob.vercel-storage.com/a.jpg"],
      nota: "",
    });
    expect(r.confirmacaoAutomaticaEmDias).toBe(DIAS_ATE_LIBERTAR_SOZINHO);
    expect(r.fotografias).toBe(1);
  });
});
