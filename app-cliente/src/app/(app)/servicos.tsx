import { router } from "expo-router";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CartaoDoWhatsapp } from "../../componentes/Informacao";
import { CartaoDoServico } from "../../componentes/Servicos";
import { Text } from "../../componentes/Texto";
import { Aviso, Botao, Carregando, Ligacao, Titulo } from "../../componentes/ui";
import { useCatalogo } from "../../estado/Catalogo";
import { CORES } from "../../tema";

/** SERVIÇOS (maqueta 2, v3): um cartão por serviço do simulador — ver componentes/Servicos.tsx. */
export default function Servicos() {
  const { catalogo, aLer, erro, recarregar } = useCatalogo();
  if (!catalogo && aLer) return <Carregando />;
  if (!catalogo) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo, padding: 20, gap: 14 }}>
        <Titulo>Serviços</Titulo>
        <Aviso texto={erro ?? "Não foi possível ler os serviços. Tente outra vez daqui a pouco."} tom="mau" />
        <Botao titulo="Tentar outra vez" aoCarregar={recarregar} />
      </SafeAreaView>
    );
  }
  const grupos = catalogo.info.precos?.grupos ?? [];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}>
        <Titulo>Serviços</Titulo>
        {catalogo.textos.notaDosPrecos ? <Text style={{ color: CORES.suave, fontSize: 14, lineHeight: 21 }}>{catalogo.textos.notaDosPrecos}</Text> : null}
        {catalogo.servicos.map((s) => (
          <CartaoDoServico key={s.id} s={s} grupos={grupos.filter((g) => g.servico === s.id)} />
        ))}
        {grupos.length > 0 ? <Ligacao titulo="Ver todos os preços de referência" aoCarregar={() => router.push("/info/precos")} /> : null}
        <CartaoDoWhatsapp horario={catalogo.textos.horarioDoWhatsapp} />
      </ScrollView>
    </SafeAreaView>
  );
}
