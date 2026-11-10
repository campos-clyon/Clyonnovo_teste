import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Image, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { RolagemComTeclado } from "./Teclado";
import { SafeAreaView } from "react-native-safe-area-context";
import { Entrada } from "./Entrada";
import { CampoDeMorada } from "./Morada";
import { FornecedorDoCampoEmFalta, Marcado, type LugarDoCampo } from "./CampoEmFalta";
import { lerMoradaGuardada, lerMoradasParaOPedido } from "../lib/morada-do-cliente";
import { abreAEscolher, botaoDaEscolha, indiceDaMorada, OUTRA_MORADA, perguntaDaEscolha, USAR_UMA_GUARDADA } from "../lib/moradas-do-pedido";
import { Text } from "./Texto";
import { PrecoEmLinhas } from "./Preco";
import { animarAMudanca, Aviso, Botao, Campo, Carregando, Confirmacao, EscolhaFeita, Escolhas, Folha, Ligacao, LinhaDoResumo, Paragrafo, PrecoDeReferencia, Subtitulo, Titulo } from "./ui";
import { soAEscolhida } from "../lib/escolha-recolhida";
import { useCatalogo } from "../estado/Catalogo";
import { usePedidos } from "../estado/Pedidos";
import { useSessao } from "../estado/Sessao";
import { whatsappDaClyon } from "../lib/abrir";
import { ErroDaApi, mensagemDe, pedir } from "../lib/api";
import { jaPerguntouPelosAvisos, ligarAvisos, marcarQueJaPerguntou } from "../lib/avisos";
import { mascararEmail } from "../lib/entrada";
import { enviarFotografia, escolherFotografias, escolherVideo, reduzirFotografia, reduzirFotografiaDoEndereco, type FotografiaReduzida } from "../lib/fotografias";
import { apagarRascunho, apagarRascunhoEFotografias, contarRascunhoNovo, esquecerDepoisDeEntrar, guardarRascunho, lerRascunho, rascunhosComecados, recomecarContagem } from "../lib/guardado";
import { COMECAR_DO_ZERO, CONTINUAR_O_PEDIDO, linhaDoPedidoAMeio, perguntarPeloPedidoAMeio, TITULO_DO_PEDIDO_A_MEIO } from "../lib/pedido-a-meio";
import { marcarOPedirVisto, sessaoEmQueOPedirFoiVisto, useSessaoDaApp } from "../lib/sessao-da-app";
import {
  ANDARES,
  avisoDasFotografias,
  avisosDoEspaco,
  camposEmFaltaNoEcra,
  comResposta,
  perguntasDe,
  perguntasVisiveis,
  respostasDoRascunho,
  semAsRespostasDoServico,
  valorDaResposta,
  corpoDaReferencia,
  corpoDoPedido,
  detalhesDe,
  DIAS_DA_SEMANA_DO_CALENDARIO,
  diaPorExtenso,
  diasParaEscolher,
  HORAS_DO_CALENDARIO,
  horaPorExtenso,
  mesesDoCalendario,
  nomeDoMes,
  semanasDoMes,
  textoDoQuando,
  ecraDaLinha,
  ecraDe,
  ecrasDoPedir,
  ELEVADOR,
  espacoDe,
  ESTACIONAMENTO,
  linhasDoResumo,
  mudarCoisasDoEspaco,
  passoDoEcra,
  perguntaDoEcra,
  rascunhoVazio,
  referenciaValida,
  REPETICAO,
  ROTA_DA_REFERENCIA,
  ROTA_DO_ENVIO,
  ROTA_DO_PERCURSO,
  semAndar,
  servicoDe,
  TAMANHOS_DOS_ITENS,
  TEXTO_DO_QUANDO,
  VOLUMES,
  type Acesso,
  type Catalogo,
  type EcraDoPedir,
  type Morada,
  type Rascunho,
  type Referencia,
} from "../lib/novo-pedido";
import { ROTULO_DO_TOTAL_DE_REFERENCIA } from "../../../src/lib/preco-em-tres-linhas";
import { unidadeDaPergunta, type PerguntaDaApp } from "../lib/perguntas-do-pedido";
import {
  chaveDoLeitor,
  corpoDoLeitor,
  recusarSugestao,
  ROTA_DO_LEITOR,
  sugestoesDoEcra,
  sugestoesValidas,
  tituloDasSugestoes,
  type SugestaoDoPedido,
} from "../lib/sugestoes-do-pedido";
import { aparenciaDoServico, CORES } from "../tema";
import { ParceirosDaMudanca } from "./ParceirosDaMudanca";
import {
  alternarParceiro,
  botaoDaLista,
  corpoDaLista,
  escolhaFeita,
  listaValida,
  passosDaResposta,
  ROTA_DOS_PARCEIROS,
  soOsDaLista,
  type ListaDosParceiros,
  type Pessoas,
} from "../lib/parceiros-da-mudanca";

/** Os ecrãs antes da lista dos parceiros: voltar a um deles volta a pedir a lista (as moradas, a casa ou o dia podem mudar). */
const ANTES_DOS_PARCEIROS: readonly EcraDoPedir[] = ["onde", "oque", "destino", "fotos", "acesso", "quando"];
/** O que a rota do pedido também diz quando falta a escolha («conferirEscolha»). */
const ESCOLHA_UM_PARCEIRO = "Escolha pelo menos um parceiro.";

/**
 * E3 — PEDIR, UMA PERGUNTA POR ECRÃ (02-11-2026, ordem do CEO com o sim do
 * dono: «ecrãs simples, direto ao ponto», como a Vinted). Onde é → o que é e
 * quanto → (na mudança, para onde vai) → fotografias → andar e elevador (e a
 * carrinha perto) → quando → contacto → resumo e enviar. Cada ecrã: a
 * pergunta, as opções, «Continuar» e a barra de progresso. Os campos, as
 * regras e o que vai para o site são os do simulador (`novo-pedido.ts`).
 * E4 — PEDIDO ENVIADO.
 *
 * O rascunho guarda-se no telemóvel a cada campo, também sem conta, e apaga-se
 * depois de enviado (e ao sair ou trocar de conta). A conta só se pede no fim:
 * «Enviar pedido» sem sessão abre a folha E3.F (Google ou link por email), e
 * depois de entrar o resumo volta com «Entrou como … Confira o pedido e toque
 * em Enviar.» — a app não envia sozinha.
 *
 * O PEDIDO A MEIO (d5, 03-11-2026): na primeira vez que o Pedir se vê numa
 * sessão nova da app (abri-la de raiz, ou voltar depois de a fechar), com um
 * rascunho com o serviço escolhido, pergunta «Continuar» ou «Começar do zero»
 * (`pedido-a-meio.ts`, `sessao-da-app.ts`). Trocar de separador não pergunta.
 */

const SEM_FOTOS = "Sem fotografias, o preço pode mudar no local. Quer continuar sem elas?";
/** O texto do simulador do site, enquanto a R7 não o manda (`textos.autorizaFotos`). */
const AUTORIZA_FOTOS = "Podem mostrar as minhas fotos no site e nas redes da CLYON (opcional), sem nada que me identifique — nem pessoas, nem morada.";
/** O mesmo do site para a folha E3.F (G3). */
const ENTRE_PARA_ENVIAR = "Para enviar o pedido, entre na CLYON";

function Progresso({ indice, total }: { indice: number; total: number }) {
  return (
    <View style={{ gap: 8 }} accessibilityLabel={`Pergunta ${indice + 1} de ${total}`}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= indice ? CORES.marca : CORES.linha }} />
        ))}
      </View>
      <Text style={{ color: CORES.suave, fontSize: 12.5 }}>{`${indice + 1} de ${total}`}</Text>
    </View>
  );
}

/**
 * «É NESTA MORADA?» (02-11-2026) — as moradas da conta e dos últimos pedidos
 * em cartões, a escolhida marcada, e «Outra morada» para a procura de sempre.
 * Escolher aqui não grava nada na conta.
 */
export function EscolherMorada({
  moradas,
  escolhida,
  aoEscolher,
  aoPedirOutra,
}: {
  moradas: Morada[];
  escolhida: Morada | undefined;
  aoEscolher: (m: Morada) => void;
  aoPedirOutra: () => void;
}) {
  const i = indiceDaMorada(moradas, escolhida);
  return (
    <View style={{ gap: 10 }} accessibilityRole="radiogroup">
      {moradas.map((m, n) => {
        const marcada = n === i;
        return (
          <Pressable
            key={m.formattedAddress}
            onPress={() => aoEscolher(m)}
            accessibilityRole="radio"
            accessibilityState={{ checked: marcada }}
            accessibilityLabel={m.formattedAddress}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 64,
              padding: 14,
              borderRadius: 16,
              borderWidth: marcada ? 2 : 1,
              borderColor: marcada ? CORES.marca : CORES.linha,
              backgroundColor: marcada ? CORES.marcaSuave : CORES.fundo,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="location-outline" size={22} color={CORES.marca} />
            <Text style={{ flex: 1, color: CORES.tinta, fontSize: 15.5, lineHeight: 21 }} numberOfLines={3}>
              {m.formattedAddress}
            </Text>
            <Ionicons name={marcada ? "checkmark-circle" : "ellipse-outline"} size={24} color={marcada ? CORES.marca : CORES.linha} />
          </Pressable>
        );
      })}
      <Pressable
        onPress={aoPedirOutra}
        accessibilityRole="button"
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 14, opacity: pressed ? 0.6 : 1 })}
      >
        <Ionicons name="add-circle-outline" size={22} color={CORES.marca} />
        <Text titulo style={{ color: CORES.marca, fontSize: 15.5, fontWeight: "600" }}>
          {OUTRA_MORADA}
        </Text>
      </Pressable>
    </View>
  );
}

/** O porquê da estimativa (R12): a conta, linha a linha, por baixo do preço (d4/d6 — também as linhas com euros). */
function PorqueDaReferencia({ porque }: { porque: readonly string[] | undefined }) {
  if (!porque || porque.length === 0) return null;
  return (
    <View style={{ gap: 2 }}>
      {porque.map((p, i) => (
        <Text key={i} style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 17 }}>
          {`· ${p}`}
        </Text>
      ))}
    </View>
  );
}

