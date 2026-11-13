import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "./Texto";
import { RolagemComTeclado } from "./Teclado";
import { Preco, PrecoEmLinhas } from "./Preco";
import { PagarAoParceiro } from "./PagarAoParceiro";
import { Aviso, Botao, Campo, Cartao, Carregando, Ligacao, Paragrafo, Subtitulo } from "./ui";
import { mensagemDe, pedir } from "../lib/api";
import { whatsappDaClyon } from "../lib/abrir";
import {
  FALHOU_O_PEDIDO,
  MBWAY_NAO_CONFIRMADO,
  SO_DEPOIS_DE_FEITO,
  contagem,
  estadoDoPagar,
  linhaDoPagar,
  pedirOPagamento,
  soAReferencia,
  valorDoBotao,
  type EstadoDoPagar,
} from "../lib/pagamento";
import {
  contratadaDe,
  corpoDoPagamento,
  negociacaoDoFimClyon,
  paraCopiar,
  ROTA_DO_PEDIDO,
  type Negociacao,
  type Pagamento,
  type PedidoV3,
  type PendenteDoPagamento,
  type RespostaDoPedido,
} from "../lib/pedidos";
import { pagoNaData } from "../../../src/lib/frases-do-pedido";
import {
  A_ESPERA_DA_TRANSFERENCIA,
  COMO_PAGA,
  DEPOIS_DA_TRANSFERENCIA,
  DESCRITIVO,
  IBAN,
  MB_WAY,
  OUTRO_METODO,
  PRECO,
  REFERENCIA_MULTIBANCO,
  servicoEParceiro,
  TITULAR,
  TOTAL_A_PAGAR,
  valorDaTransferencia,
} from "../../../src/lib/palavras-do-pagamento";
import type { TransferenciaParaOCliente } from "../../../src/lib/transferencia-bancaria";
import { CORES } from "../tema";

/**
 * PAGAR — 02-11-2026 (ordem do CEO com o sim do dono: «ecrãs simples, direto
 * ao ponto», como a Vinted; e o #551, em que o MB WAY falhou e a app ficou
 * num ecrã morto).
 *
 * Dois pedaços:
 *  · `EcraDePagar` (rota `/pagar/[id]`): só o que é preciso para pagar — o
 *    serviço e o parceiro, o preço em três linhas (Serviço / IVA / Total), como
 *    paga (MB WAY ou Referência Multibanco), «Pagar Z €» e uma linha sobre a
 *    CLYON guardar o valor. Os estados e as falhas vêm de `lib/pagamento.ts`:
 *    qualquer falha diz a frase do servidor e deixa «Tentar de novo» e «Pagar
 *    por Multibanco»; o MB WAY tem contagem e, passado o prazo, volta a «por
 *    pagar» com o bloco inteiro; «pago» só quando o servidor o diz.
 *  · `ResumoDoPagamento` (no ecrã do pedido): o estado numa linha e o botão
 *    «Pagar Z €», e a diferença das horas de um trabalho por hora.
 *
 * Tudo pela mesma rota do site (`POST /api/pagamentos`) e o mesmo estado (a R5
 * traz o do `GET /api/pagamentos`).
 */

const MBWAY = "mbway";
const CONSULTA_MS = 5_000;

/** O relógio do ecrã (a contagem do MB WAY). */
function useAgora(ms: number): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return agora;
}

/**
 * Uma linha da referência: o rótulo pequeno em cima, o valor por baixo (parte
 * de linha em vez de cortar — 360 px e letra grande, 02-11-2026) e «Copiar».
 */
function Copiavel({ rotulo, valor, copia }: { rotulo: string; valor: string; copia?: string | null }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ color: CORES.suave, fontSize: 13 }}>{rotulo}</Text>
        <Text style={{ color: CORES.tinta, fontSize: 17, fontWeight: "700" }} selectable>
          {valor}
        </Text>
      </View>
      <Ligacao
        titulo={copiado ? "Copiado" : "Copiar"}
        aoCarregar={() => {
          // Só o número que o banco pede: sem o «(… sem IVA)», sem espaços e sem o «€» (d8, 31-10-2026).
          // Os dados da transferência (d13) dizem o que se copia (o descritivo leva o espaço).
          const copiar = copia != null ? Clipboard.setStringAsync(copia) : Clipboard.setStringAsync(paraCopiar(valor));
          void copiar.then(() => setCopiado(true));
        }}
      />
    </View>
  );
}

