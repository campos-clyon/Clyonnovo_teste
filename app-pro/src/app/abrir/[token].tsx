import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "../../componentes/Texto";
import { Botao, Mensagem } from "../../componentes/ui";
import { useTrabalhos } from "../../estado/Trabalhos";
import { ErroDaApi, pedir } from "../../lib/api";
import { ESPACO, LETRA, useCores } from "../../tema";

/**
 * O LINK DE UM PEDIDO, ABERTO NA APP — versão 12.
 *
 * Os avisos por WhatsApp e email trazem `clyon.pt/profissionais/pedidos/<token>`.
 * O token não diz qual é o trabalho; o site traduz-o
 * (`/api/profissionais/pedido-do-link`, com as regras da página do pedido) e
 * a app abre esse trabalho, em vez da lista. Se não der (link expirado, de
 * outra conta), diz porquê e leva aos trabalhos — nunca um ecrã sem saída.
 */
export default function AbrirOPedido() {
  const c = useCores();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { recarregar } = useTrabalhos();
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await pedir<{ negociacaoId: number }>("/api/profissionais/pedido-do-link", {
          metodo: "POST",
          corpo: { token },
        });
        // Um pedido acabado de chegar pode ainda não estar na lista desta sessão.
        await recarregar();
        if (vivo) router.replace(`/trabalho/${r.negociacaoId}`);
      } catch (e) {
        if (vivo) setErro(e instanceof ErroDaApi ? e.message : "Não foi possível abrir o pedido.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [token, recarregar]);

  return (
    <View style={[estilos.pagina, { backgroundColor: c.fundo }]}>
      {erro ? (
        <>
          <Mensagem texto={erro} />
          <Botao titulo="Ver os meus trabalhos" aoCarregar={() => router.replace("/")} />
        </>
      ) : (
        <>
          <ActivityIndicator color={c.marca} />
          <Text style={{ color: c.suave, fontSize: LETRA.normal, textAlign: "center" }}>A abrir o pedido…</Text>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  pagina: { flex: 1, justifyContent: "center", padding: ESPACO.xl, gap: ESPACO.l },
});
