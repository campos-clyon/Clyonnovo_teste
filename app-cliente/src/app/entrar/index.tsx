import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Aviso, Botao, Campo, Ligacao, Paragrafo, Titulo } from "../../componentes/ui";
import { Text } from "../../componentes/Texto";
import { useSessao } from "../../estado/Sessao";
import { mensagemDe, pedir } from "../../lib/api";
import { codigoParaPedirOLink, sha256Hex } from "../../lib/codigo-do-aparelho";
import { pedirLinkDeEntrada } from "../../lib/entrada";
import { CORES } from "../../tema";

/**
 * E1 — ENTRAR (especificação da app de cliente, versão 2 de 28-10-2026).
 *
 * As duas entradas do site: o Google do telemóvel e o link de uso único por
 * email. O Google só aparece quando o site o tiver ligado para a app
 * (`GET /api/cliente/entrar` → `google`) E esta versão trouxer o Google
 * Sign-In ligado — o módulo vai na 1.ª build, desligado, e liga-se por EAS
 * Update depois de o dono criar o cliente OAuth Android de pt.clyon.cliente.
 *
 * O LINK FICA PRESO A ESTE TELEMÓVEL: com o pedido do link vai a prova do
 * código do aparelho (`app: "cliente"`, `prova`), e o link do email só entra
 * neste telemóvel, depois de um toque em «Entrar» (E1a).
 */
export const GOOGLE_NESTA_VERSAO = false;

const ESPERA_PARA_REENVIAR_S = 60;

export default function Entrar() {
  const { aviso } = useSessao();
  const params = useLocalSearchParams<{ email?: string }>();
  const [googleNoSite, setGoogleNoSite] = useState(false);
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
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
      // O mesmo código serve para «Reenviar» e «Usar outro email» enquanto não se entra.
      const codigo = await codigoParaPedirOLink();
      await pedirLinkDeEntrada({ pedir, email: limpo, codigo, sha256Hex });
      setEnviado(true);
      setFalta(ESPERA_PARA_REENVIAR_S);
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível enviar o link agora."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={{ height: 16 }} />
          <Titulo>Entrar na CLYON</Titulo>

          {aviso ? <Aviso texto={aviso.texto} tom={aviso.tom} /> : null}

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
              <Ligacao
                titulo="Usar outro email"
                centrada
                aoCarregar={() => {
                  setEnviado(false);
                  setFalta(0);
                  setErro(null);
                }}
              />
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <Campo
                rotulo="Email"
                valor={email}
                aoMudar={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={() => void enviarLink()}
              />
              <Botao titulo="Enviar link de entrada" ocupado={enviando} aoCarregar={() => void enviarLink()} />
            </View>
          )}

          {erro ? <Aviso texto={erro} tom="mau" /> : null}

          <Paragrafo pequeno suave>
            Se nunca entrou, a conta cria-se ao entrar. Use o mesmo email com que fez os seus pedidos, para os ver aqui.
          </Paragrafo>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
