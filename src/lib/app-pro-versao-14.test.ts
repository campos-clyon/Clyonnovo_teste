import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DIAS_PARA_MARCAR, HORAS_PARA_MARCAR, diasParaMarcar } from "../../app-pro/src/lib/trabalhos";
import { JANELA_PADRAO } from "./agenda-em-grelha";
import { FORA_DO_PLANO, SERVICOS_PUBLICOS } from "./service-categories";
import { PERGUNTAS_DO_PROFISSIONAL } from "./ajuda-plataforma";
import { PASSOS_DO_PROFISSIONAL } from "./como-funciona-para-o-profissional";
import { avisoDosItens } from "./itens-a-mais";

/**
 * A ACTUALIZAÇÃO SEM LOJA DE 25-10-2026 (EAS Update sobre a build 13).
 *
 * A app instalada dizia o que o painel já não diz: «6 % + 5 %» na Ajuda,
 * «32 €» sem «+ IVA», três serviços no registo que o site tirou nesse dia, e
 * só deixava marcar das 07:00 às 21:30 e até 21 dias à frente. As chamadas
 * não tinham prazo. Tudo isto é JavaScript: vai por EAS Update, sem build.
 */

const cru = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
/** Sem comentários, com a regra ancorada ao início da linha (tirar-comentarios-sem-comer-codigo). */
const semNotas = (f: string) =>
  cru(f)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s+/g, " ");
const vezes = (texto: string, pedaco: string) => texto.split(pedaco).length - 1;

describe("o registo na app — só os serviços do plano", () => {
  const REGISTO = semNotas("app-pro/src/app/registo.tsx");

  it("usa SERVICOS_PUBLICOS, como o formulário do /quero-ser-parceiro", () => {
    expect(REGISTO).toContain('import { SERVICOS_PUBLICOS } from "../../../src/lib/service-categories"');
    expect(REGISTO).toContain("{SERVICOS_PUBLICOS.map((s) =>");
    expect(REGISTO).not.toContain("SERVICE_CATEGORIES");
    const SITE = semNotas("src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx");
    expect(SITE).toContain("{SERVICOS_PUBLICOS.map((c) =>");
  });

  it("a lista é a do plano: recolhas, esvaziamentos, mudanças, manutenção da casa e «outro»", () => {
    // A manutenção da casa voltou ao plano a 25-10-2026, à noite.
    expect(SERVICOS_PUBLICOS.map((s) => s.id)).toEqual([
      "recolha_moveis",
      "recolha_monos",
      "recolha_entulho",
      "esvaziamento_casa",
      "esvaziamento_apartamento",
      "mudanca",
      "manutencao_casa",
      "outro",
    ]);
    for (const id of FORA_DO_PLANO) expect(SERVICOS_PUBLICOS.some((s) => s.id === id), id).toBe(false);
  });
});

describe("as chamadas ao site têm prazo", () => {
  const API = semNotas("app-pro/src/lib/api.ts");

  it("20 s num pedido e 60 s num ficheiro", () => {
    expect(API).toContain("export const PRAZO_DO_PEDIDO_MS = 20_000;");
    expect(API).toContain("export const PRAZO_DO_FICHEIRO_MS = 60_000;");
    expect(API).toContain("AbortSignal.timeout(ms)");
  });

  it("cada uma das duas chamadas leva o seu prazo, e o fim do prazo diz que a rede está lenta", () => {
    expect(vezes(API, "await fetch(`${SITE}${caminho}`")).toBe(2);
    expect(vezes(API, "signal: sinal")).toBe(2);

    const iPedir = API.indexOf("export async function pedir<T>(");
    const iFotografia = API.indexOf("export async function enviarFotografia(");
    const iFicheiro = API.indexOf("export async function enviarFicheiro<T>(");
    const iErros = API.indexOf("export function errosPorCampo(");
    for (const i of [iPedir, iFotografia, iFicheiro, iErros]) expect(i).toBeGreaterThan(-1);

    const PEDIR = API.slice(iPedir, iFotografia);
    expect(PEDIR).toContain("const sinal = sinalComPrazo(PRAZO_DO_PEDIDO_MS);");
    expect(PEDIR).toContain("signal: sinal");
    expect(PEDIR).toContain("if (sinal?.aborted) throw new ErroDaApi(MENSAGEM_DE_REDE_LENTA, 0);");

    const FICHEIRO = API.slice(iFicheiro, iErros);
    expect(FICHEIRO).toContain("const sinal = sinalComPrazo(PRAZO_DO_FICHEIRO_MS);");
    expect(FICHEIRO).toContain("signal: sinal");
    expect(FICHEIRO).toContain("if (sinal?.aborted) throw new ErroDaApi(MENSAGEM_DE_FICHEIRO_LENTO, 0);");

    expect(API).toMatch(/MENSAGEM_DE_REDE_LENTA = "[^"]*rede está lenta[^"]*"/);
    expect(API).toMatch(/MENSAGEM_DE_FICHEIRO_LENTO = "[^"]*rede está lenta[^"]*"/);
  });

  // O React Native só traz o AbortSignal do pacote abort-controller, sem `timeout`: quem o põe é o Expo.
  const RUNTIME = join(process.cwd(), "app-pro/node_modules/expo/src/winter/runtime.native.ts");
  it.runIf(existsSync(RUNTIME))("o Expo da app instala o AbortSignal.timeout no telemóvel", () => {
    expect(readFileSync(RUNTIME, "utf8")).toContain("installAbortSignalPatch(AbortSignal)");
  });
});

