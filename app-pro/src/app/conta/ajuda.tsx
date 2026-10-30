import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { RolagemComTeclado } from "../../componentes/Teclado";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Botao, Caixa, CampoDeTexto, Escolhas, Etiqueta, Mensagem, TituloDaCaixa } from "../../componentes/ui";
import { ErroDaApi, errosPorCampo, pedir } from "../../lib/api";
import { diaCurto } from "../../lib/conta";
import {
  ASSUNTOS_DE_AJUDA,
  MINIMO_DA_MENSAGEM,
  perguntasDoProfissional,
  rotuloDoAssunto,
  taxasDaAjuda,
  type AssuntoDeAjuda,
} from "../../../../src/lib/ajuda-plataforma";
import { IDENTIFICACAO } from "../../../../src/lib/identificacao-legal";
import type { Taxas } from "../../../../src/lib/taxas-plataforma";
import { ESPACO, LETRA, RAIO, useCores } from "../../tema";

/**
 * AJUDA — o ecrã «Ajuda» do painel: as perguntas de sempre, o telefone da
 * CLYON, o que já perguntou e a resposta, e um pedido novo
 * (`/api/profissionais/ajuda`). As perguntas e os assuntos vêm do ficheiro do
 * site.
 *
 * A TAXA EM VIGOR — 28-10-2026 (d8). «Quanto é que a CLYON leva?» diz a taxa
 * que a rota manda com a lista (`taxas`), como o painel; até ela chegar (ou
 * sem ela), diz o nome da taxa sem número, e nunca um número escrito à mão.
 */

type PedidoDeAjuda = {
  id: number;
  assunto: string;
  mensagem: string;
  estado: string;
  respostas: Array<{ texto: string; em: string; por: string }>;
  createdAt: string;
};

const ESTADO: Record<string, { texto: string; tom: "aviso" | "marca" | "bom" | "neutro" }> = {
  open: { texto: "à espera de resposta", tom: "aviso" },
  in_progress: { texto: "a ser tratado", tom: "marca" },
  waiting_customer: { texto: "à espera de si", tom: "marca" },
  closed: { texto: "resolvido", tom: "bom" },
};

