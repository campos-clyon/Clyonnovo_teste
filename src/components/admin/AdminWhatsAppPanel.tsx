"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Ban,
  Check,
  ExternalLink,
  Hand,
  Loader2,
  MessageCircle,
  Power,
  RefreshCw,
  Trash2,
  Undo2,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * O painel de controlo do WhatsApp da plataforma.
 *
 * O mesmo poder do painel do Winapp, sobre o cérebro DAQUI — e organizado
 * pela pergunta que o dono traz: "quem está a falar com este número agora?"
 *
 *   LIGADO      → o cérebro responde e envia propostas.
 *   Entregue    → uma pessoa está nessa conversa; o cérebro cala-se NELA.
 *   Bloqueado   → contacto pessoal ou indesejado; nunca ninguém automático
 *                 fala com ele, e o que escrever é ignorado.
 *   DESLIGADO   → um gesto e cala-se tudo, em todas as conversas.
 *
 * Interromper acontece sozinho quando ele responde à mão no WhatsApp — o
 * Winapp avisa o site. Aqui é onde se VÊ isso, e onde se devolve.
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

const CAIXA =
  "rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";

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
    : d.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AdminWhatsAppPanel() {
  const { token, ready } = useAdminAuth();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [numeroNovo, setNumeroNovo] = useState("");
  const [notaNova, setNotaNova] = useState("");
  const [conversaAberta, setConversaAberta] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [resposta, setResposta] = useState("");
  const [aResponder, setAResponder] = useState(false);
  const [erroDaResposta, setErroDaResposta] = useState("");
  /*
   * POR ONDE SE ENVIA À MÃO: pelo WhatsApp Web deste computador ou pelo
   * telemóvel. "Ative usando o WhatsApp Web por enquanto" — por isso o Web é
   * a omissão; a escolha fica neste navegador.
   */
  const [porOnde, setPorOnde] = useState<"web" | "telemovel">("web");
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem("clyon.whatsapp.porOnde");
      if (guardado === "telemovel" || guardado === "web") setPorOnde(guardado);
    } catch {
      /* sem armazenamento — fica o Web */
    }
  }, []);
  const escolherPorOnde = (v: "web" | "telemovel") => {
    setPorOnde(v);
    try {
      window.localStorage.setItem("clyon.whatsapp.porOnde", v);
    } catch {
      /* ignora */
    }
  };
  // "Chegou uma resposta": o que o cliente escreveu no WhatsApp Web, colado aqui.
  const [numeroRecebido, setNumeroRecebido] = useState("");
  const [textoRecebido, setTextoRecebido] = useState("");
  const [aRegistar, setARegistar] = useState(false);
  const [avisoRecebido, setAvisoRecebido] = useState("");

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

  const responder = useCallback(async () => {
    if (!token || !conversaAberta || !resposta.trim()) return;
    setAResponder(true);
    setErroDaResposta("");
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accao: "responder", telefone: conversaAberta, nota: resposta.trim() }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErroDaResposta(dados.error ?? "Não foi possível enviar.");
        return;
      }
      // À mão: o servidor não envia — devolve o link que abre o WhatsApp da
      // CLYON com o texto pronto (Web ou telemóvel, conforme a escolha).
      // Abre-se num separador e quem carregou envia.
      const link = porOnde === "web" && typeof dados.linkWeb === "string" ? dados.linkWeb : dados.link;
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
        body: JSON.stringify({ accao: "recebida", telefone: numeroRecebido, nota: textoRecebido.trim() }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setAvisoRecebido(dados.error ?? "Não foi possível registar.");
        return;
      }
      const naFila = Array.isArray(dados.fila) ? dados.fila.length : 0;
      setAvisoRecebido(
        naFila > 0
          ? "Registada. O cérebro respondeu — a resposta está na fila em baixo, para enviar."
          : "Registada. O cérebro não tinha nada a dizer a este número (sem pedido activo, entregue a si ou bloqueado) — responda à mão se for preciso.",
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

  if (!estado) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        A carregar o estado do WhatsApp…
      </div>
    );
  }

  const CANAL = {
    meta: "a falar pela API oficial da Meta",
    ponte: "a falar pela ponte do Winapp (o WhatsApp emparelhado no PC)",
    manual: `a sair pelo WhatsApp Web do ${formatarTelefone(estado.numeroManual ?? "351931632622")} — sem API da Meta por agora: o que o cérebro escreve fica na fila em baixo e envia-se daqui com um clique`,
    nenhum: "sem canal configurado — nada sai nem entra até haver Meta ou ponte",
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

  const agirNaFila = async (accao: "enviada" | "descartar", id: number) => {
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
              {estado.ligado ? "O WhatsApp da plataforma está ligado" : "Está DESLIGADO — ninguém recebe nada"}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {estado.ligado ? CANAL : "As mensagens novas ficam na fila à espera de o voltar a ligar."}
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
        O WHATSAPP WEB, POR ENQUANTO.

        Sem API, o número da CLYON vive no WhatsApp Web deste computador:
        daqui abre-se a conversa com o texto pronto, e o que o cliente
        responde lê-se lá e cola-se em "Chegou uma resposta". A escolha
        Web/telemóvel é de quem está sentado — no telemóvel o wa.me abre a
        aplicação; no PC o wa.me pergunta primeiro, o web.whatsapp.com não.
      */}
      {aMao && (
        <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">WhatsApp Web, por enquanto</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Abra o WhatsApp Web neste navegador com o {numeroDaClyon} emparelhado
                (no telemóvel: Definições › Dispositivos ligados). As mensagens da fila
                abrem-se lá com um clique; as respostas dos clientes lêem-se lá e
                colam-se aqui em baixo.
              </p>
            </div>
            <a
              href="https://web.whatsapp.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Abrir o WhatsApp Web
            </a>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">Enviar por:</span>
            {(
              [
                ["web", "WhatsApp Web (este computador)"],
                ["telemovel", "Telemóvel"],
              ] as const
            ).map(([v, rotulo]) => (
              <button
                key={v}
                onClick={() => escolherPorOnde(v)}
                className={`rounded-full px-3 py-1.5 font-semibold transition ${
                  porOnde === v
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "border border-slate-700 text-slate-400 hover:bg-slate-800"
                }`}
                aria-pressed={porOnde === v}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* As conversas — o fio de cada número, com resposta à mão. */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-white">Conversas</h3>
        {aMao && (
          <>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Um número sem pedido activo é atendido pelo assistente: pergunta o serviço,
              o nome, a morada, o andar, para quando — e regista o pedido na fila «por
              enviar» das Negociações. Um número com pedido fala com o cérebro das
              propostas. «Entregar a si» cala o assistente nesse número; bloqueado, não
              recebe nada.
              <br />
              Sem API, o que os clientes respondem chega ao WhatsApp Web e não a este
              ecrã sozinho. Cole-o aqui: o cérebro trata-o como se tivesse entrado pela
              API e a resposta dele fica na fila em baixo, pronta a enviar.
            </p>
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs font-semibold text-slate-300">Chegou uma resposta no WhatsApp Web</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  value={numeroRecebido}
                  onChange={(e) => setNumeroRecebido(e.target.value)}
                  placeholder="Número dele (ex.: 912 345 678)"
                  className={`${CAIXA} sm:w-56`}
                />
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
                    aRegistar || !textoRecebido.trim() || numeroRecebido.replace(/\D/g, "").length < 9
                  }
                  className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-cyan-500 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-40"
                >
                  {aRegistar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Registar"}
                </button>
              </div>
              {avisoRecebido && (
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{avisoRecebido}</p>
              )}
            </div>
          </>
        )}
        {estado.conversas.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Ainda nada por aqui. As mensagens aparecem assim que o canal estiver
            configurado e alguém escrever.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800">
            {estado.conversas.map((c) => (
              <li key={c.telefone}>
                <button
                  onClick={() => {
                    if (conversaAberta === c.telefone) {
                      setConversaAberta(null);
                    } else {
                      // Abrir a conversa deixa o número já posto em "Chegou uma resposta".
                      setNumeroRecebido(c.telefone);
                      void abrirConversa(c.telefone);
                    }
                  }}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-mono text-sm text-white">
                      {formatarTelefone(c.telefone)}
                      {(() => {
                        const r = (estado.recolhas ?? []).find(
                          (x) => x.telefone.slice(-9) === c.telefone.replace(/\D/g, "").slice(-9),
                        );
                        return r ? (
                          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-sans text-[11px] font-semibold text-violet-300">
                            assistente: {PASSO_DA_RECOLHA[r.passo] ?? r.passo}
                          </span>
                        ) : null;
                      })()}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {c.direccao === "out" ? "→ " : ""}
                      {c.ultimaMensagem}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">{desde(c.quando)}</span>
                </button>

                {conversaAberta === c.telefone && (
                  <div className="mb-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="max-h-80 space-y-2 overflow-y-auto">
                      {mensagens.map((m, i) => (
                        <div
                          key={i}
                          className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                            m.direccao === "out"
                              ? "ml-auto bg-cyan-500/15 text-cyan-100"
                              : "bg-slate-800 text-slate-200"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                          <p className="mt-1 text-right text-[10px] text-slate-500">
                            {desde(m.criadoEm)}
                          </p>
                        </div>
                      ))}
                      {mensagens.length === 0 && (
                        <p className="text-xs text-slate-500">Sem mensagens registadas.</p>
                      )}
                    </div>

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
                    {erroDaResposta && (
                      <p className="mt-2 text-xs text-red-300">{erroDaResposta}</p>
                    )}
                    {(estado.recolhas ?? []).some(
                      (x) => x.telefone.slice(-9) === c.telefone.replace(/\D/g, "").slice(-9),
                    ) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            if (window.confirm("O assistente volta a perguntar tudo desde o serviço. Continuar?")) {
                              void agir("recomecarRecolha", c.telefone);
                            }
                          }}
                          disabled={ocupado}
                          className="rounded-lg border border-violet-500/40 px-3 py-1.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/10 disabled:opacity-40"
                        >
                          Recomeçar a recolha do assistente
                        </button>
                        <button
                          onClick={() => void agir("interromper", c.telefone, "Pelo backoffice, durante a recolha")}
                          disabled={ocupado}
                          className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/10 disabled:opacity-40"
                        >
                          Calar o assistente e falar eu
                        </button>
                      </div>
                    )}
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                      {aMao
                        ? `Enviar abre o ${porOnde === "web" ? "WhatsApp Web" : "WhatsApp do telemóvel"} da CLYON com o texto pronto — carregue em enviar lá. Fica registado aqui como saída.`
                        : "Sai pelo número da plataforma, e passa por cima do interruptor e das entregas — aqui quem fala é você. O WhatsApp só recusa texto livre se ele não escrever há mais de 24 horas."}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Interromper ou bloquear um número — o mesmo formulário serve os dois. */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-white">Calar o cérebro num número</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          <strong className="text-slate-300">Entregar a si</strong> é para clientes: a conversa
          passa a ser sua e devolve-se quando quiser. <strong className="text-slate-300">Bloquear</strong>{" "}
          é para contactos pessoais e indesejados: nunca mais recebem nada, até desbloquear.
          Quando responde à mão no WhatsApp, a conversa é entregue a si sozinha.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
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
              }}
              disabled={ocupado || numeroNovo.replace(/\D/g, "").length < 9}
              className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-red-500/15 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 disabled:opacity-40"
            >
              <Ban className="h-4 w-4" aria-hidden="true" />
              Bloquear
            </button>
          </div>
        </div>
      </section>

      {/* Conversas entregues a uma pessoa */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            Conversas entregues a si{" "}
            {estado.interrompidos.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                {estado.interrompidos.length}
              </span>
            )}
          </h3>
          <button
            onClick={() => void carregar()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Actualizar
          </button>
        </div>
        {estado.interrompidos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Nenhuma. O cérebro está a tratar de todas as conversas dos pedidos activos.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800">
            {estado.interrompidos.map((i) => (
              <li key={i.telefone} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-white">{formatarTelefone(i.telefone)}</p>
                  <p className="truncate text-xs text-slate-500">
                    {i.motivo ?? "—"} · desde {desde(i.criadoEm)}
                  </p>
                </div>
                <button
                  onClick={() => agir("retomar", i.telefone)}
                  disabled={ocupado}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-40"
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Devolver ao site
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Bloqueados */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-white">
          Bloqueados{" "}
          {estado.bloqueados.length > 0 && (
            <span className="ml-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">
              {estado.bloqueados.length}
            </span>
          )}
        </h3>
        {estado.bloqueados.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Ninguém bloqueado.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800">
            {estado.bloqueados.map((b) => (
              <li key={b.telefone} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-white">{formatarTelefone(b.telefone)}</p>
                  <p className="truncate text-xs text-slate-500">
                    {b.nota ?? "—"} · desde {desde(b.criadoEm)}
                  </p>
                </div>
                <button
                  onClick={() => agir("desbloquear", b.telefone)}
                  disabled={ocupado}
                  className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
                >
                  Desbloquear
                </button>
              </li>
            ))}
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
        <section className={`rounded-2xl border p-5 ${aMao ? "border-cyan-500/30 bg-cyan-500/[0.05]" : "border-slate-800 bg-slate-900/60"}`}>
          <h3 className="text-sm font-bold text-white">
            {aMao ? (porOnde === "web" ? "Para enviar pelo WhatsApp Web" : "Para enviar do telemóvel") : "Na fila para sair"}{" "}
            {estado.fila.length > 0 && (
              <span className="ml-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                {estado.fila.length}
              </span>
            )}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {aMao
              ? `${rotuloDeAbrir} abre a conversa no ${numeroDaClyon} com o texto já escrito — carregue em enviar lá e volte aqui para a marcar como enviada. Descartar tira-a da fila sem a enviar.`
              : "O Winapp vem buscá-las de poucos em poucos segundos."}
            {!estado.ligado && " Desligado, o cérebro não escreve nada de novo."}
          </p>
          {estado.fila.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nada por enviar.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-800">
              {estado.fila.map((m) => (
                <li key={m.id} className="py-3">
                  <p className="font-mono text-xs text-slate-400">{formatarTelefone(m.telefone)}</p>
                  <p className={`mt-0.5 whitespace-pre-wrap text-sm text-slate-300 ${aMao ? "" : "truncate"}`}>
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
