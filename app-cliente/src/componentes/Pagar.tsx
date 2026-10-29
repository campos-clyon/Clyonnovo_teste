import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, View } from "react-native";
import { Text } from "./Texto";
import { Aviso, Botao, Campo, Cartao, Ligacao, Subtitulo } from "./ui";
import { mensagemDe, pedir } from "../lib/api";
import { corpoDoPagamento, type Negociacao } from "../lib/pedidos";
import { CORES } from "../tema";

/**
 * E7 — PAGAR (no pedido contratado, por cima do acompanhamento).
 *
 * Mostra o que a R5 manda em `pagamento` — o mesmo estado do
 * `GET /api/pagamentos`: a referência que a CLYON criou (com «Copiar»), o MB
 * WAY por confirmar, «Pago a …», ou «Paga ao profissional, no local.». Os
 * botões para criar o pagamento só aparecem quando o site os abre
 * (`disponivel: true`). Por baixo, como se paga, da API (`formaTexto`).
 */

const MB_WAY = "mbway";
const CONSULTA_MS = 5_000;
const CONSULTA_DURANTE_MS = 5 * 60_000;

function Copiavel({ rotulo, valor }: { rotulo: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 }}>
      <Text style={{ width: 92, color: CORES.suave, fontSize: 14 }}>{rotulo}</Text>
      <Text style={{ flex: 1, color: CORES.tinta, fontSize: 17, fontWeight: "700" }} selectable numberOfLines={1}>
        {valor}
      </Text>
      <Ligacao
        titulo={copiado ? "Copiado" : "Copiar"}
        aoCarregar={() => {
          void Clipboard.setStringAsync(valor.replace(/\s/g, "")).then(() => setCopiado(true));
        }}
      />
    </View>
  );
}

export function Pagar({
  pedidoId,
  n,
  aoMudar,
  aoCriarConta,
}: {
  pedidoId: number;
  n: Negociacao;
  aoMudar: () => void;
  /** Pelo link, sem conta (A9): nunca cria um pagamento — «Criar conta para pagar». */
  aoCriarConta?: () => void;
}) {
  const pg = n.pagamento;
  const [telemovel, setTelemovel] = useState("");
  // Como o site: a escolha da fatura, com os dois valores da API (v3; antes ia sempre com fatura).
  const [comFactura, setComFactura] = useState(true);
  const [aCriar, setACriar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mbWayPendente = !!pg?.pendentes.some((p) => p.metodo === MB_WAY);

  // Enquanto há um MB WAY por confirmar: de 5 em 5 s durante 5 min; depois só ao abrir.
  useEffect(() => {
    if (!mbWayPendente) return;
    const inicio = Date.now();
    const t = setInterval(() => {
      if (Date.now() - inicio > CONSULTA_DURANTE_MS) clearInterval(t);
      else aoMudar();
    }, CONSULTA_MS);
    return () => clearInterval(t);
  }, [mbWayPendente, aoMudar]);

  if (!pg) return null;

  async function criar(metodo: "mbway" | "multibanco") {
    setErro(null);
    setACriar(metodo);
    try {
      await pedir("/api/pagamentos", {
        metodo: "POST",
        corpo: corpoDoPagamento({ pedidoId, negociacaoId: n.id, metodo, comFactura: pg?.ivaIncluido ? true : comFactura, telemovel }),
      });
      aoMudar();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setACriar(null);
    }
  }

  return (
    <Cartao destaque={!pg.pago && !pg.emDinheiroAoProfissional}>
      {pg.pago ? (
        <Text style={{ color: CORES.bom, fontSize: 16, fontWeight: "700" }}>
          {pg.pagoEmTexto ? `Pago a ${pg.pagoEmTexto}.` : "Pago."}
        </Text>
      ) : pg.emDinheiroAoProfissional ? (
        <Text style={{ color: CORES.tinta, fontSize: 15 }}>Paga ao profissional, no local.</Text>
      ) : pg.pendentes.length > 0 ? (
        pg.pendentes.map((p, i) =>
          p.metodo === MB_WAY ? (
            <View key={i} style={{ gap: 6 }}>
              <Subtitulo>Pagamento por MB WAY</Subtitulo>
              <Text style={{ color: CORES.tinta, fontSize: 15 }}>Confirme o pagamento na app MB WAY do telemóvel.</Text>
              <Text style={{ color: CORES.tinta, fontSize: 17, fontWeight: "700" }}>{p.valorTexto}</Text>
            </View>
          ) : (
            <View key={i} style={{ gap: 4 }}>
              <Subtitulo>Pagamento por Multibanco</Subtitulo>
              {p.entidade ? <Copiavel rotulo="Entidade" valor={p.entidade} /> : null}
              {p.referencia ? <Copiavel rotulo="Referência" valor={p.referencia} /> : null}
              <Copiavel rotulo="Valor" valor={p.valorTexto} />
              {p.expiraEmTexto ? <Text style={{ color: CORES.suave, fontSize: 13 }}>{`Válida até ${p.expiraEmTexto}`}</Text> : null}
            </View>
          ),
        )
      ) : pg.disponivel && aoCriarConta ? (
        <View style={{ gap: 10 }}>
          <Subtitulo>Pagar</Subtitulo>
          <Text style={{ color: CORES.tinta, fontSize: 17, fontWeight: "700" }}>{pg.valoresTexto.comFactura}</Text>
          <Botao titulo="Criar conta para pagar" aoCarregar={aoCriarConta} />
        </View>
      ) : pg.disponivel ? (
        <View style={{ gap: 10 }}>
          <Subtitulo>Pagar</Subtitulo>
          {!pg.ivaIncluido && pg.valoresTexto.semFactura && pg.valoresTexto.semFactura !== pg.valoresTexto.comFactura ? (
            <Pressable
              onPress={() => setComFactura((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: comFactura }}
              style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 4 }}
            >
              <Ionicons name={comFactura ? "checkbox" : "square-outline"} size={22} color={CORES.marca} />
              <Text style={{ color: CORES.tinta, fontSize: 15 }}>Com fatura</Text>
            </Pressable>
          ) : null}
          <Text style={{ color: CORES.tinta, fontSize: 17, fontWeight: "700" }}>{comFactura || pg.ivaIncluido ? pg.valoresTexto.comFactura : pg.valoresTexto.semFactura}</Text>
          <Campo rotulo="Telemóvel do MB WAY" valor={telemovel} aoMudar={setTelemovel} keyboardType="phone-pad" autoComplete="tel" />
          <Botao titulo="MB WAY" ocupado={aCriar === MB_WAY} desligado={!!aCriar} aoCarregar={() => void criar("mbway")} />
          <Botao
            titulo="Referência Multibanco"
            tipo="secundario"
            ocupado={aCriar === "multibanco"}
            desligado={!!aCriar}
            aoCarregar={() => void criar("multibanco")}
          />
        </View>
      ) : (
        <Text style={{ color: CORES.tinta, fontSize: 15 }}>A CLYON envia-lhe a referência de pagamento.</Text>
      )}
      {erro ? <Aviso texto={erro} tom="mau" /> : null}
      {n.formaTexto && !pg.emDinheiroAoProfissional ? (
        <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>{n.formaTexto}</Text>
      ) : null}
    </Cartao>
  );
}
