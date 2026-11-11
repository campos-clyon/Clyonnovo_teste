/**
 * A FOLHA DA MUDANÇA, DO LADO DO SERVIDOR — 11-11-2026.
 *
 * As regras e a conta estão em `folha-da-mudanca.ts` (puro). Aqui: enviar a
 * folha (só o parceiro, na negociação DELE), o que a confirmação e o «Não
 * concordo» gravam a mais (a taxa efectiva e o histórico), e a rotina dos
 * lembretes (2 h e 24 h) e da Mesa (48 h). Chamado por `horas-no-servidor.ts`
 * — as portas de sempre (a rota das horas, `agirComoCliente`, o backoffice).
 */

import { after } from "next/server";
import {
  appendOrderHistory,
  folhaDaNegociacao,
  folhasPorResponder,
  gravarFolhaDoTrabalho,
  gravarRascunhoDaFolha,
  marcarPassoDaFolha,
  negociacaoNoTerreno,
  registarSemFalhar,
  type FolhaDaNegociacaoNaBase,
} from "@/lib/db";
import {
  contextoDaFolha,
  dinheiroDaFolha,
  edicaoDaFolha,
  folhaDeJson,
  folhaNoEcra,
  FOLHA_IGUAL_A_CONTESTADA,
  lerFolha,
  lerRascunhoDaFolha,
  mesmaFolha,
  passoDaFolha,
  resumoDaFolha,
  subiuAEquipa,
  type ContextoDaFolha,
  type CorpoDaFolha,
  type FolhaDaMudanca,
  type PassoDaFolha,
} from "@/lib/folha-da-mudanca";
import { diaDoInicio, horasMarcadas, valorPorHoraDe, type HorasNaBase } from "@/lib/horas-do-trabalho";
import { taxasDaNegociacao } from "@/lib/taxas-plataforma";
import { avisarOClienteDoPedido } from "@/lib/avisos-ao-cliente";
import { avisarClienteDasHoras } from "@/lib/avisos-do-terreno";
import { marcaDaFolha } from "@/lib/o-que-o-cliente-viu";

export type Resposta = { status: number; corpo: Record<string, unknown> };
const falha = (status: number, error: string, campo?: string): Resposta => ({ status, corpo: { ok: false, error, ...(campo ? { campo } : {}) } });

/** O contexto da folha de uma negociação (tarifa, equipa, km, hora acordada). Null fora das mudanças com a lista. */
export function contextoDaLinha(
  f: Pick<FolhaDaNegociacaoNaBase, "tarifaCongeladaJson" | "pessoasEscolhidas" | "kmPercurso">,
  linha: HorasNaBase & { valorAcordado?: number | string | null; chegouEm?: Date | string | null },
  agora: Date = new Date(),
): ContextoDaFolha | null {
  return contextoDaFolha({
    tarifaCongeladaJson: f.tarifaCongeladaJson,
    pessoasEscolhidas: f.pessoasEscolhidas,
    kmDoPercurso: f.kmPercurso,
    valorPorHoraAcordado: valorPorHoraDe(linha),
    diaPorOmissao: diaDoInicio(linha.chegouEm ?? null, agora),
  });
}

/**
 * ENVIA A FOLHA — o parceiro, depois do «Cheguei» confirmado (quem chama já o
 * conferiu, como para as horas). Grava as horas nas colunas de sempre (o fim
 * do trabalho e o dinheiro lêem-nas), a folha e a linha do histórico; avisa o
 * cliente. Corrigir é enviar outra vez.
 */
