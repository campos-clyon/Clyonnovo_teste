/**
 * O ESTADO DA FICHA DO GOOGLE, COMO O PROFISSIONAL O LÊ — 11-11-2026.
 *
 * Um só sítio para os textos: o painel (`FichaNoGoogle.tsx`) e a app Pro
 * (`app-pro/src/app/conta/google.tsx`) mostram as mesmas frases.
 */

export type EstadoDaFicha = "sem_ficha" | "a_espera" | "confirmada" | "confirmada_e_nova_a_espera";

const ESTADOS: Readonly<Record<EstadoDaFicha, string>> = Object.freeze({
  sem_ficha: "Ainda não indicou a sua ficha no Google.",
  a_espera: "À espera de confirmação da CLYON.",
  confirmada: "Confirmada pela CLYON.",
  confirmada_e_nova_a_espera: "A ficha confirmada continua a contar. A nova está à espera de confirmação da CLYON.",
});

export const TEXTOS_DA_FICHA_NO_GOOGLE = Object.freeze({
  titulo: "A minha ficha no Google",
  explicacao:
    "Procure a sua empresa pelo nome, como aparece no Google Maps, e escolha a sua ficha. " +
    "A CLYON confirma que é sua (nome, NIF e morada) antes de a nota do Google aparecer aos clientes, " +
    "ao lado da nota da CLYON e sempre separada dela. Com menos de 5 avaliações no Google, a nota não aparece.",
  procurar: "Procurar no Google",
  rotuloDaProcura: "Nome da empresa no Google",
  escolher: "É esta",
  semResultados: "Não encontrámos nenhuma ficha com esse nome. Experimente o nome com a localidade.",
  enviada: "Ficha enviada. Fica à espera de confirmação da CLYON.",
  estados: ESTADOS,
});

export function estadoDaFicha(f: { placeId: string | null; proposto: string | null } | null): EstadoDaFicha {
  if (!f) return "sem_ficha";
  if (f.placeId && f.proposto) return "confirmada_e_nova_a_espera";
  if (f.placeId) return "confirmada";
  if (f.proposto) return "a_espera";
  return "sem_ficha";
}
