import { router } from "expo-router";
import { View } from "react-native";
import { Text } from "./Texto";
import { Botao, Mensagem } from "./ui";
import { useConta } from "../estado/Conta";
import { diaCurto } from "../lib/conta";
import { euros } from "../lib/trabalhos";
import { avisoDosDadosParaReceber, COMPLETAR_O_PERFIL, faixaDoValorEmAtraso } from "../lib/novo-modelo";
import { ESPACO, LETRA, useCores } from "../tema";

/**
 * O MODELO DE 15-11-2026 À ENTRADA — d10, os mesmos avisos do painel
 * (`PainelDoProfissional.tsx`), com os botões da d18 (13-11-2026):
 *
 *   · O VALOR EM ATRASO (a taxa da plataforma e o IVA dela): o total, o prazo
 *     dos 4 dias e «Pagar o valor em atraso», que leva à carteira, onde paga.
 *   · STAND-BY (um valor por pagar há mais de 4 dias): continua a ver os
 *     pedidos; diz-se porquê, com o mesmo botão.
 *   · OS DADOS PARA RECEBER (IBAN, titular, MB WAY, regime de IVA): a faixa dos
 *     7 dias (até 22-11) ou o impedimento, com «Completar o perfil».
 *
 * Só com o `novoModelo` da carteira, que o site manda a partir de 15-11: antes
 * da data este componente não desenha nada.
 */
export function AvisosDoNovoModelo() {
  const c = useCores();
  const { carteira } = useConta();
  const nm = carteira?.novoModelo;
  if (!nm) return null;
  const valor = faixaDoValorEmAtraso(nm, euros, diaCurto);
  const dados = avisoDosDadosParaReceber(nm.dadosParaReceber);
  if (!valor && !dados) return null;
  return (
    <View style={{ gap: ESPACO.s, marginBottom: ESPACO.s }}>
      {valor ? (
        <View style={{ gap: ESPACO.s, borderRadius: 12, padding: ESPACO.m, backgroundColor: valor.standBy ? c.mauSuave : c.avisoSuave }}>
          <Text style={{ color: valor.standBy ? c.mau : c.tinta, fontWeight: "800", fontSize: LETRA.normal }}>{valor.titulo}</Text>
          <Text style={{ color: valor.standBy ? c.mau : c.tinta, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{valor.texto}</Text>
          <Botao titulo={valor.botao} aoCarregar={() => router.push("/carteira")} />
        </View>
      ) : null}
      {dados ? (
        <View style={{ gap: ESPACO.s }}>
          <Mensagem tom={dados.impede ? "mau" : "aviso"} texto={dados.frase} />
          <Botao titulo={COMPLETAR_O_PERFIL} tipo="secundario" aoCarregar={() => router.push(dados.destino as never)} />
        </View>
      ) : null}
    </View>
  );
}
