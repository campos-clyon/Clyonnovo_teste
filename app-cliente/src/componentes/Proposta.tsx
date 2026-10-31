import { useState } from "react";
import { View } from "react-native";
import { Preco } from "./Preco";
import { Text } from "./Texto";
import { Botao, Cartao, Ligacao } from "./ui";
import { accaoDeContratar, podeRecusar, type NegociacaoV3, type TextosDoPedido } from "../lib/pedidos";
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
  aoPropor,
}: {
  n: NegociacaoV3;
  textos: TextosDoPedido;
  aoContratar: () => void;
  aoRecusar: () => void;
  aoVerAvaliacoes: () => void;
  /** «Propor outro valor» (R8 `propor`), quando a API o deixa. */
  aoPropor?: () => void;
}) {
  const [historico, setHistorico] = useState(false);
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
      {n.materiaisTexto ? <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>{n.materiaisTexto}</Text> : null}
      {n.formaTexto ? <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>{n.formaTexto}</Text> : null}
      {contratar ? <Botao titulo="Contratar" aoCarregar={aoContratar} /> : null}
      {aoPropor && n.accoes.includes("propor") ? <Ligacao titulo="Ou proponha outro valor" centrada aoCarregar={aoPropor} /> : null}
      {podeRecusar(n, textos) ? <Ligacao titulo="Recusar" tom="mau" centrada aoCarregar={aoRecusar} /> : null}
      {n.historico && n.historico.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Ligacao titulo={historico ? "Esconder o histórico" : "Ver o histórico"} tom="suave" aoCarregar={() => setHistorico((h) => !h)} />
          {historico
            ? n.historico.map((h, i) => (
                <Text key={i} style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>
                  {h.quandoTexto ? `${h.quandoTexto} — ${h.texto}` : h.texto}
                </Text>
              ))
            : null}
        </View>
      ) : null}
    </Cartao>
  );
}
