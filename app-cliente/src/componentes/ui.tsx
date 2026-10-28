import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TextInput } from "./Texto";
import { CORES } from "../tema";

/**
 * As peças de todos os ecrãs. Botões só com opacidade ao tocar, sem a «bola»
 * do Android (como na Pro). Sem pílulas com ícone por cima dos títulos, sem
 * caminhos «Início / …»: o ecrã começa no título.
 */
export function Botao({
  titulo,
  aoCarregar,
  tipo = "principal",
  ocupado = false,
  desligado = false,
}: {
  titulo: string;
  aoCarregar: () => void;
  tipo?: "principal" | "secundario" | "perigo";
  ocupado?: boolean;
  desligado?: boolean;
}) {
  const principal = tipo === "principal";
  const cor = tipo === "perigo" ? CORES.mau : CORES.marca;
  const inactivo = ocupado || desligado;
  return (
    <Pressable
      onPress={inactivo ? undefined : aoCarregar}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: inactivo, busy: ocupado }}
      style={({ pressed }) => ({
        minHeight: 50,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        backgroundColor: principal ? CORES.marca : CORES.fundo,
        borderWidth: principal ? 0 : 1,
        borderColor: tipo === "perigo" ? CORES.mau : CORES.linha,
        opacity: inactivo ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {ocupado ? (
        <ActivityIndicator color={principal ? CORES.sobreMarca : cor} />
      ) : (
        <Text style={{ color: principal ? CORES.sobreMarca : cor, fontSize: 16, fontWeight: "700" }} numberOfLines={1}>
          {titulo}
        </Text>
      )}
    </Pressable>
  );
}

/** Uma ligação de texto (acções secundárias: «Recusar», «Usar outro email», «Ver avaliações»). */
export function Ligacao({
  titulo,
  aoCarregar,
  tom = "marca",
  centrada = false,
}: {
  titulo: string;
  aoCarregar: () => void;
  tom?: "marca" | "mau" | "suave";
  centrada?: boolean;
}) {
  const cor = tom === "mau" ? CORES.mau : tom === "suave" ? CORES.suave : CORES.marca;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      onPress={aoCarregar}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 8, alignSelf: centrada ? "center" : "flex-start" })}
    >
      <Text style={{ color: cor, fontSize: 15, fontWeight: "600" }}>{titulo}</Text>
    </Pressable>
  );
}

export function Aviso({ texto, tom }: { texto: string; tom: "bom" | "mau" | "aviso" | "neutro" }) {
  const fundo =
    tom === "bom" ? CORES.bomSuave : tom === "mau" ? CORES.mauSuave : tom === "aviso" ? CORES.avisoSuave : CORES.superficie;
  const cor = tom === "bom" ? CORES.bom : tom === "mau" ? CORES.mau : tom === "aviso" ? CORES.aviso : CORES.tinta;
  const estilo: ViewStyle = { backgroundColor: fundo, borderRadius: 12, padding: 14 };
  return (
    <View style={estilo} accessibilityLiveRegion="polite">
      <Text style={{ color: cor, fontSize: 15, lineHeight: 21 }}>{texto}</Text>
    </View>
  );
}

export function Titulo({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={{ color: CORES.tinta, fontSize: 26, fontWeight: "800" }}>
      {children}
    </Text>
  );
}

export function Subtitulo({ children }: { children: ReactNode }) {
  return <Text style={{ color: CORES.tinta, fontSize: 18, fontWeight: "700" }}>{children}</Text>;
}

export function Paragrafo({ children, pequeno = false, suave = false }: { children: ReactNode; pequeno?: boolean; suave?: boolean }) {
  return (
    <Text style={{ color: suave ? CORES.suave : CORES.tinta, fontSize: pequeno ? 13 : 15, lineHeight: pequeno ? 19 : 22 }}>
      {children}
    </Text>
  );
}

export function Cartao({ children, destaque = false }: { children: ReactNode; destaque?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: CORES.fundo,
        borderWidth: 1,
        borderColor: destaque ? CORES.marca : CORES.linha,
        borderRadius: 14,
        padding: 16,
        gap: 8,
      }}
    >
      {children}
    </View>
  );
}

