import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RONDA_DA_PONTE_SEGUNDOS,
  SEGUNDOS_ATE_ALARME,
  SEGUNDOS_ATE_DESCONFIAR,
  estadoDaPonte,
  fichaDaPonte,
  haQuantoTempo,
  segundosDesde,
} from "./ponte-viva";

/**
 * O sinal de vida da ponte do WhatsApp — 22-09-2026.
 *
 * "Porque é que o assistente não conversou com essa cliente?" — e não havia
 * como responder. Quando a ponte morre, o site continua a parecer normal: o
 * assistente escreve, a fila enche-se, e ninguém vê.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const AGORA = new Date("2026-09-22T15:00:00Z");
const hMenos = (segundos: number) => new Date(AGORA.getTime() - segundos * 1000);

describe("quanto tempo passou", () => {
  it("conta os segundos desde o carimbo", () => {
    expect(segundosDesde(hMenos(4), AGORA)).toBe(4);
    expect(segundosDesde(hMenos(1560), AGORA)).toBe(1560);
  });

  it("aceita a data em texto, que é como vem da rota", () => {
    expect(segundosDesde(hMenos(30).toISOString(), AGORA)).toBe(30);
  });

  it("sem carimbo nenhum, é null e não zero", () => {
    // Zero seria "veio agora mesmo" — o contrário da verdade.
    expect(segundosDesde(null, AGORA)).toBeNull();
    expect(segundosDesde("isto não é uma data", AGORA)).toBeNull();
  });

  it("um carimbo no futuro não vira um número negativo", () => {
    /*
     * O relógio da base e o do servidor não são o mesmo relógio. Alguns
     * segundos de diferença não são uma avaria para mostrar a ninguém.
     */
    expect(segundosDesde(new Date(AGORA.getTime() + 3000), AGORA)).toBe(0);
  });
});

describe("o estado", () => {
  it("acabada de vir é viva", () => {
    expect(estadoDaPonte(hMenos(RONDA_DA_PONTE_SEGUNDOS), AGORA)).toBe("viva");
  });

  it("a janela do verde aguenta doze rondas falhadas", () => {
    // Folga para um arranque a frio do Vercel, sem chegar para esconder uma
    // ponte morta: 60 s a dividir por rondas de 5 s.
    expect(SEGUNDOS_ATE_DESCONFIAR / RONDA_DA_PONTE_SEGUNDOS).toBe(12);
    expect(estadoDaPonte(hMenos(SEGUNDOS_ATE_DESCONFIAR), AGORA)).toBe("viva");
    expect(estadoDaPonte(hMenos(SEGUNDOS_ATE_DESCONFIAR + 1), AGORA)).toBe("a-demorar");
  });

  it("passados cinco minutos é avaria", () => {
    expect(estadoDaPonte(hMenos(SEGUNDOS_ATE_ALARME), AGORA)).toBe("a-demorar");
    expect(estadoDaPonte(hMenos(SEGUNDOS_ATE_ALARME + 1), AGORA)).toBe("calada");
  });

  it("nunca ter vindo é um estado próprio", () => {
    // Não é o mesmo que "veio há muito tempo": num diz-se para ir ao Railway,
    // no outro pergunta-se se ela alguma vez foi posta a correr.
    expect(estadoDaPonte(null, AGORA)).toBe("nunca");
  });
});

describe("há quanto tempo, em palavras", () => {
  it("abaixo do minuto, segundos", () => {
    expect(haQuantoTempo(4)).toBe("há 4 s");
    expect(haQuantoTempo(59)).toBe("há 59 s");
  });

  it("acima do minuto, nunca em segundos", () => {
    // "há 1847 s" obriga quem lê a fazer uma conta, e quem abre este ecrã
    // abre-o porque já tem um problema nas mãos.
    expect(haQuantoTempo(60)).toBe("há 1 min");
    expect(haQuantoTempo(1560)).toBe("há 26 min");
  });

  it("horas e dias", () => {
    expect(haQuantoTempo(3600)).toBe("há 1 h");
    expect(haQuantoTempo(86400)).toBe("há 1 dia");
    expect(haQuantoTempo(86400 * 3)).toBe("há 3 dias");
  });
});

