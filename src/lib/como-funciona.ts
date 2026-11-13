import { COMO_SE_PAGA, PRAZO_DE_RESPOSTA, comoSePaga } from "./seo-data";
import { DIAS_ATE_LIBERTAR_SOZINHO } from "./trabalho";
import { NOVO_MODELO_DESDE, novoModeloEmVigor } from "./novo-modelo";

/**
 * OS PASSOS DE «COMO FUNCIONA» — 29-10-2026 (S12). Estavam escritos dentro de
 * `src/app/como-funciona/page.tsx`; vivem aqui para a página e o catálogo da
 * app de cliente (R7) dizerem o mesmo. Os ícones e as cores ficam na página.
 */
type Passo = { passo: string; titulo: string; texto: string };

const PASSOS_DO_MODELO_ANTIGO: ReadonlyArray<Passo> = [
  {
    passo: "01",
    titulo: "Descreve o que precisa",
    texto:
      "No formulário ou por WhatsApp: o que é para levar ou fazer, fotografias, a morada e as condições de acesso — andar, elevador, estacionamento. E escolhe como prefere pagar: pela plataforma ou em dinheiro, ao parceiro.",
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
      `O pedido chega a parceiros que fazem esse serviço e cuja zona alcança a sua morada — sem a morada exacta nem o seu contacto, que só passam depois de escolher. Cada proposta mostra o preço já com a taxa da plataforma e com IVA incluído, e chegam em menos de ${PRAZO_DE_RESPOSTA.porExtenso}. Pode aceitar, contrapropor ou simplesmente não responder.`,
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
      `O parceiro faz o trabalho no dia combinado e marca-o como feito. Confirma na plataforma que ficou feito — no pagamento pela plataforma, só então o valor é entregue ao parceiro. Se não disser nada, o trabalho dá-se por concluído ${DIAS_ATE_LIBERTAR_SOZINHO} dias depois.`,
  },
];

/** Os passos de sempre — para quem os lê antes de 15-11-2026 (d10). */
export const PASSOS_DE_COMO_FUNCIONA: ReadonlyArray<Passo> = PASSOS_DO_MODELO_ANTIGO;

/*
 * DESDE 15-11-2026 (d10): o cliente paga ao parceiro. Mudam o 01 (sem escolher como
 * paga à CLYON), o 03 (a quem se paga) e o 04 (a confirmação já não entrega dinheiro).
 */
const PASSOS_DO_NOVO_MODELO: ReadonlyArray<Passo> = PASSOS_DO_MODELO_ANTIGO.map((p) => {
  if (p.passo === "01")
    return {
      ...p,
      texto:
        "No formulário ou por WhatsApp: o que é para levar ou fazer, fotografias, a morada e as condições de acesso — andar, elevador, estacionamento.",
    };
  if (p.passo === "03") return { ...p, texto: `Aceita a que quiser — ou nenhuma, sem custo. ${comoSePaga(NOVO_MODELO_DESDE)}` };
  if (p.passo === "04")
    return {
      ...p,
      texto: `O parceiro faz o trabalho no dia combinado e marca-o como feito. Confirma na plataforma que ficou feito. Se não disser nada, o trabalho dá-se por concluído ${DIAS_ATE_LIBERTAR_SOZINHO} dias depois.`,
    };
  return p;
});

/** Os passos pela data. */
export function passosDeComoFunciona(agora: Date = new Date()): ReadonlyArray<Passo> {
  return novoModeloEmVigor(agora) ? PASSOS_DO_NOVO_MODELO : PASSOS_DO_MODELO_ANTIGO;
}
