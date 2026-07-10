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
    name: "Ricardo C.",
    date: "10 de jun. de 2026",
    text: "Estou muito satisfeito com o serviço! Super fácil de simular valores no site, resposta e agendamento super rápidos. Em 1h30m removeram o que já me queria livrar há imenso tempo, de forma profissional, simpática e eficiente. Recomendo a 100%!",
  },
  {
    name: "Stefanie R.",
    date: "10 de mai. de 2026",
    text: "Foram super profissionais! Rápidos a responder, chegaram na hora certinha. O sr. Rodrigo levou tudo num instante, foi rápido e profissional. Recomendo!",
  },
  {
    name: "Fátima C.",
    date: "26 de jun. de 2026",
    text: "Excelente serviço! Rapidez na avaliação e envio de orçamento. A equipa foi muito competente, disciplinada, organizada, eficiente. Muito recomendável.",
  },
  {
    name: "José P.",
    date: "19 de jun. de 2026",
    text: "O vosso serviço não podia ter sido melhor. Os dois funcionários que enviaram foram muito eficientes e dinâmicos para além de simpáticos e muito educados.",
  },
  {
    name: "Paula O.",
    date: "19 de jun. de 2026",
    text: "Serviço perfeito. Rápidos, educados e proativos. Cumpriram com prazo e hora. Recomendo vivamente!",
  },
  {
    name: "Filipe L.",
    date: "10 de mar. de 2026",
    text: "Pessoal super competente e atencioso. Os melhores no ramo. Parabéns pelo profissionalismo.",
  },
  {
    name: "Ana A.",
    date: "10 de jun. de 2026",
    text: "Excelente trabalho. Foram pontuais e simpáticos. Eficientes. Voltarei a contactar.",
  },
  {
    name: "João P. D.",
    date: "10 de mai. de 2026",
    text: "Serviço de qualidade, rápido e seguro. Colaboradores com bom profissionalismo. Recomendo.",
  },
  {
    name: "Maria M. F.",
    date: "10 de mar. de 2026",
    text: "Excelente trabalho! Eficientes e muito cordiais. Gostei muito. Recomendo. Comigo foi uma ótima experiência.",
  },
  {
    name: "Byron S.",
    date: "10 de fev. de 2026",
    text: "Quick and fast service! Rodrigo cleaned the garage in 10 minutes. Appointment was scheduled and they arrived within 24 hours. Very happy with their service.",
  },
  {
    name: "Rui E.",
    date: "26 de jun. de 2026",
    text: "Simpáticos e uma eficiência incrível.",
  },
  {
    name: "Liat M.",
    date: "10 de jun. de 2026",
    text: "Good and responsive service. They handled a few different items in our apartment and did it in an efficient way and finished fast.",
  },
  {
    name: "Joaquim Q.",
    date: "10 de mai. de 2026",
    text: "Equipa impecável. A cumprir e a com brio.",
  },
  {
    name: "João S.",
    date: "10 de abr. de 2026",
    text: "Trabalho e profissionalismo de excelência! Recomendo vivamente esta empresa. Bem haja.",
  },
  {
    name: "Hugo S.",
    date: "10 de abr. de 2026",
    text: "Praticam um serviço competente e com bons preços. Muito satisfeito.",
  },
  {
    name: "Telma O.",
    date: "10 de mar. de 2026",
    text: "Muito profissionais, um ótimo serviço e de confiança.",
  },
  {
    name: "Miguel R.",
    date: "10 de mar. de 2026",
    text: "Excelentes profissionais!!",
  },
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
  {
    name: "Ham J.",
    date: "10 de mar. de 2026",
    text: "Great work! They were a little late due to some issues but the work was spotless. Very happy.",
  },
  {
    name: "Elias O.",
    date: "10 de jun. de 2026",
    text: "Service was quick and efficient. Some hiccups due to a general strike followed by a holiday but communication was good.",
  },
  {
    name: "Jorge S.",
    date: "26 de jun. de 2026",
    text: "Excelente serviço.",
  },
  {
    name: "Nuno A.",
    date: "10 de mar. de 2026",
    text: "Gostámos muito.",
  },
  {
    name: "José C.",
    date: "10 de mar. de 2026",
    text: "Experiência cinco estrelas.",
  },
  {
    name: "Ruben S.",
    date: "10 de fev. de 2026",
    text: "Muito rápido e eficiente.",
  },
];
