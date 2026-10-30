import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import { RolagemComTeclado } from "../../componentes/Teclado";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Caixa } from "../../componentes/ui";
import { useConta } from "../../estado/Conta";
import { diaCurto, distincoesDoPerfil, FICHA_DA_DISTINCAO, mediaCurta } from "../../lib/conta";
import { ESPACO, LETRA, useCores } from "../../tema";

/**
 * AS AVALIAÇÕES — a média, as distinções (as mesmas regras do painel) e o que
 * os clientes escreveram. Anónimas, como no painel: «Cliente · data».
 */
export default function Avaliacoes() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const { perfil } = useConta();
  if (!perfil) return <View style={{ flex: 1, backgroundColor: c.fundo }} />;
  const media = mediaCurta(perfil.avaliacao);
  const { distincoes, faltamParaACoroa } = distincoesDoPerfil(perfil);

  return (
    <RolagemComTeclado style={{ backgroundColor: c.fundo }} contentContainerStyle={[estilos.pagina, { paddingBottom: margens.bottom + ESPACO.xxl }]}>
      <Caixa>
        <View style={estilos.linha}>
          <Ionicons name="star" size={28} color={c.aviso} />
          <Text style={{ color: c.tinta, fontSize: 30, fontWeight: "800" }}>{media ?? "—"}</Text>
          <Text style={{ color: c.suave }}>
            {perfil.quantasAvaliacoes} avaliaç{perfil.quantasAvaliacoes === 1 ? "ão" : "ões"} · {perfil.trabalhosConcluidos} trabalhos feitos
          </Text>
        </View>
        {distincoes.map((d) => (
          <View key={d} style={estilos.distincao}>
            <Text style={{ fontSize: 20 }}>{FICHA_DA_DISTINCAO[d].simbolo}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.tinta, fontWeight: "700" }}>{FICHA_DA_DISTINCAO[d].titulo}</Text>
              <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>{FICHA_DA_DISTINCAO[d].porque}</Text>
            </View>
          </View>
        ))}
        {faltamParaACoroa != null && faltamParaACoroa > 0 ? (
          <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>
            Falta{faltamParaACoroa === 1 ? "" : "m"} {faltamParaACoroa} avaliaç{faltamParaACoroa === 1 ? "ão" : "ões"} para ganhar a coroa 👑.
          </Text>
        ) : null}
      </Caixa>

      {perfil.ultimasAvaliacoes.length === 0 ? (
        <Text style={{ color: c.suave, textAlign: "center" }}>Ainda sem avaliações. A primeira chega no fim do primeiro trabalho.</Text>
      ) : (
        perfil.ultimasAvaliacoes.map((a, i) => (
          <Caixa key={`${a.em}-${i}`}>
            <View style={estilos.linha}>
              {Array.from({ length: 5 }, (_, k) => (
                <Ionicons key={k} name={k < a.estrelas ? "star" : "star-outline"} size={16} color={c.aviso} />
              ))}
              <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>Cliente · {diaCurto(a.em) ?? ""}</Text>
            </View>
            {a.comentario ? <Text style={{ color: c.tinta, lineHeight: 21 }}>«{a.comentario}»</Text> : null}
          </Caixa>
        ))
      )}
    </RolagemComTeclado>
  );
}

const estilos = StyleSheet.create({
  pagina: { padding: ESPACO.l, gap: ESPACO.m },
  linha: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  distincao: { flexDirection: "row", alignItems: "center", gap: ESPACO.s },
});
