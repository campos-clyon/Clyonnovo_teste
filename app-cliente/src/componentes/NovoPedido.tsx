import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CampoDeMorada } from "./Morada";
import { Text } from "./Texto";
import { Aviso, Botao, Campo, Carregando, Confirmacao, Escolhas, Ligacao, Paragrafo, Subtitulo, Titulo } from "./ui";
import { useCatalogo } from "../estado/Catalogo";
import { usePedidos } from "../estado/Pedidos";
import { useSessao } from "../estado/Sessao";
import { whatsappDaClyon } from "../lib/abrir";
import { ErroDaApi, mensagemDe, pedir } from "../lib/api";
import { jaPerguntouPelosAvisos, ligarAvisos, marcarQueJaPerguntou } from "../lib/avisos";
import { enviarFotografia, escolherFotografias, reduzirFotografia, reduzirFotografiaDoEndereco, type FotografiaReduzida } from "../lib/fotografias";
import { apagarRascunho, contarRascunhoNovo, guardarRascunho, lerRascunho, rascunhosComecados, recomecarContagem } from "../lib/guardado";
import {
  ANDARES,
  avisoDasFotografias,
  corpoDoPedido,
  detalhesDe,
  diasParaEscolher,
  ELEVADOR,
  ESTACIONAMENTO,
  faltaNoPasso,
  rascunhoVazio,
  ROTA_DO_ENVIO,
  TAMANHOS_DOS_ITENS,
  TEXTO_DO_QUANDO,
  VOLUMES,
  type Acesso,
  type Catalogo,
  type Rascunho,
} from "../lib/novo-pedido";
import { CORES } from "../tema";

/**
 * E3 — NOVO PEDIDO (4 passos) e E4 — PEDIDO ENVIADO.
 *
 * O mesmo pedido do simulador, tão curto como ele: o que precisa, onde é, as
 * fotografias e quando. O rascunho guarda-se no telemóvel a cada campo e
 * apaga-se depois de enviado (e ao sair ou trocar de conta). Sem sessão, o
 * pedido segue com o email escrito, como no simulador (dono, 25-10-2026).
 * Tudo o que é opção vem do catálogo (R7); sem ele, a app não pede.
 */

const SEM_FOTOS = "Sem fotografias, o preço pode mudar no local. Quer continuar sem elas?";

function Acessos({ titulo, acesso, aoMudar }: { titulo?: string; acesso: Acesso; aoMudar: (a: Acesso) => void }) {
  return (
    <View style={{ gap: 12 }}>
      {titulo ? <Subtitulo>{titulo}</Subtitulo> : null}
      <Escolhas rotulo="Andar" opcoes={ANDARES} valor={acesso.floor} aoEscolher={(v) => aoMudar({ ...acesso, floor: v, hasElevator: v === "rés-do-chão" ? undefined : acesso.hasElevator })} />
      {acesso.floor && acesso.floor !== "rés-do-chão" ? (
        <Escolhas rotulo="Elevador" opcoes={ELEVADOR} valor={acesso.hasElevator} aoEscolher={(v) => aoMudar({ ...acesso, hasElevator: v })} />
      ) : null}
      <Escolhas rotulo="Estacionamento" opcoes={ESTACIONAMENTO} valor={acesso.parkingDistance} aoEscolher={(v) => aoMudar({ ...acesso, parkingDistance: v })} />
    </View>
  );
}

