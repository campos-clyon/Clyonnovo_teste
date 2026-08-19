"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, History, MapPin, MessageCircle, Send, Star, Image as ImageIcon, Zap, Building2, Car, Route } from "lucide-react";
import StatusBadge from "./StatusBadge";
import {
  SERVICE_LABELS,
  estadoNaPlataforma,
  type Order,
  type OrderHistoryEntry,
} from "./types";
import PropostasRecebidas, {
  type NegociacaoDoCliente,
} from "@/app/pedido/[token]/PropostasRecebidas";
import { BUSINESS_PHONE } from "@/lib/seo-data";
import { tElevator, tParking, tUrgency, tFloor } from "@/lib/translations";
import { faseDoTrabalho, diasAteLibertar } from "@/lib/trabalho";

function parseFilesUrls(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((f: any) => (typeof f === "string" ? f : (f?.url ?? "")))
      .filter((u: string) => typeof u === "string" && u.length > 0);
  } catch { return []; }
}


function toWhatsAppNumber(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

/**
 * A morada, sem repetir o que já lá está.
 *
 * Juntava-se `address`, `city` e `postalCode` com vírgulas, às cegas. Como a
 * morada escolhida na pesquisa já traz a localidade e o país, saía coisas como
 * "…Marvila, Lisboa, Portugal, Gauchy" — com o `Gauchy` vindo do selector de
 * localização do cabeçalho, que era outro problema, mas mesmo com a cidade
 * certa saía "Lisboa, Portugal, Lisboa".
 */
function moradaCompleta(
  morada: string | null | undefined,
  cidade: string | null | undefined,
  codigoPostal: string | null | undefined,
): string {
  const base = (morada ?? "").trim();
  const partes = [base];

  const jaContem = (valor: string) =>
    base.toLowerCase().includes(valor.trim().toLowerCase());

  if (cidade?.trim() && !jaContem(cidade)) partes.push(cidade.trim());
  if (codigoPostal?.trim() && !jaContem(codigoPostal)) partes.push(codigoPostal.trim());

  return partes.filter(Boolean).join(", ");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/** As propostas gravadas, na forma que o motor de negociação entende. */
function parseHistoryLike(json: string | null): never[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as never[]) : [];
  } catch {
    return [];
  }
}

