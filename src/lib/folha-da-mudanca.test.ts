import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { congelarTarifa, REGRAS_DAS_MUDANCAS, type TarifaDasMudancas } from "./conta-da-mudanca";
import {
  contextoDaFolha,
  dinheiroDaFolha,
  estadoDaFolha,
  folhaDeJson,
  folhaNoEcra,
  horaDaFolhaCent,
  horasAoQuarto,
  lerFolha,
  passoDaFolha,
  PRAZOS_DA_FOLHA,
  type ContextoDaFolha,
  type CorpoDaFolha,
} from "./folha-da-mudanca";
import { contaDoCliente, quantoOProfissionalRecebe } from "./taxas-plataforma";
import { instanteEmLisboa } from "./hora-de-lisboa";
import { horasParaOCliente } from "./pedido-para-a-app";
import { CONFIRMO_AS_HORAS, TITULO_DAS_HORAS } from "./horas-do-trabalho";
import {
  caminhoDoMapaDoPercurso,
  ligacaoDeDireccoes,
  parametrosDoMapa,
  percursoParaOParceiro,
  podeVerAMoradaExacta,
  textoDoPercurso,
} from "./mapa-do-percurso";

/**
 * A FOLHA DA MUDANÇA — 11-11-2026 (ordem do CEO com o sim do dono). A conta
 * final pela tarifa congelada (mínimos, pausas, quarto de hora, km mínimo,
 * material sem taxa, 3 pessoas), os estados e os prazos em hora de Lisboa,
 * que as negociações sem tarifa congelada não mudam, e a morada exacta só
 * depois de contratado.
 */

const TARIFA: TarifaDasMudancas = {
  precoHora2: 40,
  precoHora3: 55,
  minimoHoras: 3,
  precoKm: 0.5,
  kmMinimo: 20,
  kmMaximo: 100,
  caixa: 2,
  cartaoMetro: 1,
  filmeRolo: 15,
  plasticoBolhaRolo: null,
  aparecerNaLista: true,
};
const CONGELADA = congelarTarifa(TARIFA, REGRAS_DAS_MUDANCAS, new Date("2026-11-11T10:00:00Z"));
const AGORA = new Date("2026-11-13T12:00:00Z");

function ctx(p: Partial<ContextoDaFolha> = {}): ContextoDaFolha {
  return { tarifa: CONGELADA, pessoasEscolhidas: 2, kmDoPercurso: 70, valorPorHoraAcordado: 40, diaPorOmissao: "2026-11-12", ...p };
}
function folha(corpo: CorpoDaFolha, c: ContextoDaFolha = ctx()) {
  const r = lerFolha(corpo, c, AGORA);
  if (!r.ok) throw new Error(r.erro);
  return r.folha;
}

