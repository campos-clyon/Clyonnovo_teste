import { useLocalSearchParams } from "expo-router";
import { VistaDoPedido } from "../../componentes/VistaDoPedido";

/** E5 v3 — o pedido, com conta (R5 e R8 com a sessão do cliente). Ver `componentes/VistaDoPedido.tsx`. */
export default function OPedido() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pedidoId = /^\d{1,10}$/.test(String(id ?? "")) ? Number(id) : NaN;
  // Outro id é outro ecrã: nunca mostra o pedido anterior enquanto o novo carrega (02-11-2026).
  return <VistaDoPedido key={String(id)} pedidoId={pedidoId} />;
}
