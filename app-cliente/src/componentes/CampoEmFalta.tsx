import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { View } from "react-native";
import { Text } from "./Texto";
import { CORES } from "../tema";

/**
 * O CAMPO EM FALTA (30-10-2026): ao tocar em Continuar/Enviar com um campo
 * obrigatório vazio, o ecrã desce até ao primeiro, que fica a vermelho com uma
 * frase curta por baixo, e o foco vai para ele. O vermelho sai quando o campo
 * fica bem preenchido (quem decide é `camposEmFalta`, em lib/novo-pedido.ts).
 */
export type LugarDoCampo = { vista: RefObject<View | null>; focar?: () => void };

type Contexto = {
  erroDe: (campo: string) => string | null;
  registar: (campo: string, lugar: LugarDoCampo) => () => void;
};

const ContextoDoCampoEmFalta = createContext<Contexto | null>(null);
export const FornecedorDoCampoEmFalta = ContextoDoCampoEmFalta.Provider;

/** O erro deste campo (ou null) e a vista onde ele está, para o ecrã descer até lá. */
export function useCampoEmFalta(campo: string | undefined, focar?: () => void) {
  const ctx = useContext(ContextoDoCampoEmFalta);
  const vista = useRef<View>(null);
  const focarRef = useRef(focar);
  focarRef.current = focar;
  useEffect(() => {
    if (!ctx || !campo) return;
    return ctx.registar(campo, { vista, focar: () => focarRef.current?.() });
  }, [ctx, campo]);
  return { erro: ctx && campo ? ctx.erroDe(campo) : null, vista };
}

/** Uma caixa à volta do que não é um campo de texto (as escolhas, as moradas, as fotografias). */
export function Marcado({ campo, children }: { campo: string; children: ReactNode }) {
  const { erro, vista } = useCampoEmFalta(campo);
  return (
    <View
      ref={vista}
      collapsable={false}
      style={erro ? { borderWidth: 1.5, borderColor: CORES.mau, borderRadius: 16, padding: 10, gap: 8 } : undefined}
    >
      {children}
      {erro ? (
        <Text accessibilityLiveRegion="polite" style={{ color: CORES.mau, fontSize: 13, fontWeight: "600" }}>
          {erro}
        </Text>
      ) : null}
    </View>
  );
}