/**
 * Os dados para transferir (d13), como no site (`DadosDaTransferencia` em
 * PagarTrabalho.tsx): IBAN, titular, o total com IVA com o sem IVA ao lado, e o
 * descritivo. Copia-se o IBAN sem espaços, o valor e o descritivo tal como está.
 */
function DadosDaTransferencia({ t }: { t: TransferenciaParaOCliente }) {
  return (
    <View style={{ gap: 4 }}>
      <Copiavel rotulo={IBAN} valor={t.iban} copia={t.iban.replace(/\s+/g, "")} />
      <View style={{ minHeight: 44, justifyContent: "center", gap: 1 }}>
        <Text style={{ color: CORES.suave, fontSize: 13 }}>{TITULAR}</Text>
        <Text style={{ color: CORES.tinta, fontSize: 17, fontWeight: "700" }} selectable>
          {t.titular}
        </Text>
      </View>
      <Copiavel rotulo={TOTAL_A_PAGAR} valor={valorDaTransferencia(t.valor, t.valorSemIva)} copia={t.valor.toFixed(2).replace(".", ",")} />
      <Copiavel rotulo={DESCRITIVO} valor={t.descritivo} copia={t.descritivo} />
    </View>
  );
}

function ReferenciaMultibanco({ p }: { p: PendenteDoPagamento }) {
  return (
    <View style={{ gap: 4 }}>
      {p.entidade ? <Copiavel rotulo="Entidade" valor={p.entidade} /> : null}
      {p.referencia ? <Copiavel rotulo="Referência" valor={p.referencia} /> : null}
      {/* Só o total (02-11-2026): o sem IVA já está no bloco «Preço». */}
      <Copiavel rotulo="Valor" valor={valorDoBotao(p.valorTexto)} />
      {p.expiraEmTexto ? <Text style={{ color: CORES.suave, fontSize: 13 }}>{`Válida até ${p.expiraEmTexto}`}</Text> : null}
    </View>
  );
}

/** O total do botão: o «Total a pagar» da API, ou o valor que o banco pede. */
function totalDe(pg: Pagamento, comFactura: boolean): string {
  return pg.conta?.total ?? valorDoBotao(pg.ivaIncluido || comFactura ? pg.valoresTexto.comFactura : pg.valoresTexto.semFactura);
}

