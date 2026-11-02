import { useLocalSearchParams } from "expo-router";
import { EcraDePagar } from "../../componentes/Pagar";

/** PAGAMENTO (02-11-2026): só o que é preciso para pagar o pedido. Ver `componentes/Pagar.tsx`. */
export default function Pagamento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pedidoId = /^\d{1,10}$/.test(String(id ?? "")) ? Number(id) : NaN;
  return <EcraDePagar pedidoId={pedidoId} />;
}
