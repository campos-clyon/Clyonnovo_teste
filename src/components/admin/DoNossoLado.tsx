"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";

import AvisosDaEquipa from "@/components/admin/AvisosDaEquipa";
import { ProcuraGlobalContext } from "@/components/admin/NoutrosSitios";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { BOTAO_ABERTO, BOTAO_DA_LINHA, BOTAO_NEUTRO, BOTAO_URGENTE, PAINEL_DA_LINHA } from "@/components/admin/linhaDaMesa";
import {
  doNossoLado,
  haQuantoEspera,
  type ConversaParaOLado,
  type LinhaDoNossoLado,
  type PedidoParaOLado,
  type SemPropostasParaOLado,
  type TipoDoNossoLado,
  type TrabalhoClyonParaOLado,
} from "@/lib/do-nosso-lado";
import { telefoneLegivel } from "@/lib/telefone-legivel";
import type { TrabalhoParaOFecho } from "@/lib/fecho-do-modelo-novo";
import type { PedidoEmSeguimento } from "@/lib/seguimento-do-cliente";
import type { MudancaSemValorParaOLado } from "@/lib/mudanca-a-hora-sem-valor";

/**
 * «DO NOSSO LADO» — o cartão do topo da Mesa (d14, 03-11-2026); desde a d142
 * (27-11-2026), botões pequenos na linha discreta da Mesa. Só leitura:
 * diz o que espera pela CLYON, com o n.º do pedido e há quanto tempo, e cada
 * linha abre o pedido (ou a conversa, quando ainda não há pedido). As regras
 * estão em `do-nosso-lado.ts`.
 *
 * As conversas vêm da mesa do WhatsApp (`/api/admin/whatsapp?so=mesa`), de 2
 * em 2 minutos e com o separador à vista; o resto é o que a Mesa já carregou.
 * Uma conta sem a secção WhatsApp não vê o grupo das conversas.
 */

/** As conversas lêem-se de 2 em 2 minutos: a mesa delas é a leitura mais pesada. */
const CONVERSAS_DE_MS = 120_000;
/** Quantas linhas de cada grupo se vêem antes do «Ver mais». */
const LINHAS_A_VISTA = 5;

/**
 * O rótulo do botão na linha da Mesa (d142): curto, depois do número. O título
 * inteiro (`TITULOS_DO_NOSSO_LADO`) fica no `title` e à cabeça do painel.
 */
const ROTULO_CURTO: Record<TipoDoNossoLado, string> = {
  conversa: "conversas >2 h",
  preco_clyon: "preços CLYON por enviar",
  propostas: "propostas por enviar",
  data_passada: "com a data passada",
  sem_resposta: "escolhidos sem resposta",
  sem_fecho: "sem «Está feito» >24 h",
  sem_propostas: "sem propostas",
  mudanca_sem_valor: "mudanças sem valor >3 h",
};

