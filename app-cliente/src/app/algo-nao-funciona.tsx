import { useState } from "react";
import { Aviso, Botao, Campo, Ecra, Escolhas, Paragrafo, Titulo } from "../componentes/ui";
import { useSessao } from "../estado/Sessao";
import { mensagemDe } from "../lib/api";
import {
  enviarProblema,
  MAXIMO_DO_PROBLEMA,
  MINIMO_DO_PROBLEMA,
  ONDE_ACONTECEU,
  PROBLEMA_CURTO,
  PROBLEMA_RECEBIDO,
  type OndeAconteceu,
} from "../lib/algo-nao-funciona";

/**
 * «ALGO NÃO FUNCIONA?» — 24-11-2026 (d108). Abre-se da Ajuda (no Perfil e na
 * barra de cima). Onde aconteceu, o que aconteceu, Enviar.
 */
export default function AlgoNaoFunciona() {
  const { ligado } = useSessao();
  const [onde, setOnde] = useState<OndeAconteceu | undefined>(undefined);
  const [texto, setTexto] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const enviar = async () => {
    if ([...texto.trim()].length < MINIMO_DO_PROBLEMA) {
      setErro(PROBLEMA_CURTO);
      return;
    }
    setAEnviar(true);
    setErro(null);
    try {
      await enviarProblema(texto, onde ?? "outro");
      setEnviado(true);
      setTexto("");
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setAEnviar(false);
    }
  };

  if (enviado) {
    return (
      <Ecra>
        <Titulo>Algo não funciona?</Titulo>
        <Aviso texto={PROBLEMA_RECEBIDO} tom="bom" />
        <Botao titulo="Contar outra coisa" tipo="secundario" aoCarregar={() => setEnviado(false)} />
      </Ecra>
    );
  }

  return (
    <Ecra>
      <Titulo>Algo não funciona?</Titulo>
      <Paragrafo suave>Diga-nos o que aconteceu. A equipa da CLYON lê todas as mensagens.</Paragrafo>
      <Escolhas
        rotulo="Onde aconteceu?"
        opcoes={ONDE_ACONTECEU.map((o) => ({ id: o.id, nome: o.rotulo }))}
        valor={onde}
        aoEscolher={setOnde}
        recolher
      />
      <Campo
        rotulo="O que aconteceu?"
        valor={texto}
        aoMudar={(v) => {
          setTexto(v);
          if (erro) setErro(null);
        }}
        multiline
        maxLength={MAXIMO_DO_PROBLEMA}
        textAlignVertical="top"
        numberOfLines={5}
        placeholder="Por exemplo: carreguei em Enviar e não aconteceu nada."
      />
      <Paragrafo pequeno suave>
        {ligado
          ? "Vai com a versão da app, o modelo do telemóvel e o email da sua conta, para lhe podermos responder."
          : "Vai com a versão da app e o modelo do telemóvel. Sem conta, não lhe conseguimos responder: se quiser resposta, fale connosco pelo WhatsApp."}
      </Paragrafo>
      {erro ? <Aviso texto={erro} tom="mau" /> : null}
      <Botao titulo="Enviar" ocupado={aEnviar} aoCarregar={() => void enviar()} />
    </Ecra>
  );
}
