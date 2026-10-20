import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { router } from "expo-router";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "../componentes/Texto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao, Mensagem } from "../componentes/ui";
import { useSessao } from "../estado/Sessao";
import { ErroDaApi, SITE } from "../lib/api";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/**
 * ENTRAR, com a mesma conta do painel no navegador.
 *
 * Recuperar a palavra-passe continua no site (o link chega por email), por
 * isso o atalho abre a página de entrada do painel. Quem ainda não é parceiro
 * candidata-se aqui mesmo, no ecrã «registo» (20-10-2026) — antes abria a
 * página do site; e o link da palavra-passe que lhe chega depois abre a app.
 */
export default function Entrar() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const { entrar } = useSessao();
  const [email, setEmail] = useState("");
  const [palavraPasse, setPalavraPasse] = useState("");
  const [ver, setVer] = useState(false);
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
          {/* O olho mostra o que se escreveu: a borda passa do campo para a caixa que o leva. */}
          <View style={[estilos.campoComOlho, { borderColor: c.linha, backgroundColor: c.superficie }]}>
            <TextInput
              style={[estilos.textoComOlho, { color: c.tinta }]}
              value={palavraPasse}
              onChangeText={setPalavraPasse}
              secureTextEntry={!ver}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={aoEntrar}
              accessibilityLabel="Palavra-passe"
            />
            <Pressable
              onPress={() => setVer(!ver)}
              accessibilityRole="button"
              accessibilityLabel={ver ? "Esconder a palavra-passe" : "Mostrar a palavra-passe"}
              hitSlop={8}
              style={({ pressed }) => [estilos.olho, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name={ver ? "eye-off-outline" : "eye-outline"} size={22} color={c.suave} />
            </Pressable>
          </View>
          {erro ? <Mensagem texto={erro} /> : null}
          <Botao titulo="Entrar" aoCarregar={aoEntrar} ocupado={aEntrar} />
        </View>

        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`${SITE}/profissionais/entrar`)} style={estilos.ajuda}>
          <Text style={{ color: c.marca, fontSize: LETRA.pequena + 1, fontWeight: "600", textAlign: "center" }}>
            Ainda não tem palavra-passe, ou esqueceu-se dela? Abra o painel no site.
          </Text>
        </Pressable>

        <View style={[estilos.separador, { backgroundColor: c.linha }]} />
        <Text style={[estilos.novo, { color: c.suave }]}>É novo na CLYON? Inscreva-se aqui.</Text>
        <Botao titulo="Quero ser parceiro" tipo="secundario" aoCarregar={() => router.push("/registo")} />
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
  campoComOlho: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: RAIO.m, minHeight: 50 },
  textoComOlho: { flex: 1, paddingHorizontal: ESPACO.m, minHeight: 50, fontSize: LETRA.normal },
  olho: { paddingHorizontal: ESPACO.m, minHeight: 50, justifyContent: "center" },
  ajuda: { marginTop: ESPACO.l, paddingVertical: ESPACO.s },
  separador: { height: 1, marginTop: ESPACO.m },
  novo: { fontSize: LETRA.normal, textAlign: "center", marginTop: ESPACO.s },
});
