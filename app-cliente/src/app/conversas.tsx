import { Grupo, Linha } from "../componentes/Linhas";
import { Ecra, Paragrafo } from "../componentes/ui";
import { whatsappDaClyon } from "../lib/abrir";

/**
 * CONVERSAS (barra de cima, 30-10-2026). Para já uma linha: a CLYON, pelo
 * WhatsApp (as mensagens com a CLYON dentro de cada pedido, a R14, abrem-se
 * no próprio pedido). As conversas com os parceiros vêm na fase 2: entram
 * como mais linhas em CONVERSAS, sem mudar o ecrã.
 */
export type Conversa = { id: string; icone: string; titulo: string; texto?: string; abrir: () => void };

export const CONVERSAS: readonly Conversa[] = [
  { id: "clyon", icone: "logo-whatsapp", titulo: "CLYON — suporte", texto: "Fale connosco pelo WhatsApp", abrir: () => whatsappDaClyon() },
];

export default function Conversas() {
  return (
    <Ecra>
      <Grupo titulo="As suas conversas">
        {CONVERSAS.map((c, i) => (
          <Linha key={c.id} icone={c.icone} titulo={c.titulo} texto={c.texto} aoCarregar={c.abrir} ultima={i === CONVERSAS.length - 1} />
        ))}
      </Grupo>
      <Paragrafo pequeno suave>As mensagens de cada pedido estão no próprio pedido.</Paragrafo>
    </Ecra>
  );
}
