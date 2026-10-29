import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./Texto";
import { Aviso, Botao, Campo, Ligacao, Paragrafo } from "./ui";
import { useSessao } from "../estado/Sessao";
import { mensagemDe, pedir } from "../lib/api";
import { codigoParaPedirOLink, sha256Hex } from "../lib/codigo-do-aparelho";
import { pedirLinkDeEntrada } from "../lib/entrada";
import { entrarComGoogle } from "../lib/google";
import { guardarDepoisDeEntrar, type DepoisDeEntrar } from "../lib/guardado";
import { CORES } from "../tema";

/**
 * AS DUAS ENTRADAS (E1 v3, E3.F e a Conta sem sessão) — o Google do telemóvel
 * num toque, ou o link de uso único por email.
 *
 * O Google só aparece quando o site o tiver ligado para a app
 * (`GET /api/cliente/entrar` → `google`, que fica `true` com o
 * `GOOGLE_CLIENT_ID_APP_CLIENTE` na Vercel) E esta versão o trouxer — a 2.ª
 * build (29-10-2026) traz.
 *
 * O LINK FICA PRESO A ESTE TELEMÓVEL: com o pedido do link vai a prova do
 * código do aparelho (`app: "cliente"`, `prova`), e o link do email só entra
 * neste telemóvel, depois de um toque em «Entrar» (E1a). Para onde voltar
 * depois (o resumo do pedido, juntar um pedido) fica guardado no telemóvel.
 */
export const GOOGLE_NESTA_VERSAO = true;

const ESPERA_PARA_REENVIAR_S = 60;

/** O site tem o Google ligado para a app? Pergunta-se uma vez por ecrã. */
export function useGoogleNoSite(): boolean {
  const [googleNoSite, setGoogleNoSite] = useState(false);
  useEffect(() => {
    pedir<{ google?: boolean }>("/api/cliente/entrar", { semSessao: true })
      .then((r) => setGoogleNoSite(r.google === true))
      .catch(() => setGoogleNoSite(false));
  }, []);
  return googleNoSite;
}

function BotaoDoGoogle({ aoCarregar, ocupado }: { aoCarregar: () => void; ocupado: boolean }) {
  return (
    <Pressable
      onPress={ocupado ? undefined : aoCarregar}
      accessibilityRole="button"
      accessibilityLabel="Continuar com o Google"
      accessibilityState={{ busy: ocupado }}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: CORES.linhaForte,
        backgroundColor: CORES.fundo,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        opacity: ocupado ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      <Ionicons name="logo-google" size={20} color={CORES.tinta} />
      <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }} titulo>
        Continuar com o Google
      </Text>
    </Pressable>
  );
}

export function Entrada({
  depois,
  aoEntrar,
  emailInicial = "",
}: {
  /** Para onde voltar depois de entrar pelo link do email. */
  depois?: DepoisDeEntrar;
  /** Depois de entrar com o Google (a sessão já está guardada). */
  aoEntrar?: () => void;
  emailInicial?: string;
}) {
  const { entrarComSessaoNova } = useSessao();
  const googleNoSite = useGoogleNoSite();
  const [email, setEmail] = useState(emailInicial);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [noGoogle, setNoGoogle] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [falta, setFalta] = useState(0);

  useEffect(() => {
    if (falta <= 0) return;
    const t = setTimeout(() => setFalta((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [falta]);

  const mostrarGoogle = googleNoSite && GOOGLE_NESTA_VERSAO;

  async function google() {
    setErro(null);
    setNoGoogle(true);
    try {
      const r = await entrarComGoogle();
      if (r.tipo === "erro") setErro(r.mensagem);
      if (r.tipo === "sessao") {
        await entrarComSessaoNova(r.sessao);
        aoEntrar?.();
      }
    } finally {
      setNoGoogle(false);
    }
  }

  async function enviarLink() {
    const limpo = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) {
      setErro("Escreva o seu email.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      if (depois) guardarDepoisDeEntrar(depois);
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
    <View style={{ gap: 14 }}>
      {mostrarGoogle ? (
        <>
          <BotaoDoGoogle aoCarregar={() => void google()} ocupado={noGoogle} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: CORES.linha }} />
            <Text style={{ color: CORES.suave, fontSize: 13 }}>ou com o seu email</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: CORES.linha }} />
          </View>
        </>
      ) : null}

      {enviado ? (
        <View style={{ gap: 12 }}>
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
          <Botao titulo="Enviar link de entrada" tipo={mostrarGoogle ? "secundario" : "principal"} ocupado={enviando} aoCarregar={() => void enviarLink()} />
        </View>
      )}

      {erro ? <Aviso texto={erro} tom="mau" /> : null}

      <Paragrafo pequeno suave>
        Se nunca entrou, a conta cria-se ao entrar. Use o mesmo email com que fez os seus pedidos, para os ver aqui.
      </Paragrafo>
    </View>
  );
}