function Contador({ nome, exemplos, valor, aoMudar }: { nome: string; exemplos: string; valor: number; aoMudar: (n: number) => void }) {
  const botao = (sinal: "−" | "+", n: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${sinal === "+" ? "Mais" : "Menos"} ${nome.toLowerCase()}`}
      onPress={() => aoMudar(Math.max(0, Math.min(99, n)))}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: CORES.linha, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={{ color: CORES.marca, fontSize: 22, fontWeight: "700" }}>{sinal}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>{nome}</Text>
        <Text style={{ color: CORES.suave, fontSize: 12 }} numberOfLines={1}>
          {exemplos}
        </Text>
      </View>
      {botao("−", valor - 1)}
      <Text style={{ width: 28, textAlign: "center", color: CORES.tinta, fontSize: 17, fontWeight: "700" }}>{valor}</Text>
      {botao("+", valor + 1)}
    </View>
  );
}

function PassoServico({ r, c, mudar }: { r: Rascunho; c: Catalogo; mudar: (p: Partial<Rascunho>) => void }) {
  const d = detalhesDe(r, c);
  return (
    <View style={{ gap: 16 }}>
      <Titulo>O que precisa?</Titulo>
      <Escolhas
        opcoes={c.servicos.map((s) => ({ id: s.id, nome: s.nome }))}
        valor={r.servico}
        aoEscolher={(v) => mudar({ servico: v, movelModo: undefined, volume: undefined, entulho: undefined, tipologia: undefined })}
      />
      {d === "moveis" ? (
        <Escolhas
          rotulo="Como prefere indicar os itens?"
          opcoes={[
            { id: "carga", nome: "Por volume", ajuda: "Não tenho a certeza da quantidade" },
            { id: "item", nome: "Por item", ajuda: "Sei exatamente o que tenho" },
          ]}
          valor={r.movelModo}
          aoEscolher={(v) => mudar({ movelModo: v, volume: undefined, itens: { pequeno: 0, medio: 0, grande: 0 } })}
        />
      ) : null}
      {d === "moveis" && r.movelModo === "item"
        ? TAMANHOS_DOS_ITENS.map((t) => (
            <Contador
              key={t.id}
              nome={t.nome}
              exemplos={t.exemplos}
              valor={r.itens?.[t.id] ?? 0}
              aoMudar={(n) => mudar({ itens: { pequeno: 0, medio: 0, grande: 0, ...r.itens, [t.id]: n } })}
            />
          ))
        : null}
      {d === "monos" || d === "esvaziamento" || (d === "moveis" && r.movelModo === "carga") ? (
        <Escolhas rotulo="Quanto há para levar?" opcoes={VOLUMES} valor={r.volume} aoEscolher={(v) => mudar({ volume: v })} />
      ) : null}
      {d === "entulho" ? (
        <View style={{ gap: 8 }}>
          <Escolhas rotulo="Como está o entulho?" opcoes={c.entulho} valor={r.entulho} aoEscolher={(v) => mudar({ entulho: v })} />
          <Paragrafo pequeno suave>
            Se estiver no chão, o profissional carrega-o no local.
          </Paragrafo>
        </View>
      ) : null}
      {d === "mudanca" ? (
        <Escolhas rotulo="Tamanho da casa" opcoes={c.tipologias} valor={r.tipologia} aoEscolher={(v) => mudar({ tipologia: v })} />
      ) : null}
      <Campo
        rotulo="Descreva o que há para levar"
        valor={r.descricao}
        aoMudar={(v) => mudar({ descricao: v })}
        multiline
        maxLength={2000}
        style={{ minHeight: 110, textAlignVertical: "top", borderWidth: 1, borderColor: CORES.linha, borderRadius: 12, padding: 12, fontSize: 16, color: CORES.tinta, backgroundColor: CORES.superficie }}
      />
    </View>
  );
}

function PassoMorada({ r, c, mudar }: { r: Rascunho; c: Catalogo; mudar: (p: Partial<Rascunho>) => void }) {
  const mudanca = detalhesDe(r, c) === "mudanca";
  return (
    <View style={{ gap: 16 }}>
      <Titulo>Onde é?</Titulo>
      <CampoDeMorada rotulo={mudanca ? "Morada de origem" : "Morada"} morada={r.morada} aoMudar={(m) => mudar({ morada: m, distanciaKm: undefined })} />
      <Acessos acesso={r.acesso} aoMudar={(a) => mudar({ acesso: a })} />
      {mudanca ? (
        <>
          <CampoDeMorada rotulo="Morada de destino" morada={r.destino} aoMudar={(m) => mudar({ destino: m, distanciaKm: undefined })} />
          <Acessos titulo="No destino" acesso={r.acessoDestino} aoMudar={(a) => mudar({ acessoDestino: a })} />
        </>
      ) : null}
    </View>
  );
}

function PassoFotografias({
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

  return (
    <View style={{ gap: 16 }}>
      <Titulo>Fotografias</Titulo>
      <Paragrafo>Com fotografias, os profissionais propõem um preço mais certo.</Paragrafo>
      <Botao titulo="Tirar fotografia" desligado={restam <= 0} aoCarregar={() => void juntar("camara")} />
      <Botao titulo="Escolher da galeria" tipo="secundario" desligado={restam <= 0} aoCarregar={() => void juntar("galeria")} />
      {erro ? <Aviso texto={erro} tom="mau" /> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {r.fotos.map((f) => (
          <View key={f.uri} style={{ width: 96, gap: 4 }}>
            <Image source={{ uri: f.url ?? f.uri }} style={{ width: 96, height: 96, borderRadius: 10, backgroundColor: CORES.superficie, opacity: f.estado === "enviada" ? 1 : 0.5 }} />
            <Text style={{ color: f.estado === "falhou" ? CORES.mau : CORES.suave, fontSize: 12 }} numberOfLines={1}>
              {f.estado === "a-enviar" ? "A enviar…" : f.estado === "falhou" ? "Não seguiu" : "Enviada"}
            </Text>
            {f.estado === "falhou" ? (
              <Ligacao titulo="Repetir" aoCarregar={() => void enviarUma(f.uri, () => reduzirFotografiaDoEndereco(f.uri))} />
            ) : null}
            {f.estado !== "a-enviar" ? (
              <Ligacao titulo="Tirar" tom="suave" aoCarregar={() => mudar((a) => ({ fotos: a.fotos.filter((x) => x.uri !== f.uri) }))} />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function PassoQuando({ r, c, comSessao, emailDaSessao, mudar }: { r: Rascunho; c: Catalogo; comSessao: boolean; emailDaSessao: string | null; mudar: (p: Partial<Rascunho>) => void }) {
  const dias = diasParaEscolher(new Date());
  return (
    <View style={{ gap: 16 }}>
      <Titulo>Quando precisa?</Titulo>
      <Escolhas opcoes={c.quando.map((q) => ({ id: q, nome: TEXTO_DO_QUANDO[q] }))} valor={r.quando} aoEscolher={(v) => mudar({ quando: v, data: v === "data" ? r.data : undefined })} />
      {r.quando === "data" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {dias.map((d) => {
            const escolhido = r.data === d.dia;
            return (
              <Pressable
                key={d.dia}
                accessibilityRole="radio"
                accessibilityState={{ selected: escolhido }}
                accessibilityLabel={d.texto}
                onPress={() => mudar({ data: d.dia })}
                style={({ pressed }) => ({ width: 120, minHeight: 64, padding: 10, borderRadius: 10, borderWidth: escolhido ? 2 : 1, borderColor: escolhido ? CORES.marca : CORES.linha, backgroundColor: escolhido ? CORES.marcaSuave : CORES.fundo, opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ color: CORES.tinta, fontSize: 13 }} numberOfLines={3}>
                  {d.texto}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {c.textos.valorDesejadoEtiqueta ? (
        <Campo
          rotulo={c.textos.valorDesejadoEtiqueta}
          ajuda={c.textos.valorDesejadoAjuda}
          valor={r.valorDesejado}
          aoMudar={(v) => mudar({ valorDesejado: v.replace(/[^\d,.]/g, "") })}
          keyboardType="decimal-pad"
        />
      ) : null}
      <Escolhas
        rotulo="Quer NIF na fatura?"
        opcoes={[
          { id: "nao", nome: "Não" },
          { id: "sim", nome: "Sim" },
        ]}
        valor={r.querNif ? "sim" : "nao"}
        aoEscolher={(v) => mudar({ querNif: v === "sim" })}
      />
      {r.querNif ? <Campo rotulo="NIF" valor={r.nif} aoMudar={(v) => mudar({ nif: v.replace(/[^\d]/g, "").slice(0, 9) })} keyboardType="number-pad" /> : null}
      <Campo rotulo="Nome" valor={r.nome} aoMudar={(v) => mudar({ nome: v })} autoComplete="name" />
      <Campo rotulo="Telemóvel" valor={r.telefone} aoMudar={(v) => mudar({ telefone: v })} keyboardType="phone-pad" autoComplete="tel" />
      {comSessao ? (
        <Paragrafo suave>{`Email: ${emailDaSessao ?? ""}`}</Paragrafo>
      ) : (
        <Campo rotulo="Email" valor={r.email} aoMudar={(v) => mudar({ email: v })} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      )}
    </View>
  );
}

function Resumo({ r, c }: { r: Rascunho; c: Catalogo }) {
  const servico = c.servicos.find((s) => s.id === r.servico)?.nome;
  const quando = r.quando === "data" && r.data ? dias(r.data) : r.quando ? TEXTO_DO_QUANDO[r.quando] : null;
  const linhas = [
    servico,
    r.morada?.formattedAddress,
    detalhesDe(r, c) === "mudanca" && r.destino ? `Para: ${r.destino.formattedAddress}` : null,
    quando ? `Quando: ${quando}` : null,
    `${r.fotos.filter((f) => f.estado === "enviada").length} fotografias`,
  ].filter(Boolean) as string[];
  return (
    <View style={{ gap: 4, padding: 14, borderRadius: 12, backgroundColor: CORES.superficie }}>
      <Subtitulo>Resumo</Subtitulo>
      {linhas.map((l, i) => (
        <Text key={i} style={{ color: CORES.tinta, fontSize: 14 }} numberOfLines={2}>
          {l}
        </Text>
      ))}
    </View>
  );
}

function dias(dia: string): string {
  return diasParaEscolher(new Date()).find((d) => d.dia === dia)?.texto ?? dia;
}

export function NovoPedido({ comSessao }: { comSessao: boolean }) {
  const { catalogo, erro: erroDoCatalogo, aLer, recarregar } = useCatalogo();
  const { email } = useSessao();
  const { recarregar: recarregarALista } = usePedidos();
  const params = useLocalSearchParams<{ servico?: string; morada?: string }>();
  const [r, setR] = useState<Rascunho | null>(null);
  const [falta, setFalta] = useState<string | null>(null);
  const [semFotos, setSemFotos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroDoEnvio, setErroDoEnvio] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<{ id: number; aviso: string | null } | null>(null);
  const [perguntarAvisos, setPerguntarAvisos] = useState(false);
  const rascunho = useRef<Rascunho | null>(null);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      const guardado = await lerRascunho();
      let base = guardado ?? rascunhoVazio();
      if (!guardado && comSessao) {
        try {
          const u = await pedir<{ user?: { name?: string | null; phone?: string | null } }>("/api/users/me");
          base = { ...base, nome: u.user?.name ?? "", telefone: u.user?.phone ?? "" };
        } catch {
          /* sem os dados da conta: escreve-os ele */
        }
      }
      rascunho.current = base;
      setR(base);
    })();
  }, [comSessao]);

  // «Pedir outra vez» (E10): o serviço e a morada do pedido anterior.
  useEffect(() => {
    if (!r || !catalogo || r.servico || (!params.servico && !params.morada)) return;
    const servico = catalogo.servicos.find((s) => s.nome === params.servico)?.id;
    mudar({ servico, morada: params.morada ? { formattedAddress: params.morada, aMao: true } : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogo, params.servico, params.morada, r === null]);

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

  if (enviado) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Titulo>{`Pedido #${enviado.id} registado`}</Titulo>
          {enviado.aviso ? <Aviso texto={enviado.aviso} tom="aviso" /> : null}
          {comSessao ? (
            <>
              <Paragrafo>A CLYON revê a informação e envia o pedido aos profissionais da sua zona. As propostas aparecem aqui e avisamos no telemóvel.</Paragrafo>
              <Botao titulo="Ver o pedido" aoCarregar={() => router.replace(`/pedido/${enviado.id}`)} />
            </>
          ) : (
            <>
              <Paragrafo>A CLYON revê a informação e envia o pedido aos profissionais da sua zona. As propostas chegam ao seu email.</Paragrafo>
              <Botao titulo="Entrar para acompanhar aqui" aoCarregar={() => router.replace({ pathname: "/entrar", params: { email: r?.email ?? "" } })} />
              <Ligacao titulo="Agora não" centrada aoCarregar={() => router.replace("/")} />
            </>
          )}
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
        <Titulo>Novo pedido</Titulo>
        <Aviso texto={erroDoCatalogo ?? "Não foi possível ler os serviços. Tente outra vez daqui a pouco."} tom="mau" />
        <Botao titulo="Tentar outra vez" aoCarregar={recarregar} />
        <Ligacao titulo="Pedir pelo WhatsApp" aoCarregar={() => whatsappDaClyon("Olá! Quero pedir um orçamento.")} />
      </SafeAreaView>
    );
  }

  const c = catalogo;
  const passo = r.passo;

  function avancar() {
    if (!r) return;
    const f = faltaNoPasso(r, passo, c, comSessao);
    if (f) return setFalta(f);
    if (passo === 3 && r.fotos.filter((x) => x.estado === "enviada").length === 0 && !r.semFotosAceite) return setSemFotos(true);
    if (passo < 4) {
      mudar({ passo: (passo + 1) as Rascunho["passo"] });
      scroll.current?.scrollTo({ y: 0, animated: false });
    } else void enviar();
  }

  async function enviar() {
    if (!r) return;
    setEnviando(true);
    setErroDoEnvio(null);
    try {
      const corpo = corpoDoPedido(r, c, { emailDaSessao: comSessao ? email : null, rascunhosAntes: await rascunhosComecados() });
      const resposta = await pedir<{ id?: unknown }>(ROTA_DO_ENVIO, { metodo: "POST", corpo });
      const id = Number(resposta.id);
      if (!Number.isInteger(id) || id <= 0) throw new ErroDaApi("Não foi possível registar o pedido.", 500);
      const aviso = avisoDasFotografias(r);
      apagarRascunho();
      recomecarContagem();
      rascunho.current = null;
      setEnviado({ id, aviso });
      if (comSessao) {
        void recarregarALista();
        if (!(await jaPerguntouPelosAvisos())) setPerguntarAvisos(true);
      }
    } catch (e) {
      // O telefone errado vem com o campo; o resto, a frase da especificação.
      if (e instanceof ErroDaApi && e.corpo.campo === "telefone") setFalta(e.message);
      else setErroDoEnvio("Não foi possível registar o pedido.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }} edges={comSessao ? ["top", "left", "right"] : ["left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: CORES.suave, fontSize: 14, fontWeight: "600" }}>{`Passo ${passo} de 4`}</Text>
          {passo === 1 ? <PassoServico r={r} c={c} mudar={mudar} /> : null}
          {passo === 2 ? <PassoMorada r={r} c={c} mudar={mudar} /> : null}
          {passo === 3 ? <PassoFotografias r={r} maximo={c.ficheiros.maximo} mudar={mudarCom} /> : null}
          {passo === 4 ? <PassoQuando r={r} c={c} comSessao={comSessao} emailDaSessao={email} mudar={mudar} /> : null}
          {passo === 4 ? <Resumo r={r} c={c} /> : null}
          {falta ? <Aviso texto={falta} tom="mau" /> : null}
          {erroDoEnvio ? (
            <View style={{ gap: 10 }}>
              <Aviso texto={erroDoEnvio} tom="mau" />
              <Botao titulo="Tentar outra vez" tipo="secundario" aoCarregar={() => void enviar()} />
              <Botao titulo="Enviar por WhatsApp" tipo="secundario" aoCarregar={() => whatsappDaClyon("Olá! Quero pedir um orçamento.")} />
            </View>
          ) : null}
          <Botao titulo={passo === 4 ? "Enviar pedido" : "Continuar"} ocupado={enviando} aoCarregar={avancar} />
          {passo > 1 ? <Ligacao titulo="Voltar ao passo anterior" centrada aoCarregar={() => mudar({ passo: (passo - 1) as Rascunho["passo"] })} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <Confirmacao
        visivel={semFotos}
        titulo="Fotografias"
        texto={c.textos.semFotos ?? SEM_FOTOS}
        confirmar="Continuar"
        voltar="Juntar fotografias"
        aoConfirmar={() => {
          setSemFotos(false);
          mudar({ semFotosAceite: true, passo: 4 });
        }}
        aoVoltar={() => setSemFotos(false)}
      />
    </SafeAreaView>
  );
}
