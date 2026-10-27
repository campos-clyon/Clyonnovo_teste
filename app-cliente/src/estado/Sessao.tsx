import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ErroDaApi, pedir, quandoPerderASessao, SESSAO_TERMINOU } from "../lib/api";
import { esquecerSessao, guardarEmail, guardarToken, lerEmail, lerToken } from "../lib/sessao";

/**
 * A SESSÃO DO CLIENTE NA APP — decisão d8 (27-10-2026).
 *
 * Ao abrir, a app renova o token no site (`POST /api/cliente/sessao`, R2): os
 * trinta dias passam a contar de hoje e o site regista a abertura com a
 * versão. Sem rede, fica com o token que tem. Um 401 — aqui ou em qualquer
 * outra chamada — apaga o token e volta ao Entrar com «A sua sessão terminou.
 * Entre outra vez.».
 */

type Sessao = {
  carregando: boolean;
  ligado: boolean;
  email: string | null;
  /** O aviso a mostrar no Entrar (a sessão que terminou). */
  aviso: string | null;
  /** Fica dentro com o token que o site deu (`POST /api/cliente/entrar`). */
  entrarComToken: (token: string, email: string) => Promise<void>;
  sair: () => Promise<void>;
};

const Contexto = createContext<Sessao | null>(null);

export function useSessao(): Sessao {
  const s = useContext(Contexto);
  if (!s) throw new Error("useSessao fora do SessaoProvider");
  return s;
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [ligado, setLigado] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const sair = useCallback(async () => {
    await esquecerSessao();
    setLigado(false);
    setEmail(null);
  }, []);

  useEffect(() => {
    quandoPerderASessao(() => {
      setAviso(SESSAO_TERMINOU);
      void sair();
    });
    return () => quandoPerderASessao(null);
  }, [sair]);

  useEffect(() => {
    (async () => {
      try {
        if (!(await lerToken())) return;
        setEmail(await lerEmail());
        try {
          const r = await pedir<{ token: string }>("/api/cliente/sessao", { metodo: "POST" });
          await guardarToken(r.token);
          setLigado(true);
        } catch (e) {
          // O 401 já fez sair; sem rede ou com o site em baixo, fica dentro.
          if (!(e instanceof ErroDaApi && e.estado === 401)) setLigado(true);
        }
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const entrarComToken = useCallback(async (token: string, emailDele: string) => {
    await guardarToken(token);
    await guardarEmail(emailDele);
    setEmail(emailDele);
    setAviso(null);
    setLigado(true);
  }, []);

  const valor = useMemo(
    () => ({ carregando, ligado, email, aviso, entrarComToken, sair }),
    [carregando, ligado, email, aviso, entrarComToken, sair],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