function parseHistory(json: string | null): OrderHistoryEntry[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// Só entradas relevantes para o cliente aparecem como conversa
const CONVERSATION_TYPES = new Set(["info_requested", "client_reply", "message_to_client"]);

interface Props {
  order: Order;
  onClose: () => void;
  onOrderChange?: (updated: Partial<Order>) => void;
}

export default function OrderDetailModal({ order, onClose, onOrderChange }: Props) {
  /*
   * O valor que manda é o acordado, quando existe.
   *
   * O cabeçalho continuava a mostrar a estimativa — 741,99 € — enquanto o
   * bloco do acordo, três centímetros abaixo, dizia "Total a pagar 636,00 €".
   * Dois números no mesmo ecrã para a mesma pergunta, e o mais visível era o
   * que já não valia.
   */
  const naPlataforma = estadoNaPlataforma(order);
  const preco =
    naPlataforma.valor ?? order.precoFinalIva ?? order.precoFinal ?? order.estimateTotal;
  const precoEAcordado = naPlataforma.legenda === "acordado";

  // O detalhe já não é uma sobreposição: bloquear o scroll da página aqui
  // deixava-a presa com o conteúdo à vista e sem forma de o rolar.
  //
  // Abrir um pedido leva ao topo. Quem carrega num pedido a meio da lista
  // aterrava a meio do detalhe, sem perceber que a página tinha mudado.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [order.id]);

  const [rating, setRating] = useState<number | null>(order.clientRating);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [ratingError, setRatingError] = useState("");

  const [historyJson, setHistoryJson] = useState<string | null>(order.historyJson);
  const [reply, setReply] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState("");

  /**
   * Tudo o que aconteceu ao pedido, tirando a conversa — essa tem secção
   * própria em cima e apareceria duas vezes.
   *
   * Do mais antigo para o mais recente: é uma história, e uma história lê-se
   * pelo princípio. As mensagens são o contrário, porque aí o que interessa é
   * a última.
   */
  /**
   * As negociações na forma que o componente das propostas entende.
   *
   * A conversão vive aqui e não na API: a API devolve a linha da base tal como
   * está, e quem a desenha decide o que dela precisa. Duas formas do mesmo
   * objecto acabam por divergir — e a que diverge é sempre a que ninguém está
   * a olhar.
   */
  const propostas: NegociacaoDoCliente[] = useMemo(
    () =>
      (order.negociacoes ?? []).map((n) => ({
        id: n.id,
        estado: n.estado,
        valorAcordado: n.valorAcordado != null ? Number(n.valorAcordado) : null,
        propostas: parseHistoryLike(n.propostasJson),
        profissionalNome: n.profissionalNome,
        profissionalTelefone: n.profissionalTelefone,
        emiteFatura: Number(n.emiteFatura) === 1,
        regimeIva: String(n.regimeIva ?? "isento"),
        guiaVerificada: n.guiaVerificadaEm != null,
        fase: faseDoTrabalho({
          estado: n.estado,
          execucaoEnviadaEm: n.execucaoEnviadaEm,
          confirmadoEm: n.confirmadoEm,
          pagoEm: n.pagoEm,
        }),
        provaJson: n.provaJson,
        estrelas: n.estrelas ?? null,
        diasAteLibertar: diasAteLibertar(
          {
            estado: n.estado,
            execucaoEnviadaEm: n.execucaoEnviadaEm,
            confirmadoEm: n.confirmadoEm,
            pagoEm: n.pagoEm,
          },
          new Date(),
        ),
      })),
    [order.negociacoes],
  );

  const historico = useMemo(
    () =>
      parseHistory(historyJson)
        .filter((e) => !CONVERSATION_TYPES.has(e.type))
        .sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    [historyJson],
  );

  const conversation = useMemo(() =>
    parseHistory(historyJson).filter((e) => CONVERSATION_TYPES.has(e.type)),
    [historyJson]
  );

  const professionalName = order.providerName ?? order.assignedToName;
  const supportWhatsapp = `https://wa.me/${toWhatsAppNumber(BUSINESS_PHONE)}?text=${encodeURIComponent(
    `Olá! Sobre o pedido #${order.id}, gostava de falar com quem está a tratar do meu serviço.`,
  )}`;
  const swapWhatsapp = `https://wa.me/${toWhatsAppNumber(BUSINESS_PHONE)}?text=${encodeURIComponent(
    `Olá! Gostava de pedir a troca do profissional atribuído ao pedido #${order.id}.`,
  )}`;
  const professionalWhatsapp = order.providerPhone
    ? `https://wa.me/${toWhatsAppNumber(order.providerPhone)}?text=${encodeURIComponent(
        `Olá! Sou cliente CLYON, pedido #${order.id}.`,
      )}`
    : supportWhatsapp;

  async function handleRate(stars: number) {
    setRatingSaving(true);
    setRatingError("");
    try {
      const res = await fetch(`/api/users/me/orders/${order.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: stars }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Erro ao guardar avaliação");
      setRating(stars);
      onOrderChange?.({ clientRating: stars });
    } catch (err: any) {
      setRatingError(err.message ?? "Erro ao guardar avaliação");
    } finally {
      setRatingSaving(false);
    }
  }

  async function handleSendReply() {
    const msg = reply.trim();
    if (!msg) return;
    setReplySending(true);
    setReplyError("");
    try {
      const res = await fetch(`/api/users/me/orders/${order.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Erro ao enviar resposta");
      setHistoryJson(data?.historyJson ?? historyJson);
      onOrderChange?.({ historyJson: data?.historyJson ?? historyJson });
      setReply("");
    } catch (err: any) {
      setReplyError(err.message ?? "Erro ao enviar resposta");
    } finally {
      setReplySending(false);
    }
  }

  /*
   * O detalhe abre NA ÁREA DE CONTEÚDO, e não por cima de tudo.
   *
   * Esteve como caixa ao centro, e depois como painel a cobrir o ecrã inteiro.
   * Nenhum dos dois é o que esta página é: à esquerda fica o menu, à direita
   * abre-se o que se escolheu — o mesmo gesto do backoffice, e o mesmo que o
   * resto da conta já faz. Uma sobreposição tapava o menu e obrigava a fechar
   * para voltar a ver onde se estava.
   *
   * A seta para trás substitui o X: não se está a fechar uma janela, está-se a
   * voltar à lista.
   */
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Voltar aos pedidos"
              className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  {SERVICE_LABELS[order.serviceType] ?? order.serviceType}
                </h2>
                <StatusBadge status={order.status} />
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                Pedido #{order.id} · Criado a {formatDate(order.createdAt)}
              </p>
            </div>
          </div>

          {/* O valor no topo, e não numa linha no fim. É a primeira coisa que
              se procura ao abrir um pedido — tê-la a seguir a três ecrãs de
              rolo era escondê-la. */}
          {preco != null ? (
            <div className="text-right">
              <div className="text-xl font-bold leading-none text-slate-900">
                {Number(preco).toFixed(2)} €
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {precoEAcordado ? "total a pagar" : "sem IVA"}
              </div>
            </div>
          ) : order.estimateMin != null && order.estimateMax != null ? (
            <div className="text-right">
              <div className="text-xl font-bold leading-none text-slate-900">
                {Number(order.estimateMin).toFixed(0)}–{Number(order.estimateMax).toFixed(0)} €
              </div>
              <div className="mt-1 text-[11px] text-slate-400">estimativa</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-5 text-sm">
        {/* ── As propostas ─────────────────────────────────────────────────
            Estavam apenas no link do email. Quem tem conta não devia ter de
            ir procurar uma mensagem antiga para responder a alguém que já lhe
            respondeu — os pedidos estão aqui, e é aqui que a resposta faz
            sentido. É a mesma negociação e o mesmo motor; muda só como se
            prova quem está a falar. */}
        {propostas.length > 0 && (
          <PropostasRecebidas
            pedidoId={order.id}
            negociacoesIniciais={propostas}
            onMudou={() => onOrderChange?.({})}
          />
        )}

          {/* Grelha de detalhes principais. Em ecrã largo cabem três colunas —
              é para isso que serve o espaço que o painel ganhou. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {order.address && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <MapPin className="h-3.5 w-3.5" /> Morada
                </div>
                <p className="mt-1 text-sm text-slate-800">
                  {moradaCompleta(order.address, order.city, order.postalCode)}
                </p>
              </div>
            )}
            {order.urgency && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Zap className="h-3.5 w-3.5" /> Urgência
                </div>
                <p className="mt-1 text-sm text-slate-800">
                  {tUrgency(order.urgency)}
                </p>
              </div>
            )}
            {order.floor && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Building2 className="h-3.5 w-3.5" /> Andar
                </div>
                <p className="mt-1 text-sm text-slate-800">
                  {tFloor(order.floor)}
                  {order.hasElevator && (
                    <span className="ml-1.5 text-xs text-slate-500">· {tElevator(order.hasElevator)}</span>
                  )}
                </p>
              </div>
            )}
            {order.parkingDistance && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Car className="h-3.5 w-3.5" /> Estacionamento
                </div>
                <p className="mt-1 text-sm text-slate-800">
                  {tParking(order.parkingDistance)}
                </p>
              </div>
            )}
            {order.distanceKm != null && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Route className="h-3.5 w-3.5" /> Distância
                </div>
                <p className="mt-1 text-sm text-slate-800">
                  {Number(order.distanceKm).toFixed(1)} km
                  {order.distanceText && <span className="ml-1.5 text-xs text-slate-500">· {order.distanceText}</span>}
                </p>
              </div>
            )}
            {order.recurrenceFrequency && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Recorrência</div>
                <p className="mt-1 text-sm text-emerald-800">
                  {order.recurrenceFrequency === "semanal" ? "Semanal" : "Quinzenal"}
                  {order.recurringDiscountPercent != null && (
                    <span className="ml-1.5 text-xs">· desconto {order.recurringDiscountPercent}%</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {order.description && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descrição</div>
              <p className="mt-1 text-sm text-slate-800 whitespace-pre-line">{order.description}</p>
            </div>
          )}

          {/* Fotos enviadas */}
          {(() => {
            const urls = parseFilesUrls(order.filesJson);
            if (urls.length === 0) return null;
            return (
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <ImageIcon className="h-3.5 w-3.5" /> Fotos enviadas ({urls.length})
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {urls.map((u, i) => {
                    const isVid = /\.(mp4|mov|webm|avi)$/i.test(u);
                    return isVid ? (
                      <video key={i} src={u} className="aspect-square w-full rounded-lg object-cover" controls />
                    ) : (
                      <a key={i} href={u} target="_blank" rel="noreferrer" className="group relative block aspect-square overflow-hidden rounded-lg">
                        <img src={u} alt={`Foto ${i + 1}`} className="h-full w-full object-cover transition group-hover:scale-105" />
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {order.scheduledDate && (
            <div className="flex items-center gap-1.5 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2 text-sm text-violet-800">
              <CalendarDays className="h-4 w-4" />
              Agendado para{" "}
              <span className="font-semibold">
                {new Date(order.scheduledDate).toLocaleDateString("pt-PT", {
                  weekday: "long", day: "2-digit", month: "long",
                })}
                {order.scheduledStartTime ? ` às ${order.scheduledStartTime}` : ""}
              </span>
            </div>
          )}

          {/* ── Conversa cliente ↔ assistente ── */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#0077B6]" />
              <p className="text-xs font-semibold text-slate-700">Mensagens</p>
            </div>
            {conversation.length === 0 && !order.mensagemCliente ? (
              <p className="text-xs text-slate-400">Ainda não há mensagens neste pedido.</p>
            ) : (
              <ul className="space-y-2">
                {order.mensagemCliente && conversation.length === 0 && (
                  <li className="rounded-lg bg-white p-2.5 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Equipa CLYON</p>
                    <p className="mt-0.5 text-sm text-slate-700 whitespace-pre-line">{order.mensagemCliente}</p>
                  </li>
                )}
                {conversation.map((e, i) => {
                  const isClient = e.type === "client_reply";
                  return (
                    <li
                      key={i}
                      className={`rounded-lg p-2.5 shadow-sm ${isClient ? "ml-6 bg-blue-50" : "mr-6 bg-white"}`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {isClient ? "Tu" : (e.by?.nome ?? "Equipa CLYON")}
                        <span className="ml-1 text-slate-300 normal-case tracking-normal">· {formatDateTime(e.createdAt)}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-slate-700 whitespace-pre-line">{e.message}</p>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Escreve uma resposta ou pergunta à equipa..."
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0077B6] focus:outline-none focus:ring-2 focus:ring-[#0077B6]/20"
              />
              <div className="mt-1.5 flex items-center justify-between gap-3">
                {replyError ? (
                  <p className="text-xs text-red-500 flex-1 truncate">{replyError}</p>
                ) : <span />}
                <button
                  type="button"
                  disabled={replySending || !reply.trim()}
                  onClick={handleSendReply}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077B6] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#005f96] disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  {replySending ? "A enviar..." : "Enviar"}
                </button>
              </div>
            </div>
          </div>

          {professionalName && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">Profissional atribuído</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{professionalName}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={professionalWhatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1ebe5d]"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Contactar
                </a>
                <a
                  href={swapWhatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Pedir troca
                </a>
              </div>
            </div>
          )}

          {order.status === "concluido" && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">
                {rating ? "A sua avaliação" : "Como correu o serviço?"}
              </p>
              <div className="mt-1.5 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    disabled={ratingSaving || rating != null}
                    onClick={() => handleRate(star)}
                    className="disabled:cursor-default"
                  >
                    <Star
                      className={`h-5 w-5 ${
                        rating != null && star <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {ratingError && <p className="mt-1 text-xs text-red-500">{ratingError}</p>}
            </div>
          )}

          {/* ── O que aconteceu ao pedido ──────────────────────────────────
              As mensagens em cima são a conversa; isto é tudo o resto — quando
              foi aprovado, quando foi agendado, quando mudou de mão. O cliente
              perguntava-nos por telefone o que se estava a passar com o pedido
              dele, e a resposta já estava gravada. */}
          {historico.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <History className="h-3.5 w-3.5" /> O que já aconteceu
              </div>
              <ol className="mt-2.5 space-y-2.5">
                {historico.map((h, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[#0077B6]" />
                      {i < historico.length - 1 && (
                        <span className="mt-1 w-px flex-1 bg-slate-200" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <p className="text-sm leading-snug text-slate-700">{h.message}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {formatDateTime(h.createdAt)}
                        {h.by?.nome ? ` · ${h.by.nome}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-400">Criado a {formatDate(order.createdAt)}</span>
            {preco != null && (
              <span className="text-base font-bold text-slate-900">
                {Number(preco).toFixed(2)} € {precoEAcordado ? "a pagar" : "s/IVA"}
              </span>
            )}
            {preco == null && order.estimateMin != null && order.estimateMax != null && (
              <span className="text-sm font-semibold text-slate-700">
                {Number(order.estimateMin).toFixed(0)}–{Number(order.estimateMax).toFixed(0)} € estimativa
              </span>
            )}
          </div>
      </div>
    </div>
  );
}