export default function Ajuda() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const [aberta, setAberta] = useState<number | null>(null);
  const [pedidos, setPedidos] = useState<PedidoDeAjuda[]>([]);
  const [taxas, setTaxas] = useState<Taxas | null>(null);
  const perguntas = useMemo(() => perguntasDoProfissional(taxas), [taxas]);
  const telefone = IDENTIFICACAO.telefone;

  const ler = useCallback(() => {
    void pedir<{ pedidos: PedidoDeAjuda[]; taxas?: unknown }>("/api/profissionais/ajuda")
      .then((r) => {
        setPedidos(r.pedidos ?? []);
        setTaxas(taxasDaAjuda(r.taxas));
      })
      .catch(() => {});
  }, []);
  useEffect(() => ler(), [ler]);

  return (
    <RolagemComTeclado
      style={{ backgroundColor: c.fundo }}
      contentContainerStyle={[estilos.pagina, { paddingBottom: margens.bottom + ESPACO.xxl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Caixa estilo={{ padding: 0, gap: 0, overflow: "hidden" }}>
        {perguntas.map((p, i) => {
          const aqui = aberta === i;
          return (
            <View key={p.pergunta} style={{ borderBottomWidth: i === perguntas.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: c.linha }}>
              <Pressable
                onPress={() => setAberta(aqui ? null : i)}
                accessibilityRole="button"
                accessibilityState={{ expanded: aqui }}
                style={({ pressed }) => [estilos.pergunta, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={{ flex: 1, color: c.tinta, fontWeight: "700", lineHeight: 21 }}>{p.pergunta}</Text>
                <Ionicons name={aqui ? "chevron-up" : "chevron-down"} size={18} color={c.suave} />
              </Pressable>
              {aqui ? <Text style={[estilos.resposta, { color: c.tinta }]}>{p.resposta}</Text> : null}
            </View>
          );
        })}
      </Caixa>

      <Botao titulo={`Ligar à CLYON — ${telefone}`} tipo="secundario" aoCarregar={() => void Linking.openURL(`tel:${telefone.replace(/\s/g, "")}`)} />

      {pedidos.length > 0 ? (
        <View style={{ gap: ESPACO.s }}>
          <Text style={{ color: c.suave, fontWeight: "800", fontSize: LETRA.pequena }}>O QUE JÁ PERGUNTOU</Text>
          {pedidos.map((p) => {
            const e = ESTADO[p.estado] ?? ESTADO.open;
            return (
              <Caixa key={p.id}>
                <View style={estilos.linha}>
                  <Text style={{ flex: 1, color: c.tinta, fontWeight: "700" }}>{rotuloDoAssunto(p.assunto)}</Text>
                  <Etiqueta texto={e.texto} tom={e.tom} />
                </View>
                <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>{diaCurto(p.createdAt)}</Text>
                <Text style={{ color: c.tinta, lineHeight: 21 }} numberOfLines={4}>
                  {p.mensagem}
                </Text>
                {p.respostas.map((r, i) => (
                  <View key={i} style={[estilos.resposta2, { backgroundColor: c.marcaSuave }]}>
                    <Text style={{ color: c.marca, fontWeight: "700", fontSize: LETRA.pequena }}>
                      {r.por || "CLYON"} · {diaCurto(r.em)}
                    </Text>
                    <Text style={{ color: c.tinta, lineHeight: 21 }}>{r.texto}</Text>
                  </View>
                ))}
              </Caixa>
            );
          })}
        </View>
      ) : null}

      <NovoPedido aoEnviar={ler} />
    </RolagemComTeclado>
  );
}

function NovoPedido({ aoEnviar }: { aoEnviar: () => void }) {
  const c = useCores();
  const [assunto, setAssunto] = useState<AssuntoDeAjuda>("pedidos");
  const [mensagem, setMensagem] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);

  async function enviar() {
    setAEnviar(true);
    setErros({});
    setErro(null);
    setFeito(false);
    try {
      await pedir("/api/profissionais/ajuda", { metodo: "POST", corpo: { assunto, mensagem: mensagem.trim() } });
      setMensagem("");
      setFeito(true);
      aoEnviar();
    } catch (e) {
      const porCampo = errosPorCampo(e);
      setErros(porCampo);
      if (Object.keys(porCampo).length === 0) setErro(e instanceof ErroDaApi ? e.message : "Não foi possível enviar");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <Caixa>
      <TituloDaCaixa>Escrever à CLYON</TituloDaCaixa>
      <Text style={{ color: c.tinta, fontWeight: "600" }}>Assunto</Text>
      <View style={{ gap: ESPACO.xs }}>
        {ASSUNTOS_DE_AJUDA.map((a) => {
          const activo = a.id === assunto;
          return (
            <Pressable
              key={a.id}
              onPress={() => setAssunto(a.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: activo }}
              style={({ pressed }) => [estilos.opcao, { borderColor: activo ? c.marca : c.linha, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name={activo ? "radio-button-on" : "radio-button-off"} size={18} color={activo ? c.marca : c.suave} />
              <Text style={{ color: c.tinta }}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {erros.assunto ? <Text style={{ color: c.mau }}>{erros.assunto}</Text> : null}
      <CampoDeTexto
        rotulo="O que se passa"
        value={mensagem}
        onChangeText={setMensagem}
        multiline
        maxLength={4000}
        placeholder="Descreva com algum detalhe. Se for sobre um pedido, diga o número."
        dica={`Pelo menos ${MINIMO_DA_MENSAGEM} caracteres.`}
        erro={erros.mensagem}
      />
      {erro ? <Mensagem texto={erro} /> : null}
      {feito ? <Mensagem tom="bom" texto="Recebemos o seu pedido. Respondemos por aqui e por email. Se for urgente, ligue-nos." /> : null}
      <Botao titulo="Enviar" ocupado={aEnviar} desactivado={mensagem.trim().length < MINIMO_DA_MENSAGEM} aoCarregar={() => void enviar()} />
    </Caixa>
  );
}

const estilos = StyleSheet.create({
  pagina: { padding: ESPACO.l, gap: ESPACO.l },
  pergunta: { flexDirection: "row", alignItems: "center", gap: ESPACO.s, padding: ESPACO.m },
  resposta: { paddingHorizontal: ESPACO.m, paddingBottom: ESPACO.m, lineHeight: 22, fontSize: LETRA.normal },
  linha: { flexDirection: "row", alignItems: "center", gap: ESPACO.s },
  resposta2: { borderRadius: RAIO.m, padding: ESPACO.m, gap: 4 },
  opcao: { flexDirection: "row", alignItems: "center", gap: ESPACO.s, borderWidth: 1, borderRadius: RAIO.m, padding: ESPACO.m },
});
