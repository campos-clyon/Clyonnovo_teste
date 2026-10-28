import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { ErroDaApi, mensagemDe, pedir } from "../lib/api";
import { guardarLista, lerListaGuardada } from "../lib/guardado";
import { juntarPaginas, ROTA_DOS_PEDIDOS, type PedidoNaLista, type RespostaDaLista } from "../lib/pedidos";

/**
 * OS PEDIDOS DO CLIENTE (R4) — a lista do E2 e o número do separador.
 *
 * A ordem é a da API (com novidade em cima, depois a última actividade, os
 * fechados no fim): a app junta as páginas e não reordena. Sem rede, mostra a
 * última lista guardada no telemóvel, e di-lo.
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

  const valor = useMemo(
    () => ({ pedidos, aLer, erro, guardadaEm, haMais: pagina < paginas, recarregar, maisUma }),
    [pedidos, aLer, erro, guardadaEm, pagina, paginas, recarregar, maisUma],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
