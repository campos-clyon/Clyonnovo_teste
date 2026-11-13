import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./Texto";
import { Aviso, Cartao, Ligacao, Subtitulo } from "./ui";
import { abrirNoNavegador } from "../lib/abrir";
import { mensagemDe, pedir } from "../lib/api";
import type { Pedir } from "../lib/erros";
import {
  rotaDePagarAoParceiro,
  ROTA_DE_PAGAR_AO_PARCEIRO,
  SO_PARA_ESTES_DADOS,
  type VistoDoPagarAoParceiro,
} from "../lib/pagar-ao-parceiro";
import { CORES } from "../tema";

/**
 * PAGAR AO PARCEIRO — d10, o modelo de 15-11-2026. O mesmo bloco do pedido no
 * site (`src/components/PagarAoParceiro.tsx`): o total (as duas faturas), o tipo
 * de fatura do parceiro, o IBAN e o MB WAY dele, a escolha de como paga e as
 * faturas já juntas.
 *
 * Pergunta tudo a `/api/pagamentos/ao-parceiro`, que decide. Fora do modelo novo
 * (antes de 15-11, um trabalho já pago à CLYON, um Trabalho CLYON) a resposta é
 * `pagaAoParceiro: false` e este bloco não desenha nada. O IBAN e o MB WAY só
 * vêm ao cliente que contratou, depois de contratar.
 */
export function PagarAoParceiro({
  pedidoId,
  negociacaoId,
  pedirComo = pedir,
}: {
  pedidoId: number;
  negociacaoId: number;
  pedirComo?: Pedir;
}) {
  const [visto, setVisto] = useState<VistoDoPagarAoParceiro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const ler = useCallback(async () => {
    try {
      setVisto(await pedirComo<VistoDoPagarAoParceiro>(rotaDePagarAoParceiro(pedidoId, negociacaoId)));
    } catch {
      // Sem resposta, não se mostra nada: o resto do pedido continua.
    }
  }, [pedidoId, negociacaoId, pedirComo]);

  useEffect(() => {
    void ler();
  }, [ler]);

  async function escolher(id: string) {
    setAGravar(true);
    setErro(null);
    try {
      setVisto(
        await pedirComo<VistoDoPagarAoParceiro>(ROTA_DE_PAGAR_AO_PARCEIRO, {
          metodo: "POST",
          corpo: { pedidoId, negociacaoId, comoPagar: id },
        }),
      );
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível guardar. Tente novamente."));
    } finally {
      setAGravar(false);
    }
  }

  async function copiar(rotulo: string, valor: string) {
    try {
      await Clipboard.setStringAsync(valor.replace(/\s/g, ""));
      setCopiado(rotulo);
    } catch {
      /* sem área de transferência: o valor está à vista */
    }
  }

  if (!visto?.pagaAoParceiro) return null;
  const p = visto.paraPagar;
  return (
    <Cartao>
      <Subtitulo>{visto.parceiro ? `Pagar a ${visto.parceiro}` : "Pagar ao parceiro"}</Subtitulo>
      {visto.frase ? <Text style={{ color: CORES.tinta, fontSize: 14.5, lineHeight: 21 }}>{visto.frase}</Text> : null}
      {visto.perfilFiscal ? (
        <Text style={{ color: CORES.suave, fontSize: 13.5 }}>
          {visto.perfilFiscal.guia ? `${visto.perfilFiscal.fatura} · ${visto.perfilFiscal.guia}` : visto.perfilFiscal.fatura}
        </Text>
      ) : null}
      {p ? (
        <View style={{ gap: 8 }}>
          {p.iban ? <Dado rotulo="IBAN" valor={p.iban} nota={p.titular} aoCopiar={() => void copiar("IBAN", p.iban ?? "")} copiado={copiado === "IBAN"} /> : null}
          {p.mbway ? <Dado rotulo="MB WAY" valor={p.mbway} aoCopiar={() => void copiar("MB WAY", p.mbway ?? "")} copiado={copiado === "MB WAY"} /> : null}
        </View>
      ) : null}
      <Text style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 18 }}>{SO_PARA_ESTES_DADOS}</Text>
      {visto.opcoes && visto.opcoes.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: CORES.tinta, fontSize: 14.5, fontWeight: "700" }}>Como vai pagar</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {visto.opcoes.map((o) => {
              const escolhida = visto.comoPagar === o.id;
              return (
                <Pressable
                  key={o.id}
                  disabled={aGravar}
                  onPress={() => void escolher(o.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: escolhida, disabled: aGravar }}
                  style={{
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    borderColor: escolhida ? CORES.tinta : CORES.linhaForte,
                    backgroundColor: escolhida ? CORES.tinta : CORES.fundo,
                    opacity: aGravar ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: escolhida ? CORES.fundo : CORES.tinta, fontSize: 14, fontWeight: "600" }}>{o.curta}</Text>
                </Pressable>
              );
            })}
          </View>
          {visto.opcoes.find((o) => o.id === visto.comoPagar)?.cliente ? (
            <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>{visto.opcoes.find((o) => o.id === visto.comoPagar)?.cliente}</Text>
          ) : null}
        </View>
      ) : null}
      {erro ? <Aviso tom="mau" texto={erro} /> : null}
      {visto.faturas ? (
        <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: CORES.linha, paddingTop: 10 }}>
          <Text style={{ color: CORES.suave, fontSize: 13.5, lineHeight: 19 }}>{visto.faturas.frase}</Text>
          {visto.faturas.doTrabalho ? (
            <Ligacao titulo="Fatura do trabalho" aoCarregar={() => abrirNoNavegador(visto.faturas?.doTrabalho?.url ?? "")} />
          ) : (
            <Text style={{ color: CORES.suave, fontSize: 13.5 }}>Fatura do trabalho: ainda não foi junta</Text>
          )}
          {visto.faturas.daTaxa ? (
            <Ligacao titulo="Fatura da taxa da plataforma" aoCarregar={() => abrirNoNavegador(visto.faturas?.daTaxa?.url ?? "")} />
          ) : (
            <Text style={{ color: CORES.suave, fontSize: 13.5 }}>Fatura da taxa da plataforma: ainda não foi junta</Text>
          )}
        </View>
      ) : null}
    </Cartao>
  );
}

function Dado({
  rotulo,
  valor,
  nota,
  aoCopiar,
  copiado,
}: {
  rotulo: string;
  valor: string;
  nota?: string | null;
  aoCopiar: () => void;
  copiado: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: CORES.superficie, borderRadius: 12, padding: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: CORES.suave, fontSize: 12.5 }}>{rotulo}</Text>
        <Text selectable style={{ color: CORES.tinta, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
          {valor}
        </Text>
        {nota ? <Text style={{ color: CORES.suave, fontSize: 12.5 }}>{nota}</Text> : null}
      </View>
      <Pressable onPress={aoCopiar} accessibilityRole="button" accessibilityLabel={`Copiar o ${rotulo}`} hitSlop={8}>
        <Text style={{ color: CORES.marca, fontWeight: "700", fontSize: 13.5 }}>{copiado ? "Copiado" : "Copiar"}</Text>
      </Pressable>
    </View>
  );
}
