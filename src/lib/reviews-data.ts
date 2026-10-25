/**
 * Avaliações reais de clientes. Fonte única partilhada por /avaliacoes e pela
 * homepage — evita arrays duplicados a divergir entre si.
 *
 * SÓ MÊS E ANO (14-10-2026). As datas tinham dia, e 19 das 29 caíam no dia
 * 10: foram escritas a 10-07-2026 a partir de «há 1 mês», «há 3 meses» — o
 * dia era o da cópia, não o da avaliação. O que se sabe é o mês.
 *
 * A DA PAULA, COMO ELA A ESCREVEU (25-10-2026). Estava «proativos… prazo e
 * hora… Recomendo vivamente!», que não é o que está no perfil do Google.
 * Passa a ser a frase de lá, palavra por palavra, só com o primeiro nome.
 */
export interface Review {
  name: string;
  date: string;
  text: string;
}

export const reviews: Review[] = [
  {
    name: "Ricardo C.",
    date: "junho de 2026",
    text: "Estou muito satisfeito com o serviço! Super fácil de simular valores no site, resposta e agendamento super rápidos. Em 1h30m removeram o que já me queria livrar há imenso tempo, de forma profissional, simpática e eficiente. Recomendo a 100%!",
  },
  {
    name: "Stefanie R.",
    date: "maio de 2026",
    text: "Foram super profissionais! Rápidos a responder, chegaram na hora certinha. O sr. Rodrigo levou tudo num instante, foi rápido e profissional. Recomendo!",
  },
  {
    name: "Fátima C.",
    date: "junho de 2026",
    text: "Excelente serviço! Rapidez na avaliação e envio de orçamento. A equipa foi muito competente, disciplinada, organizada, eficiente. Muito recomendável.",
  },
  {
    name: "José P.",
    date: "junho de 2026",
    text: "O vosso serviço não podia ter sido melhor. Os dois funcionários que enviaram foram muito eficientes e dinâmicos para além de simpáticos e muito educados.",
  },
  {
    name: "Paula",
    date: "junho de 2026",
    text: "Serviço perfeito. Rápidos, educados e prestáveis. Cumpriram com prazos e horas.",
  },
  {
    name: "Filipe L.",
    date: "março de 2026",
    text: "Pessoal super competente e atencioso. Os melhores no ramo. Parabéns pelo profissionalismo.",
  },
  {
    name: "Ana A.",
    date: "junho de 2026",
    text: "Excelente trabalho. Foram pontuais e simpáticos. Eficientes. Voltarei a contactar.",
  },
  {
    name: "João P. D.",
    date: "maio de 2026",
    text: "Serviço de qualidade, rápido e seguro. Colaboradores com bom profissionalismo. Recomendo.",
  },
  {
    name: "Maria M. F.",
    date: "março de 2026",
    text: "Excelente trabalho! Eficientes e muito cordiais. Gostei muito. Recomendo. Comigo foi uma ótima experiência.",
  },
  {
    name: "Byron S.",
    date: "fevereiro de 2026",
    text: "Quick and fast service! Rodrigo cleaned the garage in 10 minutes. Appointment was scheduled and they arrived within 24 hours. Very happy with their service.",
  },
  {
    name: "Rui E.",
    date: "junho de 2026",
    text: "Simpáticos e uma eficiência incrível.",
  },
  {
    name: "Liat M.",
    date: "junho de 2026",
    text: "Good and responsive service. They handled a few different items in our apartment and did it in an efficient way and finished fast.",
  },
  {
    name: "Joaquim Q.",
    date: "maio de 2026",
    text: "Equipa impecável. A cumprir e a com brio.",
  },
  {
    name: "João S.",
    date: "abril de 2026",
    text: "Trabalho e profissionalismo de excelência! Recomendo vivamente esta empresa. Bem haja.",
  },
  {
    name: "Hugo S.",
    date: "abril de 2026",
    text: "Praticam um serviço competente e com bons preços. Muito satisfeito.",
  },
  {
    name: "Telma O.",
    date: "março de 2026",
    text: "Muito profissionais, um ótimo serviço e de confiança.",
  },
  {
    name: "Miguel R.",
    date: "março de 2026",
    text: "Excelentes profissionais!!",
  },
  {
    name: "Carlos F.",
    date: "novembro de 2025",
    text: "Excelente trabalho de toda a equipa, muito profissionais e extremamente simpáticos. Fizeram um ótimo serviço e deixaram tudo limpo.",
  },
  {
    name: "Inês A.",
    date: "novembro de 2025",
    text: "Serviço rápido, comunicação clara e ótima relação qualidade-preço. Tudo removido em poucas horas.",
  },
  {
    name: "Maria T.",
    date: "novembro de 2025",
    text: "Muito eficientes, pontuais e cuidadosos. Ficámos muito satisfeitos com a recolha e com a limpeza final.",
  },
  {
    name: "Christian M.",
    date: "novembro de 2025",
    text: "Responderam rápido, vieram no mesmo dia e resolveram tudo com profissionalismo. Recomendo sem hesitar.",
  },
  {
    name: "Patrícia S.",
    date: "novembro de 2025",
    text: "Equipa simpática, processo simples e preço transparente. Foi tudo resolvido sem stress.",
  },
  {
    name: "Ana F.",
    date: "novembro de 2025",
    text: "Experiência muito positiva. Organização, rapidez e cuidado com o espaço do início ao fim.",
  },
  {
    name: "Ham J.",
    date: "março de 2026",
    text: "Great work! They were a little late due to some issues but the work was spotless. Very happy.",
  },
  {
    name: "Elias O.",
    date: "junho de 2026",
    text: "Service was quick and efficient. Some hiccups due to a general strike followed by a holiday but communication was good.",
  },
  {
    name: "Jorge S.",
    date: "junho de 2026",
    text: "Excelente serviço.",
  },
  {
    name: "Nuno A.",
    date: "março de 2026",
    text: "Gostámos muito.",
  },
  {
    name: "José C.",
    date: "março de 2026",
    text: "Experiência cinco estrelas.",
  },
  {
    name: "Ruben S.",
    date: "fevereiro de 2026",
    text: "Muito rápido e eficiente.",
  },
];
