"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Ban,
  BookOpen,
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
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

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
};

/** O passo da recolha, em palavras de painel. */
const PASSO_DA_RECOLHA: Record<string, string> = {
  servico: "a escolher o serviço",
  nome: "a dizer o nome",
  morada: "a dar a morada",
  codigoPostal: "a dar o código postal",
  moradaDestino: "a dar o destino",
  codigoPostalDestino: "a dar o código postal do destino",
  andar: "a dizer o andar",
  elevador: "a dizer se há elevador",
  estacionamento: "a dizer se dá para estacionar",
  entulhoQuantidade: "a dizer quanto entulho",
  quando: "a dizer para quando",
  descricao: "a descrever",
  fatura: "a dizer se quer factura",
  confirmar: "a confirmar o resumo",
};

type Mensagem = { direccao: string; texto: string; criadoEm: string };

/** Em que pé está um número. A ordem de precedência está em `estadoDe`. */
type EstadoDaConversa = "assistente" | "entregue" | "arquivada" | "bloqueada";

/**
 * Uma linha da mesa. É a fusão das quatro listas antigas num tipo só — um
 * número pode ter fio e não ter estado, ou ter estado e nunca ter escrito
 * (um bloqueado à mão), e os dois têm de caber na mesma linha.
 */
type Linha = {
  telefone: string;
  estado: EstadoDaConversa;
  ultimaMensagem: string | null;
  direccao: string | null;
  quando: string | null;
  /** O passo da recolha, quando o assistente está a meio de um pedido. */
  passo: string | null;
  /** O motivo da entrega ou a nota do bloqueio — quem é, porquê. */
  nota: string | null;
  desdeQuando: string | null;
};

const CAIXA =
  "rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";

/** O botão pequeno das acções de uma linha. */
const ACCAO =
  "flex min-h-[34px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition disabled:opacity-40";

/** Os últimos nove dígitos — é assim que todo o WhatsApp da casa compara números. */
function ultimos9(t: string): string {
  return t.replace(/\D/g, "").slice(-9);
}