describe("a ficha que o painel mostra", () => {
  it("viva diz a hora e cala-se — não há nada a fazer", () => {
    const f = fichaDaPonte(hMenos(4), AGORA);
    expect(f.titulo).toBe("A ponte veio há 4 s");
    expect(f.explicacao).toBe("");
  });

  it("calada muda o verbo: não «veio», mas «não vem»", () => {
    // "A ponte veio há 26 min" lê-se como uma informação; "não vem há 26 min"
    // lê-se como um problema. É o mesmo número e não é a mesma frase.
    const f = fichaDaPonte(hMenos(1560), AGORA);
    expect(f.titulo).toBe("A ponte não vem há 26 min");
    expect(f.estado).toBe("calada");
  });

  it("quando há avaria, diz O QUE FAZER e onde", () => {
    /*
     * Um ponto vermelho sem dizer o que fazer manda a pessoa perguntar a
     * alguém — que é justamente o custo que isto vem cortar.
     */
    const f = fichaDaPonte(hMenos(1560), AGORA);
    expect(f.explicacao).toContain("Railway");
    expect(f.explicacao).toContain("virtuous-creativity");
    expect(f.explicacao).toContain("emparelhad");
  });

  it("a demorar não grita: ainda pode ser rede", () => {
    const f = fichaDaPonte(hMenos(120), AGORA);
    expect(f.estado).toBe("a-demorar");
    expect(f.explicacao).toContain("5 em 5 segundos");
  });

  it("nunca ter vindo tem palavras próprias", () => {
    expect(fichaDaPonte(null, AGORA).titulo).toBe("A ponte nunca veio buscar nada");
  });
});

describe("as peças estão ligadas", () => {
  const ROTA_PONTE = ler("src/app/api/whatsapp/ponte/route.ts");
  const ROTA_ADMIN = ler("src/app/api/admin/whatsapp/route.ts");
  const PAINEL = ler("src/components/admin/AdminWhatsAppPanel.tsx");
  const DB = ler("src/lib/db.ts");
  const PONTE = ler("ponte-whatsapp/index.js");

  it("carimba-se no portão, e não em cada handler", () => {
    // Um carimbo esquecido num dos três dava um painel a dizer que ela morreu
    // quando ela estava a trabalhar.
    expect(ROTA_PONTE).toContain(
      "async function portao(req: NextRequest): Promise<NextResponse | null>",
    );
    expect(ROTA_PONTE).toContain("await carimbarPonte();");
    expect((ROTA_PONTE.match(/const erro = await portao\(req\);/g) ?? []).length).toBe(3);
  });

  it("carimba-se DEPOIS da autenticação — quem falha o segredo não é a ponte", () => {
    const corpo = ROTA_PONTE.slice(
      ROTA_PONTE.indexOf("async function portao"),
      ROTA_PONTE.indexOf("export async function GET"),
    );
    expect(corpo.indexOf("autorizado(req)")).toBeLessThan(corpo.indexOf("await carimbarPonte()"));
  });

  it("o carimbo nunca pode travar a rota", () => {
    const f = DB.slice(
      DB.indexOf("export async function carimbarPonte"),
      DB.indexOf("export async function quandoAPonteVeio"),
    );
    expect(f).toContain("catch");
    expect(f).toContain("ponteVistaEm = NOW()");
  });

  it("a coluna é criada com as outras da linha de estado", () => {
    expect(DB).toContain("ALTER TABLE whatsappEstado ADD COLUMN ponteVistaEm DATETIME NULL");
  });

  it("o backoffice manda a hora em ISO, e não uma contagem já feita", () => {
    // O relógio que conta é o de quem está a olhar para o ecrã, e não o do
    // servidor que respondeu a este pedido há dois minutos.
    expect(ROTA_ADMIN).toContain(
      "ponteVistaEm: ponteVistaEm ? ponteVistaEm.toISOString() : null",
    );
  });

  it("o painel só mostra o sinal quando o canal é a ponte", () => {
    /*
     * Com a API da Meta ou com o número à mão não há ponte nenhuma, e um
     * alarme vermelho sobre uma coisa que não devia estar a correr ensina a
     * ignorar alarmes.
     */
    expect(PAINEL).toContain('estado.canal === "ponte" ? fichaDaPonte(');
  });

  it("a régua bate com a ronda que a ponte faz mesmo", () => {
    // Se alguém mudar o INTERVALO_MS na ponte, este teste chumba — e é essa a
    // intenção: a janela do verde foi calculada a partir dele.
    expect(PONTE).toContain("Number(process.env.INTERVALO_MS ?? 5000)");
    expect(RONDA_DA_PONTE_SEGUNDOS).toBe(5);
  });

  it("a ponte só bate à porta emparelhada — é o que torna o sinal honesto", () => {
    /*
     * `if (!ligado ...) return` no início da ronda, e `ligado` só é verdade
     * entre o `ready` e o `disconnected` do WhatsApp. Um carimbo fresco não
     * diz apenas "o processo está de pé": diz que está de pé E emparelhado.
     */
    const i = PONTE.indexOf("async function rondaDaFila");
    expect(PONTE.slice(i, i + 200)).toContain("if (!ligado");
  });
});
