import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao, Mensagem } from "../componentes/ui";
import { useSessao } from "../estado/Sessao";
import { ErroDaApi, SITE } from "../lib/api";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/**
 * ENTRAR, com a mesma conta do painel no navegador.
 *
 * Criar a palavra-passe e recuperá-la continuam no site (o link chega por
 * email), por isso o atalho abre a página de entrada do painel.
 */
export default function Entrar() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const { entrar } = useSessao();
  const [email, setEmail] = useState("");
  const [palavraPasse, setPalavraPasse] = useState("");
  const [aEntrar, setAEntrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoEntrar() {
    if (!email.trim() || !palavraPasse) {
      setErro("Escreva o email e a palavra-passe da sua conta CLYON.");
      return;
    }
    setAEntrar(true);
    setErro(null);
    try {
      await entrar(email, palavraPasse);
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível entrar. Tente outra vez.");
    } finally {
      setAEntrar(false);
    }
  }

  const campo = [estilos.campo, { borderColor: c.linha, color: c.tinta, backgroundColor: c.superficie }];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.fundo }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[estilos.pagina, { paddingTop: margens.top + ESPACO.xxl, paddingBottom: margens.bottom + ESPACO.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={estilos.marca}>
          <Text style={[estilos.logo, { color: c.marca }]}>CLYON</Text>
          <View style={[estilos.pro, { backgroundColor: c.marca }]}>
            <Text style={[estilos.textoPro, { color: c.sobreMarca }]}>PRO</Text>
          </View>
        </View>
        <Text style={[estilos.titulo, { color: c.tinta }]}>Os seus trabalhos, no telemóvel.</Text>
        <Text style={[estilos.subtitulo, { color: c.suave }]}>
          Entre com a conta de profissional que usa no painel da CLYON.
        </Text>

        <View style={estilos.formulario}>
          <Text style={[estilos.rotulo, { color: c.tinta }]}>Email</Text>
          <TextInput
            style={campo}
            value={email}
            onChangeText={setEmail}
            placeholder="o.seu@email.pt"
            placeholderTextColor={c.suave}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
            accessibilityLabel="Email"
          />
          <Text style={[estilos.rotulo, { color: c.tinta }]}>Palavra-passe</Text>
          <TextInput
            style={campo}
            value={palavraPasse}
            onChangeText={setPalavraPasse}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={aoEntrar}
            accessibilityLabel="Palavra-passe"
          />
          {erro ? <Mensagem texto={erro} /> : null}
          <Botao titulo="Entrar" aoCarregar={aoEntrar} ocupado={aEntrar} />
        </View>

        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`${SITE}/profissionais/entrar`)} style={estilos.ajuda}>
          <Text style={{ color: c.marca, fontSize: LETRA.pequena + 1, fontWeight: "600", textAlign: "center" }}>
            Ainda não tem palavra-passe, ou esqueceu-se dela? Abra o painel no site.
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pagina: { paddingHorizontal: ESPACO.xl, gap: ESPACO.m, maxWidth: 480, width: "100%", alignSelf: "center" },
  marca: { flexDirection: "row", alignItems: "center", gap: ESPACO.s, marginBottom: ESPACO.l },
  logo: { fontSize: 34, fontWeight: "800", letterSpacing: 1 },
  pro: { borderRadius: RAIO.s, paddingHorizontal: 6, paddingVertical: 2 },
  textoPro: { fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  titulo: { fontSize: LETRA.grande, fontWeight: "800", lineHeight: 36 },
  subtitulo: { fontSize: LETRA.normal, lineHeight: 23 },
  formulario: { gap: ESPACO.s, marginTop: ESPACO.l },
  rotulo: { fontSize: LETRA.pequena + 1, fontWeight: "600", marginTop: ESPACO.s },
  campo: { borderWidth: 1, borderRadius: RAIO.m, paddingHorizontal: ESPACO.m, minHeight: 50, fontSize: LETRA.normal },
  ajuda: { marginTop: ESPACO.l, paddingVertical: ESPACO.s },
});
