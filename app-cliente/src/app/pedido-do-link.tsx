import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Aviso, Botao, Carregando, Ecra, Paragrafo, Titulo } from "../componentes/ui";
import { useSessao } from "../estado/Sessao";
import { ErroDaApi, mensagemDe, pedir } from "../lib/api";
import { abrirNoNavegador, whatsappDaClyon } from "../lib/abrir";
import { mascararEmail } from "../lib/entrada";
import { enderecoDoPedidoNoSite, esquecerLinkDoPedido, linkDoPedidoPendente } from "../lib/links";
import {
  ROTA_DO_PEDIDO_DO_LINK,
  WHATSAPP_LINK_EXPIROU,
  WHATSAPP_LINK_NAO_ABRE,
  type RespostaDoPedidoDoLink,
} from "../lib/pedidos";

/**
 * E1b — O LINK DE UM PEDIDO (versão 2, 28-10-2026 — P1).
 *
 * Abre pelo link `https://clyon.pt/pedido/<token>` (App Link verificado). O
 * token do pedido serve SÓ para a R10 (`POST /api/cliente/pedido-do-link`)
 * saber que pedido é e, se for o caso, juntá-lo à conta: vive na memória deste
 * ecrã, nunca se guarda, e nunca serve para ler o pedido (a R5 é só com sessão).
 *
 * Os pedidos feitos pelo WhatsApp (sem email) juntam-se à conta com um toque
 * (decisão do dono, 28-10-2026). Quem tem o link é o dono do pedido, como no site.
 */
type Estado =
  | { passo: "a-ler" }
  | { passo: "sem-sessao" }
  | { passo: "juntar"; id: number; servico: string; cidade: string | null; criadoEmTexto: string | null }
  | { passo: "outro-email" }
  | { passo: "expirou" }
  | { passo: "nao-abre" }
  | { passo: "erro"; mensagem: string };

