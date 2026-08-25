"use client";

import { CalendarPlus, Clock, MapPin, Phone, User } from "lucide-react";
import { CabecalhoDeEcra } from "@/components/portal/Portal";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import type { Pedido } from "./tipos";

/**
 * A agenda do profissional — os trabalhos contratados, por dia.
 *
 * O PROBLEMA QUE RESOLVE
 *
 * Um trabalho contratado vivia numa lista por estado ("Contratados"), sem
 * noção de tempo: o de amanhã e o do mês que vem na mesma prateleira. Quem
 * faz três recolhas por semana organiza-se por DIA — e quem se organiza mal
 * falta, e quem falta queima a confiança que a plataforma vende.
 *
 * PORQUE NÃO SE REINVENTOU O GOOGLE CALENDAR
 *
 * O calendário que o profissional já olha todos os dias é o do telemóvel.
 * O botão "Pôr no calendário" cria o evento LÁ — com os lembretes nativos,
 * que é o que de facto impede a falta. Este ecrã é o índice; o telemóvel é
 * o despertador. (Um feed que sincroniza sozinho fica para quando houver
 * volume que o justifique.)
 *
 * SÓ DADOS REAIS: um trabalho sem data marcada não inventa uma — aparece em
 * "Sem data marcada", que é um estado honesto e accionável: combinar com o
 * cliente.
 */

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function nomeDoServico(id: string | null): string {
  if (!id) return "Serviço";
  return SERVICE_CATEGORIES.find((c) => c.id === id)?.label ?? id.replace(/_/g, " ");
}

function cabecalhoDoDia(d: Date): string {
  const hoje = new Date();
  const amanha = new Date(hoje.getTime() + 86_400_000);
  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mesmoDia(d, hoje)) return "Hoje";
  if (mesmoDia(d, amanha)) return "Amanhã";
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${d.toLocaleDateString("pt-PT", { month: "long" })}`;
}

/**
 * O link que cria o evento no Google Calendar do próprio telemóvel.
 *
 * Horas "flutuantes" com o fuso explícito (ctz): o trabalho é às 9h em
 * Lisboa, e às 9h fica, esteja o telemóvel configurado como estiver.
 * Duração por omissão: 2 horas — recolhas raramente passam disso, e um
 * bloco curto demais esconde o trabalho na grelha do dia.
 */
function linkGoogleCalendar(p: Pedido): string {
  const inicio = new Date(p.dataAgendada as string);
  const fim = new Date(inicio.getTime() + 2 * 3600_000);
  const f = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `CLYON — ${nomeDoServico(p.serviceType)}${p.contactoNome ? ` (${p.contactoNome})` : ""}`,
    dates: `${f(inicio)}/${f(fim)}`,
    ctz: "Europe/Lisbon",
    details: [
      `Pedido CLYON #${p.pedidoId}`,
      p.contactoNome && `Cliente: ${p.contactoNome}`,
      p.contactoTelefone && `Telefone: ${p.contactoTelefone}`,
      p.description && `\n${p.description}`,
    ]
      .filter(Boolean)
      .join("\n"),
    location: p.morada ?? p.city ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function Agenda({
  pedidos,
  onVoltar,
  onAbrirTrabalhos,
}: {
  pedidos: Pedido[];
  onVoltar: () => void;
  onAbrirTrabalhos: () => void;
}) {
  // Só o que está contratado e por fazer. O resto não é agenda: o confirmado
  // já foi, o em-negociação ainda não é de ninguém.
  const contratados = pedidos.filter((p) => p.fase === "a_executar" && !p.arquivadoEm);

  const comData = contratados
    .filter((p) => p.dataAgendada)
    .sort(
      (a, b) =>
        new Date(a.dataAgendada as string).getTime() - new Date(b.dataAgendada as string).getTime(),
    );
  const semData = contratados.filter((p) => !p.dataAgendada);

  const porDia = new Map<string, Pedido[]>();
  for (const p of comData) {
    const d = new Date(p.dataAgendada as string);
    const chave = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    porDia.set(chave, [...(porDia.get(chave) ?? []), p]);
  }

  const cartao = (p: Pedido, comHora: boolean) => (
    <div
      key={p.negociacaoId}
      className="rounded-2xl border border-[#E2EEF3] bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {comHora && (
            <p className="flex items-center gap-1.5 text-sm font-bold text-acao">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {new Date(p.dataAgendada as string).toLocaleTimeString("pt-PT", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          <p className="mt-0.5 text-sm font-semibold text-tinta">{nomeDoServico(p.serviceType)}</p>
          {p.morada && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-tinta-fraca">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {p.morada}
            </p>
          )}
          {p.contactoNome && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-tinta-fraca">
              <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {p.contactoNome}
              {p.contactoTelefone && (
                <a href={`tel:${p.contactoTelefone}`} className="flex items-center gap-1 text-acao">
                  <Phone className="h-3 w-3" aria-hidden="true" />
                  {p.contactoTelefone}
                </a>
              )}
            </p>
          )}
        </div>
        {p.recebeSeFechado != null && (
          <span className="shrink-0 text-sm font-bold text-emerald-700">
            {p.recebeSeFechado.toFixed(2).replace(".", ",")} €
          </span>
        )}
      </div>

      {comHora ? (
        <a
          href={linkGoogleCalendar(p)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#E2EEF3] bg-[#F4F8FB] text-sm font-semibold text-tinta transition active:bg-[#E2EEF3]"
        >
          <CalendarPlus className="h-4 w-4 text-acao" aria-hidden="true" />
          Pôr no calendário do telemóvel
        </a>
      ) : (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          Sem data marcada — combine com o cliente e a CLYON regista-a no pedido.
        </p>
      )}
    </div>
  );

  return (
    <>
      <CabecalhoDeEcra titulo="Agenda" onVoltar={onVoltar} />

      {contratados.length === 0 ? (
        <div className="rounded-2xl border border-[#E2EEF3] bg-white p-8 text-center">
          <p className="text-sm leading-relaxed text-tinta-fraca">
            Nada agendado. Quando contratar um trabalho, ele aparece aqui pelo
            dia marcado — e pode pô-lo no calendário do telemóvel com um toque.
          </p>
          <button
            onClick={onAbrirTrabalhos}
            className="mt-4 cursor-pointer border-none bg-transparent text-sm font-semibold text-acao underline-offset-4 hover:underline"
          >
            Ver os meus trabalhos
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {[...porDia.entries()].map(([chave, lista]) => (
            <section key={chave}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-tinta-fraca">
                {cabecalhoDoDia(new Date(lista[0].dataAgendada as string))}
              </h2>
              <div className="space-y-2.5">{lista.map((p) => cartao(p, true))}</div>
            </section>
          ))}

          {semData.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700">
                Sem data marcada ({semData.length})
              </h2>
              <div className="space-y-2.5">{semData.map((p) => cartao(p, false))}</div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
