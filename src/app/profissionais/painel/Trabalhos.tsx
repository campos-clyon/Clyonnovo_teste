"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  HandCoins,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Truck,
  User,
  ArrowUpDown,
  ChevronDown,
} from "lucide-react";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { CabecalhoDeEcra, euros } from "@/components/portal/Portal";
import EnviarFotos, { type FotoEnviada } from "@/components/EnviarFotos";
import Nota from "@/components/Nota";
import VisorDeFotos from "@/components/VisorDeFotos";
import NegociacaoProfissional from "@/app/profissionais/pedidos/[token]/NegociacaoProfissional";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";
import {
  URGENCIA,
  ELEVADOR,
  ESTACIONAMENTO,
  emPortugues,
  ESTADO_DO_ENTULHO,
  deQuemEAVez,
  distanciaPorExtenso,
  distanciaDaBase,
  fotosDe,
  propostasDe,
  provaDe,
  type Pedido,
} from "./tipos";
import {
  sinaisDoTrabalho,
  porKmPorExtenso,
  pesoDoTrabalho,
  porQuilometro,
} from "@/lib/sinais-do-trabalho";
import HistoricoDaNegociacao from "@/components/HistoricoDaNegociacao";

/**
 * Os trabalhos do profissional.
 *
 * Uma lista, e o detalhe abre por cima. O que muda tudo é a fase: enquanto se
 * negoceia, ele vê a zona; depois de ser contratado, vê a morada e o telefone,
 * e ganha o botão que fecha o ciclo — "está feito", com fotografia.
 *
 * As fotografias do cliente aparecem grandes, e não em miniaturas: é por elas
 * que se decide o preço de uma recolha. Um sofá numa miniatura de 60 píxeis é
 * indistinguível de uma cadeira.
 */

const ESTADO: Record<string, { texto: string; cls: string }> = {
  aberta: { texto: "à espera da sua resposta", cls: "bg-blue-50 text-blue-700" },
  aguarda_contratacao: { texto: "à espera do cliente", cls: "bg-cyan-50 text-cyan-700" },
  acordada: { texto: "é seu", cls: "bg-emerald-50 text-emerald-700" },
  desistida: { texto: "terminada", cls: "bg-slate-100 text-slate-500" },
  morta: { texto: "fechada com outro", cls: "bg-slate-100 text-slate-500" },
};

const FASE: Record<string, { texto: string; cls: string }> = {
  a_executar: { texto: "por fazer", cls: "bg-cyan-50 text-cyan-700" },
  a_confirmar: { texto: "à espera da confirmação", cls: "bg-cyan-50 text-cyan-700" },
  confirmado: { texto: "confirmado", cls: "bg-emerald-50 text-emerald-700" },
  pago: { texto: "pago", cls: "bg-slate-100 text-slate-500" },
};

function servicoDe(p: Pedido): string {
  return SERVICE_CATEGORIES.find((c) => c.id === p.serviceType)?.label ?? p.serviceType ?? "Serviço";
}

/**
 * Em que separador é que este pedido cai.
 *
 * A conta dele era uma lista corrida com tudo lá dentro — o que espera
 * resposta, o que já está fechado e o que morreu há duas semanas, tudo com o
 * mesmo peso. Ao quinto pedido, o que precisa de resposta hoje some no meio.
 *
 * "Novo" é o que ainda não tocou: chegou-lhe e ele não propôs nada. É o único
 * que tem prazo a correr contra si, e por isso é o que se destaca.
 */
type Separador =
  | "novos"
  | "negociacao"
  | "contratados"
  | "terminados"
  | "recusados"
  | "arquivados";

/**
 * "TERMINADOS" NÃO GUARDAVA TRABALHOS TERMINADOS.
 *
 * Guardava os `desistida` e os `morta` — ou seja, os que ele PERDEU. Um
 * trabalho feito, confirmado e pago ficava em "Contratados" para sempre, e
 * quem abrisse "Terminados" à procura do que já fez encontrava a lista do que
 * lhe escapou. É o pior sítio possível para uma palavra ambígua.
 *
 * Agora são coisas separadas:
 *
 *   · CONTRATADOS — é dele e ainda não acabou. É aqui que há trabalho por
 *     fazer, e é por isso que este separador tem de estar limpo do resto;
 *   · TERMINADOS — feito e confirmado pelo cliente. O histórico do que
 *     correu bem;
 *   · RECUSADOS — desistiu ele, desistiu o cliente, ou o trabalho fechou com
 *     outro profissional. Perdido, e vale a pena vê-lo à parte: é aqui que se
 *     percebe o que se está a perder e porquê;
 *   · ARQUIVADOS — o que ele próprio arrumou. Não desaparece, muda de sítio.
 *
 * O arquivo ganha ao resto de propósito: um trabalho arquivado é uma decisão
 * dele, e não pode reaparecer nas outras listas só porque mudou de estado.
 */
function separadorDe(p: Pedido): Separador {
  if (p.arquivadoEm) return "arquivados";
  if (p.estado === "acordada") {
    return p.confirmadoEm || p.pagoEm ? "terminados" : "contratados";
  }
  if (p.estado === "desistida" || p.estado === "morta") return "recusados";
  const propostas = propostasDe(p.propostas);
  const jaRespondeu = propostas.some((x) => x.por === "profissional");
  return jaRespondeu || p.estado === "aguarda_contratacao" ? "negociacao" : "novos";
}

/**
 * Por que ordem ele quer a lista.
 *
 * "Vamos deixar padrão do último para o mais antigo, mas vamos criar um filtro
 * para o utilizador colocar como quiser."
 *
 * Quatro, e não sete. Cada uma responde a uma pergunta diferente que ele faz
 * conforme a hora do dia; uma lista de dez opções obriga a ler dez para
 * escolher uma.
 */
type Ordem = "recentes" | "perto" | "valor" | "sinais";

