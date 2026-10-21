import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../componentes/Texto";
import { Botao, CampoDeTexto, Mensagem } from "../componentes/ui";
import { ErroDaApi, pedir } from "../lib/api";
import { ESPACO, LETRA, useCores } from "../tema";

/**
 * REPOR A PALAVRA-PASSE, DENTRO DA APP — versão 12.
 *
 * Abria o painel no navegador. Agora pede-se aqui, à mesma rota do painel
 * (`/api/profissionais/esqueci-palavra-passe`), com os mesmos textos; o link
 * que chega por email abre a app (`definir-senha/[token]`) e ele fica logo
 * dentro. A resposta é sempre a mesma, haja conta ou não — não se diz a
 * ninguém que emails estão inscritos.
 */
export default function Repor() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [aPedir, setAPedir] = useState(false);
  const [pedido, setPedido] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function pedirLink() {
    setAPedir(true);
    setErro(null);
    try {
      const r = await pedir<{ mensagem?: string }>("/api/profissionais/esqueci-palavra-passe", {
        metodo: "POST",
        corpo: { email: email.trim() },
        semSessao: true,
      });
      setPedido(r.mensagem ?? "Se este email tiver conta, o link chega dentro de instantes.");
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível pedir o link. Tente outra vez.");
    } finally {
      setAPedir(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.fundo }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[estilos.pagina, { paddingBottom: margens.bottom + ESPACO.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[estilos.texto, { color: c.suave }]}>
          Escreva o email com que se inscreveu. Mandamos-lhe um link para escolher uma palavra-passe nova.
        </Text>
        {pedido ? (
          <View style={{ gap: ESPACO.s }}>
            <Mensagem tom="bom" texto={pedido} />
            <Text style={[estilos.dica, { color: c.suave }]}>
              Abra o link neste telemóvel: a app abre sozinha e fica logo com a sessão iniciada. Não chegou ao fim de uns
              minutos? Veja na pasta de spam ou de promoções. Se já não tiver acesso a este email, fale connosco pelos
              contactos.
            </Text>
          </View>
        ) : (
          <View style={{ gap: ESPACO.m }}>
            <CampoDeTexto
              rotulo="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="geral@exemplo.pt"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              autoFocus
            />
            {erro ? <Mensagem texto={erro} /> : null}
            <Botao titulo="Enviar link" ocupado={aPedir} desactivado={!email.includes("@")} aoCarregar={() => void pedirLink()} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pagina: { padding: ESPACO.l, gap: ESPACO.m, maxWidth: 560, width: "100%", alignSelf: "center" },
  texto: { fontSize: LETRA.normal, lineHeight: 23 },
  dica: { fontSize: LETRA.pequena + 1, lineHeight: 19 },
});
