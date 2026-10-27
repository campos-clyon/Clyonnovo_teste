import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Aviso, Botao } from "../../componentes/ui";
import { Text, TextInput } from "../../componentes/Texto";
import { useSessao } from "../../estado/Sessao";
import { ErroDaApi, pedir } from "../../lib/api";
import { CORES } from "../../tema";

/**
 * E1 — ENTRAR (especificação da app de cliente, d8 de 27-10-2026).
 *
 * As duas entradas do site: o Google do telemóvel e o link de uso único por
 * email. O Google só aparece quando o site o tiver ligado para a app
 * (`GET /api/cliente/entrar` → `google`) E esta versão da app trouxer o
 * Google Sign-In nativo — que só entra depois de o dono criar o cliente OAuth
 * Android de pt.clyon.cliente. Até lá, entra-se pelo link.
 *
 * O link chega por email (`POST /api/entrada/link`, a mesma rota do site) e
 * abre a app em `/entrar/link?t=…`, que o troca por uma sessão.
 */
export const GOOGLE_NESTA_VERSAO = false;

const ESPERA_PARA_REENVIAR_S = 60;

export default function Entrar() {
  const { aviso } = useSessao();
  const [googleNoSite, setGoogleNoSite] = useState(false);
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [falta, setFalta] = useState(0);

  useEffect(() => {
    pedir<{ google?: boolean }>("/api/cliente/entrar", { semSessao: true })
      .then((r) => setGoogleNoSite(r.google === true))
      .catch(() => setGoogleNoSite(false));
  }, []);

  useEffect(() => {
    if (falta <= 0) return;
    const t = setTimeout(() => setFalta((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [falta]);

  const mostrarGoogle = googleNoSite && GOOGLE_NESTA_VERSAO;

  async function enviarLink() {
    const limpo = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) {
      setErro("Escreva o seu email.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await pedir("/api/entrada/link", { metodo: "POST", corpo: { email: limpo }, semSessao: true });
      setEnviado(true);
      setFalta(ESPERA_PARA_REENVIAR_S);
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível enviar o link agora.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: CORES.tinta, fontSize: 28, fontWeight: "800", marginTop: 24 }}>Entrar na CLYON</Text>

          {aviso ? <Aviso texto={aviso} tom="mau" /> : null}

          {mostrarGoogle ? (
            <>
              {/* O botão do Google entra com o Google Sign-In nativo, depois do cliente OAuth Android. */}
              <Text style={{ color: CORES.suave, textAlign: "center" }}>ou com o seu email</Text>
            </>
          ) : null}

          {enviado ? (
            <View style={{ gap: 14 }}>
              <Aviso
                tom="bom"
                texto="Se o email estiver certo, o link de entrada chega dentro de instantes. Abra-o neste telemóvel — dura 15 minutos e serve uma vez."
              />
              <Botao
                titulo={falta > 0 ? `Reenviar (${falta} s)` : "Reenviar"}
                tipo="secundario"
                desligado={falta > 0}
                ocupado={enviando}
                aoCarregar={() => void enviarLink()}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setEnviado(false);
                  setFalta(0);
                  setErro(null);
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 8 })}
              >
                <Text style={{ color: CORES.marca, fontSize: 15, fontWeight: "600", textAlign: "center" }}>Usar outro email</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={() => void enviarLink()}
                accessibilityLabel="Email"
                style={{
                  minHeight: 50,
                  borderWidth: 1,
                  borderColor: CORES.linha,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  fontSize: 16,
                  color: CORES.tinta,
                  backgroundColor: CORES.superficie,
                }}
              />
              <Botao titulo="Enviar link de entrada" ocupado={enviando} aoCarregar={() => void enviarLink()} />
            </View>
          )}

          {erro ? <Aviso texto={erro} tom="mau" /> : null}

          <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>
            Se nunca entrou, a conta cria-se ao entrar. Use o mesmo email com que fez os seus pedidos, para os ver aqui.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
