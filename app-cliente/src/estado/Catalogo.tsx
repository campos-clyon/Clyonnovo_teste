import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { mensagemDe, pedir } from "../lib/api";
import { guardarCatalogo, lerCatalogoGuardado } from "../lib/guardado";
import { catalogoValido, ROTA_DO_CATALOGO, type Catalogo } from "../lib/novo-pedido";

/**
 * O CATÁLOGO DA APP (R7, `GET /api/cliente/catalogo`) — os serviços do
 * simulador com o que incluem e o preço de referência, a grelha de preços,
 * como funciona, as zonas, as avaliações do Google, as perguntas e os textos
 * (v3, 29-10-2026). Lê-se uma vez por abertura e fica guardado no telemóvel:
 * sem rede, o Início abre com o que tinha. Sem catálogo nenhum, o E3 não pede
 * (a app não tem lista própria).
 */

type Estado = { catalogo: Catalogo | null; erro: string | null; aLer: boolean; recarregar: () => void };

const Contexto = createContext<Estado | null>(null);

export function useCatalogo(): Estado {
  const c = useContext(Contexto);
  if (!c) throw new Error("useCatalogo fora do CatalogoProvider");
  return c;
}

const NAO_LEU = "Não foi possível ler os serviços. Tente outra vez daqui a pouco.";

export function CatalogoProvider({ children }: { children: ReactNode }) {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aLer, setALer] = useState(true);

  const recarregar = useCallback(() => {
    setALer(true);
    pedir<unknown>(ROTA_DO_CATALOGO, { semSessao: true })
      .then((r) => {
        const c = catalogoValido(r);
        if (c) {
          setCatalogo(c);
          setErro(null);
          guardarCatalogo(r);
        } else setErro(NAO_LEU);
      })
      .catch(async (e) => {
        const guardado = catalogoValido(await lerCatalogoGuardado());
        if (guardado) setCatalogo((antes) => antes ?? guardado);
        else setErro(mensagemDe(e, NAO_LEU));
      })
      .finally(() => setALer(false));
  }, []);

  useEffect(() => {
    // O guardado primeiro, para o Início abrir logo; depois o da rede por cima.
    void lerCatalogoGuardado().then((g) => {
      const c = catalogoValido(g);
      if (c) setCatalogo((antes) => antes ?? c);
    });
    recarregar();
  }, [recarregar]);

  const valor = useMemo(() => ({ catalogo, erro, aLer, recarregar }), [catalogo, erro, aLer, recarregar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
