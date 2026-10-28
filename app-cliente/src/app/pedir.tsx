import { NovoPedido } from "../componentes/NovoPedido";

/** E3 sem sessão — «Pedir orçamento» das boas-vindas. O pedido segue com o email escrito, como no simulador. */
export default function PedirSemConta() {
  return <NovoPedido comSessao={false} />;
}
