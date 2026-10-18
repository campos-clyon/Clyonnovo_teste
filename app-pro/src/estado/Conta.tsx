import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ErroDaApi, pedir } from "../lib/api";
import type { Perfil, RespostaDaCarteira } from "../lib/conta";

/**
 * O PERFIL E A CARTEIRA, UMA VEZ PARA A APP INTEIRA — fase 4.
 *
 * O menu da Conta mostra o raio, o IBAN e o que falta; a Carteira mostra o
 * saldo; os ecrãs de edição gravam e voltam a ler. Lê-se ao entrar e sempre
 * que um ecrã que precisa abre (`recarregar…` no foco) — o mesmo que o painel
 * faz com o seu ciclo de leitura.
 */

type Estado = {
  perfil: Perfil | null;
  carteira: RespostaDaCarteira | null;
  erroDoPerfil: string | null;
  erroDaCarteira: string | null;
  recarregarPerfil: () => Promise<void>;
  recarregarCarteira: () => Promise<void>;
};

const Contexto = createContext<Estado | null>(null);

export function useConta(): Estado {
  const s = useContext(Contexto);
  if (!s) throw new Error("useConta fora do ContaProvider");
  return s;
}

export function ContaProvider({ children, activo }: { children: ReactNode; activo: boolean }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carteira, setCarteira] = useState<RespostaDaCarteira | null>(null);
  const [erroDoPerfil, setErroDoPerfil] = useState<string | null>(null);
  const [erroDaCarteira, setErroDaCarteira] = useState<string | null>(null);
  const aLer = useRef({ perfil: false, carteira: false });

  const recarregarPerfil = useCallback(async () => {
    if (aLer.current.perfil) return;
    aLer.current.perfil = true;
    try {
      const r = await pedir<{ perfil: Perfil }>("/api/profissionais/perfil");
      setPerfil(r.perfil);
      setErroDoPerfil(null);
    } catch (e) {
      setErroDoPerfil(e instanceof ErroDaApi ? e.message : "Não foi possível ler o perfil.");
    } finally {
      aLer.current.perfil = false;
    }
  }, []);

  const recarregarCarteira = useCallback(async () => {
    if (aLer.current.carteira) return;
    aLer.current.carteira = true;
    try {
      setCarteira(await pedir<RespostaDaCarteira>("/api/profissionais/carteira"));
      setErroDaCarteira(null);
    } catch (e) {
      setErroDaCarteira(e instanceof ErroDaApi ? e.message : "Não foi possível ler a carteira.");
    } finally {
      aLer.current.carteira = false;
    }
  }, []);

  useEffect(() => {
    if (!activo) {
      setPerfil(null);
      setCarteira(null);
      return;
    }
    void recarregarPerfil();
    void recarregarCarteira();
  }, [activo, recarregarPerfil, recarregarCarteira]);

  const valor = useMemo<Estado>(
    () => ({ perfil, carteira, erroDoPerfil, erroDaCarteira, recarregarPerfil, recarregarCarteira }),
    [perfil, carteira, erroDoPerfil, erroDaCarteira, recarregarPerfil, recarregarCarteira],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
