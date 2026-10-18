import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Botao, Etiqueta } from "../../componentes/ui";
import { useTrabalhos } from "../../estado/Trabalhos";
import {
  agendaDe,
  duracaoDe,
  euros,
  horaNaAgenda,
  linkDoCalendario,
  servicoDe,
  type Trabalho,
} from "../../lib/trabalhos";
import { duracaoPorExtenso } from "../../../../src/lib/agenda-em-grelha";
import { ESPACO, LETRA, RAIO, useCores } from "../../tema";

/**
 * A AGENDA — fase 4, 18-10-2026. A vista «Lista» da agenda do painel, que é a
 * que cabe num telemóvel: os trabalhos que são dele e estão por fazer, pelo
 * dia em Lisboa, e à parte os que ainda não têm dia. Tocar num abre o
 * trabalho, onde se marca ou muda o dia, a hora e quanto tempo leva.
 */
export default function AgendaDoProfissional() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const { trabalhos, recarregar } = useTrabalhos();
  const [aLer, setALer] = useState(false);
  const agenda = agendaDe(trabalhos);
  const vazia = agenda.semData.length === 0 && agenda.dias.length === 0;

  async function puxar() {
    setALer(true);
    await recarregar();
    setALer(false);
  }

  return (
    <ScrollView
      style={{ backgroundColor: c.fundo }}
      contentContainerStyle={[estilos.pagina, { paddingTop: margens.top + ESPACO.l, paddingBottom: margens.bottom + ESPACO.xxl }]}
      refreshControl={<RefreshControl refreshing={aLer} onRefresh={() => void puxar()} tintColor={c.marca} colors={[c.marca]} />}
    >
      <View style={estilos.cabeca}>
        <Text style={[estilos.titulo, { color: c.tinta }]}>Agenda</Text>
        {agenda.marcados > 0 ? (
          <Text style={{ color: c.suave, fontSize: LETRA.normal }}>
            {agenda.marcados} marcado{agenda.marcados === 1 ? "" : "s"}
          </Text>
        ) : null}
      </View>

      {vazia ? (
        <View style={{ gap: ESPACO.m, alignItems: "center", marginTop: ESPACO.xl }}>
          <Text style={{ color: c.suave, fontSize: LETRA.normal, textAlign: "center", lineHeight: 22 }}>
            Nada agendado. Os trabalhos que forem seus aparecem aqui, pelo dia.
          </Text>
          <Botao titulo="Ver os meus trabalhos" tipo="secundario" aoCarregar={() => router.navigate("/" as never)} />
        </View>
      ) : null}

      {agenda.semData.length > 0 ? (
        <View style={{ gap: ESPACO.s }}>
          <Text style={[estilos.dia, { color: c.aviso }]}>Sem data marcada ({agenda.semData.length})</Text>
          <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>Combine com o cliente e marque o dia no trabalho.</Text>
          {agenda.semData.map((t) => (
            <CartaoDaAgenda key={t.negociacaoId} t={t} />
          ))}
        </View>
      ) : null}

      {agenda.dias.map((d) => (
        <View key={d.dia} style={{ gap: ESPACO.s }}>
          <View style={estilos.cabecaDoDia}>
            <Text style={[estilos.dia, { color: d.passou ? c.mau : c.tinta }]}>{d.rotulo}</Text>
            {d.passou ? <Etiqueta texto="Já passou o dia" tom="mau" /> : null}
          </View>
          {d.trabalhos.map((t) => (
            <CartaoDaAgenda key={t.negociacaoId} t={t} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function CartaoDaAgenda({ t }: { t: Trabalho }) {
  const c = useCores();
  const hora = horaNaAgenda(t);
  const calendario = linkDoCalendario(t);
  const ligar = t.contactoTelefone?.replace(/[^\d+]/g, "");
  return (
    <Pressable
      onPress={() => router.push(`/trabalho/${t.negociacaoId}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`${servicoDe(t)}, ${hora ?? "sem hora"}`}
      style={({ pressed }) => [estilos.cartao, { backgroundColor: c.superficie, borderColor: c.linha, opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={[estilos.hora, { backgroundColor: c.marcaSuave }]}>
        <Text style={{ color: c.marca, fontWeight: "800", fontSize: LETRA.media }}>{hora ?? "—"}</Text>
        <Text style={{ color: c.marca, fontSize: 11 }}>{duracaoPorExtenso(duracaoDe(t))}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: c.tinta, fontWeight: "700", fontSize: LETRA.normal }}>
          {servicoDe(t)}
        </Text>
        <Text numberOfLines={1} style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>
          {[t.contactoNome, t.morada ?? t.city].filter(Boolean).join(" · ")}
        </Text>
        <View style={estilos.linhaDeBaixo}>
          {t.recebeSeFechado != null ? (
            <Text style={{ color: c.bom, fontWeight: "800", fontSize: LETRA.pequena + 1 }}>{euros(t.recebeSeFechado)}</Text>
          ) : null}
          {!t.dataCombinada && t.dataAgendada ? (
            <Text style={{ color: c.aviso, fontSize: LETRA.pequena }}>dia pedido pelo cliente</Text>
          ) : null}
        </View>
      </View>
      <View style={{ gap: ESPACO.s }}>
        {ligar ? (
          <Pressable
            onPress={() => void Linking.openURL(`tel:${ligar}`)}
            accessibilityRole="button"
            accessibilityLabel="Ligar ao cliente"
            hitSlop={6}
          >
            <Ionicons name="call-outline" size={22} color={c.marca} />
          </Pressable>
        ) : null}
        {calendario ? (
          <Pressable
            onPress={() => void Linking.openURL(calendario)}
            accessibilityRole="button"
            accessibilityLabel="Pôr no calendário do telemóvel"
            hitSlop={6}
          >
            <Ionicons name="calendar-number-outline" size={22} color={c.marca} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pagina: { paddingHorizontal: ESPACO.l, gap: ESPACO.l },
  cabeca: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  titulo: { fontSize: LETRA.grande, fontWeight: "800" },
  cabecaDoDia: { flexDirection: "row", alignItems: "center", gap: ESPACO.s },
  dia: { fontSize: LETRA.media, fontWeight: "800" },
  cartao: { flexDirection: "row", alignItems: "center", gap: ESPACO.m, borderWidth: 1, borderRadius: RAIO.l, padding: ESPACO.m },
  hora: { width: 64, minHeight: 56, borderRadius: RAIO.m, alignItems: "center", justifyContent: "center" },
  linhaDeBaixo: { flexDirection: "row", alignItems: "center", gap: ESPACO.s },
});