function Opcao({ titulo, escolhida, aoEscolher }: { titulo: string; escolhida: boolean; aoEscolher: () => void }) {
  return (
    <Pressable
      onPress={aoEscolher}
      accessibilityRole="radio"
      accessibilityState={{ selected: escolhida }}
      accessibilityLabel={titulo}
      style={({ pressed }) => ({
        minHeight: 56,
        borderRadius: 16,
        borderWidth: escolhida ? 2 : 1,
        borderColor: escolhida ? CORES.marca : CORES.linha,
        backgroundColor: escolhida ? CORES.marcaSuave : CORES.fundo,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={escolhida ? "radio-button-on" : "radio-button-off"} size={22} color={escolhida ? CORES.marca : CORES.suave} />
      <Text titulo style={{ flexShrink: 1, color: CORES.tinta, fontSize: 15.5, fontWeight: "600" }}>
        {titulo}
      </Text>
    </Pressable>
  );
}

type Resposta = RespostaDoPedido & { pedido: PedidoV3 };

/** A negociação que se paga: a contratada, ou a do fim de um Trabalho CLYON. */
function aPagarDe(r: Resposta): Negociacao | null {
  return contratadaDe(r) ?? (r.pedido.fimClyon ? negociacaoDoFimClyon(r.pedido.fimClyon) : null);
}

/* ─── O ecrã de pagar ─────────────────────────────────────────────────────── */

export function EcraDePagar({ pedidoId }: { pedidoId: number }) {
  const [r, setR] = useState<Resposta | null>(null);
  const [erroDeLeitura, setErroDeLeitura] = useState<string | null>(null);
  const [aLer, setALer] = useState(true);
  const agora = useAgora(1000);
  const [metodo, setMetodo] = useState<"mbway" | "multibanco">(MBWAY);
  const [telemovel, setTelemovel] = useState<string | null>(null);
  const [comFactura, setComFactura] = useState<boolean | null>(null);
  const [aPedir, setAPedir] = useState<"mbway" | "multibanco" | null>(null);
  const [falha, setFalha] = useState<{ mensagem: string; metodo: "mbway" | "multibanco" } | null>(null);
  const [esperavaMbway, setEsperavaMbway] = useState(false);
  const [mbwayVistoEm, setMbwayVistoEm] = useState<number | null>(null);
  const [querMbway, setQuerMbway] = useState(false);
  // «Pagar por MB WAY ou Multibanco» com uma transferência à espera (d13): abre o bloco de pagar.
  const [outraForma, setOutraForma] = useState(false);

  const carregar = useCallback(async () => {
    if (!Number.isInteger(pedidoId)) {
      setErroDeLeitura("Pedido não encontrado.");
      setALer(false);
      return;
    }
    setALer(true);
    try {
      setR(await pedir<Resposta>(ROTA_DO_PEDIDO(pedidoId)));
      setErroDeLeitura(null);
    } catch (e) {
      setErroDeLeitura(mensagemDe(e, "Não foi possível ler o pedido."));
    } finally {
      setALer(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const n = r ? aPagarDe(r) : null;
  const pg = n?.pagamento ?? null;
  const estado: EstadoDoPagar | null = pg ? estadoDoPagar(pg, agora, { esperavaMbway, mbwayVistoEm, outraForma }) : null;

  // À espera do MB WAY: o pedido lê-se de 5 em 5 s. Quando a espera acaba (prazo ou resposta), lê-se mais uma vez.
  const tipo = estado?.tipo ?? null;
  const antes = useRef(tipo);
  useEffect(() => {
    if (antes.current === "a-confirmar-mbway" && tipo !== "a-confirmar-mbway") void carregar();
    antes.current = tipo;
    if (tipo !== "a-confirmar-mbway") return;
    const t = setInterval(() => void carregar(), CONSULTA_MS);
    return () => clearInterval(t);
  }, [tipo, carregar]);

  if (aLer && !r) return <Carregando />;
  if (!r || !n || !pg || !estado) {
    return (
      <View style={{ flex: 1, padding: 20, gap: 14, backgroundColor: CORES.fundo }}>
        <Aviso texto={erroDeLeitura ?? "Este pedido ainda não tem nada para pagar."} tom={erroDeLeitura ? "mau" : "neutro"} />
        <Botao titulo="Tentar outra vez" tipo="secundario" aoCarregar={() => void carregar()} />
      </View>
    );
  }

  const p = r.pedido;
  const fatura = comFactura ?? !!p.precisaFatura;
  const tel = telemovel ?? p.telefone ?? "";
  const total = totalDe(pg, fatura);
  const dia = n.dataCombinadaTexto ?? p.dataPreferidaTexto ?? p.quando;
  // «04/11/2026 · 1 carga»: o dia (com a hora, se houver) e a quantidade em curto, sem prefixos (02-11-2026).
  const linhaCurta = linhaDoPagar(dia, p.descricao);
  // Com uma referência Multibanco válida: só ela, sem o botão grande; «Pagar por MB WAY» abre o MB WAY.
  const referencia = soAReferencia(estado) && !querMbway;

  async function pagar(m: "mbway" | "multibanco") {
    if (!n || !pg) return;
    setMetodo(m);
    setFalha(null);
    setEsperavaMbway(false);
    setAPedir(m);
    const res = await pedirOPagamento(
      pedir,
      corpoDoPagamento({ pedidoId, negociacaoId: n.id, metodo: m, comFactura: pg.ivaIncluido ? true : fatura, telemovel: tel }),
    );
    setAPedir(null);
    if (!res.ok) {
      setFalha({ mensagem: res.mensagem, metodo: m });
      void carregar();
      return;
    }
    if (m === MBWAY) {
      setEsperavaMbway(true);
      setMbwayVistoEm(Date.now());
    }
    await carregar();
  }

  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={{ flex: 1, backgroundColor: CORES.fundo }}>
      <RolagemComTeclado
        style={{ flex: 1, backgroundColor: CORES.fundo }}
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={aLer} onRefresh={() => void carregar()} tintColor={CORES.marca} />}
      >
        <View style={{ gap: 4 }}>
          <Text titulo style={{ color: CORES.tinta, fontSize: 17, fontWeight: "700" }}>
            {servicoEParceiro(p.servico, n.profissional.nome)}
          </Text>
          {linhaCurta ? <Text style={{ color: CORES.suave, fontSize: 14, lineHeight: 20 }}>{linhaCurta}</Text> : null}
        </View>

        <View style={{ gap: 12 }}>
          <Subtitulo>{PRECO}</Subtitulo>
          {pg.conta ? (
            <PrecoEmLinhas conta={pg.conta} />
          ) : n.preco ? (
            <Preco preco={n.preco} tamanho="medio" />
          ) : (
            <Text style={{ color: CORES.tinta, fontSize: 17, fontWeight: "700" }}>{pg.ivaIncluido || fatura ? pg.valoresTexto.comFactura : pg.valoresTexto.semFactura}</Text>
          )}
        </View>

        {estado.tipo === "ao-parceiro" ? (
          // O modelo de 15-11 (d18): paga diretamente ao parceiro — o IBAN, o MB WAY, como paga e as duas faturas.
          <PagarAoParceiro pedidoId={pedidoId} negociacaoId={n.id} daR5={pg.aoParceiro} />
        ) : estado.tipo === "pago" ? (
          <View style={{ gap: 14 }}>
            <Aviso tom="bom" texto={pagoNaData(estado.quando)} />
            <Botao titulo="Voltar ao pedido" tipo="secundario" aoCarregar={() => router.back()} />
          </View>
        ) : estado.tipo === "no-local" ? (
          <Paragrafo>Paga ao parceiro, no local.</Paragrafo>
        ) : estado.tipo === "indisponivel" ? (
          <View style={{ gap: 12 }}>
            <Aviso tom="aviso" texto="O pagamento pela app não está aberto agora. Fale com a CLYON e resolvemos consigo." />
            <Botao titulo="Falar com a CLYON por WhatsApp" tipo="whatsapp" aoCarregar={() => whatsappDaClyon(`Pedido #${p.id}: quero pagar.`)} />
          </View>
        ) : estado.tipo === "a-confirmar-mbway" ? (
          <Cartao destaque>
            <Subtitulo>Confirme na app MB WAY</Subtitulo>
            <Text style={{ color: CORES.tinta, fontSize: 15, lineHeight: 21 }}>{`Enviámos o pedido de ${valorDoBotao(estado.valorTexto)} para o seu telemóvel.`}</Text>
            <Text titulo style={{ color: CORES.marca, fontSize: 22, fontWeight: "700" }}>
              {`Tem ${contagem(estado.fimEm - agora)} para confirmar`}
            </Text>
            <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 18 }}>Esta página atualiza-se sozinha.</Text>
            <Ligacao titulo="Pagar por Multibanco" aoCarregar={() => void pagar("multibanco")} />
          </Cartao>
        ) : estado.tipo === "a-espera-da-transferencia" ? (
          <View style={{ gap: 10 }}>
            <Cartao destaque>
              <Subtitulo>{A_ESPERA_DA_TRANSFERENCIA}</Subtitulo>
              {estado.transferencia ? <DadosDaTransferencia t={estado.transferencia} /> : null}
              <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 18 }}>{DEPOIS_DA_TRANSFERENCIA}</Text>
            </Cartao>
            {estado.podePagarDeOutraForma ? (
              <Ligacao
                titulo={OUTRO_METODO}
                centrada
                aoCarregar={() => {
                  setMetodo(MBWAY);
                  setOutraForma(true);
                }}
              />
            ) : null}
          </View>
        ) : referencia && estado.multibanco ? (
          <View style={{ gap: 10 }}>
            <Cartao destaque>
              <Subtitulo>{REFERENCIA_MULTIBANCO}</Subtitulo>
              <ReferenciaMultibanco p={estado.multibanco} />
            </Cartao>
            <Ligacao titulo="Pagar por MB WAY" centrada aoCarregar={() => { setMetodo(MBWAY); setQuerMbway(true); }} />
            <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 18, textAlign: "center" }}>{SO_DEPOIS_DE_FEITO}</Text>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {estado.mbwayNaoConfirmado && !falha ? <Aviso tom="aviso" texto={MBWAY_NAO_CONFIRMADO} /> : null}
            {estado.multibanco ? (
              <Cartao destaque>
                <Subtitulo>Referência Multibanco</Subtitulo>
                <ReferenciaMultibanco p={estado.multibanco} />
              </Cartao>
            ) : null}

            {falha ? (
              <View style={{ gap: 10 }}>
                <Aviso tom="mau" texto={falha.mensagem || FALHOU_O_PEDIDO} />
                <Botao titulo="Tentar de novo" ocupado={aPedir === falha.metodo} desligado={!!aPedir} aoCarregar={() => void pagar(falha.metodo)} />
                {/* Com a referência já no ecrã, não se pede outra. */}
                {estado.multibanco ? null : (
                  <Botao titulo="Pagar por Multibanco" tipo="secundario" ocupado={aPedir === "multibanco"} desligado={!!aPedir} aoCarregar={() => void pagar("multibanco")} />
                )}
              </View>
            ) : null}

            <View style={{ gap: 10 }}>
              <Subtitulo>{COMO_PAGA}</Subtitulo>
              <Opcao titulo={MB_WAY} escolhida={metodo === MBWAY} aoEscolher={() => setMetodo(MBWAY)} />
              {estado.multibanco ? (
                <Ligacao titulo="Pagar pela referência Multibanco" aoCarregar={() => setQuerMbway(false)} />
              ) : (
                <Opcao titulo={REFERENCIA_MULTIBANCO} escolhida={metodo === "multibanco"} aoEscolher={() => setMetodo("multibanco")} />
              )}
              {metodo === MBWAY ? (
                <Campo rotulo="Telemóvel do MB WAY" valor={tel} aoMudar={setTelemovel} keyboardType="phone-pad" autoComplete="tel" />
              ) : null}
              {!pg.ivaIncluido && pg.valoresTexto.semFactura && pg.valoresTexto.semFactura !== pg.valoresTexto.comFactura ? (
                <Pressable
                  onPress={() => setComFactura(!fatura)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: fatura }}
                  style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 4 }}
                >
                  <Ionicons name={fatura ? "checkbox" : "square-outline"} size={22} color={CORES.marca} />
                  <Text style={{ color: CORES.tinta, fontSize: 15 }}>Com fatura</Text>
                </Pressable>
              ) : null}
            </View>

            <Botao titulo={`Pagar ${total}`} ocupado={!!aPedir && !falha} desligado={!!aPedir} aoCarregar={() => void pagar(metodo)} />
            <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 18, textAlign: "center" }}>{SO_DEPOIS_DE_FEITO}</Text>
          </View>
        )}
      </RolagemComTeclado>
    </SafeAreaView>
  );
}

