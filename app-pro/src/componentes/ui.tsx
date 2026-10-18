import Ionicons from "@expo/vector-icons/Ionicons";
import type React from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from "react-native";
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
  aoCarregar,
  perigo = false,
  ultimo = false,
}: {
  icone: React.ComponentProps<typeof Ionicons>["name"];
  titulo: string;
  valor?: string | null;
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
        <Text numberOfLines={1} style={[estilos.valorDoItem, { color: c.suave }]}>
          {valor}
        </Text>
      ) : null}
      {!perigo ? <Ionicons name="chevron-forward" size={18} color={c.suave} /> : null}
    </Pressable>
  );
}

/** Um campo de formulário: o rótulo, a caixa, e por baixo o erro (vermelho) ou a dica (cinzenta). */
export function CampoDeTexto({
  rotulo,
  erro,
  dica,
  prefixo,
  ...resto
}: { rotulo: string; erro?: string | null; dica?: string | null; prefixo?: string } & React.ComponentProps<typeof TextInput>) {
  const c = useCores();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[estilos.rotuloDoCampo, { color: c.tinta }]}>{rotulo}</Text>
      <View style={[estilos.caixaDoCampo, { borderColor: erro ? c.mau : c.linha, backgroundColor: c.fundo }]}>
        {prefixo ? <Text style={{ color: c.suave, fontSize: LETRA.media }}>{prefixo}</Text> : null}
        <TextInput
          placeholderTextColor={c.suave}
          accessibilityLabel={rotulo}
          {...resto}
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
}: {
  rotulo: string;
  dica?: string;
  valor: boolean;
  aoMudar: (v: boolean) => void;
}) {
  const c = useCores();
  return (
    <View style={estilos.interruptor}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.tinta, fontWeight: "600", fontSize: LETRA.normal }}>{rotulo}</Text>
        {dica ? <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>{dica}</Text> : null}
      </View>
      <Switch
        value={valor}
        onValueChange={aoMudar}
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
