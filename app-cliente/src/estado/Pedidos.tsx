import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { ErroDaApi, mensagemDe, pedir } from "../lib/api";
import { guardarLista, guardarVistas, lerListaGuardada, lerVistas } from "../lib/guardado";
import {
  juntarPaginas,
  marcarComoVistas,
  podarVistas,
  quantasPorVer,
  ROTA_DOS_PEDIDOS,
  type PedidoNaLista,
  type RespostaDaLista,
} from "../lib/pedidos";

/**
 * OS PEDIDOS DO CLIENTE (R4) — a lista do E2 e o número do separador.
 *
 * A ordem é a da API (com novidade em cima, depois a última actividade, os
 * fechados no fim): a app junta as páginas e não reordena. Sem rede, mostra a
 * última lista guardada no telemóvel, e di-lo.
 *
 * O NÚMERO DOS SELOS (sino, Início, Perfil) é `porVer`: as novidades que ele
 * ainda não viu (02-11-2026). Antes era `quantosComNovidade`, que contava
 * «Por pagar» enquanto o pedido estivesse por pagar, mesmo depois de aberto.
 * O que ele já viu fica no telemóvel (`guardarVistas`), por conta.
 */

type Estado = {
  pedidos: PedidoNaLista[];
  aLer: boolean;
  erro: string | null;
  /** A lista é a guardada (sem rede): a hora a que foi lida, em ISO. */
  guardadaEm: string | null;
  haMais: boolean;
  recarregar: () => Promise<void>;
  maisUma: () => Promise<void>;
  /** Quantas novidades ainda não viu — o número do sino e do separador. */
  porVer: number;
  /** Dá por vistas as novidades destes pedidos (o ecrã Notificações, ou o pedido aberto). */
  marcarVistas: (pedidos: readonly Pick<PedidoNaLista, "id" | "novidade">[]) => void;
};

const Contexto = createContext<Estado | null>(null);

export function usePedidos(): Estado {
  const c = useContext(Contexto);
  if (!c) throw new Error("usePedidos fora do PedidosProvider");
  return c;
}

export function PedidosProvider({ activo, conta, children }: { activo: boolean; conta: string | null; children: ReactNode }) {
  const [pedidos, setPedidos] = useState<PedidoNaLista[]>([]);
  const [aLer, setALer] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [guardadaEm, setGuardadaEm] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [paginas, setPaginas] = useState(1);
  const aCarregarMais = useRef(false);
  const [vistas, setVistas] = useState<ReadonlySet<string>>(new Set());
  /** De que conta são as `vistas` que estão em memória (null enquanto se lêem). */
  const [vistasDe, setVistasDe] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setALer(true);
    try {
      const r = await pedir<RespostaDaLista>(`${ROTA_DOS_PEDIDOS}?pagina=1`);
      setPedidos(r.pedidos);
      setPagina(r.pagina);
      setPaginas(r.paginas);
      setErro(null);
      setGuardadaEm(null);
      guardarLista(r.pedidos);
    } catch (e) {
      if (e instanceof ErroDaApi && e.estado === 401) return;
      const guardada = e instanceof ErroDaApi && e.estado === 0 ? await lerListaGuardada() : null;
      if (guardada) {
        setPedidos(guardada.pedidos);
        setGuardadaEm(guardada.lidaEm);
        setErro(null);
      } else {
        setErro(mensagemDe(e, "Não foi possível ler os pedidos."));
      }
    } finally {
      setALer(false);
    }
  }, []);

  const maisUma = useCallback(async () => {
    if (aCarregarMais.current || pagina >= paginas || guardadaEm) return;
    aCarregarMais.current = true;
    try {
      const r = await pedir<RespostaDaLista>(`${ROTA_DOS_PEDIDOS}?pagina=${pagina + 1}`);
      setPedidos((antes) => juntarPaginas(antes, r.pedidos));
      setPagina(r.pagina);
      setPaginas(r.paginas);
    } catch {
      /* fica com o que tem; puxar para actualizar tenta outra vez */
    } finally {
      aCarregarMais.current = false;
    }
  }, [pagina, paginas, guardadaEm]);

  useEffect(() => {
    // Sem sessão, depois de sair ou ao trocar de conta: nada da conta antiga fica no ecrã.
    setPedidos([]);
    setGuardadaEm(null);
    if (!activo) return;
    void recarregar();
    // Ao voltar à app (depois de ver o email, ou o WhatsApp), a lista actualiza-se.
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void recarregar();
    });
    return () => sub.remove();
  }, [activo, conta, recarregar]);

  // As novidades vistas desta conta, do telemóvel.
  useEffect(() => {
    setVistas(new Set());
    setVistasDe(null);
    if (!activo || !conta) return;
    let vivo = true;
    void lerVistas(conta).then((v) => {
      if (!vivo) return;
      // Junta as que se viram enquanto o ficheiro se lia (já são desta conta: a troca limpa-as).
      setVistas((antes) => new Set([...v, ...antes]));
      setVistasDe(conta);
    });
    return () => {
      vivo = false;
    };
  }, [activo, conta]);
  // Só com as vistas DESTA conta lidas se conta, poda ou grava (ao trocar de conta, nunca as da outra).
  const vistasLidas = activo && !!conta && vistasDe === conta;

  // Com a lista nova do site, esquece as vistas que já não são a novidade do pedido.
  useEffect(() => {
    if (vistasLidas && !guardadaEm) setVistas((v) => podarVistas(v, pedidos));
  }, [pedidos, vistasLidas, guardadaEm]);

  useEffect(() => {
    if (vistasLidas && conta) guardarVistas(conta, vistas);
  }, [vistas, vistasLidas, conta]);

  const marcarVistas = useCallback((estes: readonly Pick<PedidoNaLista, "id" | "novidade">[]) => {
    setVistas((v) => marcarComoVistas(v, estes));
  }, []);

  // Até se lerem as vistas, o selo não aparece (não pisca com as que ele já viu).
  const porVer = vistasLidas ? quantasPorVer(pedidos, vistas) : 0;

  const valor = useMemo(
    () => ({ pedidos, aLer, erro, guardadaEm, haMais: pagina < paginas, recarregar, maisUma, porVer, marcarVistas }),
    [pedidos, aLer, erro, guardadaEm, pagina, paginas, recarregar, maisUma, porVer, marcarVistas],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
