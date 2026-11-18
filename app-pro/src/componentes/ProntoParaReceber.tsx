import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Text } from "./Texto";
import { abrirOsTermos } from "./AceitarOsTermos";
import type { LinhaDoProntoParaReceber, ProntoParaReceber as Cartao } from "../../../src/lib/pronto-para-receber";
import { ESPACO, LETRA, RAIO, useCores, type Cores } from "../tema";

/**
 * «PRONTO PARA RECEBER PEDIDOS» — d1 (CEO e dono, 18-11-2026), o mesmo cartão
 * do painel (`ProntoParaReceber.tsx` do site). Um só cartão no Início, linha a
 * linha: os Termos, o IBAN e o titular, o MB WAY, o regime de IVA e — a quem
 * faz entulho — a guia. A lista vem pronta do servidor
 * (`novoModelo.prontoParaReceber` da carteira): este ecrã só a desenha e leva
 * cada linha ao seu ecrã (`app` da linha; `null` = o ecrã dos Termos).
 * Sem pílula nem ícone por cima do título; desaparece quando está tudo feito.
 */
export function ProntoParaReceber({ cartao }: { cartao: Cartao | null | undefined }) {
  const c = useCores();
  if (!cartao || cartao.pronto) return null;
  const impede = !cartao.podePropor;
  return (
    <View
      style={{
        gap: ESPACO.xs,
        borderRadius: RAIO.l,
        borderWidth: 1,
        padding: ESPACO.m,
        borderColor: impede ? c.mau : c.aviso,
        backgroundColor: impede ? c.mauSuave : c.avisoSuave,
      }}
    >
      <Text accessibilityRole="header" style={{ color: c.tinta, fontWeight: "800", fontSize: LETRA.normal }}>
        {cartao.titulo}
      </Text>
      <Text style={{ color: impede ? c.mau : c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{cartao.resumo}</Text>
      <View style={{ marginTop: ESPACO.xs }}>
        {cartao.linhas.map((l) => (
          <Linha key={l.id} l={l} c={c} />
        ))}
      </View>
    </View>
  );
}

function abrir(l: LinhaDoProntoParaReceber): void {
  if (l.app) router.push(l.app as never);
  else abrirOsTermos();
}

function Icone({ l, c }: { l: LinhaDoProntoParaReceber; c: Cores }) {
  if (l.estado === "feito") return <Ionicons name="checkmark-circle" size={18} color={c.bom} />;
  if (l.estado === "opcional") return <Ionicons name="ellipse-outline" size={18} color={c.suave} />;
  if (l.estado === "por_verificar") return <Ionicons name="time-outline" size={18} color={c.aviso} />;
  return <Ionicons name="alert-circle" size={18} color={l.impede ? c.mau : c.aviso} />;
}

function Linha({ l, c }: { l: LinhaDoProntoParaReceber; c: Cores }) {
  const corpo = (
    <>
      <View style={{ paddingTop: 2 }}>
        <Icone l={l} c={c} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.tinta, fontWeight: "700", fontSize: LETRA.normal }}>{l.rotulo}</Text>
        <Text style={{ color: l.impede ? c.mau : c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>{l.detalhe}</Text>
        {l.botao ? <Text style={{ color: c.marca, fontWeight: "700", fontSize: LETRA.pequena + 1 }}>{l.botao}</Text> : null}
      </View>
      {l.botao ? <Ionicons name="chevron-forward" size={18} color={c.suave} style={{ paddingTop: 2 }} /> : null}
    </>
  );
  const linha = { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: ESPACO.s, paddingVertical: ESPACO.s };
  if (!l.botao) return <View style={linha}>{corpo}</View>;
  return (
    <Pressable
      onPress={() => abrir(l)}
      accessibilityRole="button"
      accessibilityLabel={`${l.rotulo}: ${l.botao}`}
      style={({ pressed }) => [linha, { opacity: pressed ? 0.6 : 1 }]}
    >
      {corpo}
    </Pressable>
  );
}
