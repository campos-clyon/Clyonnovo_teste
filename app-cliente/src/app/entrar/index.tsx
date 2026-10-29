import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Entrada } from "../../componentes/Entrada";
import { Text } from "../../componentes/Texto";
import { Aviso, Paragrafo, Titulo } from "../../componentes/ui";
import { useCatalogo } from "../../estado/Catalogo";
import { useSessao } from "../../estado/Sessao";
import { abrirNoNavegador } from "../../lib/abrir";
import { seguirDepoisDeEntrar } from "../../lib/depois-de-entrar";
import { lerDepoisDeEntrar, lerRascunho, type DepoisDeEntrar } from "../../lib/guardado";
import { servicoDe } from "../../lib/novo-pedido";
import { CORES } from "../../tema";

/**
 * E1 v3 — ENTRAR (maqueta 5, 29-10-2026): o Google num toque, ou o link por
 * email (ver `componentes/Entrada.tsx`). Quem chega de outro ecrã volta a ele
 * depois de entrar: com o Google logo aqui; com o link do email, pelo E1a,
 * que lê para onde voltar do que ficou guardado no telemóvel.
 *
 * Com um rascunho guardado, o cartão «O seu pedido está guardado» lembra que
 * não se perde nada.
 */
export default function Entrar() {
  const { aviso } = useSessao();
  const { catalogo } = useCatalogo();
  const params = useLocalSearchParams<{ email?: string; para?: string; pedidoId?: string }>();
  const [depois, setDepois] = useState<DepoisDeEntrar | undefined>(undefined);
  const [guardado, setGuardado] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const id = Number(params.pedidoId);
      if (params.para === "juntar" && Number.isInteger(id) && id > 0) setDepois({ para: "juntar", pedidoId: id });
      else if (params.para === "resumo") setDepois({ para: "resumo" });
      else setDepois((await lerDepoisDeEntrar()) ?? { para: "pedidos" });
      const r = await lerRascunho();
      if (r?.servico && catalogo) {
        const s = servicoDe(r, catalogo);
        if (s) setGuardado([s.nome, r.morada?.formattedAddress].filter(Boolean).join(" · "));
      }
    })();
  }, [params.para, params.pedidoId, catalogo]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Titulo>Entrar na CLYON</Titulo>
          <Paragrafo suave>Entre para enviar pedidos e receber as propostas no telemóvel.</Paragrafo>
          {aviso ? <Aviso texto={aviso.texto} tom={aviso.tom} /> : null}
          {guardado && depois?.para === "resumo" ? (
            <View style={{ borderRadius: 18, backgroundColor: CORES.marcaSuave, padding: 14, gap: 4 }}>
              <Text titulo style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>
                O seu pedido está guardado
              </Text>
              <Text style={{ color: CORES.suave, fontSize: 13.5 }}>{`${guardado}. Falta só enviar.`}</Text>
            </View>
          ) : null}
          {depois ? (
            <Entrada depois={depois} emailInicial={typeof params.email === "string" ? params.email : ""} aoEntrar={() => void seguirDepoisDeEntrar(depois)} />
          ) : null}
          <Text style={{ color: CORES.marca, fontSize: 13.5, textAlign: "center" }} onPress={() => abrirNoNavegador("/termos")}>
            Termos e privacidade
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
