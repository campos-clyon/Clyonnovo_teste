import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, TextInput } from "../../componentes/Texto";
import { Botao, Caixa, Mensagem, TituloDaCaixa } from "../../componentes/ui";
import { useConta } from "../../estado/Conta";
import { ErroDaApi, pedir } from "../../lib/api";
import {
  diaCurto,
  FASE_DO_MOVIMENTO,
  lerValorDaTransferencia,
  MINIMO_PARA_LEVANTAR,
  podeTransferir,
  type DividaDaCarteira,
  type Movimento,
  type RespostaDaCarteira,
} from "../../lib/conta";
import { euros } from "../../lib/trabalhos";
import { LinhaDoMovimento } from "../../componentes/LinhaDoMovimento";
import { PROMESSA } from "../../../../src/lib/pagamento-na-plataforma";
import { ESPACO, LETRA, RAIO, useCores } from "../../tema";

/**
 * A MINHA CARTEIRA — fase 4, 18-10-2026. A mesma do painel (`Carteira.tsx`):
 * os mesmos cestos, as mesmas frases e a mesma regra para transferir. Os
 * números vêm todos do site (`GET /api/profissionais/carteira`); aqui só se
 * mostram.
 */
export default function Carteira() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const { carteira, erroDaCarteira, recarregarCarteira } = useConta();
  const [aLer, setALer] = useState(false);
  const [aTransferir, setATransferir] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void recarregarCarteira();
    }, [recarregarCarteira]),
  );

  async function puxar() {
    setALer(true);
    await recarregarCarteira();
    setALer(false);
  }

  return (
    <ScrollView
      style={{ backgroundColor: c.fundo }}
      contentContainerStyle={[estilos.pagina, { paddingTop: margens.top + ESPACO.l, paddingBottom: margens.bottom + ESPACO.xxl }]}
      refreshControl={<RefreshControl refreshing={aLer} onRefresh={() => void puxar()} tintColor={c.marca} colors={[c.marca]} />}
    >
      <Text style={[estilos.titulo, { color: c.tinta }]}>A minha carteira</Text>
      {!carteira ? (
        erroDaCarteira ? (
          <Mensagem texto={erroDaCarteira} />
        ) : (
          <Text style={{ color: c.suave }}>A carregar…</Text>
        )
      ) : (
        <Conteudo c={carteira} aTransferir={aTransferir} setATransferir={setATransferir} aoMudar={recarregarCarteira} />
      )}
    </ScrollView>
  );
}

