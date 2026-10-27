import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Botao } from "../../componentes/ui";
import { Text } from "../../componentes/Texto";
import { useSessao } from "../../estado/Sessao";
import { CORES } from "../../tema";

/**
 * Depois de entrar. Os pedidos, o novo pedido e a conta (E2–E11) chegam
 * com as rotas R4–R9 do site; por agora diz com que conta se entrou e deixa
 * sair.
 */
export default function Inicio() {
  const { email, sair } = useSessao();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }}>
      <View style={{ flex: 1, padding: 24, gap: 18 }}>
        <Text style={{ color: CORES.tinta, fontSize: 28, fontWeight: "800", marginTop: 24 }}>CLYON</Text>
        {email ? (
          <Text style={{ color: CORES.suave, fontSize: 16 }} numberOfLines={1}>
            Entrou como {email}
          </Text>
        ) : null}
        <Botao titulo="Sair" tipo="secundario" aoCarregar={() => void sair()} />
      </View>
    </SafeAreaView>
  );
}
