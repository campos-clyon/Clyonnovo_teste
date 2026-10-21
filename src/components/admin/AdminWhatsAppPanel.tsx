"use client";

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
  ExternalLink,
  Hand,
  Loader2,
  MessageCircle,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminAssistenteAutoPanel from "./AdminAssistenteAutoPanel";
import RegistarPedido from "./RegistarPedido";
import { camposDaRecolha } from "@/lib/pedido-da-recolha";
import { telefoneLegivel } from "@/lib/telefone-legivel";
import { linhaQueAbre } from "@/lib/linha-que-abre";
import TelefoneComWhatsApp from "./TelefoneComWhatsApp";
import { hojeOuOntem } from "@/lib/hora-de-lisboa";
import { conversasVisiveis, procuraActiva } from "@/lib/procurar-conversas";
import { fichaDaPonte, type EstadoDaPonte } from "@/lib/ponte-viva";
import { eDaEquipa, semMarcaDeMao } from "@/lib/rajada-do-whatsapp";
import {
  contarNaMesa,
  eEsperaAntiga,
  linhasDoSeparador,
  PASSO_DA_RECOLHA,
  SEPARADORES_DA_MESA,
  type ConversaNaMesa,
  type EstadoNaMesa,
} from "@/lib/mesa-das-conversas";

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
  /**
   * A leitura das mensagens está em baixo? `null` quando está de pé.
   *
   * Sem isto, uma quota esgotada do Gemini é indistinguível de tudo estar bem:
   * o assistente volta às palavras-chave e ninguém dá por nada.
   */
  compreensao?: { quando: string; motivo: string } | null;
  /**
   * Quando a ponte cá veio pela última vez, em ISO. `null` = nunca.
   *
   * Quando ela morre, o site continua a parecer normal — o assistente
   * escreve, a fila enche-se, e ninguém vê. Ver `ponte-viva.ts`.
   */
  ponteVistaEm?: string | null;
};

type Mensagem = { direccao: string; texto: string; criadoEm: string };

/**
 * O separador aberto — um estado da mesa, ou as guardadas (21-10-2026).
 *
 * Os separadores antigos diziam QUEM tinha a conversa (o assistente, uma
 * pessoa, arquivada). Estes dizem O QUE FALTA FAZER — ver
 * `mesa-das-conversas.ts`. Quem a tem passou a ser uma etiqueta da linha.
 */
type Separador = EstadoNaMesa | "guardada";

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

