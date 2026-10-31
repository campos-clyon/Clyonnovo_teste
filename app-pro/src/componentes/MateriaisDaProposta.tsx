import { Pressable, StyleSheet, View } from "react-native";
import { Text, TextInput } from "./Texto";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";
import {
  MATERIAIS_A_PARTE,
  MATERIAIS_DE_PARTIDA,
  MATERIAIS_INCLUIDOS,
  MAXIMO_DE_MATERIAIS,
  PERGUNTA_DOS_MATERIAIS,
} from "../../../src/lib/materiais-da-proposta";
import type { EscolhaDosMateriais } from "../lib/materiais";

/**
 * OS MATERIAIS NA PROPOSTA — 31-10-2026. A pergunta do painel: o valor já
 * inclui os materiais? Sem eles, o preço de cada um (sem IVA, como o valor),
 * com os da tabela das mudanças já escritos, e «+ Outro». O que fica vai no
 * POST da proposta (`materiaisParaEnviar`).
 */
export function MateriaisDaProposta({
  escolha,
  aoMudar,
}: {
  escolha: EscolhaDosMateriais;
  aoMudar: (e: EscolhaDosMateriais) => void;
}) {
  const c = useCores();
  const opcao = (titulo: string, valor: boolean) => {
    const escolhida = escolha.incluidos === valor;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: escolhida }}
        onPress={() => aoMudar({ ...escolha, incluidos: valor })}
        style={({ pressed }) => [
          estilos.opcao,
          { borderColor: escolhida ? c.marca : c.linha, backgroundColor: escolhida ? c.marcaSuave : "transparent", opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={{ color: escolhida ? c.marca : c.tinta, fontWeight: "700" }} numberOfLines={1}>
          {titulo}
        </Text>
      </Pressable>
    );
  };
  const campo = (valor: string, aoEscrever: (v: string) => void, rotulo: string, largo = false) => (
    <TextInput
      value={valor}
      onChangeText={aoEscrever}
      keyboardType={largo ? "default" : "decimal-pad"}
      placeholder={largo ? "Nome" : "0,00"}
      placeholderTextColor={c.suave}
      accessibilityLabel={rotulo}
      style={[estilos.campo, largo ? { flex: 1 } : { width: 90 }, { borderColor: c.linha, color: c.tinta, backgroundColor: c.fundo }]}
    />
  );
  return (
    <View style={{ gap: ESPACO.s }}>
      <Text style={{ color: c.tinta, fontWeight: "600" }}>{PERGUNTA_DOS_MATERIAIS}</Text>
      <View style={{ flexDirection: "row", gap: ESPACO.s }}>
        {opcao(`Sim — ${MATERIAIS_INCLUIDOS.toLowerCase()}`, true)}
        {opcao(`Não — ${MATERIAIS_A_PARTE.toLowerCase()}`, false)}
      </View>
      {escolha.incluidos === false ? (
        <View style={{ gap: ESPACO.s }}>
          <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>Preço de cada um, sem IVA — o cliente vê-o com o IVA ao lado.</Text>
          {MATERIAIS_DE_PARTIDA.map((m) => (
            <View key={m.id} style={estilos.linha}>
              <Text style={{ flex: 1, color: c.tinta }} numberOfLines={1}>
                {m.nome} (€/{m.unidade})
              </Text>
              {campo(escolha.precos[m.id] ?? "", (v) => aoMudar({ ...escolha, precos: { ...escolha.precos, [m.id]: v } }), `Preço de ${m.nome}`)}
            </View>
          ))}
          {escolha.outros.map((o, i) => (
            <View key={i} style={estilos.linha}>
              {campo(o.nome, (v) => aoMudar({ ...escolha, outros: escolha.outros.map((x, j) => (j === i ? { ...x, nome: v } : x)) }), "Nome do material", true)}
              {campo(o.preco, (v) => aoMudar({ ...escolha, outros: escolha.outros.map((x, j) => (j === i ? { ...x, preco: v } : x)) }), "Preço do material")}
            </View>
          ))}
          {MATERIAIS_DE_PARTIDA.length + escolha.outros.length < MAXIMO_DE_MATERIAIS ? (
            <Text
              accessibilityRole="button"
              onPress={() => aoMudar({ ...escolha, outros: [...escolha.outros, { nome: "", preco: "", unidade: "unidade" }] })}
              style={{ color: c.marca, fontWeight: "700" }}
            >
              + Outro
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  opcao: { flex: 1, borderWidth: 1, borderRadius: RAIO.m, paddingVertical: 10, paddingHorizontal: ESPACO.s, alignItems: "center" },
  linha: { flexDirection: "row", alignItems: "center", gap: ESPACO.s },
  campo: { borderWidth: 1, borderRadius: RAIO.m, paddingHorizontal: ESPACO.s, minHeight: 44, fontSize: LETRA.normal },
});