function formatarTelefone(t: string): string {
  const d = t.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("351")) {
    return `+351 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
  }
  return d;
}

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
const CORES: Record<EstadoDaConversa, string> = {
  assistente: "bg-violet-500/15 text-violet-300",
  entregue: "bg-amber-500/15 text-amber-300",
  arquivada: "bg-slate-700/60 text-slate-300",
  bloqueada: "bg-red-500/15 text-red-300",
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
  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (mesmoDia(d, hoje)) return "Hoje";
  if (mesmoDia(d, ontem)) return "Ontem";
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
                  {m.texto}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const SEPARADORES: Array<{ id: EstadoDaConversa; titulo: string; vazio: string }> = [
  {
    id: "assistente",
    titulo: "Com o assistente",
    vazio: "Nenhuma conversa em curso. As novas aparecem aqui assim que alguém escrever.",
  },
  {
    id: "entregue",
    titulo: "Entregues a si",
    vazio: "Nenhuma. O assistente está a tratar de todas.",
  },
  { id: "arquivada", titulo: "Arquivadas", vazio: "Nada arrumado ainda." },
  { id: "bloqueada", titulo: "Bloqueadas", vazio: "Ninguém bloqueado." },
];

export default function AdminWhatsAppPanel() {
  const { token, ready } = useAdminAuth();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [separador, setSeparador] = useState<EstadoDaConversa>("assistente");
  const [aAdicionar, setAAdicionar] = useState(false);
  const [numeroNovo, setNumeroNovo] = useState("");
  const [notaNova, setNotaNova] = useState("");
  const [conversaAberta, setConversaAberta] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [resposta, setResposta] = useState("");
  const [aResponder, setAResponder] = useState(false);
  const [erroDaResposta, setErroDaResposta] = useState("");
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
  } | null>(null);
  const [aReler, setAReler] = useState(false);

  const carregar = useCallback(async () => {
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
    // O estado muda fora daqui (o Winapp interrompe, a fila esvazia): o ecrã
    // acompanha sozinho, como o painel do profissional.
    const t = setInterval(() => void carregar(), 30_000);
    return () => clearInterval(t);
  }, [ready, carregar]);

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

  const abrirConversa = useCallback(
    async (telefone: string) => {
      if (!token) return;
      setConversaAberta(telefone);
      setErroDaResposta("");
      try {
        const res = await fetch(`/api/admin/whatsapp?telefone=${encodeURIComponent(telefone)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const dados = await res.json();
        setMensagens(res.ok ? (dados.mensagens ?? []) : []);
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
          });
          return;
        }
        setReleitura(null);
        if (dados.aviso) setErroDaResposta(dados.aviso);
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
   * AS QUATRO LISTAS ANTIGAS, FUNDIDAS NUMA.
   *
   * Cada número entra uma vez só, com o estado mais forte que tiver: um
   * bloqueado é bloqueado mesmo que tenha fio, e uma arquivada sai da mesa
   * mesmo que esteja entregue. Era esta a conta que antes se fazia de cabeça,
   * a saltar entre listas — o +351 961 899 575 aparecia em duas ao mesmo tempo.
   */
  const linhas = useMemo<Linha[]>(() => {
    if (!estado) return [];
    const porNumero = new Map<string, Linha>();

    const bloqueadoDe = new Map(estado.bloqueados.map((b) => [ultimos9(b.telefone), b] as const));
    const entregueDe = new Map(estado.interrompidos.map((i) => [ultimos9(i.telefone), i] as const));
    const arquivadaDe = new Map((estado.arquivadas ?? []).map((a) => [ultimos9(a.telefone), a] as const));
    const recolhaDe = new Map((estado.recolhas ?? []).map((r) => [ultimos9(r.telefone), r] as const));

    const estadoDe = (chave: string): EstadoDaConversa =>
      bloqueadoDe.has(chave)
        ? "bloqueada"
        : arquivadaDe.has(chave)
          ? "arquivada"
          : entregueDe.has(chave)
            ? "entregue"
            : "assistente";

    const notaDe = (chave: string) =>
      bloqueadoDe.get(chave)?.nota ?? entregueDe.get(chave)?.motivo ?? null;
    const desdeDe = (chave: string) =>
      bloqueadoDe.get(chave)?.criadoEm ??
      entregueDe.get(chave)?.criadoEm ??
      arquivadaDe.get(chave)?.criadoEm ??
      null;

    for (const c of estado.conversas) {
      const chave = ultimos9(c.telefone);
      porNumero.set(chave, {
        telefone: c.telefone,
        estado: estadoDe(chave),
        ultimaMensagem: c.ultimaMensagem,
        direccao: c.direccao,
        quando: c.quando,
        passo: recolhaDe.get(chave)?.passo ?? null,
        nota: notaDe(chave),
        desdeQuando: desdeDe(chave),
      });
    }

    // Um número bloqueado ou entregue à mão pode nunca ter escrito. Sem isto
    // desaparecia do ecrã — e ficava um bloqueio que ninguém conseguia desfazer.
    for (const [chave, fonte] of [...bloqueadoDe, ...entregueDe]) {
      if (porNumero.has(chave)) continue;
      porNumero.set(chave, {
        telefone: fonte.telefone,
        estado: estadoDe(chave),
        ultimaMensagem: null,
        direccao: null,
        quando: null,
        passo: recolhaDe.get(chave)?.passo ?? null,
        nota: notaDe(chave),
        desdeQuando: desdeDe(chave),
      });
    }

    // O mais recente primeiro; quem nunca escreveu vai para o fim.
    return [...porNumero.values()].sort((a, b) => {
      const ta = a.quando ? new Date(a.quando).getTime() : 0;
      const tb = b.quando ? new Date(b.quando).getTime() : 0;
      return tb - ta;
    });
  }, [estado]);

  const contagens = useMemo(() => {
    const c: Record<EstadoDaConversa, number> = {
      assistente: 0,
      entregue: 0,
      arquivada: 0,
      bloqueada: 0,
    };
    for (const l of linhas) c[l.estado] += 1;
    return c;
  }, [linhas]);

  const visiveis = useMemo(() => linhas.filter((l) => l.estado === separador), [linhas, separador]);

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
        A MESA. Uma lista, quatro separadores — e as acções de cada número na
        linha dele, que é onde quem está ao telefone as vai procurar.
      */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white">Conversas</h3>
          <div className="flex items-center gap-2">
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
              onClick={() => void carregar()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Actualizar
            </button>
          </div>
        </div>

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
                    setSeparador("entregue");
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
          {SEPARADORES.map((s) => (
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

        {visiveis.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {SEPARADORES.find((s) => s.id === separador)?.vazio}
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-slate-800">
            {visiveis.map((l) => {
              const aberta = conversaAberta === l.telefone;
              return (
                <li key={l.telefone}>
                  <div className="flex flex-col gap-2 py-2.5 lg:flex-row lg:items-center">
                    <button
                      onClick={() => alternarConversa(l.telefone)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="flex flex-wrap items-center gap-2 font-mono text-sm text-white">
                        {formatarTelefone(l.telefone)}
                        {l.passo && l.estado === "assistente" && (
                          <span
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold ${CORES.assistente}`}
                          >
                            <Bot className="h-3 w-3" aria-hidden="true" />
                            {PASSO_DA_RECOLHA[l.passo] ?? l.passo}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {l.ultimaMensagem ? (
                          <>
                            {l.direccao === "out" ? "→ " : ""}
                            {l.ultimaMensagem}
                          </>
                        ) : (
                          (l.nota ?? "Sem mensagens registadas.")
                        )}
                      </p>
                    </button>

                    {/*
                      A acção principal de cada estado, na própria linha. Parar o
                      assistente é o gesto urgente — quem chega a este ecrã a
                      meio de uma conversa má quer calá-lo já, e não depois de
                      abrir mais alguma coisa.
                    */}
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <span className="text-xs text-slate-500">
                        {l.quando ? desde(l.quando) : l.desdeQuando ? desde(l.desdeQuando) : ""}
                      </span>
                      {l.estado === "assistente" && (
                        <button
                          onClick={() => void agir("interromper", l.telefone, "Pelo backoffice")}
                          disabled={ocupado}
                          className={`${ACCAO} border-amber-500/40 text-amber-300 hover:bg-amber-500/10`}
                        >
                          <Hand className="h-3.5 w-3.5" aria-hidden="true" />
                          Assumir
                        </button>
                      )}
                      {l.estado === "entregue" && (
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
                      {l.estado === "arquivada" && (
                        <button
                          onClick={() => void agir("desarquivar", l.telefone)}
                          disabled={ocupado}
                          className={`${ACCAO} border-slate-600 text-slate-300 hover:bg-slate-800`}
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
                          Repor na mesa
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

                      {/*
                        O QUE A RELEITURA PERCEBEU, ANTES DE SAIR.
                        Um código postal inventado mas bem formado passa em
                        todos os validadores sem uma queixa. O único guarda
                        contra isso são olhos humanos — e é este ecrã.
                      */}
                      {releitura?.telefone === l.telefone && (
                        <div className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.06] p-3">
                          <p className="text-xs font-semibold text-cyan-200">
                            Reli {releitura.linhasLidas} linha
                            {releitura.linhasLidas === 1 ? "" : "s"} da conversa
                            {releitura.recuperados.length > 0
                              ? ` e recuperei: ${releitura.recuperados.join(", ")}.`
                              : " e não encontrei nada de novo."}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-950/60 p-2 text-xs leading-relaxed text-slate-200">
                            {releitura.mensagem}
                          </p>
                          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                            {releitura.completo
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
                              Confirmar e enviar
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
                        {l.estado !== "arquivada" && l.estado !== "bloqueada" && (
                          <button
                            onClick={() => void agir("arquivar", l.telefone)}
                            disabled={ocupado}
                            className={`${ACCAO} border-slate-600 text-slate-300 hover:bg-slate-800`}
                            title="Sai da mesa. Não se apaga nada — está no separador «Arquivadas»."
                          >
                            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                            Arquivar
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

                      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                        {aMao
                          ? `Enviar abre o ${porOnde === "web" ? "WhatsApp Web" : "WhatsApp do telemóvel"} da CLYON com o texto pronto — carregue em enviar lá. Fica registado aqui como saída.`
                          : "Sai pelo número da plataforma, e passa por cima do interruptor e das entregas — aqui quem fala é você. O WhatsApp só recusa texto livre se ele não escrever há mais de 24 horas."}
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
                  <p className="font-mono text-xs text-slate-400">{formatarTelefone(m.telefone)}</p>
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
