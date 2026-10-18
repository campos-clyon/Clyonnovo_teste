import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ErroDaApi, pedir, quandoPerderASessao } from "../lib/api";
import { esquecerToken, guardarToken, lerToken } from "../lib/sessao";
import { desligarAvisos, ligarAvisos } from "../lib/avisos";

/**
 * A SESSÃO DO PROFISSIONAL NA APP.
 *
 * Ao abrir, a app renova o token no site (`/api/profissionais/sessao`): os
 * trinta dias passam a contar de hoje, e uma conta suspensa fica logo à porta.
 * Sem rede, fica com o token que tem — sair por falta de internet seria
 * obrigá-lo a escrever a palavra-passe no meio da rua.
 */

type Sessao = {
  carregando: boolean;
  ligado: boolean;
  nome: string | null;
  entrar: (email: string, palavraPasse: string) => Promise<void>;
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
  const [nome, setNome] = useState<string | null>(null);

  const sair = useCallback(async () => {
    await desligarAvisos();
    await esquecerToken();
    setLigado(false);
    setNome(null);
  }, []);

  useEffect(() => {
    quandoPerderASessao(() => void sair());
    return () => quandoPerderASessao(null);
  }, [sair]);

  useEffect(() => {
    (async () => {
      try {
        if (!(await lerToken())) return;
        try {
          const r = await pedir<{ nome: string; token: string }>("/api/profissionais/sessao", { metodo: "POST" });
          await guardarToken(r.token);
          setNome(r.nome);
          setLigado(true);
          void ligarAvisos();
        } catch (e) {
          // 401 já fez sair; qualquer outra falha (rede, servidor) mantém-no dentro.
          if (!(e instanceof ErroDaApi && e.estado === 401)) setLigado(true);
        }
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const entrar = useCallback(async (email: string, palavraPasse: string) => {
    const r = await pedir<{ nome: string; token: string }>("/api/profissionais/entrar", {
      metodo: "POST",
      corpo: { email: email.trim(), palavraPasse, paraApp: true },
      semSessao: true,
    });
    await guardarToken(r.token);
    setNome(r.nome);
    setLigado(true);
    void ligarAvisos();
  }, []);

  const valor = useMemo(() => ({ carregando, ligado, nome, entrar, sair }), [carregando, ligado, nome, entrar, sair]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
