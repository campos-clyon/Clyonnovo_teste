import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TEXTO_DE_ESPERA_DO_TESTE,
  avisoDaListaDaPlay,
  estaNaListaDaPlay,
  estadoDoPassoDoTeste,
  quemAvisarDaLista,
} from "./lista-da-play-e-o-profissional";

/**
 * d6 (18-11-2026): a /app-pro confere o Gmail do profissional com a última
 * lista da Play colada no backoffice; espera em vez de «tente mais tarde»; e
 * avisa UMA vez quando o Gmail aparece numa lista colada.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("o Gmail confere-se como o quadro o confere", () => {
  it("pontos e maiúsculas não contam num Gmail", () => {
    expect(estaNaListaDaPlay(["Joao.Silva@Gmail.com"], ["joaosilva@gmail.com"])).toBe(true);
    expect(estaNaListaDaPlay(["joaosilva@gmail.com"], ["J.O.A.O.Silva@GMAIL.COM"])).toBe(true);
    expect(estaNaListaDaPlay(["joaosilva+teste@googlemail.com"], ["joaosilva@gmail.com"])).toBe(true);
  });

  it("fora de um Gmail os pontos contam, e outro Gmail não serve", () => {
    expect(estaNaListaDaPlay(["joao.silva@empresa.pt"], ["joaosilva@empresa.pt"])).toBe(false);
    expect(estaNaListaDaPlay(["outro@gmail.com"], ["joaosilva@gmail.com"])).toBe(false);
  });

  it("vale o Gmail do teste ou o email da conta; vazios e nulos não contam", () => {
    expect(estaNaListaDaPlay([null, "conta@gmail.com"], ["conta@gmail.com"])).toBe(true);
    expect(estaNaListaDaPlay([null, "", undefined], ["conta@gmail.com"])).toBe(false);
  });
});

describe("o passo 3", () => {
  it("lista vazia (nenhuma colada) = o texto de espera para quem deixou o Gmail", () => {
    expect(estaNaListaDaPlay(["joaosilva@gmail.com"], [])).toBe(false);
    expect(estadoDoPassoDoTeste({ sessao: true, temGmail: true, naLista: false })).toBe("espera");
  });

  it("na lista = o link do teste; sem sessão, sem Gmail ou sem resposta = como sempre", () => {
    expect(estadoDoPassoDoTeste({ sessao: true, temGmail: true, naLista: true })).toBe("pode");
    expect(estadoDoPassoDoTeste({ sessao: false, temGmail: true, naLista: false })).toBe("sem-dados");
    expect(estadoDoPassoDoTeste({ sessao: true, temGmail: false, naLista: false })).toBe("sem-dados");
    expect(estadoDoPassoDoTeste({ sessao: true, temGmail: true, naLista: null })).toBe("sem-dados");
  });

  it("a /app-pro tem o texto de espera, já não manda «tentar mais tarde», e o «Candidate-se» no passo 2", () => {
    const pro = semNotas(ler("src/app/app-pro/page.tsx"));
    expect(TEXTO_DE_ESPERA_DO_TESTE).toBe(
      "Já recebemos o seu Gmail; avisamos assim que puder carregar em «Tornar-me testador».",
    );
    expect(pro).toContain("TEXTO_DE_ESPERA_DO_TESTE");
    expect(pro).not.toMatch(/tente outra vez mais tarde/);
    expect(pro).toMatch(/semConta: \{[^}]*rotulo: "Candidate-se"/);
    const comp = semNotas(ler("src/components/AdesaoDaApp.tsx"));
    expect(comp).toContain("{passo === 2 && !emEspera && (");
    expect(comp).toContain("{sessao === false && semConta}");
  });
});

describe("o aviso sai uma vez, e só ao colar uma lista", () => {
  const pessoas = [
    { id: 1, emails: ["a.b@gmail.com", "a@empresa.pt"], avisadoEm: null, abriuApp: false },
    { id: 2, emails: ["c@gmail.com"], avisadoEm: "2026-11-18 10:00:00", abriuApp: false },
    { id: 3, emails: ["d@gmail.com"], avisadoEm: null, abriuApp: true },
    { id: 4, emails: ["e@gmail.com"], avisadoEm: null, abriuApp: false },
  ];

  it("só quem está na lista, nunca foi avisado e ainda não abriu a app", () => {
    expect(quemAvisarDaLista(pessoas, ["AB@gmail.com", "c@gmail.com", "d@gmail.com"])).toEqual([1]);
  });

  it("lista vazia não avisa ninguém", () => {
    expect(quemAvisarDaLista(pessoas, [])).toEqual([]);
  });

  it("na base: reserva a data antes de enviar, só se ainda estiver vazia, e conta a linha mudada", () => {
    const base = semNotas(ler("src/lib/lista-da-play-avisos-na-base.ts"));
    expect(base).toContain(
      "UPDATE providers SET avisoDaListaDaPlayEm = UTC_TIMESTAMP() WHERE id = ? AND avisoDaListaDaPlayEm IS NULL",
    );
    expect(base).toContain("if (Number(r.affectedRows ?? 0) === 0) continue;");
    expect(base).toContain("avisoDaListaDaPlayEm IS NULL AND appAbertaEm IS NULL");
    expect(ler("src/lib/db.ts")).toContain(
      "ALTER TABLE providers ADD COLUMN avisoDaListaDaPlayEm DATETIME NULL DEFAULT NULL",
    );
  });

  it("dispara só no POST que grava a lista da CLYON Pro — nenhuma rotina nem arranque o chama", () => {
    const rota = semNotas(ler("src/app/api/admin/quem-conta-para-os-12/route.ts"));
    // d106 (24-11-2026): a app de cliente tem o seu (desligado até haver texto aprovado); a Pro continua só no POST da Pro.
    const soEspacos = rota.replace(/\s+/g, " ");
    expect(soEspacos).toContain(
      'corpo.app === "pro" ? await avisarQuemEntrouNaListaDaPlay(emailsDaListaColada(lista)) : await avisarClientesQueEntraramNaListaDaPlay(emailsDaListaColada(lista))',
    );
    const get = rota.slice(rota.indexOf("export async function GET"), rota.indexOf("export async function POST"));
    expect(get).not.toContain("avisarQuemEntrouNaListaDaPlay");
  });

  it("o aviso leva à /app-pro no passo 3 e não põe o nome no ecrã de bloqueio", () => {
    const a = avisoDaListaDaPlay({ nome: "Ana Exemplo", link: "https://clyon.pt/app-pro?passo=3" });
    expect(a.texto).toContain("Olá Ana,");
    expect(a.texto).toContain("https://clyon.pt/app-pro?passo=3");
    expect(a.corpo).not.toContain("Ana");
    expect(a.titulo).not.toContain("Ana");
  });
});
