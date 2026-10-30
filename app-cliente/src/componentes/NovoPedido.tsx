import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Entrada } from "./Entrada";
import { CampoDeMorada } from "./Morada";
import { FornecedorDoCampoEmFalta, Marcado, type LugarDoCampo } from "./CampoEmFalta";
import { lerMoradaGuardada } from "../lib/morada-do-cliente";
import { Text } from "./Texto";
import { Aviso, Botao, Campo, Carregando, Confirmacao, Escolhas, Folha, Ligacao, LinhaDoResumo, Paragrafo, PrecoDeReferencia, Subtitulo, Titulo } from "./ui";
import { useCatalogo } from "../estado/Catalogo";
import { usePedidos } from "../estado/Pedidos";
import { useSessao } from "../estado/Sessao";
import { whatsappDaClyon } from "../lib/abrir";
import { ErroDaApi, mensagemDe, pedir } from "../lib/api";
import { jaPerguntouPelosAvisos, ligarAvisos, marcarQueJaPerguntou } from "../lib/avisos";
import { mascararEmail } from "../lib/entrada";
import { enviarFotografia, escolherFotografias, escolherVideo, reduzirFotografia, reduzirFotografiaDoEndereco, type FotografiaReduzida } from "../lib/fotografias";
import { apagarRascunho, contarRascunhoNovo, esquecerDepoisDeEntrar, guardarRascunho, lerRascunho, rascunhosComecados, recomecarContagem } from "../lib/guardado";
import {
  ANDARES,
  avisoDasFotografias,
  corpoDaReferencia,
  corpoDoPedido,
  detalhesDe,
  diasParaEscolher,
  ELEVADOR,
  ESTACIONAMENTO,
  camposEmFalta,
  linhasDoResumo,
  PASSOS,
  rascunhoVazio,
  referenciaDoCatalogo,
  referenciaValida,
  REPETICAO,
  ROTA_DA_REFERENCIA,
  ROTA_DO_ENVIO,
  ROTA_DO_PERCURSO,
  servicoDe,
  TAMANHOS_DOS_ITENS,
  TEXTO_DO_QUANDO,
  tituloDoPasso,
  VOLUMES,
  type Acesso,
  type Catalogo,
  type Rascunho,
  type Referencia,
} from "../lib/novo-pedido";
import { aparenciaDoServico, CORES } from "../tema";

/**
 * E3 v3 — PEDIR ORÇAMENTO (o simulador do site, em 3 passos) e E4 — PEDIDO
 * ENVIADO. As regras e o que vai para o site estão em `novo-pedido.ts`.
 *
 * O rascunho guarda-se no telemóvel a cada campo, também sem conta, e apaga-se
 * depois de enviado (e ao sair ou trocar de conta). A conta só se pede no fim:
 * «Enviar pedido» sem sessão abre a folha E3.F (Google ou link por email), e
 * depois de entrar o resumo volta com «Entrou como … Confira o pedido e toque
 * em Enviar.» — a app não envia sozinha.
 */

const SEM_FOTOS = "Sem fotografias, o preço pode mudar no local. Quer continuar sem elas?";
/** O texto do simulador do site, enquanto a R7 não o manda (`textos.autorizaFotos`). */
const AUTORIZA_FOTOS = "Podem mostrar as minhas fotos no site e nas redes da CLYON (opcional), sem nada que me identifique — nem pessoas, nem morada.";
/** O mesmo do site para a folha E3.F (G3). */
const ENTRE_PARA_ENVIAR = "Para enviar o pedido, entre na CLYON";

function Progresso({ passo, d }: { passo: Rascunho["passo"]; d: ReturnType<typeof detalhesDe> }) {
  const seguinte = passo < PASSOS ? `A seguir: ${tituloDoPasso((passo + 1) as Rascunho["passo"], d).toLowerCase()}` : "Falta só enviar";
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text titulo style={{ color: CORES.marca, fontSize: 13, fontWeight: "700" }}>{`Passo ${passo} de ${PASSOS}`}</Text>
        <Text style={{ color: CORES.suave, fontSize: 13 }}>{seguinte}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {Array.from({ length: PASSOS }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < passo ? CORES.marca : CORES.linha }} />
        ))}
      </View>
    </View>
  );
}

