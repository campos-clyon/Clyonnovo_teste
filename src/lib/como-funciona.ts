import { COMO_SE_PAGA, PRAZO_DE_RESPOSTA } from "./seo-data";
import { DIAS_ATE_LIBERTAR_SOZINHO } from "./trabalho";

/**
 * OS PASSOS DE «COMO FUNCIONA» — 29-10-2026 (S12). Estavam escritos dentro de
 * `src/app/como-funciona/page.tsx`; vivem aqui para a página e o catálogo da
 * app de cliente (R7) dizerem o mesmo. Os ícones e as cores ficam na página.
 */
export const PASSOS_DE_COMO_FUNCIONA: ReadonlyArray<{ passo: string; titulo: string; texto: string }> = [
  {
    passo: "01",
    titulo: "Descreve o que precisa",
    texto:
      "No formulário ou por WhatsApp: o que é para levar ou fazer, fotografias, a morada e as condições de acesso — andar, elevador, estacionamento. E escolhe como prefere pagar: pela plataforma ou em dinheiro, ao profissional.",
  },
  {
    passo: "02",
    titulo: "Recebe propostas",
    texto:
      /*
       * A morada exacta e o contacto só passam depois de contratar: os campos
       * que o profissional vê antes disso são uma lista fechada
       * (CAMPOS_VISIVEIS_AO_PROFISSIONAL, em pedido-valores.ts), com a zona e
       * sem morada nem telefone.
       */
      `O pedido chega a profissionais verificados que fazem esse serviço e cuja zona alcança a sua morada — sem a morada exacta nem o seu contacto, que só passam depois de escolher. Cada proposta mostra o preço já com a taxa da plataforma e com IVA incluído, e chegam em menos de ${PRAZO_DE_RESPOSTA.porExtenso}. Pode aceitar, contrapropor ou simplesmente não responder.`,
  },
  {
    passo: "03",
    titulo: "Escolhe",
    texto:
      `Aceita a que quiser — ou nenhuma, sem custo. ${COMO_SE_PAGA}`,
  },
  {
    passo: "04",
    titulo: "Confirma que ficou feito",
    texto:
      /*
       * O prazo do silêncio é o de trabalho.ts: sem resposta do cliente, o
       * trabalho fecha sozinho ao fim desses dias a contar da prova. Dizer só
       * «quando confirmar» esconderia metade da regra.
       *
       * As fotografias são opcionais desde 26-10-2026 (d22), e o prazo só
       * corre com elas (`prazoCorre`); sem elas, confirma a CLYON com o cliente.
       */
      `O profissional faz o trabalho no dia combinado e marca-o como feito, com fotografias se as tiver. Confirma na plataforma que está tudo bem — no pagamento pela plataforma, só então o valor é entregue ao profissional. Sem fotografias, a CLYON confirma consigo antes de libertar o pagamento; com elas, se não disser nada, o trabalho dá-se por concluído ${DIAS_ATE_LIBERTAR_SOZINHO} dias depois.`,
  },
];
