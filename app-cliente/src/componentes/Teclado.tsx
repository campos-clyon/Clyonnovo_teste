import { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { Dimensions, Keyboard, Platform, ScrollView, StyleSheet, type KeyboardEvent, type ScrollViewProps } from "react-native";

/**
 * O TECLADO NÃO TAPA O QUE SE ESCREVE (30-10-2026).
 *
 * A app é edge-to-edge: o Android não encolhe a janela quando o teclado abre,
 * e o KeyboardAvoidingView «undefined» do Android não fazia nada — o campo
 * ficava por baixo do teclado. Por isso:
 * - `useAlturaDoTeclado()` lê a altura do teclado pelos eventos do sistema;
 * - `RolagemComTeclado` (no lugar de todo o ScrollView vertical da app) soma
 *   essa altura ao fundo do conteúdo, para se poder rolar até ao último campo;
 * - o `TextInput` de Texto.tsx, ao ganhar o foco, pede à rolagem onde está
 *   (`useLevarAoTeclado`) e ela sobe-o para cima do teclado.
 * As folhas (Folha) sobem inteiras com o teclado; a barra de baixo esconde-se.
 * Um teste (app-cliente-teclado.test.ts) chumba um ScrollView vertical novo.
 */

const MOSTRAR = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
const ESCONDER = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
const FOLGA = 24;

let ultimoTopoDoTeclado: number | null = null;

function topoDoTeclado(e: KeyboardEvent): number {
  const janela = Dimensions.get("window").height;
  const pelaAltura = janela - e.endCoordinates.height;
  const peloY = e.endCoordinates.screenY > 0 ? e.endCoordinates.screenY : pelaAltura;
  return Math.min(pelaAltura, peloY);
}

export function useAlturaDoTeclado(): number {
  const [altura, setAltura] = useState(0);
  useEffect(() => {
    const a = Keyboard.addListener(MOSTRAR, (e) => {
      ultimoTopoDoTeclado = topoDoTeclado(e);
      setAltura(e.endCoordinates.height);
    });
    const b = Keyboard.addListener(ESCONDER, () => {
      ultimoTopoDoTeclado = null;
      setAltura(0);
    });
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return altura;
}

type Mensuravel = { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void };
type Rolagem = { levar: (campo: Mensuravel | null) => void };
const ContextoDaRolagem = createContext<Rolagem | null>(null);

/** Para o TextInput: ao ganhar o foco, chama a função com o próprio campo. */
export function useLevarAoTeclado(): (campo: Mensuravel | null) => void {
  const r = useContext(ContextoDaRolagem);
  return useCallback((campo) => r?.levar(campo), [r]);
}

type Props = ScrollViewProps & { children?: ReactNode; semFolgaDoTeclado?: boolean };

export const RolagemComTeclado = forwardRef<ScrollView, Props>(function RolagemComTeclado(
  { children, contentContainerStyle, onScroll, semFolgaDoTeclado = false, keyboardShouldPersistTaps = "handled", ...resto },
  ref,
) {
  const alturaDoTeclado = useAlturaDoTeclado();
  const rolagem = useRef<ScrollView>(null);
  const posicao = useRef(0);
  const pendente = useRef<Mensuravel | null>(null);
  useImperativeHandle(ref, () => rolagem.current as ScrollView);

  const subir = useCallback((campo: Mensuravel | null) => {
    const topo = ultimoTopoDoTeclado;
    if (!campo?.measureInWindow || topo == null) return;
    campo.measureInWindow((_x, y, _w, h) => {
      const fundo = y + h + FOLGA;
      if (fundo > topo) rolagem.current?.scrollTo({ y: posicao.current + (fundo - topo), animated: true });
      else if (y < 0) rolagem.current?.scrollTo({ y: Math.max(0, posicao.current + y - FOLGA), animated: true });
    });
  }, []);

  // O teclado abriu (ou mudou de altura) com um campo em foco: sobe-o, depois de o fundo crescer.
  useEffect(() => {
    if (alturaDoTeclado > 0 && pendente.current) {
      const t = setTimeout(() => subir(pendente.current), 60);
      return () => clearTimeout(t);
    }
  }, [alturaDoTeclado, subir]);

  const contexto = useMemo<Rolagem>(
    () => ({
      levar: (campo) => {
        pendente.current = campo;
        // Com o teclado já aberto (passar de um campo para outro), sobe logo.
        if (ultimoTopoDoTeclado != null) setTimeout(() => subir(campo), 60);
      },
    }),
    [subir],
  );

  const base = StyleSheet.flatten(contentContainerStyle) ?? {};
  const fundoBase = typeof base.paddingBottom === "number" ? base.paddingBottom : 0;
  const estilo = semFolgaDoTeclado || alturaDoTeclado === 0 ? contentContainerStyle : [contentContainerStyle, { paddingBottom: fundoBase + alturaDoTeclado }];

  return (
    <ContextoDaRolagem.Provider value={contexto}>
      <ScrollView
        ref={rolagem}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        scrollEventThrottle={16}
        onScroll={(e) => {
          posicao.current = e.nativeEvent.contentOffset.y;
          onScroll?.(e);
        }}
        contentContainerStyle={estilo}
        {...resto}
      >
        {children}
      </ScrollView>
    </ContextoDaRolagem.Provider>
  );
});
