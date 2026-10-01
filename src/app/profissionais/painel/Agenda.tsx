"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, CalendarPlus, Clock, MapPin, Phone, User, X } from "lucide-react";
import { CabecalhoDeEcra } from "@/components/portal/Portal";
import {
  BarraDaAgenda,
  GrelhaDeAgenda,
  useAgora,
  useVistaDaAgenda,
  type EventoDaAgenda,
} from "@/components/GrelhaDeAgenda";
import {
  corDoServico,
  diaPorExtenso,
  horaCurta,
  periodoDaVista,
  proximoDepois,
} from "@/lib/agenda-em-grelha";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import {
  campoEmLisboa,
  diaEmLisboa,
  doRelogioDeLisboa,
  noRelogioDeLisboa,
  pecasEmLisboa,
  somarDiasAoDia,
} from "@/lib/hora-de-lisboa";
import type { Pedido } from "./tipos";
import { arrumarTrabalho, confirmarArrumacao } from "./arrumar";
import MarcarODia, { gravarODia } from "./MarcarODia";

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

/**
 * A DATA QUE MANDA: a que ele combinou, e só depois a que o cliente pediu.
 *
 * Sete sítios deste ecrã liam `dataAgendada` directamente — o que o cliente
 * escreveu no formulário. A partir do momento em que ele pode marcar o dia ao
 * telefone, essa deixou de ser a data do trabalho: é o ponto de partida. Se a
 * agenda continuasse a ler a antiga, ele marcava sábado e continuava a ver
 * quinta.
 *
 * Uma função só, e todos passam por ela: sete leituras espalhadas divergem no
 * dia em que alguém corrige seis.
 */
function quandoE(p: Pedido): string | null {
  return p.dataCombinada ?? p.dataAgendada ?? null;
}

function nomeDoServico(id: string | null): string {
  if (!id) return "Serviço";
  return SERVICE_CATEGORIES.find((c) => c.id === id)?.label ?? id.replace(/_/g, " ");
}

