import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./Texto";
import { Aviso, Botao, Campo, Ligacao, Paragrafo } from "./ui";
import { useSessao } from "../estado/Sessao";
import { mensagemDe, pedir } from "../lib/api";
import { codigoParaPedirOLink, sha256Hex } from "../lib/codigo-do-aparelho";
import {
  CONFIRME_PRIMEIRO,
  criarConta,
  emailValido,
  entrarComPalavraPasse,
  pedirLinkDeEntrada,
  pedirNovaPalavraPasse,
  porConfirmar,
} from "../lib/entrada";
import { entrarComGoogle } from "../lib/google";
import { guardarDepoisDeEntrar, type DepoisDeEntrar } from "../lib/guardado";
import { CORES } from "../tema";
// O mínimo é o do site (o mesmo do registo e do repor): uma regra só.
import { MINIMO_DA_PALAVRA_PASSE } from "../../../src/lib/palavra-passe-minima";

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

/**
 * O EMAIL E A PALAVRA-PASSE (01-11-2026) — ao lado do Google e do link, não em
 * vez deles: «Entrar» (a forma por omissão), «Criar conta» (o site manda um
 * email para a confirmar), «Esqueci-me da palavra-passe» (o link abre no site)
 * e «Prefiro receber um link por email» (o link de sempre).
 */
