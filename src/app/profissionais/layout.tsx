import type { Metadata, Viewport } from "next";

/**
 * A área do profissional instala-se no telemóvel — sem ser uma app.
 *
 * É um PWA pelo caminho mais curto: um manifest próprio, âmbito limitado a
 * /profissionais, e `display: standalone` — o ícone fica no ecrã inicial e
 * abre o painel a ecrã inteiro, sem barra do browser. Sem loja, sem binário
 * para manter, e sempre na versão do último deploy.
 *
 * O manifest é DESTA área e não do site: instalar "o site CLYON" daria ao
 * profissional um atalho para a homepage de clientes. O âmbito em
 * /profissionais garante que navegar dentro do painel fica dentro da
 * "app", e sair dela abre o browser normal.
 *
 * Sem cache offline de propósito: offline, um painel de trabalhos mentiria
 * — mostrava pedidos velhos como se fossem actuais. (O sw.js que existe é
 * só para Web Push e não intercepta pedidos.) A instalação básica do
 * Chrome e do Safari não exige cache nenhuma.
 *
 * Os cookies são partilhados com o browser: quem já entrou uma vez com o
 * link da chave entra na "app" directamente.
 */

export const metadata: Metadata = {
  manifest: "/app-profissionais.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CLYON Pro",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#00B4CC",
};

export default function ProfissionaisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