describe("a conta final, pela tarifa congelada", () => {
  it("o caso do dono: 8 h com pausa, 2 pessoas, 70 km, filme e caixas", () => {
    const f = folha({
      inicio: "09:00",
      fim: "17:30",
      pausas: [{ inicio: "12:30", fim: "13:00" }],
      km: "70",
      materiais: { filmeRolos: 3, caixas: 10 },
    });
    expect(f.minutosNoLocal).toBe(510);
    expect(f.minutosDePausa).toBe(30);
    expect(f.minutosTrabalhados).toBe(480);
    expect(f.conta.horas.cobradas).toBe(8);
    expect(f.conta.horas.cent).toBe(32000);
    expect(f.conta.km.cent).toBe(3500);
    expect(f.conta.materiais.cent).toBe(6500);
    // A taxa só nas horas e nos km (10 % de 355 €), de dentro.
    expect(f.conta.taxa.cent).toBe(3550);
    expect(f.conta.semIvaCent).toBe(42000);
    expect(f.conta.ivaCent).toBe(9660);
    expect(f.conta.totalCent).toBe(51660);
    // O material vai inteiro para o parceiro.
    expect(f.conta.profissionalCent).toBe(32000 + 3500 - 3550 + 6500);
  });

  it("nunca abaixo do mínimo do parceiro (o da tarifa)", () => {
    const f = folha({ inicio: "09:00", fim: "10:10" });
    expect(f.horasAoQuarto).toBe(1.25);
    expect(f.conta.horas.cobradas).toBe(3);
  });

  it("ao quarto de hora, para cima", () => {
    expect(horasAoQuarto(241)).toBe(4.25);
    expect(horasAoQuarto(240)).toBe(4);
    expect(folha({ inicio: "09:00", fim: "13:01" }).conta.horas.cobradas).toBe(4.25);
  });

  it("as pausas não se cobram", () => {
    const sem = folha({ inicio: "08:00", fim: "14:00" });
    const com = folha({ inicio: "08:00", fim: "14:00", pausas: [{ inicio: "10:00", fim: "10:45" }] });
    expect(sem.conta.horas.cobradas).toBe(6);
    expect(com.conta.horas.cobradas).toBe(5.25);
  });

  it("os km mínimos: cobra-se max(km, km mínimos) × preço do km", () => {
    const f = folha({ inicio: "09:00", fim: "13:00", km: "5", motivoDosKm: "mudança na mesma rua" });
    expect(f.conta.km.cobrados).toBe(20);
    expect(f.conta.km.cent).toBe(1000);
  });

  it("os km já vêm do percurso; mudar pede o motivo", () => {
    expect(folha({ inicio: "09:00", fim: "13:00" }).km).toBe(70);
    const r = lerFolha({ inicio: "09:00", fim: "13:00", km: "82" }, ctx(), AGORA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.campo).toBe("motivoDosKm");
    expect(folha({ inicio: "09:00", fim: "13:00", km: "82", motivoDosKm: "desvio pela ponte" }).motivoDosKm).toBe("desvio pela ponte");
  });

  it("o material não leva taxa", () => {
    const sem = folha({ inicio: "09:00", fim: "13:00" });
    const com = folha({ inicio: "09:00", fim: "13:00", materiais: { filmeRolos: 2 } });
    expect(com.conta.taxa.cent).toBe(sem.conta.taxa.cent);
    expect(com.conta.profissionalCent - sem.conta.profissionalCent).toBe(3000);
  });

  it("3 pessoas: a hora de 3 da tarifa; e o cliente tem de concordar se subiu", () => {
    const tres = folha({ inicio: "09:00", fim: "13:00", pessoas: 3 }, ctx({ pessoasEscolhidas: 3, valorPorHoraAcordado: 55 }));
    expect(tres.conta.horas.precoHoraCent).toBe(5500);
    expect(folhaNoEcra(tres, "cliente", 3).avisoDaEquipa).toBeNull();
    const subiu = folha({ inicio: "09:00", fim: "13:00", pessoas: 3 });
    expect(subiu.conta.horas.precoHoraCent).toBe(5500);
    expect(folhaNoEcra(subiu, "cliente", 3).avisoDaEquipa).toContain("Ao confirmar a folha, concorda com a equipa de 3");
  });

  it("descer de 3 para 2 pode, e a hora nunca passa da acordada", () => {
    const desceu = folha({ inicio: "09:00", fim: "13:00", pessoas: 2 }, ctx({ pessoasEscolhidas: 3, valorPorHoraAcordado: 50 }));
    expect(desceu.conta.horas.precoHoraCent).toBe(4000);
    expect(horaDaFolhaCent(CONGELADA, 2, 2, 35)).toBe(3500);
    expect(horaDaFolhaCent(CONGELADA, 3, 2, 35)).toBe(5500);
  });

  it("sem preço para 3 pessoas, a equipa de 3 recusa-se", () => {
    const sem3 = congelarTarifa({ ...TARIFA, precoHora3: null });
    const r = lerFolha({ inicio: "09:00", fim: "13:00", pessoas: 3 }, ctx({ tarifa: sem3 }), AGORA);
    expect(r.ok).toBe(false);
  });

  it("material que ele não fornece recusa-se", () => {
    const r = lerFolha({ inicio: "09:00", fim: "13:00", materiais: { plasticoBolhaRolos: 1 } }, ctx(), AGORA);
    expect(r.ok).toBe(false);
  });

  it("pausas fora do trabalho, ao mesmo tempo, ou o trabalho todo recusam-se", () => {
    const fora = lerFolha({ inicio: "09:00", fim: "13:00", pausas: [{ inicio: "08:00", fim: "08:30" }] }, ctx(), AGORA);
    const juntas = lerFolha(
      { inicio: "09:00", fim: "13:00", pausas: [{ inicio: "10:00", fim: "11:00" }, { inicio: "10:30", fim: "11:30" }] },
      ctx(),
      AGORA,
    );
    const tudo = lerFolha({ inicio: "09:00", fim: "13:00", pausas: [{ inicio: "09:00", fim: "13:00" }] }, ctx(), AGORA);
    expect(fora.ok).toBe(false);
    expect(juntas.ok).toBe(false);
    expect(tudo.ok).toBe(false);
  });

  it("depois da meia-noite, com uma pausa que a atravessa", () => {
    const f = folha({ dia: "2026-11-11", inicio: "20:00", fim: "01:00", pausas: [{ inicio: "23:30", fim: "00:15" }] });
    expect(f.minutosNoLocal).toBe(300);
    expect(f.minutosTrabalhados).toBe(255);
    expect(f.conta.horas.cobradas).toBe(4.25);
  });

  it("em hora de Lisboa: na noite em que a hora muda, conta-se o tempo verdadeiro", () => {
    // 25-10-2026: às 02:00 de Lisboa os relógios voltam às 01:00 — das 00:30 às 03:30 são 4 h.
    const f = lerFolha({ dia: "2026-10-25", inicio: "00:30", fim: "03:30" }, ctx(), new Date("2026-10-26T12:00:00Z"));
    expect(f.ok).toBe(true);
    if (f.ok) expect(f.folha.minutosNoLocal).toBe(240);
  });

  it("o dinheiro: a taxa efectiva dá ao cêntimo o que a folha disse, pelas contas do pagamento", () => {
    const casos: CorpoDaFolha[] = [
      { inicio: "09:00", fim: "17:30", pausas: [{ inicio: "12:30", fim: "13:00" }], materiais: { filmeRolos: 3, caixas: 10 } },
      { inicio: "08:07", fim: "19:52", materiais: { cartaoMetros: "12,5", filmeRolos: 7 }, km: "93,4", motivoDosKm: "duas viagens" },
      { inicio: "09:00", fim: "10:00" },
      { inicio: "06:00", fim: "23:59", pessoas: 3, materiais: { caixas: 40 } },
    ];
    for (const corpo of casos) {
      const f = folha(corpo);
      const d = dinheiroDaFolha(f);
      const taxas = { cliente: 0, profissional: d.taxaProfissional };
      expect(quantoOProfissionalRecebe(d.valorSemIva, taxas)).toBe(f.conta.profissionalCent / 100);
      expect(contaDoCliente(d.valorSemIva, taxas).total).toBe(f.conta.totalCent / 100);
      expect(d.taxaProfissional).toBeLessThanOrEqual(REGRAS_DAS_MUDANCAS.taxa);
    }
  });

  it("guarda-se e lê-se de volta", () => {
    const f = folha({ inicio: "09:00", fim: "13:00" });
    expect(folhaDeJson(JSON.stringify(f))).toEqual(f);
    expect(folhaDeJson("{}")).toBeNull();
    expect(folhaDeJson(null)).toBeNull();
  });
});

