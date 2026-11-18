"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * OS BLOCOS QUE SE ABREM POR OPÇÃO — 18-11-2026 («mesa-so-pedidos-vivos»).
 *
 * *«A Mesa deve ficar organizada em botões que se abrem por opção, para o ecrã
 * ficar arrumado.»* Cada bloco nasce FECHADO; o que a pessoa abre fica
 * lembrado neste navegador (localStorage), e só aqui — é uma comodidade de
 * quem vê, não um dado da equipa. Sem localStorage (janela privada, dados
 * bloqueados), tudo continua a funcionar: nasce fechado e lembra-se enquanto a
 * página estiver aberta.
 */
export function useAbertosLembrados(chaveDoNavegador: string) {
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(() => new Set());

  // Lido depois de montar: o primeiro desenho é igual no servidor e no navegador.
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(chaveDoNavegador);
      const lista = guardado ? (JSON.parse(guardado) as unknown) : null;
      if (Array.isArray(lista)) setAbertos(new Set(lista.filter((x): x is string => typeof x === "string")));
    } catch {
      /* sem o que estava guardado, tudo nasce fechado */
    }
  }, [chaveDoNavegador]);

  const alternar = useCallback(
    (bloco: string) => {
      setAbertos((antes) => {
        const novo = new Set(antes);
        if (novo.has(bloco)) novo.delete(bloco);
        else novo.add(bloco);
        try {
          window.localStorage.setItem(chaveDoNavegador, JSON.stringify([...novo]));
        } catch {
          /* não se lembra, mas abre e fecha na mesma */
        }
        return novo;
      });
    },
    [chaveDoNavegador],
  );

  const aberto = useCallback((bloco: string) => abertos.has(bloco), [abertos]);

  return { aberto, alternar };
}