type ModoDaEntrada = "palavra-passe" | "criar" | "esqueci" | "link";

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
  erroInicial = null,
  antesDoGoogle,
  seOGoogleFalhar,
}: {
  /** Para onde voltar depois de entrar pelo link do email. */
  depois?: DepoisDeEntrar;
  /** Depois de entrar com o Google (a sessão já está guardada). */
  aoEntrar?: () => void;
  emailInicial?: string;
  /** Uma mensagem a mostrar logo (o Google que falhou com a folha fechada). */
  erroInicial?: string | null;
  /**
   * Dentro de uma folha (E3.F): fecha-a antes de abrir o Google. A janela do
   * Google por cima de uma folha aberta podia deixar o fundo escuro da folha
   * preso no ecrã quando ela fechava ao entrar.
   */
  antesDoGoogle?: () => void;
  /** O Google falhou ou foi cancelado com a folha fechada: quem a abriu volta a abri-la com a mensagem. */
  seOGoogleFalhar?: (mensagem: string | null) => void;
}) {
  const { entrarComSessaoNova } = useSessao();
  const googleNoSite = useGoogleNoSite();
  const [email, setEmail] = useState(emailInicial);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [noGoogle, setNoGoogle] = useState(false);
  const [erro, setErro] = useState<string | null>(erroInicial);
  const [falta, setFalta] = useState(0);
  // Email e palavra-passe (01-11-2026): a forma por omissão, ao lado do Google e do link.
  const [modo, setModo] = useState<ModoDaEntrada>("palavra-passe");
  const [nome, setNome] = useState("");
  const [palavraPasse, setPalavraPasse] = useState("");
  const [ver, setVer] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aTratar, setATratar] = useState(false);

  function mudarDeModo(novo: ModoDaEntrada) {
    setModo(novo);
    setErro(null);
    setAviso(null);
    setFeito(null);
    setPalavraPasse("");
    setVer(false);
  }

  async function entrarComSenha() {
    if (!emailValido(email)) return setErro("Escreva o seu email.");
    if (!palavraPasse) return setErro("Escreva a sua palavra-passe.");
    setErro(null);
    setAviso(null);
    setATratar(true);
    let entrou = false;
    try {
      const sessao = await entrarComPalavraPasse({ pedir, email, palavraPasse });
      await entrarComSessaoNova(sessao);
      entrou = true;
    } catch (e) {
      if (porConfirmar(e)) setAviso(CONFIRME_PRIMEIRO);
      else setErro(mensagemDe(e, "Não foi possível entrar agora."));
    } finally {
      setATratar(false);
    }
    if (entrou) aoEntrar?.();
  }

  async function criar() {
    if (!nome.trim()) return setErro("Escreva o seu nome.");
    if (!emailValido(email)) return setErro("Escreva o seu email.");
    if (palavraPasse.length < MINIMO_DA_PALAVRA_PASSE) return setErro(`A palavra-passe precisa de pelo menos ${MINIMO_DA_PALAVRA_PASSE} caracteres.`);
    setErro(null);
    setATratar(true);
    try {
      setFeito(await criarConta({ pedir, nome, email, palavraPasse }));
      setPalavraPasse("");
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível criar a conta agora."));
    } finally {
      setATratar(false);
    }
  }

  async function esqueci() {
    if (!emailValido(email)) return setErro("Escreva o seu email.");
    setErro(null);
    setATratar(true);
    try {
      setFeito(await pedirNovaPalavraPasse({ pedir, email }));
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível enviar o link agora."));
    } finally {
      setATratar(false);
    }
  }

  const campoDoEmail = (aoAcabar: () => void) => (
    <Campo
      rotulo="Email"
      valor={email}
      aoMudar={setEmail}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
      keyboardType="email-address"
      textContentType="emailAddress"
      returnKeyType={modo === "esqueci" ? "send" : "next"}
      onSubmitEditing={modo === "esqueci" ? aoAcabar : undefined}
    />
  );

  const campoDaPalavraPasse = (aoAcabar: () => void, nova: boolean) => (
    <View style={{ gap: 2 }}>
      <Campo
        rotulo="Palavra-passe"
        valor={palavraPasse}
        aoMudar={setPalavraPasse}
        secureTextEntry={!ver}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={nova ? "new-password" : "current-password"}
        textContentType={nova ? "newPassword" : "password"}
        returnKeyType="go"
        onSubmitEditing={aoAcabar}
        ajuda={nova ? `Pelo menos ${MINIMO_DA_PALAVRA_PASSE} caracteres.` : null}
      />
      <Ligacao titulo={ver ? "Esconder a palavra-passe" : "Mostrar a palavra-passe"} tom="suave" aoCarregar={() => setVer(!ver)} />
    </View>
  );

  const avisos = (
    <>
      {aviso ? <Aviso texto={aviso} tom="aviso" /> : null}
      {erro ? <Aviso texto={erro} tom="mau" /> : null}
    </>
  );

  useEffect(() => {
    if (falta <= 0) return;
    const t = setTimeout(() => setFalta((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [falta]);

  const mostrarGoogle = googleNoSite && GOOGLE_NESTA_VERSAO;

  async function google() {
    setErro(null);
    setNoGoogle(true);
    antesDoGoogle?.();
    let entrou = false;
    let mensagem: string | null = null;
    try {
      const r = await entrarComGoogle();
      if (r.tipo === "erro") mensagem = r.mensagem;
      if (r.tipo === "sessao") {
        await entrarComSessaoNova(r.sessao);
        entrou = true;
        aoEntrar?.();
      }
    } catch {
      mensagem = "Não foi possível entrar com o Google agora.";
    } finally {
      if (!entrou) {
        if (antesDoGoogle) seOGoogleFalhar?.(mensagem);
        else setErro(mensagem);
      }
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

      {modo === "palavra-passe" ? (
        <View style={{ gap: 12 }}>
          {campoDoEmail(() => void entrarComSenha())}
          {campoDaPalavraPasse(() => void entrarComSenha(), false)}
          <Botao titulo="Entrar" ocupado={aTratar} aoCarregar={() => void entrarComSenha()} />
          {avisos}
          <Ligacao titulo="Esqueci-me da palavra-passe" centrada aoCarregar={() => mudarDeModo("esqueci")} />
          <View style={{ height: 1, backgroundColor: CORES.linha }} />
          <Botao titulo="Criar conta" tipo="secundario" aoCarregar={() => mudarDeModo("criar")} />
          <Ligacao titulo="Prefiro receber um link por email" centrada aoCarregar={() => mudarDeModo("link")} />
        </View>
      ) : modo === "criar" ? (
        feito ? (
          <View style={{ gap: 12 }}>
            <Aviso tom="bom" texto={feito} />
            <Botao titulo="Entrar com o email e a palavra-passe" aoCarregar={() => mudarDeModo("palavra-passe")} />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Campo rotulo="Nome" valor={nome} aoMudar={setNome} autoCapitalize="words" autoComplete="name" textContentType="name" returnKeyType="next" />
            {campoDoEmail(() => void criar())}
            {campoDaPalavraPasse(() => void criar(), true)}
            <Botao titulo="Criar conta" ocupado={aTratar} aoCarregar={() => void criar()} />
            {avisos}
            <Ligacao titulo="Já tenho conta" centrada aoCarregar={() => mudarDeModo("palavra-passe")} />
          </View>
        )
      ) : modo === "esqueci" ? (
        <View style={{ gap: 12 }}>
          {feito ? (
            <Aviso tom="bom" texto={feito} />
          ) : (
            <>
              <Paragrafo suave>Escreva o email da sua conta. Enviamos um link para escolher uma palavra-passe nova, que abre no navegador.</Paragrafo>
              {campoDoEmail(() => void esqueci())}
              <Botao titulo="Enviar o link" ocupado={aTratar} aoCarregar={() => void esqueci()} />
              {avisos}
            </>
          )}
          <Ligacao titulo="Voltar a entrar" centrada aoCarregar={() => mudarDeModo("palavra-passe")} />
        </View>
      ) : enviado ? (
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

      {modo === "link" ? (
        <>
          {avisos}
          <Ligacao titulo="Entrar com a palavra-passe" centrada aoCarregar={() => mudarDeModo("palavra-passe")} />
          <Paragrafo pequeno suave>
            Se nunca entrou, a conta cria-se ao entrar. Use o mesmo email com que fez os seus pedidos, para os ver aqui.
          </Paragrafo>
        </>
      ) : (
        <Paragrafo pequeno suave>
          Use o mesmo email com que fez os seus pedidos, para os ver aqui.
        </Paragrafo>
      )}
    </View>
  );
}
