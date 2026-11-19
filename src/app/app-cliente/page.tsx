import type { Metadata } from "next";
import AdesaoDaApp, { type TextosDaAdesao } from "@/components/AdesaoDaApp";
import { APP_CLIENTE_NA_PLAY, LINK_DO_TESTE_DA_APP_CLIENTE } from "@/lib/links-da-app";
import { linkDeAdesaoGuardado } from "@/lib/convite-app-cliente-na-base";
import { TEXTOS_DO_CONVITE_NO_SITE } from "@/lib/programa-da-app";

/**
 * /app-cliente — A ADESÃO À APP DE CLIENTE EM QUATRO PASSOS (17-11-2026, d61).
 *
 * O mesmo componente da /app-pro, com o que o cliente lê («parceiro», e o
 * programa de acesso antecipado). Não cria conta: quem não tem sessão é
 * mandado entrar, e a criação de conta fica onde sempre esteve (/entrar).
 *
 * O link de adesão é o que o backoffice guarda (Configs → «Link do programa
 * da app»); sem ele, o formato da Play para o pacote da app.
 */

export const metadata: Metadata = {
  title: { absolute: "Instalar a app CLYON — CLYON" },
  description: "Os quatro passos para instalar a app CLYON no telemóvel Android e acompanhar os seus pedidos.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/app-cliente" },
};

export const revalidate = 3600;

const TEXTOS: TextosDaAdesao = {
  tituloDaLista: "Instalar a app CLYON em 4 passos",
  passos: [
    {
      titulo: "A app CLYON é para clientes",
      frases: [
        "Peça, acompanhe e pague os seus pedidos no telemóvel, e fale com o parceiro.",
        "Por agora só existe para Android.",
      ],
    },
    {
      titulo: "O Gmail do seu telemóvel",
      frases: [
        "A Google Play só dá acesso antecipado à conta Google que está no seu telemóvel. Escreva esse Gmail.",
      ],
    },
    {
      titulo: "Toque em «Tornar-me testador»",
      frases: [
        "Abra a ligação no telemóvel, com esse Gmail, e toque em «Tornar-me testador».",
        "Se a página disser que não tem acesso, o Gmail ainda não está na lista: tente outra vez mais tarde.",
      ],
    },
    {
      titulo: "Instale e entre na sua conta",
      frases: [
        "Instale a app CLYON pela Play Store.",
        "Entre com o email da sua conta CLYON: com a palavra-passe, com o Google ou com uma ligação por email.",
      ],
    },
  ],
  outraApp: {
    texto: "Trabalha com a CLYON como parceiro? A sua app é outra.",
    rotulo: "Ver a CLYON Pro",
    href: "/app-pro",
  },
  gmail: {
    rotulo: TEXTOS_DO_CONVITE_NO_SITE.rotuloDoEmail,
    avisoNaoGmail:
      "Este email não é Gmail. A Google Play só reconhece a conta Google do telemóvel (Definições › Google): sem ela, a app não abre.",
    semSessao: "Para guardarmos o Gmail, entre primeiro na sua conta CLYON e volte a este link.",
    entrar: { rotulo: "Entrar na minha conta", href: "/entrar" },
    guardado: "Gmail guardado. Vamos pô-lo na lista do acesso antecipado.",
    consentimento: TEXTOS_DO_CONVITE_NO_SITE.consentimento,
  },
  teste: { botao: "Abrir a ligação de adesão" },
  loja: { botao: "Abrir na Play Store" },
  saberMais: [
    "É um programa de acesso antecipado: experimenta a app antes de todos. Pode sair quando quiser, na sua conta, em Segurança.",
    "Sem a app, faz tudo no site, na sua conta. A app ainda não existe para iPhone.",
  ],
};

async function linkDeAdesao(): Promise<string> {
  try {
    return (await linkDeAdesaoGuardado()) ?? LINK_DO_TESTE_DA_APP_CLIENTE;
  } catch {
    return LINK_DO_TESTE_DA_APP_CLIENTE;
  }
}

export default async function AppClientePage() {
  const link = await linkDeAdesao();
  return (
    <div className="min-h-[100dvh] bg-white">
      <AdesaoDaApp tipo="cliente" linkDoTeste={link} linkDaLoja={APP_CLIENTE_NA_PLAY} textos={TEXTOS} />
    </div>
  );
}
