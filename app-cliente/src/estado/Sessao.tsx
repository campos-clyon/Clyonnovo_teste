import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { pedir, quandoPerderASessao, SESSAO_TERMINOU } from "../lib/api";
import { registarSeJaAutorizado, tirarTelemovelDaConta } from "../lib/avisos";
import { esquecerCodigoDoAparelho } from "../lib/codigo-do-aparelho";
import type { SessaoNova } from "../lib/entrada";
import { apagarTudoDaConta } from "../lib/guardado";
import {
  esquecerSessao,
  guardarEmail,
  guardarEntrada,
  guardarToken,
  lerEmail,
  lerEntrada,
  lerToken,
} from "../lib/sessao";

/**
 * A SESSÃO DO CLIENTE NA APP — d8 (27-10-2026), versão 2 (28-10-2026).
 *
 * Ao abrir, a app renova o token no site (`POST /api/cliente/sessao`, R2): os
 * trinta dias passam a contar de hoje e o site regista a abertura com a
 * versão. Sem rede, fica com o token que tem. Um 401 — aqui ou em qualquer
 * outra chamada — apaga o token e volta ao Entrar com «A sua sessão terminou.
 * Entre outra vez.».
 *
 * TROCAR DE CONTA (E1a): só depois de o site dar a sessão nova. Primeiro sai
 * da antiga — tira o telemóvel dela no site (R6, com o token antigo), apaga o
 * token, a lista guardada e o rascunho — e só depois guarda a nova.
 *
 * SAIR: o mesmo, e o código do aparelho deita-se fora (o seguinte nasce no
 * próximo pedido de link).
 */

export type AvisoDaEntrada = { texto: string; tom: "bom" | "mau" | "aviso" };

type Sessao = {
  carregando: boolean;
  ligado: boolean;
  email: string | null;
  entrada: "link" | "google" | null;
  /** O aviso a mostrar no Entrar (a sessão que terminou, o «Não sou eu»). */
  aviso: AvisoDaEntrada | null;
  mostrarAviso: (aviso: AvisoDaEntrada | null) => void;
  /** Fica dentro com a sessão que o site deu (R1). Se já havia outra conta, sai dela primeiro. */
  entrarComSessaoNova: (s: SessaoNova) => Promise<void>;
  sair: () => Promise<void>;
};

const Contexto = createContext<Sessao | null>(null);

export function useSessao(): Sessao {
  const s = useContext(Contexto);
  if (!s) throw new Error("useSessao fora do SessaoProvider");
  return s;
}

/** Tira tudo da conta deste telemóvel. `noSite`: também tira o telemóvel dos avisos dela (com o token dela). */
async function largarAConta(noSite: boolean): Promise<void> {
  if (noSite) await tirarTelemovelDaConta(await lerToken());
  await esquecerSessao();
  apagarTudoDaConta();
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [ligado, setLigado] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [entrada, setEntrada] = useState<"link" | "google" | null>(null);
  const [aviso, setAviso] = useState<AvisoDaEntrada | null>(null);

  const ficarFora = useCallback(() => {
    setLigado(false);
    setEmail(null);
    setEntrada(null);
  }, []);

  const sair = useCallback(async () => {
    await largarAConta(true);
    await esquecerCodigoDoAparelho();
    ficarFora();
  }, [ficarFora]);

  useEffect(() => {
    quandoPerderASessao(() => {
      setAviso({ texto: SESSAO_TERMINOU, tom: "mau" });
      void largarAConta(false).then(ficarFora);
    });
    return () => quandoPerderASessao(null);
  }, [ficarFora]);

  useEffect(() => {
    (async () => {
      try {
        if (!(await lerToken())) return;
        setEmail(await lerEmail());
        const e = await lerEntrada();
        setEntrada(e === "google" ? "google" : e === "link" ? "link" : null);
        // Com token, abre logo dentro: a renovação corre por trás (com rede
        // lenta eram até 20 s de ecrã vazio à espera dela). Um 401 faz sair.
        setLigado(true);
        setCarregando(false);
        try {
          const r = await pedir<{ token: string }>("/api/cliente/sessao", { metodo: "POST" });
          await guardarToken(r.token);
          void registarSeJaAutorizado();
        } catch {
          // O 401 já fez sair (quandoPerderASessao); sem rede ou com o site em baixo, fica dentro.
        }
      } catch {
        /* o cofre não respondeu: abre sem sessão */
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const entrarComSessaoNova = useCallback(async (s: SessaoNova) => {
    const antiga = await lerToken();
    const emailAntigo = (await lerEmail())?.trim().toLowerCase() ?? null;
    if (antiga && emailAntigo !== s.email) await largarAConta(true);
    await guardarToken(s.token);
    await guardarEmail(s.email);
    await guardarEntrada(s.entrada);
    await esquecerCodigoDoAparelho();
    setEmail(s.email);
    setEntrada(s.entrada);
    setAviso(null);
    setLigado(true);
    void registarSeJaAutorizado();
  }, []);

  const valor = useMemo(
    () => ({ carregando, ligado, email, entrada, aviso, mostrarAviso: setAviso, entrarComSessaoNova, sair }),
    [carregando, ligado, email, entrada, aviso, entrarComSessaoNova, sair],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