export function Carregando({ texto }: { texto?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
      <ActivityIndicator color={CORES.marca} size="large" />
      {texto ? <Text style={{ color: CORES.suave, fontSize: 16, textAlign: "center" }}>{texto}</Text> : null}
    </View>
  );
}

/** Um ecrã simples: fundo branco, margens, a deslizar. */
export function Ecra({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Escolher uma de várias opções (botões de altura fixa, um por linha ou lado a lado). */
export function Escolhas<T extends string>({
  opcoes,
  valor,
  aoEscolher,
  rotulo,
}: {
  opcoes: ReadonlyArray<{ id: T; nome: string; ajuda?: string }>;
  valor: T | undefined;
  aoEscolher: (v: T) => void;
  rotulo?: string;
}) {
  return (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={rotulo}>
      {rotulo ? <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>{rotulo}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {opcoes.map((o) => {
          const escolhida = o.id === valor;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: escolhida }}
              accessibilityLabel={o.nome}
              onPress={() => aoEscolher(o.id)}
              style={({ pressed }) => ({
                minHeight: 44,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: escolhida ? 2 : 1,
                borderColor: escolhida ? CORES.marca : CORES.linha,
                backgroundColor: escolhida ? CORES.marcaSuave : CORES.fundo,
                opacity: pressed ? 0.7 : 1,
                justifyContent: "center",
              })}
            >
              <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: escolhida ? "700" : "500" }} numberOfLines={1}>
                {o.nome}
              </Text>
              {o.ajuda ? (
                <Text style={{ color: CORES.suave, fontSize: 12 }} numberOfLines={1}>
                  {o.ajuda}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Campo({
  rotulo,
  valor,
  aoMudar,
  ajuda,
  erro,
  ...resto
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  ajuda?: string | null;
  erro?: string | null;
} & Omit<ComponentProps<typeof TextInput>, "value" | "onChangeText">) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>{rotulo}</Text>
      <TextInput
        value={valor}
        onChangeText={aoMudar}
        accessibilityLabel={rotulo}
        style={{
          minHeight: 50,
          borderWidth: 1,
          borderColor: erro ? CORES.mau : CORES.linha,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
          fontSize: 16,
          color: CORES.tinta,
          backgroundColor: CORES.superficie,
        }}
        {...resto}
      />
      {ajuda ? <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 18 }}>{ajuda}</Text> : null}
      {erro ? <Text style={{ color: CORES.mau, fontSize: 13 }}>{erro}</Text> : null}
    </View>
  );
}

/**
 * Uma pergunta antes de uma acção que não se desfaz (contratar, recusar,
 * cancelar, aceitar o preço). O texto pequeno por baixo é para a frase única.
 */
export function Confirmacao({
  visivel,
  titulo,
  texto,
  pequeno,
  confirmar,
  voltar = "Voltar",
  perigo = false,
  ocupado = false,
  erro,
  aoConfirmar,
  aoVoltar,
  children,
}: {
  visivel: boolean;
  titulo: string;
  texto?: string;
  pequeno?: string | null;
  confirmar: string;
  voltar?: string;
  perigo?: boolean;
  ocupado?: boolean;
  erro?: string | null;
  aoConfirmar: () => void;
  aoVoltar: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={aoVoltar}>
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 20 }}>
        <View style={{ backgroundColor: CORES.fundo, borderRadius: 16, padding: 20, gap: 14 }}>
          <Text accessibilityRole="header" style={{ color: CORES.tinta, fontSize: 20, fontWeight: "800" }}>
            {titulo}
          </Text>
          {texto ? <Text style={{ color: CORES.tinta, fontSize: 15, lineHeight: 22 }}>{texto}</Text> : null}
          {children}
          {pequeno ? <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>{pequeno}</Text> : null}
          {erro ? <Aviso texto={erro} tom="mau" /> : null}
          <Botao titulo={confirmar} tipo={perigo ? "perigo" : "principal"} ocupado={ocupado} aoCarregar={aoConfirmar} />
          <Botao titulo={voltar} tipo="secundario" desligado={ocupado} aoCarregar={aoVoltar} />
        </View>
      </View>
    </Modal>
  );
}