export async function enviarAFolha(a: {
  providerId: number;
  nome: string | null;
  negociacaoId: number;
  pedidoId: number;
  folhaNaBase: FolhaDaNegociacaoNaBase;
  ctx: ContextoDaFolha;
  linha: HorasNaBase;
  corpo: CorpoDaFolha;
  agora?: Date;
}): Promise<Resposta> {
  const agora = a.agora ?? new Date();
  const lida = lerFolha(a.corpo, a.ctx, agora);
  if (!lida.ok) return falha(400, lida.erro, lida.campo);
  const folha = lida.folha;
  /*
   * DEPOIS DE UM «NÃO CONCORDO», A MESMA FOLHA NÃO VOLTA (11-11-2026): reenviar
   * limpa a contestação e recomeça os lembretes ao cliente — só com uma folha
   * diferente. Igual, fica como está, à espera da CLYON.
   */
  const contestada = folhaDeJson(a.folhaNaBase.folhaJson ?? null);
  if (a.folhaNaBase.horasContestadasEm != null && contestada && mesmaFolha(contestada, folha)) {
    return falha(409, FOLHA_IGUAL_A_CONTESTADA);
  }
  const primeiraVez = !horasMarcadas(a.linha);
  const resumo = resumoDaFolha(folha);
  const edicao = edicaoDaFolha(primeiraVez ? "enviada" : "corrigida", "parceiro", resumo, agora);

  const gravou = await gravarFolhaDoTrabalho(a.negociacaoId, a.providerId, {
    inicioEm: new Date(folha.inicioEm),
    fimEm: new Date(folha.fimEm),
    minutos: folha.minutosTrabalhados,
    horasFaturadas: folha.conta.horas.cobradas,
    valorPorHora: folha.horaCent / 100,
    valorDasHoras: folha.conta.semIvaCent / 100,
    folhaJson: JSON.stringify(folha),
    edicao,
  });
  if (!gravou) return falha(409, "A folha já não se pode mudar neste trabalho.");

  const quem = (a.nome ?? "").trim() || `Prestador #${a.providerId}`;
  const linhaDaEquipa =
    `${quem} ${primeiraVez ? "enviou" : "corrigiu"} a folha da mudança (negociação #${a.negociacaoId}): ${resumo}` +
    (folha.motivoDosKm ? ` Km corrigidos: «${folha.motivoDosKm}».` : "") +
    (subiuAEquipa(folha) ? ` A equipa subiu de ${folha.pessoasEscolhidas} para ${folha.pessoas}.` : "");
  await appendOrderHistory(a.pedidoId, {
    type: "created",
    by: { id: a.providerId, nome: quem, role: "profissional" },
    message: linhaDaEquipa,
  }).catch(() => {});
  await registarSemFalhar({
    acontecimento: "horas_marcadas",
    pedidoId: a.pedidoId,
    negociacaoId: a.negociacaoId,
    providerId: a.providerId,
    autorTipo: "profissional",
    autorNome: quem,
    valorProfissional: folha.conta.semIvaCent / 100,
    resumo: linhaDaEquipa,
    detalhe: { folha: { ...folha, conta: { semIvaCent: folha.conta.semIvaCent, totalCent: folha.conta.totalCent, profissionalCent: folha.conta.profissionalCent } } },
  });

  after(async () => {
    await avisarOClienteDoPedido(a.pedidoId, "folha", { nome: a.nome, negociacaoId: a.negociacaoId });
    const n = await negociacaoNoTerreno(a.negociacaoId).catch(() => null);
    if (n) await avisarClienteDasHoras(n, `a folha da mudança: ${resumo}`, agora);
  });

  const ecra = folhaNoEcra(folha, "parceiro", a.ctx.tarifa.minimoHoras);
  return {
    status: 200,
    corpo: { ok: true, primeiraVez, folha: ecra, mensagem: `${ecra.resumo} ${ecra.recebeTexto ?? ""}`.trim() },
  };
}

/**
 * O QUE A CONFIRMAÇÃO GRAVA A MAIS numa folha: a taxa efectiva (o material
 * não leva taxa) e a linha do histórico. Null quando a negociação não tem
 * folha — e então a confirmação é a de sempre. Numa negociação com taxa do
 * cliente (não devia haver nesta porta) também null: a conta efectiva só
 * fecha com a taxa do cliente a 0.
 */