/* ─── No ecrã do pedido ───────────────────────────────────────────────────── */

export function ResumoDoPagamento({
  pedidoId,
  n,
  aoMudar,
  aoCriarConta,
  telefoneSugerido,
}: {
  pedidoId: number;
  n: Negociacao;
  aoMudar: () => void;
  /** Pelo link, sem conta (A9): nunca cria um pagamento — «Criar conta para pagar». */
  aoCriarConta?: () => void;
  telefoneSugerido?: string | null;
}) {
  const pg = n.pagamento;
  const agora = useAgora(1000);
  const estado = pg ? estadoDoPagar(pg, agora) : null;
  const tipo = estado?.tipo ?? null;

  // MB WAY por confirmar: o pedido lê-se de 5 em 5 s, como no ecrã de pagar.
  useEffect(() => {
    if (tipo !== "a-confirmar-mbway") return;
    const t = setInterval(aoMudar, CONSULTA_MS);
    return () => clearInterval(t);
  }, [tipo, aoMudar]);

  if (!pg || !estado) return null;
  // O modelo de 15-11 (d10): paga diretamente ao parceiro — o bloco «Pagar a …» diz como (`PagarAoParceiro`).
  if (pg.pagaAoParceiro) return null;
  if (estado.tipo === "ao-parceiro") return null;
  const irPagar = () => (aoCriarConta ? aoCriarConta() : router.push(`/pagar/${pedidoId}`));

  return (
    <View style={{ gap: 10 }}>
      {estado.tipo === "pago" ? (
        <Text style={{ color: CORES.bom, fontSize: 16, fontWeight: "700" }}>{pagoNaData(estado.quando)}</Text>
      ) : estado.tipo === "no-local" ? (
        <Text style={{ color: CORES.tinta, fontSize: 15 }}>Paga ao parceiro, no local.</Text>
      ) : estado.tipo === "indisponivel" ? (
        pg.pendentes.length > 0 ? (
          <Ligacao titulo="Para pagar, fale com a CLYON por WhatsApp" aoCarregar={() => whatsappDaClyon(`Pedido #${pedidoId}: quero pagar.`)} />
        ) : null
      ) : estado.tipo === "a-espera-da-transferencia" ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: "700" }}>{A_ESPERA_DA_TRANSFERENCIA}</Text>
          <Botao titulo="Ver o pagamento" tipo="secundario" aoCarregar={irPagar} />
        </View>
      ) : estado.tipo === "a-confirmar-mbway" ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: CORES.tinta, fontSize: 15 }}>{`À espera da confirmação no MB WAY (${contagem(estado.fimEm - agora)}).`}</Text>
          <Botao titulo="Ver o pagamento" tipo="secundario" aoCarregar={irPagar} />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {estado.mbwayNaoConfirmado ? <Aviso tom="aviso" texto={MBWAY_NAO_CONFIRMADO} /> : null}
          {estado.multibanco ? <Text style={{ color: CORES.tinta, fontSize: 15 }}>Tem uma referência Multibanco por pagar.</Text> : null}
          {/* Com a referência válida, o botão leva a vê-la — não parece gerar outra (02-11-2026). */}
          {estado.multibanco && !aoCriarConta ? (
            <Botao titulo="Ver a referência Multibanco" tipo="secundario" aoCarregar={irPagar} />
          ) : (
            <Botao titulo={aoCriarConta ? "Criar conta para pagar" : `Pagar ${totalDe(pg, false)}`} aoCarregar={irPagar} />
          )}
        </View>
      )}
      <DiferencaDasHoras pedidoId={pedidoId} n={n} aoMudar={aoMudar} aoCriarConta={aoCriarConta} telefoneSugerido={telefoneSugerido} />
    </View>
  );
}