describe("marcar o dia na app como no painel", () => {
  const dois = (n: number) => String(n).padStart(2, "0");

  it("as horas são as da janela da agenda: da abertura até à última meia hora antes da meia-noite", () => {
    expect(JANELA_PADRAO).toEqual({ de: 7, ate: 24 });
    expect(HORAS_PARA_MARCAR[0]).toBe(`${dois(JANELA_PADRAO.de)}:00`);
    expect(HORAS_PARA_MARCAR.at(-1)).toBe(`${dois(JANELA_PADRAO.ate - 1)}:30`);
    expect(HORAS_PARA_MARCAR[0]).toBe("07:00");
    expect(HORAS_PARA_MARCAR.at(-1)).toBe("23:30");
    // De meia em meia hora, sem buracos.
    const minutos = HORAS_PARA_MARCAR.map((h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3)));
    minutos.slice(1).forEach((m, i) => expect(m - minutos[i]).toBe(30));
    expect(minutos.at(-1)! + 30).toBe(JANELA_PADRAO.ate * 60);
  });

  it("os dias vão 120 para a frente, a contar de hoje em Lisboa", () => {
    expect(DIAS_PARA_MARCAR).toBe(120);
    const dias = diasParaMarcar(new Date("2026-10-25T10:00:00.000Z"));
    expect(dias).toHaveLength(120);
    expect(dias[0]).toEqual({ dia: "2026-10-25", rotulo: "Hoje" });
    expect(dias.at(-1)!.dia).toBe("2027-02-21");
  });

  it("o ecrã do trabalho usa as duas listas inteiras", () => {
    const CONTRATADO = semNotas("app-pro/src/componentes/TrabalhoContratado.tsx");
    expect(CONTRATADO).toContain("const dias = diasParaMarcar();");
    expect(CONTRATADO).toContain("{HORAS_PARA_MARCAR.map((h) =>");
  });

  it("a rota da agenda aceita o que a app passa a deixar escolher", () => {
    // Só recusa mais de dois anos à frente; 120 dias e as 23:30 passam.
    const ROTA = semNotas("src/app/api/profissionais/agenda/route.ts");
    expect(ROTA).toContain("instanteEmLisboa(cru)");
    expect(ROTA).toContain("Date.now() + 2 * 365 * 86_400_000");
  });
});

describe("a Ajuda, o Como funciona e os itens a mais vêm do site", () => {
  it("os três ecrãs importam o texto do src/lib, e não têm cópia", () => {
    const AJUDA = semNotas("app-pro/src/app/conta/ajuda.tsx");
    expect(AJUDA).toContain('} from "../../../../src/lib/ajuda-plataforma"');
    expect(AJUDA).toContain("{PERGUNTAS_DO_PROFISSIONAL.map(");
    const COMO = semNotas("app-pro/src/app/conta/como-funciona.tsx");
    expect(COMO).toContain('} from "../../../../src/lib/como-funciona-para-o-profissional"');
    expect(COMO).toContain("{PASSOS_DO_PROFISSIONAL.map(");
    const AVISOS = semNotas("app-pro/src/componentes/AvisosDoValor.tsx");
    expect(AVISOS).toContain('import { avisoDosItens } from "../../../src/lib/itens-a-mais"');
    expect(AVISOS).toContain('avisoDosItens(base, "profissional")');
    for (const ecra of [AJUDA, COMO, AVISOS]) {
      expect(ecra).not.toContain("6 %");
      expect(ecra).not.toContain("5 % por cima");
    }
  });

  it("e o texto que levam é o de hoje: 11 %, o IVA à parte e «32 € + IVA»", () => {
    const ajuda = PERGUNTAS_DO_PROFISSIONAL.map((p) => `${p.pergunta} ${p.resposta}`).join(" ");
    expect(ajuda).toContain("a CLYON fica com 11 % do valor do trabalho, sem IVA");
    expect(ajuda).not.toContain("6 % sobre o valor acordado");
    expect(ajuda).not.toContain("5 % por cima");

    const como = PASSOS_DO_PROFISSIONAL.map((p) => p.texto).join(" ");
    expect(como).toContain("o cliente vê-o com IVA incluído");
    expect(como).not.toContain("com a taxa da plataforma e com IVA");

    expect(avisoDosItens("total", "profissional")).toContain("vale 32 € + IVA");
  });
});
