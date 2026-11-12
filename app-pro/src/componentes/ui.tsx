import Ionicons from "@expo/vector-icons/Ionicons";
import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from "react-native";
import { fraseDoQueFalta, primeiroCampoComErro } from "../lib/campos-em-falta";
import { useMostrarNaRolagem } from "./Teclado";
import { Text, TextInput } from "./Texto";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/** As peças repetidas da app: botões, caixas, linhas de detalhe e etiquetas. */

export function Botao({
  titulo,
  aoCarregar,
  tipo = "principal",
  ocupado = false,
  desactivado = false,
}: {
  titulo: string;
  aoCarregar: () => void;
  tipo?: "principal" | "secundario" | "perigo";
  ocupado?: boolean;
  desactivado?: boolean;
}) {
  const c = useCores();
  const fundo = tipo === "principal" ? c.marca : "transparent";
  const tinta = tipo === "principal" ? c.sobreMarca : tipo === "perigo" ? c.mau : c.marca;
  const borda = tipo === "principal" ? c.marca : tipo === "perigo" ? c.mau : c.linha;
  const parado = desactivado || ocupado;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: parado, busy: ocupado }}
      onPress={parado ? undefined : aoCarregar}
      style={({ pressed }) => [
        estilos.botao,
        { backgroundColor: fundo, borderColor: borda, opacity: parado ? 0.55 : pressed ? 0.8 : 1 },
      ]}
    >
      {ocupado ? (
        <ActivityIndicator color={tinta} />
      ) : (
        <Text style={[estilos.textoDoBotao, { color: tinta }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

export function Caixa({ children, estilo }: { children: ReactNode; estilo?: StyleProp<ViewStyle> }) {
  const c = useCores();
  return (
    <View style={[estilos.caixa, { backgroundColor: c.superficie, borderColor: c.linha }, estilo]}>{children}</View>
  );
}

export function TituloDaCaixa({ children }: { children: ReactNode }) {
  const c = useCores();
  return <Text style={[estilos.tituloDaCaixa, { color: c.tinta }]}>{children}</Text>;
}

/** Uma linha «rótulo — valor» do detalhe. Não aparece quando não há valor. */
export function Linha({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  const c = useCores();
  if (!valor) return null;
  return (
    <View style={[estilos.linha, { borderColor: c.linha }]}>
      <Text style={[estilos.rotulo, { color: c.suave }]}>{rotulo}</Text>
      <Text style={[estilos.valorDaLinha, { color: c.tinta }]} numberOfLines={3}>
        {valor}
      </Text>
    </View>
  );
}

export function Etiqueta({ texto, tom = "marca" }: { texto: string; tom?: "marca" | "bom" | "aviso" | "mau" | "neutro" }) {
  const c = useCores();
  const cores = {
    marca: [c.marcaSuave, c.marca],
    bom: [c.bomSuave, c.bom],
    aviso: [c.avisoSuave, c.aviso],
    mau: [c.mauSuave, c.mau],
    neutro: [c.fundo, c.suave],
  }[tom];
  return (
    <View style={[estilos.etiqueta, { backgroundColor: cores[0] }]}>
      <Text style={[estilos.textoDaEtiqueta, { color: cores[1] }]}>{texto}</Text>
    </View>
  );
}

/**
 * Uma linha do menu da conta, como no painel: ícone, nome, o valor à direita
 * («200 km», «PT50 ···· 3233») e a seta. Sem a «bola» do Android ao tocar.
 */
export function ItemDoMenu({
  icone,
  titulo,
  valor,
  aviso = false,
  aoCarregar,
  perigo = false,
  ultimo = false,
}: {
  icone: React.ComponentProps<typeof Ionicons>["name"];
  titulo: string;
  valor?: string | null;
  /** O valor pede um toque (11-11-2026): em âmbar e a negro, como o «destaque» do painel. */
  aviso?: boolean;
  aoCarregar: () => void;
  perigo?: boolean;
  ultimo?: boolean;
}) {
  const c = useCores();
  const tinta = perigo ? c.mau : c.tinta;
  return (
    <Pressable
      onPress={aoCarregar}
      accessibilityRole="button"
      accessibilityLabel={valor ? `${titulo}, ${valor}` : titulo}
      style={({ pressed }) => [
        estilos.item,
        { borderBottomColor: c.linha, borderBottomWidth: ultimo ? 0 : StyleSheet.hairlineWidth, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={icone} size={21} color={perigo ? c.mau : c.marca} />
      <Text numberOfLines={1} style={[estilos.tituloDoItem, { color: tinta }]}>
        {titulo}
      </Text>
      {valor ? (
        <Text numberOfLines={1} style={[estilos.valorDoItem, aviso ? { color: c.aviso, fontWeight: "700" } : { color: c.suave }]}>
          {valor}
        </Text>
      ) : null}
      {!perigo ? <Ionicons name="chevron-forward" size={18} color={c.suave} /> : null}
    </Pressable>
  );
}

/**
 * O FORMULÁRIO QUE NÃO PASSA — 12-11-2026 (decisão d9), à maneira do pedido
 * da app de cliente (`descerAte`, NovoPedido.tsx).
 *
 * `useFormulario(rotulos)` guarda os erros por campo; `mostrarErros` pinta
 * de vermelho cada campo (o `CampoDeTexto` com `campo=`, e as caixas de
 * escolha com `CaixaComErro`), rola até ao que está mais acima e põe lá o
 * foco. O `aviso` diz o quê («Falta: telemóvel (tem de ser português),
 * email.»), pela ordem dos `rotulos`. Todo o ecrã com erros por campo usa
 * isto (há um teste que lê os ecrãs).
 *
 * O ecrã põe os campos dentro de `<FormularioComErros formulario={...}>`, e
 * este dentro da `RolagemComTeclado` — é ela que rola (`useMostrarNaRolagem`).
 */
type Medivel = { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void };
export type LugarDoCampo = { vista: RefObject<View | null>; focar?: () => void; mostrar: () => void };
type ContextoDoFormulario = {
  erroDe: (campo: string) => string | null;
  registar: (campo: string, lugar: LugarDoCampo) => () => void;
  tirarErro: (campo: string) => void;
};
const ContextoDoFormulario = createContext<ContextoDoFormulario | null>(null);

export type Formulario = {
  erros: Record<string, string>;
  /** «Falta: …», ou null sem erros. */
  aviso: string | null;
  /** Pinta, rola até ao primeiro e foca-o. */
  mostrarErros: (erros: Record<string, string>) => void;
  /** Um erro só, sem rolar (o envio de uma fotografia que falhou, por exemplo). */
  marcarErro: (campo: string, mensagem: string) => void;
  tirarErro: (campo: string) => void;
  limparErros: () => void;
  contexto: ContextoDoFormulario;
};

export function useFormulario(rotulos: Record<string, string>): Formulario {
  const [erros, setErros] = useState<Record<string, string>>({});
  const lugares = useRef(new Map<string, LugarDoCampo>());
  const rotulosRef = useRef(rotulos);
  rotulosRef.current = rotulos;

  const registar = useCallback((campo: string, lugar: LugarDoCampo) => {
    lugares.current.set(campo, lugar);
    return () => {
      if (lugares.current.get(campo) === lugar) lugares.current.delete(campo);
    };
  }, []);
  const tirarErro = useCallback((campo: string) => {
    setErros((antes) => {
      if (!(campo in antes)) return antes;
      const { [campo]: _, ...resto } = antes;
      return resto;
    });
  }, []);
  const limparErros = useCallback(() => setErros({}), []);
  const marcarErro = useCallback((campo: string, mensagem: string) => setErros((antes) => ({ ...antes, [campo]: mensagem })), []);

  /** Mede os campos com erro e desce até ao mais acima; sem medida, vai pela ordem dos rótulos. */
  const descerAoPrimeiro = useCallback((lista: Record<string, string>) => {
    const campos = Object.keys(lista).filter((k) => lugares.current.has(k));
    if (campos.length === 0) return;
    const irPara = (campo: string) => {
      const lugar = lugares.current.get(campo);
      lugar?.mostrar();
      lugar?.focar?.();
    };
    let restam = campos.length;
    let melhor: { campo: string; y: number } | null = null;
    const fim = () => {
      restam -= 1;
      if (restam > 0) return;
      const primeiro = melhor?.campo ?? primeiroCampoComErro(lista, rotulosRef.current);
      if (primeiro) irPara(primeiro);
    };
    for (const campo of campos) {
      const vista = lugares.current.get(campo)?.vista.current as Medivel | null | undefined;
      if (!vista?.measureInWindow) {
        fim();
        continue;
      }
      vista.measureInWindow((_x, y) => {
        if (!melhor || y < melhor.y) melhor = { campo, y };
        fim();
      });
    }
  }, []);

  const mostrarErros = useCallback(
    (novos: Record<string, string>) => {
      setErros(novos);
      // Depois de pintar o vermelho: desce até ao primeiro e põe lá o foco.
      if (Object.keys(novos).length > 0) setTimeout(() => descerAoPrimeiro(novos), 60);
    },
    [descerAoPrimeiro],
  );

  const contexto = useMemo<ContextoDoFormulario>(
    () => ({ erroDe: (campo) => erros[campo] ?? null, registar, tirarErro }),
    [erros, registar, tirarErro],
  );
  return { erros, aviso: fraseDoQueFalta(erros, rotulos), mostrarErros, marcarErro, tirarErro, limparErros, contexto };
}

/** À volta dos campos do formulário (dentro da `RolagemComTeclado`). */
export function FormularioComErros({ formulario, children }: { formulario: Formulario; children: ReactNode }) {
  return <ContextoDoFormulario.Provider value={formulario.contexto}>{children}</ContextoDoFormulario.Provider>;
}

/** O erro deste campo (ou null), e a vista onde ele está, para o formulário descer até lá. */
function useCampoDoFormulario(campo: string | undefined, focar?: () => void) {
  const ctx = useContext(ContextoDoFormulario);
  const mostrarNaRolagem = useMostrarNaRolagem();
  const vista = useRef<View | null>(null);
  const focarRef = useRef(focar);
  focarRef.current = focar;
  const mostrarRef = useRef(mostrarNaRolagem);
  mostrarRef.current = mostrarNaRolagem;
  useEffect(() => {
    if (!ctx || !campo) return;
    return ctx.registar(campo, {
      vista,
      focar: () => focarRef.current?.(),
      mostrar: () => mostrarRef.current(vista.current as Medivel | null),
    });
  }, [ctx, campo]);
  return {
    erro: ctx && campo ? ctx.erroDe(campo) : null,
    vista,
    tirar: () => (ctx && campo ? ctx.tirarErro(campo) : undefined),
  };
}

/** Uma caixa de escolha (a viatura, os serviços, as fotografias) que fica a vermelho quando lhe falta alguma coisa. */
export function CaixaComErro({ campo, children }: { campo: string; children: ReactNode }) {
  const c = useCores();
  const { erro, vista } = useCampoDoFormulario(campo);
  return (
    <View ref={vista} collapsable={false}>
      <Caixa estilo={erro ? { borderColor: c.mau, borderWidth: 1.5 } : null}>
        {children}
        {erro ? (
          <Text accessibilityLiveRegion="polite" style={{ color: c.mau, fontSize: LETRA.pequena + 1, fontWeight: "600" }}>
            {erro}
          </Text>
        ) : null}
      </Caixa>
    </View>
  );
}

/** Um grupo de escolhas dentro de uma caixa (o assunto, o regime de IVA): a vermelho, com a frase por baixo. */
export function GrupoComErro({ campo, children }: { campo: string; children: ReactNode }) {
  const c = useCores();
  const { erro, vista } = useCampoDoFormulario(campo);
  return (
    <View
      ref={vista}
      collapsable={false}
      style={erro ? { borderWidth: 1.5, borderColor: c.mau, borderRadius: RAIO.m, padding: ESPACO.s, gap: ESPACO.xs } : { gap: ESPACO.xs }}
    >
      {children}
      {erro ? (
        <Text accessibilityLiveRegion="polite" style={{ color: c.mau, fontSize: LETRA.pequena + 1, fontWeight: "600" }}>
          {erro}
        </Text>
      ) : null}
    </View>
  );
}

/** Um campo de formulário: o rótulo, a caixa, e por baixo o erro (vermelho) ou a dica (cinzenta). */
export function CampoDeTexto({
  rotulo,
  erro: erroDado,
  dica,
  prefixo,
  campo,
  ...resto
}: {
  rotulo: string;
  erro?: string | null;
  dica?: string | null;
  prefixo?: string;
  /** O nome do campo no `useFormulario`: fica a vermelho, recebe o foco, e o erro sai ao escrever. */
  campo?: string;
} & React.ComponentProps<typeof TextInput>) {
  const c = useCores();
  const entrada = useRef<{ focus?: () => void } | null>(null);
  const doFormulario = useCampoDoFormulario(campo, () => entrada.current?.focus?.());
  const erro = erroDado ?? doFormulario.erro;
  const aoMudar = resto.onChangeText;
  return (
    <View style={{ gap: 6 }} ref={doFormulario.vista} collapsable={false}>
      <Text style={[estilos.rotuloDoCampo, { color: c.tinta }]}>{rotulo}</Text>
      <View style={[estilos.caixaDoCampo, { borderColor: erro ? c.mau : c.linha, borderWidth: erro ? 1.5 : 1, backgroundColor: c.fundo }]}>
        {prefixo ? <Text style={{ color: c.suave, fontSize: LETRA.media }}>{prefixo}</Text> : null}
        <TextInput
          placeholderTextColor={c.suave}
          accessibilityLabel={rotulo}
          {...resto}
          ref={entrada as never}
          onChangeText={(t) => {
            if (campo && doFormulario.erro) doFormulario.tirar();
            aoMudar?.(t);
          }}
          style={[estilos.entrada, { color: c.tinta }, resto.multiline ? estilos.entradaAlta : null, resto.style]}
        />
      </View>
      {erro ? (
        <Text style={{ color: c.mau, fontSize: LETRA.pequena + 1 }}>{erro}</Text>
      ) : dica ? (
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>{dica}</Text>
      ) : null}
    </View>
  );
}

/** Uma linha com interruptor: o nome à esquerda, e por baixo o que muda. */
export function Interruptor({
  rotulo,
  dica,
  valor,
  aoMudar,
  desactivado = false,
}: {
  rotulo: string;
  dica?: string;
  valor: boolean;
  aoMudar: (v: boolean) => void;
  desactivado?: boolean;
}) {
  const c = useCores();
  return (
    <View style={[estilos.interruptor, desactivado ? { opacity: 0.5 } : null]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.tinta, fontWeight: "600", fontSize: LETRA.normal }}>{rotulo}</Text>
        {dica ? <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>{dica}</Text> : null}
      </View>
      <Switch
        value={valor}
        onValueChange={aoMudar}
        disabled={desactivado}
        accessibilityLabel={rotulo}
        trackColor={{ false: c.linha, true: c.marca }}
        thumbColor={c.superficie}
      />
    </View>
  );
}

/** Uma escolha entre poucas opções, lado a lado — o modo do ecrã, por exemplo. */
export function Escolhas<T extends string>({
  opcoes,
  valor,
  aoEscolher,
}: {
  opcoes: Array<{ valor: T; rotulo: string }>;
  valor: T;
  aoEscolher: (v: T) => void;
}) {
  const c = useCores();
  return (
    <View accessibilityRole="radiogroup" style={[estilos.escolhas, { borderColor: c.linha, backgroundColor: c.fundo }]}>
      {opcoes.map((o) => {
        const activa = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => aoEscolher(o.valor)}
            accessibilityRole="radio"
            accessibilityState={{ checked: activa }}
            style={[estilos.escolha, activa ? { backgroundColor: c.marca } : null]}
          >
            <Text numberOfLines={1} style={{ color: activa ? c.sobreMarca : c.tinta, fontWeight: "700", fontSize: LETRA.pequena + 1 }}>
              {o.rotulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Mensagem({ texto, tom = "mau" }: { texto: string; tom?: "mau" | "aviso" | "bom" }) {
  const c = useCores();
  const [fundo, tinta] = { mau: [c.mauSuave, c.mau], aviso: [c.avisoSuave, c.aviso], bom: [c.bomSuave, c.bom] }[tom];
  return (
    <View accessibilityRole="alert" style={[estilos.mensagem, { backgroundColor: fundo }]}>
      <Text style={{ color: tinta, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  botao: {
    minHeight: 46,
    borderRadius: RAIO.m,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ESPACO.l,
  },
  textoDoBotao: { fontSize: LETRA.normal, fontWeight: "700" },
  caixa: { borderWidth: 1, borderRadius: RAIO.l, padding: ESPACO.m + 2, gap: ESPACO.s },
  tituloDaCaixa: { fontSize: LETRA.media, fontWeight: "700", marginBottom: ESPACO.xs },
  linha: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: ESPACO.m,
    paddingVertical: ESPACO.s,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rotulo: { fontSize: LETRA.pequena + 1, flexShrink: 0 },
  valorDaLinha: { fontSize: LETRA.pequena + 1, fontWeight: "600", flex: 1, textAlign: "right" },
  etiqueta: { paddingHorizontal: ESPACO.s, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" },
  textoDaEtiqueta: { fontSize: 12, fontWeight: "700" },
  mensagem: { borderRadius: RAIO.m, padding: ESPACO.m },
  item: { flexDirection: "row", alignItems: "center", gap: ESPACO.m, minHeight: 52, paddingHorizontal: ESPACO.m },
  tituloDoItem: { flex: 1, fontSize: LETRA.normal, fontWeight: "600" },
  valorDoItem: { maxWidth: "45%", fontSize: LETRA.pequena + 1 },
  rotuloDoCampo: { fontWeight: "600", fontSize: LETRA.normal },
  caixaDoCampo: { flexDirection: "row", alignItems: "center", gap: ESPACO.s, borderWidth: 1, borderRadius: RAIO.m, paddingHorizontal: ESPACO.m },
  entrada: { flex: 1, minHeight: 48, fontSize: LETRA.media },
  entradaAlta: { minHeight: 96, paddingTop: ESPACO.s, textAlignVertical: "top" },
  interruptor: { flexDirection: "row", alignItems: "center", gap: ESPACO.m, paddingVertical: ESPACO.xs },
  escolhas: { flexDirection: "row", borderWidth: 1, borderRadius: RAIO.m, padding: 3, gap: 3 },
  escolha: { flex: 1, minHeight: 40, borderRadius: RAIO.s + 2, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
});
