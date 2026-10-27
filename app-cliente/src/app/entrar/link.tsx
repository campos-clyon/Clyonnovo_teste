import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Aviso, Botao } from "../../componentes/ui";
import { Text } from "../../componentes/Texto";
import { useSessao } from "../../estado/Sessao";
import { ErroDaApi, pedir } from "../../lib/api";
import { CORES } from "../../tema";

/**
 * O LINK DO EMAIL ABRE A APP — `https://clyon.pt/entrar/link?t=…` (d8).
 *
 * O `t` troca-se por uma sessão da app em `POST /api/cliente/entrar`
 * `{ linkToken }` (R1). O link serve uma vez e dura 15 minutos; se já foi
 * usado ou expirou, mostra-se a frase do site tal como vem no erro.
 */
export default function EntrarPeloLink() {
  const { t } = useLocalSearchParams<{ t?: string }>();
  const { entrarComToken } = useSessao();
  const [erro, setErro] = useState<string | null>(null);
  const feito = useRef(false);

  useEffect(() => {
    if (feito.current) return;
    feito.current = true;
    const token = typeof t === "string" ? t : "";
    if (!token) {
      setErro("Este link não está completo. Peça um novo.");
      return;
    }
    (async () => {
      try {
        const r = await pedir<{ token: string; email: string }>("/api/cliente/entrar", {
          metodo: "POST",
          corpo: { linkToken: token },
          semSessao: true,
        });
        await entrarComToken(r.token, r.email);
        router.replace("/");
      } catch (e) {
        setErro(e instanceof ErroDaApi ? e.message : "Não foi possível entrar agora. Tente outra vez.");
      }
    })();
  }, [t, entrarComToken]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }}>
      <View style={{ flex: 1, padding: 24, gap: 18, justifyContent: "center" }}>
        {erro ? (
          <>
            <Text style={{ color: CORES.tinta, fontSize: 24, fontWeight: "800" }}>Entrar na CLYON</Text>
            <Aviso texto={erro} tom="mau" />
            <Botao titulo="Voltar à entrada" aoCarregar={() => router.replace("/entrar")} />
          </>
        ) : (
          <>
            <ActivityIndicator color={CORES.marca} size="large" />
            <Text style={{ color: CORES.suave, fontSize: 16, textAlign: "center" }}>A entrar…</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
