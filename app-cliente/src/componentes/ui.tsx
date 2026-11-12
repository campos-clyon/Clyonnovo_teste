import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Dimensions, LayoutAnimation, Modal, Pressable, ScrollView, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TextInput } from "./Texto";
import { RolagemComTeclado, useAlturaDoTeclado } from "./Teclado";
import { CORES } from "../tema";
import { useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCampoEmFalta, type LugarDoCampo } from "./CampoEmFalta";
import { MUDAR, rotuloDoCartao, soAEscolhida } from "../lib/escolha-recolhida";

/**
 * UMA SECÇÃO RECOLHIDA (02-11-2026, «ecrãs simples»): o título numa linha, e
 * o que está dentro só quando se toca. Para o que não é o próximo passo.
 */
export function Recolhido({ titulo, children, abertoAoInicio = false }: { titulo: string; children: ReactNode; abertoAoInicio?: boolean }) {
  const [aberto, setAberto] = useState(abertoAoInicio);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: CORES.linha }}>
      <Pressable
        onPress={() => setAberto((a) => !a)}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto }}
        accessibilityLabel={titulo}
        style={({ pressed }) => ({ minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", opacity: pressed ? 0.6 : 1 })}
      >
        <Text titulo style={{ color: CORES.tinta, fontSize: 15.5, fontWeight: "600" }}>
          {titulo}
        </Text>
        <Ionicons name={aberto ? "chevron-up" : "chevron-down"} size={20} color={CORES.suave} />
      </Pressable>
      {aberto ? <View style={{ gap: 10, paddingBottom: 14 }}>{children}</View> : null}
    </View>
  );
}

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
  tipo?: "principal" | "secundario" | "perigo" | "whatsapp";
  ocupado?: boolean;
  desligado?: boolean;
}) {
  const principal = tipo === "principal";
  const whatsapp = tipo === "whatsapp";
  const cor = tipo === "perigo" ? CORES.mau : whatsapp ? CORES.whatsappTinta : CORES.marca;
  const inactivo = ocupado || desligado;
  return (
    <Pressable
      onPress={inactivo ? undefined : aoCarregar}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: inactivo, busy: ocupado }}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 18,
        backgroundColor: principal ? CORES.marca : whatsapp ? CORES.whatsapp : CORES.fundo,
        borderWidth: principal || whatsapp ? 0 : 1.5,
        borderColor: tipo === "perigo" ? CORES.mau : CORES.linhaForte,
        opacity: inactivo ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {ocupado ? (
        <ActivityIndicator color={principal ? CORES.sobreMarca : cor} />
      ) : (
        // Sem reticências: com a letra grande, o título parte de linha (02-11-2026).
        <Text titulo style={{ color: principal ? CORES.sobreMarca : cor, fontSize: 15, fontWeight: "600", textAlign: "center", paddingVertical: 6 }}>
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
    <Text titulo accessibilityRole="header" style={{ color: CORES.tinta, fontSize: 22, fontWeight: "700", lineHeight: 28 }}>
      {children}
    </Text>
  );
}

export function Subtitulo({ children }: { children: ReactNode }) {
  return (
    <Text titulo style={{ color: CORES.tinta, fontSize: 18, fontWeight: "600" }}>
      {children}
    </Text>
  );
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
        borderRadius: 20,
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

/**
 * Um ecrã simples: fundo branco, margens, a deslizar. Com a margem de baixo do
 * telemóvel (os botões do sistema ou a barra dos gestos): dentro dos
 * separadores ela é zero, porque a barra da app já a tem; nos outros ecrãs
 * empurra o último botão para cima dos botões do Android.
 */
export function Ecra({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }} edges={["top", "left", "right", "bottom"]}>
      <RolagemComTeclado contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {children}
      </RolagemComTeclado>
    </SafeAreaView>
  );
}

/**
 * Uma animação curta (200 ms, opacidade e lugar) para o que entra e sai do
 * mesmo ecrã — o resto desliza para o sítio, sem saltos.
 */