function CaixaDaReferencia({ referencia, grande = false }: { referencia: Referencia | null; grande?: boolean }) {
  if (!referencia) return null;
  return (
    <View style={{ borderRadius: 18, backgroundColor: CORES.marcaSuave, padding: 14, gap: 6 }}>
      {grande ? (
        <Text titulo style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>
          O seu preço de referência
        </Text>
      ) : null}
      {referencia.linhas.map((l, i) => (
        <View key={i} style={{ gap: 2 }}>
          {l.rotulo ? <Text style={{ color: CORES.suave, fontSize: 12.5 }}>{l.rotulo}</Text> : null}
          <PrecoDeReferencia texto={l.texto} tamanho={grande ? 17 : 15} />
        </View>
      ))}
      {referencia.nota ? <Text style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 18 }}>{referencia.nota}</Text> : null}
    </View>
  );
}

function Acessos({ titulo, acesso, aoMudar, comDificil }: { titulo?: string; acesso: Acesso; aoMudar: (a: Acesso) => void; comDificil: boolean }) {
  return (
    <View style={{ gap: 14 }}>
      {titulo ? <Subtitulo>{titulo}</Subtitulo> : null}
      <Escolhas rotulo="Em que andar está?" opcoes={ANDARES} valor={acesso.floor} aoEscolher={(v) => aoMudar({ ...acesso, floor: v, hasElevator: v === "rés-do-chão" ? undefined : acesso.hasElevator })} />
      {acesso.floor && acesso.floor !== "rés-do-chão" ? (
        <Escolhas rotulo="Há elevador?" opcoes={ELEVADOR} valor={acesso.hasElevator} aoEscolher={(v) => aoMudar({ ...acesso, hasElevator: v })} />
      ) : null}
      <Escolhas rotulo="Estacionamento" opcoes={ESTACIONAMENTO} valor={acesso.parkingDistance} aoEscolher={(v) => aoMudar({ ...acesso, parkingDistance: v })} />
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

function PassoServico({
  r,
  c,
  mudar,
  mudarCom,
  referencia,
}: {
  r: Rascunho;
  c: Catalogo;
  mudar: (p: Partial<Rascunho>) => void;
  mudarCom: (f: (antes: Rascunho) => Partial<Rascunho>) => void;
  referencia: Referencia | null;
}) {
  const d = detalhesDe(r, c);
  return (
    <View style={{ gap: 18 }}>
      <Titulo>{tituloDoPasso(1, d)}</Titulo>
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
              onPress={() =>
                mudar({ servico: s.id, movelModo: undefined, volume: undefined, quantidadeExacta: "", entulho: undefined, entulhoModo: undefined, tipologia: undefined })
              }
              style={({ pressed }) => ({
                flexBasis: 150,
                flexGrow: 1,
                minHeight: 64,
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

      {d ? <CaixaDaReferencia referencia={referencia} /> : null}

      {d === "moveis" ? (
        <Escolhas
          rotulo="Como prefere indicar?"
          campo="movelModo"
          opcoes={[
            { id: "item", nome: "Por item", ajuda: "Sei o que tenho" },
            { id: "carga", nome: "Por volume", ajuda: "Não sei bem quanto é" },
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
      {d === "monos" || d === "esvaziamento" || (d === "moveis" && r.movelModo === "carga") ? (
        <>
          <Escolhas campo="volume" rotulo="Quanto há para levar?" opcoes={VOLUMES} valor={r.volume} aoEscolher={(v) => mudar({ volume: v })} />
          <Campo
            rotulo="Sabe o número exacto de peças? (opcional)"
            valor={r.quantidadeExacta}
            aoMudar={(v) => mudar({ quantidadeExacta: soAlgarismos(v) })}
            keyboardType="number-pad"
          />
        </>
      ) : null}
      {d === "entulho" ? (
        <View style={{ gap: 14 }}>
          <Escolhas campo="entulho" rotulo="Como está o entulho?" opcoes={c.entulho} valor={r.entulho} aoEscolher={(v) => mudar({ entulho: v })} />
          <Escolhas
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
            <Escolhas campo="entulhoVolume" rotulo="Quanto enche?" opcoes={VOLUMES.filter((v) => v.id !== "incerto")} valor={r.entulhoVolume} aoEscolher={(v) => mudar({ entulhoVolume: v })} />
          ) : null}
          {c.textos.entulhoNota ? <Paragrafo pequeno suave>{c.textos.entulhoNota}</Paragrafo> : null}
        </View>
      ) : null}
      {d === "mudanca" ? <Escolhas campo="tipologia" rotulo="O tamanho da casa" opcoes={c.tipologias} valor={r.tipologia} aoEscolher={(v) => mudar({ tipologia: v })} /> : null}

      {d ? (
        <>
          <Campo
            rotulo="Descreva o que precisa"
            campo="descricao"
            valor={r.descricao}
            aoMudar={(v) => mudar({ descricao: v })}
            multiline
            maxLength={2000}
            ajuda={`${r.descricao.trim().length} caracteres`}
            style={{ minHeight: 110, textAlignVertical: "top" }}
          />
          <Marcado campo="fotos">
            <Fotografias r={r} maximo={c.ficheiros.maximo} mudar={mudarCom} />
          </Marcado>
        </>
      ) : null}
    </View>
  );
}

function Fotografias({ r, maximo, mudar }: { r: Rascunho; maximo: number; mudar: (f: (antes: Rascunho) => Partial<Rascunho>) => void }) {
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
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text titulo style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>
          Fotografias e vídeos
        </Text>
        <Text style={{ color: CORES.suave, fontSize: 12.5 }}>{`${r.fotos.length} de ${maximo}`}</Text>
      </View>
      <View style={{ borderWidth: 1.5, borderStyle: "dashed", borderColor: CORES.linhaForte, borderRadius: 18, padding: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Botao titulo="Tirar fotografia" tipo="secundario" desligado={restam <= 0} aoCarregar={() => void juntar("camara")} />
          </View>
          <View style={{ flex: 1 }}>
            <Botao titulo="Da galeria" tipo="secundario" desligado={restam <= 0} aoCarregar={() => void juntar("galeria")} />
          </View>
        </View>
        <Ligacao titulo="Juntar um vídeo" centrada aoCarregar={() => void juntarVideo()} />
        <Paragrafo pequeno suave>
          Com fotografias, os parceiros propõem um preço mais certo. Também ajudam as do caminho: escadas, portas, corredores.
        </Paragrafo>
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

function PassoMorada({ r, c, mudar, referencia }: { r: Rascunho; c: Catalogo; mudar: (p: Partial<Rascunho>) => void; referencia: Referencia | null }) {
  const d = detalhesDe(r, c);
  const mudanca = d === "mudanca";
  return (
    <View style={{ gap: 18 }}>
      <Titulo>{tituloDoPasso(2, d)}</Titulo>
      <Marcado campo="morada">
        <CampoDeMorada rotulo={mudanca ? "Morada de origem" : "Morada"} morada={r.morada} aoMudar={(m) => mudar({ morada: m, distanciaKm: undefined })} />
      </Marcado>
      <Marcado campo="acesso">
        <Acessos titulo={mudanca ? "Acesso na origem" : undefined} acesso={r.acesso} aoMudar={(a) => mudar({ acesso: a })} comDificil={mudanca} />
      </Marcado>
      {mudanca ? (
        <>
          <Marcado campo="destino">
            <CampoDeMorada rotulo="Morada de destino" morada={r.destino} aoMudar={(m) => mudar({ destino: m, distanciaKm: undefined })} />
          </Marcado>
          <Marcado campo="acessoDestino">
            <Acessos titulo="Acesso no destino" acesso={r.acessoDestino} aoMudar={(a) => mudar({ acessoDestino: a })} comDificil />
          </Marcado>
          {r.distanciaKm ? <Paragrafo suave>{`Percurso: ${String(r.distanciaKm).replace(".", ",")} km`}</Paragrafo> : null}
        </>
      ) : null}
      <View style={{ gap: 8 }}>
        <Escolhas
          rotulo="É preciso desmontar móveis?"
          opcoes={[
            { id: "sim", nome: "Sim" },
            { id: "nao", nome: "Não" },
          ]}
          valor={r.desmontagem === undefined ? undefined : r.desmontagem ? "sim" : "nao"}
          aoEscolher={(v) => mudar({ desmontagem: v === "sim" })}
        />
        {c.textos.desmontagem ? <Paragrafo pequeno suave>{c.textos.desmontagem}</Paragrafo> : null}
      </View>
      {mudanca ? <CaixaDaReferencia referencia={referencia} /> : null}
    </View>
  );
}

function PassoContacto({
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
  irPara: (p: Rascunho["passo"]) => void;
}) {
  const dias = diasParaEscolher(new Date());
  const d = detalhesDe(r, c);
  const comFotos = r.fotos.some((f) => f.estado === "enviada");
  return (
    <View style={{ gap: 18 }}>
      <Titulo>{tituloDoPasso(3, d)}</Titulo>
      <Escolhas
        rotulo="Quando precisa?"
        campo="quando"
        opcoes={c.quando.map((q) => ({ id: q, nome: TEXTO_DO_QUANDO[q] }))}
        valor={r.quando}
        aoEscolher={(v) => mudar({ quando: v, data: v === "data" ? r.data : undefined })}
      />
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
                onPress={() => mudar({ data: x.dia })}
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
      {d === "manutencao" ? (
        <Escolhas rotulo="Repetir o serviço?" opcoes={REPETICAO} valor={r.repeticao ?? "pontual"} aoEscolher={(v) => mudar({ repeticao: v })} />
      ) : null}
      {c.textos.valorDesejadoEtiqueta ? (
        <Campo
          rotulo={`${c.textos.valorDesejadoEtiqueta} (opcional)`}
          ajuda={c.textos.valorDesejadoAjuda}
          valor={r.valorDesejado}
          aoMudar={(v) => mudar({ valorDesejado: v.replace(/[^\d,.]/g, "") })}
          keyboardType="decimal-pad"
        />
      ) : null}
      <Escolhas
        rotulo="Quer o seu NIF na fatura?"
        opcoes={[
          { id: "nao", nome: "Não" },
          { id: "sim", nome: "Sim" },
        ]}
        valor={r.querNif ? "sim" : "nao"}
        aoEscolher={(v) => mudar({ querNif: v === "sim" })}
      />
      {r.querNif ? <Campo campo="nif" rotulo="NIF" valor={r.nif} aoMudar={(v) => mudar({ nif: v.replace(/[^\d]/g, "").slice(0, 9) })} keyboardType="number-pad" /> : null}
      <Campo campo="nome" rotulo="Nome" valor={r.nome} aoMudar={(v) => mudar({ nome: v })} autoComplete="name" />
      <Campo campo="telefone" rotulo="Telemóvel" valor={r.telefone} aoMudar={(v) => mudar({ telefone: v })} keyboardType="phone-pad" autoComplete="tel" />
      {comFotos ? (
        <Pressable
          onPress={() => mudar({ autorizaFotos: !r.autorizaFotos })}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: r.autorizaFotos }}
          style={{ flexDirection: "row", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: CORES.linha, backgroundColor: CORES.superficie }}
        >
          <Ionicons name={r.autorizaFotos ? "checkbox" : "square-outline"} size={22} color={CORES.marca} />
          <Text style={{ flex: 1, color: CORES.tinta, fontSize: 13.5, lineHeight: 19 }}>{c.textos.autorizaFotos ?? AUTORIZA_FOTOS}</Text>
        </Pressable>
      ) : null}

      <CaixaDaReferencia referencia={referencia} grande />
      {c.textos.promessaDoPrazo ? <Paragrafo pequeno suave>{c.textos.promessaDoPrazo}</Paragrafo> : null}

      <View>
        <Subtitulo>Resumo</Subtitulo>
        <View style={{ marginTop: 8 }}>
          {linhasDoResumo(r, c).map((l, i) => (
            <LinhaDoResumo key={i} rotulo={l.rotulo} valor={l.texto} aoAlterar={l.passo < 3 ? () => irPara(l.passo) : undefined} />
          ))}
        </View>
      </View>
    </View>
  );
}

export function NovoPedido() {
  const { catalogo, erro: erroDoCatalogo, aLer, recarregar } = useCatalogo();
  const { email, ligado } = useSessao();
  const { recarregar: recarregarALista } = usePedidos();
  const params = useLocalSearchParams<{ servico?: string; morada?: string; entrou?: string }>();
  const [r, setR] = useState<Rascunho | null>(null);
  const [falta, setFalta] = useState<string | null>(null);
  const [semFotos, setSemFotos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroDoEnvio, setErroDoEnvio] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<{ id: number; aviso: string | null } | null>(null);
  const [perguntarAvisos, setPerguntarAvisos] = useState(false);
  const [paraEntrar, setParaEntrar] = useState(false);
  const [entrouAgora, setEntrouAgora] = useState(false);
  const [erroDoGoogle, setErroDoGoogle] = useState<string | null>(null);
  // As folhas (Modal) ficam por cima de tudo: com outro ecrã à frente (o link do email abre a confirmação), escondem-se.
  const emFoco = useIsFocused();
  const [referencia, setReferencia] = useState<Referencia | null>(null);
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

  useEffect(() => {
    void (async () => {
      const guardado = await lerRascunho();
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
  useEffect(() => {
    if (params.entrou === "1" && ligado) {
      setEntrouAgora(true);
      esquecerDepoisDeEntrar();
    }
  }, [params.entrou, ligado]);

  const mudarCom = useCallback((f: (antes: Rascunho) => Partial<Rascunho>) => {
    const antes = rascunho.current ?? rascunhoVazio();
    const novo = { ...antes, ...f(antes) };
    if (!antes.servico && novo.servico) void contarRascunhoNovo();
    rascunho.current = novo;
    setR(novo);
    setFalta(null);
    guardarRascunho(novo);
  }, []);
  const mudar = useCallback((p: Partial<Rascunho>) => mudarCom(() => p), [mudarCom]);

  // Vindo dos Serviços (o id) ou de «Pedir outra vez» (o nome e a morada do pedido anterior).
  useEffect(() => {
    if (!r || !catalogo || (!params.servico && !params.morada)) return;
    const s = catalogo.servicos.find((x) => x.id === params.servico || x.nome === params.servico);
    if (s && s.id !== r.servico) {
      mudar({ servico: s.id, passo: 1, movelModo: undefined, volume: undefined, entulho: undefined, entulhoModo: undefined, tipologia: undefined });
    }
    if (params.morada && !r.morada) mudar({ morada: { formattedAddress: params.morada, aMao: true } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogo, params.servico, params.morada, r === null]);

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

  // A referência (R12) para o que escolheu; sem a R12, a linha do serviço na R7 v2.
  const chaveDaReferencia = r && catalogo ? JSON.stringify(corpoDaReferencia(r, catalogo)) : "";
  useEffect(() => {
    if (!r || !catalogo || !r.servico) return setReferencia(null);
    const doCatalogo = referenciaDoCatalogo(r, catalogo);
    const corpo = corpoDaReferencia(r, catalogo);
    let vivo = true;
    const t = setTimeout(() => {
      pedir<unknown>(ROTA_DA_REFERENCIA, { metodo: "POST", corpo, semSessao: true })
        .then((v) => {
          if (vivo) setReferencia(referenciaValida(v) ?? doCatalogo);
        })
        .catch(() => {
          if (vivo) setReferencia(doCatalogo);
        });
    }, 400);
    setReferencia((antes) => antes ?? doCatalogo);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDaReferencia, catalogo]);

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

  if (enviado) {
    const passos = catalogo?.textos.tresPassos ?? [];
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
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
          {passos.length === 0 ? <Paragrafo>A CLYON confere o pedido e envia-o aos parceiros verificados da sua zona.</Paragrafo> : null}
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
        </ScrollView>
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
  const passo = r.passo;
  const d = detalhesDe(r, c);
  const servico = servicoDe(r, c);

  const emFaltaAgora = camposEmFalta(r, passo, c);
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

  function irPara(p: Rascunho["passo"]) {
    setMarcados(new Set());
    setFalta(null);
    mudar({ passo: p });
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  function avancar() {
    if (!r) return;
    const lista = camposEmFalta(r, passo, c);
    if (lista.length > 0) {
      setFalta(null);
      setMarcados(new Set(lista.map((x) => x.campo)));
      // Depois de pintar o vermelho: desce até ao primeiro e põe lá o foco.
      setTimeout(() => descerAte(lista[0].campo), 60);
      return;
    }
    if (passo === 1 && r.fotos.filter((x) => x.estado === "enviada").length === 0 && !r.semFotosAceite) return setSemFotos(true);
    if (passo < PASSOS) irPara((passo + 1) as Rascunho["passo"]);
    else if (!ligado) setParaEntrar(true);
    else void enviar();
  }

  async function enviar() {
    if (!r) return;
    setEnviando(true);
    setErroDoEnvio(null);
    try {
      const corpo = corpoDoPedido(r, c, { emailDaSessao: email, rascunhosAntes: await rascunhosComecados() });
      const resposta = await pedir<{ id?: unknown }>(ROTA_DO_ENVIO, { metodo: "POST", corpo });
      const id = Number(resposta.id);
      if (!Number.isInteger(id) || id <= 0) throw new ErroDaApi("Não foi possível registar o pedido.", 500);
      const aviso = avisoDasFotografias(r);
      apagarRascunho();
      recomecarContagem();
      setEntrouAgora(false);
      rascunho.current = rascunhoVazio();
      setR(rascunho.current);
      setEnviado({ id, aviso });
      void recarregarALista();
      if (!(await jaPerguntouPelosAvisos())) setPerguntarAvisos(true);
    } catch (e) {
      // O telefone errado vem com o campo; o 401 da S14 diz para entrar; o resto, a frase da especificação.
      if (e instanceof ErroDaApi && e.corpo.campo === "telefone") {
        setFalta(e.message);
        setTimeout(() => descerAte("telefone"), 60);
      }
      else if (e instanceof ErroDaApi && e.estado === 401) setParaEntrar(true);
      else setErroDoEnvio("Não foi possível registar o pedido.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FornecedorDoCampoEmFalta value={{ erroDe, registar }}>
        <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <View ref={conteudo} collapsable={false} style={{ padding: 20, gap: 20 }}>
          <Text titulo style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600", textAlign: "center" }}>
            {servico?.nome ?? "Pedir orçamento"}
          </Text>
          <Progresso passo={passo} d={d} />
          {entrouAgora && email ? <Aviso tom="bom" texto={`Entrou como ${mascararEmail(email)}. Confira o pedido e toque em Enviar.`} /> : null}
          {passo === 1 ? <PassoServico r={r} c={c} mudar={mudar} mudarCom={mudarCom} referencia={referencia} /> : null}
          {passo === 2 ? <PassoMorada r={r} c={c} mudar={mudar} referencia={referencia} /> : null}
          {passo === 3 ? <PassoContacto r={r} c={c} mudar={mudar} referencia={referencia} irPara={irPara} /> : null}
          {falta ? <Aviso texto={falta} tom="mau" /> : null}
          {erroDoEnvio ? (
            <View style={{ gap: 10 }}>
              <Aviso texto={erroDoEnvio} tom="mau" />
              <Botao titulo="Tentar outra vez" tipo="secundario" aoCarregar={() => void enviar()} />
              <Botao titulo="Enviar por WhatsApp" tipo="secundario" aoCarregar={() => whatsappDaClyon("Olá! Quero pedir um orçamento.")} />
            </View>
          ) : null}
          <Botao titulo={passo === PASSOS ? "Enviar pedido" : "Continuar"} ocupado={enviando} aoCarregar={avancar} />
          {passo > 1 ? <Ligacao titulo="Voltar ao passo anterior" centrada aoCarregar={() => irPara((passo - 1) as Rascunho["passo"])} /> : null}
          <Text style={{ color: CORES.suave, fontSize: 12.5, textAlign: "center" }}>O que escreveu fica guardado neste telemóvel.</Text>
          {passo === PASSOS ? <Ligacao titulo="É uma empresa? Peça aqui" centrada aoCarregar={() => router.push("/empresa")} /> : null}
          </View>
        </ScrollView>
        </FornecedorDoCampoEmFalta>
      </KeyboardAvoidingView>
      <Confirmacao
        visivel={semFotos}
        titulo="Fotografias"
        texto={c.textos.semFotos ?? SEM_FOTOS}
        confirmar="Continuar"
        voltar="Juntar fotografias"
        aoConfirmar={() => {
          setSemFotos(false);
          mudar({ semFotosAceite: true });
          irPara(2);
        }}
        aoVoltar={() => setSemFotos(false)}
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
            esquecerDepoisDeEntrar();
          }}
        />
      </Folha>
    </SafeAreaView>
  );
}
