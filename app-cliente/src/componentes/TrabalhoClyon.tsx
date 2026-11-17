import { useState } from "react";
import { View } from "react-native";
import { Acompanhar } from "./Acompanhar";
import { Avaliar } from "./Avaliar";
import { ResumoDoPagamento } from "./Pagar";
import { PagarAoParceiro } from "./PagarAoParceiro";
import type { Pedir } from "../lib/erros";
import { Preco } from "./Preco";
import { Text } from "./Texto";
import { Botao, Cartao, Confirmacao, Ligacao, Paragrafo, Subtitulo } from "./ui";
import { whatsappDaClyon } from "../lib/abrir";
import { momentoDoTrabalhoClyon, negociacaoDoFimClyon, type Pedido, type PedidoV3 } from "../lib/pedidos";
import { CORES } from "../tema";
import { aceitouOPrecoNaData } from "../../../src/lib/frases-do-pedido";

/**
 * E5d — TRABALHO CLYON DE VALOR FIXO (P2, 28-10-2026).
 *
 * Sem propostas (a R5 manda `negociacoes: []`). Nunca «a nossa proposta» nem
 * «a CLYON faz»: o trabalho é feito por um parceiro da CLYON («verificado» só com as três confirmações, 01-11-2026).
 * O preço só aparece depois de a CLYON o enviar (`valorClyon.versao`, S7);
 * «Aceito este preço» manda a `versao` — se o preço mudou entretanto, o site
 * responde 409 e a app recarrega.
 *
 * O FIM (d6, 31-10-2026): depois de «O trabalho é feito por …», pela ordem de
 * uma negociação — o dia combinado, o pagamento (a referência da CLYON, ou
 * pagar sozinho), «A CLYON confirma consigo quando o trabalho estiver feito»
 * e, depois de confirmado, «Como correu com {nome}?». Com os mesmos ecrãs das
 * negociações (Pagar, Acompanhar, Avaliar), a partir de `pedido.fimClyon`.
 *
 * O MODELO DE 15-11 (d54, 17-11-2026): um Trabalho CLYON criado a partir do
 * corte paga-se ao parceiro — o bloco «Pagar a …» das negociações, e nenhuma
 * referência da CLYON. Decide o servidor, pelo `pagamento` do `fimClyon`.
 */
export function TrabalhoClyon({
  pedido,
  agir,
  aoMudar,
  aoPedirOutraVez,
  aoCriarConta,
  convidado = false,
  pedirComo,
}: {
  pedido: Pedido;
  agir: (corpo: Record<string, unknown>) => Promise<string | null>;
  /** Pelo link, sem conta: o bloco «Pagar a …» só aparece depois de criar conta (como nas negociações). */
  convidado?: boolean;
  /** O mesmo `pedir` da vista do pedido, para o bloco «Pagar a …» perguntar à rota quando a R5 não o traz. */
  pedirComo?: Pedir;
  /** Depois de um pagamento: ler o pedido outra vez. */
  aoMudar?: () => void;
  aoPedirOutraVez?: () => void;
  /** Pelo link, sem conta: «Criar conta para pagar». */
  aoCriarConta?: () => void;
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
    const fim = (pedido as PedidoV3).fimClyon ?? null;
    const n = fim ? negociacaoDoFimClyon(fim) : null;
    return (
      <View style={{ gap: 12 }}>
        <Cartao>
          <Paragrafo>{fim?.textos.quemFaz ?? `O trabalho é feito por ${m.quemFaz}, parceiro da CLYON.`}</Paragrafo>
          {m.valor ? <Preco preco={m.valor} /> : null}
          {fim ? <Text style={{ color: CORES.tinta, fontSize: 14.5, fontWeight: "600" }}>{fim.textos.dia}</Text> : null}
          {fim?.textos.aClyonConfirma ? <Paragrafo suave>{fim.textos.aClyonConfirma}</Paragrafo> : null}
          {whatsapp}
        </Cartao>
        {fim && n ? (
          <>
            <Avaliar pedidoId={pedido.id} n={n} agir={agir} aoPedirOutraVez={aoPedirOutraVez ?? (() => {})} />
            {n.pagamento && !n.pagamento.pagaAoParceiro ? (
              <Cartao>
                <ResumoDoPagamento pedidoId={pedido.id} n={n} aoMudar={aoMudar ?? (() => {})} aoCriarConta={aoCriarConta} telefoneSugerido={pedido.telefone ?? null} />
              </Cartao>
            ) : null}
            {/*
              d54 (17-11-2026): um Trabalho CLYON do modelo de 15-11 paga-se ao parceiro, como as negociações —
              o mesmo bloco «Pagar a …», sem referência da CLYON. Quem decide é o servidor (`pagamento.pagaAoParceiro`
              e `pagamento.aoParceiro`, ou a rota quando a R5 não o manda); fora do modelo novo não desenha nada.
              O convidado vê-o depois de criar conta.
            */}
            {!convidado ? (
              <PagarAoParceiro
                pedidoId={pedido.id}
                negociacaoId={fim.negociacaoId}
                pedirComo={pedirComo}
                daR5={n.pagamento ? n.pagamento.aoParceiro : undefined}
              />
            ) : null}
            <Acompanhar pedidoId={pedido.id} n={n} agir={agir} />
          </>
        ) : null}
      </View>
    );
  }

  if (m.momento === "aceite") {
    return (
      <Cartao>
        <Subtitulo>Preço fechado pela CLYON</Subtitulo>
        <Preco preco={m.valor} />
        <Paragrafo>
          {`${aceitouOPrecoNaData(m.aceiteEmTexto)} A CLYON está a escolher o parceiro que faz o trabalho e avisa-o aqui.`}
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
      {/*
        d54 (17-11-2026): sem «a CLYON guarda o pagamento» — num Trabalho CLYON do modelo de 15-11 o cliente paga
        ao parceiro. Antes de haver parceiro a R5 não diz o modelo; a frase serve aos dois, e o pagamento
        aparece depois, pelo servidor.
      */}
      <Paragrafo>
        O trabalho é feito por um parceiro da CLYON. Depois de aceitar, a CLYON escolhe o parceiro e diz-lhe aqui
        quem é e como pagar.
      </Paragrafo>
      <Botao titulo="Aceito este preço" aoCarregar={() => setAConfirmar(true)} />
      {whatsapp}
      <Confirmacao
        visivel={aConfirmar}
        titulo="Aceitar este preço?"
        texto={`${m.valor.principal}.${m.valor.nota ? ` ${m.valor.nota}` : ""} A CLYON escolhe o parceiro que faz o trabalho e avisa-o aqui, com o nome dele.`}
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