export async function extraDaConfirmacao(
  negociacaoId: number,
  por: "cliente" | "clyon",
  onde: string,
  agora: Date = new Date(),
): Promise<{ taxaProfissional: number; edicao: unknown; folha: FolhaDaMudanca; folhaJson: string; marca: string } | null> {
  const f = await folhaDaNegociacao(negociacaoId).catch(() => null);
  const folha = folhaDeJson(f?.folhaJson ?? null);
  if (!f || !folha) return null;
  if (taxasDaNegociacao(f).cliente !== 0) return null;
  const d = dinheiroDaFolha(folha);
  const quem = por === "clyon" ? "pela CLYON" : "pelo cliente";
  const equipa = subiuAEquipa(folha) ? ` Concordou com a equipa de ${folha.pessoas}.` : "";
  return {
    taxaProfissional: d.taxaProfissional,
    edicao: edicaoDaFolha("confirmada", por, `${quem}, ${onde}.${equipa}`, agora),
    folha,
    // A folha tal como está gravada: a confirmação só passa se ainda for esta (o-que-o-cliente-viu.ts).
    folhaJson: String(f.folhaJson),
    marca: marcaDaFolha(String(f.folhaJson)) as string,
  };
}

/** A linha do histórico do «Não concordo», numa folha (null sem folha). */
export async function edicaoDaContestacao(negociacaoId: number, motivo: string, onde: string, agora: Date = new Date()): Promise<unknown | null> {
  const f = await folhaDaNegociacao(negociacaoId).catch(() => null);
  if (!f || !folhaDeJson(f.folhaJson ?? null)) return null;
  return edicaoDaFolha("contestada", "cliente", `«${motivo}» (${onde})`, agora);
}

/**
 * A CLYON CORRIGE A FOLHA no backoffice («Corrigir e confirmar»): parte da
 * folha que o parceiro enviou e muda o que vier (início, fim, pausas, equipa,
 * km, material), com a mesma conta. Devolve null quando a negociação não tem
 * folha — e o backoffice corrige as horas como sempre.
 */
export async function corrigirAFolhaPelaClyon(a: {
  negociacaoId: number;
  providerId: number;
  linha: HorasNaBase & { valorAcordado?: number | string | null; chegouEm?: Date | string | null };
  corpo: CorpoDaFolha;
  porQuem: string;
  agora?: Date;
}): Promise<Resposta | null> {
  const agora = a.agora ?? new Date();
  const daFolha = await folhaDaNegociacao(a.negociacaoId);
  const ctx = daFolha ? contextoDaLinha(daFolha, a.linha, agora) : null;
  if (!daFolha || !ctx) return null;
  const antes = folhaDeJson(daFolha.folhaJson);
  const base: CorpoDaFolha = antes
    ? { dia: antes.dia, inicio: antes.inicio, fim: antes.fim, pausas: antes.pausas, pessoas: antes.pessoas, km: antes.km, motivoDosKm: antes.motivoDosKm, materiais: antes.materiais }
    : {};
  const corpo: CorpoDaFolha = { ...base };
  for (const k of ["dia", "inicio", "fim", "pausas", "pessoas", "km", "motivoDosKm", "materiais"] as const) {
    const v = a.corpo[k];
    if (v === undefined || v === null || v === "") continue;
    // Um objecto vazio (o material de antes) não apaga o material da folha.
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
    corpo[k] = v;
  }
  // A CLYON corrige ao falar com os dois: os km diferentes levam o motivo dela.
  if (corpo.motivoDosKm == null || corpo.motivoDosKm === "") corpo.motivoDosKm = `corrigido pela CLYON (${a.porQuem})`;
  const lida = lerFolha(corpo, ctx, agora);
  if (!lida.ok) return falha(400, lida.erro, lida.campo);
  const folha = lida.folha;
  const folhaJson = JSON.stringify(folha);
  const gravou = await gravarFolhaDoTrabalho(a.negociacaoId, a.providerId, {
    inicioEm: new Date(folha.inicioEm),
    fimEm: new Date(folha.fimEm),
    minutos: folha.minutosTrabalhados,
    horasFaturadas: folha.conta.horas.cobradas,
    valorPorHora: folha.horaCent / 100,
    valorDasHoras: folha.conta.semIvaCent / 100,
    folhaJson,
    edicao: edicaoDaFolha("corrigida", "clyon", `${resumoDaFolha(folha)} (por ${a.porQuem})`, agora),
  });
  if (!gravou) return falha(409, "A folha já não se pode mudar.");
  // A marca da folha que a CLYON acabou de escrever: é essa que ela confirma a seguir.
  return { status: 200, corpo: { ok: true, valorDasHoras: folha.conta.semIvaCent / 100, marca: marcaDaFolha(folhaJson) } };
}

