"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/**
 * Uma caixa de texto que cresce com o que lá está dentro.
 *
 * O pedido do João Moreira ocupava treze linhas — um esvaziamento de um oitavo
 * andar, com a lista dos móveis item a item. A caixa mostrava duas e escondia
 * as outras onze atrás de uma barra de deslocamento de dois milímetros. Quem
 * regista o pedido não consegue reler o que escreveu, e quem o edita depois não
 * vê sequer o que lá está sem arrastar às cegas.
 *
 * "Deve adaptar ao texto: se o texto é grande ele não deve ocultar partes,
 * deve crescer junto garantindo a leitura total dele."
 *
 * Não tem tecto. Uma descrição comprida faz a caixa ficar comprida e o painel
 * desliza — que é o que se quer. Um máximo em píxeis seria a mesma barra de
 * deslocamento outra vez, só que mais abaixo.
 */
export default function CaixaDeTextoQueCresce({
  value,
  className = "",
  ...resto
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ajustar = () => {
      // Encolher primeiro: sem isto a altura só sabe subir, e apagar texto
      // deixava a caixa grande com um vazio por baixo.
      el.style.height = "auto";
      // A borda, somada à parte. Com `box-sizing: border-box` — que é o que o
      // Tailwind põe em tudo — a altura que se pede JÁ INCLUI a borda, mas o
      // scrollHeight não a conta. Sem esta soma faltavam dois píxeis e a
      // última linha ficava cortada ao meio: quase certo é errado na mesma.
      const borda = el.offsetHeight - el.clientHeight;
      el.style.height = `${el.scrollHeight + borda}px`;
    };

    ajustar();

    // A largura manda no número de linhas: rodar o telemóvel ou abrir o painel
    // ao lado re-parte o texto todo. Sem isto, a caixa ficava com a altura de
    // uma largura que já não existe.
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(ajustar);
    observador.observe(el);
    return () => observador.disconnect();
    // `value` está aqui de propósito: no editor o texto chega DEPOIS da
    // primeira pintura, vindo da base. Sem esta dependência a caixa abria com
    // a altura do vazio e só crescia se lhe tocassem.
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={2}
      // `resize-none`: ela trata da altura sozinha, e a pega do canto só
      // serviria para lutar com ela. `overflow-hidden` tira a barra de
      // deslocamento que já não tem nada para deslocar.
      className={`resize-none overflow-hidden ${className}`}
      {...resto}
    />
  );
}
