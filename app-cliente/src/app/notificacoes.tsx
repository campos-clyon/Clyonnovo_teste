import { router } from "expo-router";
import { useEffect } from "react";
import { Grupo, Linha } from "../componentes/Linhas";
import { Ecra, Paragrafo } from "../componentes/ui";
import { usePedidos } from "../estado/Pedidos";
import { useSessao } from "../estado/Sessao";

/**
 * NOTIFICAÇÕES (barra de cima, 30-10-2026). O site ainda não tem uma rota com
 * os avisos ao cliente: mostram-se as novidades dos pedidos que a app já
 * recebe de /api/cliente/pedidos (o campo `novidade`). Sem sessão, vazio.
 *
 * VISTAS (02-11-2026): abrir este ecrã dá por vistas todas as que aparecem
 * aqui (e as que chegarem com ele aberto) — o selo do sino e do Início deixa
 * de as contar. Continuam na lista enquanto o pedido estiver assim.
 */
export default function Notificacoes() {
  const { ligado } = useSessao();
  const { pedidos, marcarVistas } = usePedidos();
  const comNovidade = ligado ? pedidos.filter((p) => p.novidade) : [];

  // Com a lista que está no ecrã (sem nada de novo, `marcarComoVistas` não muda nada).
  useEffect(() => {
    if (ligado) marcarVistas(pedidos);
  }, [ligado, pedidos, marcarVistas]);

  return (
    <Ecra>
      {comNovidade.length === 0 ? (
        <Paragrafo suave>{ligado ? "Não há novidades nos seus pedidos." : "Entre na sua conta para receber aqui as novidades dos seus pedidos."}</Paragrafo>
      ) : (
        <Grupo titulo="Novidades dos pedidos">
          {comNovidade.map((p, i) => (
            <Linha
              key={p.id}
              icone="notifications-outline"
              titulo={`${p.servico} · Pedido #${p.id}`}
              texto={p.novidade}
              aoCarregar={() => router.push(`/pedido/${p.id}`)}
              ultima={i === comNovidade.length - 1}
            />
          ))}
        </Grupo>
      )}
    </Ecra>
  );
}