export function animarAMudanca(): void {
  LayoutAnimation.configureNext(LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}

/**
 * A ESCOLHA FEITA, NUM CARTÃO COMPACTO (02-11-2026): o nome da opção, um
 * visto (ou o ícone do serviço) e «Mudar». Tocar no cartão volta a mostrar
 * todas as opções.
 */
export function EscolhaFeita({ nome, ajuda, rotulo, aoMudar, icone }: { nome: string; ajuda?: string; rotulo?: string; aoMudar: () => void; icone?: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloDoCartao(nome, rotulo)}
      onPress={aoMudar}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingLeft: 14,
        paddingRight: 8,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: CORES.marca,
        backgroundColor: CORES.marcaSuave,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {icone ?? <Ionicons name="checkmark-circle" size={20} color={CORES.marca} />}
      <View style={{ flex: 1 }}>
        <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: "700" }} numberOfLines={2}>
          {nome}
        </Text>
        {ajuda ? (
          <Text style={{ color: CORES.suave, fontSize: 12 }} numberOfLines={1}>
            {ajuda}
          </Text>
        ) : null}
      </View>
      <View style={{ minHeight: 36, paddingHorizontal: 10, justifyContent: "center" }}>
        <Text style={{ color: CORES.marca, fontSize: 14, fontWeight: "700" }}>{MUDAR}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Escolher uma de várias opções (botões de altura fixa, um por linha ou lado a
 * lado). Com `recolher` (as listas do Pedir com perguntas a seguir no mesmo
 * ecrã), depois de escolher fica só a escolhida, em `EscolhaFeita`.
 */
