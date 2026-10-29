import { router, useLocalSearchParams } from "expo-router";
import { CodigoDeJuncao } from "../../componentes/CodigoDeJuncao";
import { Botao, Ecra, Paragrafo, Titulo } from "../../componentes/ui";
import { useSessao } from "../../estado/Sessao";
import { juntarOConvidado } from "../../lib/depois-de-entrar";
import type { ResultadoDaJuncao } from "../../lib/pedido-do-link";

/**
 * JUNTAR À CONTA UM PEDIDO ABERTO PELO LINK (D5 com a regra R13): o ecrã do
 * código de 6 algarismos que a CLYON manda por WhatsApp ao telefone do pedido,
 * ou o aviso de que a equipa vai confirmar. Chega aqui depois de entrar, com
 * o que a R10 respondeu.
 */
const ESTADOS = ["aConfirmar", "aEsperaDaMesa", "errado", "expirado", "muitos", "outro"] as const;

export default function Juntar() {
  const p = useLocalSearchParams<{ id: string; estado?: string; mensagem?: string }>();
  const { ligado } = useSessao();
  const pedidoId = /^\d{1,10}$/.test(String(p.id ?? "")) ? Number(p.id) : NaN;
  const estado = ESTADOS.find((e) => e === p.estado) ?? "outro";
  const inicial = { estado, mensagem: typeof p.mensagem === "string" && p.mensagem ? p.mensagem : "Não foi possível juntar o pedido agora." } as ResultadoDaJuncao;

  if (!ligado || !Number.isInteger(pedidoId)) {
    return (
      <Ecra>
        <Titulo>Entre para juntar o pedido</Titulo>
        <Paragrafo>Para juntar o pedido à sua conta, entre primeiro na CLYON.</Paragrafo>
        <Botao titulo="Entrar" aoCarregar={() => router.replace({ pathname: "/entrar", params: { para: "juntar", pedidoId: String(p.id ?? "") } })} />
      </Ecra>
    );
  }

  return (
    <Ecra>
      <CodigoDeJuncao
        pedidoId={pedidoId}
        inicial={inicial}
        juntar={(codigo) => juntarOConvidado(pedidoId, codigo)}
        aoJuntar={(id) => router.replace(`/pedido/${id}`)}
        aoVoltar={() => router.replace(`/convidado/${pedidoId}`)}
      />
    </Ecra>
  );
}
