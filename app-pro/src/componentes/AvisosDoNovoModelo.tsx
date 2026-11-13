import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Text } from "./Texto";
import { Mensagem } from "./ui";
import { useConta } from "../estado/Conta";
import { avisoDosDadosParaReceber } from "../lib/novo-modelo";
import { ESPACO, LETRA, useCores } from "../tema";

/**
 * O MODELO DE 15-11-2026 À ENTRADA — d10, os mesmos dois avisos do painel
 * (`PainelDoProfissional.tsx`):
 *
 *   · STAND-BY (um valor em atraso há mais de 4 dias): continua a ver os
 *     pedidos; diz-se porquê, e um toque leva à carteira, onde paga.
 *   · OS DADOS PARA RECEBER (IBAN, titular, MB WAY, regime de IVA): o aviso até
 *     22-11 ou o impedimento; um toque leva ao perfil.
 *
 * Só com o `novoModelo` da carteira, que o site manda a partir de 15-11: antes
 * da data este componente não desenha nada.
 */
export function AvisosDoNovoModelo() {
  const c = useCores();
  const { carteira } = useConta();
  const nm = carteira?.novoModelo;
  if (!nm) return null;
  const dados = avisoDosDadosParaReceber(nm.dadosParaReceber);
  if (!nm.standBy && !dados) return null;
  return (
    <View style={{ gap: ESPACO.s, marginBottom: ESPACO.s }}>
      {nm.standBy ? (
        <Pressable onPress={() => router.push("/carteira")} accessibilityRole="button" accessibilityLabel={nm.standBy.accao}>
          <View style={{ gap: 4, borderRadius: 12, padding: ESPACO.m, backgroundColor: c.mauSuave }}>
            <Text style={{ color: c.mau, fontWeight: "800", fontSize: LETRA.normal }}>{nm.standBy.accao}</Text>
            <Text style={{ color: c.mau, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{nm.standBy.explicacao}</Text>
          </View>
        </Pressable>
      ) : null}
      {dados ? (
        <Pressable onPress={() => router.push(dados.destino as never)} accessibilityRole="button">
          <Mensagem tom={dados.impede ? "mau" : "aviso"} texto={dados.frase} />
        </Pressable>
      ) : null}
    </View>
  );
}