/* ── O rascunho: guarda-se sem avisar ninguém ───────────────────────────── */

/**
 * GUARDA O RASCUNHO DA FOLHA (11-11-2026) — o parceiro, na negociação DELE
 * (quem chama já conferiu que é dele, por hora e com tarifa congelada). Só
 * horas e quantidades, podem estar a meio. Não escreve no histórico do pedido,
 * não muda a folha enviada nem os lembretes, e NÃO AVISA O CLIENTE: o cliente
 * só sabe da folha quando ela é enviada.
 */
export async function guardarRascunhoDaFolha(a: {
  providerId: number;
  negociacaoId: number;
  corpo: CorpoDaFolha;
  agora?: Date;
}): Promise<Resposta> {
  const rascunho = lerRascunhoDaFolha(a.corpo, a.agora ?? new Date());
  const gravou = await gravarRascunhoDaFolha(a.negociacaoId, a.providerId, JSON.stringify(rascunho));
  if (!gravou) return falha(409, "A folha já não se pode mudar neste trabalho.");
  return { status: 200, corpo: { ok: true, rascunho: true, folhaRascunho: rascunho } };
}

/* ── A rotina: lembretes às 2 h e às 24 h, e a Mesa às 48 h ────────────── */

export type ResultadoDaRotinaDaFolha = { lembretes: number; mesa: number; falhados: number };

const TEXTO_DO_PASSO: Record<PassoDaFolha, string> = {
  lembrete_2h: "a folha da mudança espera pela sua confirmação.",
  lembrete_24h: "a folha da mudança continua à espera da sua confirmação.",
  mesa: "",
};

export async function correrARotinaDasFolhas(agora: Date = new Date()): Promise<ResultadoDaRotinaDaFolha> {
  const r: ResultadoDaRotinaDaFolha = { lembretes: 0, mesa: 0, falhados: 0 };
  for (const l of await folhasPorResponder()) {
    const passo = passoDaFolha(l, agora);
    if (!passo) continue;
    try {
      const texto = passo === "mesa" ? "48 h sem resposta do cliente. A folha nunca se confirma sozinha." : "Sem resposta do cliente.";
      const marcou = await marcarPassoDaFolha(l.id, passo, edicaoDaFolha(passo, "sistema", texto, agora));
      if (!marcou) continue; // outra passagem já o fez
      if (passo === "mesa") {
        r.mesa++;
        await appendOrderHistory(l.pedidoId, {
          type: "created",
          by: null,
          message: `Folha por confirmar (negociação #${l.id}): 48 h sem resposta do cliente. Vai à Mesa — a folha nunca se confirma sozinha.`,
        }).catch(() => {});
        continue;
      }
      r.lembretes++;
      await avisarOClienteDoPedido(l.pedidoId, "folha_lembrete", { negociacaoId: l.id });
      const n = await negociacaoNoTerreno(l.id).catch(() => null);
      const f = folhaDeJson(l.folhaJson);
      if (n && f) await avisarClienteDasHoras(n, `${TEXTO_DO_PASSO[passo]} ${resumoDaFolha(f)}`, agora);
    } catch (e) {
      r.falhados++;
      console.error("[folhas por confirmar]", l.id, e instanceof Error ? e.message : e);
    }
  }
  return r;
}

export function resumoDaRotinaDasFolhas(r: ResultadoDaRotinaDaFolha): string {
  return `Folhas da mudança: ${r.lembretes} lembrete(s) ao cliente, ${r.mesa} à Mesa${r.falhados ? `, ${r.falhados} falhada(s)` : ""}.`;
}
