import { View } from "react-native";
import { Text } from "./Texto";
import type { TextosDoPreco } from "../lib/pedidos";
import { CORES } from "../tema";

/**
 * UM PREÇO, TAL COMO A API O ESCREVE (regras 1–3).
 *
 * Grande, o que se paga (`principal`, com o imposto incluído). Pequeno, de que
 * é feito (`detalhe` — o sem imposto vem sempre na mesma frase que o com
 * imposto, nunca sozinho). Logo por baixo, sempre, a nota da unidade (`nota`:
 * pelo trabalho todo, por carga ou por hora). A app não faz contas.
 */
export function Preco({ preco, tamanho = "grande" }: { preco: TextosDoPreco; tamanho?: "grande" | "medio" }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: CORES.tinta, fontSize: tamanho === "grande" ? 24 : 18, fontWeight: "800" }}>{preco.principal}</Text>
      {preco.detalhe ? <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 18 }}>{preco.detalhe}</Text> : null}
      {preco.nota ? <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 18 }}>{preco.nota}</Text> : null}
    </View>
  );
}
