import { useState } from "react";
import { Preco } from "./Preco";
import { Text } from "./Texto";
import { Botao, Cartao, Confirmacao, Ligacao, Paragrafo, Subtitulo } from "./ui";
import { whatsappDaClyon } from "../lib/abrir";
import { momentoDoTrabalhoClyon, type Pedido } from "../lib/pedidos";
import { CORES } from "../tema";

/**
 * E5d — TRABALHO CLYON DE VALOR FIXO (P2, 28-10-2026).
 *
 * Sem propostas (a R5 manda `negociacoes: []`). Nunca «a nossa proposta» nem
 * «a CLYON faz»: o trabalho é feito por um profissional verificado na CLYON.
 * O preço só aparece depois de a CLYON o enviar (`valorClyon.versao`, S7);
 * «Aceito este preço» manda a `versao` — se o preço mudou entretanto, o site
 * responde 409 e a app recarrega.
 */
export function TrabalhoClyon({
  pedido,
  agir,
}: {
  pedido: Pedido;
  agir: (corpo: Record<string, unknown>) => Promise<string | null>;
}) {
  const m = momentoDoTrabalhoClyon(pedido);
  const [aConfirmar, setAConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const whatsapp = <Ligacao titulo="Falar com a CLYON por WhatsApp" aoCarregar={() => whatsappDaClyon(`Pedido #${pedido.id}`)} />;

  if (m.momento === "a-rever") {
    return (
      <Cartao>
        <Paragrafo>A CLYON está a rever o seu pedido.</Paragrafo>
        {whatsapp}
      </Cartao>
    );
  }

  if (m.momento === "com-profissional") {
    return (
      <Cartao>
        <Paragrafo>{`O trabalho é feito por ${m.quemFaz}, parceiro verificado na CLYON.`}</Paragrafo>
        {m.valor ? <Preco preco={m.valor} /> : null}
        {whatsapp}
      </Cartao>
    );
  }

  if (m.momento === "aceite") {
    return (
      <Cartao>
        <Subtitulo>Preço fechado pela CLYON</Subtitulo>
        <Preco preco={m.valor} />
        <Paragrafo>
          {`Aceitou este preço${m.aceiteEmTexto ? ` a ${m.aceiteEmTexto}` : ""}. A CLYON está a escolher o parceiro que faz o trabalho e avisa-o aqui.`}
        </Paragrafo>
        {whatsapp}
      </Cartao>
    );
  }

  async function aceitar(versao: string) {
    setOcupado(true);
    setErro(null);
    const e = await agir({ pedidoId: pedido.id, accao: "aceitar_preco_clyon", versao });
    setOcupado(false);
    if (e) setErro(e);
    else setAConfirmar(false);
  }

  return (
    <Cartao destaque>
      <Subtitulo>Preço fechado pela CLYON</Subtitulo>
      <Preco preco={m.valor} />
      <Paragrafo>
        O trabalho é feito por um parceiro verificado na CLYON; a CLYON guarda o acordo e o pagamento, e só paga ao
        parceiro depois de o trabalho estar feito.
      </Paragrafo>
      <Botao titulo="Aceito este preço" aoCarregar={() => setAConfirmar(true)} />
      {whatsapp}
      <Confirmacao
        visivel={aConfirmar}
        titulo="Aceitar este preço?"
        texto={`${m.valor.principal}.${m.valor.nota ? ` ${m.valor.nota}` : ""} A CLYON escolhe o parceiro verificado que faz o trabalho e avisa-o aqui, com o nome dele.`}
        confirmar="Aceito"
        ocupado={ocupado}
        erro={erro}
        aoConfirmar={() => void aceitar(m.versao)}
        aoVoltar={() => {
          setAConfirmar(false);
          setErro(null);
        }}
      />
      {erro && !aConfirmar ? <Text style={{ color: CORES.mau, fontSize: 14 }}>{erro}</Text> : null}
    </Cartao>
  );
}
