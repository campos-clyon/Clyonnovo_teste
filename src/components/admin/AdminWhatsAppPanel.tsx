"use client";

import { useProcuraDoBackoffice } from "@/components/admin/NoutrosSitios";

import AvisosDaEquipa from "@/components/admin/AvisosDaEquipa";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import {
  Archive,
  ArchiveRestore,
  Ban,
  BookOpen,
  Bookmark,
  BookmarkX,
  Bot,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  GraduationCap,
  Hand,
  Loader2,
  MoreHorizontal,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Trash2,
  Undo2,
  Wrench,
  X,
} from "lucide-react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import { lerCodigoDeOrigem, origemDaConversa } from "@/lib/codigo-de-origem";
import AdminAssistenteAutoPanel from "./AdminAssistenteAutoPanel";
import AdminLicoesDaVitoriaPanel from "./AdminLicoesDaVitoriaPanel";
import RegistarPedido from "./RegistarPedido";
import { camposDaRecolha } from "@/lib/pedido-da-recolha";
import { telefoneLegivel } from "@/lib/telefone-legivel";
import { numeroParaWhatsApp } from "@/lib/link-de-whatsapp";
import { linhaQueAbre } from "@/lib/linha-que-abre";
import TelefoneComWhatsApp from "./TelefoneComWhatsApp";
import { hojeOuOntem } from "@/lib/hora-de-lisboa";
import { conversasVisiveis, procuraActiva } from "@/lib/procurar-conversas";
import { fichaDaPonte, type EstadoDaPonte } from "@/lib/ponte-viva";
import { linhaDaFalha, type FalhaDaIa } from "@/lib/saude-da-ia";
import { eDaEquipa, semMarcaDeMao } from "@/lib/rajada-do-whatsapp";
import { linhaDaEntrega } from "@/lib/sinais-da-equipa";
import {
  contarNaMesa,
  eEsperaAntiga,
  haQuanto,
  linhasDoSeparador,
  PASSO_DA_RECOLHA,
  SEPARADORES_DA_MESA,
  type ConversaNaMesa,
  type EstadoNaMesa,
  type SeparadorDaMesa,
} from "@/lib/mesa-das-conversas";
import { TELEFONE_DA_CLYON_DIGITOS } from "@/lib/telefone-da-clyon";
import {
  DESCARTADA_SOZINHA,
  deQuemEAVez,
  inicioDoTexto,
  quemNaLinha,
  resumoDoTopo,
  SEPARADORES_A_VISTA,
  SEPARADORES_NO_MAIS,
} from "@/lib/arrumar-o-whatsapp";

/**
 * O painel de controlo do WhatsApp da plataforma.
 *
 * UMA MESA, E NÃO QUATRO LISTAS.
 *
 * Este ecrã teve quatro listas de números ao mesmo tempo — conversas,
 * entregues a si, bloqueados, fila — e o mesmo número aparecia em três delas.
 * Para saber quem estava a falar com quem era preciso lê-las todas e cruzá-las
 * de cabeça. "Organize essa tela para ser mais prático, simples e intuitivo, e
 * que não fique poluída de informações."
 *
 * Agora há uma lista só, e as antigas são separadores dela: o estado de cada
 * número é um distintivo na própria linha, e as acções vivem ao lado do que
 * afectam em vez de num formulário à parte.
 *
 *   Assistente  → o cérebro responde; vê-se em que passo da recolha vai.
 *   Entregue    → uma pessoa está nessa conversa; o cérebro cala-se NELA.
 *   Arquivada   → tratada, fora da mesa. Não se apagou nada.
 *   Bloqueada   → nunca ninguém automático lhe fala, e o que escrever é ignorado.
 *   DESLIGADO   → um gesto e cala-se tudo, em todas as conversas.
 *
 * Entregar acontece sozinho quando ele responde à mão no WhatsApp — o Winapp
 * avisa o site. Aqui é onde se VÊ isso, e onde se devolve.
 */

type Estado = {
  ligado: boolean;
  /**
   * "manual" é o número da CLYON à mão, sem API: o que o cérebro escreve fica
   * na fila e envia-se daqui com um clique — "ative o WhatsApp no painel sem a
   * API por agora", 09-09-2026.
   */
  canal: "meta" | "ponte" | "manual" | "nenhum";
  numeroManual?: string | null;
  interrompidos: Array<{ telefone: string; motivo: string | null; criadoEm: string }>;
  bloqueados: Array<{ telefone: string; nota: string | null; criadoEm: string }>;
  fila: Array<{ id: number; telefone: string; texto: string }>;
  conversas: Array<{ telefone: string; ultimaMensagem: string; direccao: string; quando: string }>;
  /** Os números a meio da recolha de um pedido pelo assistente, e o passo. */
  recolhas?: Array<{ telefone: string; passo: string; actualizadoEm: string }>;
  /** As que já foram dadas por tratadas. Saem da mesa, não do registo. */
  arquivadas?: Array<{ telefone: string; criadoEm: string }>;
  /** A mesa das conversas: o que falta fazer em cada uma, e porquê (21-10-2026). */
  mesa?: ConversaNaMesa[];
  /** Porque é que a mesa não veio — para não a confundir com uma mesa vazia (23-10-2026). */
  mesaFalhou?: string | null;
  /** Há quanto tempo a ponte leu o telemóvel. `null` = nunca (23-10-2026). */
  telemovelLidoHaSegundos?: number | null;
  /**
   * A leitura das mensagens está em baixo? `null` quando está de pé.
   *
   * Sem isto, uma quota esgotada do Gemini é indistinguível de tudo estar bem:
   * o assistente volta às palavras-chave e ninguém dá por nada.
   */
  compreensao?: { quando: string; motivo: string } | null;
  /**
   * As mensagens com mais de 2 h na fila, que não saíram sozinhas — a equipa
   * decide se ainda as envia (27-10-2026, d7). Ver `fila-do-cliente.ts`.
   */
  atrasadas?: Array<{ id: number; telefone: string; texto: string; haMinutos: number }>;
  /** O termómetro do tradutor, da leitura das conversas e das fotografias (d7). */
  ia?: FalhaDaIa[];
  /**
   * Quando a ponte cá veio pela última vez, em ISO. `null` = nunca.
   *
   * Quando ela morre, o site continua a parecer normal — o assistente
   * escreve, a fila enche-se, e ninguém vê. Ver `ponte-viva.ts`.
   */
  ponteVistaEm?: string | null;
  /** As descartadas dos últimos 7 dias, com quem e porquê (d124). */
  descartadas?: Array<{ id: number; telefone: string; texto: string; haMinutos: number; por: string | null; porque: string | null }>;
};

type Mensagem = { direccao: string; texto: string; criadoEm: string };

/**
 * O separador aberto — um estado da mesa, as guardadas (21-10-2026) ou as
 * dos profissionais registados (13-11-2026, d21).
 *
 * Os separadores antigos diziam QUEM tinha a conversa (o assistente, uma
 * pessoa, arquivada). Estes dizem O QUE FALTA FAZER — ver
 * `mesa-das-conversas.ts`. Quem a tem passou a ser uma etiqueta da linha.
 */
type Separador = SeparadorDaMesa;

/** Uma linha da mesa: a conversa no pé em que está, e o texto onde se procura. */
type Linha = ConversaNaMesa & { nota: string };

const CAIXA =
  "rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";

/** O botão pequeno das acções de uma linha. */
const ACCAO =
  "flex min-h-[34px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition disabled:opacity-40";

/*
 * Esta função era uma cópia, palavra por palavra, da que estava no painel do
 * assistente — e eu ia escrever uma terceira para a mesa. Três cópias de seis
 * linhas é como um número passa a aparecer de três maneiras no mesmo ecrã.
 */
const formatarTelefone = (t: string) => telefoneLegivel(t, { comIndicativo: true });

/**
 * QUEM É ESTE NÚMERO, SEM O NÚMERO — d124. Pela linha da mesa desse número
 * (os últimos 9 dígitos): o nome, o profissional, ou o pedido.
 */
function quemPeloTelefone(mesa: ConversaNaMesa[] | undefined, telefone: string): string {
  const chave = telefone.replace(/\D/g, "").slice(-9);
  const l = mesa?.find((c) => c.telefone.replace(/\D/g, "").slice(-9) === chave);
  return quemNaLinha({ telefone, nome: l?.nome, profissional: l?.profissional, pedido: l?.pedido });
}

/**
 * «VER NÚMERO» — d124 (25-11-2026). O telefone deixou de estar à vista na
 * lista e na fila; aparece só a pedido, com o link que abre o WhatsApp do
 * cliente e o botão de o copiar.
 */
function VerNumero({ telefone }: { telefone: string }) {
  const [visto, setVisto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  if (!visto) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setVisto(true);
        }}
        className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 underline decoration-dotted underline-offset-2 hover:text-slate-200"
      >
        Ver número
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
      <TelefoneComWhatsApp telefone={telefone} className="font-mono text-slate-200 underline decoration-dotted underline-offset-2">
        {formatarTelefone(telefone)}
      </TelefoneComWhatsApp>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(formatarTelefone(telefone));
            setCopiado(true);
            window.setTimeout(() => setCopiado(false), 1500);
          } catch {
            /* sem área de transferência: o número está à vista */
          }
        }}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      >
        <Copy className="h-3 w-3" aria-hidden="true" />
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </span>
  );
}

