import type { Metadata } from "next";
import AdesaoDaApp, { type TextosDaAdesao } from "@/components/AdesaoDaApp";
import { APP_PRO_NA_PLAY, LINK_DO_TESTE_DA_APP_PRO } from "@/lib/links-da-app";
import { TEXTO_DE_ESPERA_DO_TESTE } from "@/lib/lista-da-play-e-o-profissional";

/**
 * /app-pro — A ADESÃO À CLYON PRO EM QUATRO PASSOS (17-11-2026, d61).
 *
 * O link que se manda a um profissional convidado para o teste da app. Antes
 * mandava-se a /quero-ser-parceiro, que tem muito texto, a conta de cliente no
 * topo e o formulário no fim: uma empresa de mudanças criou uma conta de
 * cliente por engano. Aqui não há cabeçalho nem rodapé do site (SiteChrome,
 * BARE_ROUTES), nem a conta de cliente: só os quatro passos.
 *
 * Fora do Google: é um passo de quem já foi convidado, não uma página de
 * entrada.
 *
 * 18-11-2026 (d6): o passo 3 confere o Gmail com a última lista da Play colada
 * no backoffice. Enquanto não está nela, espera (e avisamos quando estiver);
 * já não se manda carregar e «tentar mais tarde». O passo 2 tem o
 * «Candidate-se» para quem ainda não tem conta.
 */

export const metadata: Metadata = {
  title: { absolute: "Instalar a CLYON Pro — CLYON" },
  description: "Os quatro passos para instalar a app CLYON Pro no telemóvel Android.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/app-pro" },
};

const TEXTOS: TextosDaAdesao = {
  tituloDaLista: "Instalar a CLYON Pro em 4 passos",
  passos: [
    {
      titulo: "A app CLYON Pro é para profissionais",
      frases: [
        "Os pedidos novos chegam ao telemóvel e responde ali mesmo, com o seu preço.",
        "Por agora só existe para Android.",
      ],
    },
    {
      titulo: "O Gmail do seu telemóvel",
      frases: ["A Google Play só deixa entrar no teste a conta Google que está no seu telemóvel. Escreva esse Gmail."],
    },
    {
      titulo: "Toque em «Tornar-me testador»",
      frases: [
        "Abra a ligação no telemóvel, com esse Gmail, e toque em «Tornar-me testador».",
        "Se a página disser que não tem acesso, o Gmail ainda não está na lista: entre com a sua conta, deixe-nos o Gmail e avisamos quando estiver.",
      ],
    },
    {
      titulo: "Instale e entre com a sua conta de profissional",
      frases: [
        "Instale a CLYON Pro pela Play Store.",
        "Entre com o mesmo email e a mesma palavra-passe do painel.",
      ],
    },
  ],
  outraApp: { texto: "É cliente? A app para clientes é outra.", rotulo: "Ver a app de cliente", href: "/app-cliente" },
  gmail: {
    rotulo: "Gmail do telemóvel",
    avisoNaoGmail:
      "Este email não é Gmail. A Google Play só reconhece a conta Google do telemóvel (Definições › Google): sem ela, o teste não abre.",
    semSessao: "Para guardarmos o Gmail, entre primeiro com a sua conta de profissional.",
    entrar: { rotulo: "Entrar e voltar a este passo", href: "/profissionais/entrar?destino=%2Fapp-pro%3Fpasso%3D2" },
    semConta: { texto: "Ainda não tem conta de profissional?", rotulo: "Candidate-se", href: "/quero-ser-parceiro#candidatura" },
    guardado: "Gmail guardado. Vamos pô-lo na lista do teste.",
  },
  teste: {
    botao: "Abrir a ligação do teste",
    espera: {
      titulo: "O seu Gmail está a caminho da lista",
      frases: [
        TEXTO_DE_ESPERA_DO_TESTE,
        "Pode fechar esta página: o aviso chega por email e, se tiver os avisos ligados, ao telemóvel.",
      ],
    },
    pode: {
      titulo: "Toque em «Tornar-me testador»",
      frases: ["O seu Gmail já está na lista. Abra a ligação no telemóvel, com esse Gmail, e toque em «Tornar-me testador»."],
    },
  },
  loja: {
    botao: "Abrir na Play Store",
    depois: { texto: "Ainda não tem conta de profissional?", rotulo: "Candidate-se", href: "/quero-ser-parceiro#candidatura" },
  },
  saberMais: [
    "Com a app, cada pedido novo chega como notificação, mesmo com o browser fechado.",
    "Sem a app, faz tudo no painel, no browser do telemóvel. A app ainda não existe para iPhone.",
  ],
};

export default function AppProPage() {
  return (
    <div className="min-h-[100dvh] bg-white">
      <AdesaoDaApp tipo="pro" linkDoTeste={LINK_DO_TESTE_DA_APP_PRO} linkDaLoja={APP_PRO_NA_PLAY} textos={TEXTOS} />
    </div>
  );
}