export default function DoNossoLado({
  token,
  pedidos,
  trabalhosClyon,
  emSeguimento,
  onAbrirPedido,
}: {
  token: string | null;
  pedidos: PedidoParaOLado[];
  trabalhosClyon: TrabalhoClyonParaOLado[];
  /** Os pedidos com o seguimento do cliente a correr (d83 v2): a espera é dele, não contam aqui. */
  emSeguimento?: readonly PedidoEmSeguimento[] | null;
  /** Abre o pedido na Mesa (procura-o pelo número). */
  onAbrirPedido: (pedidoId: number) => void;
}) {
  const global = useContext(ProcuraGlobalContext);
  const podeVerConversas = global ? global.podeVer("whatsapp") : true;
  const [conversas, setConversas] = useState<ConversaParaOLado[] | null>(null);
  const [conversasFalharam, setConversasFalharam] = useState(false);
  const [verTudo, setVerTudo] = useState<Set<string>>(new Set());
  /*
   * CADA GRUPO ABRE-SE POR OPÇÃO — 18-11-2026 («mesa-so-pedidos-vivos»), e
   * desde a d142 (27-11-2026, dono) nasce SEMPRE fechado: o que ficava lembrado
   * aberto enchia o ecrã e empurrava a mesa para baixo. Um grupo a zero não aparece.
   */
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const estaAberto = (tipo: string) => abertos.has(tipo);
  const alternar = (tipo: string) =>
    setAbertos((s) => {
      const n = new Set(s);
      if (n.has(tipo)) n.delete(tipo);
      else n.add(tipo);
      return n;
    });
  const lidasEm = useRef(0);
  const [agora, setAgora] = useState(() => new Date());
  /*
   * O FECHO DO MODELO NOVO (d15, 13-11-2026): os contratados do modelo de 15-11
   * com a data passada há mais de 24 h e sem «Está feito» — todos, lidos à parte
   * (a Mesa só carrega 60 pedidos). De 2 em 2 minutos, como as conversas.
   */
  const [semFecho, setSemFecho] = useState<TrabalhoParaOFecho[] | null>(null);
  const semFechoLidoEm = useRef(0);
  const lerSemFecho = useCallback(
    async (forcar = false) => {
      if (!token) return;
      if (!forcar && Date.now() - semFechoLidoEm.current < CONVERSAS_DE_MS) return;
      semFechoLidoEm.current = Date.now();
      try {
        const r = await fetch("/api/admin/negociacoes/sem-fecho", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!r.ok) return;
        const d = await r.json();
        setSemFecho(Array.isArray(d?.trabalhos) ? (d.trabalhos as TrabalhoParaOFecho[]) : []);
      } catch {
        /* fica o que já se tinha lido */
      }
    },
    [token],
  );
  useEffect(() => {
    void lerSemFecho(true);
  }, [lerSemFecho]);

  /* d102 (a): os pedidos sem propostas (ou sem parceiros na zona) — lidos à parte, de 2 em 2 minutos. */
  const [semPropostas, setSemPropostas] = useState<SemPropostasParaOLado[] | null>(null);
  const semPropostasLidoEm = useRef(0);
  const lerSemPropostas = useCallback(
    async (forcar = false) => {
      if (!token) return;
      if (!forcar && Date.now() - semPropostasLidoEm.current < CONVERSAS_DE_MS) return;
      semPropostasLidoEm.current = Date.now();
      try {
        const r = await fetch("/api/admin/negociacoes/sem-propostas", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!r.ok) return;
        const d = await r.json();
        setSemPropostas(Array.isArray(d?.pedidos) ? (d.pedidos as SemPropostasParaOLado[]) : []);
      } catch {
        /* fica o que já se tinha lido */
      }
    },
    [token],
  );
  useEffect(() => {
    void lerSemPropostas(true);
  }, [lerSemPropostas]);

  /* d14: as mudanças à hora sem o valor enviado há 3 h ou mais — lidas à parte, de 2 em 2 minutos. */
  const [mudancasSemValor, setMudancasSemValor] = useState<MudancaSemValorParaOLado[] | null>(null);
  const mudancasSemValorLidoEm = useRef(0);
  const lerMudancasSemValor = useCallback(
    async (forcar = false) => {
      if (!token) return;
      if (!forcar && Date.now() - mudancasSemValorLidoEm.current < CONVERSAS_DE_MS) return;
      mudancasSemValorLidoEm.current = Date.now();
      try {
        const r = await fetch("/api/admin/negociacoes/mudanca-sem-valor", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!r.ok) return;
        const d = await r.json();
        setMudancasSemValor(Array.isArray(d?.pedidos) ? (d.pedidos as MudancaSemValorParaOLado[]) : []);
      } catch {
        /* fica o que já se tinha lido */
      }
    },
    [token],
  );
  useEffect(() => {
    void lerMudancasSemValor(true);
  }, [lerMudancasSemValor]);

  const lerConversas = useCallback(
    async (forcar = false) => {
      if (!token || !podeVerConversas) return;
      if (!forcar && Date.now() - lidasEm.current < CONVERSAS_DE_MS) return;
      lidasEm.current = Date.now();
      try {
        const r = await fetch("/api/admin/whatsapp?so=mesa", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!r.ok) {
          setConversasFalharam(true);
          return;
        }
        const d = await r.json();
        setConversas(Array.isArray(d?.mesa) ? (d.mesa as ConversaParaOLado[]) : []);
        setConversasFalharam(false);
      } catch {
        setConversasFalharam(true);
      }
    },
    [token, podeVerConversas],
  );

  useEffect(() => {
    void lerConversas(true);
  }, [lerConversas]);
  // O relógio anda com a Mesa (a batida de 20 s); as conversas, de 2 em 2 min.
  useAutoRefresh(() => {
    setAgora(new Date());
    void lerSemFecho();
    void lerSemPropostas();
    void lerMudancasSemValor();
    return lerConversas();
  });

  const grupos = doNossoLado({ conversas: podeVerConversas ? conversas : null, pedidos, trabalhosClyon, semFecho, emSeguimento, semPropostas, mudancasSemValor, agora });
  const visiveis = grupos.filter((g) => g.linhas.length > 0 || (g.tipo === "conversa" && podeVerConversas && conversasFalharam));

  const abrir = (l: LinhaDoNossoLado) => {
    if (l.pedidoId != null) onAbrirPedido(l.pedidoId);
    else if (l.telefone && global) global.ir("whatsapp", l.telefone);
  };

  /*
   * d142 (27-11-2026, dono): um FRAGMENTO para a linha discreta do topo da Mesa
   * (`linhaDaMesa.ts`). Cada grupo é um botão pequeno com o número e um rótulo
   * curto (o título inteiro no `title` e no painel); ao carregar, as linhas
   * abrem por baixo da linha, iguais às de antes. Um grupo a zero não aparece.
   */
  const abertosAgora = visiveis.filter((g) => estaAberto(g.tipo));
  return (
    <>
      {visiveis.length === 0 ? (
        <span className="text-[11px] text-slate-500" title="Do nosso lado: o que está à espera de nós.">
          Nada à espera de nós
        </span>
      ) : null}
      {visiveis.length === 0 ? (
        <AvisosDaEquipa token={token} />
      ) : (
        visiveis.map((g) => {
          const grupoAberto = estaAberto(g.tipo);
          const falhou = g.tipo === "conversa" && conversasFalharam && g.linhas.length === 0;
          return (
            <button
              key={g.tipo}
              type="button"
              onClick={() => alternar(g.tipo)}
              aria-expanded={grupoAberto}
              title={`Do nosso lado · ${g.titulo} · ${g.linhas.length}`}
              className={`${BOTAO_DA_LINHA} ${grupoAberto ? BOTAO_ABERTO : falhou ? BOTAO_URGENTE : BOTAO_NEUTRO}`}
            >
              {falhou ? (
                "conversas por ler"
              ) : (
                <>
                  <span className="font-bold tabular-nums text-ciano-texto">{g.linhas.length}</span>
                  {ROTULO_CURTO[g.tipo]}
                </>
              )}
            </button>
          );
        })
      )}
      {abertosAgora.map((g, i) => {
        const tudo = verTudo.has(g.tipo);
        const linhas = tudo ? g.linhas : g.linhas.slice(0, LINHAS_A_VISTA);
        return (
          <section key={g.tipo} aria-label="Do nosso lado" className={PAINEL_DA_LINHA}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[13px] font-semibold text-slate-100">
                {g.titulo}{" "}
                <span className={g.linhas.length > 0 ? "text-ciano-texto" : "text-slate-500"}>· {g.linhas.length}</span>
              </h3>
              <button
                type="button"
                onClick={() => alternar(g.tipo)}
                className="shrink-0 text-[11px] text-slate-500 hover:underline"
              >
                Fechar
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Do nosso lado: o que está à espera de nós. Carregue numa linha para abrir o pedido.
            </p>
            {/* Os avisos no telemóvel do que fica parado aqui (d23): uma vez, no primeiro painel aberto. */}
            {i === 0 && <AvisosDaEquipa token={token} />}
            {g.tipo === "conversa" && conversasFalharam && (
              <p className="text-[11px] text-amber-300">As conversas não se leram agora; volta a tentar daqui a 2 minutos.</p>
            )}
            <ul className="mt-0.5 divide-y divide-slate-800">
              {linhas.map((l) => (
                <li key={`${l.tipo}-${l.pedidoId ?? l.telefone}`}>
                  <button
                    type="button"
                    onClick={() => abrir(l)}
                    disabled={l.pedidoId == null && !global}
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-3 py-1 text-left text-xs transition hover:bg-slate-900"
                  >
                    <span className="font-semibold text-cyan-300">
                      {l.pedidoId != null ? `#${l.pedidoId}` : telefoneLegivel(l.telefone) || "—"}
                    </span>
                    <span className="truncate text-slate-300">{l.oQue}</span>
                    <span className="whitespace-nowrap text-slate-400">{haQuantoEspera(l.esperaS)}</span>
                  </button>
                  {l.modelo && (
                    <div className="pb-1.5 pl-1 text-[11px] text-slate-400">
                      <p className="whitespace-pre-wrap">{l.modelo}</p>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard?.writeText(l.modelo ?? "").catch(() => {})}
                        className="mt-0.5 font-semibold text-cyan-400 hover:underline"
                      >
                        Copiar o texto
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {g.linhas.length > LINHAS_A_VISTA && (
              <button
                type="button"
                onClick={() =>
                  setVerTudo((s) => {
                    const n = new Set(s);
                    if (n.has(g.tipo)) n.delete(g.tipo);
                    else n.add(g.tipo);
                    return n;
                  })
                }
                className="mt-0.5 text-[11px] font-semibold text-cyan-400 hover:underline"
              >
                {tudo ? "Ver menos" : `Ver mais ${g.linhas.length - LINHAS_A_VISTA}`}
              </button>
            )}
          </section>
        );
      })}
    </>
  );
}
