/**
 * AS HORAS DO TRABALHO, DO LADO DO SERVIDOR — 31-10-2026.
 *
 * As regras e as contas estão em `horas-do-trabalho.ts` (puro); aqui ficam as
 * três escritas e os avisos: marcar (só quem faz o trabalho), confirmar (o
 * cliente, ou a CLYON no backoffice) e contestar (só o cliente). Cada uma
 * escreve no histórico do pedido (início, fim, horas, quem e quando) e no
 * registo, e avisa o outro lado como os outros passos do terreno: push, e
 * WhatsApp ao cliente quando as horas são marcadas.
 */

import { after } from "next/server";
import {
  appendOrderHistory,
  confirmarHorasDoTrabalho,
  contestarHorasDoTrabalho,
  gravarHorasDoTrabalho,
  negociacaoNoTerreno,
  negociacoesDoProfissional,
  registarSemFalhar,
} from "@/lib/db";
import { lerBase } from "@/lib/base-do-preco";
import { podeMostrarConcluir } from "@/lib/viagem-ate-ao-cliente";
import { taxasDaNegociacao } from "@/lib/taxas-plataforma";
import { modeloDaLinha } from "@/lib/sem-factura";
import {
  diaDoInicio,
  horasConfirmadas,
  horasMarcadas,
  intervaloDasHoras,
  lerMotivoDaContestacao,
  podeMarcarHoras,
  resumoDasHoras,
  totalDasHoras,
  valorPorHoraDe,
  type HorasNaBase,
  type ResumoDasHoras,
} from "@/lib/horas-do-trabalho";
import { lerMateriaisDaProposta, lerQuantidadesUsadas, materiaisUsados } from "@/lib/materiais-da-proposta";
import { avisarOClienteDoPedido } from "@/lib/avisos-ao-cliente";
import { avisarProfissional } from "@/lib/avisos-do-backoffice";
import { avisarClienteDasHoras } from "@/lib/avisos-do-terreno";

export type Resposta = { status: number; corpo: Record<string, unknown> };

const falha = (status: number, error: string): Resposta => ({ status, corpo: { ok: false, error } });

type LinhaComHoras = HorasNaBase & {
  valorAcordado?: number | string | null;
  taxaCliente?: unknown;
  taxaProfissional?: unknown;
  semFactura?: unknown;
  createdAt?: Date | string | null;
};

/** O resumo das horas de uma linha da base, com as taxas e o modelo DELA. */
export function resumoDaLinha(l: LinhaComHoras): ResumoDasHoras | null {
  return resumoDasHoras(l, taxasDaNegociacao(l), modeloDaLinha(l, l.createdAt ?? null));
}

/* ── Marcar (quem faz o trabalho) ───────────────────────────────────────── */