function desde(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-PT", {
        timeZone: "Europe/Lisbon",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/** O desenho de cada estado, num sítio só — o distintivo e o separador leem daqui. */
const CORES: Record<Separador, string> = {
  por_responder: "bg-red-500/15 text-red-300",
  a_meio: "bg-amber-500/15 text-amber-300",
  a_espera: "bg-sky-500/15 text-sky-300",
  com_pedido: "bg-violet-500/15 text-violet-300",
  guardada: "bg-cyan-500/15 text-cyan-300",
  // Os profissionais (d21): o laranja da paleta, que nenhum outro separador usa.
  profissionais: "bg-laranja/14 text-laranja-texto",
  resolvida: "bg-emerald-500/15 text-emerald-300",
  bloqueada: "bg-slate-700/60 text-slate-300",
};

/**
 * QUEM DISSE A ÚLTIMA PALAVRA — 23-10-2026. *«Quem foi o último a mandar
 * mensagem, ou se fomos nós.»* — o dono. Ao lado da hora, em todas as linhas.
 */
const ULTIMA_PALAVRA: Record<NonNullable<ConversaNaMesa["quemFalou"]>, { texto: string; cor: string }> = {
  cliente: { texto: "Última: cliente", cor: "text-red-300" },
  vitoria: { texto: "Última: Vitória", cor: "text-sky-300" },
  equipa: { texto: "Última: equipa", cor: "text-sky-300" },
};

/** O pedido do número: em curso, acabado bem, ou acabado sem trabalho. */
function corDoPedido(p: NonNullable<ConversaNaMesa["pedido"]>): string {
  if (!p.fechado) return "bg-violet-500/15 text-violet-300";
  return p.estado === "concluído" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700/60 text-slate-300";
}

/**
 * Há quanto tempo a ponte leu o telemóvel, e se isso ainda chega. Ela lê de
 * 10 em 10 minutos; passada meia hora, o que a mesa diz das respostas à mão
 * pode estar velho.
 */
function leituraDoTelemovel(haSegundos: number | null | undefined): { texto: string; aviso: boolean } {
  if (haSegundos == null) {
    return { texto: "O telemóvel ainda não foi lido — as respostas dadas à mão podem faltar", aviso: true };
  }
  const minutos = Math.floor(haSegundos / 60);
  const quando = minutos < 1 ? "agora mesmo" : minutos < 60 ? `há ${minutos} min` : `há ${Math.floor(minutos / 60)} h`;
  return { texto: `Telemóvel lido ${quando}`, aviso: haSegundos > 30 * 60 };
}

/** A cor do porquê de cada linha — o mesmo tom do separador. */
const COR_DO_PORQUE: Record<EstadoNaMesa, string> = {
  por_responder: "text-red-300",
  a_meio: "text-amber-300",
  a_espera: "text-sky-300",
  com_pedido: "text-violet-300",
  resolvida: "text-emerald-300",
  bloqueada: "text-slate-400",
};

/** O sinal da ponte: o ponto, o texto e o fundo de cada estado. */
const SINAL_DA_PONTE: Record<EstadoDaPonte, { ponto: string; texto: string }> = {
  viva: { ponto: "bg-emerald-400", texto: "text-emerald-300" },
  "a-demorar": { ponto: "bg-amber-400", texto: "text-amber-300" },
  calada: { ponto: "bg-red-500", texto: "text-red-300" },
  nunca: { ponto: "bg-red-500", texto: "text-red-300" },
};

/*
 * O FIO, COM A CARA DO WHATSAPP.
 *
 * "Quero que ele pareça com WhatsApp real." Havia razão para o pedido: os
 * balões ocupavam a largura toda do monitor, e um fio que se lê de ponta a
 * ponta de um ecrã de 1600 px não se lê como conversa — lê-se como tabela. A
 * mensagem da cliente com os 350 € por carga era um retângulo de mil e
 * trezentos pixels.
 *
 * As cores são as do WhatsApp escuro, escritas à mão e não tiradas dos tokens
 * do backoffice. Aqui o objectivo é o reconhecimento imediato de quem passa o
 * dia na aplicação a sério, e uma aproximação em slate não o dá.
 */
const WA = {
  fundo: "#0b141a",
  recebida: "#202c33",
  enviada: "#005c4b",
  texto: "#e9edef",
  hora: "rgba(233,237,239,0.55)",
  dia: "#182229",
};

/** "Hoje", "Ontem" ou a data — os separadores de dia do WhatsApp. */
function diaDaMensagem(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Os dias são os de Lisboa, e não os do computador de quem abre o painel.
  const qual = hojeOuOntem(d);
  if (qual === "hoje") return "Hoje";
  if (qual === "ontem") return "Ontem";
  return d.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Só as horas: é o que o WhatsApp mostra dentro do balão. */
function horaDaMensagem(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit" });
}

/**
 * O bico do balão — o triângulo que aponta a quem falou.
 *
 * Só no primeiro de cada seguida, como no WhatsApp: repetido em todas as
 * mensagens faz uma serra pela conversa abaixo.
 */
function Bico({ saida }: { saida: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute top-0 h-3 w-2 ${saida ? "right-[-7px]" : "left-[-7px]"}`}
      style={{
        backgroundColor: saida ? WA.enviada : WA.recebida,
        clipPath: saida ? "polygon(0 0, 100% 0, 0 100%)" : "polygon(0 0, 100% 0, 100% 100%)",
      }}
    />
  );
}

/** O fio inteiro de uma conversa, desenhado como o WhatsApp o desenha. */
/*
 * DE ONDE VEIO — 22-10-2026. «Quer que o backoffice mostre a origem já
 * traduzida em cada conversa?» — «SIM», o dono. Lê o código «(A1)» que o site
 * junta à mensagem (codigo-de-origem.ts).
 */
function OrigemDaConversa({ mensagens }: { mensagens: Mensagem[] }) {
  if (!mensagens.some((m) => m.direccao === "in")) return null;
  const codigo = origemDaConversa(mensagens);
  const lida = codigo ? lerCodigoDeOrigem(codigo) : null;
  return (
    <p className="mb-2 text-xs text-slate-400">
      <span className="font-semibold text-slate-300">Origem: </span>
      {lida ?? "escreveu sem passar por um botão do site nem pelo anúncio (Google Maps, Fixando ou já tinha o número)"}
    </p>
  );
}

function FioDaConversa({ mensagens }: { mensagens: Mensagem[] }) {
  return (
    <div
      className="max-h-[26rem] overflow-y-auto rounded-xl px-3 py-2"
      style={{
        backgroundColor: WA.fundo,
        // O papel de parede não se copia; a textura discreta por baixo dos
        // balões é o que faz o fundo não parecer uma caixa vazia.
        backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      {mensagens.length === 0 && (
        <p className="py-6 text-center text-xs" style={{ color: WA.hora }}>
          Sem mensagens registadas.
        </p>
      )}
      {mensagens.map((m, i) => {
        const anterior = mensagens[i - 1];
        const saida = m.direccao === "out";
        const diaNovo =
          !anterior || diaDaMensagem(anterior.criadoEm) !== diaDaMensagem(m.criadoEm);
        // Uma "seguida" são mensagens do mesmo lado sem nada pelo meio: só a
        // primeira leva bico, e as outras encostam-se a ela.
        const primeiraDaSeguida = diaNovo || !anterior || anterior.direccao !== m.direccao;
        return (
          <div key={i}>
            {diaNovo && (
              <div className="my-3 flex justify-center">
                <span
                  className="rounded-lg px-3 py-1 text-[11px] font-medium uppercase tracking-wide"
                  style={{ backgroundColor: WA.dia, color: WA.hora }}
                >
                  {diaDaMensagem(m.criadoEm)}
                </span>
              </div>
            )}
            <div
              className={`flex ${saida ? "justify-end" : "justify-start"} ${
                primeiraDaSeguida ? "mt-2" : "mt-[2px]"
              }`}
            >
              <div
                className="relative max-w-[75%] rounded-lg px-2.5 py-1.5 shadow-[0_1px_0.5px_rgba(0,0,0,0.3)]"
                style={{
                  backgroundColor: saida ? WA.enviada : WA.recebida,
                  color: WA.texto,
                  // O canto de onde sai o bico é recto — é o que dá a forma.
                  borderTopRightRadius: saida && primeiraDaSeguida ? 0 : undefined,
                  borderTopLeftRadius: !saida && primeiraDaSeguida ? 0 : undefined,
                }}
              >
                {primeiraDaSeguida && <Bico saida={saida} />}
                <p className="whitespace-pre-wrap break-words text-sm leading-snug">
                  {/*
                    A hora flutua à direita e o texto corre à volta dela — é
                    assim que o WhatsApp mete as duas coisas na mesma linha
                    quando cabem, e empurra para baixo quando não cabem.
                  */}
                  <span
                    className="float-right ml-2 mt-1.5 inline-flex items-center gap-1 text-[10px] leading-none"
                    style={{ color: WA.hora }}
                  >
                    {horaDaMensagem(m.criadoEm)}
                    {saida && <CheckCheck className="h-3 w-3" aria-hidden="true" />}
                  </span>
                  {/* A resposta da equipa, escrita à mão no telemóvel (21-10-2026). */}
                  {saida && eDaEquipa(m.texto) && (
                    <span className="mr-1.5 rounded bg-black/25 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                      à mão
                    </span>
                  )}
                  {saida ? semMarcaDeMao(m.texto) : m.texto}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


export default function AdminWhatsAppPanel() {
  const { token, ready } = useAdminAuth();
  // Excluir é só do administrador — a rota recusa a um assistente (23-10-2026).
  const eAdmin = useEAdministrador();
  /*
   * AS MARCADAS — 23-10-2026. *«Marcar várias e excluir várias de uma vez; e
   * não só excluir — as opções todas que criámos.»* — o dono. Vale para o
   * separador aberto: mudar de separador desmarca tudo.
   */
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set());
  const [avisoDoLote, setAvisoDoLote] = useState("");
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  // A Vitória a ler as conversas, e o que disse no fim (21-10-2026).
  const [aLer, setALer] = useState(false);
  const [avisoDaLeitura, setAvisoDaLeitura] = useState("");
  const [separador, setSeparador] = useState<Separador>("por_responder");
  // As conversas ou as lições da Vitória (27-10-2026, d11).
  const [vistaDoPainel, setVistaDoPainel] = useState<"conversas" | "licoes">("conversas");
  const [licoesPorRever, setLicoesPorRever] = useState(0);
  /*
   * A PROCURA, e porque é que ela ignora o separador.
   *
   * Quem chega aqui com um número na mão não sabe em qual das quatro listas
   * ele está — é essa a pergunta. A regra vive em `procurar-conversas.ts`,
   * fora do painel, porque é a única coisa deste ecrã que se pode provar.
   */
  /*
   * A PROCURA É A DA BARRA DO TOPO — d79 (20-11-2026). O «Do nosso lado» da
   * Mesa e o «Em todo o backoffice» abrem aqui uma conversa pelo telefone, que
   * vem escrito na barra.
   */
  const { termo: procura } = useProcuraDoBackoffice();
  const [aAdicionar, setAAdicionar] = useState(false);
  const [numeroNovo, setNumeroNovo] = useState("");
  const [notaNova, setNotaNova] = useState("");
  const [conversaAberta, setConversaAberta] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  /*
   * CRIAR O PEDIDO DA CONVERSA — 07-10-2026. *«Queria já poder criar esse
   * pedido.»* O assistente junta o pedido pergunta a pergunta e só o regista
   * com o SIM do cliente; daqui, quem lê a conversa cria-o já, com o
   * formulário preenchido com o que ele recolheu (`pedido-da-recolha.ts`).
   */
  const [recolhaAberta, setRecolhaAberta] = useState<{
    dados: Record<string, unknown>;
    pedidoId: number | null;
  } | null>(null);
  const [aCriarPedido, setACriarPedido] = useState<string | null>(null);
  const [resposta, setResposta] = useState("");
  const [aResponder, setAResponder] = useState(false);
  const [erroDaResposta, setErroDaResposta] = useState("");
  /* O que ACONTECEU, quando correu bem. A caixa dos erros e vermelha, e uma
   * confirmacao em vermelho le-se como uma avaria. */
  const [notaDaResposta, setNotaDaResposta] = useState("");
  /*
   * À mão, os links abrem o WhatsApp Web deste computador. A secção com a
   * escolha Web/telemóvel saiu a pedido do dono ("remova isso, não era o que
   * queria"): o caminho a sério é a ponte (ponte-whatsapp/), não isto.
   */
  const porOnde: "web" | "telemovel" = "web";
  // "Chegou uma resposta": o que o cliente escreveu no WhatsApp Web, colado aqui.
  const [numeroRecebido, setNumeroRecebido] = useState("");
  const [textoRecebido, setTextoRecebido] = useState("");
  const [aRegistar, setARegistar] = useState(false);
  const [avisoRecebido, setAvisoRecebido] = useState("");
  /**
   * A releitura da conversa, antes de sair.
   *
   * Duas fases de propósito: um campo inventado mas bem formado — um código
   * postal com quatro dígitos e três que ninguém deu — passa em todos os
   * validadores sem uma queixa. O único guarda contra isso são olhos humanos,
   * e é por isso que se VÊ antes de o cliente ouvir.
   */
  // A mensagem da releitura, como quem a vai mandar a deixou (23-10-2026).
  const [textoDaReleitura, setTextoDaReleitura] = useState("");
  const [releitura, setReleitura] = useState<{
    telefone: string;
    recuperados: string[];
    mensagem: string;
    completo: boolean;
    linhasLidas: number;
    /*
     * DUAS CONVERSAS DIFERENTES POR DEBAIXO DO MESMO BOTÃO.
     *
     * Na recolha, reler reconstrói campos e pergunta o que falta. Numa conversa
     * de propostas não há campos nenhuns: o que se faz é voltar a passar pelo
     * assistente a última mensagem do cliente. As palavras do aviso mudam com
     * isso — falar de «campos que ele nunca disse» a quem só quer uma resposta
     * a um «Não» é explicar-lhe uma coisa que não está a acontecer.
     */
    propostas?: boolean;
    ultima?: string;
    pedido?: number;
    /**
     * Não se releu — só se continua.
     *
     * Reler e continuar são duas coisas, e só a primeira precisa do Gemini.
     * Com a quota esgotada, o botão devolvia um erro e deixava a conversa
     * onde estava: nem lia, nem continuava. Agora repete a pergunta do passo
     * onde ela ficou — e diz que foi só isso, porque deixar passar por
     * releitura o que foi repetir a pergunta punha quem carregou a acreditar
     * que os campos tinham sido recuperados.
     */
    semLeitura?: boolean;
  } | null>(null);
  const [aReler, setAReler] = useState(false);
  // O «Testar agora» da faixa da compreensão (12-10-2026).
  const [aTestar, setATestar] = useState(false);
  const [resultadoDoTeste, setResultadoDoTeste] = useState("");
  /*
   * O ECRÃ ARRUMADO — d124 (25-11-2026): o «⋯» do cabeçalho e o de cada linha,
   * o «Mais» dos separadores e o da conversa aberta, as mensagens da fila
   * abertas por inteiro, e as descartadas.
   */
  const [opcoesAbertas, setOpcoesAbertas] = useState(false);
  const [menuDaLinha, setMenuDaLinha] = useState<string | null>(null);
  const [maisAberto, setMaisAberto] = useState(false);
  const [maisNaConversa, setMaisNaConversa] = useState(false);
  const [textosAbertos, setTextosAbertos] = useState<Set<number>>(() => new Set());
  const [descartadasAbertas, setDescartadasAbertas] = useState(false);
  const alternarTexto = (id: number) =>
    setTextosAbertos((antes) => {
      const novos = new Set(antes);
      if (novos.has(id)) novos.delete(id);
      else novos.add(id);
      return novos;
    });

  const carregar = useCallback(async (silencioso = false) => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/whatsapp", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar.");
        return;
      }
      setEstado(dados);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    }
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    void carregar();
    /*
     * O CICLO NÃO ESTÁ AQUI — está no pulso partilhado, mais abaixo. Havia um
     * temporizador próprio de trinta em trinta segundos E o hook: o painel
     * carregava a dobrar, em momentos diferentes. Aqui fica só a primeira
     * leitura.
     */
  }, [ready, carregar]);

  /*
   * NOVIDADES SEM F5 — 16-09-2026.
   *
   * "sempre que quero ver as novidades tenho que ficar atualizando tudo, mas
   * isso não devia acontecer (…) como no WhatsApp, quando alguém envia
   * mensagem." Catorze dos dezasseis painéis deste backoffice não tinham
   * ciclo nenhum.
   *
   * Silencioso de propósito: não mexe no estado de carregamento, não grita
   * erros de rede, pára com o separador escondido e volta a buscar assim que
   * ele reaparece.
   */
  useAutoRefresh(() => carregar(true), { enabled: ready && Boolean(token) });

  const agir = useCallback(
    async (accao: string, telefone?: string, nota?: string) => {
      if (!token) return;
      setOcupado(true);
      try {
        const res = await fetch("/api/admin/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ accao, telefone, nota }),
        });
        const dados = await res.json();
        if (!res.ok) {
          setErro(dados.error ?? "Não foi possível.");
          return;
        }
        setErro("");
        await carregar();
      } catch {
        setErro("Erro de rede.");
      } finally {
        setOcupado(false);
      }
    },
    [token, carregar],
  );

  /** Fechar com o porquê — na linha e dentro da conversa (23-10-2026: também na linha). */
  const fecharComMotivo = useCallback(
    (telefone: string) => {
      const motivo = window.prompt(
        "Porque fica resolvida? (ex.: «serviço feito», «cliente desistiu», «só queria informação»)",
      );
      if (motivo !== null) void agir("fechar", telefone, motivo.trim() || undefined);
    },
    [agir],
  );

  /**
   * Uma acção a várias conversas de uma vez — ver a acção «emLote» da rota.
   * Diz no fim quantas correram, e quais não e porquê.
   */
  const emLote = useCallback(
    async (deCada: string, telefones: string[], nota?: string) => {
      if (!token || telefones.length === 0) return;
      setOcupado(true);
      setAvisoDoLote("");
      try {
        const res = await fetch("/api/admin/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ accao: "emLote", deCada, telefones, nota }),
        });
        const d = await res.json();
        if (!res.ok) {
          setAvisoDoLote(d.error ?? "Não foi possível.");
          return;
        }
        const falhas: Array<{ telefone: string; porque: string }> = d.falhas ?? [];
        const partes = [`Feito em ${d.feitas} de ${telefones.length}.`];
        if (Array.isArray(d.pedidosApagados) && d.pedidosApagados.length > 0) {
          partes.push(`Pedidos apagados: ${d.pedidosApagados.map((n: number) => `#${n}`).join(", ")}.`);
        }
        if (d.porFazer > 0) partes.push(`Ficaram ${d.porFazer} por fazer — carregue outra vez.`);
        for (const f of falhas) partes.push(`${quemPeloTelefone(estado?.mesa, f.telefone)}: ${f.porque}`);
        setAvisoDoLote(partes.join(" "));
        setMarcadas(new Set(falhas.map((f) => f.telefone)));
        await carregar();
      } catch {
        setAvisoDoLote("Erro de rede.");
      } finally {
        setOcupado(false);
      }
    },
    [token, carregar, estado],
  );

  /*
   * EXCLUIR — 23-10-2026. A conversa, os pedidos sem trabalho combinado e
   * tudo o que a Vitória sabia: se o cliente voltar, começa do zero. Ver
   * `esquecerNumeroWhatsApp`. Pergunta-se sempre antes, com os pedidos à vista.
   */
  const excluir = useCallback(
    (telefones: string[], pedidos: number[]) => {
      if (telefones.length === 0) return;
      const quem = telefones.length === 1 ? quemPeloTelefone(estado?.mesa, telefones[0]) : `${telefones.length} conversas`;
      // Os da linha — no fim diz-se quais se apagaram mesmo: um com trabalho pago fica.
      const naLinha = pedidos.length === 0 ? "" : ` (na lista: ${pedidos.map((n) => `#${n}`).join(", ")})`;
      const sim = window.confirm(
        `Excluir ${quem}?\n\n` +
          `Apaga a conversa, os pedidos sem trabalho combinado ou pago${naLinha}, e tudo o que ` +
          "a Vitória sabia: se o cliente voltar a escrever, começa do zero.\n\n" +
          "Os pedidos apagados ficam no arquivo dos apagados (Configs). Não se desfaz.",
      );
      if (!sim) return;
      setConversaAberta(null);
      void emLote("excluir", telefones);
    },
    [emLote, estado],
  );

  /*
   * PEDIR À VITÓRIA PARA LER — 21-10-2026. Sem número, as conversas paradas
   * com novidades (o mesmo que o cron faz de 15 em 15 minutos); com número,
   * só essa. Ela fecha as que acabaram, com o porquê, e nunca escreve ao
   * cliente — ver `ler-as-conversas.ts`.
   */
  const pedirLeitura = useCallback(
    async (telefone?: string) => {
      if (!token) return;
      setALer(true);
      setAvisoDaLeitura("");
      try {
        const res = await fetch("/api/admin/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ accao: "lerConversas", telefone }),
        });
        const d = await res.json();
        if (!res.ok) {
          setAvisoDaLeitura(d.error ?? "A Vitória não conseguiu ler.");
        } else if (d.lidas === 0 && d.falhas === 0) {
          setAvisoDaLeitura(
            telefone ? "Nada para ler nesta conversa." : "Não há conversas paradas com novidades para ler.",
          );
        } else {
          setAvisoDaLeitura(
            `A Vitória leu ${d.lidas} conversa${d.lidas === 1 ? "" : "s"} e fechou ${d.fechadas}` +
              (d.falhas ? `; ${d.falhas} não se conseguiram ler` : "") +
              (!telefone && d.porLer > 0 ? `. Ficam ${d.porLer} por ler — carregue outra vez, ou o cron trata delas.` : "."),
          );
        }
        await carregar();
      } catch {
        setAvisoDaLeitura("Erro de rede.");
      } finally {
        setALer(false);
      }
    },
    [token, carregar],
  );

  const abrirConversa = useCallback(
    async (telefone: string) => {
      if (!token) return;
      setConversaAberta(telefone);
      setErroDaResposta("");
      setNotaDaResposta("");
      setRecolhaAberta(null);
      setACriarPedido(null);
      try {
        const res = await fetch(`/api/admin/whatsapp?telefone=${encodeURIComponent(telefone)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const dados = await res.json();
        setMensagens(res.ok ? (dados.mensagens ?? []) : []);
        setRecolhaAberta(res.ok ? (dados.recolha ?? null) : null);
      } catch {
        setMensagens([]);
      }
    },
    [token],
  );

  /**
   * Reler o fio. Sem `confirmar` não escreve nada — só mostra o que percebeu.
   *
   * O erro não vai para o `erro` geral do painel: vem de um gesto concreto
   * numa conversa concreta, e uma tarja no topo do ecrã obriga a procurar de
   * onde veio.
   */
  const reler = useCallback(
    async (telefone: string, confirmar: boolean, texto?: string) => {
      if (!token) return;
      setAReler(true);
      setErroDaResposta("");
      setNotaDaResposta("");
      try {
        const res = await fetch("/api/admin/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          // O texto editado vai na segunda fase, e sai no lugar do proposto.
          body: JSON.stringify({ accao: "relerConversa", telefone, confirmar, texto: confirmar ? texto : undefined }),
        });
        const dados = await res.json();
        if (!res.ok) {
          setErroDaResposta(dados.error ?? "Não foi possível reler.");
          setReleitura(null);
          return;
        }
        if (dados.previsao) {
          setTextoDaReleitura(dados.mensagem ?? "");
          setReleitura({
            telefone,
            recuperados: dados.recuperados ?? [],
            mensagem: dados.mensagem ?? "",
            completo: Boolean(dados.completo),
            linhasLidas: Number(dados.linhasLidas ?? 0),
            propostas: Boolean(dados.propostas),
            semLeitura: Boolean(dados.semLeitura),
            ultima: typeof dados.ultima === "string" ? dados.ultima : undefined,
            pedido: typeof dados.pedido === "number" ? dados.pedido : undefined,
          });
          return;
        }
        setReleitura(null);
        if (dados.aviso) setErroDaResposta(dados.aviso);
        // `feito` não é um aviso de avaria: é o que aconteceu. Pô-lo na caixa
        // dos erros dizia a quem carregou que tinha corrido mal.
        if (dados.feito) setNotaDaResposta(String(dados.feito));
        await abrirConversa(telefone);
        await carregar();
      } catch {
        setErroDaResposta("Erro de rede.");
      } finally {
        setAReler(false);
      }
    },
    [token, abrirConversa, carregar],
  );

  const responder = useCallback(async () => {
    if (!token || !conversaAberta || !resposta.trim()) return;
    setAResponder(true);
    setErroDaResposta("");
    setNotaDaResposta("");
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          accao: "responder",
          telefone: conversaAberta,
          nota: resposta.trim(),
        }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErroDaResposta(dados.error ?? "Não foi possível enviar.");
        return;
      }
      // À mão: o servidor não envia — devolve o link que abre o WhatsApp da
      // CLYON com o texto pronto. Abre-se num separador e quem carregou envia.
      const link =
        porOnde === "web" && typeof dados.linkWeb === "string" ? dados.linkWeb : dados.link;
      if (typeof link === "string") {
        window.open(link, "_blank", "noopener,noreferrer");
      }
      setResposta("");
      await abrirConversa(conversaAberta);
      await carregar();
    } catch {
      setErroDaResposta("Erro de rede.");
    } finally {
      setAResponder(false);
    }
  }, [token, conversaAberta, resposta, abrirConversa, carregar, porOnde]);

  /*
   * O webhook à mão: o que o cliente respondeu no WhatsApp Web entra aqui e o
   * cérebro trata-o como se tivesse vindo pela API. A resposta dele aparece
   * na fila, pronta a sair pelo WhatsApp Web.
   */
  const registarRecebida = useCallback(async () => {
    if (!token || !textoRecebido.trim() || numeroRecebido.replace(/\D/g, "").length < 9) return;
    setARegistar(true);
    setAvisoRecebido("");
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          accao: "recebida",
          telefone: numeroRecebido,
          nota: textoRecebido.trim(),
        }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setAvisoRecebido(dados.error ?? "Não foi possível registar.");
        return;
      }
      const naFila = Array.isArray(dados.fila) ? dados.fila.length : 0;
      setAvisoRecebido(
        naFila > 0
          ? "Registada. O assistente respondeu — está na fila em baixo, para enviar."
          : "Registada. O assistente não tinha nada a dizer a este número (sem pedido ativo, entregue a si ou bloqueado) — responda à mão se for preciso.",
      );
      setTextoRecebido("");
      if (conversaAberta === numeroRecebido) await abrirConversa(conversaAberta);
      await carregar();
    } catch {
      setAvisoRecebido("Erro de rede.");
    } finally {
      setARegistar(false);
    }
  }, [token, textoRecebido, numeroRecebido, conversaAberta, abrirConversa, carregar]);

  /*
   * A MESA DAS CONVERSAS — 21-10-2026.
   *
   * Vem feita do servidor (`mesa-das-conversas-na-base.ts`): cada número uma
   * vez, no pé em que está e porquê. Aqui só se escolhe o separador. Procura-se
   * também no porquê e na nota de guardada.
   */
  const linhas = useMemo<Linha[]>(
    () =>
      (estado?.mesa ?? []).map((c) => ({
        ...c,
        // O nome do contacto também se procura (d124): o número já não está à vista.
        nota: [c.nome, c.porque, c.motivoDaEntrega, c.guardada?.nota, c.profissional?.nome].filter(Boolean).join(" · "),
      })),
    [estado],
  );

  const contagens = useMemo(() => contarNaMesa(linhas), [linhas]);

  const visiveis = useMemo<Linha[]>(
    () =>
      procuraActiva(procura)
        ? conversasVisiveis(linhas, separador, procura)
        : (linhasDoSeparador(linhas, separador) as Linha[]),
    [linhas, separador, procura],
  );
  const aProcurar = procuraActiva(procura);

  if (!estado) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        A carregar o estado do WhatsApp…
      </div>
    );
  }

  const CANAL = {
    meta: "pela API oficial da Meta",
    ponte: "pela ponte do Winapp (o WhatsApp emparelhado no PC)",
    manual: `pelo WhatsApp Web do ${formatarTelefone(estado.numeroManual ?? TELEFONE_DA_CLYON_DIGITOS)} — sem API por agora`,
    nenhum: "sem canal configurado — nada sai nem entra",
  }[estado.canal];
  const aMao = estado.canal === "manual";
  /*
   * O SINAL DA PONTE — 22-09-2026.
   *
   * Só quando o canal é a ponte: com a API da Meta ou com o número à mão
   * não há ponte nenhuma, e um alarme vermelho a respeito de uma coisa que
   * não devia estar a correr ensina a ignorar alarmes.
   *
   * A hora é a de QUEM ESTÁ A OLHAR, e conta-se a cada desenho. A mesa
   * recarrega de 20 em 20 segundos (`INTERVALO_DO_CICLO`), dentro da janela
   * de um minuto do verde — não faz falta um relógio só para isto.
   */
  const ponte = estado.canal === "ponte" ? fichaDaPonte(estado.ponteVistaEm ?? null, new Date()) : null;
  const numeroDaClyon = formatarTelefone(estado.numeroManual ?? TELEFONE_DA_CLYON_DIGITOS);

  /**
   * O link que abre o WhatsApp da CLYON já com o destinatário e o texto —
   * no WhatsApp Web deste computador ou, se preferir, no telemóvel.
   */
  const linkParaEnviar = (telefone: string, texto: string) => {
    // Pela regra de todo o backoffice (26-10-2026); sem número que sirva, o
    // WhatsApp pede a conversa em vez de abrir a de um estranho.
    const digitos = numeroParaWhatsApp(telefone) ?? "";
    const t = encodeURIComponent(texto);
    return porOnde === "web"
      ? `https://web.whatsapp.com/send?phone=${digitos}&text=${t}`
      : `https://wa.me/${digitos}?text=${t}`;
  };
  const rotuloDeAbrir = porOnde === "web" ? "Abrir no WhatsApp Web" : "Abrir no WhatsApp";

  /** Lê uma frase de ensaio pelo Gemini — ver a acção «testarCompreensao» da rota. */
  const testarLeitura = async () => {
    if (!token) return;
    setATestar(true);
    setResultadoDoTeste("");
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accao: "testarCompreensao" }),
      });
      const dados = (await res.json()) as { ok?: boolean; motivo?: string | null; error?: string };
      setResultadoDoTeste(
        dados.ok
          ? "Leu bem — o assistente voltou a perceber as mensagens."
          : `Continua a falhar: ${dados.motivo ?? dados.error ?? "sem motivo"}`,
      );
      await carregar(true);
    } catch {
      setResultadoDoTeste("Erro de rede.");
    } finally {
      setATestar(false);
    }
  };

  const agirNaFila = async (accao: "enviada" | "descartar" | "limparFila" | "soltar", id?: number) => {
    if (!token) return;
    setOcupado(true);
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accao, id }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return;
      }
      setErro("");
      await carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(false);
    }
  };

  /** Abrir e fechar o fio de uma linha. Abrir deixa o número pronto no «chegou uma resposta». */
  const alternarConversa = (telefone: string) => {
    if (conversaAberta === telefone) {
      setConversaAberta(null);
      return;
    }
    setMaisNaConversa(false);
    setNumeroRecebido(telefone);
    void abrirConversa(telefone);
  };

  /*
   * QUEM É, SEM O NÚMERO — d124. A fila e as atrasadas só trazem o telefone;
   * o nome (ou o pedido) vem da linha da mesa desse número.
   */
  const quemE = (telefone: string) => quemPeloTelefone(estado.mesa, telefone);
  const resumo = resumoDoTopo(linhas);
  // Os separadores à vista, e os do «Mais» (sempre o aberto, mesmo com o «Mais» fechado).
  const separadoresAVista = [
    ...SEPARADORES_A_VISTA,
    ...SEPARADORES_NO_MAIS.filter((id) => maisAberto || id === separador),
  ]
    .map((id) => SEPARADORES_DA_MESA.find((s) => s.id === id))
    .filter((s): s is (typeof SEPARADORES_DA_MESA)[number] => s != null);

  return (
    <div className="space-y-3">
      {/*
        OS OUTROS USOS DA IA EM BAIXO — 27-10-2026 (d7). O tradutor, a leitura
        das conversas e a das fotografias falhavam só para a consola; o
        tradutor esteve morto um mês assim. Cada linha desaparece sozinha na
        primeira vez que esse uso corra bem.
      */}
      {(estado.ia?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.08] px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-200">
            <Bot className="h-4 w-4" aria-hidden="true" />A IA está a falhar
          </p>
          <ul className="mt-2 space-y-2">
            {estado.ia?.map((f) => (
              <li key={f.uso}>
                <p className="text-xs leading-relaxed text-amber-100/80">{linhaDaFalha(f)}</p>
                <p className="mt-1 rounded-lg bg-slate-950/50 p-2 font-mono text-[11px] leading-relaxed break-words text-amber-100/70">
                  {f.motivo}
                </p>
                <p className="mt-0.5 text-[11px] text-amber-100/60">Última falha: {desde(f.quando)}.</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        A COMPREENSÃO EM BAIXO — a avaria que não se via (14-09-2026). Fica em
        cima de tudo, e com o motivo de quem recusou: «429 quota excedida» e
        «falta a chave» têm remédios diferentes.
      */}
      {estado.compreensao && (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.08] px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-200">
            <Bot className="h-4 w-4" aria-hidden="true" />O assistente não está a PERCEBER as
            mensagens
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
            Continua a responder, mas só ao que consegue ler por palavras — um «sim», um valor, uma
            data. Frases como «Sim serve» ou «Aceito a proposta do João» passam-lhe ao lado.
          </p>
          <p className="mt-2 rounded-lg bg-slate-950/50 p-2 font-mono text-[11px] leading-relaxed text-amber-100/70">
            {estado.compreensao.motivo}
          </p>
          <p className="mt-1 text-[11px] text-amber-100/60">
            Última falha: {desde(estado.compreensao.quando)}. Esta linha desaparece sozinha na
            primeira leitura que corra bem.
          </p>
          {/* TESTAR AGORA — 12-10-2026: lê uma frase de ensaio, sem enviar nada. */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void testarLeitura()}
              disabled={aTestar}
              className="rounded-lg border border-amber-400/50 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-500/25 disabled:opacity-40"
            >
              {aTestar ? "A testar…" : "Testar agora"}
            </button>
            {resultadoDoTeste && (
              <span className="text-[11px] text-amber-100/80">{resultadoDoTeste}</span>
            )}
          </div>
        </section>
      )}

      {/*
        O CABEÇALHO NUMA LINHA — d124 (25-11-2026). Era um bloco grande, com a
        explicação do canal e a da ponte sempre à vista. Agora: o estado, a
        ponte, quantas conversas, as suas, e o «Desligar tudo» pequeno à
        direita. A explicação da ponte só aparece quando há alguma coisa mal;
        o raro (número à mão, pedir à Vitória para ler, atualizar, avisos no
        telemóvel) vive no «⋯».
      */}
      <section
        className={`rounded-2xl border px-4 py-2.5 ${
          estado.ligado ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-red-500/30 bg-red-500/[0.07]"
        }`}
      >
        <div className="flex items-center gap-2">
          <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${estado.ligado ? "bg-emerald-400" : "bg-red-500"}`}
            />
            <b className="text-white" title={estado.ligado ? `A falar ${CANAL}.` : undefined}>
              {estado.ligado ? "Ligado" : "DESLIGADO — ninguém recebe nada"}
            </b>
            {/*
              A PONTE ESTÁ VIVA? A pergunta que custou uma manhã (22-09-2026):
              responde-se de relance, ao lado do estado.
            */}
            {ponte && (
              <span className={`${SINAL_DA_PONTE[ponte.estado].texto} ${ponte.estado === "viva" ? "" : "font-semibold"}`}>
                · {ponte.titulo}
              </span>
            )}
            <span className="text-slate-400">
              · <b className="tabular-nums text-slate-200">{linhas.length}</b> conversas
            </span>
            {/* AS CONVERSAS SUAS — vieram do Início (d56, 17-11-2026): é aqui que se trabalham. */}
            {estado.interrompidos.length > 0 && (
              <span className="text-amber-200" title="O assistente está calado nestas — é a equipa a responder.">
                · <b className="tabular-nums">{estado.interrompidos.length}</b>{" "}
                {estado.interrompidos.length === 1 ? "conversa sua" : "conversas suas"}
              </span>
            )}
            {/*
              O TELEMÓVEL, LIDO HÁ QUANTO — 23-10-2026. A mesa sabe das
              respostas à mão pelo retrato que a ponte tira de 10 em 10 minutos;
              se ele parar, tem de se ver.
            */}
            {estado.canal === "ponte" &&
              (() => {
                const t = leituraDoTelemovel(estado.telemovelLidoHaSegundos);
                return (
                  <span className={`text-xs ${t.aviso ? "font-semibold text-amber-300" : "hidden text-slate-500 sm:inline"}`}>
                    · {t.texto}
                  </span>
                );
              })()}
          </p>
          <button
            type="button"
            onClick={() => setOpcoesAbertas((v) => !v)}
            aria-expanded={opcoesAbertas}
            aria-label="Mais opções do WhatsApp"
            title="Número à mão, pedir à Vitória para ler, atualizar, avisos no telemóvel"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
              opcoesAbertas ? "border-slate-500 bg-slate-800 text-white" : "border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            onClick={() => agir(estado.ligado ? "desligar" : "ligar")}
            disabled={ocupado}
            className={`flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition disabled:opacity-40 ${
              estado.ligado
                ? "bg-red-500/15 text-red-300 hover:bg-red-500/25"
                : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            }`}
          >
            <Power className="h-3.5 w-3.5" aria-hidden="true" />
            {estado.ligado ? "Desligar tudo" : "Ligar outra vez"}
          </button>
        </div>
        {ponte && ponte.estado !== "viva" && ponte.explicacao !== "" && (
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-slate-400">{ponte.explicacao}</p>
        )}
        {!estado.ligado && (
          <p className="mt-1 text-xs text-slate-400">As mensagens novas ficam na fila à espera de o voltar a ligar.</p>
        )}

        {opcoesAbertas && (
          <div className="mt-2 space-y-2 border-t border-slate-800 pt-2">
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setAAdicionar((v) => !v)}
                className={`${ACCAO} border-slate-700 text-slate-300 hover:bg-slate-800`}
              >
                {aAdicionar ? (
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Número à mão
              </button>
              <button
                onClick={() => void pedirLeitura()}
                disabled={aLer}
                title="A Vitória lê as conversas paradas há 2 h com novidades e fecha as que acabaram, com o porquê. Não escreve aos clientes."
                className={`${ACCAO} border-violet-500/40 text-violet-300 hover:bg-violet-500/10`}
              >
                {aLer ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Pedir à Vitória para ler
              </button>
              <button
                onClick={() => void carregar()}
                className={`${ACCAO} border-slate-700 text-slate-300 hover:bg-slate-800`}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Atualizar
              </button>
            </div>
            {/*
              Entregar ou bloquear um número que ainda não escreveu — faz-se de
              vez em quando, e abre-se quando é preciso.
            */}
            {aAdicionar && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs leading-relaxed text-slate-400">
                  <strong className="text-slate-300">Entregar a si</strong> cala o assistente nesse
                  número e a conversa passa a ser sua. <strong className="text-slate-300">Bloquear</strong>{" "}
                  é para contactos pessoais: nunca mais recebem nada, até desbloquear.
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={numeroNovo}
                    onChange={(e) => setNumeroNovo(e.target.value)}
                    placeholder="Número (ex.: 912 345 678)"
                    className={`${CAIXA} sm:w-56`}
                  />
                  <input
                    value={notaNova}
                    onChange={(e) => setNotaNova(e.target.value)}
                    placeholder="Nota (opcional — quem é, porquê)"
                    className={`${CAIXA} flex-1`}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await agir("interromper", numeroNovo, notaNova || undefined);
                        setNumeroNovo("");
                        setNotaNova("");
                        setSeparador("a_espera");
                      }}
                      disabled={ocupado || numeroNovo.replace(/\D/g, "").length < 9}
                      className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-amber-500/15 px-4 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/25 disabled:opacity-40"
                    >
                      <Hand className="h-4 w-4" aria-hidden="true" />
                      Entregar a si
                    </button>
                    <button
                      onClick={async () => {
                        await agir("bloquear", numeroNovo, notaNova || undefined);
                        setNumeroNovo("");
                        setNotaNova("");
                        setMaisAberto(true);
                        setSeparador("bloqueada");
                      }}
                      disabled={ocupado || numeroNovo.replace(/\D/g, "").length < 9}
                      className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-red-500/15 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 disabled:opacity-40"
                    >
                      <Ban className="h-4 w-4" aria-hidden="true" />
                      Bloquear
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Os avisos no telemóvel: as conversas que a Vitória passa a uma pessoa e as que esperam há mais de 2 h (d23). */}
            <AvisosDaEquipa token={token} />
          </div>
        )}
      </section>

      {avisoDaLeitura && <p className="px-1 text-xs text-violet-200">{avisoDaLeitura}</p>}
      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/*
        O QUE SE LÊ NO TOPO — d124: quantas por responder, a mais antiga à
        espera (das dos últimos 3 dias) e as que pedem uma pessoa.
      */}
      <p className="px-1 text-sm text-slate-300">
        <b className={resumo.porResponder > 0 ? "text-red-300" : "text-slate-300"}>
          {resumo.porResponder === 1 ? "1 por responder" : `${resumo.porResponder} por responder`}
        </b>
        {resumo.maisAntigaHaSegundos != null && (
          <span className="text-slate-400"> · a mais antiga espera {haQuanto(resumo.maisAntigaHaSegundos).replace(/^há /, "há ")}</span>
        )}
        {resumo.pedemUmaPessoa > 0 && (
          <span className="font-semibold text-amber-300">
            {" "}
            · {resumo.pedemUmaPessoa === 1 ? "1 pede uma pessoa" : `${resumo.pedemUmaPessoa} pedem uma pessoa`}
          </span>
        )}
      </p>

      {/*
        O ASSISTENTE AUTOMÁTICO — os interruptores e o que ele fez. Uma linha
        dobrada (d124): quem abre este ecrã vem quase sempre atender alguém.
      */}
      <AdminAssistenteAutoPanel />

      {/*
        CONVERSAS OU LIÇÕES DA VITÓRIA — 27-10-2026 (decisão d11). As lições
        ficam montadas mesmo escondidas, para o número das por rever aparecer
        no separador sem ser preciso abri-lo.
      */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="WhatsApp">
        {(
          [
            { id: "conversas", titulo: "Conversas" },
            { id: "licoes", titulo: "Lições da Vitória" },
          ] as const
        ).map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={vistaDoPainel === v.id}
            onClick={() => setVistaDoPainel(v.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              vistaDoPainel === v.id
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {v.id === "licoes" && <GraduationCap className="h-4 w-4" aria-hidden="true" />}
            {v.titulo}
            {v.id === "licoes" && licoesPorRever > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {licoesPorRever}
              </span>
            )}
          </button>
        ))}
      </div>

      {/*
        AS MENSAGENS ATRASADAS NA FILA — 27-10-2026 (d7). Mais de 2 h na fila
        e não saíram sozinhas: a equipa decide se ainda fazem sentido. Contam
        no selo do WhatsApp. Desde d124 descartam-se sozinhas as de pedidos com
        parceiro contratado ou fechados, e as de mais de 48 h; as que ficam
        aparecem recolhidas, uma linha cada — o texto inteiro ao carregar.
      */}
      {vistaDoPainel === "conversas" && (estado.atrasadas?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.06] px-4 py-3">
          <h3 className="flex flex-wrap items-center gap-x-2 text-sm font-bold text-amber-200">
            Atrasadas na fila
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {estado.atrasadas?.length}
            </span>
            <span className="text-xs font-normal text-amber-100/70">mais de 2 h à espera — já não saem sozinhas</span>
          </h3>
          <ul className="mt-1 divide-y divide-amber-500/20">
            {estado.atrasadas?.map((m) => {
              const aberta = textosAbertos.has(m.id);
              return (
                <li key={m.id} className="py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => alternarTexto(m.id)}
                      aria-expanded={aberta}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-xs">
                        <b className="text-slate-200">{quemE(m.telefone)}</b>
                        <span className="text-slate-500">
                          {" "}
                          · há {m.haMinutos >= 120 ? `${Math.round(m.haMinutos / 60)} h` : `${m.haMinutos} min`}
                        </span>
                      </span>
                      {!aberta && <span className="block truncate text-sm text-slate-400">{inicioDoTexto(m.texto)}</span>}
                    </button>
                    <button
                      onClick={() => void agirNaFila("soltar", m.id)}
                      disabled={ocupado}
                      className="flex min-h-[32px] shrink-0 items-center gap-1 rounded-lg bg-emerald-500 px-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Enviar
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("Descartar esta mensagem sem a enviar?")) {
                          void agirNaFila("descartar", m.id);
                        }
                      }}
                      disabled={ocupado}
                      aria-label="Descartar"
                      title="Descartar sem enviar"
                      className="flex min-h-[32px] shrink-0 items-center rounded-lg px-2 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  {aberta && (
                    <div className="mt-1 space-y-1">
                      <p className="whitespace-pre-wrap break-words text-sm text-slate-300">{m.texto}</p>
                      <VerNumero telefone={m.telefone} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section
        className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-4 ${vistaDoPainel === "licoes" ? "" : "hidden"}`}
      >
        <AdminLicoesDaVitoriaPanel onPorRever={setLicoesPorRever} />
      </section>

      {/*
        A MESA. Uma lista; os separadores do dia-a-dia à vista e os outros no
        «Mais» (d124). Cada conversa numa linha: quem, o pedido, o porquê numa
        linha, há quanto tempo e de quem é a vez — e uma ou duas acções; o
        resto no «⋯» da linha.
      */}
      <section
        className={`rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-3 sm:px-4 ${vistaDoPainel === "conversas" ? "" : "hidden"}`}
      >
        {estado.mesaFalhou && (
          <p className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            A lista das conversas não carregou ({estado.mesaFalhou}). Não quer dizer que esteja tudo respondido —{" "}
            <button type="button" onClick={() => void carregar()} className="font-semibold underline underline-offset-2">
              carregue em «Atualizar»
            </button>
            .
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-2" role="tablist" aria-label="Conversas">
          {separadoresAVista.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={separador === s.id}
              onClick={() => {
                setSeparador(s.id);
                setConversaAberta(null);
                setMarcadas(new Set());
                setAvisoDoLote("");
                setMenuDaLinha(null);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                separador === s.id
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {s.titulo}
              {contagens[s.id] > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${CORES[s.id]}`}>
                  {contagens[s.id]}
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMaisAberto((v) => !v)}
            aria-expanded={maisAberto}
            title="A meio, Com pedido, Guardadas e Bloqueadas"
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          >
            {maisAberto ? "Menos" : "Mais"}
            {maisAberto ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/*
          A LISTA TEM DE DIZER O QUE ESTÁ A MOSTRAR.
          Com procura escrita aparecem linhas de separadores que não estão
          abertos — sem esta frase, o ecrã contradizia-se a si próprio.
        */}
        {aProcurar && (
          <p className="mt-2 text-xs text-slate-400">
            A procurar <strong className="text-slate-200">em todos os separadores</strong>:{" "}
            {visiveis.length === 1 ? "1 conversa" : `${visiveis.length} conversas`}.
          </p>
        )}

        {/*
          AS MARCADAS E O QUE SE LHES FAZ — 23-10-2026. A barra só cresce com
          alguma marcada; tem os mesmos botões da linha, para todas de uma vez.
        */}
        {visiveis.length > 0 &&
          (() => {
            const marcadasAqui = visiveis.filter((l) => marcadas.has(l.telefone));
            const telefones = marcadasAqui.map((l) => l.telefone);
            const todas = marcadasAqui.length === visiveis.length;
            const pedidos = marcadasAqui.flatMap((l) => (l.pedido ? [l.pedido.id] : []));
            return (
              <div
                className={`sticky top-0 z-10 mt-1 flex flex-wrap items-center gap-1.5 rounded-lg px-1 py-1 ${
                  telefones.length > 0 ? "border border-cyan-500/30 bg-slate-900" : ""
                }`}
              >
                <label className="flex cursor-pointer items-center gap-2 pr-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={todas}
                    ref={(el) => {
                      if (el) el.indeterminate = telefones.length > 0 && !todas;
                    }}
                    onChange={() => setMarcadas(todas ? new Set() : new Set(visiveis.map((l) => l.telefone)))}
                    className="h-4 w-4 accent-cyan-500"
                  />
                  {telefones.length > 0 ? (
                    <strong className="text-cyan-200">
                      {telefones.length === 1 ? "1 marcada" : `${telefones.length} marcadas`}
                    </strong>
                  ) : (
                    `Marcar todas (${visiveis.length})`
                  )}
                </label>
                {telefones.length > 0 && (
                  <>
                    {(separador === "por_responder" || separador === "profissionais") && (
                      <button
                        onClick={() => void emLote("respondida", telefones)}
                        disabled={ocupado}
                        className={`${ACCAO} border-sky-500/40 text-sky-300 hover:bg-sky-500/10`}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Já respondi
                      </button>
                    )}
                    {separador !== "resolvida" && separador !== "bloqueada" && (
                      <button
                        onClick={() => {
                          const motivo = window.prompt(
                            `Porque ficam resolvidas as ${telefones.length}? (ex.: «cliente desistiu», «serviço feito»)`,
                          );
                          if (motivo !== null) void emLote("fechar", telefones, motivo.trim() || undefined);
                        }}
                        disabled={ocupado}
                        className={`${ACCAO} border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10`}
                      >
                        <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                        Fechar
                      </button>
                    )}
                    {separador === "resolvida" && (
                      <button
                        onClick={() => void emLote("reabrir", telefones)}
                        disabled={ocupado}
                        className={`${ACCAO} border-slate-600 text-slate-300 hover:bg-slate-800`}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
                        Reabrir
                      </button>
                    )}
                    {separador === "guardada" ? (
                      <button
                        onClick={() => void emLote("desguardar", telefones)}
                        disabled={ocupado}
                        className={`${ACCAO} border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10`}
                      >
                        <BookmarkX className="h-3.5 w-3.5" aria-hidden="true" />
                        Tirar dos guardados
                      </button>
                    ) : (
                      separador !== "bloqueada" && (
                        <button
                          onClick={() => {
                            const nota = window.prompt("O que falta fazer nestas conversas? (opcional)");
                            if (nota !== null) void emLote("guardar", telefones, nota.trim() || undefined);
                          }}
                          disabled={ocupado}
                          className={`${ACCAO} border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10`}
                        >
                          <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                          Guardar
                        </button>
                      )
                    )}
                    {separador !== "bloqueada" && (
                      <>
                        <button
                          onClick={() => void emLote("retomar", telefones)}
                          disabled={ocupado}
                          className={`${ACCAO} border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10`}
                          title="A Vitória volta a responder a estas conversas."
                        >
                          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Devolver ao assistente
                        </button>
                        <button
                          onClick={() => void emLote("interromper", telefones, "Pelo backoffice")}
                          disabled={ocupado}
                          className={`${ACCAO} border-amber-500/40 text-amber-300 hover:bg-amber-500/10`}
                          title="A Vitória cala-se nestas conversas: passam a ser da equipa."
                        >
                          <Hand className="h-3.5 w-3.5" aria-hidden="true" />
                          Assumir
                        </button>
                      </>
                    )}
                    {eAdmin && (
                      <button
                        onClick={() => excluir(telefones, pedidos)}
                        disabled={ocupado}
                        className={`${ACCAO} border-red-500/40 text-red-300 hover:bg-red-500/10`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Excluir
                      </button>
                    )}
                    <button
                      onClick={() => setMarcadas(new Set())}
                      className={`${ACCAO} border-transparent text-slate-400 hover:bg-slate-800`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      Desmarcar
                    </button>
                  </>
                )}
              </div>
            );
          })()}
        {avisoDoLote && <p className="mt-1 text-xs text-cyan-200">{avisoDoLote}</p>}

        {visiveis.length === 0 ? (
          estado.mesaFalhou ? null : (
            <p className="mt-3 text-sm text-slate-500">
              {aProcurar
                ? "Nenhuma conversa com esse número ou nome."
                : SEPARADORES_DA_MESA.find((s) => s.id === separador)?.vazio}
            </p>
          )
        ) : (
          <ul className="divide-y divide-slate-800">
            {visiveis.map((l, i) => {
              const aberta = conversaAberta === l.telefone;
              const quem = quemNaLinha(l);
              const vez = deQuemEAVez(l);
              const menuAberto = menuDaLinha === l.telefone;
              /*
               * A LINHA QUE SEPARA AS ANTIGAS — 21-10-2026. No «Por responder»,
               * as que esperam há mais de 3 dias vêm depois das de hoje (ver
               * `ordenarNaMesa`), e diz-se porquê. As de pedidos fechados já
               * não chegam cá (d124): passaram a «Resolvidas».
               */
              // E no «À espera do cliente», as que ele deixou sem resposta há mais de 3 dias (23-10-2026).
              const primeiraAntiga =
                (separador === "por_responder" || separador === "a_espera") &&
                !aProcurar &&
                eEsperaAntiga(l) &&
                (i === 0 || !eEsperaAntiga(visiveis[i - 1]));
              return (
                <Fragment key={l.telefone}>
                {primeiraAntiga && (
                  <li className="py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {separador === "a_espera" ? "O cliente deixou de responder — há mais de 3 dias" : "Há mais de 3 dias"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {separador === "a_espera"
                        ? "Vale a pena um lembrete — ou feche, se já não há nada a fazer."
                        : "Se já foram tratadas fora do WhatsApp, carregue em «Já respondi» ou em «Fechar»."}
                    </p>
                  </li>
                )}
                <li>
                  <div className="flex items-center gap-2 py-2">
                    {/* Marcar, para as acções de várias de uma vez (23-10-2026). Não abre a linha. */}
                    <input
                      type="checkbox"
                      checked={marcadas.has(l.telefone)}
                      onChange={() =>
                        setMarcadas((antes) => {
                          const novas = new Set(antes);
                          if (novas.has(l.telefone)) novas.delete(l.telefone);
                          else novas.add(l.telefone);
                          return novas;
                        })
                      }
                      aria-label={`Marcar ${quem}`}
                      className="h-4 w-4 shrink-0 accent-cyan-500"
                    />
                    {/*
                      A LINHA QUE ABRE A CONVERSA (`linhaQueAbre`, 21-10-2026).
                      Desde d124 diz QUEM é — o nome, ou o pedido — e não o
                      número: esse só aparece no «Ver número» do «⋯».
                    */}
                    <div
                      {...linhaQueAbre(() => alternarConversa(l.telefone), `Abrir a conversa com ${quem}`)}
                      className="min-w-0 flex-1 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                    >
                      <p className="flex min-w-0 items-center gap-1.5 text-sm">
                        <span className="truncate font-semibold text-white">{quem}</span>
                        {/*
                          O PEDIDO, E SE JÁ ACABOU — 23-10-2026. Abre a ficha dele.
                          Quando o nome não se sabe, o pedido já é o «quem».
                        */}
                        {l.pedido && quem !== `Pedido #${l.pedido.id}` && (
                          <a
                            href={`/admin/pedido/${l.pedido.id}`}
                            onClick={(e) => e.stopPropagation()}
                            title={`Pedido #${l.pedido.id} · ${l.pedido.estado}`}
                            className={`shrink-0 rounded px-1.5 py-px text-[11px] font-semibold hover:underline ${corDoPedido(l.pedido)}`}
                          >
                            #{l.pedido.id}
                          </a>
                        )}
                        {l.pedido && (
                          <span className="hidden shrink-0 text-[11px] text-slate-500 sm:inline">{l.pedido.estado}</span>
                        )}
                        {/* Quem escreve é um profissional registado — pelo telefone da ficha (d21). */}
                        {l.profissional && (
                          <span
                            title="O telefone bate com a ficha de um profissional"
                            className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-px text-[11px] font-semibold ${CORES.profissionais}`}
                          >
                            <Wrench className="h-3 w-3" aria-hidden="true" />
                            <span className="hidden sm:inline">Profissional</span>
                          </span>
                        )}
                        {/* Quer ser parceiro: a Vitória mandou-lhe a candidatura (d129). */}
                        {!l.profissional && l.candidato && (
                          <span
                            title="Quer ser parceiro — a Vitória mandou-lhe a ligação da candidatura"
                            className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-px text-[11px] font-semibold ${CORES.profissionais}`}
                          >
                            <Wrench className="h-3 w-3" aria-hidden="true" />
                            <span className="hidden sm:inline">Candidato</span>
                          </span>
                        )}
                        {l.guardada && (
                          <Bookmark
                            className="h-3.5 w-3.5 shrink-0 text-cyan-300"
                            aria-label={`Guardada${l.guardada.nota ? `: ${l.guardada.nota}` : ""}`}
                          />
                        )}
                        {/* De onde veio esta linha — só quando a lista não é a do separador aberto. */}
                        {(aProcurar || separador === "profissionais") && (
                          <span className={`shrink-0 rounded px-1.5 py-px text-[11px] font-semibold ${CORES[l.estado]}`}>
                            {SEPARADORES_DA_MESA.find((s) => s.id === l.estado)?.titulo ?? l.estado}
                          </span>
                        )}
                      </p>
                      {/*
                        PORQUE É QUE ESTÁ AQUI, E ONDE PAROU — 21-10-2026, numa
                        linha: «Escreveu há 2 h: «Então?»», «Parou a dar a
                        morada». O resto (o motivo da entrega, a volta à
                        Vitória) está dentro da conversa.
                      */}
                      <p title={l.porque} className={`truncate text-xs ${COR_DO_PORQUE[l.estado]}`}>
                        {/* d93: cancelou pela conversa — nenhuma mensagem automática lhe sai. */}
                        {l.naoContactar && <b className="text-rose-300">Não contactar · </b>}
                        {l.porque}
                      </p>
                    </div>

                    <span
                      className="hidden shrink-0 flex-col items-end text-[11px] leading-tight sm:flex"
                      title={
                        l.quemFalou
                          ? `${ULTIMA_PALAVRA[l.quemFalou].texto}${l.onde === "telemovel" ? " (visto no telemóvel)" : l.onde === "painel" ? " («Já respondi» no painel)" : ""}${l.quando ? ` — ${desde(l.quando)}` : ""}`
                          : undefined
                      }
                    >
                      <span className={vez.nossa ? "font-semibold text-red-300" : "text-slate-400"}>{vez.texto}</span>
                      <span className="text-slate-500">{haQuanto(l.haSegundos)}</span>
                    </span>

                    {/*
                      UMA OU DUAS ACÇÕES À VISTA — d124. «Já respondi» e «Fechar»
                      no que espera por nós; «Fechar» no resto; «Reabrir» e
                      «Desbloquear» onde fazem falta. O resto no «⋯».
                    */}
                    <div className="flex shrink-0 items-center gap-1">
                      {/*
                        «JÁ RESPONDI» — 23-10-2026. Respondeu-se por telefone ou
                        noutro sítio: passa para «À espera do cliente», e volta
                        sozinha se ele escrever outra vez.
                      */}
                      {l.estado === "por_responder" && (
                        <button
                          onClick={() => void agir("respondida", l.telefone)}
                          disabled={ocupado}
                          className={`${ACCAO} border-sky-500/40 px-2 text-sky-300 hover:bg-sky-500/10`}
                          title="Respondeu por telefone ou noutro sítio: passa para «À espera do cliente». Volta se o cliente escrever."
                          aria-label="Já respondi"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="hidden sm:inline">Já respondi</span>
                        </button>
                      )}
                      {l.estado !== "resolvida" && l.estado !== "bloqueada" && (
                        <button
                          onClick={() => fecharComMotivo(l.telefone)}
                          disabled={ocupado}
                          className={`${ACCAO} border-emerald-500/40 px-2 text-emerald-300 hover:bg-emerald-500/10 ${
                            l.estado === "por_responder" ? "hidden sm:flex" : ""
                          }`}
                          title="Passa para «Resolvidas», com o porquê. Volta à mesa sozinha se o cliente escrever outra vez."
                          aria-label="Fechar"
                        >
                          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="hidden sm:inline">Fechar</span>
                        </button>
                      )}
                      {l.estado === "resolvida" && l.fechadaPor !== "pedido" && (
                        <button
                          onClick={() => void agir("reabrir", l.telefone)}
                          disabled={ocupado}
                          className={`${ACCAO} border-slate-600 px-2 text-slate-300 hover:bg-slate-800`}
                          title="Volta para a mesa, no pé em que estiver."
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="hidden sm:inline">Reabrir</span>
                        </button>
                      )}
                      {l.estado === "bloqueada" && (
                        <button
                          onClick={() => void agir("desbloquear", l.telefone)}
                          disabled={ocupado}
                          className={`${ACCAO} border-slate-600 text-slate-300 hover:bg-slate-800`}
                        >
                          Desbloquear
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setMenuDaLinha(menuAberto ? null : l.telefone)}
                        aria-expanded={menuAberto}
                        aria-label={`Mais ações — ${quem}`}
                        className={`${ACCAO} border-transparent px-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200`}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/*
                    O «⋯» DA LINHA — d124. O que se faz de vez em quando, sem
                    abrir a conversa: assumir ou devolver ao assistente, desfazer
                    o «Já respondi», ver o número, excluir.
                  */}
                  {menuAberto && (
                    <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                      <VerNumero telefone={l.telefone} />
                      {/* No telemóvel o «Fechar» do «Por responder» vive aqui. */}
                      {l.estado === "por_responder" && (
                        <button
                          onClick={() => fecharComMotivo(l.telefone)}
                          disabled={ocupado}
                          className={`${ACCAO} border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 sm:hidden`}
                        >
                          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                          Fechar
                        </button>
                      )}
                      {l.onde === "painel" && l.estado === "a_espera" && (
                        <button
                          onClick={() => void agir("desfazerRespondida", l.telefone)}
                          disabled={ocupado}
                          className={`${ACCAO} border-slate-600 text-slate-300 hover:bg-slate-800`}
                          title="Desfaz o «Já respondi»: volta para «Por responder»."
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          Desfazer
                        </button>
                      )}
                      {/* Parar o assistente nesta conversa — sem a abrir. */}
                      {l.dono === "assistente" && l.estado !== "bloqueada" && l.estado !== "resolvida" && (
                        <button
                          onClick={() => void agir("interromper", l.telefone, "Pelo backoffice")}
                          disabled={ocupado}
                          className={`${ACCAO} border-amber-500/40 text-amber-300 hover:bg-amber-500/10`}
                          title="A Vitória cala-se nesta conversa: passa a ser da equipa."
                        >
                          <Hand className="h-3.5 w-3.5" aria-hidden="true" />
                          Assumir
                        </button>
                      )}
                      {l.dono === "equipa" && l.estado !== "bloqueada" && l.estado !== "resolvida" && (
                        <button
                          onClick={() => void agir("retomar", l.telefone)}
                          disabled={ocupado}
                          className={`${ACCAO} border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10`}
                          title="O assistente volta a responder, e continua no passo onde ficou."
                        >
                          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Devolver ao assistente
                        </button>
                      )}
                      {/* EXCLUIR — 23-10-2026: o cliente desistiu; a Vitória esquece-o. */}
                      {eAdmin && (
                        <button
                          onClick={() => excluir([l.telefone], l.pedido ? [l.pedido.id] : [])}
                          disabled={ocupado}
                          title="Excluir: apaga a conversa e o pedido sem trabalho, e a Vitória esquece este cliente — se voltar, começa do zero."
                          className={`${ACCAO} border-red-500/30 text-red-300 hover:bg-red-500/10`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Excluir
                        </button>
                      )}
                    </div>
                  )}

                  {aberta && (
                    <div className="mb-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      {/*
                        QUEM É, E O QUE A LINHA NÃO DIZ — d124. O número a pedido,
                        o passo da recolha, porque foi entregue, e se voltou à
                        Vitória.
                      */}
                      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                        <b className="text-sm text-white">{quem}</b>
                        <VerNumero telefone={l.telefone} />
                        {l.pedido && (
                          <a href={`/admin/pedido/${l.pedido.id}`} className="hover:underline">
                            Pedido #{l.pedido.id} · {l.pedido.estado}
                          </a>
                        )}
                        {l.estado !== "bloqueada" && (
                          <span className="flex items-center gap-1">
                            {l.dono === "equipa" ? (
                              <Hand className="h-3 w-3 text-amber-300" aria-hidden="true" />
                            ) : (
                              <Bot className="h-3 w-3 text-violet-300" aria-hidden="true" />
                            )}
                            {l.dono === "equipa" ? "Com a equipa" : "Com a Vitória"}
                          </span>
                        )}
                        {l.passo && l.dono === "assistente" && l.estado !== "resolvida" && (
                          <span>{PASSO_DA_RECOLHA[l.passo] ?? l.passo}</span>
                        )}
                        {l.guardada?.nota && <span className="text-cyan-300">Guardada: {l.guardada.nota}</span>}
                      </div>
                      {l.motivoDaEntrega && l.estado !== "resolvida" && (
                        <p className="mb-1 text-[11px] text-amber-300/80">{linhaDaEntrega(l.motivoDaEntrega)}</p>
                      )}
                      {/* d112: respondida à mão e 24 h sem a equipa — a Vitória fala outra vez nesta conversa. */}
                      {l.voltouAVitoria && l.estado !== "resolvida" && (
                        <p className="mb-1 text-[11px] text-violet-300/80">{l.voltouAVitoria}</p>
                      )}
                      {l.naoContactar && (
                        <p className="mb-1 text-[11px] font-semibold text-rose-300">Não contactar — cancelou o pedido e pediu para não voltar a ser contactado</p>
                      )}
                      {/* No telemóvel: por abrir, ou arquivada — o que no WhatsApp não se vê. */}
                      {l.estado === "por_responder" && (l.porLerNoTelemovel > 0 || l.arquivadaNoTelemovel) && (
                        <p className="mb-1 text-[11px] text-red-300">
                          {l.porLerNoTelemovel > 0 &&
                            (l.porLerNoTelemovel === 1 ? "1 por abrir no telemóvel" : `${l.porLerNoTelemovel} por abrir no telemóvel`)}
                          {l.porLerNoTelemovel > 0 && l.arquivadaNoTelemovel && " · "}
                          {l.arquivadaNoTelemovel && "arquivada no telemóvel"}
                        </p>
                      )}
                      <OrigemDaConversa mensagens={mensagens} />
                      <FioDaConversa mensagens={mensagens} />
                      <div className="mt-3 flex gap-2">
                        <input
                          value={resposta}
                          onChange={(e) => setResposta(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void responder();
                            }
                          }}
                          placeholder="Responder como CLYON…"
                          className={`${CAIXA} flex-1`}
                        />
                        <button
                          onClick={() => void responder()}
                          disabled={aResponder || !resposta.trim()}
                          className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-cyan-500 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-40"
                        >
                          {aResponder ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            "Enviar"
                          )}
                        </button>
                      </div>
                      {erroDaResposta && <p className="mt-2 text-xs text-red-300">{erroDaResposta}</p>}
                      {notaDaResposta && (
                        <p className="mt-2 text-xs text-emerald-300">{notaDaResposta}</p>
                      )}

                      {/*
                        O QUE A RELEITURA PERCEBEU, ANTES DE SAIR.
                        Um código postal inventado mas bem formado passa em
                        todos os validadores sem uma queixa. O único guarda
                        contra isso são olhos humanos — e é este ecrã.
                      */}
                      {releitura?.telefone === l.telefone && (
                        <div className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.06] p-3">
                          <p className="text-xs font-semibold text-cyan-200">
                            {releitura.semLeitura ? (
                              <>
                                Não consegui RELER — mas continuo. Vou repetir a pergunta do passo
                                onde a conversa ficou.
                              </>
                            ) : releitura.propostas ? (
                              <>
                                Conversa das propostas
                                {releitura.pedido ? ` — pedido #${releitura.pedido}` : ""}. Reli{" "}
                                {releitura.linhasLidas} linha
                                {releitura.linhasLidas === 1 ? "" : "s"}.
                              </>
                            ) : (
                              <>
                                Reli {releitura.linhasLidas} linha
                                {releitura.linhasLidas === 1 ? "" : "s"} da conversa
                                {releitura.recuperados.length > 0
                                  ? ` e recuperei: ${releitura.recuperados.join(", ")}.`
                                  : " e não encontrei nada de novo."}
                              </>
                            )}
                          </p>
                          {/*
                            EDITÁVEL ANTES DE SAIR — 23-10-2026. *«Gostaria que
                            essa mensagem pudesse ser editada por mim, para caso
                            ela errasse, eu pudesse editar e enviar já a mensagem
                            correcta.»* — o dono. Nas propostas não: aí quem
                            escreve é o assistente, com as guardas de sempre.
                          */}
                          {releitura.propostas ? (
                            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-950/60 p-2 text-xs leading-relaxed text-slate-200">
                              {releitura.mensagem}
                            </p>
                          ) : (
                            <>
                              <textarea
                                value={textoDaReleitura}
                                onChange={(e) => setTextoDaReleitura(e.target.value)}
                                rows={Math.min(14, textoDaReleitura.split("\n").length + 2)}
                                aria-label="A mensagem que vai sair — pode editá-la"
                                className="mt-2 w-full resize-y rounded-lg border border-slate-700 bg-slate-950/60 p-2 text-xs leading-relaxed text-slate-200 outline-none focus:border-cyan-500"
                              />
                              <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                Pode editar antes de enviar — sai o que estiver aqui.
                                {textoDaReleitura !== releitura.mensagem && (
                                  <button
                                    type="button"
                                    onClick={() => setTextoDaReleitura(releitura.mensagem)}
                                    className="text-cyan-300 underline-offset-2 hover:underline"
                                  >
                                    Repor o texto da Vitória
                                  </button>
                                )}
                              </p>
                            </>
                          )}
                          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                            {releitura.semLeitura
                              ? "Os campos que ele já respondeu ficam como estão — não foram relidos. Isto só põe a conversa a andar outra vez."
                              : releitura.propostas
                              ? "Quem responde é o assistente, com as regras de sempre: fechar e recusar continuam a passar pelas mesmas guardas. Nada se fecha só por carregar aqui."
                              : releitura.completo
                                ? "Está tudo respondido — o que vai é o resumo, e o SIM dele regista o pedido."
                                : "Confirme antes de sair: um campo que ele nunca disse passa nos validadores na mesma."}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button
                              onClick={() =>
                                void reler(l.telefone, true, releitura.propostas ? undefined : textoDaReleitura)
                              }
                              disabled={aReler || (!releitura.propostas && !textoDaReleitura.trim())}
                              className={`${ACCAO} border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25`}
                            >
                              {aReler ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              ) : (
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                              {releitura.propostas || releitura.semLeitura
                                ? "Continuar a conversa"
                                : "Confirmar e enviar"}
                            </button>
                            <button
                              onClick={() => setReleitura(null)}
                              className={`${ACCAO} border-transparent text-slate-400 hover:bg-slate-800`}
                            >
                              Deixar estar
                            </button>
                          </div>
                        </div>
                      )}

                      {/*
                        O resto do poder sobre esta conversa. Fica cá dentro de
                        propósito: são gestos de arrumação, e a linha fechada
                        tem de continuar a caber num telemóvel. Desde d124 só
                        os três de todos os dias à vista; os outros em «Mais».
                      */}
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-800 pt-3">
                        {l.estado !== "bloqueada" && (
                          <button
                            onClick={() => setACriarPedido(aCriarPedido === l.telefone ? null : l.telefone)}
                            className={`${ACCAO} border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10`}
                            title={
                              recolhaAberta?.pedidoId != null
                                ? `Esta conversa já tem o pedido #${recolhaAberta.pedidoId}. Abre o formulário para registar outro.`
                                : "Abre o «Registar pedido» com o que o assistente já recolheu nesta conversa."
                            }
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            {recolhaAberta?.pedidoId != null ? "Criar outro pedido" : "Criar pedido"}
                          </button>
                        )}
                        {/*
                          RELER, E NÃO RECOMEÇAR.
                          "Quando clico em Recomeçar conversa ele devia ler as
                          mensagens anteriores para recomeçar de onde parámos."
                          Vem primeiro e é o botão a sério; o recomeçar do zero
                          fica no «Mais», para quando a conversa se baralhou mesmo.
                        */}
                        <button
                          onClick={() => void reler(l.telefone, false)}
                          disabled={ocupado || aReler}
                          className={`${ACCAO} border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10`}
                          title="Lê a conversa toda, reconstrói o que ele já respondeu, e pergunta só o que falta."
                        >
                          {aReler && releitura?.telefone !== l.telefone ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          Reler e continuar
                        </button>
                        {/* GUARDAR PARA CONTINUAR — 21-10-2026, com a nota do que falta. */}
                        {l.estado !== "bloqueada" &&
                          (l.guardada ? (
                            <button
                              onClick={() => void agir("desguardar", l.telefone)}
                              disabled={ocupado}
                              className={`${ACCAO} border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10`}
                            >
                              <BookmarkX className="h-3.5 w-3.5" aria-hidden="true" />
                              Tirar dos guardados
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                const nota = window.prompt("O que falta fazer nesta conversa? (opcional)");
                                if (nota !== null) void agir("guardar", l.telefone, nota.trim() || undefined);
                              }}
                              disabled={ocupado}
                              className={`${ACCAO} border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10`}
                              title="Fica no separador «Guardadas», com uma nota, para continuar depois."
                            >
                              <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                              Guardar para continuar
                            </button>
                          ))}
                        <button
                          type="button"
                          onClick={() => setMaisNaConversa((v) => !v)}
                          aria-expanded={maisNaConversa}
                          className={`${ACCAO} border-slate-700 text-slate-400 hover:bg-slate-800`}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                          {maisNaConversa ? "Menos" : "Mais"}
                        </button>
                      </div>
                      {maisNaConversa && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {l.passo && (
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "O assistente volta a perguntar tudo desde o serviço. Continuar?",
                                  )
                                ) {
                                  void agir("recomecarRecolha", l.telefone);
                                }
                              }}
                              disabled={ocupado}
                              className={`${ACCAO} border-violet-500/40 text-violet-300 hover:bg-violet-500/10`}
                              title="Apaga o que já foi respondido e recomeça do princípio."
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                              Recomeçar do zero
                            </button>
                          )}
                          {l.estado !== "bloqueada" && (
                            <button
                              onClick={() => void pedirLeitura(l.telefone)}
                              disabled={aLer}
                              className={`${ACCAO} border-violet-500/40 text-violet-300 hover:bg-violet-500/10`}
                              title="A Vitória lê esta conversa e diz em que pé está; se acabou, fecha-a com o porquê."
                            >
                              {aLer ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              ) : (
                                <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                              Pedir à Vitória para ler
                            </button>
                          )}
                          {l.estado !== "bloqueada" && (
                            <button
                              onClick={() => void agir("bloquear", l.telefone)}
                              disabled={ocupado}
                              className={`${ACCAO} border-red-500/40 text-red-300 hover:bg-red-500/10`}
                            >
                              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                              Bloquear
                            </button>
                          )}
                          {/*
                            O administrador exclui (a conversa, os pedidos sem
                            trabalho e o que a Vitória sabia — 23-10-2026); quem
                            não é administrador apaga só a conversa, como antes.
                          */}
                          {eAdmin ? (
                            <button
                              onClick={() => excluir([l.telefone], l.pedido ? [l.pedido.id] : [])}
                              disabled={ocupado}
                              className={`${ACCAO} border-red-500/40 text-red-300 hover:bg-red-500/10`}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Excluir cliente e pedido
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Apagar a conversa com ${quem}?\n\n` +
                                      "Apaga o histórico de mensagens, a recolha a meio e o que estiver " +
                                      "por sair na fila para este número. Não se desfaz.\n\n" +
                                      "O bloqueio e a entrega a si, se existirem, ficam como estão.",
                                  )
                                ) {
                                  setConversaAberta(null);
                                  void agir("apagarConversa", l.telefone);
                                }
                              }}
                              disabled={ocupado}
                              className={`${ACCAO} border-transparent text-slate-500 hover:bg-slate-800 hover:text-red-300`}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Apagar conversa
                            </button>
                          )}
                        </div>
                      )}

                      {aCriarPedido === l.telefone && (
                        <div className="mt-3">
                          <RegistarPedido
                            key={l.telefone}
                            inicial={camposDaRecolha(
                              l.telefone,
                              // Um rascunho que já virou pedido não se repete noutro.
                              recolhaAberta?.pedidoId == null ? recolhaAberta?.dados : null,
                            )}
                            recolhaWhatsApp={l.telefone}
                            onCriado={() => void carregar(true)}
                            onFechar={() => setACriarPedido(null)}
                          />
                        </div>
                      )}

                      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                        {aMao
                          ? `Enviar abre o ${porOnde === "web" ? "WhatsApp Web" : "WhatsApp do telemóvel"} da CLYON com o texto pronto — carregue em enviar lá. Fica registado aqui como saída.`
                          : "Sai pelo número da plataforma, e passa por cima do interruptor e das entregas — aqui quem fala é a equipa. O WhatsApp só recusa texto livre se ele não escrever há mais de 24 horas."}
                      </p>

                      {/*
                        Sem API não há webhook: o que o cliente responde chega
                        ao WhatsApp Web e não a este ecrã. Cola-se aqui, na
                        conversa a que pertence — e já não num formulário
                        solto no topo, onde era preciso escrever o número.
                      */}
                      {aMao && (
                        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                          <p className="text-xs font-semibold text-slate-300">
                            Chegou uma resposta no WhatsApp Web
                          </p>
                          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                            <input
                              value={textoRecebido}
                              onChange={(e) => setTextoRecebido(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  void registarRecebida();
                                }
                              }}
                              placeholder="Colar aqui o que ele respondeu…"
                              className={`${CAIXA} flex-1`}
                            />
                            <button
                              onClick={() => void registarRecebida()}
                              disabled={
                                aRegistar ||
                                !textoRecebido.trim() ||
                                numeroRecebido.replace(/\D/g, "").length < 9
                              }
                              className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-cyan-500 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-40"
                            >
                              {aRegistar ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : (
                                "Registar"
                              )}
                            </button>
                          </div>
                          {avisoRecebido && (
                            <p className="mt-2 text-xs leading-relaxed text-slate-400">
                              {avisoRecebido}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
                </Fragment>
              );
            })}
          </ul>
        )}
      </section>

      {/*
        A fila por enviar. Pela ponte, só se vê; à mão, é o sítio onde o
        trabalho acontece: cada mensagem tem o botão que abre o WhatsApp da
        CLYON com ela pronta, e o de a dar por enviada. Por isso à mão a
        secção aparece sempre, mesmo vazia — é a caixa de saída. Desde d124
        cada mensagem é uma linha (quem, e o início do texto); o resto ao
        carregar.
      */}
      {(estado.fila.length > 0 || aMao) && (
        <section
          className={`rounded-2xl border px-4 py-3 ${
            aMao ? "border-cyan-500/30 bg-cyan-500/[0.05]" : "border-slate-800 bg-slate-900/60"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white">
              {aMao
                ? porOnde === "web"
                  ? "Para enviar pelo WhatsApp Web"
                  : "Para enviar do telemóvel"
                : "Na fila para sair"}{" "}
              {estado.fila.length > 0 && (
                <span className="ml-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                  {estado.fila.length}
                </span>
              )}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {aMao
                  ? `${rotuloDeAbrir} abre a conversa no ${numeroDaClyon} com o texto já escrito — envie lá e marque-a aqui.`
                  : "O Winapp vem buscá-las de poucos em poucos segundos."}
                {!estado.ligado && " Desligado, o assistente não escreve nada de novo."}
              </span>
            </h3>
            {/*
              Limpar a fila inteira. Pedida ao ver o mesmo menu de dez serviços
              duas vezes à espera de sair para o mesmo número: descartar uma a
              uma são dois gestos por mensagem, e o que se quer naquele momento
              é que NADA daquilo saia.
            */}
            {estado.fila.length > 0 && (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Limpar a fila inteira?\n\n${estado.fila.length} mensagem(ns) deixam de sair. ` +
                        "Não se apaga nada do histórico das conversas.",
                    )
                  ) {
                    void agirNaFila("limparFila");
                  }
                }}
                disabled={ocupado}
                className={`${ACCAO} border-slate-600 text-slate-300 hover:bg-slate-800`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Limpar fila
              </button>
            )}
          </div>
          {estado.fila.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Nada por enviar.</p>
          ) : (
            <ul className="mt-1 divide-y divide-slate-800">
              {estado.fila.map((m) => {
                const aberta = textosAbertos.has(m.id);
                return (
                  <li key={m.id} className="py-2">
                    <button
                      type="button"
                      onClick={() => alternarTexto(m.id)}
                      aria-expanded={aberta}
                      className="block w-full min-w-0 text-left"
                    >
                      <span className="block truncate text-xs font-semibold text-slate-200">{quemE(m.telefone)}</span>
                      {!aberta && <span className="block truncate text-sm text-slate-400">{inicioDoTexto(m.texto)}</span>}
                    </button>
                    {aberta && (
                      <div className="mt-1 space-y-1">
                        <p className="whitespace-pre-wrap break-words text-sm text-slate-300">{m.texto}</p>
                        <VerNumero telefone={m.telefone} />
                      </div>
                    )}
                    {aMao && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a
                          href={linkParaEnviar(m.telefone, m.texto)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-slate-950 transition hover:bg-emerald-400"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          {rotuloDeAbrir}
                        </a>
                        <button
                          onClick={() => void agirNaFila("enviada", m.id)}
                          disabled={ocupado}
                          className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          Marcar como enviada
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm("Descartar esta mensagem sem a enviar?")) {
                              void agirNaFila("descartar", m.id);
                            }
                          }}
                          disabled={ocupado}
                          className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs text-slate-500 transition hover:bg-slate-800 hover:text-slate-300 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Descartar
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/*
        AS DESCARTADAS, COM QUEM E PORQUÊ — d124. Nada se apaga: uma mensagem
        que não saiu continua escrita, e aqui vê-se quem a tirou («sozinha»,
        ou o nome) e porquê. Recolhido: é um registo, não trabalho.
      */}
      {vistaDoPainel === "conversas" && (estado.descartadas?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setDescartadasAbertas((v) => !v)}
            aria-expanded={descartadasAbertas}
            className="flex w-full items-center justify-between gap-2 text-left text-xs text-slate-400"
          >
            <span>
              <b className="text-slate-300">Descartadas</b> nos últimos 7 dias · {estado.descartadas?.length}
            </span>
            {descartadasAbertas ? (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
          </button>
          {descartadasAbertas && (
            <ul className="mt-1 divide-y divide-slate-800">
              {estado.descartadas?.map((m) => (
                <li key={m.id} className="py-1.5 text-xs">
                  <p className="truncate text-slate-300">
                    <b>{quemE(m.telefone)}</b>
                    <span className="text-slate-500"> · {inicioDoTexto(m.texto, 70)}</span>
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {m.porque ?? "descartada"}
                    {m.por && m.por !== DESCARTADA_SOZINHA ? ` (${m.por})` : ""} · {haQuanto(m.haMinutos * 60)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
