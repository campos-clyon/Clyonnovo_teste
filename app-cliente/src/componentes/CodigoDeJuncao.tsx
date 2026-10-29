import { useState } from "react";
import { View } from "react-native";
import { Aviso, Botao, Campo, Ligacao, Paragrafo, Titulo } from "./ui";
import { whatsappDaClyon } from "../lib/abrir";
import { CODIGO_DE_JUNCAO, JUNCAO, type ResultadoDaJuncao } from "../lib/pedido-do-link";

/**
 * JUNTAR O PEDIDO À CONTA COM O CÓDIGO (R13 da Segurança, S16).
 *
 * A CLYON mandou um código de 6 algarismos por WhatsApp ao telefone do
 * pedido: escreve-se aqui. Errado → a frase do site e tenta outra vez;
 * expirado → «Pedir outro código»; à espera da Mesa → a frase do site e
 * nada para escrever. O texto de cada caso vem da API (`error`).
 */
export function CodigoDeJuncao({
  pedidoId,
  inicial,
  juntar,
  aoJuntar,
  aoVoltar,
}: {
  pedidoId: number;
  inicial: ResultadoDaJuncao;
  juntar: (codigo?: string) => Promise<ResultadoDaJuncao | null>;
  aoJuntar: (id: number) => void;
  aoVoltar: () => void;
}) {
  const [r, setR] = useState<ResultadoDaJuncao>(inicial);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function chamar(com?: string) {
    setErro(null);
    setOcupado(true);
    try {
      const novo = await juntar(com);
      if (!novo) return aoVoltar();
      if (novo.estado === "seu") return aoJuntar(novo.id);
      if (novo.estado === "errado") setErro(novo.mensagem);
      else setR(novo);
    } finally {
      setOcupado(false);
    }
  }

  if (r.estado === "seu") return null;
  const mesa = r.estado === "aEsperaDaMesa";
  const escrever = r.estado === "aConfirmar" || r.estado === "errado";

  return (
    <View style={{ gap: 16 }}>
      <Titulo>{mesa ? JUNCAO.mesaTitulo : JUNCAO.titulo}</Titulo>
      <Aviso texto={r.mensagem} tom={mesa || escrever ? "neutro" : "aviso"} />
      {escrever ? (
        <>
          <Campo
            rotulo={JUNCAO.campo}
            valor={codigo}
            aoMudar={(v) => setCodigo(v.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            maxLength={6}
          />
          {erro ? <Aviso texto={erro} tom="mau" /> : null}
          <Botao
            titulo={JUNCAO.confirmar}
            ocupado={ocupado}
            aoCarregar={() => (CODIGO_DE_JUNCAO.test(codigo) ? void chamar(codigo) : setErro(JUNCAO.formato))}
          />
        </>
      ) : null}
      {r.estado === "expirado" || r.estado === "aConfirmar" || r.estado === "errado" ? (
        <Ligacao titulo={JUNCAO.outroCodigo} centrada aoCarregar={() => void chamar()} />
      ) : null}
      {r.estado === "outro" || r.estado === "muitos" ? (
        <Paragrafo suave>Se precisar, a CLYON ajuda pelo WhatsApp.</Paragrafo>
      ) : null}
      <Ligacao titulo="Falar com a CLYON por WhatsApp" aoCarregar={() => whatsappDaClyon(`Pedido #${pedidoId}: queria juntá-lo à minha conta.`)} />
      <Botao titulo="Voltar" tipo="secundario" aoCarregar={aoVoltar} />
    </View>
  );
}