/** A DIFERENÇA DAS HORAS (31-10-2026): paga-se aqui, pela mesma porta; ou a CLYON devolve. */
function DiferencaDasHoras({
  pedidoId,
  n,
  aoMudar,
  aoCriarConta,
  telefoneSugerido,
}: {
  pedidoId: number;
  n: Negociacao;
  aoMudar: () => void;
  aoCriarConta?: () => void;
  telefoneSugerido?: string | null;
}) {
  const d = n.pagamento?.diferenca ?? null;
  const [telemovel, setTelemovel] = useState(telefoneSugerido ?? "");
  const [aPedir, setAPedir] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  if (!d) return null;
  const pg = n.pagamento as Pagamento;

  async function criar(metodo: "mbway" | "multibanco") {
    setErro(null);
    setAPedir(metodo);
    const res = await pedirOPagamento(
      pedir,
      corpoDoPagamento({ pedidoId, negociacaoId: n.id, metodo, comFactura: pg.ivaIncluido, telemovel, parte: "diferenca" }),
    );
    setAPedir(null);
    if (!res.ok) setErro(res.mensagem);
    aoMudar();
  }

  return (
    <View style={{ gap: 8 }}>
      {d.devolverTexto ? <Text style={{ color: CORES.tinta, fontSize: 14, lineHeight: 20 }}>{d.devolverTexto}</Text> : null}
      {d.pago ? <Text style={{ color: CORES.bom, fontSize: 14, fontWeight: "700" }}>Diferença das horas paga.</Text> : null}
      {!d.pago && d.texto ? (
        <View style={{ gap: 8 }}>
          <Subtitulo>{d.texto}</Subtitulo>
          {d.pendentes.map((p, i) =>
            p.metodo === MBWAY ? (
              <Text key={i} style={{ color: CORES.tinta, fontSize: 15 }}>{`Confirme ${p.valorTexto} na app MB WAY do telemóvel.`}</Text>
            ) : (
              <ReferenciaMultibanco key={i} p={p} />
            ),
          )}
          {aoCriarConta ? (
            <Botao titulo="Criar conta para pagar" aoCarregar={aoCriarConta} />
          ) : (
            <>
              {erro ? <Aviso texto={erro} tom="mau" /> : null}
              <Campo rotulo="Telemóvel do MB WAY" valor={telemovel} aoMudar={setTelemovel} keyboardType="phone-pad" autoComplete="tel" />
              <Botao titulo={erro ? "Tentar de novo por MB WAY" : "MB WAY"} ocupado={aPedir === MBWAY} desligado={!!aPedir} aoCarregar={() => void criar("mbway")} />
              <Botao titulo="Referência Multibanco" tipo="secundario" ocupado={aPedir === "multibanco"} desligado={!!aPedir} aoCarregar={() => void criar("multibanco")} />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}