export async function marcarHorasPeloProfissional(a: {
  providerId: number;
  nome: string | null;
  corpo: { negociacaoId?: unknown; dia?: unknown; inicio?: unknown; fim?: unknown; materiais?: unknown };
  agora?: Date;
}): Promise<Resposta> {
  const agora = a.agora ?? new Date();
  const negociacaoId = Number(a.corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) return falha(400, "Trabalho não indicado.");

  // O trabalho tem de ser DELE — procura-se só entre os dele.
  const linha = (await negociacoesDoProfissional(a.providerId)).find((l) => l.id === negociacaoId);
  if (!linha) return falha(404, "Trabalho não encontrado.");

  const porHora = lerBase(linha.baseDoPreco) === "hora";
  if (!porHora) return falha(409, "Este trabalho não é por hora: não há horas a marcar.");
  const trabalhoClyon = linha.ofertaClyon != null || linha.valorFixoClyon != null;
  const chegadaOk = podeMostrarConcluir(linha, trabalhoClyon);
  if (
    !podeMarcarHoras({
      porHora,
      estado: linha.estado,
      confirmadoEm: linha.confirmadoEm,
      pagoEm: linha.pagoEm,
      chegadaOk,
      horas: linha,
    })
  ) {
    if (!chegadaOk) return falha(409, "Marque primeiro que chegou, e espere que o cliente o confirme.");
    if (horasConfirmadas(linha)) return falha(409, "As horas já estão confirmadas.");
    return falha(409, "Este trabalho já não está à espera das horas.");
  }

  const dia =
    typeof a.corpo.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.corpo.dia)
      ? a.corpo.dia
      : diaDoInicio(linha.chegouEm, agora);
  const lido = intervaloDasHoras({ dia, inicio: a.corpo.inicio, fim: a.corpo.fim }, agora);
  if (!lido.ok) return falha(400, lido.erro);
  const { intervalo } = lido;

  const valorPorHora = valorPorHoraDe(linha);
  if (valorPorHora == null || valorPorHora <= 0) return falha(409, "Este trabalho não tem valor por hora acordado.");

  const m = lerMateriaisDaProposta(linha.materiaisJson);
  const quantidades = lerQuantidadesUsadas(a.corpo.materiais, m);
  const usados = materiaisUsados(m, quantidades);
  const valorDasHoras = totalDasHoras(valorPorHora, intervalo.horasFaturadas, usados.total);

  const primeiraVez = !horasMarcadas(linha);
  const gravou = await gravarHorasDoTrabalho(negociacaoId, a.providerId, {
    inicioEm: intervalo.inicioEm,
    fimEm: intervalo.fimEm,
    minutos: intervalo.minutos,
    horasFaturadas: intervalo.horasFaturadas,
    valorPorHora,
    valorDasHoras,
    materiaisUsadosJson: Object.keys(quantidades).length > 0 ? JSON.stringify(quantidades) : null,
  });
  if (!gravou) return falha(409, "As horas já não se podem mudar neste trabalho.");

  const marcada: LinhaComHoras = {
    ...(linha as LinhaComHoras),
    horasInicioEm: intervalo.inicioEm,
    horasFimEm: intervalo.fimEm,
    horasMinutos: intervalo.minutos,
    horasFaturadas: intervalo.horasFaturadas,
    valorPorHora,
    valorDasHoras,
    materiaisUsadosJson: Object.keys(quantidades).length > 0 ? JSON.stringify(quantidades) : null,
    horasMarcadasEm: agora,
    horasContestadasEm: null,
    horasContestacao: null,
  };
  const resumo = resumoDaLinha(marcada);
  const quem = (a.nome ?? "").trim() || `Prestador #${a.providerId}`;
  const linhaDaEquipa = `${quem} ${primeiraVez ? "marcou" : "corrigiu"} as horas (negociação #${negociacaoId}): ${resumo?.textoParaAEquipa ?? ""}`;

  await appendOrderHistory(linha.pedidoId, {
    type: "created",
    by: { id: a.providerId, nome: quem, role: "profissional" },
    message: linhaDaEquipa,
  }).catch(() => {});
  await registarSemFalhar({
    acontecimento: "horas_marcadas",
    pedidoId: linha.pedidoId,
    negociacaoId,
    providerId: a.providerId,
    autorTipo: "profissional",
    autorNome: quem,
    valorProfissional: valorDasHoras,
    resumo: linhaDaEquipa,
    detalhe: {
      inicioEm: intervalo.inicioEm.toISOString(),
      fimEm: intervalo.fimEm.toISOString(),
      minutos: intervalo.minutos,
      horasFaturadas: intervalo.horasFaturadas,
      valorPorHora,
      materiais: quantidades,
    },
  });

  after(async () => {
    await avisarOClienteDoPedido(linha.pedidoId, "horas", { nome: a.nome, negociacaoId });
    if (!trabalhoClyon && resumo) {
      const n = await negociacaoNoTerreno(negociacaoId).catch(() => null);
      if (n) await avisarClienteDasHoras(n, resumo.textoParaOCliente, agora);
    }
  });

  return {
    status: 200,
    corpo: { ok: true, primeiraVez, horas: resumo, mensagem: resumo?.textoParaQuemFez ?? null },
  };
}

