import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { mensagemDe, pedir } from "../lib/api";
import { catalogoValido, ROTA_DO_CATALOGO, type Catalogo } from "../lib/novo-pedido";

/**
 * O CATÁLOGO DA APP (R7, `GET /api/cliente/catalogo`) — os serviços activos no
 * simulador, as opções do entulho e das casas, as etiquetas do valor e a frase
 * única da CLYON. Lê-se uma vez ao abrir; sem ele, o E3 não pede (a app não tem
 * lista própria) e o E0 mostra-se sem a frase única.
 */

type Estado = { catalogo: Catalogo | null; erro: string | null; aLer: boolean; recarregar: () => void };

const Contexto = createContext<Estado | null>(null);

export function useCatalogo(): Estado {
  const c = useContext(Contexto);
  if (!c) throw new Error("useCatalogo fora do CatalogoProvider");
  return c;
}

export function CatalogoProvider({ children }: { children: ReactNode }) {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aLer, setALer] = useState(true);

  const recarregar = useCallback(() => {
    setALer(true);
    pedir<unknown>(ROTA_DO_CATALOGO, { semSessao: true })
      .then((r) => {
        const c = catalogoValido(r);
        setCatalogo(c);
        setErro(c ? null : "Não foi possível ler os serviços. Tente outra vez daqui a pouco.");
      })
      .catch((e) => setErro(mensagemDe(e, "Não foi possível ler os serviços. Tente outra vez daqui a pouco.")))
      .finally(() => setALer(false));
  }, []);

  useEffect(() => recarregar(), [recarregar]);

  const valor = useMemo(() => ({ catalogo, erro, aLer, recarregar }), [catalogo, erro, aLer, recarregar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
