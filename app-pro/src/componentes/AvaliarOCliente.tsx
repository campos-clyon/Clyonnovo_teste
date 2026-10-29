import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Text, TextInput } from "./Texto";
import { Botao, Caixa, Mensagem, TituloDaCaixa } from "./ui";
import { ErroDaApi, pedir } from "../lib/api";
import { LETRA, RAIO, ESPACO, useCores } from "../tema";

/**
 * AVALIAR O CLIENTE — dono, 29-10-2026. Depois do trabalho feito ou
 * confirmado, de 1 a 5 estrelas e um comentário (opcional). Uma por trabalho;
 * depois de enviada não se altera, e a app não volta a mostrar as estrelas que
 * deu — só «Avaliação do cliente enviada». A mesma rota do painel.
 */
export const ROTA_DE_AVALIAR_O_CLIENTE = "/api/profissionais/trabalho/avaliar-cliente";

export function AvaliarOCliente({ negociacaoId }: { negociacaoId: number }) {
  const c = useCores();
  const [estado, setEstado] = useState<"a_ler" | "pode" | "feita" | "nao">("a_ler");
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    pedir<{ podeAvaliar?: boolean; jaAvaliou?: boolean }>(`${ROTA_DE_AVALIAR_O_CLIENTE}?negociacaoId=${negociacaoId}`)
      .then((d) => vivo && setEstado(d.jaAvaliou ? "feita" : d.podeAvaliar ? "pode" : "nao"))
      .catch(() => vivo && setEstado("nao"));
    return () => {
      vivo = false;
    };
  }, [negociacaoId]);

  if (estado === "a_ler" || estado === "nao") return null;
  if (estado === "feita") return <Mensagem tom="bom" texto="Avaliação do cliente enviada. Obrigado." />;

  async function enviar() {
    if (estrelas < 1) return setErro("Escolha de 1 a 5 estrelas.");
    setAEnviar(true);
    setErro(null);
    try {
      await pedir(ROTA_DE_AVALIAR_O_CLIENTE, { metodo: "POST", corpo: { negociacaoId, estrelas, comentario: comentario.trim() || undefined } });
      setEstado("feita");
    } catch (e) {
      if (e instanceof ErroDaApi && e.estado === 409) setEstado("feita");
      else setErro(e instanceof ErroDaApi ? e.message : "Não foi possível enviar a avaliação.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <Caixa>
      <TituloDaCaixa>Como correu com o cliente?</TituloDaCaixa>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
        Só o cliente vê esta avaliação. Depois de enviada não se altera.
      </Text>
      <View style={{ flexDirection: "row", gap: ESPACO.xs }} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((i) => (
          <Pressable
            key={i}
            onPress={() => setEstrelas(i)}
            accessibilityRole="radio"
            accessibilityState={{ selected: estrelas === i }}
            accessibilityLabel={`${i} ${i === 1 ? "estrela" : "estrelas"}`}
            hitSlop={4}
          >
            <Text style={{ fontSize: 32, color: i <= estrelas ? c.aviso : c.linha }}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={comentario}
        onChangeText={(v) => setComentario(v.slice(0, 500))}
        maxLength={500}
        multiline
        placeholder="Comentário (opcional)"
        placeholderTextColor={c.suave}
        accessibilityLabel="Comentário"
        style={{
          borderWidth: 1,
          borderColor: c.linha,
          borderRadius: RAIO.m,
          paddingHorizontal: ESPACO.m,
          paddingTop: ESPACO.s,
          minHeight: 84,
          textAlignVertical: "top",
          fontSize: LETRA.media,
          color: c.tinta,
        }}
      />
      {erro ? <Mensagem texto={erro} /> : null}
      <Botao titulo="Enviar avaliação" ocupado={aEnviar} aoCarregar={() => void enviar()} />
    </Caixa>
  );
}