function CaixaDaReferencia({ referencia }: { referencia: Referencia | null }) {
  if (!referencia) return null;
  return (
    <View style={{ borderRadius: 18, backgroundColor: CORES.marcaSuave, padding: 14, gap: 6 }}>
      {referencia.linhas.map((l, i) => (
        <View key={i} style={{ gap: 2 }}>
          {l.rotulo ? <Text style={{ color: CORES.suave, fontSize: 12.5 }}>{l.rotulo}</Text> : null}
          <PrecoDeReferencia texto={l.texto} tamanho={15} />
        </View>
      ))}
      <PorqueDaReferencia porque={referencia.porque} />
    </View>
  );
}

/** O nome do bloco do preço no Pedir (d4/d6, 03-11-2026 — era «Preço de referência»); a R12 manda o mesmo rótulo. */
const ESTIMATIVA = "Estimativa";

/**
 * A FAIXA DA ESTIMATIVA (d1; «Estimativa» desde a d4/d6, 03-11-2026): à vista
 * em todos os ecrãs do Pedir, com o porquê — adapta-se ao que ele vai
 * respondendo. Só o que a R12 manda; sem ela, nada.
 */
function FaixaDaReferencia({ referencia }: { referencia: Referencia | null }) {
  const l = referencia?.linhas[0];
  if (!referencia || !l) return null;
  return (
    <View accessibilityLabel={ESTIMATIVA} style={{ borderRadius: 14, backgroundColor: CORES.marcaSuave, paddingVertical: 10, paddingHorizontal: 12, gap: 4 }}>
      <Text style={{ color: CORES.suave, fontSize: 12 }}>{l.rotulo || ESTIMATIVA}</Text>
      <PrecoDeReferencia texto={l.texto} tamanho={14} />
      <PorqueDaReferencia porque={referencia.porque} />
    </View>
  );
}

/**
 * «PERCEBEMOS NA SUA DESCRIÇÃO: …» (d1) — as sugestões do leitor, cada uma com
 * «Usar isto» e «Não». Nada entra no pedido sem ele tocar.
 */