const ORDENS: Array<{ id: Ordem; rotulo: string; curto: string }> = [
  { id: "recentes", rotulo: "Mais recentes", curto: "Recentes" },
  { id: "perto", rotulo: "Mais perto de si", curto: "Mais perto" },
  { id: "valor", rotulo: "Melhor €/km", curto: "€/km" },
  { id: "sinais", rotulo: "Com sinais primeiro", curto: "Com sinais" },
];

const SEPARADORES: Array<{ id: Separador; rotulo: string }> = [
  { id: "novos", rotulo: "Feed" },
  { id: "negociacao", rotulo: "Em negociação" },
  { id: "contratados", rotulo: "Contratados" },
  { id: "terminados", rotulo: "Terminados" },
  { id: "recusados", rotulo: "Recusados" },
  { id: "arquivados", rotulo: "Arquivados" },
];

const VAZIO: Record<Separador, string> = {
  novos: "Nenhum pedido novo. Assim que entrar um na sua zona e nas categorias que faz, aparece aqui — e avisamos por email.",
  negociacao: "Não há nenhuma negociação a decorrer.",
  contratados: "Nenhum trabalho seu por fazer neste momento.",
  terminados: "Ainda não terminou nenhum trabalho. Assim que o cliente confirmar, aparece aqui.",
  recusados: "Nada recusado nem perdido. É bom sinal.",
  arquivados: "Nada arquivado. Use o botão de arquivar para arrumar o que já não precisa de ver.",
};

