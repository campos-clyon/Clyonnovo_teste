import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./Texto";
import { Aviso, Botao, Campo, Cartao, Subtitulo } from "./ui";
import type { Negociacao } from "../lib/pedidos";
import { CORES } from "../tema";

/**
 * E10 — AVALIAR, depois de confirmado. A avaliação é do profissional (a da
 * negociação, a que conta no perfil dele), não da CLYON. Uma por trabalho: o
 * 409 da API diz «Este trabalho já foi avaliado.».
 */
export function Avaliar({
  pedidoId,
  n,
  agir,
  aoPedirOutraVez,
}: {
  pedidoId: number;
  n: Negociacao;
  agir: (corpo: Record<string, unknown>) => Promise<string | null>;
  aoPedirOutraVez: () => void;
}) {
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);

  if (feito) {
    return (
      <Cartao>
        <Text style={{ color: CORES.tinta, fontSize: 15 }}>Obrigado. A sua avaliação ajuda outros clientes a escolher.</Text>
        <Botao titulo="Pedir outra vez" tipo="secundario" aoCarregar={aoPedirOutraVez} />
      </Cartao>
    );
  }
  if (!n.accoes.includes("avaliar")) return null;

  async function enviar() {
    if (estrelas < 1) {
      setErro("Escolha de 1 a 5 estrelas.");
      return;
    }
    setOcupado(true);
    setErro(null);
    const e = await agir({ pedidoId, negociacaoId: n.id, accao: "avaliar", estrelas, comentario: comentario.trim() || undefined });
    setOcupado(false);
    if (e) setErro(e);
    else setFeito(true);
  }

  return (
    <Cartao destaque>
      <Subtitulo>{`Como correu com ${n.profissional.nome}?`}</Subtitulo>
      <View style={{ flexDirection: "row", gap: 6 }} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((i) => (
          <Pressable
            key={i}
            accessibilityRole="radio"
            accessibilityLabel={`${i} ${i === 1 ? "estrela" : "estrelas"}`}
            accessibilityState={{ selected: estrelas === i }}
            onPress={() => setEstrelas(i)}
            hitSlop={6}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
          >
            <Text style={{ fontSize: 32, color: i <= estrelas ? "#E0A800" : CORES.linha }}>★</Text>
          </Pressable>
        ))}
      </View>
      <Campo rotulo="Quer deixar um comentário? (opcional)" valor={comentario} aoMudar={setComentario} multiline maxLength={1000} />
      {erro ? <Aviso texto={erro} tom="mau" /> : null}
      <Botao titulo="Enviar avaliação" ocupado={ocupado} aoCarregar={() => void enviar()} />
    </Cartao>
  );
}