describe("os estados e os prazos (nunca se confirma sozinha)", () => {
  const f = JSON.stringify(folha({ inicio: "09:00", fim: "13:00" }));
  const enviada = new Date("2026-11-12T15:00:00Z");
  const depois = (h: number) => new Date(enviada.getTime() + h * 3_600_000);
  const base = { folhaJson: f, horasMarcadasEm: enviada };

  it("lembretes às 2 h e às 24 h; à Mesa às 48 h", () => {
    expect(passoDaFolha(base, depois(1.9))).toBeNull();
    expect(passoDaFolha(base, depois(2))).toBe("lembrete_2h");
    expect(passoDaFolha({ ...base, folhaLembrete2hEm: depois(2) }, depois(23))).toBeNull();
    expect(passoDaFolha({ ...base, folhaLembrete2hEm: depois(2) }, depois(24))).toBe("lembrete_24h");
    // Uma passagem atrasada não manda os dois de seguida.
    expect(passoDaFolha(base, depois(30))).toBe("lembrete_24h");
    expect(passoDaFolha({ ...base, folhaLembrete2hEm: depois(2), folhaLembrete24hEm: depois(24) }, depois(47))).toBeNull();
    expect(passoDaFolha({ ...base, folhaLembrete24hEm: depois(24) }, depois(48))).toBe("mesa");
    expect(PRAZOS_DA_FOLHA.mesaMs).toBe(48 * 3_600_000);
  });

  it("o estado: enviada, por confirmar às 48 h, contestada, confirmada — e só confirmada com alguém a confirmar", () => {
    expect(estadoDaFolha(base, depois(1))).toBe("enviada");
    expect(estadoDaFolha(base, depois(48))).toBe("por_confirmar");
    expect(estadoDaFolha(base, depois(24 * 30))).toBe("por_confirmar");
    expect(estadoDaFolha({ ...base, horasContestadasEm: depois(3) }, depois(4))).toBe("contestada");
    expect(estadoDaFolha({ ...base, horasConfirmadasEm: depois(3) }, depois(4))).toBe("confirmada");
    for (const h of [0, 2, 24, 48, 24 * 365]) expect(estadoDaFolha(base, depois(h))).not.toBe("confirmada");
  });

  it("confirmada, contestada ou já na Mesa: a rotina não faz nada", () => {
    expect(passoDaFolha({ ...base, horasConfirmadasEm: depois(3) }, depois(50))).toBeNull();
    expect(passoDaFolha({ ...base, horasContestadasEm: depois(3) }, depois(50))).toBeNull();
    expect(passoDaFolha({ ...base, folhaNaMesaEm: depois(48) }, depois(50))).toBeNull();
    expect(passoDaFolha({ horasMarcadasEm: enviada }, depois(50))).toBeNull();
  });

  it("a rotina nunca confirma: só lembra e põe na Mesa", () => {
    const fonte = readFileSync(join(process.cwd(), "src/lib/folha-no-servidor.ts"), "utf8");
    const rotina = fonte.slice(fonte.indexOf("export async function correrARotinaDasFolhas"));
    expect(rotina.length).toBeGreaterThan(100);
    expect(rotina).not.toMatch(/confirmarHorasDoTrabalho|confirmarAsHoras/);
    expect(rotina).toContain("marcarPassoDaFolha");
  });

  it("os prazos contam do instante gravado (base em UTC), não do relógio da máquina", () => {
    const lisboa = instanteEmLisboa("2026-11-12T15:00");
    expect(passoDaFolha({ folhaJson: f, horasMarcadasEm: lisboa }, new Date(lisboa!.getTime() + PRAZOS_DA_FOLHA.primeiroLembreteMs))).toBe("lembrete_2h");
  });
});