export function Escolhas<T extends string>({
  opcoes,
  valor,
  aoEscolher,
  rotulo,
  campo,
  recolher = false,
}: {
  opcoes: ReadonlyArray<{ id: T; nome: string; ajuda?: string }>;
  valor: T | undefined;
  aoEscolher: (v: T) => void;
  rotulo?: string;
  /** O nome do campo em `camposEmFalta`: o rótulo e as opções ficam a vermelho quando falta. */
  campo?: string;
  /** Depois de escolher, fica só a escolhida com «Mudar» (02-11-2026). */
  recolher?: boolean;
}) {
  const { erro, vista } = useCampoEmFalta(campo);
  const [aMudar, setAMudar] = useState(false);
  const escolhidaAgora = opcoes.find((o) => o.id === valor);
  const recolhida = soAEscolhida(
    recolher,
    valor,
    opcoes.map((o) => o.id),
    aMudar,
  );
  const escolher = (v: T) => {
    if (recolher) {
      animarAMudanca();
      setAMudar(false);
    }
    aoEscolher(v);
  };
  return (
    <View ref={vista} collapsable={false} style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={rotulo}>
      {rotulo ? <Text style={{ color: erro ? CORES.mau : CORES.tinta, fontSize: 15, fontWeight: "600" }}>{rotulo}</Text> : null}
      {recolhida && escolhidaAgora ? (
        <EscolhaFeita
          nome={escolhidaAgora.nome}
          ajuda={escolhidaAgora.ajuda}
          rotulo={rotulo}
          aoMudar={() => {
            animarAMudanca();
            setAMudar(true);
          }}
        />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {opcoes.map((o) => {
            const escolhida = o.id === valor;
            return (
              <Pressable
                key={o.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: escolhida }}
                accessibilityLabel={o.nome}
                onPress={() => escolher(o.id)}
                style={({ pressed }) => ({
                  minHeight: 44,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: escolhida ? 2 : erro ? 1.5 : 1,
                  borderColor: escolhida ? CORES.marca : erro ? CORES.mau : CORES.linha,
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
      )}
      {erro ? <Text style={{ color: CORES.mau, fontSize: 13, fontWeight: "600" }}>{erro}</Text> : null}
    </View>
  );
}

/**
 * O FORMULÁRIO QUE NÃO PASSA — o ajudante comum (d9, 12-11-2026). Nasceu no
 * pedido (`descerAte`, NovoPedido.tsx): depois de pintar o vermelho, rola
 * até ao campo, com folga por cima, e põe lá o foco. A app Pro tem o mesmo em
 * `useFormulario` (app-pro/src/componentes/ui.tsx).
 */
export const FOLGA_POR_CIMA_DO_CAMPO = 24;
export function descerAteOCampo(
  lugar: LugarDoCampo | undefined,
  conteudo: View | null,
  rolagem: { scrollTo: (o: { y: number; animated?: boolean }) => void } | null,
): void {
  const vista = lugar?.vista.current;
  if (!vista || !conteudo) return;
  vista.measureLayout(
    conteudo,
    (_x, y) => {
      rolagem?.scrollTo({ y: Math.max(0, y - FOLGA_POR_CIMA_DO_CAMPO), animated: true });
      lugar?.focar?.();
    },
    () => lugar?.focar?.(),
  );
}

export function Campo({
  rotulo,
  valor,
  aoMudar,
  ajuda,
  erro: erroDado,
  campo,
  ...resto
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  ajuda?: string | null;
  erro?: string | null;
  /** O nome do campo em `camposEmFalta`: fica a vermelho e recebe o foco quando falta. */
  campo?: string;
} & Omit<ComponentProps<typeof TextInput>, "value" | "onChangeText">) {
  const entrada = useRef<{ focus?: () => void } | null>(null);
  const emFalta = useCampoEmFalta(campo, () => entrada.current?.focus?.());
  const erro = erroDado ?? emFalta.erro;
  return (
    <View style={{ gap: 6 }} ref={emFalta.vista} collapsable={false}>
      <Text style={{ color: erro ? CORES.mau : CORES.tinta, fontSize: 15, fontWeight: "600" }}>{rotulo}</Text>
      <TextInput
        ref={entrada as never}
        value={valor}
        onChangeText={aoMudar}
        accessibilityLabel={rotulo}
        style={{
          minHeight: 50,
          borderWidth: erro ? 1.5 : 1,
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
 * O «voltar» do Android faz o de `aoFechar` (sem ele, o de `aoVoltar`): quando
 * o segundo botão apaga alguma coisa, o «voltar» não o pode fazer.
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
  aoFechar,
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
  aoFechar?: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={aoFechar ?? aoVoltar} statusBarTranslucent navigationBarTranslucent>
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

/** O cabeçalho de uma secção, com a ligação à direita («Ver todos»). */
export function Seccao({ titulo, ligacao, aoCarregar, children }: { titulo: string; ligacao?: string; aoCarregar?: () => void; children?: ReactNode }) {
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <Text titulo accessibilityRole="header" style={{ flexShrink: 1, color: CORES.tinta, fontSize: 18, fontWeight: "600" }}>
          {titulo}
        </Text>
        {ligacao && aoCarregar ? (
          <Pressable onPress={aoCarregar} hitSlop={10} accessibilityRole="button" accessibilityLabel={ligacao}>
            <Text titulo style={{ color: CORES.marca, fontSize: 13.5, fontWeight: "600" }}>
              {ligacao}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * UM PREÇO DE REFERÊNCIA, TAL COMO A API O ESCREVE — «40 – 120 € + IVA
 * (49,20 – 147,60 € com IVA)»: a primeira parte em destaque e o resto logo a
 * seguir, NA MESMA FRASE (critério 35: nunca um preço sem o valor com IVA ao
 * lado). A app não parte números nem faz contas: só a letra.
 */
export function PrecoDeReferencia({ texto, cor = CORES.tinta, tamanho = 15 }: { texto: string; cor?: string; tamanho?: number }) {
  const m = /^(.*?)\s*(\([^()]*\))\s*$/.exec(texto.trim());
  const principal = m && m[1] ? m[1] : texto.trim();
  const resto = m && m[1] ? m[2] : null;
  return (
    <Text style={{ color: cor, fontSize: tamanho, lineHeight: tamanho * 1.4 }}>
      <Text titulo style={{ color: cor, fontSize: tamanho, fontWeight: "700" }}>
        {principal}
      </Text>
      {resto ? <Text style={{ color: CORES.suave, fontSize: tamanho - 2 }}>{` ${resto}`}</Text> : null}
    </Text>
  );
}

/** Uma etiqueta de estado (cores do backoffice), sem ícone. */
export function Etiqueta({ texto, cor = CORES.marca, fundo = CORES.marcaSuave }: { texto: string; cor?: string; fundo?: string }) {
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: fundo, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: cor, fontSize: 12.5, fontWeight: "600" }} numberOfLines={1}>
        {texto}
      </Text>
    </View>
  );
}

/** Uma folha que sobe de baixo (E3.F, a folha D4.6, alterar o pedido). Fecha-se a tocar fora. */
export function Folha({ visivel, aoFechar, children }: { visivel: boolean; aoFechar: () => void; children: ReactNode }) {
  // A folha sobe inteira com o teclado (edge-to-edge: a janela não encolhe).
  const alturaDoTeclado = useAlturaDoTeclado();
  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={aoFechar} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: alturaDoTeclado }}>
        <Pressable style={{ ...StyleSheetAbsolute, backgroundColor: "rgba(11,25,41,0.55)" }} onPress={aoFechar} accessibilityLabel="Fechar" />
        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: CORES.fundo, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: Dimensions.get("window").height * 0.92 - alturaDoTeclado }}>
          <View style={{ alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: CORES.linhaForte, marginTop: 10 }} />
          <RolagemComTeclado semFolgaDoTeclado contentContainerStyle={{ padding: 22, gap: 14 }} keyboardShouldPersistTaps="handled">
            {children}
          </RolagemComTeclado>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const StyleSheetAbsolute = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;

/** Uma linha «rótulo — valor», com a ligação «Alterar» à direita quando há. */
export function LinhaDoResumo({ rotulo, valor, aoAlterar }: { rotulo: string; valor: string; aoAlterar?: () => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: CORES.linha }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: CORES.suave, fontSize: 12.5 }}>{rotulo}</Text>
        <Text style={{ color: CORES.tinta, fontSize: 14.5 }}>{valor}</Text>
      </View>
      {aoAlterar ? <Ligacao titulo="Alterar" aoCarregar={aoAlterar} /> : null}
    </View>
  );
}
