"use client";

import { useState, useEffect } from "react";

// Frases organizadas por categoria
const categories = [
  {
    name: "Móveis",
    phrases: [
      "Retiramos móveis usados, sofás, camas e armários sem complicações.",
      "Recolha de móveis com carregamento, transporte e destino responsável.",
      "Precisa de libertar espaço? A CLYON recolhe os móveis por si.",
    ],
  },
  {
    name: "Esvaziamento",
    phrases: [
      "Esvaziamos casas, apartamentos, arrecadações e garagens com rapidez.",
      "Ideal para mudanças, heranças, imóveis para venda ou fim de arrendamento.",
      "Tratamos da remoção completa para deixar o espaço livre e organizado.",
    ],
  },
  {
    name: "Entulho",
    phrases: [
      "Recolha de entulho de obras, remodelações e limpezas em Lisboa e Setúbal.",
      "Retiramos sacos de entulho, restos de obra e resíduos de construção.",
      "Sem contentores, sem espera: recolha rápida diretamente no local.",
    ],
  },
  {
    name: "Monos",
    phrases: [
      "Recolhemos monos, objetos volumosos e resíduos difíceis de transportar.",
      "Sofás velhos, colchões, móveis partidos e grandes volumes: nós retiramos.",
      "Solução prática para quem precisa limpar o espaço sem esforço.",
    ],
  },
  {
    name: "Limpeza",
    phrases: [
      "Limpeza pós-obra e remoção de resíduos no mesmo serviço.",
      "Deixamos o espaço limpo, livre e pronto para voltar a ser usado.",
      "Limpeza de casas, lojas, garagens e espaços após remoções.",
    ],
  },
];

// Gerar a ordem das frases: frase 1 de cada categoria, depois frase 2, depois frase 3
function generatePhraseOrder(): string[] {
  const order: string[] = [];
  const maxPhrases = Math.max(...categories.map((c) => c.phrases.length));
  
  for (let phraseIndex = 0; phraseIndex < maxPhrases; phraseIndex++) {
    for (const category of categories) {
      if (category.phrases[phraseIndex]) {
        order.push(category.phrases[phraseIndex]);
      }
    }
  }
  
  return order;
}

const phraseOrder = generatePhraseOrder();

export default function RotatingHeroCopy() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      setIsVisible(false);
      
      // After fade out, change phrase and fade in
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % phraseOrder.length);
        setIsVisible(true);
      }, 300);
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className="min-h-[3.25rem] sm:min-h-[2.5rem]"
      aria-live="polite"
      aria-atomic="true"
    >
      <p
        className={`text-[1.0625rem] font-semibold text-cyan-300 leading-relaxed drop-shadow transition-all duration-500 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
        }`}
      >
        {phraseOrder[currentIndex]}
      </p>
    </div>
  );
}
