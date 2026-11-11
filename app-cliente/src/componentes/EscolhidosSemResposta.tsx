import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { CartaoDoParceiro } from "./CartaoDoParceiro";
import { Aviso, Botao, Cartao, Ligacao, Paragrafo, Subtitulo } from "./ui";
import type { Pedir } from "../lib/erros";
import {
  ACCOES_DOS_ESCOLHIDOS,
  agirSobreOsEscolhidos,
  botaoDeEscolherOutros,
  corpoDeEscolherOutros,
  lerOsEscolhidos,
  oQueMostrar,
  podeReler,
  saidaSemMaisNinguem,
  type BotaoDoCartao,
  type ErroDosEscolhidos,
  type ListaParaEscolherOutro,
  type VistaDosEscolhidos,
} from "../lib/escolhidos-sem-resposta";
import { alternarParceiro } from "../lib/parceiros-da-mudanca";

/**
 * OS PARCEIROS QUE ESCOLHEU AINDA NÃO RESPONDERAM — 11-11-2026 (d6), o cartão
 * do ecrã do pedido do site (`EscolhidosSemResposta.tsx`) na app.
 *
 * Enquanto o prazo corre, a linha «têm até às HH:MM para responder»; quando
 * passa sem resposta, o cartão com as três saídas — esperar, escolher outro
 * parceiro da lista ou pedir à CLYON que procure. O aviso no telemóvel
 * (`tipo: "escolhidos_sem_resposta"`) abre este pedido.
 *
 * Os textos, os botões e a acção de cada um vêm da rota das acções (R8); este
 * ecrã não decide nada (`lib/escolhidos-sem-resposta.ts`).
 */
