/**
 * Avaliações reais de clientes. Fonte única partilhada por /avaliacoes e pela
 * homepage — evita arrays duplicados a divergir entre si.
 */
export interface Review {
  name: string;
  date: string;
  text: string;
}

export const reviews: Review[] = [
  {
    name: "Carlos F.",
    date: "22 de nov. de 2025",
    text: "Excelente trabalho de toda a equipa, muito profissionais e extremamente simpáticos. Fizeram um ótimo serviço e deixaram tudo limpo.",
  },
  {
    name: "Inês A.",
    date: "20 de nov. de 2025",
    text: "Serviço rápido, comunicação clara e ótima relação qualidade-preço. Tudo removido em poucas horas.",
  },
  {
    name: "Maria T.",
    date: "27 de nov. de 2025",
    text: "Muito eficientes, pontuais e cuidadosos. Ficámos muito satisfeitos com a recolha e com a limpeza final.",
  },
  {
    name: "Christian M.",
    date: "10 de nov. de 2025",
    text: "Responderam rápido, vieram no mesmo dia e resolveram tudo com profissionalismo. Recomendo sem hesitar.",
  },
  {
    name: "Patrícia S.",
    date: "8 de nov. de 2025",
    text: "Equipa simpática, processo simples e preço transparente. Foi tudo resolvido sem stress.",
  },
  {
    name: "Ana F.",
    date: "8 de nov. de 2025",
    text: "Experiência muito positiva. Organização, rapidez e cuidado com o espaço do início ao fim.",
  },
];
