import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState, type Dispatch, type SetStateAction } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { RolagemComTeclado } from "../componentes/Teclado";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../componentes/Texto";
import { Botao, Caixa, CampoDeTexto, Mensagem, TituloDaCaixa } from "../componentes/ui";
import { escolherFotografias, reduzirFotografiaDaCandidatura } from "../componentes/Fotografias";
import { VerFotografias } from "../componentes/VerFotografias";
import { enviarFicheiro, ErroDaApi, errosPorCampo, pedir } from "../lib/api";
import { SERVICOS_DA_INSCRICAO } from "../lib/conta";
import {
  AJUDA_DAS_FOTOGRAFIAS_DA_CARRINHA,
  MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA,
  MENSAGEM_SEM_FOTOGRAFIA,
  ROTULO_DAS_FOTOGRAFIAS_DA_CARRINHA,
} from "../lib/fotografias-da-carrinha";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/**
 * QUERO SER PARCEIRO, DENTRO DA APP — 20-10-2026, pedido do dono.
 *
 * O botão do ecrã de entrada abria a página do site; agora a candidatura
 * faz-se aqui, com os mesmos campos e a mesma rota do formulário do site
 * (`/api/parceiros/candidatura`, em `quero-ser-parceiro/FormularioDeCandidatura`).
 * O resto não muda, por escolha dele: alguém da CLYON lê a candidatura no
 * backoffice e aprova; a aprovação manda o link da palavra-passe por email, e
 * esse link abre a app (`definir-senha/[token]`), onde ele fica logo dentro.
 *
 * Desde 04-11-2026 (d17) a candidatura leva de 1 a 4 fotografias da carrinha
 * (`FotografiasDaCarrinha`, em baixo). Sem elas o servidor recusava a da app e
 * mandava a pessoa para o site.
 */

/** As mesmas cinco do site (os ids são os de `TIPOS_DE_VEICULO`). */
const VEICULOS = [
  { id: "carrinha_pequena", rotulo: "Carrinha pequena (até 3 m³)" },
  { id: "carrinha_media", rotulo: "Carrinha média (3 a 8 m³)" },
  { id: "carrinha_grande", rotulo: "Carrinha grande (8 a 15 m³)" },
  { id: "camiao", rotulo: "Camião (mais de 15 m³)" },
  { id: "sem_veiculo", rotulo: "Não tenho viatura própria" },
];