export function EscolhidosSemResposta({
  pedidoId,
  pedir,
  activo,
  releitura,
  aoMudar,
}: {
  pedidoId: number;
  /** O `pedir` da conta ou o do convidado (o link sem conta). */
  pedir: Pedir;
  /** Só enquanto se espera pelos escolhidos (`valeAPenaLer`). */
  activo: boolean;
  /** Muda de cada vez que o ecrã relê o pedido: o cartão relê-se com ele. */
  releitura: number;
  /** Depois de uma saída: o ecrã volta a ler o pedido. */
  aoMudar: () => void;
}) {
  const [vista, setVista] = useState<VistaDosEscolhidos | null>(null);
  const [lista, setLista] = useState<ListaParaEscolherOutro | null>(null);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState<string | null>(null);
  const [erro, setErro] = useState<ErroDosEscolhidos | null>(null);
  const ultima = useRef<{ vazia: boolean; em: number } | null>(null);
  // O `pedir` do convidado pode nascer de novo a cada desenho: lê-se por referência, para a leitura não se repetir com ele.
  const pedirDeAgora = useRef(pedir);
  pedirDeAgora.current = pedir;

  const ler = useCallback(
    async (aForca = false) => {
      if (!aForca && !podeReler(ultima.current, Date.now())) return;
      const lida = await lerOsEscolhidos(pedirDeAgora.current, pedidoId);
      // Sem resposta (sem rede, por um momento), fica o que estava.
      if (!lida) return;
      ultima.current = { vazia: !lida.cartao && !lida.prazoTexto, em: Date.now() };
      setVista(lida);
    },
    [pedidoId],
  );

  useEffect(() => {
    if (activo) void ler();
  }, [activo, releitura, ler]);

  async function agir(corpo: Record<string, unknown>) {
    if (aEnviar) return;
    setAEnviar(String(corpo.accao));
    setErro(null);
    const r = await agirSobreOsEscolhidos(pedir, corpo);
    setAEnviar(null);
    if (!r.ok) {
      setErro(r.erro);
      // O preço de um deles mudou: a lista pede-se outra vez, com os preços de agora.
      if (r.erro.precoMudou) {
        const nova = await agirSobreOsEscolhidos(pedir, { pedidoId, accao: ACCOES_DOS_ESCOLHIDOS.listaParaEscolherOutro });
        if (nova.ok && nova.lista) {
          setLista(nova.lista);
          setMarcados([]);
        }
      }
      return;
    }
    if (r.lista) {
      setLista(r.lista);
      setMarcados([]);
      return;
    }
    if (corpo.accao === ACCOES_DOS_ESCOLHIDOS.escolherOutro) setEnviado(r.enviado);
    setLista(null);
    setVista(r.vista);
    ultima.current = { vazia: false, em: Date.now() };
    aoMudar();
  }

  if (!activo) return null;
  const mostra = oQueMostrar(vista, lista, enviado);
  if (!mostra && !erro) return null;

  const botao = (b: BotaoDoCartao) => (
    <Botao
      key={b.accao}
      titulo={b.texto}
      tipo={b.principal ? "principal" : "secundario"}
      ocupado={aEnviar === b.accao}
      desligado={aEnviar != null}
      aoCarregar={() => void agir({ pedidoId, accao: b.accao })}
    />
  );
  const cartao = vista?.cartao ?? null;
  const semNinguem = !!lista && lista.parceiros.length === 0;
  const semMaisNinguem = lista ? saidaSemMaisNinguem(lista, cartao) : null;
  const corpoDosMarcados = lista ? corpoDeEscolherOutros(pedidoId, lista, marcados) : null;

  return (
    <Cartao destaque={mostra === "cartao" || mostra === "lista"}>
      {erro ? (
        <View style={{ gap: 8 }}>
          <Aviso texto={erro.texto} tom="aviso" />
          {erro.botao ? (
            <Botao
              titulo={erro.botao}
              tipo="secundario"
              aoCarregar={() => {
                setErro(null);
                setLista(null);
                void ler(true);
                aoMudar();
              }}
            />
          ) : null}
        </View>
      ) : null}

      {mostra === "enviado" && enviado ? <Paragrafo>{enviado}</Paragrafo> : null}

      {mostra === "prazo" && vista?.prazoTexto ? <Paragrafo>{vista.prazoTexto}</Paragrafo> : null}

      {mostra === "cartao" && cartao ? (
        <View style={{ gap: 8 }}>
          {cartao.titulo ? <Subtitulo>{cartao.titulo}</Subtitulo> : null}
          {cartao.linha ? <Paragrafo suave>{cartao.linha}</Paragrafo> : null}
          {cartao.depois ? <Paragrafo>{cartao.depois}</Paragrafo> : null}
          {cartao.nota ? <Paragrafo>{cartao.nota}</Paragrafo> : null}
          {cartao.botoes.length > 0 ? <View style={{ gap: 10, marginTop: 4 }}>{cartao.botoes.map(botao)}</View> : null}
          {cartao.ligacoes.map((b) => (
            <Ligacao key={b.accao} titulo={b.texto} aoCarregar={() => void agir({ pedidoId, accao: b.accao })} />
          ))}
        </View>
      ) : null}

      {mostra === "lista" && lista ? (
        <View style={{ gap: 12 }}>
          <Subtitulo>{lista.titulo}</Subtitulo>
          {semNinguem ? (
            <>
              {lista.semMaisNinguem ? <Paragrafo suave>{lista.semMaisNinguem}</Paragrafo> : null}
              {semMaisNinguem ? botao(semMaisNinguem) : null}
            </>
          ) : (
            <>
              {lista.linha ? <Paragrafo suave>{lista.linha}</Paragrafo> : null}
              {lista.parceiros.map((p) => (
                <CartaoDoParceiro
                  key={p.id}
                  p={p}
                  pessoas={lista.pessoas}
                  marcado={marcados.includes(p.id)}
                  cheio={marcados.length >= lista.maximo}
                  aoTocar={() => setMarcados((m) => alternarParceiro(m, p.id, lista.maximo))}
                />
              ))}
              <Botao
                titulo={botaoDeEscolherOutros(lista, marcados.length)}
                ocupado={aEnviar === ACCOES_DOS_ESCOLHIDOS.escolherOutro}
                desligado={aEnviar != null || !corpoDosMarcados}
                aoCarregar={() => corpoDosMarcados && void agir(corpoDosMarcados)}
              />
            </>
          )}
          <Ligacao
            titulo="Voltar"
            tom="suave"
            centrada
            aoCarregar={() => {
              setErro(null);
              setLista(null);
            }}
          />
        </View>
      ) : null}
    </Cartao>
  );
}