/** Há quanto tempo, em palavras. Um pedido de "há 3 dias" já não é novo. */
function haQuantoTempo(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutos) || minutos < 0) return "";
  if (minutos < 60) return `há ${Math.max(1, minutos)} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

export default function Trabalhos({
  pedidos,
  realcados,
  onVoltar,
  onRecarregar,
}: {
  pedidos: Pedido[];
  /** Negociações com novidades desde a última visita — ganham contorno. */
  realcados?: Set<number>;
  onVoltar: () => void;
  onRecarregar: () => void;
}) {
  const [aberto, setAberto] = useState<number | null>(null);
  const [separador, setSeparador] = useState<Separador>("novos");

  /*
   * Se há novidades, abre-se no separador onde a primeira está.
   *
   * O realce não vale nada num separador que ele não abre: um trabalho
   * confirmado vive em "Terminados", e quem entra aterra em "Novos" — via a
   * lista vazia e o aviso a apontar para lado nenhum. Foi exactamente o que
   * aconteceu: a confirmação estava lá, num separador onde ninguém olhou.
   */
  useEffect(() => {
    if (!realcados || realcados.size === 0) return;
    const primeiro = pedidos.find((p) => realcados.has(p.negociacaoId));
    if (primeiro) setSeparador(separadorDe(primeiro));
    // Só na entrada no ecrã — mudar de separador a meio da leitura porque
    // chegou um refresh seria roubar-lhe o ecrã das mãos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /*
   * A ordenação escolhida. Fica na sessão e não na conta de propósito: a
   * pergunta muda com o dia — de manhã é "o que paga melhor", às cinco da
   * tarde é "o que me fica no caminho para casa" — e uma preferência gravada
   * para sempre passa a ser uma decisão de há três semanas.
   */
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  /* Fechado por omissão: a lista é o assunto, o filtro é um ajuste. */
  const [ordemAberta, setOrdemAberta] = useState(false);

  /**
   * Abrir um trabalho, e deixar escrito que foi aberto.
   *
   * O ecrã muda já — o realce apaga-se no toque, sem esperar pela rede — e o
   * servidor fica a saber a seguir. Se a gravação falhar, o pior que acontece é
   * o distintivo voltar no próximo carregamento; abrir o trabalho nunca pode
   * ficar à espera de um registo de leitura.
   */
  const abrirTrabalho = useCallback(
    (p: Pedido) => {
      setAberto(p.negociacaoId);
      if (p.abertoEm) return;
      setLidosAgora((antes) => new Set(antes).add(p.negociacaoId));
      void fetch("/api/profissionais/abrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negociacaoId: p.negociacaoId }),
      }).catch(() => {
        /* silêncio: ver o comentário da rota */
      });
    },
    [],
  );

  /* Os que ele abriu nesta sessão, para o realce cair no toque. */
  const [lidosAgora, setLidosAgora] = useState<Set<number>>(new Set());

  /* Mudar de separador fecha a gaveta: a escolha fica, a gaveta não. */
  useEffect(() => setOrdemAberta(false), [separador]);

  const [aArquivar, setAArquivar] = useState<number | null>(null);

  /**
   * Arruma um trabalho, ou repõe-no.
   *
   * Não apaga nada: muda de separador. O que o cliente vê fica igual, a
   * carteira conta o mesmo, e o "Arquivados" existe precisamente para nada
   * desaparecer de vez.
   */
  async function arquivar(negociacaoId: number, arquivar: boolean) {
    setAArquivar(negociacaoId);
    try {
      const res = await fetch("/api/profissionais/arquivar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negociacaoId, arquivar }),
      });
      if (res.ok) onRecarregar();
    } catch {
      /* Sem rede não se arruma nada — e não há nada a desfazer. */
    } finally {
      setAArquivar(null);
    }
  }

  /*
   * ⚠️ TODOS OS HOOKS TÊM DE FICAR ACIMA DO `return` QUE VEM A SEGUIR.
   *
   * O `porAbrir` estava por baixo dele, junto ao sítio onde é usado — que era
   * onde fazia sentido ler, e onde partia. Abrir um trabalho leva a função a
   * sair mais cedo, o `useMemo` deixa de correr, e o React conta menos hooks
   * do que na volta anterior: "Rendered fewer hooks than expected", que é o
   * ecrã branco com «Application error» que ele apanhou ao clicar num pedido.
   *
   * A regra não é um capricho do React: a lista de hooks é posicional, e uma
   * volta que salta um desalinha todas as que vêm depois.
   */
  /*
   * OS QUE AINDA NÃO ABRIU — E SÓ OS CINCO MAIS RECENTES.
   *
   * "Os pedidos estão todos a mostrar novo, mas novo deve ser apenas os 5
   * recentes ainda não abertos."
   *
   * Tem razão duas vezes. «Novo» queria dizer «está no separador dos novos», e
   * um trabalho fica lá até ele responder — por isso o distintivo ficava em
   * todos os cartões, para sempre. Um aviso que nunca se apaga passa a fazer
   * parte do fundo.
   *
   * E mesmo por abrir, vinte cartões marcados não destacam nada. Cinco é o que
   * uma pessoa vê de uma vez sem contar; a partir daí é uma mancha.
   *
   * O conjunto calcula-se aqui e não dentro da lista, porque «os cinco mais
   * recentes» é uma propriedade do conjunto todo — os que estão no ecrã e os
   * que ficaram por baixo — e não de cada cartão sozinho.
   */
  const porAbrir = useMemo(() => {
    const ids = pedidos
      .filter(
        (p) =>
          separadorDe(p) === "novos" &&
          !p.abertoEm &&
          !lidosAgora.has(p.negociacaoId),
      )
      .sort(
        (a, b) =>
          new Date(b.actualizadoEm).getTime() - new Date(a.actualizadoEm).getTime(),
      )
      .slice(0, 5)
      .map((p) => p.negociacaoId);
    return new Set(ids);
  }, [pedidos, lidosAgora]);

  const escolhido = pedidos.find((p) => p.negociacaoId === aberto);
  if (escolhido) {
    return (
      <DetalheDoTrabalho
        pedido={escolhido}
        onVoltar={() => setAberto(null)}
        onRecarregar={onRecarregar}
      />
    );
  }

  const porSeparador = (id: Separador) => pedidos.filter((p) => separadorDe(p) === id);

  /* Só onde ele ainda decide. Num trabalho feito, a cronologia é a resposta. */
  const podeOrdenar = separador === "novos" || separador === "negociacao";


  /*
   * A ORDEM DA LISTA — DELE, E NÃO MINHA.
   *
   * A primeira versão pôs os que têm sinal à frente, sempre. Ele corrigiu-me:
   * "você mudou a hierarquia dos pedidos; vamos deixar padrão do último para o
   * mais antigo, mas vamos criar um filtro para o utilizador colocar como
   * quiser."
   *
   * Tem razão, e o erro é o mesmo que os sinais vieram corrigir do outro lado:
   * o ecrã a decidir por ele. A chegada é a ordem que ele conhece — sabe o que
   * já viu e onde ficou — e uma lista que se reorganiza sozinha faz perder o
   * lugar. Os sinais servem para ele reparar; ordenar por eles é uma escolha, e
   * escolhas são dele.
   *
   * Nos separadores de trabalho feito não há escolha nenhuma: ali a pergunta é
   * "o que aconteceu quando", e a cronologia é a única resposta.
   */
  const quantasFotosDe = (p: Pedido) => {
    try {
      const f = JSON.parse(p.filesJson ?? "[]");
      return Array.isArray(f) ? f.length : 0;
    } catch {
      return 0;
    }
  };
  const maisRecentePrimeiro = (a: Pedido, b: Pedido) =>
    new Date(b.actualizadoEm).getTime() - new Date(a.actualizadoEm).getTime();

  const visiveis = (() => {
    const lista = porSeparador(separador);
    if (!podeOrdenar) return lista;
    const ordenada = [...lista];
    if (ordem === "perto") {
      // Sem distância medida vai para o fim: não é perto nem longe, é
      // desconhecido, e desconhecido não se põe à frente de nada.
      return ordenada.sort((a, b) => {
        const ka = a.distanciaKm ?? Number.POSITIVE_INFINITY;
        const kb = b.distanciaKm ?? Number.POSITIVE_INFINITY;
        return ka - kb || maisRecentePrimeiro(a, b);
      });
    }
    if (ordem === "valor") {
      return ordenada.sort((a, b) => {
        const va = porQuilometro({ ...a }) ?? -1;
        const vb = porQuilometro({ ...b }) ?? -1;
        return vb - va || maisRecentePrimeiro(a, b);
      });
    }
    if (ordem === "sinais") {
      return ordenada.sort(
        (a, b) =>
          pesoDoTrabalho({ ...b, quantasFotos: quantasFotosDe(b) }) -
            pesoDoTrabalho({ ...a, quantasFotos: quantasFotosDe(a) }) ||
          maisRecentePrimeiro(a, b),
      );
    }
    return ordenada.sort(maisRecentePrimeiro);
  })();

  return (
    <>
      <CabecalhoDeEcra titulo="Os meus trabalhos" onVoltar={onVoltar} />

      {/* Separadores, com a conta ao lado.
          O número não é enfeite: é o que lhe diz onde há trabalho à espera sem
          ter de abrir cada um para ver. */}
      {/* Dobram de linha em vez de saírem do ecrã.
          Estavam a rolar na horizontal: num telemóvel, "Terminados" ficava
          cortado na margem e a barra de rolagem aparecia por baixo. Ninguém
          arrasta um separador que não sabe que existe. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {SEPARADORES.map((sep) => {
          const quantos = porSeparador(sep.id).length;
          const activo = separador === sep.id;
          return (
            <button
              key={sep.id}
              type="button"
              onClick={() => setSeparador(sep.id)}
              aria-pressed={activo}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition sm:px-3.5 sm:text-sm ${
                activo
                  ? "bg-[#0B1929] text-white"
                  : "bg-slate-100 text-slate-600 active:bg-slate-200"
              }`}
            >
              {sep.rotulo}
              {quantos > 0 && (
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    activo
                      ? "bg-white/20"
                      : sep.id === "novos"
                        ? "bg-[#00B4CC] text-white"
                        : "bg-slate-300 text-slate-700"
                  }`}
                >
                  {quantos}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/*
        POR QUE ORDEM.

        Fica por baixo dos separadores e acima da lista, discreto: não é um
        passo do caminho, é um ajuste. O padrão é a chegada — a ordem que ele
        conhece — e as outras três estão a um toque.

        Rola na horizontal em vez de dobrar: no telemóvel, quatro pastilhas
        empilhadas roubavam uma linha inteira à lista. Ao contrário dos
        separadores, aqui a primeira já está escolhida e vê-se logo que há mais
        à direita — ninguém fica sem saber que existem.
      */}
      {podeOrdenar && visiveis.length > 1 && (
        <div className="mb-3">
          {/*
            FECHADO POR OMISSÃO, e a fechar-se sozinho depois de escolher.

            "Tem informações fora da tela, acredito que seja referente ao
            filtro. Podemos deixá-lo fechado por padrão, e só abre ao clicar;
            depois de escolher uma opção o filtro salva e fecha sozinho."

            Quatro pastilhas mais a palavra «ORDENAR» não cabem num telemóvel
            de 360 px: a última saía do ecrã, e uma opção que não se vê não
            existe. Deslizavam na horizontal, o que resolve pouco — ninguém
            arrasta uma barra que não sabe que continua.

            Fechado, é UM botão que diz a escolha actual. Aberto, mostra as
            quatro. Escolher fecha — porque escolher é o fim da tarefa, e
            deixar aberto rouba à lista o espaço de um cartão inteiro.
          */}
          <button
            onClick={() => setOrdemAberta((a) => !a)}
            aria-expanded={ordemAberta}
            className="flex items-center gap-1.5 rounded-full border border-[#E2EEF3] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition active:bg-slate-50"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {ORDENS.find((o) => o.id === ordem)?.curto ?? "Recentes"}
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                ordemAberta ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>

          {ordemAberta && (
            <div className="mt-2 flex flex-wrap gap-2">
              {ORDENS.map((o) => {
                const activo = ordem === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => {
                      setOrdem(o.id);
                      setOrdemAberta(false);
                    }}
                    aria-pressed={activo}
                    title={o.rotulo}
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      activo
                        ? "border-[#0B1929] bg-[#0B1929] text-white"
                        : "border-[#E2EEF3] bg-white text-slate-500 active:bg-slate-50"
                    }`}
                  >
                    {o.curto}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {visiveis.length === 0 && (
        <div className="rounded-2xl border border-[#E2EEF3] bg-white p-8 text-center">
          <p className="text-sm leading-relaxed text-slate-500">{VAZIO[separador]}</p>
        </div>
      )}

      <div className="space-y-3">
        {visiveis.map((p) => {
          /*
           * `aberta` não diz de quem é a vez — cobre os dois lados da mesa.
           * As propostas dizem, e é isso que o ecrã de dentro já usava. Aqui
           * dizia-se sempre «à espera da sua resposta», mesmo quando era ele
           * quem tinha proposto e estava à espera do cliente.
           */
          const vez = p.estado === "aberta" ? deQuemEAVez(p.propostas) : null;
          const estado =
            vez === "cliente"
              ? { texto: "à espera do cliente", cls: "bg-cyan-50 text-cyan-700" }
              : vez === null && p.estado === "aberta"
                ? { texto: "sem propostas ainda", cls: "bg-slate-100 text-slate-500" }
                : (ESTADO[p.estado] ?? { texto: p.estado, cls: "bg-slate-100 text-slate-500" });
          const fase = p.estado === "acordada" ? FASE[p.fase] : null;
          const fotos = fotosDe(p.filesJson);
          const fechado = p.estado === "acordada";
          /*
           * «Novo» passa a querer dizer «ainda não abriu», e não «está aqui».
           * Assim que ele toca no cartão, o distintivo e o realce apagam-se —
           * que é o que ele pediu: "só muda quando for aberto".
           */
          const novo = porAbrir.has(p.negociacaoId);
          /*
           * OS SINAIS.
           *
           * Só nos separadores onde ele ainda decide. Num trabalho já
           * contratado, "bem pago" e "a 6 km" são história: a decisão está
           * tomada e o distintivo passa a ruído por cima do que importa.
           */
          const aDecidir = separador === "novos" || separador === "negociacao";
          const sinais = aDecidir ? sinaisDoTrabalho({ ...p, quantasFotos: fotos.length }) : [];
          const quente = sinais.some((x) => x.chave === "perto");
          const porKm = aDecidir ? porKmPorExtenso(p) : null;

          // O botão de arrumar só aparece onde arrumar faz sentido. Num
          // trabalho novo ou a decorrer seria um convite a esconder o que
          // ainda precisa de resposta.
          const podeArrumar =
            separador === "recusados" || separador === "terminados" || separador === "arquivados";

          return (
            <div
              key={p.negociacaoId}
              className={`relative ${
                realcados?.has(p.negociacaoId)
                  ? "rounded-2xl ring-2 ring-[#00B4CC] ring-offset-2"
                  : ""
              }`}
            >
            <button
              onClick={() => abrirTrabalho(p)}
              className={`block w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition active:bg-slate-50 ${
                fechado
                  ? "border-emerald-300 ring-1 ring-emerald-100"
                  : quente
                    /*
                     * O QUENTE É OUTRO CARTÃO.
                     *
                     * A barra à esquerda é o que faz o olho parar ao percorrer
                     * a lista, e até aqui dizia só uma coisa: "é novo". Agora
                     * diz PORQUÊ — laranja quando o trabalho fica a menos de
                     * dez quilómetros, que é a única coisa que muda o cartão
                     * inteiro. Se todos os sinais o pintassem, nenhum se via.
                     */
                    ? "border-l-4 border-l-orange-500 border-y-orange-100 border-r-orange-100 ring-1 ring-orange-100"
                    : novo
                      /*
                       * POR ABRIR: barra, anel e um fundo com um sopro de cor.
                       *
                       * "Os pedidos novos ainda não abertos devem ter uma cor e
                       * efeito especial; só muda quando for aberto."
                       *
                       * Ciano da marca, e não âmbar: a CLYON não tem amarelo, e
                       * uma cor que não é da casa lê-se como aviso de sistema em
                       * vez de destaque. O fundo é 40% de um ciano já claro —
                       * o suficiente para o cartão se distinguir de relance,
                       * pouco o suficiente para o texto continuar a ler-se.
                       *
                       * Some no toque. É a única forma de isto funcionar: um
                       * realce que fica é decoração, e decoração não avisa.
                       */
                      ? "border-l-4 border-l-[#00B4CC] border-y-[#B8E6EE] border-r-[#B8E6EE] bg-cyan-50/40 ring-1 ring-[#00B4CC]/15"
                      : "border-[#E2EEF3]"
              }`}
            >
              <div className="flex gap-3">
                {/* A primeira foto ao lado do título: é o que identifica o
                    trabalho de relance, muito antes do texto. */}
                {fotos.length > 0 ? (
                  <div className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fotos[0].url}
                      alt=""
                      className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200"
                    />
                    {fotos.length > 1 && (
                      <span className="absolute bottom-1 right-1 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        +{fotos.length - 1}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                    <Camera className="h-6 w-6 text-slate-300" aria-hidden="true" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-[15px] font-bold text-[#0B1929]">
                      {servicoDe(p)}
                    </h3>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {haQuantoTempo(p.actualizadoEm)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {novo && (
                      <span className="flex items-center gap-1.5 rounded-full bg-[#00B4CC] px-2 py-0.5 text-xs font-bold text-white">
                        {/* O ponto respira devagar. Só existe em cinco cartões
                            no máximo — num ecrã inteiro a piscar, ninguém olha
                            para nenhum. Pára para quem pediu menos movimento. */}
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                        novo
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${estado.cls}`}>
                      {estado.texto}
                    </span>
                    {fase && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${fase.cls}`}>
                        {fase.texto}
                      </span>
                    )}
                    {/*
                      `whitespace-nowrap` em cada um: nenhum distintivo pode
                      partir a meio da palavra num telemóvel de 360 px, que é
                      onde ele lê isto. Onde a palavra não cabia, entrou o
                      número — «3 fotos», e não «3 fotografias».
                    */}
                    {sinais.map((sinal) => (
                      <span
                        key={sinal.chave}
                        className={`flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${sinal.cls}`}
                      >
                        <span aria-hidden="true">{sinal.emoji}</span>
                        {sinal.texto}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {p.city ?? "—"}
                      {/*
                        A pergunta que ele faz primeiro. "Oeiras" não diz se
                        são 10 km ou 60, e é essa diferença que decide se vale
                        a pena responder — por isso vai aqui, na lista, antes
                        de ele abrir seja o que for.
                      */}
                      {p.distanciaKm != null && (
                        <span className="text-slate-400">
                          {" · "}
                          {distanciaPorExtenso(p.distanciaKm)}
                        </span>
                      )}
                    </span>
                    {p.urgency && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {URGENCIA[p.urgency] ?? p.urgency}
                      </span>
                    )}
                  </p>
                  {/*
                    O QUE É O TRABALHO, sem ter de abrir.

                    A lista dizia o serviço, a cidade e o dinheiro — tudo
                    menos aquilo que ele vai fazer. "Recolha de móveis" pode
                    ser um sofá à porta ou uma casa inteira ao quinto andar,
                    e é a descrição que separa as duas. Duas linhas chegam
                    para decidir se vale a pena abrir; o resto está lá dentro.
                  */}
                  {p.description?.trim() ? (
                    <p
                      className="mt-1.5 overflow-hidden text-xs leading-relaxed text-slate-600"
                      style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                    >
                      {p.description.trim()}
                    </p>
                  ) : (
                    /* Sem descrição é informação também — e diz-lhe o que
                       fazer a seguir em vez de o deixar a adivinhar. */
                    <p className="mt-1.5 text-xs italic text-amber-700">
                      Sem descrição — veja as fotografias ou pergunte à CLYON.
                    </p>
                  )}
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <HandCoins className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span
                      className={`text-lg font-bold ${
                        fechado ? "text-emerald-600" : "text-[#0B1929]"
                      }`}
                    >
                      {euros(fechado ? p.recebeSeFechado : p.recebeSeAceitar)}
                    </span>
                    <span className="text-[11px] text-slate-400">já com a taxa</span>
                    {/*
                      A CONTA QUE ELE FAZ DE CABEÇA, ESCRITA.
                      304 € em Campolide, a 39 km, dão 7,8 €/km.
                      123,50 € em Setúbal, a 6 km, dão 20,6 €/km.
                      O barato é o melhor negócio, e a lista mostrava o contrário.
                    */}
                    {porKm && (
                      <span
                        className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                          quente ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {porKm}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>

            {podeArrumar && (
              <button
                onClick={() => arquivar(p.negociacaoId, !p.arquivadoEm)}
                disabled={aArquivar === p.negociacaoId}
                className="absolute bottom-3 right-3 flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#E2EEF3] bg-white px-3 text-xs font-semibold text-slate-500 transition active:bg-slate-50 disabled:opacity-50"
              >
                {aArquivar === p.negociacaoId ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : p.arquivadoEm ? (
                  <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {p.arquivadoEm ? "Repor" : "Arquivar"}
              </button>
            )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── O detalhe ───────────────────────────────────────────────────────────────

function DetalheDoTrabalho({
  pedido,
  onVoltar,
  onRecarregar,
}: {
  pedido: Pedido;
  onVoltar: () => void;
  onRecarregar: () => void;
}) {
  const [fotos, setFotos] = useState<FotoEnviada[]>([]);
  const [nota, setNota] = useState("");
  /** Qual foto está aberta em ecrã inteiro, ou null. */
  const [aVer, setAVer] = useState<{ lista: string[]; i: number } | null>(null);
  /**
   * Se o mapa chegou.
   *
   * Sem chave da Google configurada, a rota responde 204 — e um 204 no `src`
   * de uma imagem não é "nada": é o ícone de imagem partida, com o texto
   * alternativo ao lado. Pior do que não ter mapa nenhum.
   */
  const [semMapa, setSemMapa] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");

  const doCliente = fotosDe(pedido.filesJson);
  const prova = provaDe(pedido.provaJson);
  const fechado = pedido.estado === "acordada";

  async function marcarFeito() {
    if (fotos.length === 0) {
      setErro("Envie pelo menos uma fotografia do trabalho feito.");
      return;
    }
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch("/api/profissionais/trabalho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negociacaoId: pedido.negociacaoId,
          fotos: fotos.map((f) => f.url),
          nota,
        }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return;
      }
      onRecarregar();
      onVoltar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <>
      <CabecalhoDeEcra titulo={servicoDe(pedido)} onVoltar={onVoltar} />

      {/* O que o cliente enviou, em grande. É por aqui que se decide o preço. */}
      {doCliente.length > 0 && (
        <section className="mb-4">
          {/* A foto INTEIRA, sem cortar.
              Estava com `object-cover` e ficava recortada em cima e em baixo —
              e é sobre a fotografia que se decide o preço de uma recolha. O que
              fica fora do enquadramento é o que faz a viagem render menos do
              que devia. Fundo escuro porque uma foto ao alto deixa faixas dos
              lados, e cinzento-claro faz parecer que falta lá alguma coisa. */}
          <button
            type="button"
            onClick={() => setAVer({ lista: doCliente.map((f) => f.url), i: 0 })}
            className="block w-full overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-200"
            aria-label="Abrir fotografia em ecrã inteiro"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={doCliente[0].url}
              alt="Fotografia do pedido"
              className="mx-auto max-h-96 w-auto max-w-full object-contain"
            />
          </button>

          {doCliente.length > 1 && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {doCliente.slice(1).map((f, i) => (
                <button
                  key={f.url}
                  type="button"
                  onClick={() =>
                    setAVer({ lista: doCliente.map((x) => x.url), i: i + 1 })
                  }
                  className="block overflow-hidden rounded-lg bg-slate-900 ring-1 ring-slate-200"
                  aria-label={`Abrir fotografia ${i + 2}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt={`Fotografia ${i + 2} do pedido`}
                    className="aspect-square w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          <p className="mt-1.5 text-center text-xs text-slate-400">
            Toque para ver em ecrã inteiro
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-[#E2EEF3] bg-white p-4 shadow-sm">
        {pedido.description?.trim() ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {pedido.description}
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-amber-700">
            O cliente não escreveu uma descrição. Veja as fotografias, e se
            faltar alguma coisa para dar um preço justo, peça à CLYON antes de
            propor.
          </p>
        )}
        <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
          <li className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            {pedido.city ?? "—"}
          </li>
          {pedido.urgency && (
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              {URGENCIA[pedido.urgency] ?? pedido.urgency}
            </li>
          )}
          {pedido.precisaFatura && (
            <li className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              O cliente precisa de fatura
            </li>
          )}
          {pedido.precisaGuiaTransporte && (
            <li className="flex items-center gap-2">
              <Truck className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              O cliente precisa de guia de transporte
            </li>
          )}
        </ul>

        {/*
          O ACESSO — o que decide quanto tempo o trabalho leva.

          Um segundo andar sem elevador e sem sítio para encostar a carrinha
          não é o mesmo trabalho que um rés-do-chão com garagem, e o preço
          que ele propõe devia saber disso. Estes campos já eram perguntados
          ao cliente e já estavam guardados; o que faltava era chegarem aqui.

          Só aparece quando há alguma coisa para dizer: uma caixa a repetir
          "não perguntámos" quatro vezes ensina menos do que caixa nenhuma.
        */}
        {(pedido.floor ||
          emPortugues(ELEVADOR, pedido.hasElevator) ||
          emPortugues(ESTACIONAMENTO, pedido.parkingDistance) ||
          pedido.distanciaKm != null) && (
          <div className="mt-4 rounded-xl bg-[#F4F8FB] p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              O acesso
            </p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {pedido.distanciaKm != null && (
                <>
                  <dt className="text-slate-500">Distância</dt>
                  <dd className="font-semibold text-tinta">
                    {/*
                      "de si" dizia onde ele está AGORA; a conta é feita desde
                      a base que ele registou. A frase passa a dizer a verdade.
                    */}
                    {distanciaDaBase(pedido.distanciaKm, pedido.distanciaMedidaPor)}
                  </dd>
                </>
              )}
              {pedido.floor && (
                <>
                  <dt className="text-slate-500">Andar</dt>
                  <dd className="font-medium text-tinta">{pedido.floor}</dd>
                </>
              )}
              {emPortugues(ELEVADOR, pedido.hasElevator) && (
                <>
                  <dt className="text-slate-500">Elevador</dt>
                  <dd className="font-medium text-tinta">
                    {emPortugues(ELEVADOR, pedido.hasElevator)}
                  </dd>
                </>
              )}
              {emPortugues(ESTACIONAMENTO, pedido.parkingDistance) && (
                <>
                  <dt className="text-slate-500">Estacionar</dt>
                  <dd className="font-medium text-tinta">
                    {emPortugues(ESTACIONAMENTO, pedido.parkingDistance)}
                  </dd>
                </>
              )}
            </dl>
          </div>
        )}

        {/*
          A SEGUNDA PONTA DE UMA MUDANÇA.

          Uma mudança é levar as coisas de A para B, e ele só via o A. Propunha
          um valor sem saber se era para o prédio ao lado ou para o Porto, e
          sem saber se do outro lado havia elevador — que é uma hora inteira de
          diferença. Estava tudo guardado desde o primeiro dia; nunca tinha
          chegado aqui.
        */}
        {pedido.moradaDestino && (
          <div className="mt-3 rounded-xl bg-[#F4F8FB] p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Para onde vai
            </p>
            <p className="mt-1 text-sm font-semibold text-tinta">
              {/* A morada exacta é do trabalho fechado; até lá, a localidade. */}
              {fechado ? pedido.moradaDestino : pedido.localidadeDestino || pedido.moradaDestino}
            </p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {pedido.percursoKm != null && (
                <>
                  <dt className="text-slate-500">Percurso</dt>
                  <dd className="font-semibold text-tinta">
                    cerca de {String(pedido.percursoKm).replace(".", ",")} km daqui para lá
                  </dd>
                </>
              )}
              {pedido.andarDestino && (
                <>
                  <dt className="text-slate-500">Andar</dt>
                  <dd className="font-medium text-tinta">{pedido.andarDestino}</dd>
                </>
              )}
              {emPortugues(ELEVADOR, pedido.elevadorDestino) && (
                <>
                  <dt className="text-slate-500">Elevador</dt>
                  <dd className="font-medium text-tinta">
                    {emPortugues(ELEVADOR, pedido.elevadorDestino)}
                  </dd>
                </>
              )}
              {emPortugues(ESTACIONAMENTO, pedido.estacionamentoDestino) && (
                <>
                  <dt className="text-slate-500">Estacionar</dt>
                  <dd className="font-medium text-tinta">
                    {emPortugues(ESTACIONAMENTO, pedido.estacionamentoDestino)}
                  </dd>
                </>
              )}
            </dl>
          </div>
        )}

        {/*
          O ENTULHO EM NÚMEROS. Trinta sacos são uma manhã; trezentos são um
          dia inteiro e outro camião. E um saco no chão tem de ser ensacado
          primeiro — mais 30% de tempo, na conta do motor e na vida real.
        */}
        {(pedido.entulhoQuantidade || emPortugues(ESTADO_DO_ENTULHO, pedido.entulhoEstado)) && (
          <div className="mt-3 rounded-xl bg-[#F4F8FB] p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              O entulho
            </p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {pedido.entulhoQuantidade && (
                <>
                  <dt className="text-slate-500">Quantidade</dt>
                  <dd className="font-semibold text-tinta">
                    {pedido.entulhoQuantidade} sacos
                  </dd>
                </>
              )}
              {emPortugues(ESTADO_DO_ENTULHO, pedido.entulhoEstado) && (
                <>
                  <dt className="text-slate-500">Estado</dt>
                  <dd className="font-medium text-tinta">
                    {emPortugues(ESTADO_DO_ENTULHO, pedido.entulhoEstado)}
                  </dd>
                </>
              )}
            </dl>
          </div>
        )}
      </section>

      {/* Morada e contacto: só existem depois de ser contratado. */}
      {fechado && pedido.morada && (
        <section className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            Onde e com quem
          </h2>
          {/* O mapa antes da morada.
              Uma morada escrita obriga a imaginar onde fica; um mapa responde
              à pergunta que ele faz primeiro — "isto é longe?" — antes de
              ler uma palavra. É uma imagem estática servida por nós, para a
              chave da Google não sair para o browser. */}
          {!semMapa && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pedido.morada)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block overflow-hidden rounded-xl ring-1 ring-emerald-200"
              aria-label="Abrir a morada no mapa"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/mapa?q=${encodeURIComponent(pedido.morada)}&w=640&h=200`}
                alt=""
                className="h-36 w-full bg-emerald-100/50 object-cover"
                loading="lazy"
                onError={() => setSemMapa(true)}
              />
            </a>
          )}

          <p className="mt-2.5 flex items-start gap-2 text-sm text-emerald-900">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {pedido.morada}
          </p>
          {pedido.contactoNome && (
            <p className="mt-1.5 flex items-center gap-2 text-sm text-emerald-900">
              <User className="h-4 w-4 shrink-0" aria-hidden="true" />
              {pedido.contactoNome}
              {pedido.contactoTelefone && (
                <span className="text-emerald-700">· {pedido.contactoTelefone}</span>
              )}
            </p>
          )}
          {/*
            O contexto do cliente — só quando é real. Um cliente de telefone
            sem email não tem historial ligável, e aí não se mostra nada:
            inventar "cliente novo" seria adivinhar.
          */}
          {pedido.clienteContexto && (
            <p className="mt-1 pl-6 text-xs text-emerald-700">
              {pedido.clienteContexto.desde && (
                <>
                  Cliente desde{" "}
                  {new Date(pedido.clienteContexto.desde).toLocaleDateString("pt-PT", {
                    month: "long",
                    year: "numeric",
                  })}
                </>
              )}
              {pedido.clienteContexto.desde && pedido.clienteContexto.confirmados > 0 && " · "}
              {pedido.clienteContexto.confirmados > 0 && (
                <>
                  {pedido.clienteContexto.confirmados} trabalho
                  {pedido.clienteContexto.confirmados === 1 ? "" : "s"} confirmado
                  {pedido.clienteContexto.confirmados === 1 ? "" : "s"}
                </>
              )}
            </p>
          )}

          {/* Levar lá.
              A morada escrita não serve de nada a alguém que está a sair de
              casa com a carrinha: teria de a copiar, abrir o mapa e colar. Dois
              botões poupam esse minuto, e o minuto é dele.

              Waze e Maps, os dois: quem conduz todos os dias tem um deles
              instalado e não muda por nossa causa. Os dois links funcionam no
              browser se a aplicação não estiver lá. */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pedido.morada)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-800 transition active:bg-emerald-50"
            >
              <Navigation className="h-4 w-4" aria-hidden="true" />
              Google Maps
            </a>
            <a
              href={`https://waze.com/ul?q=${encodeURIComponent(pedido.morada)}&navigate=yes`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-800 transition active:bg-emerald-50"
            >
              <Navigation className="h-4 w-4" aria-hidden="true" />
              Waze
            </a>
          </div>

          {pedido.contactoTelefone && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <a
                href={`tel:${pedido.contactoTelefone}`}
                className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white transition active:bg-emerald-700"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                Ligar
              </a>
              {/* O número vai sem espaços nem sinais: o WhatsApp recusa
                  qualquer coisa que não sejam dígitos, e um "+351 912..."
                  colado tal e qual abria uma conversa vazia. */}
              <a
                href={`https://wa.me/${pedido.contactoTelefone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 text-sm font-semibold text-white transition active:brightness-95"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                WhatsApp
              </a>
            </div>
          )}
        </section>
      )}

      {/* O valor */}
      <section className="mt-3 rounded-2xl border border-[#E2EEF3] bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between gap-4">
          <span className="flex items-center gap-1.5 text-sm text-slate-600">
            <HandCoins className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            {fechado ? "Recebe" : "Recebe se aceitar"}
          </span>
          <span className="text-2xl font-bold text-emerald-600">
            {euros(fechado ? pedido.recebeSeFechado : pedido.recebeSeAceitar)}
          </span>
        </div>
        <p className="mt-1 text-right text-xs text-slate-400">já com a taxa CLYON descontada</p>
      </section>

      {/* ── A fase do trabalho ─────────────────────────────────────────────── */}
      {fechado && pedido.fase === "a_executar" && (
        <section className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
          <h2 className="text-base font-bold text-cyan-900">Quando estiver feito</h2>
          <p className="mt-1 text-sm leading-relaxed text-cyan-800">
            Fotografe o resultado e marque como feito. É o que o cliente vê antes de
            confirmar — e é o que liberta o seu dinheiro.
          </p>

          <div className="mt-3">
            <EnviarFotos fotos={fotos} onMudar={setFotos} maximo={8} rotulo="Fotografar" />
          </div>

          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Alguma coisa a dizer ao cliente? (opcional)"
            className="mt-3 w-full rounded-xl border-2 border-cyan-200 bg-white p-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500"
          />

          {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}

          <button
            onClick={marcarFeito}
            disabled={aEnviar || fotos.length === 0}
            className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-base font-bold text-white transition active:bg-cyan-700 disabled:opacity-40"
          >
            {aEnviar && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            Está feito
          </button>
        </section>
      )}

      {fechado && pedido.fase === "a_confirmar" && (
        <section className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-cyan-900">
            <Clock className="h-5 w-5" aria-hidden="true" />À espera do cliente
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-cyan-800">
            Enviou a prova. O valor fica cativo até ele confirmar
            {pedido.diasAteLibertar != null && (
              <> — e liberta-se sozinho ao fim de {Math.ceil(pedido.diasAteLibertar)} dia
              {Math.ceil(pedido.diasAteLibertar) === 1 ? "" : "s"} se ele não disser nada</>
            )}
            .
          </p>
          {prova && prova.fotos.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {prova.fotos.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setAVer({ lista: prova.fotos, i })}
                  className="block overflow-hidden rounded-lg bg-slate-900 ring-1 ring-cyan-200"
                  aria-label={`Abrir prova ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Prova ${i + 1}`} className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {fechado && (pedido.fase === "confirmado" || pedido.fase === "pago") && (
        <section className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <BadgeCheck className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
          <h2 className="mt-1 text-base font-bold text-emerald-900">
            {pedido.fase === "pago" ? "Pago" : "Confirmado pelo cliente"}
          </h2>
          <p className="mt-1 text-sm text-emerald-800">
            {pedido.fase === "pago"
              ? "Este valor já foi transferido."
              : "O valor está disponível na sua carteira."}
          </p>
        </section>
      )}

      {/* A negociação, aqui dentro.
          Vivia só no link do email, e isso obrigava-o a guardar mensagens
          antigas para trabalhar — ao terceiro pedido já não sabia qual era
          qual. O link continua a funcionar; deixou é de ser o único caminho. */}
      {!fechado && pedido.estado !== "desistida" && pedido.estado !== "morta" && (
        <NegociacaoProfissional
          negociacaoId={pedido.negociacaoId}
          estadoInicial={pedido.estado}
          propostasIniciais={propostasDe(pedido.propostas)}
          valorAcordado={pedido.valorAcordado}
          minimoDoCliente={pedido.querPagar}
          recebeSeAceitar={
            pedido.querPagar != null ? quantoOProfissionalRecebe(pedido.querPagar) : null
          }
          onMudou={onRecarregar}
        />
      )}

      {/* O histórico fica FORA da negociação, e por isso sobrevive-lhe.
          A negociação deixa de ser desenhada quando o trabalho fecha — tem lá
          dentro os botões de propor e aceitar — e levava o registo com ela.
          O que aconteceu é justamente o que tem de ficar depois de acabar. */}
      <HistoricoDaNegociacao
        propostas={propostasDe(pedido.propostas)}
        marcos={{
          execucaoEnviadaEm: pedido.execucaoEnviadaEm,
          confirmadoEm: pedido.confirmadoEm,
          pagoEm: pedido.pagoEm,
          avaliadoEm: pedido.avaliadoEm,
          estrelas: pedido.estrelas,
          valorAcordado: pedido.valorAcordado,
        }}
        euSou="profissional"
      />

      {aVer && (
        <VisorDeFotos
          fotos={aVer.lista}
          indiceInicial={aVer.i}
          onFechar={() => setAVer(null)}
        />
      )}
    </>
  );
}