export default function Registo() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cidade, setCidade] = useState("");
  const [tipoVeiculo, setTipoVeiculo] = useState<string | null>(null);
  const [servicos, setServicos] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState("");
  // As fotografias da carrinha (d17, 04-11-2026): os endereços que o envio devolveu.
  const [fotografias, setFotografias] = useState<string[]>([]);
  const [aJuntar, setAJuntar] = useState(0);
  const [aEnviar, setAEnviar] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);

  function alternar(id: string) {
    setServicos((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    setErros(({ servicos: _, ...resto }) => resto);
  }

  async function enviar() {
    setErros({});
    setErroGeral(null);
    // Sem fotografia, a candidatura não segue — como no site, e o servidor recusa-a na mesma.
    if (fotografias.length === 0) {
      setErros({ fotografias: MENSAGEM_SEM_FOTOGRAFIA });
      return;
    }
    setAEnviar(true);
    try {
      await pedir("/api/parceiros/candidatura", {
        metodo: "POST",
        corpo: {
          nome,
          email: email.trim(),
          telefone,
          cidade,
          tipoVeiculo,
          servicos,
          mensagem: mensagem.trim() || null,
          fotografiasDoVeiculo: fotografias,
        },
        semSessao: true,
      });
      setFeito(true);
    } catch (e) {
      const porCampo = errosPorCampo(e);
      if (Object.keys(porCampo).length > 0) {
        setErros(porCampo);
      } else if (e instanceof ErroDaApi && e.estado === 0) {
        setErroGeral("Sem ligação. O que escreveu não se perdeu — tente outra vez.");
      } else {
        setErroGeral(
          e instanceof ErroDaApi ? e.message : "Não foi possível enviar a candidatura. Tente novamente dentro de momentos.",
        );
      }
    } finally {
      setAEnviar(false);
    }
  }

  const pagina = [estilos.pagina, { paddingBottom: margens.bottom + ESPACO.xl }];

  if (feito) {
    return (
      <RolagemComTeclado style={{ backgroundColor: c.fundo }} contentContainerStyle={pagina}>
        <Caixa>
          <Ionicons name="checkmark-circle" size={40} color={c.bom} style={{ alignSelf: "center" }} />
          <Text style={[estilos.tituloFeito, { color: c.tinta }]}>Recebemos a sua candidatura</Text>
          <Text style={[estilos.texto, { color: c.tinta }]}>
            Vamos olhar para ela e falamos consigo. Se avançar, recebe no email{" "}
            <Text style={{ fontWeight: "700" }}>{email.trim()}</Text> o link para escolher a sua palavra-passe. Abra-o
            neste telemóvel: a app abre sozinha e fica logo com a sessão iniciada. O NIF, a morada fiscal e o IBAN
            preenche-os lá dentro, com calma.
          </Text>
          <Text style={[estilos.dica, { color: c.suave }]}>
            Não pedimos nada para se inscrever, e responder a pedidos nunca lhe custa nada. Só há taxa da plataforma quando fecha
            um trabalho.
          </Text>
        </Caixa>
        <Botao titulo="Voltar à entrada" tipo="secundario" aoCarregar={() => (router.canGoBack() ? router.back() : router.replace("/entrar"))} />
      </RolagemComTeclado>
    );
  }

  const nErros = Object.keys(erros).length;

  return (
      <RolagemComTeclado style={{ flex: 1, backgroundColor: c.fundo }} contentContainerStyle={pagina} keyboardShouldPersistTaps="handled">
        <Text style={[estilos.texto, { color: c.suave }]}>
          Diga-nos quem é e o que faz. Alguém da CLYON lê a candidatura e responde-lhe; se avançar, recebe por email o
          link para escolher a palavra-passe.
        </Text>

        <Caixa>
          <CampoDeTexto
            rotulo="Nome ou empresa *"
            value={nome}
            onChangeText={setNome}
            placeholder="Ex.: Transportes e Mudanças, Lda."
            autoComplete="name"
            erro={erros.nome}
          />
          <CampoDeTexto
            rotulo="Telemóvel *"
            value={telefone}
            onChangeText={setTelefone}
            placeholder="912 345 678"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            erro={erros.telefone}
          />
          <CampoDeTexto
            rotulo="Email *"
            value={email}
            onChangeText={setEmail}
            placeholder="nome@empresa.pt"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            erro={erros.email}
          />
          <CampoDeTexto
            rotulo="De onde trabalha *"
            value={cidade}
            onChangeText={setCidade}
            placeholder="Ex.: Seixal"
            dica="A localidade da sua base. É daqui que se mede o que lhe fica perto."
            erro={erros.cidade}
          />
        </Caixa>

        <Caixa>
          <TituloDaCaixa>Viatura</TituloDaCaixa>
          {VEICULOS.map((v) => {
            const activo = tipoVeiculo === v.id;
            return (
              <Pressable
                key={v.id}
                onPress={() => setTipoVeiculo(activo ? null : v.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: activo }}
                style={({ pressed }) => [estilos.opcao, { borderColor: activo ? c.marca : c.linha, opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name={activo ? "radio-button-on" : "radio-button-off"} size={22} color={activo ? c.marca : c.suave} />
                <Text style={{ flex: 1, color: c.tinta }}>{v.rotulo}</Text>
              </Pressable>
            );
          })}
        </Caixa>

        <FotografiasDaCarrinha
          fotografias={fotografias}
          aoMudar={setFotografias}
          aJuntar={aJuntar}
          aoMudarAJuntar={setAJuntar}
          erro={erros.fotografias}
          aoMudarErro={(e) => setErros(({ fotografias: _, ...resto }) => (e ? { ...resto, fotografias: e } : resto))}
        />

        <Caixa>
          <TituloDaCaixa>O que faz *</TituloDaCaixa>
          <Text style={[estilos.dica, { color: c.suave }]}>Só lhe chegam pedidos destas categorias. Pode mudar depois.</Text>
          {/* Os mesmos do /quero-ser-parceiro: os do plano, sem «Outro serviço» (27-10-2026). */}
          {SERVICOS_DA_INSCRICAO.map((s) => {
            const activo = servicos.includes(s.id);
            return (
              <Pressable
                key={s.id}
                onPress={() => alternar(s.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: activo }}
                style={({ pressed }) => [estilos.opcao, { borderColor: activo ? c.marca : c.linha, opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name={activo ? "checkbox" : "square-outline"} size={22} color={activo ? c.marca : c.suave} />
                <Text style={{ flex: 1, color: c.tinta }}>{s.label}</Text>
              </Pressable>
            );
          })}
          {erros.servicos ? <Text style={{ color: c.mau }}>{erros.servicos}</Text> : null}
        </Caixa>

        <Caixa>
          <CampoDeTexto
            rotulo="Quer dizer mais alguma coisa? (opcional)"
            value={mensagem}
            onChangeText={setMensagem}
            placeholder="Há quanto tempo trabalha nisto, quantas pessoas tem na equipa, o que costuma fazer."
            multiline
          />
        </Caixa>

        {/* Os erros por baixo do botão, como no site: é onde ele está a olhar. */}
        {/* Enquanto uma fotografia sobe, espera-se por ela: a candidatura leva os endereços. */}
        <Botao titulo={aEnviar ? "A enviar…" : "Enviar candidatura"} aoCarregar={enviar} ocupado={aEnviar || aJuntar > 0} />
        {erroGeral ? <Mensagem texto={erroGeral} /> : null}
        {nErros > 0 && !erroGeral ? <Mensagem texto="Falta preencher o que está assinalado acima." /> : null}
        <Text style={[estilos.dica, { color: c.suave, textAlign: "center" }]}>
          Ao enviar, fica só uma candidatura registada. Não cria conta nem o obriga a nada.
        </Text>
      </RolagemComTeclado>
  );
}

/**
 * AS FOTOGRAFIAS DA CARRINHA — 04-11-2026 (decisão d17), como no formulário do
 * site (`FormularioDeCandidatura.tsx`): de 1 a 4, e sem nenhuma a candidatura
 * não segue. Sobem uma a uma, logo depois de escolhidas, sem sessão
 * (`POST /api/parceiros/candidatura/fotografias`, campo `file`), reduzidas a
 * 1920 px; a candidatura leva só os endereços (`fotografiasDoVeiculo`). Uma
 * que falhe diz porquê por baixo do campo e não leva as outras com ela.
 * Só a equipa as vê.
 */
function FotografiasDaCarrinha({
  fotografias,
  aoMudar,
  aJuntar,
  aoMudarAJuntar,
  erro,
  aoMudarErro,
}: {
  fotografias: string[];
  aoMudar: Dispatch<SetStateAction<string[]>>;
  /** Quantas estão a subir agora — o «Enviar candidatura» espera por elas. */
  aJuntar: number;
  aoMudarAJuntar: Dispatch<SetStateAction<number>>;
  erro: string | undefined;
  aoMudarErro: (erro: string | null) => void;
}) {
  const c = useCores();
  const [aberta, setAberta] = useState<number | null>(null);
  const restam = MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA - fotografias.length - aJuntar;

  async function juntar(origem: "camara" | "galeria") {
    aoMudarErro(null);
    const r = await escolherFotografias(origem, restam);
    if ("erro" in r) {
      aoMudarErro(r.erro);
      return;
    }
    for (const a of r.fotografias) {
      aoMudarAJuntar((n) => n + 1);
      try {
        const f = await reduzirFotografiaDaCandidatura(a);
        const { url } = await enviarFicheiro<{ url?: unknown }>("/api/parceiros/candidatura/fotografias", {}, f, {
          semSessao: true,
        });
        if (typeof url !== "string" || !url) throw new Error("sem endereço");
        aoMudar((antes) => (antes.includes(url) || antes.length >= MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA ? antes : [...antes, url]));
      } catch (e) {
        aoMudarErro(e instanceof ErroDaApi ? e.message : "A fotografia não seguiu. Tente outra vez.");
        break;
      } finally {
        aoMudarAJuntar((n) => n - 1);
      }
    }
  }

  return (
    <Caixa>
      <TituloDaCaixa>{ROTULO_DAS_FOTOGRAFIAS_DA_CARRINHA} *</TituloDaCaixa>
      <Text style={[estilos.dica, { color: c.suave }]}>{AJUDA_DAS_FOTOGRAFIAS_DA_CARRINHA}</Text>
      {fotografias.length > 0 || aJuntar > 0 ? (
        <View style={estilos.grelha}>
          {fotografias.map((u, i) => (
            <View key={u}>
              <Pressable
                onPress={() => setAberta(i)}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Ver a fotografia ${i + 1} da carrinha`}
              >
                <Image source={{ uri: u }} style={[estilos.foto, { backgroundColor: c.fundo }]} />
              </Pressable>
              <Pressable
                onPress={() => aoMudar((antes) => antes.filter((x) => x !== u))}
                accessibilityRole="button"
                accessibilityLabel={`Tirar a fotografia ${i + 1}`}
                hitSlop={8}
                style={[estilos.tirar, { backgroundColor: c.tinta }]}
              >
                <Text style={{ color: c.superficie, fontWeight: "800", fontSize: 14, lineHeight: 16 }}>×</Text>
              </Pressable>
            </View>
          ))}
          {Array.from({ length: aJuntar }, (_, i) => (
            <View key={`a-enviar-${i}`} style={[estilos.foto, estilos.aEnviar, { backgroundColor: c.fundo, borderColor: c.linha }]}>
              <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>A enviar…</Text>
            </View>
          ))}
        </View>
      ) : null}
      <VerFotografias key={aberta ?? -1} fotos={fotografias} inicio={aberta} aoFechar={() => setAberta(null)} />
      {restam > 0 ? (
        <View style={estilos.lado}>
          <View style={{ flex: 1 }}>
            <Botao titulo="Fotografar" tipo="secundario" aoCarregar={() => void juntar("camara")} />
          </View>
          <View style={{ flex: 1 }}>
            <Botao titulo="Da galeria" tipo="secundario" aoCarregar={() => void juntar("galeria")} />
          </View>
        </View>
      ) : null}
      <Text style={[estilos.dica, { color: c.suave }]}>
        {fotografias.length} de {MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA} fotografias
      </Text>
      {erro ? <Text style={{ color: c.mau }}>{erro}</Text> : null}
    </Caixa>
  );
}

const estilos = StyleSheet.create({
  pagina: { padding: ESPACO.l, gap: ESPACO.m, maxWidth: 560, width: "100%", alignSelf: "center" },
  grelha: { flexDirection: "row", flexWrap: "wrap", gap: ESPACO.s },
  foto: { width: 96, height: 96, borderRadius: RAIO.m },
  aEnviar: { borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  tirar: { position: "absolute", top: -6, right: -6, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  lado: { flexDirection: "row", gap: ESPACO.s },
  texto: { fontSize: LETRA.normal, lineHeight: 23 },
  dica: { fontSize: LETRA.pequena + 1, lineHeight: 19 },
  tituloFeito: { fontSize: LETRA.media + 2, fontWeight: "800", textAlign: "center" },
  opcao: {
    flexDirection: "row",
    alignItems: "center",
    gap: ESPACO.m,
    borderWidth: 1,
    borderRadius: RAIO.m,
    paddingHorizontal: ESPACO.m,
    minHeight: 48,
  },
});
