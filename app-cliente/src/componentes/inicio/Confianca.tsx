import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "../Texto";
import { Seccao } from "../ui";
import { abrirNoNavegador } from "../../lib/abrir";
import type { Avaliacoes, LinhaCurta, Passo } from "../../lib/catalogo";
import { CORES } from "../../tema";

/**
 * O QUE DÁ CONFIANÇA NO INÍCIO — d148 (27-11-2026).
 *
 * Só factos, todos do servidor: os três passos curtos (`passosDoInicio`), a
 * nota do Google com quantas avaliações e o mês da contagem (a mesma fonte do
 * site, `avaliacoes-publicas.ts`), as linhas da confiança (`textos.confianca`:
 * parceiros aprovados pela equipa, pagar ao parceiro no fim do trabalho, duas faturas) e
 * algumas avaliações do Google, curtas. A app não escreve nenhuma promessa.
 */

const ICONES_DOS_PASSOS = ["camera-outline", "mail-unread-outline", "checkmark-circle-outline"] as const;
const ICONES_DA_CONFIANCA = ["shield-checkmark-outline", "card-outline", "document-text-outline"] as const;

/** Os três passos, lado a lado: o título e uma legenda curta. Sem legendas (R7 antiga), os títulos de «Como funciona». */
export function TresPassos({ passos, comoFunciona }: { passos: LinhaCurta[]; comoFunciona: Passo[] }) {
  const lista = passos.length >= 3 ? passos.slice(0, 3) : comoFunciona.slice(0, 3).map((p) => ({ titulo: p.titulo, texto: "" }));
  if (lista.length < 3) return null;
  return (
    <Seccao titulo="Como funciona" ligacao="Ver mais" aoCarregar={() => router.push("/info/como-funciona")}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {/* A linha tracejada que liga os passos, por trás das bolas. */}
        <View style={{ position: "absolute", top: 27, left: 56, right: 56, borderTopWidth: 2, borderStyle: "dashed", borderColor: CORES.cianoClaro }} />
        {lista.map((p, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", gap: 6 }} accessible accessibilityLabel={`Passo ${i + 1}: ${p.titulo}. ${p.texto}`}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: CORES.cianoFundo, borderWidth: 2, borderColor: CORES.fundo, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={ICONES_DOS_PASSOS[i]} size={25} color={CORES.marca} />
              <View style={{ position: "absolute", top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: CORES.marca, alignItems: "center", justifyContent: "center" }}>
                <Text titulo style={{ color: CORES.sobreMarca, fontSize: 11, fontWeight: "700" }}>
                  {String(i + 1)}
                </Text>
              </View>
            </View>
            <Text titulo style={{ color: CORES.tinta, fontSize: 13.5, fontWeight: "600", lineHeight: 17, textAlign: "center" }}>
              {p.titulo}
            </Text>
            {p.texto ? <Text style={{ color: CORES.suave, fontSize: 12, lineHeight: 16, textAlign: "center" }}>{p.texto}</Text> : null}
          </View>
        ))}
      </View>
    </Seccao>
  );
}

function Estrelas({ tamanho }: { tamanho: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Ionicons key={i} name="star" size={tamanho} color={CORES.estrela} />
      ))}
    </View>
  );
}

/** «4,9», as estrelas e «46 avaliações no Google (outubro de 2026)», com a ligação ao perfil; e as linhas da confiança. */
export function PorquePodeConfiar({ avaliacoes, linhas }: { avaliacoes: Avaliacoes | null; linhas: LinhaCurta[] }) {
  const comNota = avaliacoes && avaliacoes.nota && avaliacoes.numero;
  if (!comNota && linhas.length === 0) return null;
  return (
    <Seccao titulo="Porque pode confiar">
      <View style={{ borderRadius: 22, borderWidth: 1, borderColor: CORES.linha, overflow: "hidden" }}>
        {comNota ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: "#FFF8EA" }}>
            <Text titulo style={{ color: CORES.tinta, fontSize: 40, fontWeight: "700", lineHeight: 46 }}>
              {avaliacoes.nota}
            </Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Estrelas tamanho={16} />
              <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 18 }}>
                {`${avaliacoes.numero} avaliações no Google${avaliacoes.mes ? ` (${avaliacoes.mes})` : ""}. `}
                {avaliacoes.url ? (
                  <Text style={{ color: CORES.marca, fontSize: 13, fontWeight: "600" }} onPress={() => abrirNoNavegador(avaliacoes.url ?? "")} accessibilityRole="link">
                    Ver no Google
                  </Text>
                ) : null}
              </Text>
            </View>
          </View>
        ) : null}
        {linhas.map((l, i) => (
          <View key={l.titulo} style={{ flexDirection: "row", gap: 12, paddingVertical: 13, paddingHorizontal: 16, borderTopWidth: comNota || i > 0 ? 1 : 0, borderTopColor: CORES.linha }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: CORES.cianoFundo, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={ICONES_DA_CONFIANCA[i] ?? "checkmark-circle-outline"} size={19} color={CORES.marca} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text titulo style={{ color: CORES.tinta, fontSize: 14, fontWeight: "600", lineHeight: 18 }}>
                {l.titulo}
              </Text>
              <Text style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 17 }}>{l.texto}</Text>
            </View>
          </View>
        ))}
      </View>
    </Seccao>
  );
}

/**
 * As avaliações que se mostram no Início: curtas, e sem as que falam da
 * «equipa» ou dos «funcionários» — são de antes da plataforma, e o trabalho é
 * feito pelo parceiro escolhido.
 */
export function vozesParaOInicio(a: Avaliacoes | null, quantas = 5): Avaliacoes["testemunhos"] {
  if (!a) return [];
  return a.testemunhos.filter((t) => t.texto.length <= 110 && !/funcion|equipa|colaborador|pessoal|\bsr\.|enviaram|staff|team/i.test(t.texto)).slice(0, quantas);
}

export function VozesDoGoogle({ avaliacoes }: { avaliacoes: Avaliacoes | null }) {
  const vozes = vozesParaOInicio(avaliacoes);
  if (vozes.length === 0) return null;
  return (
    <Seccao titulo="O que dizem no Google" ligacao="Ver todas" aoCarregar={() => router.push("/info/avaliacoes")}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
        {vozes.map((v, i) => (
          <View key={i} style={{ width: 262, borderRadius: 18, backgroundColor: CORES.superficie, padding: 14, gap: 8 }}>
            <Estrelas tamanho={13} />
            <Text style={{ color: CORES.tinta, fontSize: 13.5, lineHeight: 19.5 }}>{`«${v.texto}»`}</Text>
            <Text style={{ color: CORES.suave, fontSize: 12 }}>{[v.nome, v.mes].filter(Boolean).join(", ")}</Text>
          </View>
        ))}
      </ScrollView>
    </Seccao>
  );
}

/** O WhatsApp, numa linha discreta. */
export function AjudaDiscreta({ aoCarregar }: { aoCarregar: () => void }) {
  return (
    <Pressable
      onPress={aoCarregar}
      accessibilityRole="button"
      accessibilityLabel="Falar com a CLYON pelo WhatsApp"
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, opacity: pressed ? 0.6 : 1 })}
    >
      <Ionicons name="logo-whatsapp" size={22} color={CORES.whatsapp} />
      <Text style={{ flex: 1, color: CORES.tinta, fontSize: 14 }}>
        {"Prefere escrever? "}
        <Text style={{ color: CORES.bom, fontSize: 14, fontWeight: "600" }}>Fale connosco no WhatsApp</Text>
      </Text>
    </Pressable>
  );
}
