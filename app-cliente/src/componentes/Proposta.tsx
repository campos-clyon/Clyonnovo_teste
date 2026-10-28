import { View } from "react-native";
import { Preco } from "./Preco";
import { Text } from "./Texto";
import { Botao, Cartao, Ligacao } from "./ui";
import { accaoDeContratar, podeRecusar, type Negociacao, type TextosDoPedido } from "../lib/pedidos";
import { CORES } from "../tema";

/**
 * E5b — UMA PROPOSTA (um cartão por profissional que fez proposta).
 *
 * O nome e, na mesma linha, pequeno, «guia verificada»; a nota; os trabalhos
 * feitos na CLYON; «Ver avaliações». O preço como a API o escreve, e como se
 * paga (`formaTexto`). Os botões são os que a API deixa (`accoes`): Contratar
 * (`aceitar` ou `contratar`) e, por baixo, «Recusar» (`desistir`, quando já
 * vem o texto da confirmação — S8/S9).
 */
export function Proposta({
  n,
  textos,
  aoContratar,
  aoRecusar,
  aoVerAvaliacoes,
}: {
  n: Negociacao;
  textos: TextosDoPedido;
  aoContratar: () => void;
  aoRecusar: () => void;
  aoVerAvaliacoes: () => void;
}) {
  const p = n.profissional;
  const contratar = accaoDeContratar(n);
  const trabalhos = `${p.trabalhosConcluidos} ${p.trabalhosConcluidos === 1 ? "trabalho" : "trabalhos"} na CLYON`;
  return (
    <Cartao destaque={!!contratar}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text style={{ flexShrink: 1, color: CORES.tinta, fontSize: 18, fontWeight: "800" }} numberOfLines={1}>
          {p.nome}
        </Text>
        {p.guiaVerificada ? (
          <Text style={{ color: CORES.bom, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
            guia verificada
          </Text>
        ) : null}
      </View>
      <Text style={{ color: CORES.tinta, fontSize: 14 }} numberOfLines={1}>
        {`${p.notaTexto} · ${trabalhos}`}
      </Text>
      {p.respostaTexto ? (
        <Text style={{ color: CORES.suave, fontSize: 14 }} numberOfLines={1}>
          {p.respostaTexto}
        </Text>
      ) : null}
      <Ligacao titulo="Ver avaliações" aoCarregar={aoVerAvaliacoes} />
      <Text style={{ color: CORES.suave, fontSize: 13 }}>{n.estadoTexto}</Text>
      {n.preco ? <Preco preco={n.preco} /> : null}
      {n.formaTexto ? <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>{n.formaTexto}</Text> : null}
      {contratar ? <Botao titulo="Contratar" aoCarregar={aoContratar} /> : null}
      {podeRecusar(n, textos) ? <Ligacao titulo="Recusar" tom="mau" centrada aoCarregar={aoRecusar} /> : null}
    </Cartao>
  );
}
