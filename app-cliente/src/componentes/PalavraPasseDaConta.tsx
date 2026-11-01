import { useEffect, useState } from "react";
import { View } from "react-native";
import { Linha } from "./Linhas";
import { Text } from "./Texto";
import { Aviso, Botao, Campo, Folha, Ligacao } from "./ui";
import { ErroDaApi, mensagemDe, pedir } from "../lib/api";
import { gravarPalavraPasse, PALAVRA_PASSE_GRAVADA, temPalavraPasse } from "../lib/entrada";
import { CORES } from "../tema";
// O mínimo é o do site (o mesmo do registo e do repor): uma regra só.
import { MINIMO_DA_PALAVRA_PASSE } from "../../../src/lib/palavra-passe-minima";

/**
 * DEFINIR OU ALTERAR A PALAVRA-PASSE, NO PERFIL (01-11-2026).
 *
 * Quem entrou com o Google ou com o link pode definir uma (a sessão chega: o
 * email já está provado); quem já tem, altera-a com a actual. A rota é a da
 * «Segurança» da conta do site (`/api/conta/palavra-passe`), com o Bearer.
 */
export function PalavraPasseDaConta() {
  const [tem, setTem] = useState<boolean | null>(null);
  const [aberta, setAberta] = useState(false);
  const [actual, setActual] = useState("");
  const [nova, setNova] = useState("");
  const [ver, setVer] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState<{ texto: string; campo?: string } | null>(null);
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    temPalavraPasse(pedir)
      .then(setTem)
      .catch(() => setTem(null));
  }, []);

  function abrir() {
    setActual("");
    setNova("");
    setVer(false);
    setErro(null);
    setFeito(false);
    setAberta(true);
  }

  async function gravar() {
    if (tem && !actual) return setErro({ texto: "Escreva a palavra-passe actual.", campo: "actual" });
    if (nova.length < MINIMO_DA_PALAVRA_PASSE) {
      return setErro({ texto: `A palavra-passe nova precisa de pelo menos ${MINIMO_DA_PALAVRA_PASSE} caracteres.`, campo: "nova" });
    }
    setErro(null);
    setAGravar(true);
    try {
      await gravarPalavraPasse({ pedir, nova, actual: tem ? actual : undefined });
      setTem(true);
      setFeito(true);
      setActual("");
      setNova("");
    } catch (e) {
      const campo = e instanceof ErroDaApi ? e.corpo.campo : undefined;
      setErro({ texto: mensagemDe(e, "Não foi possível gravar agora. Tente outra vez."), campo: typeof campo === "string" ? campo : undefined });
    } finally {
      setAGravar(false);
    }
  }

  const titulo = tem ? "Alterar a palavra-passe" : "Definir uma palavra-passe";

  return (
    <>
      <Linha
        icone="key-outline"
        titulo={titulo}
        texto={tem ? null : "Para entrar também com o email e a palavra-passe"}
        aoCarregar={abrir}
      />
      <Folha visivel={aberta} aoFechar={() => setAberta(false)}>
        <Text titulo accessibilityRole="header" style={{ color: CORES.tinta, fontSize: 21, fontWeight: "700" }}>
          {titulo}
        </Text>
        {feito ? (
          <View style={{ gap: 12 }}>
            <Aviso tom="bom" texto={PALAVRA_PASSE_GRAVADA} />
            <Botao titulo="Fechar" tipo="secundario" aoCarregar={() => setAberta(false)} />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {tem ? (
              <Campo
                rotulo="Palavra-passe actual"
                valor={actual}
                aoMudar={setActual}
                secureTextEntry={!ver}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                erro={erro?.campo === "actual" ? erro.texto : null}
              />
            ) : null}
            <Campo
              rotulo="Palavra-passe nova"
              valor={nova}
              aoMudar={setNova}
              secureTextEntry={!ver}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={() => void gravar()}
              ajuda={`Pelo menos ${MINIMO_DA_PALAVRA_PASSE} caracteres.`}
              erro={erro?.campo === "nova" ? erro.texto : null}
            />
            <Ligacao titulo={ver ? "Esconder as palavras-passe" : "Mostrar as palavras-passe"} tom="suave" aoCarregar={() => setVer(!ver)} />
            <Botao titulo="Gravar" ocupado={aGravar} aoCarregar={() => void gravar()} />
            {erro && erro.campo !== "actual" && erro.campo !== "nova" ? <Aviso tom="mau" texto={erro.texto} /> : null}
          </View>
        )}
      </Folha>
    </>
  );
}