function Conteudo({
  c: dados,
  aTransferir,
  setATransferir,
  aoMudar,
}: {
  c: RespostaDaCarteira;
  aTransferir: boolean;
  setATransferir: (v: boolean) => void;
  aoMudar: () => Promise<void>;
}) {
  const c = useCores();
  const k = dados.carteira;
  const reservado = Math.max(0, Math.round((k.disponivel - dados.levantavel) * 100) / 100);
  const dividasAbertas = dados.dividas.filter((d) => !d.paga && !d.abatida);

  return (
    <>
      {dados.bloqueioEmDinheiro ? <Mensagem texto={dados.bloqueioEmDinheiro.explicacao} /> : null}

      <Caixa>
        <Text style={[estilos.grande, { color: c.bom }]}>{euros(k.disponivel)}</Text>
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>Disponível para transferir</Text>
        {reservado > 0 ? (
          <Text style={{ color: c.tinta, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
            Pode pedir {euros(dados.levantavel)}. Os outros {euros(reservado)} ficam para o que deve à CLYON — abatem-se quando a
            transferência for feita, ou ficam livres se pagar a dívida pela referência.
          </Text>
        ) : null}
        {k.aCaminho > 0 ? (
          <Text style={{ color: c.marca, fontSize: LETRA.pequena + 1, fontWeight: "700" }}>{euros(k.aCaminho)} a caminho da sua conta</Text>
        ) : null}
        <View style={estilos.lado}>
          <View style={{ flex: 1 }}>
            <Botao titulo="Transferir" desactivado={!podeTransferir(dados)} aoCarregar={() => setATransferir(!aTransferir)} />
          </View>
          <View style={{ flex: 1 }}>
            <Botao titulo="Histórico" tipo="secundario" aoCarregar={() => router.push("/carteira/historico" as never)} />
          </View>
        </View>
        {aTransferir && podeTransferir(dados) ? (
          <Transferir dados={dados} aoFechar={() => setATransferir(false)} aoMudar={aoMudar} />
        ) : null}
      </Caixa>

      {!dados.temIban ? (
        <Caixa estilo={{ borderColor: c.aviso }}>
          <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>
            <Text style={{ fontWeight: "800" }}>Falta o IBAN.</Text> Sem ele não há para onde transferir o seu saldo.
          </Text>
          <Botao titulo="Indicar o IBAN" tipo="secundario" aoCarregar={() => router.push("/conta/banco" as never)} />
        </Caixa>
      ) : null}
      {dados.temPedidoPendente ? (
        <Mensagem tom="bom" texto="Tem uma transferência a ser processada. Assim que sair, pode pedir outra." />
      ) : null}

      <Caixa>
        <Linha rotulo={PROMESSA.proRotuloDoCativo} valor={k.cativo} />
        {k.porCobrar > 0 ? <Linha rotulo="Por cobrar" nota="trabalho feito que o cliente ainda não pagou" valor={k.porCobrar} tom="aviso" /> : null}
        {k.recebidoEmMao > 0 ? <Linha rotulo="Recebido em mão" nota="pago em dinheiro, no local — já está consigo" valor={k.recebidoEmMao} /> : null}
        {dados.aPagarAClyon > 0 ? (
          <Linha rotulo="A pagar à CLYON" nota="IVA e comissão de trabalhos pagos em dinheiro" valor={dados.aPagarAClyon} tom="aviso" />
        ) : null}
        {k.abatidoEmDividas > 0 ? <Linha rotulo="Pago à CLYON com o saldo" valor={k.abatidoEmDividas} /> : null}
        <Linha rotulo="Total ganho" nota="desde que começou na CLYON" valor={k.totalGanho} forte ultima />
      </Caixa>

      {dividasAbertas.map((d) => (
        <Divida key={d.negociacaoId} d={d} aoMudar={aoMudar} />
      ))}

      <UltimosMovimentos movimentos={dados.movimentos} />

      <Caixa>
        <TituloDaCaixa>{PROMESSA.proTitulo}</TituloDaCaixa>
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{PROMESSA.proCorpo}</Text>
      </Caixa>
    </>
  );
}

function Linha({
  rotulo,
  nota,
  valor,
  tom,
  forte = false,
  ultima = false,
}: {
  rotulo: string;
  nota?: string;
  valor: number;
  tom?: "aviso";
  forte?: boolean;
  ultima?: boolean;
}) {
  const c = useCores();
  const cor = tom === "aviso" ? c.aviso : c.tinta;
  return (
    <View style={[estilos.linha, { borderBottomColor: c.linha, borderBottomWidth: ultima ? 0 : StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: cor, fontSize: LETRA.normal, fontWeight: forte ? "700" : "500" }}>{rotulo}</Text>
        {nota ? <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>{nota}</Text> : null}
      </View>
      <Text style={{ color: cor, fontSize: LETRA.media, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{euros(valor)}</Text>
    </View>
  );
}

function Transferir({ dados, aoFechar, aoMudar }: { dados: RespostaDaCarteira; aoFechar: () => void; aoMudar: () => Promise<void> }) {
  const c = useCores();
  const [texto, setTexto] = useState(dados.levantavel.toFixed(2).replace(".", ","));
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);
  const valor = lerValorDaTransferencia(texto, dados.levantavel);
  const reservado = dados.carteira.disponivel > dados.levantavel;

  async function pedirTransferencia() {
    if (valor == null) return;
    setAEnviar(true);
    setErro(null);
    try {
      await pedir("/api/profissionais/levantamento", { metodo: "POST", corpo: { valor } });
      setFeito(true);
      await aoMudar();
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível pedir a transferência.");
    } finally {
      setAEnviar(false);
    }
  }

  if (feito) {
    return (
      <View style={{ gap: ESPACO.s }}>
        <Mensagem tom="bom" texto="Pedido feito. Tratamos dele em menos de 24 horas; depois o banco costuma demorar mais um dia útil." />
        <Botao titulo="Fechar" tipo="secundario" aoCarregar={aoFechar} />
      </View>
    );
  }
  return (
    <View style={[estilos.transferir, { borderTopColor: c.linha }]}>
      <Text style={{ color: c.tinta, fontWeight: "700", fontSize: LETRA.normal }}>Quanto quer transferir</Text>
      <TextInput
        value={texto}
        onChangeText={setTexto}
        keyboardType="decimal-pad"
        accessibilityLabel="Quanto quer transferir"
        style={[estilos.campo, { borderColor: c.linha, color: c.tinta, backgroundColor: c.fundo }]}
      />
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>
        {reservado
          ? `Pode pedir: ${euros(dados.levantavel)} (o resto fica para o que deve à CLYON)`
          : `Disponível: ${euros(dados.levantavel)}`}
        {"  ·  "}
        <Text
          onPress={() => setTexto(dados.levantavel.toFixed(2).replace(".", ","))}
          style={{ color: c.marca, fontWeight: "700" }}
          accessibilityRole="button"
        >
          Transferir tudo
        </Text>
      </Text>
      <View style={[estilos.conta, { backgroundColor: c.fundo }]}>
        <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>Para a conta</Text>
        <Text style={{ color: c.tinta, fontWeight: "700" }}>
          {dados.iban}
          {dados.titular ? ` · ${dados.titular}` : ""}
        </Text>
      </View>
      {erro ? <Mensagem texto={erro} /> : null}
      <Botao
        titulo={valor != null ? `Pedir ${euros(valor)}` : "Pedir"}
        ocupado={aEnviar}
        desactivado={valor == null}
        aoCarregar={() => void pedirTransferencia()}
      />
      <Text style={{ color: c.suave, fontSize: LETRA.pequena, lineHeight: 18 }}>
        O mínimo por transferência é de {MINIMO_PARA_LEVANTAR} €. Tratamos do pedido em menos de 24 horas e transferimos para o IBAN
        indicado; depois disso, o banco costuma demorar mais um dia útil.
      </Text>
    </View>
  );
}

function Divida({ d, aoMudar }: { d: DividaDaCarteira; aoMudar: () => Promise<void> }) {
  const c = useCores();
  const [aPedir, setAPedir] = useState<"multibanco" | "mbway" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const ref = d.referencia?.metodo === "multibanco" ? d.referencia : null;
  const prazo = diaCurto(d.venceEm);
  const passou = d.venceEm ? new Date(d.venceEm).getTime() < Date.now() : false;

  async function gerar(metodo: "multibanco" | "mbway") {
    setAPedir(metodo);
    setErro(null);
    setAviso(null);
    try {
      await pedir("/api/profissionais/divida", { metodo: "POST", corpo: { negociacaoId: d.negociacaoId, metodo } });
      if (metodo === "mbway") setAviso("Enviámos o pedido para o seu MB WAY — abra a aplicação e confirme (tem 5 minutos).");
      await aoMudar();
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível.");
    } finally {
      setAPedir(null);
    }
  }

  return (
    <Caixa estilo={{ borderColor: c.aviso }}>
      <View style={estilos.lado}>
        <Text style={{ flex: 1, color: c.tinta, fontWeight: "700" }}>
          {d.pedidoId != null ? `#${d.pedidoId} · ` : ""}
          {d.titulo}
        </Text>
        <Text style={{ color: c.aviso, fontWeight: "800", fontSize: LETRA.media }}>{euros(d.total)}</Text>
      </View>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
        O cliente pagou-lhe {euros(d.recebidoDoCliente)} em dinheiro, com IVA. São da CLYON {euros(d.iva)} de IVA e {euros(d.comissao)} de
        comissão.
      </Text>
      {prazo ? (
        <Text style={{ color: c.aviso, fontSize: LETRA.pequena + 1, fontWeight: "600", lineHeight: 20 }}>
          {passou
            ? `Passou o prazo (${prazo}): enquanto não pagar, não pode propor nem aceitar trabalhos em dinheiro.`
            : `Pague até ${prazo}. Depois disso deixa de poder propor e aceitar trabalhos em dinheiro até estar paga.`}
        </Text>
      ) : null}
      {ref ? (
        <View style={[estilos.referencia, { backgroundColor: c.fundo }]}>
          <Campo rotulo="Entidade" valor={ref.entidade ?? "—"} />
          <Campo rotulo="Referência" valor={ref.referencia ?? "—"} />
          <Campo rotulo="Valor" valor={euros(d.total)} />
        </View>
      ) : (
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>Ainda não há uma referência viva para esta dívida.</Text>
      )}
      {ref && diaCurto(ref.expiraEm) ? (
        <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>
          Válida até {diaCurto(ref.expiraEm)}. Pague no homebanking ou numa caixa Multibanco, pelo valor exacto.
        </Text>
      ) : null}
      {erro ? <Mensagem texto={erro} /> : null}
      {aviso ? <Mensagem tom="bom" texto={aviso} /> : null}
      {!ref ? (
        <Botao titulo="Gerar referência Multibanco" ocupado={aPedir === "multibanco"} aoCarregar={() => void gerar("multibanco")} />
      ) : null}
      <Botao titulo="Pagar por MB WAY" tipo="secundario" ocupado={aPedir === "mbway"} aoCarregar={() => void gerar("mbway")} />
    </Caixa>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  const c = useCores();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text style={{ color: c.suave, fontSize: 11 }}>{rotulo}</Text>
      <Text style={{ color: c.tinta, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{valor}</Text>
    </View>
  );
}

function UltimosMovimentos({ movimentos }: { movimentos: Movimento[] }) {
  const c = useCores();
  if (movimentos.length === 0) return null;
  return (
    <Caixa>
      <TituloDaCaixa>Últimos movimentos</TituloDaCaixa>
      {movimentos.slice(0, 5).map((m, i) => (
        <LinhaDoMovimento key={`${m.tipo}-${m.id}`} m={m} ultima={i === Math.min(4, movimentos.length - 1)} />
      ))}
      <Botao titulo="Ver o histórico todo" tipo="secundario" aoCarregar={() => router.push("/carteira/historico" as never)} />
      <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>O que sai da carteira aparece a menos.</Text>
    </Caixa>
  );
}

const estilos = StyleSheet.create({
  pagina: { paddingHorizontal: ESPACO.l, gap: ESPACO.l },
  titulo: { fontSize: LETRA.grande, fontWeight: "800" },
  grande: { fontSize: 34, fontWeight: "800", fontVariant: ["tabular-nums"] },
  lado: { flexDirection: "row", gap: ESPACO.s, alignItems: "center" },
  linha: { flexDirection: "row", alignItems: "center", gap: ESPACO.m, paddingVertical: ESPACO.s },
  transferir: { gap: ESPACO.s, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: ESPACO.m, marginTop: ESPACO.xs },
  campo: { borderWidth: 1, borderRadius: RAIO.m, paddingHorizontal: ESPACO.m, minHeight: 52, fontSize: LETRA.titulo, fontWeight: "700" },
  conta: { borderRadius: RAIO.m, padding: ESPACO.m, gap: 2 },
  referencia: { flexDirection: "row", borderRadius: RAIO.m, padding: ESPACO.m },
});