function cabecalhoDoDia(d: Date): string {
  // Os dias de Lisboa, e não os do telemóvel — ver `hora-de-lisboa.ts`.
  const dia = diaEmLisboa(d);
  const hoje = diaEmLisboa(new Date());
  if (dia === hoje) return "Hoje";
  if (dia === somarDiasAoDia(hoje, 1)) return "Amanhã";
  const p = pecasEmLisboa(d);
  return `${DIAS[p.diaDaSemana]}, ${p.dia} de ${d.toLocaleDateString("pt-PT", { month: "long" })}`;
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
  const inicio = new Date(quandoE(p) as string);
  const fim = new Date(inicio.getTime() + 2 * 3600_000);
  // A hora de LISBOA, que é o que o `ctz` diz: com a do telemóvel, um
  // telemóvel noutro fuso marcava o trabalho à hora errada.
  const f = (d: Date) => `${campoEmLisboa(d).replace(/[-:]/g, "")}00`;
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
  onRecarregar,
}: {
  pedidos: Pedido[];
  onVoltar: () => void;
  onAbrirTrabalhos: () => void;
  /** Depois de arquivar, a lista tem de vir outra vez da base. */
  onRecarregar: () => void;
}) {
  /*
   * ARQUIVAR, AQUI TAMBÉM.
   *
   * "Os pros estão a reclamar de terem a agenda cheia; os trabalhos em que o
   * cliente deixou de responder não saem da agenda." Saem — arquivar já os
   * tirava daqui — mas o botão só existia em «Os meus trabalhos», e ninguém
   * sai da agenda para ir arrumar a agenda.
   *
   * Um trabalho contratado só sai por si quando alguém o dá por feito, e é
   * precisamente isso que não acontece quando o cliente desaparece: fica ali
   * para sempre a empurrar para baixo o que ainda interessa.
   */
  const [aArquivar, setAArquivar] = useState<number | null>(null);

  /*
   * EDITAR A AGENDA A PARTIR DA AGENDA — 18-09-2026.
   *
   * *«Os profissionais devem ter a opção de editar as suas agendas para
   * ajustar as datas e horários dos trabalhos.»*
   *
   * Já podiam, mas só dentro do cartão do trabalho, noutro ecrã. Aqui viam que
   * estava errado e tinham de sair para o corrigir — a mesma lição do botão de
   * arquivar, que também só existia lá: ninguém sai da agenda para ir arrumar
   * a agenda.
   *
   * Um de cada vez. Oito campos de data abertos ao mesmo tempo não é um ecrã
   * de agenda — é um formulário.
   */
  const [aMudar, setAMudar] = useState<number | null>(null);

  /*
   * A GRELHA — 01-10-2026.
   *
   * *«É possível melhorar essa agenda para ser mais profissional, como essa?»*
   * — com a semana do Google Calendar ao lado.
   *
   * A lista dizia o que vinha a seguir; não dizia como era a semana. Quem tinha
   * três trabalhos na quinta e a sexta livre só o percebia depois de ler a lista
   * toda. A grelha mostra-o de relance, e mostra o que a lista escondia: dois
   * trabalhos marcados à mesma hora, lado a lado.
   *
   * A LISTA NÃO SAIU — é a quarta vista, «Lista», tal e qual era. E nenhuma
   * acção se perdeu: tocar num bloco abre o mesmo cartão de sempre, com o
   * telefone, o «Pôr no calendário do telemóvel», o mudar o dia e o arquivar.
   */
  const [vista, setVista] = useVistaDaAgenda("clyon:agenda-do-profissional:vista");
  // A grelha conta no relógio de Lisboa — ver `noRelogioDeLisboa`.
  const [ancora, setAncora] = useState(() => noRelogioDeLisboa(new Date()));
  const agora = useAgora();
  const [aberto, setAberto] = useState<number | null>(null);
  const [verSemData, setVerSemData] = useState(false);

  /*
   * ARRASTAR PARA MUDAR O DIA OU A HORA — e gravar ao largar. 01-10-2026.
   *
   * *«Quero também poder puxar/arrastar esses agendamentos para mudar sua
   * data e horário como na agenda, e eles salvarem automático ao soltar.»*
   *
   * O bloco muda de sítio NO MOMENTO em que se larga (`movidos`), e só
   * depois a gravação vai à rota. Esperar pela resposta para o mudar deixava
   * o bloco a saltar de volta para o sítio antigo durante meio segundo, como
   * se o arrasto não tivesse pegado. Se a gravação falhar, volta para onde
   * estava e diz-se porquê.
   *
   * A rota é a de sempre (`gravarODia`, a mesma do «Mudar o dia ou a hora»):
   * não manda mensagem nenhuma ao cliente, só escreve no histórico do
   * pedido. Um arrasto por engano corrige-se com outro arrasto, e fica
   * registado.
   */
  const [movidos, setMovidos] = useState<Record<number, string>>({});
  const [avisoDoArrasto, setAvisoDoArrasto] = useState<{
    tipo: "a_gravar" | "ok" | "erro";
    texto: string;
  } | null>(null);

  async function moverPorArrasto(id: number, parede: Date) {
    /* A grelha larga em hora de Lisboa; a rota grava o instante verdadeiro. */
    const novo = doRelogioDeLisboa(parede);
    if (!novo) return;
    setMovidos((m) => ({ ...m, [id]: novo.toISOString() }));
    const quando = `${diaPorExtenso(parede).toLowerCase()}, às ${horaCurta(parede)}`;
    setAvisoDoArrasto({ tipo: "a_gravar", texto: `A gravar: ${quando}…` });
    const r = await gravarODia(id, novo.toISOString());
    if (r.ok) {
      setAvisoDoArrasto({ tipo: "ok", texto: `Mudado para ${quando}.` });
      onRecarregar();
      return;
    }
    setMovidos((m) => {
      const n = { ...m };
      delete n[id];
      return n;
    });
    setAvisoDoArrasto({ tipo: "erro", texto: `Não mudou: ${r.erro}` });
  }

  /* O «mudado» apaga-se sozinho; um erro fica até ao próximo arrasto. */
  useEffect(() => {
    if (avisoDoArrasto?.tipo !== "ok") return;
    const id = window.setTimeout(() => setAvisoDoArrasto(null), 4000);
    return () => window.clearTimeout(id);
  }, [avisoDoArrasto]);

  /*
   * Quando a lista chega da base com a data nova, o desvio local deixa de
   * ser preciso. Só se larga quando a base diz o MESMO — senão, um
   * recarregamento que chegasse antes da gravação punha o bloco a saltar.
   */
  useEffect(() => {
    setMovidos((m) => {
      let mudou = false;
      const n = { ...m };
      for (const [id, iso] of Object.entries(m)) {
        const p = pedidos.find((x) => x.negociacaoId === Number(id));
        const real = p ? quandoE(p) : null;
        if (!p || (real && new Date(real).getTime() === new Date(iso).getTime())) {
          delete n[Number(id)];
          mudou = true;
        }
      }
      return mudou ? n : m;
    });
  }, [pedidos]);
  const fechar = useRef<HTMLButtonElement | null>(null);

  async function arquivar(p: Pedido) {
    if (!confirmarArrumacao(p)) return;
    setAArquivar(p.negociacaoId);
    try {
      if (await arrumarTrabalho(p, true)) onRecarregar();
    } catch {
      /* Sem rede não se arruma nada — e não há nada a desfazer. */
    } finally {
      setAArquivar(null);
    }
  }

  // Só o que está contratado e por fazer. O resto não é agenda: o confirmado
  // já foi, o em-negociação ainda não é de ninguém.
  const contratados = pedidos.filter((p) => p.fase === "a_executar" && !p.arquivadoEm);

  const comData = contratados
    .filter((p) => quandoE(p))
    .sort(
      (a, b) =>
        new Date(quandoE(a) as string).getTime() - new Date(quandoE(b) as string).getTime(),
    );
  const semData = contratados.filter((p) => !quandoE(p));

  const porDia = new Map<string, Pedido[]>();
  for (const p of comData) {
    const chave = diaEmLisboa(new Date(quandoE(p) as string));
    porDia.set(chave, [...(porDia.get(chave) ?? []), p]);
  }

  /* Os trabalhos com dia, traduzidos para a grelha. A cor diz o serviço. */
  const eventos: EventoDaAgenda[] = comData.map((p) => {
    // No relógio de Lisboa: a grelha lê `getHours()`, e no Brasil eram 4 h a menos.
    const inicio = noRelogioDeLisboa(new Date(movidos[p.negociacaoId] ?? (quandoE(p) as string)));
    const servico = nomeDoServico(p.serviceType);
    const onde = p.morada ?? p.city ?? null;
    return {
      id: p.negociacaoId,
      inicio,
      titulo: servico,
      linha2: p.contactoNome ?? null,
      linha3: onde,
      valor:
        p.recebeSeFechado != null ? `${p.recebeSeFechado.toFixed(2).replace(".", ",")} €` : null,
      cor: corDoServico(p.serviceType),
      rotuloAcessivel: [horaCurta(inicio), servico, p.contactoNome, onde].filter(Boolean).join(", "),
    };
  });

  /*
   * UMA SEMANA VAZIA DIZ ONDE ESTÁ O PRÓXIMO.
   *
   * Uma grelha em branco não distingue «não tem nada marcado» de «está a olhar
   * para a semana errada». Se o período está vazio e há trabalho depois dele,
   * diz-se qual e leva-se lá num toque.
   */
  const periodo = periodoDaVista(vista, ancora);
  const noPeriodo = periodo
    ? eventos.filter((e) => e.inicio >= periodo.de && e.inicio < periodo.ate).length
    : 0;
  const proximo =
    periodo && noPeriodo === 0 ? proximoDepois(eventos.map((e) => e.inicio), periodo.ate) : null;

  /*
   * O TRABALHO ABERTO lê-se sempre da lista recarregada, e não de uma cópia
   * guardada no toque: depois de mudar a hora, a janela tem de mostrar a hora
   * nova. E se o trabalho saiu da agenda — arquivado —, a janela fecha-se.
   */
  const pAberto = aberto != null ? (contratados.find((p) => p.negociacaoId === aberto) ?? null) : null;
  const haAberto = pAberto != null;

  useEffect(() => {
    if (aberto != null && !haAberto) setAberto(null);
  }, [aberto, haAberto]);

  useEffect(() => {
    if (!haAberto) return;
    fechar.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(null);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [haAberto]);

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
              {new Date(quandoE(p) as string).toLocaleTimeString("pt-PT", {
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
          {/*
            O NÚMERO NÃO SE PARTE, E O ALVO TEM 44 px.

            Era um flex de três filhos sem `flex-wrap`: a partir de um nome com
            uns 20 caracteres o link era comprimido e o número passava a duas
            linhas — «912 345» numa, «678» na outra. E o link herdava a caixa
            de `text-xs`, ou seja 19 px de alvo, para o gesto PRINCIPAL deste
            ecrã: a agenda existe para ele ligar ao cliente.
          */}
          {p.contactoNome && (
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-tinta-fraca">
              <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {p.contactoNome}
              {p.contactoTelefone && (
                <a
                  href={`tel:${p.contactoTelefone}`}
                  className="mt-0.5 flex min-h-[44px] basis-full items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-acao"
                >
                  <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
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
        /*
          SEM DATA: O CAMPO ABRE JÁ.
          Esta secção existe para pedir uma coisa — que ele marque o dia. Pôr um
          botão a abrir um campo era um toque a mais para chegar à única acção
          que a secção pede.

          E a frase mudou. Dizia «combine com o cliente e a CLYON regista-a no
          pedido», o que já não era verdade: quem regista é ele, aqui.
        */
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2">
          <p className="text-xs leading-relaxed text-amber-800">
            Sem data marcada — combine com o cliente e marque aqui.
          </p>
          <MarcarODia pedido={p} onGravado={onRecarregar} compacto />
        </div>
      )}

      {/*
        MUDAR O DIA, para quem já tem um.

        Fechado por omissão e discreto de propósito: a agenda existe para ele
        ligar ao cliente e ver onde tem de estar. Um campo de data aberto em
        cada um dos oito cartões do dia empurrava o telefone para fora do ecrã.

        Aberto, é o mesmo componente da ficha do trabalho — e grava pela mesma
        rota, que é quem guarda as regras.
      */}
      {comHora && (
        <div className="mt-2">
          {aMudar === p.negociacaoId ? (
            <MarcarODia
              pedido={p}
              onGravado={() => {
                setAMudar(null);
                onRecarregar();
              }}
              compacto
            />
          ) : (
            <button
              onClick={() => setAMudar(p.negociacaoId)}
              className="flex min-h-[40px] w-full items-center justify-center gap-1.5 text-xs font-semibold text-acao transition active:opacity-70"
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Mudar o dia ou a hora
            </button>
          )}
        </div>
      )}

      {/*
        Discreto de propósito, e no fim.
        A agenda existe para ele ligar ao cliente; arquivar é a saída para
        quando já ligou e não há ninguém do outro lado. Um botão grande aqui
        competia com o telefone, que é o gesto principal.
      */}
      <button
        onClick={() => void arquivar(p)}
        disabled={aArquivar === p.negociacaoId}
        className="mt-2 flex min-h-[40px] w-full items-center justify-center gap-1.5 text-xs font-semibold text-tinta-fraca transition active:text-tinta disabled:opacity-40"
      >
        <Archive className="h-3.5 w-3.5" aria-hidden="true" />
        {aArquivar === p.negociacaoId ? "A arquivar…" : "Arquivar — o cliente não responde"}
      </button>
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
        <>
          <div className="mb-4">
            <BarraDaAgenda
              vista={vista}
              ancora={ancora}
              tema="claro"
              onVista={setVista}
              onAncora={setAncora}
            />
          </div>
          {/*
            O QUE ACONTECEU AO ARRASTO, em palavras: «A gravar», «Mudado para
            sexta às 14:30», ou porque não mudou. Sem isto, largar um bloco era
            um gesto sem resposta — e é dinheiro e um cliente à espera.
          */}
          {vista !== "lista" && (
            <p
              role="status"
              aria-live="polite"
              className={`-mt-2 mb-3 min-h-[1.25rem] text-xs ${
                avisoDoArrasto?.tipo === "erro"
                  ? "font-semibold text-rose-700"
                  : avisoDoArrasto?.tipo === "ok"
                    ? "font-semibold text-emerald-700"
                    : "text-tinta-fraca"
              }`}
            >
              {avisoDoArrasto?.texto ?? (
                <span className="hidden sm:inline">
                  Arraste um trabalho para outro dia ou hora — grava ao largar.
                </span>
              )}
            </p>
          )}

          {/*
            OS QUE NÃO TÊM DIA não cabem numa grelha de horas — e não podem
            desaparecer por isso: são precisamente os que pedem uma acção. Ficam
            numa faixa por cima, fechada, a dizer quantos são; abri-la mostra os
            mesmos cartões da lista, com o campo do dia já aberto.
          */}
          {vista !== "lista" && semData.length > 0 && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-1">
              <button
                type="button"
                onClick={() => setVerSemData((v) => !v)}
                aria-expanded={verSemData}
                className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left"
              >
                <span className="text-sm font-semibold text-amber-900">
                  {semData.length} {semData.length === 1 ? "trabalho" : "trabalhos"} sem data marcada
                </span>
                <span className="shrink-0 text-xs font-semibold text-amber-800">
                  {verSemData ? "Esconder" : "Marcar o dia"}
                </span>
              </button>
              {verSemData && (
                <div className="space-y-2.5 pb-2">{semData.map((p) => cartao(p, false))}</div>
              )}
            </div>
          )}

          {vista === "lista" ? (
            <div className="space-y-5">
              {[...porDia.entries()].map(([chave, lista]) => (
                <section key={chave}>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-tinta-fraca">
                    {cabecalhoDoDia(new Date(quandoE(lista[0]) as string))}
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
          ) : (
            <>
              <GrelhaDeAgenda
                vista={vista}
                ancora={ancora}
                eventos={eventos}
                agora={agora}
                tema="claro"
                onAbrir={setAberto}
                onMover={(id, novo) => void moverPorArrasto(id, novo)}
                onIrParaDia={(d) => {
                  setAncora(d);
                  setVista("dia");
                }}
              />
              {proximo && (
                <p className="mt-3 text-sm text-tinta-fraca">
                  Nada marcado {vista === "dia" ? "neste dia" : vista === "semana" ? "nesta semana" : "neste mês"}.
                  {" "}Próximo trabalho: {diaPorExtenso(proximo).toLowerCase()}, às {horaCurta(proximo)}.{" "}
                  <button
                    type="button"
                    onClick={() => setAncora(proximo)}
                    className="font-semibold text-acao underline-offset-4 hover:underline"
                  >
                    Ir para lá
                  </button>
                </p>
              )}
            </>
          )}
        </>
      )}

      {/*
        O TRABALHO ABERTO — o cartão de sempre, numa janela.

        Por baixo no telemóvel, como as folhas do próprio sistema; ao centro num
        ecrã largo. Fecha-se com o X, com Escape ou tocando fora — e as acções
        lá dentro são as mesmas da lista, pelas mesmas funções.
      */}
      {pAberto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 sm:items-center sm:p-4"
          onClick={() => setAberto(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="agenda-trabalho-aberto"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[#F4F8FB] p-3 shadow-2xl sm:rounded-3xl"
          >
            <div className="mb-2 flex items-center justify-between gap-3 pl-1">
              <p id="agenda-trabalho-aberto" className="text-sm font-semibold text-tinta">
                {quandoE(pAberto)
                  ? diaPorExtenso(noRelogioDeLisboa(new Date(quandoE(pAberto) as string)))
                  : "Sem data marcada"}
              </p>
              <button
                ref={fechar}
                type="button"
                onClick={() => setAberto(null)}
                aria-label="Fechar"
                className="flex h-10 w-10 items-center justify-center rounded-full text-tinta-fraca transition hover:bg-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {cartao(pAberto, Boolean(quandoE(pAberto)))}
          </div>
        </div>
      )}
    </>
  );
}
