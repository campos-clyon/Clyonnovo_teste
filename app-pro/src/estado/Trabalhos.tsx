import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { ErroDaApi, pedir } from "../lib/api";
import type { MeusPedidos, Trabalho } from "../lib/trabalhos";

/**
 * A LISTA DE TRABALHOS, UMA PARA A APP INTEIRA.
 *
 * Vem de `GET /api/profissionais/meus-pedidos`, a mesma rota do painel. Volta
 * a ler quando a app regressa ao ecrã, quando ele puxa a lista para baixo, a
 * cada minuto com a app aberta, e depois de cada resposta a um trabalho.
 */

type Estado = {
  trabalhos: Trabalho[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  porId: (id: number) => Trabalho | undefined;
  porPedidoId: (pedidoId: number) => Trabalho | undefined;
  /** Ele abriu o trabalho: deixa de contar como novo já, sem esperar pela próxima leitura. */
  marcarAberto: (negociacaoId: number) => void;
};

const Contexto = createContext<Estado | null>(null);

export function useTrabalhos(): Estado {
  const s = useContext(Contexto);
  if (!s) throw new Error("useTrabalhos fora do TrabalhosProvider");
  return s;
}

const DE_MINUTO_A_MINUTO = 60_000;

/** `activo` é a sessão: sem ela não se lê nada, e ao sair a lista esvazia-se. */
export function TrabalhosProvider({ children, activo }: { children: ReactNode; activo: boolean }) {
  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const aLer = useRef(false);

  const recarregar = useCallback(async () => {
    if (aLer.current) return;
    aLer.current = true;
    try {
      const r = await pedir<MeusPedidos>("/api/profissionais/meus-pedidos");
      setTrabalhos(r.pedidos ?? []);
      setErro(null);
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível ler os trabalhos.");
    } finally {
      aLer.current = false;
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!activo) {
      setTrabalhos([]);
      setCarregando(true);
      return;
    }
    void recarregar();
    const relogio = setInterval(() => {
      if (AppState.currentState === "active") void recarregar();
    }, DE_MINUTO_A_MINUTO);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void recarregar();
    });
    return () => {
      clearInterval(relogio);
      sub.remove();
    };
  }, [recarregar, activo]);

  const valor = useMemo<Estado>(
    () => ({
      trabalhos,
      carregando,
      erro,
      recarregar,
      porId: (id) => trabalhos.find((t) => t.negociacaoId === id),
      porPedidoId: (pedidoId) => trabalhos.find((t) => t.pedidoId === pedidoId),
      marcarAberto: (id) =>
        setTrabalhos((lista) =>
          lista.map((t) => (t.negociacaoId === id && !t.abertoEm ? { ...t, abertoEm: new Date().toISOString() } : t)),
        ),
    }),
    [trabalhos, carregando, erro, recarregar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
