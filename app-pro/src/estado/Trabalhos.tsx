import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { ErroDaApi, pedir } from "../lib/api";
import { fasesDe, juntarNovidades, novidadesEntre, type MeusPedidos, type Novidade, type Trabalho } from "../lib/trabalhos";
import { apagarListaGuardada, guardarLista, lerListaGuardada } from "../lib/lista-guardada";

/**
 * A LISTA DE TRABALHOS, UMA PARA A APP INTEIRA.
 *
 * Vem de `GET /api/profissionais/meus-pedidos`, a mesma rota do painel. Volta
 * a ler quando a app regressa ao ecrã, quando ele puxa a lista para baixo, a
 * cada minuto com a app aberta, e depois de cada resposta a um trabalho.
 *
 * Sem rede, mostra a última lista guardada no telemóvel (`lista-guardada.ts`,
 * versão 13), com a hora a que foi lida (`lidaEm`), até o site responder.
 */

type Estado = {
  trabalhos: Trabalho[];
  carregando: boolean;
  erro: string | null;
  /** A lista é a guardada no telemóvel, lida do site a esta hora (sem rede). null = está em dia. */
  lidaEm: string | null;
  recarregar: () => Promise<void>;
  porId: (id: number) => Trabalho | undefined;
  porPedidoId: (pedidoId: number) => Trabalho | undefined;
  /** Ele abriu o trabalho: deixa de contar como novo já, sem esperar pela próxima leitura. */
  marcarAberto: (negociacaoId: number) => void;
  /**
   * AS NOVIDADES DO PAINEL, DENTRO DA APP — 29-10-2026 (A16). O que mudou de
   * uma leitura do site para a seguinte, com as frases do painel; ficam até
   * ele as fechar ou sair.
   */
  novidades: Novidade[];
  fecharNovidade: (id: string) => void;
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
  const [lidaEm, setLidaEm] = useState<string | null>(null);
  const aLer = useRef(false);
  // O site já respondeu nesta sessão: a lista guardada nunca passa por cima da dele.
  const doSite = useRef(false);
  const [novidades, setNovidades] = useState<Novidade[]>([]);
  // A fase de cada negociação na última leitura do SITE (a guardada não conta:
  // na primeira leitura há passado, e o passado não é notícia).
  const fasesAnteriores = useRef<Map<number, string> | null>(null);

  const recarregar = useCallback(async () => {
    if (aLer.current) return;
    aLer.current = true;
    try {
      const r = await pedir<MeusPedidos>("/api/profissionais/meus-pedidos");
      doSite.current = true;
      const lista = r.pedidos ?? [];
      const chegadas = novidadesEntre(fasesAnteriores.current, lista);
      fasesAnteriores.current = fasesDe(lista);
      if (chegadas.length > 0) setNovidades((v) => juntarNovidades(v, chegadas));
      setTrabalhos(lista);
      setErro(null);
      setLidaEm(null);
      guardarLista(r.pedidos ?? []);
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível ler os trabalhos.");
    } finally {
      aLer.current = false;
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!activo) {
      doSite.current = false;
      fasesAnteriores.current = null;
      setNovidades([]);
      setTrabalhos([]);
      setLidaEm(null);
      setCarregando(true);
      // Sem sessão, os dados dos clientes não ficam no telemóvel.
      apagarListaGuardada();
      return;
    }
    // A lista da última vez aparece logo; o site, quando responder, substitui-a.
    let vivo = true;
    void lerListaGuardada().then((guardada) => {
      if (!vivo || !guardada || doSite.current) return;
      setTrabalhos(guardada.trabalhos);
      setLidaEm(guardada.lidaEm);
      setCarregando(false);
    });
    void recarregar();
    const relogio = setInterval(() => {
      if (AppState.currentState === "active") void recarregar();
    }, DE_MINUTO_A_MINUTO);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void recarregar();
    });
    return () => {
      vivo = false;
      clearInterval(relogio);
      sub.remove();
    };
  }, [recarregar, activo]);

  const valor = useMemo<Estado>(
    () => ({
      trabalhos,
      carregando,
      erro,
      lidaEm,
      recarregar,
      porId: (id) => trabalhos.find((t) => t.negociacaoId === id),
      porPedidoId: (pedidoId) => trabalhos.find((t) => t.pedidoId === pedidoId),
      novidades,
      fecharNovidade: (id) => setNovidades((v) => v.filter((n) => n.id !== id)),
      marcarAberto: (id) =>
        setTrabalhos((lista) =>
          lista.map((t) => (t.negociacaoId === id && !t.abertoEm ? { ...t, abertoEm: new Date().toISOString() } : t)),
        ),
    }),
    [trabalhos, carregando, erro, lidaEm, recarregar, novidades],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