describe("as negociações sem tarifa congelada ficam como estavam", () => {
  it("sem tarifa congelada não há contexto da folha", () => {
    expect(contextoDaFolha({ tarifaCongeladaJson: null, pessoasEscolhidas: 2, kmDoPercurso: 10, valorPorHoraAcordado: 40, diaPorOmissao: "2026-11-12" })).toBeNull();
    expect(contextoDaFolha({ tarifaCongeladaJson: "lixo", pessoasEscolhidas: 2, kmDoPercurso: 10, valorPorHoraAcordado: 40, diaPorOmissao: "2026-11-12" })).toBeNull();
  });

  it("o cliente vê as horas de sempre quando não há folha", () => {
    const n = {
      id: 1,
      estado: "acordada",
      valorAcordado: 50,
      porHora: true,
      horasPrevistas: 4,
      taxaCliente: 0.05,
      criadaEm: "2026-11-01T10:00:00Z",
      horas: { horasMarcadasEm: "2026-11-11 10:00:00", horasInicioEm: "2026-11-11 09:00:00", horasFimEm: "2026-11-11 13:00:00", horasFaturadas: 4, valorDasHoras: 200 },
    } as never;
    const h = horasParaOCliente(n, null, true);
    expect(h?.folha).toBeNull();
    expect(h?.titulo).toBe(TITULO_DAS_HORAS);
    expect(h?.botaoConfirmar).toBe(CONFIRMO_AS_HORAS);
  });

  it("a rota das horas só segue pela folha com a tarifa congelada; a confirmação de sempre não mudou", () => {
    const servidor = readFileSync(join(process.cwd(), "src/lib/horas-no-servidor.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(servidor).toMatch(/if \(daFolha && ctx\) \{\n\s+return enviarAFolha\(/);
    const db = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8").replace(/\r\n/g, "\n");
    const confirmar = db.slice(db.indexOf("export async function confirmarHorasDoTrabalho"), db.indexOf("export async function contestarHorasDoTrabalho"));
    expect(confirmar.length).toBeGreaterThan(100);
    // O ramo de sempre: o mesmo UPDATE, sem tocar na taxa.
    expect(confirmar).toContain(
      "      : `UPDATE negociacoes\n        SET horasConfirmadasEm = NOW(), horasConfirmadasPor = ?,\n            valorPorHora = COALESCE(valorPorHora, valorAcordado),\n            valorAcordado = valorDasHoras\n      WHERE",
    );
    // A escrita da folha só pega em negociações com a tarifa congelada.
    const gravar = db.slice(db.indexOf("export async function gravarFolhaDoTrabalho"), db.indexOf("export type FolhaPorResponder"));
    expect(gravar).toContain("AND tarifaCongeladaJson IS NOT NULL");
  });
});

describe("ao cliente diz-se «parceiro»; o que ele recebe fica do lado dele", () => {
  const f = folha({ inicio: "09:00", fim: "10:00", km: "5", motivoDosKm: "na mesma rua", pessoas: 3, materiais: { filmeRolos: 1 } });
  const cliente = folhaNoEcra(f, "cliente", 3);
  const parceiro = folhaNoEcra(f, "parceiro", 3);
  const textos = (e: ReturnType<typeof folhaNoEcra>) =>
    [e.titulo, e.totalTexto, e.avisoDaEquipa ?? "", e.resumo, e.regra, ...e.linhas.flatMap((l) => [l.rotulo, l.valor, l.nota ?? ""])].join(" | ");

  it("o cliente lê «parceiro», nunca «profissional»", () => {
    expect(textos(cliente)).not.toMatch(/profissional/i);
    expect(textos(cliente)).toContain("do parceiro");
  });

  it("a taxa e o que o parceiro recebe não aparecem ao cliente", () => {
    expect(textos(cliente)).not.toMatch(/Recebe|Taxa da plataforma/);
    expect(cliente.recebeTexto).toBeNull();
    expect(textos(parceiro)).toContain("Taxa da plataforma");
    expect(parceiro.recebeTexto).toContain("Recebe");
  });

  it("nunca o sem IVA sozinho", () => {
    expect(cliente.totalTexto).toMatch(/com IVA \(.* sem IVA\)/);
  });
});

describe("o mapa: a morada exacta só depois de contratado", () => {
  const origem = { lat: 38.71, lng: -9.14, morada: "Rua Augusta 1, Lisboa", cidade: "Lisboa" };
  const destino = { lat: 38.67, lng: -9.16, morada: "Rua do Mar 5, Almada", cidade: "Almada" };

  it("só a negociação acordada vê a morada", () => {
    expect(podeVerAMoradaExacta("aberta")).toBe(false);
    expect(podeVerAMoradaExacta("recusada")).toBe(false);
    expect(podeVerAMoradaExacta("acordada")).toBe(true);
  });

  it("antes: as duas cidades, sem traçado nem coordenadas", () => {
    const p = parametrosDoMapa({ exacto: false, origem, destino, polyline: "abc" })!.join("&");
    expect(decodeURIComponent(p)).toContain("Lisboa, Portugal");
    expect(decodeURIComponent(p)).toContain("Almada, Portugal");
    expect(p).not.toContain("path=");
    expect(decodeURIComponent(p)).not.toContain("38.71");
    const l = ligacaoDeDireccoes({ exacto: false, origem, destino })!;
    expect(decodeURIComponent(l)).not.toContain("Rua Augusta");
  });

  it("depois: os pontos e o traçado", () => {
    const p = decodeURIComponent(parametrosDoMapa({ exacto: true, origem, destino, polyline: "_p~iF~ps|U" })!.join("&"));
    expect(p).toContain("38.71,-9.14");
    expect(p).toContain("enc:_p~iF~ps|U");
  });

  it("o bloco do parceiro ignora moradas enquanto não está contratado", () => {
    const antes = percursoParaOParceiro({
      negociacaoId: 7,
      estado: "aberta",
      percurso: { versao: 1, km: 12.3, minutos: 21, polyline: "x", em: "" },
      kmDoPercurso: 12,
      cidadeOrigem: "Lisboa",
      cidadeDestino: "Almada",
      moradaOrigem: "Rua Augusta 1, Lisboa",
      moradaDestino: "Rua do Mar 5, Almada",
    })!;
    expect(antes.exacto).toBe(false);
    expect(JSON.stringify(antes)).not.toContain("Rua Augusta");
    expect(antes.mapa).toBe(caminhoDoMapaDoPercurso(7, false));
    expect(antes.texto).toBe("12,3 km · cerca de 21 min");
    const depois = percursoParaOParceiro({ ...{ negociacaoId: 7, percurso: null, kmDoPercurso: 62, cidadeOrigem: "Lisboa", cidadeDestino: "Setúbal" }, estado: "acordada", moradaOrigem: "Rua Augusta 1, Lisboa", moradaDestino: "Av. Luísa Todi 1, Setúbal" })!;
    expect(depois.exacto).toBe(true);
    expect(decodeURIComponent(depois.direccoes!)).toContain("Rua Augusta 1, Lisboa");
  });

  it("«X km · cerca de Y min»", () => {
    expect(textoDoPercurso(62, 55)).toBe("62 km · cerca de 55 min");
    expect(textoDoPercurso(62, 70)).toBe("62 km · cerca de 1 h 10 min");
    expect(textoDoPercurso(62, null)).toBe("62 km");
  });

  it("a rota do mapa: só o parceiro DESSA negociação, e quem decide a morada é a base", () => {
    const rota = readFileSync(join(process.cwd(), "src/app/api/mapa/route.ts"), "utf8");
    const ramo = rota.slice(rota.indexOf("async function mapaDoPercurso"));
    expect(ramo).toContain("percursoDaNegociacao(negociacaoId, providerId)");
    expect(ramo).toContain("podeVerAMoradaExacta(n.estado)");
    expect(ramo).not.toMatch(/searchParams\.get\("e"\)/);
    expect(rota).toMatch(/if \(percurso != null\) \{\s+if \(!daPlataforma\) return new NextResponse\(null, \{ status: 401 \}\);/);
    const db = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");
    const consulta = db.slice(db.indexOf("export async function percursoDaNegociacao"), db.indexOf("export async function guardarPercursoDoPedido"));
    expect(consulta).toContain("WHERE n.id = ? AND n.providerId = ?");
  });

  it("as moradas do percurso vêm da vista do pedido (que só as dá ao contratado)", () => {
    const rota = readFileSync(join(process.cwd(), "src/app/api/profissionais/meus-pedidos/route.ts"), "utf8");
    expect(rota).toContain("moradaOrigem: (vista.address as string | undefined) ?? null");
    expect(rota).toMatch(/const vista = vistaParaOEstado\(/);
  });
});

describe("as apps fazem a mesma conta", () => {
  it("a app Pro e o painel usam lerFolha do site e enviam pela rota das horas", () => {
    for (const p of ["app-pro/src/componentes/FolhaDaMudanca.tsx", "src/app/profissionais/painel/FolhaDaMudanca.tsx"]) {
      const s = readFileSync(join(process.cwd(), p), "utf8");
      expect(s).toMatch(/import \{[\s\S]*lerFolha[\s\S]*\} from "(\.\.\/\.\.\/\.\.\/src\/lib|@\/lib)\/folha-da-mudanca";/);
      expect(s).toContain("/api/profissionais/trabalho/horas");
      expect(s).toContain("BOTAO_AGORA");
      expect(s).toContain("BOTAO_MAIS_PAUSA");
    }
  });
});
