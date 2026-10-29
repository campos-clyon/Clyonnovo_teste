import { useLocalSearchParams } from "expo-router";
import { VistaDoPedido } from "../../componentes/VistaDoPedido";

/** E5 v3 — o pedido, com conta (R5 e R8 com a sessão do cliente). Ver `componentes/VistaDoPedido.tsx`. */
export default function OPedido() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pedidoId = /^\d{1,10}$/.test(String(id ?? "")) ? Number(id) : NaN;
  return <VistaDoPedido pedidoId={pedidoId} />;
}
