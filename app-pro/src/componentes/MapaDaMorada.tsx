import { useEffect, useState } from "react";
import { Image, Linking, Pressable, StyleSheet } from "react-native";
import { SITE } from "../lib/api";
import { EM_DEMO } from "../lib/demo";
import { lerToken } from "../lib/sessao";
import { caminhoDoMapa } from "../lib/trabalhos";
import { RAIO, useCores } from "../tema";

/**
 * O MAPA DA MORADA, ANTES DA MORADA — 29-10-2026 (A13; B2, linha 50).
 *
 * O mesmo do painel: uma imagem estática servida pelo site (`/api/mapa`), para
 * a chave da Google não sair do servidor. A rota quer a sessão, e por isso a
 * imagem vai com o token no cabeçalho. Sem chave, sem rede ou sem morada, o
 * bloco some — o ecrã funciona na mesma sem ele. Um toque abre a morada no
 * Google Maps, como no painel.
 */
export function MapaDaMorada({ morada }: { morada: string | null }) {
  const c = useCores();
  const caminho = caminhoDoMapa(morada);
  const [token, setToken] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    void lerToken()
      .then((t) => {
        if (vivo) setToken(t);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (!caminho || !morada || falhou || !token || EM_DEMO) return null;
  return (
    <Pressable
      onPress={() => void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(morada)}`)}
      accessibilityRole="link"
      accessibilityLabel="Abrir a morada no mapa"
    >
      <Image
        source={{ uri: `${SITE}${caminho}`, headers: { Authorization: `Bearer ${token}` } }}
        onError={() => setFalhou(true)}
        resizeMode="cover"
        style={[estilos.mapa, { backgroundColor: c.marcaSuave }]}
      />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  mapa: { width: "100%", height: 144, borderRadius: RAIO.m },
});
