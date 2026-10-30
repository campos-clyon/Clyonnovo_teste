import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { RolagemComTeclado } from "../../componentes/Teclado";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, TextInput } from "../../componentes/Texto";
import { Botao, Mensagem } from "../../componentes/ui";
import { useSessao } from "../../estado/Sessao";
import { ErroDaApi, pedir } from "../../lib/api";
import { MINIMO_DA_PALAVRA_PASSE } from "../../../../src/lib/palavra-passe-minima";
import { ESPACO, LETRA, RAIO, useCores } from "../../tema";

/**
 * ESCOLHER A PALAVRA-PASSE, A PARTIR DO LINK DO EMAIL — 20-10-2026.
 *
 * O email da aprovação (e o de «esqueci-me da palavra-passe») traz um link
 * para clyon.pt/profissionais/definir-senha/<token>. Com a app instalada, o
 * Android abre-o aqui (`destino.ts`, `links-da-app.ts` no site), e o dono quis
 * que fosse assim: «quando você registra a senha, ele já deveria ir direto
 * abrir o aplicativo». A rota é a mesma da página do site; com `paraApp`
 * devolve a sessão no corpo, e ele fica logo dentro.
 *
 * Fica fora das guardas do `_layout`: o link pode chegar com ele já dentro
 * (pediu outra palavra-passe), e tem de abrir na mesma.
 */
export default function DefinirSenha() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const { ligado, entrarComToken } = useSessao();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [palavraPasse, setPalavraPasse] = useState("");
  const [ver, setVer] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // O 403 mais comum é o próprio a reabrir o email depois de já ter escolhido
  // a palavra-passe — o link é de uso único. Como no site, leva-o à entrada.
  const [jaUsado, setJaUsado] = useState(false);
  const [feito, setFeito] = useState(false);

  // Só depois de a sessão chegar ao `_layout`: antes disso os trabalhos ainda
  // estão guardados, e ir para lá dava em nada.
  useEffect(() => {
    if (feito && ligado) router.replace("/");
  }, [feito, ligado]);

  const curta = palavraPasse.length > 0 && palavraPasse.length < MINIMO_DA_PALAVRA_PASSE;

  async function aoGuardar() {
    if (palavraPasse.length < MINIMO_DA_PALAVRA_PASSE) {
      setErro(`A palavra-passe precisa de pelo menos ${MINIMO_DA_PALAVRA_PASSE} caracteres.`);
      return;
    }
    setAGuardar(true);
    setErro(null);
    try {
      const r = await pedir<{ nome: string; token: string }>("/api/profissionais/definir-senha", {
        metodo: "POST",
        corpo: { token, palavraPasse, paraApp: true },
        semSessao: true,
      });
      await entrarComToken(r.token, r.nome);
      setFeito(true);
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível guardar. Tente outra vez.");
      setJaUsado(e instanceof ErroDaApi && e.estado === 403);
    } finally {
      setAGuardar(false);
    }
  }

  return (
      <RolagemComTeclado style={{ flex: 1, backgroundColor: c.fundo }}
        contentContainerStyle={[estilos.pagina, { paddingTop: margens.top + ESPACO.xxl, paddingBottom: margens.bottom + ESPACO.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={estilos.marca}>
          <Text style={[estilos.logo, { color: c.marca }]}>CLYON</Text>
          <View style={[estilos.pro, { backgroundColor: c.marca }]}>
            <Text style={[estilos.textoPro, { color: c.sobreMarca }]}>PRO</Text>
          </View>
        </View>
        <Text style={[estilos.titulo, { color: c.tinta }]}>Escolha a sua palavra-passe</Text>
        <Text style={[estilos.subtitulo, { color: c.suave }]}>
          É com ela que entra na app e no painel do site. Fica já com a sessão iniciada.
        </Text>

        <View style={estilos.formulario}>
          <Text style={[estilos.rotulo, { color: c.tinta }]}>Palavra-passe</Text>
          <View style={[estilos.campoComOlho, { borderColor: curta ? c.aviso : c.linha, backgroundColor: c.superficie }]}>
            <TextInput
              style={[estilos.textoComOlho, { color: c.tinta }]}
              value={palavraPasse}
              onChangeText={setPalavraPasse}
              secureTextEntry={!ver}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              autoFocus
              placeholder={`Pelo menos ${MINIMO_DA_PALAVRA_PASSE} caracteres`}
              placeholderTextColor={c.suave}
              returnKeyType="go"
              onSubmitEditing={aoGuardar}
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
          <Text style={[estilos.dica, { color: curta ? c.aviso : c.suave }]}>
            Mínimo {MINIMO_DA_PALAVRA_PASSE} caracteres. Uma frase que se lembre é melhor do que uma palavra com símbolos.
          </Text>
          {erro ? <Mensagem texto={erro} /> : null}
          {jaUsado ? (
            <Pressable accessibilityRole="link" onPress={() => router.replace(ligado ? "/" : "/entrar")} style={estilos.ajuda}>
              <Text style={{ color: c.marca, fontSize: LETRA.pequena + 1, fontWeight: "600", textAlign: "center" }}>
                {ligado ? "Voltar aos trabalhos" : "Entrar, ou pedir um link novo"}
              </Text>
            </Pressable>
          ) : null}
          <Botao titulo="Guardar e entrar" aoCarregar={aoGuardar} ocupado={aGuardar} />
        </View>
      </RolagemComTeclado>
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
  campoComOlho: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: RAIO.m, minHeight: 50 },
  textoComOlho: { flex: 1, paddingHorizontal: ESPACO.m, minHeight: 50, fontSize: LETRA.normal },
  olho: { paddingHorizontal: ESPACO.m, minHeight: 50, justifyContent: "center" },
  dica: { fontSize: LETRA.pequena + 1, lineHeight: 19 },
  ajuda: { paddingVertical: ESPACO.s },
});