function CartaoDasSugestoes({ lista, aoUsar, aoRecusar }: { lista: SugestaoDoPedido[]; aoUsar: (s: SugestaoDoPedido) => void; aoRecusar: (s: SugestaoDoPedido) => void }) {
  if (lista.length === 0) return null;
  return (
    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: CORES.marca, backgroundColor: CORES.fundo, padding: 14, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="sparkles-outline" size={18} color={CORES.marca} />
        <Text titulo style={{ flex: 1, color: CORES.tinta, fontSize: 15, fontWeight: "700" }}>
          {tituloDasSugestoes(lista)}
        </Text>
      </View>
      {lista.map((s) => (
        <View key={s.chave} style={{ gap: 6 }}>
          <Text style={{ color: CORES.tinta, fontSize: 14.5, lineHeight: 20 }}>
            <Text style={{ fontWeight: "700" }}>{`${s.titulo} `}</Text>
            {s.valorEscrito}
          </Text>
          {s.porque ? <Text style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 17 }}>{s.porque}</Text> : null}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Botao titulo="Usar isto" tipo="secundario" aoCarregar={() => aoUsar(s)} />
            </View>
            <View style={{ flex: 1 }}>
              <Botao titulo="Não" tipo="secundario" aoCarregar={() => aoRecusar(s)} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * AS PERGUNTAS DA CATEGORIA (d1, 03-11-2026): o ecrã desenhado pelas
 * «perguntas» da R7 — só as que aparecem, pela ordem, cada uma no campo dela.
 */
function PerguntasDaCategoria({
  r,
  perguntas,
  ecra,
  mudar,
  espaco,
}: {
  r: Rascunho;
  perguntas: PerguntaDaApp[];
  ecra: "oque" | "acesso";
  mudar: (p: Partial<Rascunho>) => void;
  espaco: ReturnType<typeof espacoDe>;
}) {
  const respostas = respostasDoRascunho(r, perguntas);
  const visiveis = perguntasVisiveis(r, perguntas, ecra);
  const responder = (id: string, v: string | string[] | undefined) => {
    animarAMudanca();
    mudar(comResposta(r, id, v));
  };
  const itens = visiveis.filter((p) => p.id.startsWith("itens."));
  let grupoAntes = "";
  return (
    <View style={{ gap: 14 }}>
      {visiveis.map((p) => {
        // Na mudança, «Na origem» e «No destino» por cima das perguntas de cada lado.
        const grupo = p.id.startsWith("origem.") ? "Na origem" : p.id.startsWith("destino.") ? "No destino" : "";
        const cabeca = grupo && grupo !== grupoAntes ? <Subtitulo key={`g-${grupo}`}>{grupo}</Subtitulo> : null;
        grupoAntes = grupo;
        const v = valorDaResposta(r, p.id);
        if (p.id.startsWith("itens.")) {
          if (p !== itens[0]) return null;
          return (
            <Marcado key="itens" campo="itens">
              {itens.map((x) => (
                <Contador
                  key={x.id}
                  nome={x.titulo}
                  exemplos={x.ajuda ?? ""}
                  valor={Number(valorDaResposta(r, x.id) ?? 0) || 0}
                  aoMudar={(n) => mudar(comResposta(r, x.id, String(n)))}
                />
              ))}
            </Marcado>
          );
        }
        if (p.tipo === "escolha" && p.varias) {
          const escolhidas = Array.isArray(v) ? v : [];
          return (
            <View key={p.id} style={{ gap: 8 }}>
              {cabeca}
              <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>{p.titulo}</Text>
              {p.ajuda ? <Paragrafo pequeno suave>{p.ajuda}</Paragrafo> : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {p.opcoes.map((o) => {
                  const activa = escolhidas.includes(o.id);
                  return (
                    <Pressable
                      key={o.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: activa }}
                      accessibilityLabel={o.nome}
                      onPress={() => {
                        const novas =
                          p.id === "coisasDoEspaco" && espaco
                            ? mudarCoisasDoEspaco(espaco, escolhidas, o.id)
                            : activa
                              ? escolhidas.filter((x) => x !== o.id)
                              : [...escolhidas, o.id];
                        responder(p.id, novas.length > 0 ? novas : undefined);
                      }}
                      style={({ pressed }) => ({
                        minHeight: 44,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 10,
                        borderWidth: activa ? 2 : 1,
                        borderColor: activa ? CORES.marca : CORES.linha,
                        backgroundColor: activa ? CORES.marcaSuave : CORES.fundo,
                        opacity: pressed ? 0.7 : 1,
                        justifyContent: "center",
                      })}
                    >
                      <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: activa ? "700" : "500" }}>{o.nome}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {p.opcoes
                .filter((o) => escolhidas.includes(o.id) && o.ajuda)
                .map((o) => (
                  <Aviso key={o.id} texto={o.ajuda as string} tom="aviso" />
                ))}
            </View>
          );
        }
        if (p.tipo === "escolha") {
          return (
            <View key={p.id} style={{ gap: 6 }}>
              {cabeca}
              <Escolhas recolher={p.obrigatoria} campo={p.id} rotulo={p.titulo} opcoes={p.opcoes} valor={typeof v === "string" ? v : undefined} aoEscolher={(x) => responder(p.id, x)} />
              {p.ajuda ? <Paragrafo pequeno suave>{p.ajuda}</Paragrafo> : null}
            </View>
          );
        }
        if (p.tipo === "numero") {
          const unidade = unidadeDaPergunta(p, respostas);
          return (
            <View key={p.id} style={{ gap: 6 }}>
              {cabeca}
              <Campo
                campo={p.id}
                rotulo={unidade ? `${p.titulo} (${unidade})` : p.titulo}
                valor={typeof v === "string" ? v : ""}
                aoMudar={(x) => mudar(comResposta(r, p.id, soAlgarismos(x) || undefined))}
                keyboardType="number-pad"
                ajuda={p.ajuda}
              />
            </View>
          );
        }
        return (
          <View key={p.id} style={{ gap: 6 }}>
            {cabeca}
            <Campo
              campo={p.id}
              rotulo={p.titulo}
              valor={typeof v === "string" ? v : ""}
              aoMudar={(x) => mudar(comResposta(r, p.id, x || undefined))}
              maxLength={p.maximo ?? 300}
              ajuda={p.ajuda}
            />
          </View>
        );
      })}
    </View>
  );
}

function Acessos({
  titulo,
  acesso,
  aoMudar,
  comDificil,
  comAndar = true,
}: {
  titulo?: string;
  acesso: Acesso;
  aoMudar: (a: Acesso) => void;
  comDificil: boolean;
  /** A garagem e a cave não perguntam o andar (d5, como o simulador do site). */
  comAndar?: boolean;
}) {
  return (
    <View style={{ gap: 14 }}>
      {titulo ? <Subtitulo>{titulo}</Subtitulo> : null}
      {comAndar ? (
        <Escolhas recolher rotulo="Em que andar está?" opcoes={ANDARES} valor={acesso.floor} aoEscolher={(v) => aoMudar({ ...acesso, floor: v, hasElevator: v === "rés-do-chão" ? undefined : acesso.hasElevator })} />
      ) : null}
      {comAndar && acesso.floor && acesso.floor !== "rés-do-chão" ? (
        <Escolhas recolher rotulo="Há elevador?" opcoes={ELEVADOR} valor={acesso.hasElevator} aoEscolher={(v) => aoMudar({ ...acesso, hasElevator: v })} />
      ) : null}
      <Escolhas recolher={comDificil} rotulo="A carrinha fica perto?" opcoes={ESTACIONAMENTO} valor={acesso.parkingDistance} aoEscolher={(v) => aoMudar({ ...acesso, parkingDistance: v })} />
      {comDificil ? (
        <>
          <Escolhas
            rotulo="Acesso difícil?"
            opcoes={[
              { id: "nao", nome: "Não" },
              { id: "sim", nome: "Sim" },
            ]}
            valor={acesso.difficultAccess ? "sim" : "nao"}
            aoEscolher={(v) => aoMudar({ ...acesso, difficultAccess: v === "sim" })}
          />
          {acesso.difficultAccess ? (
            <Campo rotulo="Nota do acesso" valor={acesso.accessNotes ?? ""} aoMudar={(v) => aoMudar({ ...acesso, accessNotes: v })} maxLength={300} placeholder="Escadas estreitas, rua só a pé…" />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Contador({ nome, exemplos, valor, aoMudar }: { nome: string; exemplos: string; valor: number; aoMudar: (n: number) => void }) {
  const botao = (sinal: "−" | "+", n: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${sinal === "+" ? "Mais" : "Menos"} ${nome.toLowerCase()}`}
      onPress={() => aoMudar(Math.max(0, Math.min(99, n)))}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 12, borderWidth: 1.5, borderColor: CORES.linhaForte, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={{ color: CORES.marca, fontSize: 20, fontWeight: "700" }}>{sinal}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
      <View style={{ flex: 1 }}>
        <Text titulo style={{ color: CORES.tinta, fontSize: 14.5, fontWeight: "600" }}>
          {nome}
        </Text>
        <Text style={{ color: CORES.suave, fontSize: 12 }} numberOfLines={1}>
          {exemplos}
        </Text>
      </View>
      {botao("−", valor - 1)}
      <Text style={{ width: 26, textAlign: "center", color: CORES.tinta, fontSize: 17, fontWeight: "700" }}>{String(valor)}</Text>
      {botao("+", valor + 1)}
    </View>
  );
}

const soAlgarismos = (v: string) => v.replace(/\D/g, "").slice(0, 4);

/** Os serviços, em botões (o primeiro bloco de «O que precisa?»). */
function EscolherServico({ r, c, mudar }: { r: Rascunho; c: Catalogo; mudar: (p: Partial<Rascunho>) => void }) {
  // Escolhido o serviço, fica só ele com «Mudar»; as perguntas seguintes sobem (02-11-2026).
  const [aMudar, setAMudar] = useState(false);
  const servico = servicoDe(r, c);
  if (servico && soAEscolhida(true, servico.id, c.servicos.map((s) => s.id), aMudar)) {
    const a = aparenciaDoServico(servico.id);
    return (
      <Marcado campo="servico">
        <EscolhaFeita
          nome={servico.nome}
          rotulo="O serviço"
          icone={<Ionicons name={a.icone as never} size={20} color={a.tom.forte} />}
          aoMudar={() => {
            animarAMudanca();
            setAMudar(true);
          }}
        />
      </Marcado>
    );
  }
  return (
    <Marcado campo="servico">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {c.servicos.map((s) => {
          const a = aparenciaDoServico(s.id);
          const escolhido = s.id === r.servico;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: escolhido }}
              accessibilityLabel={s.nome}
              onPress={() => {
                animarAMudanca();
                setAMudar(false);
                if (escolhido) return;
                mudar({
                  servico: s.id,
                  // As respostas da categoria de antes não seguem (d1): cada serviço tem as suas perguntas.
                  ...semAsRespostasDoServico(),
                  // A garagem e a cave ficam no rés-do-chão, como no simulador do site.
                  ...(semAndar(s.espaco) ? { acesso: { ...r.acesso, floor: "rés-do-chão", hasElevator: undefined } } : {}),
                });
              }}
              style={({ pressed }) => ({
                flexBasis: 150,
                flexGrow: 1,
                minHeight: 56,
                borderRadius: 16,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                borderWidth: escolhido ? 2 : 1,
                borderColor: escolhido ? a.tom.forte : CORES.linha,
                backgroundColor: escolhido ? a.tom.claro : CORES.fundo,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name={a.icone as never} size={20} color={a.tom.forte} />
              <Text titulo style={{ flex: 1, color: CORES.tinta, fontSize: 13.5, fontWeight: "600" }} numberOfLines={2}>
                {s.nome}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Marcado>
  );
}

/** «O que precisa?» — o serviço, quanto é, e uma descrição curta. */
function EcraOQue({
  r,
  c,
  mudar,
  referencia,
  sugestoes,
}: {
  r: Rascunho;
  c: Catalogo;
  mudar: (p: Partial<Rascunho>) => void;
  referencia: Referencia | null;
  sugestoes?: ReactNode;
}) {
  const d = detalhesDe(r, c);
  const e = espacoDe(r, c);
  const perguntas = perguntasDe(r, c);
  // As perguntas da categoria (R7, d1): a descrição primeiro (o leitor sugere a partir dela), depois as perguntas.
  if (d && perguntas) {
    return (
      <View style={{ gap: 18 }}>
        <EscolherServico r={r} c={c} mudar={mudar} />
        <Campo
          rotulo="Descreva em poucas palavras"
          campo="descricao"
          valor={r.descricao}
          aoMudar={(v) => mudar({ descricao: v })}
          multiline
          maxLength={2000}
          style={{ minHeight: 96, textAlignVertical: "top" }}
        />
        {sugestoes}
        <PerguntasDaCategoria r={r} perguntas={perguntas} ecra="oque" mudar={mudar} espaco={e} />
        <CaixaDaReferencia referencia={referencia} />
      </View>
    );
  }
  return (
    <View style={{ gap: 18 }}>
      <EscolherServico r={r} c={c} mudar={mudar} />

      {d === "moveis" ? (
        <Escolhas
          recolher
          rotulo="Como prefere indicar?"
          campo="movelModo"
          opcoes={[
            { id: "item", nome: "Por item" },
            { id: "carga", nome: "Por volume" },
          ]}
          valor={r.movelModo}
          aoEscolher={(v) => mudar({ movelModo: v, volume: undefined, itens: { pequeno: 0, medio: 0, grande: 0 } })}
        />
      ) : null}
      {d === "moveis" && r.movelModo === "item" ? (
        <Marcado campo="itens">
          {TAMANHOS_DOS_ITENS.map((t) => (
            <Contador
              key={t.id}
              nome={t.nome}
              exemplos={t.exemplos}
              valor={r.itens?.[t.id] ?? 0}
              aoMudar={(n) => mudar({ itens: { pequeno: 0, medio: 0, grande: 0, ...r.itens, [t.id]: n } })}
            />
          ))}
        </Marcado>
      ) : null}
      {e ? (
        <View style={{ gap: 14 }}>
          <Escolhas recolher campo="volume" rotulo={e.quantidade.titulo} opcoes={e.quantidade.opcoes} valor={r.volume} aoEscolher={(v) => mudar({ volume: v })} />
          <Escolhas recolher campo="acessoDoEspaco" rotulo={e.acesso.titulo} opcoes={e.acesso.opcoes} valor={r.acessoDoEspaco} aoEscolher={(v) => mudar({ acessoDoEspaco: v })} />
          {e.coisas ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>{e.coisas.titulo}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {e.coisas.opcoes.map((o) => {
                  const activa = !!r.coisasDoEspaco?.includes(o.id);
                  return (
                    <Pressable
                      key={o.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: activa }}
                      accessibilityLabel={o.nome}
                      onPress={() => mudar({ coisasDoEspaco: mudarCoisasDoEspaco(e, r.coisasDoEspaco, o.id) })}
                      style={({ pressed }) => ({
                        minHeight: 44,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 10,
                        borderWidth: activa ? 2 : 1,
                        borderColor: activa ? CORES.marca : CORES.linha,
                        backgroundColor: activa ? CORES.marcaSuave : CORES.fundo,
                        opacity: pressed ? 0.7 : 1,
                        justifyContent: "center",
                      })}
                    >
                      <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: activa ? "700" : "500" }}>{o.nome}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {avisosDoEspaco(e, r.coisasDoEspaco).map((a) => (
                <Aviso key={a} texto={a} tom="aviso" />
              ))}
            </View>
          ) : null}
        </View>
      ) : d === "monos" || d === "esvaziamento" || (d === "moveis" && r.movelModo === "carga") ? (
        <>
          <Escolhas recolher campo="volume" rotulo="Quanto há para levar?" opcoes={VOLUMES} valor={r.volume} aoEscolher={(v) => mudar({ volume: v })} />
          <Campo rotulo="Número de peças (opcional)" valor={r.quantidadeExacta} aoMudar={(v) => mudar({ quantidadeExacta: soAlgarismos(v) })} keyboardType="number-pad" />
        </>
      ) : null}
      {d === "entulho" ? (
        <View style={{ gap: 14 }}>
          <Escolhas recolher campo="entulho" rotulo="Como está o entulho?" opcoes={c.entulho} valor={r.entulho} aoEscolher={(v) => mudar({ entulho: v })} />
          <Escolhas
            recolher
            rotulo="Quanto é?"
            campo="entulhoModo"
            opcoes={[
              { id: "sacos", nome: "Em sacos" },
              { id: "volume", nome: "Por volume" },
              { id: "incerto", nome: "Não tenho a certeza" },
            ]}
            valor={r.entulhoModo}
            aoEscolher={(v) => mudar({ entulhoModo: v as Rascunho["entulhoModo"] })}
          />
          {r.entulhoModo === "sacos" && r.entulho === "misto" ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Campo campo="sacos" rotulo="Já em sacos" valor={r.ensacados} aoMudar={(v) => mudar({ ensacados: soAlgarismos(v) })} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Campo rotulo="Por ensacar" valor={r.porEnsacar} aoMudar={(v) => mudar({ porEnsacar: soAlgarismos(v) })} keyboardType="number-pad" />
              </View>
            </View>
          ) : r.entulhoModo === "sacos" ? (
            <Campo campo="sacos" rotulo="Quantos sacos?" valor={r.sacos} aoMudar={(v) => mudar({ sacos: soAlgarismos(v) })} keyboardType="number-pad" />
          ) : null}
          {r.entulhoModo === "volume" ? (
            <Escolhas recolher campo="entulhoVolume" rotulo="Quanto enche?" opcoes={VOLUMES.filter((v) => v.id !== "incerto")} valor={r.entulhoVolume} aoEscolher={(v) => mudar({ entulhoVolume: v })} />
          ) : null}
        </View>
      ) : null}
      {d === "mudanca" ? <Escolhas recolher campo="tipologia" rotulo="O tamanho da casa" opcoes={c.tipologias} valor={r.tipologia} aoEscolher={(v) => mudar({ tipologia: v })} /> : null}

      {d ? (
        <Campo
          rotulo="Descreva em poucas palavras"
          campo="descricao"
          valor={r.descricao}
          aoMudar={(v) => mudar({ descricao: v })}
          multiline
          maxLength={2000}
          style={{ minHeight: 96, textAlignVertical: "top" }}
        />
      ) : null}
      {/* Na garagem, no sótão e na cave a desmontagem não se pergunta (d5, como o simulador). */}
      {d && !e ? (
        <Escolhas
          rotulo="É preciso desmontar móveis?"
          opcoes={[
            { id: "sim", nome: "Sim" },
            { id: "nao", nome: "Não" },
          ]}
          valor={r.desmontagem === undefined ? undefined : r.desmontagem ? "sim" : "nao"}
          aoEscolher={(v) => mudar({ desmontagem: v === "sim" })}
        />
      ) : null}
      {d ? <CaixaDaReferencia referencia={referencia} /> : null}
    </View>
  );
}

function Fotografias({
  r,
  maximo,
  mudar,
}: {
  r: Rascunho;
  maximo: number;
  mudar: (f: (antes: Rascunho) => Partial<Rascunho>) => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  // As já reduzidas, só na memória: «Repetir» volta a enviar a mesma, sem a reduzir outra vez.
  const reduzidas = useRef(new Map<string, FotografiaReduzida>());
  const restam = maximo - r.fotos.length;

  async function enviarUma(uri: string, reduzir: () => Promise<FotografiaReduzida>) {
    mudar((a) => ({ fotos: [...a.fotos.filter((f) => f.uri !== uri), { uri, estado: "a-enviar" }] }));
    try {
      const f = reduzidas.current.get(uri) ?? (await reduzir());
      reduzidas.current.set(uri, f);
      const url = await enviarFotografia(f);
      mudar((a) => ({ fotos: a.fotos.map((x) => (x.uri === uri ? { uri, estado: "enviada", url, nome: f.nome, tamanho: f.tamanho, tipo: f.tipo } : x)) }));
    } catch (e) {
      setErro(mensagemDe(e, "Uma fotografia não seguiu. Tente outra vez."));
      mudar((a) => ({ fotos: a.fotos.map((x) => (x.uri === uri ? { ...x, estado: "falhou" } : x)) }));
    }
  }

  async function juntar(origem: "camara" | "galeria") {
    setErro(null);
    const e = await escolherFotografias(origem, restam);
    if ("erro" in e) return setErro(e.erro);
    for (const a of e.fotografias) await enviarUma(a.uri, () => reduzirFotografia(a));
  }

  async function juntarVideo() {
    setErro(null);
    const e = await escolherVideo();
    if ("erro" in e) return setErro(e.erro);
    if (e.video) {
      const v = e.video;
      await enviarUma(v.uri, async () => v);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Botao titulo="Tirar fotografia" tipo="secundario" desligado={restam <= 0} aoCarregar={() => void juntar("camara")} />
        </View>
        <View style={{ flex: 1 }}>
          <Botao titulo="Da galeria" tipo="secundario" desligado={restam <= 0} aoCarregar={() => void juntar("galeria")} />
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Ligacao titulo="Juntar um vídeo" aoCarregar={() => void juntarVideo()} />
        <Text style={{ color: CORES.suave, fontSize: 12.5 }}>{`${r.fotos.length} de ${maximo}`}</Text>
      </View>
      {erro ? <Aviso texto={erro} tom="mau" /> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {r.fotos.map((f) => {
          const video = !!f.tipo?.startsWith("video/");
          return (
            <View key={f.uri} style={{ width: 92, gap: 4 }}>
              {video ? (
                <View style={{ width: 92, height: 92, borderRadius: 12, backgroundColor: CORES.superficie, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="videocam-outline" size={28} color={CORES.suave} />
                </View>
              ) : (
                <Image source={{ uri: f.url ?? f.uri }} style={{ width: 92, height: 92, borderRadius: 12, backgroundColor: CORES.superficie, opacity: f.estado === "enviada" ? 1 : 0.5 }} />
              )}
              <Text style={{ color: f.estado === "falhou" ? CORES.mau : CORES.suave, fontSize: 12 }} numberOfLines={1}>
                {f.estado === "a-enviar" ? "A enviar…" : f.estado === "falhou" ? "Não seguiu" : "Enviada"}
              </Text>
              {f.estado === "falhou" && !video ? <Ligacao titulo="Repetir" aoCarregar={() => void enviarUma(f.uri, () => reduzirFotografiaDoEndereco(f.uri))} /> : null}
              {f.estado !== "a-enviar" ? <Ligacao titulo="Tirar" tom="suave" aoCarregar={() => mudar((a) => ({ fotos: a.fotos.filter((x) => x.uri !== f.uri) }))} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Uma caixa de escolher (as fotos no site; o NIF na fatura). */
function Caixa({ marcada, aoMudar, texto }: { marcada: boolean; aoMudar: () => void; texto: string }) {
  return (
    <Pressable
      onPress={aoMudar}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
      style={{ flexDirection: "row", gap: 12, paddingVertical: 8, alignItems: "flex-start" }}
    >
      <Ionicons name={marcada ? "checkbox" : "square-outline"} size={22} color={CORES.marca} />
      <Text style={{ flex: 1, color: CORES.tinta, fontSize: 14, lineHeight: 20 }}>{texto}</Text>
    </Pressable>
  );
}

/**
 * O CALENDÁRIO DO MÊS (02-11-2026, ordem do CEO com o sim do dono): outra
 * forma de escolher o dia dos botões rápidos — os mesmos dias (de amanhã, em
 * Lisboa, até `DIAS_NO_CALENDARIO`), os passados desligados — e depois a hora,
 * de 30 em 30 minutos das 8h00 às 20h00 de Lisboa. Não muda preços nem prazos:
 * vai a mesma `dataPreferida`, e a hora em `horaPreferida` (02-11-2026).
 */
function Calendario({
  visivel,
  diaAntes,
  horaAntes,
  aoFechar,
  aoEscolher,
}: {
  visivel: boolean;
  diaAntes?: string;
  horaAntes?: string;
  aoFechar: () => void;
  aoEscolher: (dia: string, hora: string) => void;
}) {
  const agora = new Date();
  const meses = mesesDoCalendario(agora);
  // Quatro horas por linha, todas da mesma largura (a folha tem 22 de margem de cada lado).
  const larguraDaHora = Math.floor((useWindowDimensions().width - 44 - 3 * 8) / 4);
  const [mes, setMes] = useState(meses[0]);
  const [dia, setDia] = useState<string | undefined>(undefined);
  // Ao abrir, começa no mês do dia já escolhido (ou no de amanhã) e pela escolha do dia.
  useEffect(() => {
    if (!visivel) return;
    const daqui = diaAntes && meses.includes(diaAntes.slice(0, 7)) ? diaAntes.slice(0, 7) : meses[0];
    setMes(daqui);
    setDia(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel]);
  const i = Math.max(0, meses.indexOf(mes));
  const seta = (nome: "chevron-back" | "chevron-forward", rotulo: string, para: number) => {
    const ligada = para >= 0 && para < meses.length;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={rotulo}
        accessibilityState={{ disabled: !ligada }}
        disabled={!ligada}
        onPress={() => setMes(meses[para])}
        hitSlop={8}
        style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", opacity: !ligada ? 0.3 : pressed ? 0.6 : 1 })}
      >
        <Ionicons name={nome} size={22} color={CORES.marca} />
      </Pressable>
    );
  };
  return (
    <Folha visivel={visivel} aoFechar={aoFechar}>
      {!dia ? (
        <>
          <Titulo>Escolha o dia</Titulo>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            {seta("chevron-back", "Mês anterior", i - 1)}
            <Text titulo style={{ color: CORES.tinta, fontSize: 16, fontWeight: "700" }}>
              {nomeDoMes(mes)}
            </Text>
            {seta("chevron-forward", "Mês seguinte", i + 1)}
          </View>
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row" }}>
              {DIAS_DA_SEMANA_DO_CALENDARIO.map((x, k) => (
                <Text key={k} style={{ flex: 1, textAlign: "center", color: CORES.suave, fontSize: 12.5, fontWeight: "600" }}>
                  {x}
                </Text>
              ))}
            </View>
            {semanasDoMes(mes, agora).map((semana, s) => (
              <View key={s} style={{ flexDirection: "row" }}>
                {semana.map((x, k) =>
                  x ? (
                    <View key={k} style={{ flex: 1, alignItems: "center", paddingVertical: 2 }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={diaPorExtenso(x.dia)}
                        accessibilityState={{ disabled: !x.possivel, selected: x.dia === diaAntes }}
                        disabled={!x.possivel}
                        onPress={() => setDia(x.dia)}
                        style={({ pressed }) => ({
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: x.dia === diaAntes ? 2 : 0,
                          borderColor: CORES.marca,
                          backgroundColor: x.dia === diaAntes ? CORES.marcaSuave : "transparent",
                          opacity: pressed ? 0.6 : 1,
                        })}
                      >
                        <Text style={{ color: x.possivel ? CORES.tinta : CORES.linhaForte, fontSize: 15, fontWeight: x.possivel ? "600" : "400" }}>{String(x.numero)}</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View key={k} style={{ flex: 1 }} />
                  ),
                )}
              </View>
            ))}
          </View>
          <Paragrafo pequeno suave>
            Os dias a cinzento já não se podem escolher.
          </Paragrafo>
        </>
      ) : (
        <>
          <Titulo>A que horas?</Titulo>
          <Paragrafo pequeno suave>
            {`${diaPorExtenso(dia)} · hora de Lisboa`}
          </Paragrafo>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {HORAS_DO_CALENDARIO.map((h) => {
              const escolhida = dia === diaAntes && h === horaAntes;
              return (
                <Pressable
                  key={h}
                  accessibilityRole="button"
                  accessibilityLabel={horaPorExtenso(h)}
                  onPress={() => aoEscolher(dia, h)}
                  style={({ pressed }) => ({
                    width: larguraDaHora,
                    minHeight: 44,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: escolhida ? 2 : 1,
                    borderColor: escolhida ? CORES.marca : CORES.linha,
                    backgroundColor: escolhida ? CORES.marcaSuave : CORES.fundo,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: escolhida ? "700" : "500" }}>{horaPorExtenso(h)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Ligacao titulo="Mudar o dia" aoCarregar={() => setDia(undefined)} />
        </>
      )}
    </Folha>
  );
}

function EcraQuando({ r, c, mudar }: { r: Rascunho; c: Catalogo; mudar: (p: Partial<Rascunho>) => void }) {
  const dias = diasParaEscolher(new Date());
  const d = detalhesDe(r, c);
  const [calendario, setCalendario] = useState(false);
  return (
    <View style={{ gap: 18 }}>
      <Escolhas
        recolher={r.quando === "data" || d === "manutencao"}
        campo="quando"
        opcoes={c.quando.map((q) => ({ id: q, nome: TEXTO_DO_QUANDO[q] }))}
        valor={r.quando}
        aoEscolher={(v) => mudar({ quando: v, data: v === "data" ? r.data : undefined, hora: v === "data" ? r.hora : undefined })}
      />
      {/* «Hoje» vai como pedido urgente, sem prometer o dia (d8, 31-10-2026) — a frase da R7. */}
      {r.quando === "hoje" && c.textos.pedidoUrgente ? <Paragrafo pequeno suave>{c.textos.pedidoUrgente}</Paragrafo> : null}
      {r.quando === "data" ? (
        <Marcado campo="data">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {dias.map((x) => {
              const escolhido = r.data === x.dia;
              return (
                <Pressable
                  key={x.dia}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: escolhido }}
                  accessibilityLabel={x.texto}
                  onPress={() => mudar({ data: x.dia, hora: undefined })}
                  style={({ pressed }) => ({
                    width: 120,
                    minHeight: 64,
                    padding: 10,
                    borderRadius: 14,
                    borderWidth: escolhido ? 2 : 1,
                    borderColor: escolhido ? CORES.marca : CORES.linha,
                    backgroundColor: escolhido ? CORES.marcaSuave : CORES.fundo,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: CORES.tinta, fontSize: 13 }} numberOfLines={3}>
                    {x.texto}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Marcado>
      ) : null}
      {r.quando === "data" ? (
        <View style={{ gap: 10 }}>
          <Botao titulo="Escolher no calendário" tipo="secundario" aoCarregar={() => setCalendario(true)} />
          {r.data ? <Paragrafo pequeno>{`Escolheu: ${textoDoQuando(r)}.`}</Paragrafo> : null}
        </View>
      ) : null}
      <Calendario
        visivel={calendario}
        diaAntes={r.data}
        horaAntes={r.hora}
        aoFechar={() => setCalendario(false)}
        aoEscolher={(dia, hora) => {
          setCalendario(false);
          mudar({ quando: "data", data: dia, hora });
        }}
      />
      {d === "manutencao" && !perguntasDe(r, c)?.some((p) => p.id === "repeticao") ? (
        <Escolhas rotulo="Repetir o serviço?" opcoes={REPETICAO} valor={r.repeticao ?? "pontual"} aoEscolher={(v) => mudar({ repeticao: v })} />
      ) : null}
    </View>
  );
}

function EcraContacto({ r, mudar }: { r: Rascunho; mudar: (p: Partial<Rascunho>) => void }) {
  return (
    <View style={{ gap: 14 }}>
      <Campo campo="nome" rotulo="Nome" valor={r.nome} aoMudar={(v) => mudar({ nome: v })} autoComplete="name" />
      <Campo campo="telefone" rotulo="Telemóvel" valor={r.telefone} aoMudar={(v) => mudar({ telefone: v })} keyboardType="phone-pad" autoComplete="tel" />
      <Caixa marcada={r.querNif} aoMudar={() => mudar({ querNif: !r.querNif })} texto="Quero o meu NIF na fatura" />
      {r.querNif ? <Campo campo="nif" rotulo="NIF" valor={r.nif} aoMudar={(v) => mudar({ nif: v.replace(/[^\d]/g, "").slice(0, 9) })} keyboardType="number-pad" /> : null}
    </View>
  );
}

function EcraResumo({
  r,
  c,
  mudar,
  referencia,
  irPara,
}: {
  r: Rascunho;
  c: Catalogo;
  mudar: (p: Partial<Rascunho>) => void;
  referencia: Referencia | null;
  irPara: (e: EcraDoPedir) => void;
}) {
  return (
    <View style={{ gap: 18 }}>
      {/* A estimativa (d4/d6): «Serviço (sem IVA)», «IVA (23 %)» e «Total estimado», as faixas da R12, e a conta por baixo. Sem R12, nada. */}
      {referencia ? (
        <View style={{ gap: 10 }}>
          {referencia.conta ? (
            <>
              <Subtitulo>{ESTIMATIVA}</Subtitulo>
              <PrecoEmLinhas conta={referencia.conta} rotuloDoTotal={ROTULO_DO_TOTAL_DE_REFERENCIA} />
              <PorqueDaReferencia porque={referencia.porque} />
            </>
          ) : (
            <CaixaDaReferencia referencia={referencia} />
          )}
          {referencia.nota ? <Text style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 17 }}>{referencia.nota}</Text> : null}
        </View>
      ) : null}
      <View>
        {linhasDoResumo(r, c).map((l, i) => (
          <LinhaDoResumo key={i} rotulo={l.rotulo} valor={l.texto} aoAlterar={() => irPara(ecraDaLinha(l))} />
        ))}
      </View>
      {c.textos.valorDesejadoEtiqueta ? (
        <Campo
          rotulo={`${c.textos.valorDesejadoEtiqueta} (opcional)`}
          valor={r.valorDesejado}
          aoMudar={(v) => mudar({ valorDesejado: v.replace(/[^\d,.]/g, "") })}
          keyboardType="decimal-pad"
        />
      ) : null}
    </View>
  );
}

/** Os parâmetros com que se chegou ao Pedir quando se perguntou pelo pedido a meio: já não se aplicam. */
type ParametrosPostosDeParte = { servico?: string; morada?: string };

export function NovoPedido() {
  // «Começar do zero» (d5): o formulário monta-se outra vez, limpo, como se nunca tivesse havido rascunho.
  const [geracao, setGeracao] = useState(0);
  const deParte = useRef<ParametrosPostosDeParte | null>(null);
  return <Formulario key={geracao} deParte={deParte} recomecar={() => setGeracao((g) => g + 1)} />;
}

function Formulario({ deParte, recomecar }: { deParte: RefObject<ParametrosPostosDeParte | null>; recomecar: () => void }) {
  const { catalogo, erro: erroDoCatalogo, aLer, recarregar } = useCatalogo();
  const { email, ligado } = useSessao();
  const { recarregar: recarregarALista, pedidos: osPedidos } = usePedidos();
  // «É nesta morada?»: as moradas da conta e dos últimos pedidos (null enquanto lê), e se ele pediu «Outra morada».
  const [moradas, setMoradas] = useState<Morada[] | null>(null);
  const [outraMorada, setOutraMorada] = useState(false);
  const params = useLocalSearchParams<{ servico?: string; morada?: string; entrou?: string }>();
  const [r, setR] = useState<Rascunho | null>(null);
  const [falta, setFalta] = useState<string | null>(null);
  const [semFotos, setSemFotos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroDoEnvio, setErroDoEnvio] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<{ id: number; aviso: string | null } | null>(null);
  // Numa mudança enviada logo aos parceiros escolhidos, os passos que a rota do pedido manda (11-11-2026).
  const [passosDoEnvio, setPassosDoEnvio] = useState<Array<{ titulo: string; texto: string }> | null>(null);
  // A lista dos parceiros da mudança (11-11-2026): o que a rota respondeu, e a escolha enquanto ele a faz.
  const [listaDosParceiros, setListaDosParceiros] = useState<ListaDosParceiros | null>(null);
  const [aLerAListaDosParceiros, setALerAListaDosParceiros] = useState(false);
  const [pessoasDaLista, setPessoasDaLista] = useState<Pessoas>(2);
  const [idsDaLista, setIdsDaLista] = useState<string[]>([]);
  const [procurarMaisParceiros, setProcurarMaisParceiros] = useState(false);
  const [perguntarAvisos, setPerguntarAvisos] = useState(false);
  const [paraEntrar, setParaEntrar] = useState(false);
  const [entrouAgora, setEntrouAgora] = useState(false);
  const [erroDoGoogle, setErroDoGoogle] = useState<string | null>(null);
  // As folhas (Modal) ficam por cima de tudo: com outro ecrã à frente (o link do email abre a confirmação), escondem-se.
  const emFoco = useIsFocused();
  const [referencia, setReferencia] = useState<Referencia | null>(null);
  // O que o leitor percebeu na descrição e nas fotografias (d1): só entra o que ele aceitar.
  const [sugestoes, setSugestoes] = useState<SugestaoDoPedido[]>([]);
  const rascunho = useRef<Rascunho | null>(null);
  const scroll = useRef<ScrollView>(null);
  const conteudo = useRef<View>(null);
  // Os campos que faltavam quando tocou em Continuar/Enviar (ficam a vermelho enquanto faltarem).
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const lugares = useRef(new Map<string, LugarDoCampo>());
  const registar = useCallback((campo: string, lugar: LugarDoCampo) => {
    lugares.current.set(campo, lugar);
    return () => {
      if (lugares.current.get(campo) === lugar) lugares.current.delete(campo);
    };
  }, []);

  // O pedido a meio (d5): a sessão da app, a sessão em que este Pedir já mostrou o rascunho, e a caixa.
  const sessao = useSessaoDaApp();
  const [vistoNaSessao, setVistoNaSessao] = useState<number | null>(() => sessaoEmQueOPedirFoiVisto());
  const [aMeio, setAMeio] = useState<{ linha: string } | null>(null);
  const entrouNaSessao = useRef<number | null>(null);
  // Depois de «Começar do zero» este formulário sai: o que ainda chegar (a conta, o percurso, uma fotografia) já não grava nada.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    void (async () => {
      const guardado = await lerRascunho();
      if (!montado.current) return;
      rascunho.current = guardado ?? rascunhoVazio();
      setR(rascunho.current);
    })();
  }, []);

  // Com conta: o nome e o telefone da conta, se ainda não os escreveu.
  useEffect(() => {
    if (!ligado || !r || r.nome || r.telefone) return;
    pedir<{ user?: { name?: string | null; phone?: string | null } }>("/api/users/me")
      .then((u) => {
        if (!rascunho.current?.nome && !rascunho.current?.telefone) mudar({ nome: u.user?.name ?? "", telefone: u.user?.phone ?? "" });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ligado, r === null]);

  // Voltou do link do email (E1a → aqui): a faixa «Entrou como…», e não envia sozinha.
  // O `entrou` sai da rota logo a seguir: senão ficava lá e valia outra vez numa sessão seguinte.
  useEffect(() => {
    if (params.entrou === "1" && ligado) {
      setEntrouAgora(true);
      entrouNaSessao.current = sessao;
      esquecerDepoisDeEntrar();
      router.setParams({ entrou: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.entrou, ligado]);

  const mudarCom = useCallback((f: (antes: Rascunho) => Partial<Rascunho>) => {
    if (!montado.current) return;
    const antes = rascunho.current ?? rascunhoVazio();
    const novo = { ...antes, ...f(antes), guardadoEm: new Date().toISOString() };
    if (!antes.servico && novo.servico) void contarRascunhoNovo();
    rascunho.current = novo;
    setR(novo);
    setFalta(null);
    guardarRascunho(novo);
  }, []);
  const mudar = useCallback((p: Partial<Rascunho>) => mudarCom(() => p), [mudarCom]);

  // O pedido a meio (d5): na primeira vez que o Pedir se vê nesta sessão da app, pergunta se há um pedido a meio.
  const porDecidir = emFoco && r !== null && !!catalogo && vistoNaSessao !== sessao;
  useEffect(() => {
    if (!porDecidir || !r || !catalogo) return;
    marcarOPedirVisto(sessao);
    setVistoNaSessao(sessao);
    const vemDeEntrar = params.entrou === "1" || entrouNaSessao.current === sessao;
    if (!perguntarPeloPedidoAMeio({ rascunho: r, sessao, vistoNaSessao, vemDeEntrar })) return;
    // Chegou por um serviço (ou «Pedir outra vez») com este pedido a meio: decide ele, e esse serviço não se aplica por cima.
    deParte.current = params.servico || params.morada ? { servico: params.servico, morada: params.morada } : null;
    setAMeio({ linha: linhaDoPedidoAMeio(servicoDe(r, catalogo)?.nome, r.guardadoEm) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porDecidir]);

  // Vindo dos Serviços (o id) ou de «Pedir outra vez» (o nome e a morada do pedido anterior).
  useEffect(() => {
    if (!r || !catalogo || porDecidir || aMeio) return;
    const postosDeParte = deParte.current;
    deParte.current = null;
    if (!params.servico && !params.morada) return;
    if (postosDeParte && postosDeParte.servico === params.servico && postosDeParte.morada === params.morada) return;
    const s = catalogo.servicos.find((x) => x.id === params.servico || x.nome === params.servico);
    if (s && s.id !== r.servico) {
      mudar({
        servico: s.id,
        passo: 1,
        ecra: undefined,
        ...semAsRespostasDoServico(),
        ...(semAndar(s.espaco) ? { acesso: { ...r.acesso, floor: "rés-do-chão", hasElevator: undefined } } : {}),
      });
    }
    if (params.morada && !r.morada) mudar({ morada: { formattedAddress: params.morada, aMao: true } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogo, params.servico, params.morada, r === null, porDecidir, aMeio === null]);

  // A morada da barra de cima (morada-do-cliente.ts), se o rascunho ainda não tiver uma.
  useEffect(() => {
    if (!r || r.morada || params.morada) return;
    let vivo = true;
    void lerMoradaGuardada().then((m) => {
      if (vivo && m && !rascunho.current?.morada) mudar({ morada: m });
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r === null]);

  // «É nesta morada?» (02-11-2026): com sessão, a da conta e as dos últimos pedidos; a primeira fica escolhida se o rascunho não tiver morada.
  const idsDosPedidos = osPedidos.map((p) => p.id).join(",");
  useEffect(() => {
    if (!ligado) {
      setMoradas([]);
      return;
    }
    if (!r) return; // o rascunho ainda a ler: volta a correr quando chegar
    let vivo = true;
    void lerMoradasParaOPedido(idsDosPedidos ? idsDosPedidos.split(",").map(Number) : [])
      .catch(() => [] as Morada[])
      .then((lista) => {
        if (vivo) setMoradas(lista);
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ligado, idsDosPedidos, r === null]);

  // Já escolhida: sem morada no rascunho (e sem ter pedido «Outra morada»), fica a primeira.
  const semMoradaNoRascunho = !!r && !r.morada?.formattedAddress?.trim();
  useEffect(() => {
    if (ligado && semMoradaNoRascunho && !outraMorada && moradas && moradas.length > 0) mudar({ morada: moradas[0], distanciaKm: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ligado, semMoradaNoRascunho, outraMorada, moradas]);

  // A «Estimativa» (R12) do que escolheu, e só ela (d4/d6): sem resposta da R12, não há bloco nenhum.
  const chaveDaReferencia = r && catalogo ? JSON.stringify(corpoDaReferencia(r, catalogo)) : "";
  useEffect(() => {
    if (!r || !catalogo || !r.servico) return setReferencia(null);
    const corpo = corpoDaReferencia(r, catalogo);
    let vivo = true;
    const t = setTimeout(() => {
      pedir<unknown>(ROTA_DA_REFERENCIA, { metodo: "POST", corpo, semSessao: true })
        .then((v) => {
          if (vivo) setReferencia(referenciaValida(v));
        })
        .catch(() => {
          if (vivo) setReferencia(null);
        });
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDaReferencia, catalogo]);

  // O leitor do pedido (d1): lê a descrição e as fotografias quando mudam (não a cada resposta) e sugere — nunca preenche.
  const chaveDoLeitorAgora = r && catalogo ? chaveDoLeitor(r, catalogo) : "";
  useEffect(() => {
    if (!catalogo || !rascunho.current || !chaveDoLeitorAgora) return setSugestoes([]);
    let vivo = true;
    const t = setTimeout(() => {
      const agora = rascunho.current;
      const corpo = agora ? corpoDoLeitor(agora, catalogo) : null;
      if (!corpo) return;
      pedir<unknown>(ROTA_DO_LEITOR, { metodo: "POST", corpo, semSessao: true })
        .then((v) => {
          if (vivo && rascunho.current) setSugestoes(sugestoesValidas(v, rascunho.current, catalogo));
        })
        .catch(() => {});
    }, 1500);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDoLeitorAgora, catalogo]);

  // O percurso da mudança (como o site: `POST /api/maps/route`; se falhar, segue sem ele).
  const origem = r?.morada;
  const destino = r?.destino;
  useEffect(() => {
    if (!catalogo || !r || detalhesDe(r, catalogo) !== "mudanca" || r.distanciaKm) return;
    if (!origem?.formattedAddress || !destino?.formattedAddress) return;
    pedir<{ distanceKm?: number }>(ROTA_DO_PERCURSO, {
      metodo: "POST",
      corpo: { origin: { lat: origem.lat, lng: origem.lng, formattedAddress: origem.formattedAddress }, destination: { lat: destino.lat, lng: destino.lng, formattedAddress: destino.formattedAddress } },
      semSessao: true,
    })
      .then((x) => {
        if (typeof x.distanceKm === "number" && x.distanceKm > 0) mudar({ distanciaKm: x.distanceKm });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origem?.formattedAddress, destino?.formattedAddress, catalogo]);

  /*
   * A LISTA DOS PARCEIROS DA MUDANÇA (11-11-2026), como o simulador do site: ao
   * chegar ao ecrã, e a cada troca da equipa, pede-se a lista com o mesmo corpo
   * que o pedido vai levar. Desligada ou sem resposta: o pedido segue como
   * sempre, sem o ecrã. Sem parceiros: o ecrã diz que a CLYON procura, e segue.
   */
  const ecraAgora = r && catalogo ? ecraDe(r, catalogo) : null;
  const naLista = ecraAgora === "parceiros";
  useEffect(() => {
    if (!naLista) return;
    // Ao entrar: a escolha que já tinha feito (se voltou atrás).
    const antes = rascunho.current?.parceiros;
    setPessoasDaLista(antes?.pessoas ?? 2);
    setIdsDaLista(antes?.ids ?? []);
    setProcurarMaisParceiros(antes?.procurarMais ?? false);
  }, [naLista]);
  useEffect(() => {
    if (!naLista || !catalogo || !rascunho.current) return;
    const corpo = corpoDaLista(corpoDoPedido(rascunho.current, catalogo, { emailDaSessao: null, rascunhosAntes: 0 }).order, pessoasDaLista);
    let vivo = true;
    const semLista = () => {
      if (!vivo || !montado.current) return;
      setListaDosParceiros(null);
      setMarcados(new Set());
      setFalta(null);
      mudar({ semListaDeParceiros: true, parceiros: undefined, ecra: "contacto", passo: passoDoEcra("contacto") });
    };
    if (!corpo) {
      semLista();
      return;
    }
    setALerAListaDosParceiros(true);
    pedir<unknown>(ROTA_DOS_PARCEIROS, { metodo: "POST", corpo, semSessao: true })
      .then((resposta) => {
        if (!vivo) return;
        const l = listaValida(resposta);
        if (!l || !l.ligado) return semLista();
        setListaDosParceiros(l);
        // Quem já não está na lista (mudou a equipa) sai da escolha.
        setIdsDaLista((ids) => soOsDaLista(ids, l));
      })
      .catch(() => semLista())
      .finally(() => {
        if (vivo) setALerAListaDosParceiros(false);
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naLista, pessoasDaLista, catalogo]);

  if (enviado) {
    // Numa mudança enviada logo aos parceiros escolhidos, os passos que a rota do pedido manda (11-11-2026).
    const passos = passosDoEnvio ?? catalogo?.textos.tresPassos ?? [];
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }}>
        <RolagemComTeclado contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Titulo>{`Pedido #${enviado.id} registado`}</Titulo>
          {enviado.aviso ? <Aviso texto={enviado.aviso} tom="aviso" /> : null}
          {passos.map((p, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 14 }}>
              <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: CORES.marcaSuave, alignItems: "center", justifyContent: "center" }}>
                <Text titulo style={{ color: CORES.marca, fontWeight: "700" }}>
                  {String(i + 1)}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text titulo style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>
                  {p.titulo}
                </Text>
                {p.texto ? <Text style={{ color: CORES.suave, fontSize: 13.5, lineHeight: 19 }}>{p.texto}</Text> : null}
              </View>
            </View>
          ))}
          {passos.length === 0 ? <Paragrafo>A CLYON confere o pedido e envia-o aos parceiros da sua zona.</Paragrafo> : null}
          <Paragrafo>As propostas aparecem aqui e avisamos no telemóvel.</Paragrafo>
          <Botao
            titulo="Ver o pedido"
            aoCarregar={() => {
              setEnviado(null);
              router.push(`/pedido/${enviado.id}`);
            }}
          />
          <Ligacao
            titulo="Fazer outro pedido"
            centrada
            aoCarregar={() => {
              setEnviado(null);
              const novo = rascunhoVazio();
              rascunho.current = novo;
              setR(novo);
            }}
          />
        </RolagemComTeclado>
        <Confirmacao
          visivel={perguntarAvisos}
          titulo="Quer receber um aviso quando chegar uma proposta?"
          confirmar="Sim"
          voltar="Agora não"
          aoConfirmar={() => {
            setPerguntarAvisos(false);
            void marcarQueJaPerguntou().then(() => ligarAvisos());
          }}
          aoVoltar={() => {
            setPerguntarAvisos(false);
            void marcarQueJaPerguntou();
          }}
        />
      </SafeAreaView>
    );
  }

  if (!r || (aLer && !catalogo)) return <Carregando />;
  if (!catalogo) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo, padding: 20, gap: 14 }}>
        <Titulo>Pedir orçamento</Titulo>
        <Aviso texto={erroDoCatalogo ?? "Não foi possível ler os serviços. Tente outra vez daqui a pouco."} tom="mau" />
        <Botao titulo="Tentar outra vez" aoCarregar={recarregar} />
        <Ligacao titulo="Pedir pelo WhatsApp" aoCarregar={() => whatsappDaClyon("Olá! Quero pedir um orçamento.")} />
      </SafeAreaView>
    );
  }

  const c = catalogo;
  const ecras = ecrasDoPedir(r, c);
  const ecra = ecraDe(r, c);
  const indice = Math.max(0, ecras.indexOf(ecra));
  const ultimo = ecra === "resumo";
  const d = detalhesDe(r, c);
  const e = espacoDe(r, c);
  const mudanca = d === "mudanca";
  const servico = servicoDe(r, c);
  // «É nesta morada?»: com sessão, enquanto lê as moradas, uma roda; depois, os cartões ou a procura.
  const aLerAsMoradas = ligado && moradas === null;
  const aEscolher = ligado && !!moradas && abreAEscolher(moradas, r.morada, outraMorada);
  const listaAgora = ecra === "parceiros" && !aLerAListaDosParceiros ? listaDosParceiros : null;
  const pergunta =
    ecra === "onde" && aEscolher && moradas
      ? perguntaDaEscolha(moradas.length, mudanca)
      : ecra === "parceiros" && listaAgora?.ligado && listaAgora.textos.titulo
        ? listaAgora.textos.titulo
        : perguntaDoEcra(ecra, d, semAndar(e));
  // Na lista dos parceiros, o botão da rota («Pedir orçamento (2)»), 11-11-2026.
  const tituloDoBotao = ultimo ? "Enviar pedido" : ecra === "onde" && aEscolher && moradas ? botaoDaEscolha(moradas.length) : ecra === "parceiros" ? (botaoDaLista(listaAgora, idsDaLista.length) ?? "Continuar") : "Continuar";
  // Com parceiros escolhidos, os preços são os deles: a estimativa geral da CLYON sai do ecrã (11-11-2026).
  const comParceiros = mudanca && !r.semListaDeParceiros && (ecra === "parceiros" || (r.parceiros?.ids.length ?? 0) > 0);

  const emFaltaAgora = camposEmFaltaNoEcra(r, ecra, c);
  const erroDe = (campo: string) => (marcados.has(campo) ? (emFaltaAgora.find((x) => x.campo === campo)?.texto ?? null) : null);

  function descerAte(campo: string) {
    const lugar = lugares.current.get(campo);
    const vista = lugar?.vista.current;
    const alvo = conteudo.current;
    if (!vista || !alvo) return;
    vista.measureLayout(
      alvo,
      (_x, y) => {
        scroll.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
        lugar?.focar?.();
      },
      () => lugar?.focar?.(),
    );
  }

  function irPara(p: EcraDoPedir, mais: Partial<Rascunho> = {}) {
    setMarcados(new Set());
    setFalta(null);
    // Voltar a um ecrã de antes da lista volta a pedi-la a seguir (11-11-2026).
    const lista = ANTES_DOS_PARCEIROS.includes(p) ? { semListaDeParceiros: undefined } : {};
    mudar({ ...lista, ...mais, ecra: p, passo: passoDoEcra(p) });
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  // O pedido a meio (d5). «Continuar»: fica tudo como estava, no ecrã onde ficou.
  function continuarOPedido() {
    setAMeio(null);
    if (params.servico || params.morada) router.setParams({ servico: undefined, morada: undefined });
  }
  // «Começar do zero»: apaga o rascunho e as cópias das fotografias, e o formulário volta a abrir limpo.
  function comecarDoZero() {
    setAMeio(null);
    apagarRascunhoEFotografias(rascunho.current);
    if (params.servico || params.morada) router.setParams({ servico: undefined, morada: undefined });
    recomecar();
  }

  const seguinte = () => ecras[Math.min(ecras.length - 1, indice + 1)];

  function avancar() {
    if (!r) return;
    const lista = camposEmFaltaNoEcra(r, ecra, c);
    if (lista.length > 0) {
      setFalta(null);
      setMarcados(new Set(lista.map((x) => x.campo)));
      // Depois de pintar o vermelho: desce até ao primeiro e põe lá o foco. No resumo, leva ao ecrã do primeiro.
      if (ultimo) {
        const alvo = ecras.find((x) => x !== "resumo" && camposEmFaltaNoEcra(r, x, c).length > 0);
        if (alvo) return irPara(alvo);
      }
      setTimeout(() => descerAte(lista[0].campo), 60);
      return;
    }
    if (ecra === "fotos" && r.fotos.filter((x) => x.estado === "enviada").length === 0 && !r.semFotosAceite) return setSemFotos(true);
    if (ecra === "parceiros") return avancarDosParceiros();
    if (!ultimo) irPara(seguinte());
    else if (!ligado) setParaEntrar(true);
    else void enviar();
  }

  /** «Pedir orçamento» na lista: guarda a escolha e segue para o contacto. Sem lista, segue sem ela. */
  function avancarDosParceiros() {
    if (aLerAListaDosParceiros) return;
    const l = listaDosParceiros;
    if (!l || !l.ligado || l.parceiros.length === 0) return irPara("contacto", { semListaDeParceiros: true, parceiros: undefined });
    const escolha = escolhaFeita(idsDaLista, l, pessoasDaLista, procurarMaisParceiros);
    if (!escolha) return setFalta(ESCOLHA_UM_PARCEIRO);
    irPara("contacto", { parceiros: escolha });
  }

  async function enviar() {
    if (!r) return;
    setEnviando(true);
    setErroDoEnvio(null);
    try {
      const corpo = corpoDoPedido(r, c, { emailDaSessao: email, rascunhosAntes: await rascunhosComecados() });
      const resposta = await pedir<{ id?: unknown; passos?: unknown; parceirosEscolhidos?: unknown }>(ROTA_DO_ENVIO, { metodo: "POST", corpo });
      const id = Number(resposta.id);
      if (!Number.isInteger(id) || id <= 0) throw new ErroDaApi("Não foi possível registar o pedido.", 500);
      const aviso = avisoDasFotografias(r);
      apagarRascunho();
      recomecarContagem();
      setEntrouAgora(false);
      setOutraMorada(false);
      rascunho.current = rascunhoVazio();
      setR(rascunho.current);
      setPassosDoEnvio(typeof resposta.parceirosEscolhidos === "number" && resposta.parceirosEscolhidos > 0 ? passosDaResposta(resposta.passos) : null);
      setEnviado({ id, aviso });
      void recarregarALista();
      if (!(await jaPerguntouPelosAvisos())) setPerguntarAvisos(true);
    } catch (e) {
      // O telefone errado vem com o campo; o 401 da S14 diz para entrar; o resto, a frase da especificação.
      if (e instanceof ErroDaApi && e.corpo.campo === "telefone") {
        irPara("contacto");
        setFalta(e.message);
      }
      // Um parceiro escolhido deixou de estar disponível (ou a equipa): volta-se à lista, com a frase da rota.
      else if (e instanceof ErroDaApi && (e.corpo.campo === "parceirosEscolhidos" || e.corpo.campo === "pessoas")) {
        irPara("parceiros", { parceiros: undefined, semListaDeParceiros: undefined });
        setFalta(e.message);
      }
      else if (e instanceof ErroDaApi && e.estado === 401) setParaEntrar(true);
      else setErroDoEnvio("Não foi possível registar o pedido.");
    } finally {
      setEnviando(false);
    }
  }

  const comFotos = r.fotos.some((f) => f.estado === "enviada");

  const cartaoDasSugestoes = (aqui: "oque" | "acesso") => (
    <CartaoDasSugestoes
      lista={sugestoesDoEcra(sugestoes, r, c, aqui)}
      aoUsar={(s) => {
        animarAMudanca();
        if (rascunho.current) mudar(comResposta(rascunho.current, s.pergunta, s.valor));
        setSugestoes((l) => l.filter((x) => x.chave !== s.chave));
      }}
      aoRecusar={(s) => {
        animarAMudanca();
        if (rascunho.current) mudar(recusarSugestao(rascunho.current, s));
        setSugestoes((l) => l.filter((x) => x.chave !== s.chave));
      }}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }} edges={["top", "left", "right", "bottom"]}>
      <FornecedorDoCampoEmFalta value={{ erroDe, registar }}>
        <RolagemComTeclado ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <View ref={conteudo} collapsable={false} style={{ padding: 20, gap: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", minHeight: 28 }}>
              {indice > 0 ? (
                <Pressable onPress={() => irPara(ecras[indice - 1])} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={12} style={{ paddingRight: 12 }}>
                  <Ionicons name="chevron-back" size={24} color={CORES.marca} />
                </Pressable>
              ) : null}
              <Text style={{ flex: 1, color: CORES.suave, fontSize: 13 }} numberOfLines={1}>
                {servico && ecra !== "oque" ? servico.nome : "Pedir orçamento"}
              </Text>
            </View>
            <Progresso indice={indice} total={ecras.length} />
            <Titulo>{pergunta}</Titulo>
            {entrouAgora && email ? <Aviso tom="bom" texto={`Entrou como ${mascararEmail(email)}. Confira o pedido e toque em Enviar.`} /> : null}

            {ecra === "onde" && aLerAsMoradas ? <Carregando /> : null}
            {ecra === "onde" && !aLerAsMoradas && aEscolher && moradas ? (
              <Marcado campo="morada">
                <EscolherMorada
                  moradas={moradas}
                  escolhida={r.morada}
                  aoEscolher={(m) => mudar({ morada: m, distanciaKm: undefined })}
                  aoPedirOutra={() => {
                    setOutraMorada(true);
                    mudar({ morada: undefined, distanciaKm: undefined });
                  }}
                />
              </Marcado>
            ) : null}
            {ecra === "onde" && !aLerAsMoradas && !aEscolher ? (
              <View style={{ gap: 12 }}>
                <Marcado campo="morada">
                  <CampoDeMorada rotulo={mudanca ? "Morada de origem" : "Morada"} morada={r.morada} aoMudar={(m) => mudar({ morada: m, distanciaKm: undefined })} />
                </Marcado>
                {moradas && moradas.length > 0 ? (
                  <Ligacao
                    titulo={USAR_UMA_GUARDADA}
                    aoCarregar={() => {
                      setOutraMorada(false);
                      mudar({ morada: moradas[0], distanciaKm: undefined });
                    }}
                  />
                ) : null}
              </View>
            ) : null}
            {/* A faixa da referência em todos os ecrãs (d1); no «oque» fica a caixa e no resumo a conta. */}
            {servico && ecra !== "oque" && ecra !== "resumo" && !comParceiros ? <FaixaDaReferencia referencia={referencia} /> : null}
            {ecra === "oque" ? <EcraOQue r={r} c={c} mudar={mudar} referencia={referencia} sugestoes={cartaoDasSugestoes("oque")} /> : null}
            {ecra === "destino" ? (
              <Marcado campo="destino">
                <CampoDeMorada rotulo="Morada de destino" morada={r.destino} aoMudar={(m) => mudar({ destino: m, distanciaKm: undefined })} />
              </Marcado>
            ) : null}
            {ecra === "fotos" ? (
              <View style={{ gap: 14 }}>
                <Paragrafo pequeno suave>{e?.dicaDasFotos ?? "Com fotografias, o preço fica mais certo."}</Paragrafo>
                <Marcado campo="fotos">
                  <Fotografias r={r} maximo={c.ficheiros.maximo} mudar={mudarCom} />
                </Marcado>
                {comFotos ? <Caixa marcada={r.autorizaFotos} aoMudar={() => mudar({ autorizaFotos: !r.autorizaFotos })} texto={c.textos.autorizaFotos ?? AUTORIZA_FOTOS} /> : null}
              </View>
            ) : null}
            {ecra === "acesso" && perguntasDe(r, c) ? (
              <View style={{ gap: 20 }}>
                {cartaoDasSugestoes("acesso")}
                <PerguntasDaCategoria r={r} perguntas={perguntasDe(r, c) ?? []} ecra="acesso" mudar={mudar} espaco={e} />
              </View>
            ) : null}
            {ecra === "acesso" && !perguntasDe(r, c) ? (
              <View style={{ gap: 20 }}>
                <Marcado campo="acesso">
                  <Acessos titulo={mudanca ? "Na origem" : undefined} acesso={r.acesso} aoMudar={(a) => mudar({ acesso: a })} comDificil={mudanca} comAndar={!semAndar(e)} />
                </Marcado>
                {mudanca ? (
                  <Marcado campo="acessoDestino">
                    <Acessos titulo="No destino" acesso={r.acessoDestino} aoMudar={(a) => mudar({ acessoDestino: a })} comDificil />
                  </Marcado>
                ) : null}
              </View>
            ) : null}
            {ecra === "quando" ? <EcraQuando r={r} c={c} mudar={mudar} /> : null}
            {ecra === "parceiros" ? (
              <ParceirosDaMudanca
                lista={listaDosParceiros}
                aCarregar={aLerAListaDosParceiros}
                pessoas={pessoasDaLista}
                aoMudarPessoas={setPessoasDaLista}
                ids={idsDaLista}
                aoTocar={(id) => {
                  setFalta(null);
                  setIdsDaLista((antes) => alternarParceiro(antes, id, listaDosParceiros?.ligado ? listaDosParceiros.maximo : 0));
                }}
                procurarMais={procurarMaisParceiros}
                aoMudarProcurarMais={setProcurarMaisParceiros}
              />
            ) : null}
            {ecra === "contacto" ? <EcraContacto r={r} mudar={mudar} /> : null}
            {ecra === "resumo" ? <EcraResumo r={r} c={c} mudar={mudar} referencia={comParceiros ? null : referencia} irPara={irPara} /> : null}

            {falta ? <Aviso texto={falta} tom="mau" /> : null}
            {erroDoEnvio ? (
              <View style={{ gap: 10 }}>
                <Aviso texto={erroDoEnvio} tom="mau" />
                <Botao titulo="Tentar outra vez" tipo="secundario" aoCarregar={() => void enviar()} />
                <Botao titulo="Enviar por WhatsApp" tipo="secundario" aoCarregar={() => whatsappDaClyon("Olá! Quero pedir um orçamento.")} />
              </View>
            ) : null}
            {ultimo ? <Ligacao titulo="É uma empresa? Peça aqui" centrada aoCarregar={() => router.push("/empresa")} /> : null}
          </View>
        </RolagemComTeclado>
        {/* O botão fica sempre à vista, por baixo (nunca tapado pela barra nem pelo teclado). */}
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderTopColor: CORES.linha, backgroundColor: CORES.fundo }}>
          <Botao titulo={tituloDoBotao} ocupado={enviando} desligado={(ecra === "onde" && aLerAsMoradas) || (ecra === "parceiros" && aLerAListaDosParceiros)} aoCarregar={avancar} />
        </View>
      </FornecedorDoCampoEmFalta>
      <Confirmacao
        visivel={semFotos}
        titulo="Fotografias"
        texto={c.textos.semFotos ?? SEM_FOTOS}
        confirmar="Continuar"
        voltar="Juntar fotografias"
        aoConfirmar={() => {
          setSemFotos(false);
          mudar({ semFotosAceite: true });
          irPara(seguinte());
        }}
        aoVoltar={() => setSemFotos(false)}
      />
      {/* O pedido a meio (d5): o «voltar» do Android continua o pedido, nunca o apaga. */}
      <Confirmacao
        visivel={!!aMeio && emFoco}
        titulo={TITULO_DO_PEDIDO_A_MEIO}
        texto={aMeio?.linha}
        confirmar={CONTINUAR_O_PEDIDO}
        voltar={COMECAR_DO_ZERO}
        aoConfirmar={continuarOPedido}
        aoVoltar={comecarDoZero}
        aoFechar={continuarOPedido}
      />
      {/* E3.F — para enviar, entre. O rascunho fica guardado; depois de entrar, volta ao resumo. */}
      <Folha visivel={paraEntrar && !ligado && emFoco} aoFechar={() => setParaEntrar(false)}>
        <Text titulo accessibilityRole="header" style={{ color: CORES.tinta, fontSize: 21, fontWeight: "700" }}>
          {ENTRE_PARA_ENVIAR}
        </Text>
        <Paragrafo suave>O que preencheu fica guardado neste telemóvel.</Paragrafo>
        <Entrada
          depois={{ para: "resumo" }}
          erroInicial={erroDoGoogle}
          antesDoGoogle={() => {
            setErroDoGoogle(null);
            setParaEntrar(false);
          }}
          seOGoogleFalhar={(m) => {
            setErroDoGoogle(m);
            setParaEntrar(true);
          }}
          aoEntrar={() => {
            setParaEntrar(false);
            setEntrouAgora(true);
            entrouNaSessao.current = sessao;
            esquecerDepoisDeEntrar();
          }}
        />
      </Folha>
    </SafeAreaView>
  );
}