export default function PedidoDoLink() {
  const { ligado, email } = useSessao();
  const token = useRef<string | null>(linkDoPedidoPendente());
  const [estado, setEstado] = useState<Estado>({ passo: "a-ler" });
  const [juntando, setJuntando] = useState(false);
  const [erroAoJuntar, setErroAoJuntar] = useState<string | null>(null);

  const abrirOPedido = useCallback((id: number) => {
    esquecerLinkDoPedido();
    router.replace(`/pedido/${id}`);
  }, []);

  const ler = useCallback(async () => {
    if (!token.current) {
      router.replace("/");
      return;
    }
    if (!ligado) {
      setEstado({ passo: "sem-sessao" });
      return;
    }
    setEstado({ passo: "a-ler" });
    try {
      const r = await pedir<RespostaDoPedidoDoLink>(ROTA_DO_PEDIDO_DO_LINK, {
        metodo: "POST",
        corpo: { token: token.current },
      });
      if (r.estado === "seu") return abrirOPedido(r.id);
      if (r.estado === "semEmail") {
        return setEstado({ passo: "juntar", id: r.id, servico: r.servico, cidade: r.cidade, criadoEmTexto: r.criadoEmTexto });
      }
      setEstado({ passo: "outro-email" });
    } catch (e) {
      if (e instanceof ErroDaApi && e.estado === 410) return setEstado({ passo: "expirou" });
      if (e instanceof ErroDaApi && e.estado === 404) return setEstado({ passo: "nao-abre" });
      setEstado({ passo: "erro", mensagem: mensagemDe(e) });
    }
  }, [ligado, abrirOPedido]);

  useEffect(() => {
    void ler();
  }, [ler]);

  async function juntar() {
    if (!token.current) return;
    setJuntando(true);
    setErroAoJuntar(null);
    try {
      const r = await pedir<RespostaDoPedidoDoLink>(ROTA_DO_PEDIDO_DO_LINK, {
        metodo: "POST",
        corpo: { token: token.current, juntar: true },
      });
      if (r.estado === "seu") return abrirOPedido(r.id);
      setEstado({ passo: "outro-email" });
    } catch (e) {
      // 409: entretanto outra conta juntou-o — «Este pedido já está ligado a uma conta.»
      setErroAoJuntar(mensagemDe(e));
    } finally {
      setJuntando(false);
    }
  }

  const verNoNavegador = () => {
    if (token.current) abrirNoNavegador(enderecoDoPedidoNoSite(token.current));
  };

  const sair = () => {
    esquecerLinkDoPedido();
    router.replace("/");
  };

  if (estado.passo === "a-ler") return <Carregando />;

  if (estado.passo === "sem-sessao") {
    return (
      <Ecra>
        <View style={{ height: 24 }} />
        <Titulo>O seu pedido na app</Titulo>
        <Paragrafo>Entre para acompanhar este pedido aqui, com avisos no telemóvel.</Paragrafo>
        {/* O token fica na memória: depois de entrar, este ecrã continua. */}
        <Botao titulo="Entrar" aoCarregar={() => router.push("/entrar")} />
        <Botao titulo="Ver no navegador" tipo="secundario" aoCarregar={verNoNavegador} />
      </Ecra>
    );
  }

  if (estado.passo === "juntar") {
    const linha = [`Pedido #${estado.id}`, estado.servico, estado.cidade].filter(Boolean).join(" · ");
    return (
      <Ecra>
        <View style={{ height: 24 }} />
        <Titulo>Juntar este pedido à sua conta?</Titulo>
        <Paragrafo>{linha}</Paragrafo>
        {estado.criadoEmTexto ? <Paragrafo suave>{`Feito a ${estado.criadoEmTexto}.`}</Paragrafo> : null}
        <Paragrafo>
          {`Este pedido foi feito pelo WhatsApp. Ao juntá-lo à conta ${mascararEmail(email ?? "")}, passa a vê-lo aqui e os avisos dele chegam a esta app e ao seu email.`}
        </Paragrafo>
        {erroAoJuntar ? <Aviso texto={erroAoJuntar} tom="mau" /> : null}
        <Botao titulo="Juntar à minha conta" ocupado={juntando} aoCarregar={() => void juntar()} />
        <Botao titulo="Agora não" tipo="secundario" desligado={juntando} aoCarregar={sair} />
      </Ecra>
    );
  }

  if (estado.passo === "outro-email") {
    return (
      <Ecra>
        <View style={{ height: 24 }} />
        <Titulo>Pedido de outra conta</Titulo>
        <Paragrafo>Este pedido foi feito com outro email. Para o ver aqui, entre com esse email.</Paragrafo>
        {/* Ao abrir o link de entrada da outra conta, o E1a pergunta «Trocar de conta?». */}
        <Botao titulo="Entrar com outro email" aoCarregar={() => router.push("/entrar")} />
        <Botao titulo="Ver no navegador" tipo="secundario" aoCarregar={verNoNavegador} />
      </Ecra>
    );
  }

  if (estado.passo === "expirou") {
    return (
      <Ecra>
        <View style={{ height: 24 }} />
        <Titulo>Este link expirou</Titulo>
        <Paragrafo>Os links de acesso duram 30 dias, por segurança. Peça um novo à CLYON pelo WhatsApp.</Paragrafo>
        <Botao titulo="Falar com a CLYON por WhatsApp" aoCarregar={() => whatsappDaClyon(WHATSAPP_LINK_EXPIROU)} />
        <Botao titulo="Voltar" tipo="secundario" aoCarregar={sair} />
      </Ecra>
    );
  }

  if (estado.passo === "nao-abre") {
    return (
      <Ecra>
        <View style={{ height: 24 }} />
        <Titulo>Este link já não abre nenhum pedido</Titulo>
        <Paragrafo>O pedido pode ter passado o prazo, ou o link pode ter vindo partido.</Paragrafo>
        <Botao titulo="Falar com a CLYON por WhatsApp" aoCarregar={() => whatsappDaClyon(WHATSAPP_LINK_NAO_ABRE)} />
        <Botao titulo="Voltar" tipo="secundario" aoCarregar={sair} />
      </Ecra>
    );
  }

  return (
    <Ecra>
      <View style={{ height: 24 }} />
      <Titulo>O seu pedido na app</Titulo>
      <Aviso texto={estado.mensagem} tom="mau" />
      <Botao titulo="Tentar outra vez" aoCarregar={() => void ler()} />
      <Botao titulo="Voltar" tipo="secundario" aoCarregar={sair} />
    </Ecra>
  );
}
