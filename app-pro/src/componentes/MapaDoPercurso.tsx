import { useEffect, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Texto";
import { SITE } from "../lib/api";
import { EM_DEMO } from "../lib/demo";
import { mapaNoTelemovel } from "../lib/imagens-guardadas";
import { lerToken } from "../lib/sessao";
import type { PercursoParaOParceiro } from "../../../src/lib/mapa-do-percurso";
import { ESPACO, RAIO, useCores } from "../tema";

/**
 * O MAPA DO PERCURSO DE UMA MUDANÇA — 11-11-2026, o mesmo do painel.
 *
 * Uma imagem estática servida pelo site (`/api/mapa?percurso=`), pedida com o
 * token — nada nativo, a chave da Google não sai do servidor. Por baixo,
 * «X km · cerca de Y min» e «Abrir no Google Maps». Antes de ser contratado
 * só as localidades; depois, porta a porta. Sem imagem, fica a linha do texto.
 *
 * A imagem vai para uma pasta da app (`imagens-guardadas.ts`), e não para a
 * cache de imagens do sistema: apaga-se ao sair da conta.
 */
export function MapaDoPercurso({ percurso }: { percurso: PercursoParaOParceiro | null | undefined }) {
  const c = useCores();
  const [imagem, setImagem] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  const mapa = percurso?.mapa ?? null;

  useEffect(() => {
    setImagem(null);
    setFalhou(false);
    if (!mapa || EM_DEMO) return;
    let vivo = true;
    void lerToken()
      .then((token) => (token ? mapaNoTelemovel(`${SITE}${mapa}`, mapa, token) : null))
      .then((onde) => {
        if (vivo) setImagem(onde);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [mapa]);

  if (!percurso) return null;
  const direccoes = percurso.direccoes;
  return (
    <View style={{ gap: ESPACO.xs }}>
      {!falhou && imagem ? (
        <Image
          source={{ uri: imagem }}
          onError={() => setFalhou(true)}
          resizeMode="cover"
          style={[estilos.mapa, { backgroundColor: c.marcaSuave }]}
          accessibilityLabel="Mapa do percurso da mudança"
        />
      ) : null}
      <View style={estilos.lado}>
        <Text style={{ flex: 1, color: c.tinta, fontWeight: "600" }}>
          {percurso.deOndeParaOnde ? `${percurso.deOndeParaOnde} · ` : ""}
          {percurso.texto}
        </Text>
        {direccoes ? (
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(direccoes)}>
            <Text style={{ color: c.marca, fontWeight: "700" }}>Abrir no Google Maps</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  mapa: { width: "100%", height: 160, borderRadius: RAIO.m },
  lado: { flexDirection: "row", alignItems: "center", gap: ESPACO.s },
});