function desde(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-PT", {
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
  resolvida: "bg-emerald-500/15 text-emerald-300",
  bloqueada: "bg-slate-700/60 text-slate-300",
};

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
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Só as horas: é o que o WhatsApp mostra dentro do balão. */
function horaDaMensagem(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
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
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  // A Vitória a ler as conversas, e o que disse no fim (21-10-2026).
  const [aLer, setALer] = useState(false);
  const [avisoDaLeitura, setAvisoDaLeitura] = useState("");
  const [separador, setSeparador] = useState<Separador>("por_responder");
  /*
   * A PROCURA, e porque é que ela ignora o separador.
   *
   * Quem chega aqui com um número na mão não sabe em qual das quatro listas
   * ele está — é essa a pergunta. A regra vive em `procurar-conversas.ts`,
   * fora do painel, porque é a única coisa deste ecrã que se pode provar.
   */
  const [procura, setProcura] = useState("");
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
    async (telefone: string, confirmar: boolean) => {
      if (!token) return;
      setAReler(true);
      setErroDaResposta("");
      setNotaDaResposta("");
      try {
        const res = await fetch("/api/admin/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ accao: "relerConversa", telefone, confirmar }),
        });
        const dados = await res.json();
        if (!res.ok) {
          setErroDaResposta(dados.error ?? "Não foi possível reler.");
          setReleitura(null);
          return;
        }
        if (dados.previsao) {
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
          : "Registada. O assistente não tinha nada a dizer a este número (sem pedido activo, entregue a si ou bloqueado) — responda à mão se for preciso.",
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
        nota: [c.porque, c.motivoDaEntrega, c.guardada?.nota].filter(Boolean).join(" · "),
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
    manual: `pelo WhatsApp Web do ${formatarTelefone(estado.numeroManual ?? "351931632622")} — sem API por agora`,
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
  const numeroDaClyon = formatarTelefone(estado.numeroManual ?? "351931632622");

  /**
   * O link que abre o WhatsApp da CLYON já com o destinatário e o texto —
   * no WhatsApp Web deste computador ou, se preferir, no telemóvel.
   */
  const linkParaEnviar = (telefone: string, texto: string) => {
    const digitos = telefone.replace(/\D/g, "");
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

  const agirNaFila = async (accao: "enviada" | "descartar" | "limparFila", id?: number) => {
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
    setNumeroRecebido(telefone);
    void abrirConversa(telefone);
  };

  return (
    <div className="space-y-4">
      {/* O interruptor geral: o estado em letras grandes e UM gesto ao lado. */}
      {/*
        A COMPREENSÃO EM BAIXO — a avaria que não se via.

        A 14-09-2026 a quota do Gemini esgotou-se. O assistente passou o dia a
        responder por palavras-chave a clientes que escreviam frases normais
        («Sim serve», «Aceito a proposta da Revolution»), e não houve um sinal
        em lado nenhum — a falha é apanhada e o caminho antigo segue, que é o
        comportamento certo, mas ninguém ficava a saber. Foi descoberto a ler
        uma conversa à mão, um dia depois.

        Fica em cima de tudo, e com o motivo de quem recusou: «429 quota
        excedida» e «falta a chave» têm remédios diferentes.
      */}
      {estado.compreensao && (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.08] p-4">
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
          {/*
            TESTAR AGORA — 12-10-2026. A faixa só muda quando o assistente lê
            uma mensagem; depois de resolver a avaria na Google, ficava aqui até
            um cliente escrever. Isto lê uma frase de ensaio, sem enviar nada.
          */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void testarLeitura()}
              disabled={aTestar}
              className="rounded-lg border border-amber-400/50 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-500/25 disabled:opacity-60"
            >
              {aTestar ? "A testar…" : "Testar agora"}
            </button>
            {resultadoDoTeste && (
              <span className="text-[11px] text-amber-100/80">{resultadoDoTeste}</span>
            )}
          </div>
        </section>
      )}

      <section
        className={`rounded-2xl border p-5 ${
          estado.ligado
            ? "border-emerald-500/25 bg-emerald-500/[0.06]"
            : "border-red-500/30 bg-red-500/[0.07]"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-lg font-bold text-white">
              <MessageCircle
                className={`h-5 w-5 ${estado.ligado ? "text-emerald-400" : "text-red-400"}`}
                aria-hidden="true"
              />
              {estado.ligado ? "Ligado" : "DESLIGADO — ninguém recebe nada"}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {estado.ligado
                ? `A falar ${CANAL}.`
                : "As mensagens novas ficam na fila à espera de o voltar a ligar."}
            </p>

            {/*
              A PONTE ESTÁ VIVA? A pergunta que custou uma manhã.

              Uma cliente escreveu às 12:58 e ninguém lhe respondeu, e para
              saber porquê era preciso abrir o painel, procurar o número, ver
              se a conversa lá estava e se a fila tinha coisas por sair — e
              mesmo assim ficava a dúvida. Isto responde de relance.
            */}
            {ponte && (
              <div className="mt-2">
                <p className={`flex items-center gap-2 text-sm font-semibold ${SINAL_DA_PONTE[ponte.estado].texto}`}>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${SINAL_DA_PONTE[ponte.estado].ponto} ${
                      ponte.estado === "viva" ? "animate-pulse" : ""
                    }`}
                    aria-hidden="true"
                  />
                  {ponte.titulo}
                </p>
                {ponte.explicacao !== "" && (
                  <p className="mt-1 max-w-prose text-xs leading-relaxed text-slate-400">
                    {ponte.explicacao}
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => agir(estado.ligado ? "desligar" : "ligar")}
            disabled={ocupado}
            className={`flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition disabled:opacity-50 ${
              estado.ligado
                ? "bg-red-500/15 text-red-300 hover:bg-red-500/25"
                : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            }`}
          >
            <Power className="h-4 w-4" aria-hidden="true" />
            {estado.ligado ? "Desligar tudo" : "Ligar outra vez"}
          </button>
        </div>
      </section>

      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/*
        O ASSISTENTE AUTOMÁTICO — os seis interruptores e o que ele fez.

        Fica dobrado por omissão e num ficheiro próprio: quem abre este ecrã
        vem quase sempre atender alguém, e a mesa tem de ser a primeira coisa
        que se vê. Os dados dele só são pedidos quando alguém o abre.
      */}
      <AdminAssistenteAutoPanel />

      {/*
        A MESA. Uma lista, quatro separadores — e as acções de cada número na
        linha dele, que é onde quem está ao telefone as vai procurar.
      */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white">Conversas</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
              <input
                value={procura}
                onChange={(e) => setProcura(e.target.value)}
                placeholder="Procurar por número ou nome"
                aria-label="Procurar uma conversa"
                className="w-56 rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-8 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-500"
              />
              {procura !== "" && (
                <button
                  onClick={() => setProcura("")}
                  aria-label="Limpar a procura"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-300"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              onClick={() => setAAdicionar((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
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
              className="flex items-center gap-1.5 rounded-lg border border-violet-500/40 px-3 py-1.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/10 disabled:opacity-40"
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
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Actualizar
            </button>
          </div>
        </div>
        {avisoDaLeitura && <p className="mt-2 text-xs text-violet-200">{avisoDaLeitura}</p>}

        {/*
          Entregar ou bloquear um número que ainda não escreveu. Era um bloco
          fixo a ocupar meio ecrã para uma coisa que se faz de vez em quando;
          agora abre-se quando é preciso.
        */}
        {aAdicionar && (
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
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

        {/* Os separadores: as listas antigas, agora com o número ao lado do nome. */}
        <div className="mt-3 flex flex-wrap gap-1.5 border-b border-slate-800 pb-3">
          {SEPARADORES_DA_MESA.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSeparador(s.id);
                setConversaAberta(null);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
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
        </div>

        {/*
          A LISTA TEM DE DIZER O QUE ESTÁ A MOSTRAR.
          Com procura escrita aparecem linhas de separadores que não estão
          abertos — sem esta frase, o ecrã contradizia-se a si próprio.
        */}
        {aProcurar && (
          <p className="mt-3 text-xs text-slate-400">
            A procurar <strong className="text-slate-200">em todos os separadores</strong>:{" "}
            {visiveis.length === 1 ? "1 conversa" : `${visiveis.length} conversas`}.
          </p>
        )}

        {visiveis.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {aProcurar
              ? "Nenhuma conversa com esse número ou nome."
              : SEPARADORES_DA_MESA.find((s) => s.id === separador)?.vazio}
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-slate-800">
            {visiveis.map((l, i) => {
              const aberta = conversaAberta === l.telefone;
              /*
               * A LINHA QUE SEPARA AS ANTIGAS — 21-10-2026. No «Por responder»,
               * as que esperam há mais de 3 dias vêm depois das de hoje (ver
               * `ordenarNaMesa`), e diz-se porquê.
               */
              const primeiraAntiga =
                separador === "por_responder" &&
                !aProcurar &&
                eEsperaAntiga(l) &&
                (i === 0 || !eEsperaAntiga(visiveis[i - 1]));
              return (
                <Fragment key={l.telefone}>
                {primeiraAntiga && (
                  <li className="py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Há mais de 3 dias
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Muitas foram respondidas à mão antes de a ponte guardar essas respostas. A Vitória
                      está a lê-las e fecha as que acabaram; as outras, feche-as ou responda.
                    </p>
                  </li>
                )}
                <li>
                  <div className="flex flex-col gap-2 py-2.5 lg:flex-row lg:items-center">
                    {/*
                      A LINHA QUE ABRE A CONVERSA — um botão até 21-10-2026; passou a
                      `linhaQueAbre`, para o número dentro dela ser um link que abre
                      o WhatsApp do cliente sem abrir a conversa aqui.
                    */}
                    <div
                      {...linhaQueAbre(() => alternarConversa(l.telefone), `Abrir a conversa com ${formatarTelefone(l.telefone)}`)}
                      className="min-w-0 flex-1 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                    >
                      <p className="flex flex-wrap items-center gap-2 font-mono text-sm text-white">
                        {/* O número abre o WhatsApp do cliente (21-10-2026). */}
                        <TelefoneComWhatsApp
                          telefone={l.telefone}
                          className="underline decoration-dotted underline-offset-2"
                        >
                          {formatarTelefone(l.telefone)}
                        </TelefoneComWhatsApp>
                        {/* De onde veio esta linha. Só faz falta quando a lista
                            deixou de ser a do separador aberto. */}
                        {aProcurar && (
                          <span
                            className={`rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold ${CORES[l.estado]}`}
                          >
                            {SEPARADORES_DA_MESA.find((s) => s.id === l.estado)?.titulo ?? l.estado}
                          </span>
                        )}
                        {/* Quem a tem: a Vitória, ou alguém da equipa (entregue). */}
                        {l.estado !== "bloqueada" && (
                          <span
                            title={l.motivoDaEntrega ? `Entregue: ${l.motivoDaEntrega}` : undefined}
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold ${
                              l.dono === "equipa" ? "bg-amber-500/15 text-amber-300" : "bg-violet-500/15 text-violet-300"
                            }`}
                          >
                            {l.dono === "equipa" ? (
                              <Hand className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <Bot className="h-3 w-3" aria-hidden="true" />
                            )}
                            {l.dono === "equipa" ? "Equipa" : "Vitória"}
                          </span>
                        )}
                        {l.passo && l.dono === "assistente" && l.estado !== "resolvida" && (
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 font-sans text-[11px] text-slate-300">
                            {PASSO_DA_RECOLHA[l.passo] ?? l.passo}
                          </span>
                        )}
                        {l.guardada && (
                          <span
                            title={l.guardada.nota ?? undefined}
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold ${CORES.guardada}`}
                          >
                            <Bookmark className="h-3 w-3" aria-hidden="true" />
                            Guardada{l.guardada.nota ? `: ${l.guardada.nota}` : ""}
                          </span>
                        )}
                      </p>
                      {/*
                        PORQUE É QUE ESTÁ AQUI, E ONDE PAROU — 21-10-2026. Era o
                        motivo da entrega, e só para alguns; agora todas dizem o
                        que falta: «Escreveu há 2 h: «Então?»», «Parou a dar a
                        morada», «Pedido #475 — agendado».
                      */}
                      <p title={l.porque} className={`truncate text-xs font-medium ${COR_DO_PORQUE[l.estado]}`}>
                        {l.porque}
                      </p>
                      {l.motivoDaEntrega && l.estado !== "resolvida" && (
                        <p className="truncate text-[11px] text-amber-300/80">Entregue: {l.motivoDaEntrega}</p>
                      )}
                      {/* No «Por responder» o porquê já cita a mensagem dele — não se repete. */}
                      {l.estado !== "por_responder" && (
                        <p className="truncate text-xs text-slate-500">
                          {l.ultimaMensagem ? (
                            <>
                              {l.direccao === "out" ? "→ " : ""}
                              {l.ultimaMensagem}
                            </>
                          ) : (
                            "Sem mensagens registadas."
                          )}
                        </p>
                      )}
                    </div>

                    {/*
                      A acção principal de cada estado, na própria linha. Parar o
                      assistente é o gesto urgente — quem chega a este ecrã a
                      meio de uma conversa má quer calá-lo já, e não depois de
                      abrir mais alguma coisa.
                    */}
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <span className="text-xs text-slate-500">{l.quando ? desde(l.quando) : ""}</span>
                      {l.dono === "assistente" && l.estado !== "bloqueada" && l.estado !== "resolvida" && (
                        <button
                          onClick={() => void agir("interromper", l.telefone, "Pelo backoffice")}
                          disabled={ocupado}
                          className={`${ACCAO} border-amber-500/40 text-amber-300 hover:bg-amber-500/10`}
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
                      {l.estado === "resolvida" && l.fechadaPor !== "pedido" && (
                        <button
                          onClick={() => void agir("reabrir", l.telefone)}
                          disabled={ocupado}
                          className={`${ACCAO} border-slate-600 text-slate-300 hover:bg-slate-800`}
                          title="Volta para a mesa, no pé em que estiver."
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
                          Reabrir
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
                    </div>
                  </div>

                  {aberta && (
                    <div className="mb-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
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
                          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-950/60 p-2 text-xs leading-relaxed text-slate-200">
                            {releitura.mensagem}
                          </p>
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
                              onClick={() => void reler(l.telefone, true)}
                              disabled={aReler}
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
                        tem de continuar a caber num telemóvel.
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
                          fica ao lado, para quando a conversa se baralhou mesmo.
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
                        {/*
                          FECHAR, COM O PORQUÊ — 21-10-2026. Era «Arquivar»;
                          passa para «Resolvidas» com o motivo escrito, e
                          volta sozinha se o cliente escrever outra vez.
                        */}
                        {l.estado !== "resolvida" && l.estado !== "bloqueada" && (
                          <button
                            onClick={() => {
                              const motivo = window.prompt(
                                "Porque fica resolvida? (ex.: «serviço feito», «cliente desistiu», «só queria informação»)",
                              );
                              if (motivo !== null) void agir("fechar", l.telefone, motivo.trim() || undefined);
                            }}
                            disabled={ocupado}
                            className={`${ACCAO} border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10`}
                            title="Passa para «Resolvidas», com o porquê. Volta à mesa sozinha se o cliente escrever outra vez."
                          >
                            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                            Fechar
                          </button>
                        )}
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
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Apagar a conversa com ${formatarTelefone(l.telefone)}?\n\n` +
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
                      </div>

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
        secção aparece sempre, mesmo vazia — é a caixa de saída.
      */}
      {(estado.fila.length > 0 || aMao) && (
        <section
          className={`rounded-2xl border p-5 ${
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
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {aMao
              ? `${rotuloDeAbrir} abre a conversa no ${numeroDaClyon} com o texto já escrito — carregue em enviar lá e volte aqui para a marcar como enviada.`
              : "O Winapp vem buscá-las de poucos em poucos segundos."}
            {!estado.ligado && " Desligado, o assistente não escreve nada de novo."}
          </p>
          {estado.fila.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nada por enviar.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-800">
              {estado.fila.map((m) => (
                <li key={m.id} className="py-3">
                  <p className="font-mono text-xs text-slate-400">
                    <TelefoneComWhatsApp telefone={m.telefone} className="underline decoration-dotted underline-offset-2">
                      {formatarTelefone(m.telefone)}
                    </TelefoneComWhatsApp>
                  </p>
                  <p
                    className={`mt-0.5 whitespace-pre-wrap text-sm text-slate-300 ${aMao ? "" : "truncate"}`}
                  >
                    {m.texto}
                  </p>
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
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
