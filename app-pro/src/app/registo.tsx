import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../componentes/Texto";
import { Botao, Caixa, CampoDeTexto, Mensagem, TituloDaCaixa } from "../componentes/ui";
import { ErroDaApi, errosPorCampo, pedir } from "../lib/api";
import { SERVICOS_DA_INSCRICAO } from "../lib/conta";
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
  const [aEnviar, setAEnviar] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);

  function alternar(id: string) {
    setServicos((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    setErros(({ servicos: _, ...resto }) => resto);
  }

  async function enviar() {
    setAEnviar(true);
    setErros({});
    setErroGeral(null);
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
      <ScrollView style={{ backgroundColor: c.fundo }} contentContainerStyle={pagina}>
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
            Não pedimos nada para se inscrever, e responder a pedidos nunca lhe custa nada. Só há comissão quando fecha
            um trabalho.
          </Text>
        </Caixa>
        <Botao titulo="Voltar à entrada" tipo="secundario" aoCarregar={() => (router.canGoBack() ? router.back() : router.replace("/entrar"))} />
      </ScrollView>
    );
  }

  const nErros = Object.keys(erros).length;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.fundo }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={pagina} keyboardShouldPersistTaps="handled">
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
        <Botao titulo={aEnviar ? "A enviar…" : "Enviar candidatura"} aoCarregar={enviar} ocupado={aEnviar} />
        {erroGeral ? <Mensagem texto={erroGeral} /> : null}
        {nErros > 0 && !erroGeral ? <Mensagem texto="Falta preencher o que está assinalado acima." /> : null}
        <Text style={[estilos.dica, { color: c.suave, textAlign: "center" }]}>
          Ao enviar, fica só uma candidatura registada. Não cria conta nem o obriga a nada.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pagina: { padding: ESPACO.l, gap: ESPACO.m, maxWidth: 560, width: "100%", alignSelf: "center" },
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
