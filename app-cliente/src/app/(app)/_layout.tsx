import { Stack } from "expo-router";
import { CORES } from "../../tema";

/** Os ecrãs de quem já entrou. Os separadores (Pedidos · Novo pedido · Conta) chegam com a R4–R9. */
export default function ComSessao() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: CORES.fundo } }} />;
}
