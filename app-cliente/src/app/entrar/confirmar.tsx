import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Aviso, Botao, Carregando, Ecra, Paragrafo, Titulo } from "../../componentes/ui";
import { useSessao } from "../../estado/Sessao";
import { pedir } from "../../lib/api";
import { codigoDescartavel, esquecerCodigoDoAparelho, lerCodigoDoAparelho } from "../../lib/codigo-do-aparelho";
import { entrarComOLink, estadoDoErro, NAO_ENTROU, verificarLinkDeEntrada, type EstadoDaConfirmacao } from "../../lib/entrada";
import { esquecerLinkDeEntrada, linkDeEntradaPendente, linkDoPedidoPendente, ECRA_DO_PEDIDO_DO_LINK } from "../../lib/links";

/**
 * E1a — CONFIRMAR A ENTRADA (versão 2, 28-10-2026).
 *
 * Abre só pelo link do email `https://clyon.pt/entrar/app?t=…` (App Link
 * verificado), e o token chega pela memória que o `+native-intent.tsx` encheu
 * — nunca pelo esquema próprio da app, nem pelo endereço deste ecrã.
 *
 * AO ABRIR NÃO SE GASTA O LINK: pergunta-se ao site de quem é a conta (R1a) e
 * mostra-se mascarada. Só um toque em «Entrar» (ou «Trocar de conta») chama a
 * R1. «Não sou eu» não chama nada: deita fora o código deste telemóvel — o
 * mesmo link já não entra aqui — e volta ao Entrar com o aviso.
 */
type Passo = EstadoDaConfirmacao | { passo: "a-verificar" } | { passo: "a-entrar" };

export default function ConfirmarEntrada() {
  const { email: emailDaSessao, ligado, entrarComSessaoNova, mostrarAviso } = useSessao();
  const [estado, setEstado] = useState<Passo>({ passo: "a-verificar" });
  const [erroAoEntrar, setErroAoEntrar] = useState<string | null>(null);
  const token = useRef<string | null>(linkDeEntradaPendente());
  const codigo = useRef<string | null>(null);

  const verificar = useCallback(async () => {
    if (token.current === null) {
      router.replace("/");
      return;
    }
    setEstado({ passo: "a-verificar" });
    // Este telemóvel nunca pediu um link: pergunta-se com um código que não se guarda,
    // e o site responde com o motivo certo («outroAparelho» ou «doSite»).
    codigo.current = (await lerCodigoDoAparelho()) ?? codigoDescartavel();
    const r = await verificarLinkDeEntrada({
      pedir,
      token: token.current,
      codigo: codigo.current,
      emailDaSessao: ligado ? emailDaSessao : null,
    });
    if (r.passo === "mesma-conta") {
      // A mesma conta já está aberta: vai para Pedidos sem gastar o link.
      esquecerLinkDeEntrada();
      router.replace("/");
      return;
    }
    setEstado(r);
  }, [emailDaSessao, ligado]);

  useEffect(() => {
    void verificar();
    // Só ao abrir: depois de entrar, a sessão muda e este ecrã já saiu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function entrar() {
    if (!token.current || !codigo.current) return;
    setErroAoEntrar(null);
    const antes = estado;
    setEstado({ passo: "a-entrar" });
    try {
      const sessao = await entrarComOLink({ pedir, token: token.current, codigo: codigo.current });
      esquecerLinkDeEntrada();
      await entrarComSessaoNova(sessao);
      // O link de um pedido que estava aberto (E1b) continua; senão, Pedidos.
      router.replace(linkDoPedidoPendente() ? ECRA_DO_PEDIDO_DO_LINK : "/");
    } catch (e) {
      const erro = estadoDoErro(e);
      if (erro.botao === "tentar-outra-vez") {
        setEstado(antes);
        setErroAoEntrar(erro.mensagem);
      } else {
        setEstado(erro);
      }
    }
  }

  async function naoSouEu() {
    esquecerLinkDeEntrada();
    await esquecerCodigoDoAparelho();
    mostrarAviso({ texto: NAO_ENTROU, tom: "aviso" });
    router.replace("/entrar");
  }

  function ficarNaConta() {
    // O link não se gasta e expira sozinho.
    esquecerLinkDeEntrada();
    router.replace("/");
  }

  function pedirLinkNovo() {
    esquecerLinkDeEntrada();
    router.replace(ligado ? "/" : "/entrar");
  }

  if (estado.passo === "a-verificar") return <Carregando texto="A verificar o link…" />;
  if (estado.passo === "a-entrar") return <Carregando texto="A entrar…" />;

  if (estado.passo === "erro") {
    return (
      <Ecra>
        <View style={{ height: 24 }} />
        <Titulo>Entrar na CLYON</Titulo>
        <Aviso texto={estado.mensagem} tom="mau" />
        {estado.botao === "novo-link" ? <Botao titulo="Pedir um link novo" aoCarregar={pedirLinkNovo} /> : null}
        {estado.botao === "tentar-outra-vez" ? <Botao titulo="Tentar outra vez" aoCarregar={() => void verificar()} /> : null}
        {estado.botao === "nenhum" ? <Botao titulo="Voltar" tipo="secundario" aoCarregar={pedirLinkNovo} /> : null}
      </Ecra>
    );
  }

  if (estado.passo === "trocar") {
    return (
      <Ecra>
        <View style={{ height: 24 }} />
        <Titulo>Trocar de conta?</Titulo>
        <Paragrafo>
          {`Neste telemóvel está aberta a conta ${estado.sessaoMascarada}. Quer sair dela e entrar como ${estado.emailMascarado}?`}
        </Paragrafo>
        {erroAoEntrar ? <Aviso texto={erroAoEntrar} tom="mau" /> : null}
        <Botao titulo="Trocar de conta" aoCarregar={() => void entrar()} />
        <Botao titulo={`Ficar em ${estado.sessaoMascarada}`} tipo="secundario" aoCarregar={ficarNaConta} />
      </Ecra>
    );
  }

  if (estado.passo === "entrar") {
    return (
      <Ecra>
        <View style={{ height: 24 }} />
        <Titulo>Entrar na CLYON</Titulo>
        <Paragrafo>{`Vai entrar como ${estado.emailMascarado}.`}</Paragrafo>
        {erroAoEntrar ? <Aviso texto={erroAoEntrar} tom="mau" /> : null}
        <Botao titulo="Entrar" aoCarregar={() => void entrar()} />
        <Botao titulo="Não sou eu" tipo="secundario" aoCarregar={() => void naoSouEu()} />
      </Ecra>
    );
  }

  return <Carregando />;
}
