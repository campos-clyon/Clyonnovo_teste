import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "./Texto";
import { Botao, Confirmacao, Paragrafo } from "./ui";
import { useSessao } from "../estado/Sessao";
import { devePerguntarPelosAvisos, ligarAvisos, marcarQueJaPerguntou } from "../lib/avisos";
import { guardarNoCofre, lerDoCofre } from "../lib/sessao";
import { CORES } from "../tema";

/**
 * O PRIMEIRO USO, NO INÍCIO — 24-11-2026 (d108, P5 do Produto).
 *
 * 1. «Entre para vermos que chegou»: um cartão suave para quem abre a app sem
 *    sessão. Quem está no teste da Play e não entra conta como «Nunca entrou»;
 *    entrando, a abertura fica registada na conta. «Agora não» esconde-o
 *    durante `DIAS_SEM_O_CARTAO` dias.
 * 2. Os avisos, UMA vez, logo no primeiro uso, com o porquê. O «Agora não»
 *    fica guardado (`marcarQueJaPerguntou`) e nunca mais se pergunta — nem no
 *    E4. O «Sim» pede a autorização ao sistema; se o sistema disser que não,
 *    respeita-se também.
 */

export const DIAS_SEM_O_CARTAO = 7;
const CARTAO_ESCONDIDO_ATE = "clyon-cliente-cartao-do-teste-ate";

export const ENTRE_PARA_VERMOS = {
  titulo: "Entre para vermos que chegou",
  texto: "Está no teste da app CLYON? Entre com o email da sua conta e ficamos a saber que a app lhe chegou. Obrigado!",
} as const;

export const PERGUNTA_DOS_AVISOS = {
  titulo: "Quer receber avisos dos seus pedidos?",
  texto: "Avisamos no telemóvel quando chegar uma proposta de um parceiro e quando o seu pedido mudar.",
  pequeno: "Pode desligá-los quando quiser, no Perfil ou nas definições do telemóvel.",
  confirmar: "Sim, quero avisos",
  voltar: "Agora não",
} as const;

function EntreParaVermos() {
  const { ligado, carregando } = useSessao();
  const [escondido, setEscondido] = useState(true);
  useEffect(() => {
    let vivo = true;
    void lerDoCofre(CARTAO_ESCONDIDO_ATE)
      .then((ate) => {
        if (vivo) setEscondido(!!ate && Number(ate) > Date.now());
      })
      .catch(() => {
        if (vivo) setEscondido(false);
      });
    return () => {
      vivo = false;
    };
  }, []);
  if (ligado || carregando || escondido) return null;
  return (
    <View style={{ borderRadius: 20, borderWidth: 1, borderColor: CORES.linha, padding: 16, gap: 10 }}>
      <Text titulo style={{ color: CORES.tinta, fontSize: 16, fontWeight: "600" }}>
        {ENTRE_PARA_VERMOS.titulo}
      </Text>
      <Paragrafo suave>{ENTRE_PARA_VERMOS.texto}</Paragrafo>
      <Botao titulo="Entrar" aoCarregar={() => router.push("/entrar")} />
      <Botao
        titulo="Agora não"
        tipo="secundario"
        aoCarregar={() => {
          setEscondido(true);
          void guardarNoCofre(CARTAO_ESCONDIDO_ATE, String(Date.now() + DIAS_SEM_O_CARTAO * 24 * 60 * 60 * 1000));
        }}
      />
    </View>
  );
}

function PedirOsAvisosUmaVez() {
  const [perguntar, setPerguntar] = useState(false);
  useEffect(() => {
    let vivo = true;
    void devePerguntarPelosAvisos().then((sim) => {
      if (vivo) setPerguntar(sim);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return (
    <Confirmacao
      visivel={perguntar}
      titulo={PERGUNTA_DOS_AVISOS.titulo}
      texto={PERGUNTA_DOS_AVISOS.texto}
      pequeno={PERGUNTA_DOS_AVISOS.pequeno}
      confirmar={PERGUNTA_DOS_AVISOS.confirmar}
      voltar={PERGUNTA_DOS_AVISOS.voltar}
      aoConfirmar={() => {
        setPerguntar(false);
        void marcarQueJaPerguntou().then(() => ligarAvisos());
      }}
      aoVoltar={() => {
        setPerguntar(false);
        void marcarQueJaPerguntou();
      }}
    />
  );
}

export function PrimeiroUso() {
  return (
    <>
      <EntreParaVermos />
      <PedirOsAvisosUmaVez />
    </>
  );
}