/* ── Confirmar (o cliente, ou a CLYON) ──────────────────────────────────── */

export async function confirmarAsHoras(a: {
  negociacaoId: number;
  pedidoId: number;
  providerId: number;
  por: "cliente" | "clyon";
  /** «pelo link do pedido», «na app», «no backoffice por Ana»… */
  onde: string;
  autorNome: string | null;
  linha: LinhaComHoras;
}): Promise<Resposta> {
  if (!horasMarcadas(a.linha)) return falha(409, "Ainda não há horas marcadas neste trabalho.");
  if (horasConfirmadas(a.linha)) return falha(409, "As horas já estão confirmadas.");
  const gravou = await confirmarHorasDoTrabalho(a.negociacaoId, a.pedidoId, a.por);
  if (!gravou) return falha(409, "As horas já não estão à espera de confirmação.");

  const resumo = resumoDaLinha({ ...a.linha, horasConfirmadasEm: new Date(), horasConfirmadasPor: a.por, valorAcordado: a.linha.valorDasHoras });
  const frase =
    `Horas confirmadas ${a.por === "clyon" ? "pela CLYON" : "pelo cliente"} (negociação #${a.negociacaoId}, ${a.onde}): ` +
    `${resumo?.textoParaAEquipa ?? ""} Passa a ser o valor do trabalho.`;
  await appendOrderHistory(a.pedidoId, { type: "created", by: null, message: frase }).catch(() => {});
  await registarSemFalhar({
    acontecimento: "horas_confirmadas",
    pedidoId: a.pedidoId,
    negociacaoId: a.negociacaoId,
    providerId: a.providerId,
    autorTipo: a.por === "clyon" ? "clyon" : "cliente",
    autorNome: a.autorNome,
    valorProfissional: resumo?.total ?? null,
    resumo: frase,
  });
  after(() => avisarProfissional(a.providerId, a.por === "clyon" ? "horas_confirmadas_pela_clyon" : "horas_confirmadas", {
    pedidoId: a.pedidoId,
    negociacaoId: a.negociacaoId,
  }));
  return { status: 200, corpo: { ok: true, horasConfirmadas: true } };
}

/* ── Contestar (só o cliente) ───────────────────────────────────────────── */

export async function contestarAsHoras(a: {
  negociacaoId: number;
  pedidoId: number;
  providerId: number;
  motivo: unknown;
  onde: string;
  autorNome: string | null;
  linha: LinhaComHoras;
}): Promise<Resposta> {
  const lido = lerMotivoDaContestacao(a.motivo);
  if (!lido.ok) return falha(400, lido.erro);
  if (!horasMarcadas(a.linha)) return falha(409, "Ainda não há horas marcadas neste trabalho.");
  if (horasConfirmadas(a.linha)) return falha(409, "As horas já estão confirmadas.");
  const gravou = await contestarHorasDoTrabalho(a.negociacaoId, a.pedidoId, lido.motivo);
  if (!gravou) return falha(409, "As horas já não estão à espera de confirmação.");

  const frase = `O cliente não concorda com as horas (negociação #${a.negociacaoId}, ${a.onde}): «${lido.motivo}». Vai à Mesa.`;
  await appendOrderHistory(a.pedidoId, { type: "created", by: null, message: frase }).catch(() => {});
  await registarSemFalhar({
    acontecimento: "horas_contestadas",
    pedidoId: a.pedidoId,
    negociacaoId: a.negociacaoId,
    providerId: a.providerId,
    autorTipo: "cliente",
    autorNome: a.autorNome,
    resumo: frase,
  });
  after(() => avisarProfissional(a.providerId, "horas_contestadas", { pedidoId: a.pedidoId, negociacaoId: a.negociacaoId }));
  return { status: 200, corpo: { ok: true, horasContestadas: true } };
}
