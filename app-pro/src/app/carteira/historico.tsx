import { StyleSheet, View } from "react-native";
import { RolagemComTeclado } from "../../componentes/Teclado";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Caixa } from "../../componentes/ui";
import { LinhaDoMovimento } from "../../componentes/LinhaDoMovimento";
import { useConta } from "../../estado/Conta";
import { movimentosPorMes } from "../../lib/conta";
import { euros } from "../../lib/trabalhos";
import { ESPACO, LETRA, useCores } from "../../tema";

/** O HISTÓRICO DA CARTEIRA — mês a mês, o mais recente em cima, com o total de cada mês (como no painel). */
export default function Historico() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const { carteira } = useConta();
  const meses = movimentosPorMes(carteira?.movimentos ?? []);

  return (
    <RolagemComTeclado
      style={{ backgroundColor: c.fundo }}
      contentContainerStyle={[estilos.pagina, { paddingBottom: margens.bottom + ESPACO.xxl }]}
    >
      {meses.length === 0 ? (
        <Text style={{ color: c.suave, textAlign: "center", marginTop: ESPACO.xl }}>Ainda não há movimentos na carteira.</Text>
      ) : null}
      {meses.map((m) => (
        <Caixa key={m.mes}>
          <View style={estilos.cabeca}>
            <Text style={{ flex: 1, color: c.tinta, fontWeight: "800", fontSize: LETRA.media }}>{m.rotulo}</Text>
            <Text style={{ color: m.total < 0 ? c.mau : c.bom, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
              {m.total < 0 ? "−" : "+"}
              {euros(Math.abs(m.total))}
            </Text>
          </View>
          {m.movimentos.map((mov, i) => (
            <LinhaDoMovimento key={`${mov.tipo}-${mov.id}`} m={mov} ultima={i === m.movimentos.length - 1} />
          ))}
        </Caixa>
      ))}
    </RolagemComTeclado>
  );
}

const estilos = StyleSheet.create({
  pagina: { padding: ESPACO.l, gap: ESPACO.l },
  cabeca: { flexDirection: "row", alignItems: "center", gap: ESPACO.s },
});
