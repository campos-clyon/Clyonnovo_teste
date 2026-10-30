import { router } from "expo-router";
import { Grupo, Linha } from "../componentes/Linhas";
import { Ecra, Paragrafo } from "../componentes/ui";
import { usePedidos } from "../estado/Pedidos";
import { useSessao } from "../estado/Sessao";

/**
 * NOTIFICAÇÕES (barra de cima, 30-10-2026). O site ainda não tem uma rota com
 * os avisos ao cliente: mostram-se as novidades dos pedidos que a app já
 * recebe de /api/cliente/pedidos (o campo `novidade`). Sem sessão, vazio.
 */
export default function Notificacoes() {
  const { ligado } = useSessao();
  const { pedidos } = usePedidos();
  const comNovidade = ligado ? pedidos.filter((p) => p.novidade) : [];

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
