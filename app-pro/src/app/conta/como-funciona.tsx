import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { RolagemComTeclado } from "../../componentes/Teclado";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Caixa, TituloDaCaixa } from "../../componentes/ui";
import { useConta } from "../../estado/Conta";
import { faltasEm, type SeccaoComFalta } from "../../lib/conta";
import {
  COMO_RECEBE,
  O_QUE_A_CLYON_NAO_FAZ,
  PASSOS_DO_PROFISSIONAL,
} from "../../../../src/lib/como-funciona-para-o-profissional";
import { ESPACO, LETRA, RAIO, useCores } from "../../tema";

/**
 * COMO FUNCIONA — o mesmo texto do painel, do mesmo ficheiro do site. Um passo
 * que depende de uma secção do perfil por preencher diz o que falta e leva lá.
 */
const ECRA: Record<SeccaoComFalta, string> = {
  dados: "/conta/perfil",
  servicos: "/conta/servicos",
  faturacao: "/conta/faturacao",
  banco: "/conta/banco",
};

export default function ComoFunciona() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const { perfil } = useConta();

  return (
    <RolagemComTeclado style={{ backgroundColor: c.fundo }} contentContainerStyle={[estilos.pagina, { paddingBottom: margens.bottom + ESPACO.xxl }]}>
      {PASSOS_DO_PROFISSIONAL.map((p, i) => {
        const faltas = perfil && p.seccao ? faltasEm(perfil, p.seccao) : [];
        return (
          <Caixa key={p.chave}>
            <View style={estilos.passo}>
              <View style={[estilos.numero, { backgroundColor: c.marcaSuave }]}>
                <Text style={{ color: c.marca, fontWeight: "800" }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: c.tinta, fontWeight: "800", fontSize: LETRA.media }}>{p.titulo}</Text>
            </View>
            <Text style={{ color: c.tinta, lineHeight: 22 }}>{p.texto}</Text>
            {faltas.length > 0 && p.seccao ? (
              <Text
                onPress={() => router.push(ECRA[p.seccao!] as never)}
                accessibilityRole="button"
                style={{ color: c.aviso, fontWeight: "700", lineHeight: 20 }}
              >
                Falta preencher: {faltas.map((f) => f.rotulo.toLowerCase()).join(", ")}. Preencher ›
              </Text>
            ) : null}
          </Caixa>
        );
      })}

      <Caixa>
        <TituloDaCaixa>Como recebe</TituloDaCaixa>
        {COMO_RECEBE.map((r) => (
          <View key={r.forma} style={{ gap: 2 }}>
            <Text style={{ color: c.tinta, fontWeight: "700" }}>{r.forma}</Text>
            <Text style={{ color: c.suave, lineHeight: 21 }}>{r.texto}</Text>
          </View>
        ))}
      </Caixa>

      <Caixa>
        <TituloDaCaixa>O que a CLYON não faz</TituloDaCaixa>
        {O_QUE_A_CLYON_NAO_FAZ.map((t) => (
          <View key={t} style={estilos.item}>
            <Text style={{ color: c.marca }}>•</Text>
            <Text style={{ flex: 1, color: c.tinta, lineHeight: 21 }}>{t}</Text>
          </View>
        ))}
      </Caixa>
    </RolagemComTeclado>
  );
}

const estilos = StyleSheet.create({
  pagina: { padding: ESPACO.l, gap: ESPACO.m },
  passo: { flexDirection: "row", alignItems: "center", gap: ESPACO.s },
  numero: { width: 30, height: 30, borderRadius: RAIO.l, alignItems: "center", justifyContent: "center" },
  item: { flexDirection: "row", gap: ESPACO.s },
});
