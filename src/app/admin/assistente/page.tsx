import type { Metadata } from "next";
import LegacyAdminClient from "@/components/admin/LegacyAdminClient";

export const metadata: Metadata = {
  title: "Painel do Assistente",
  robots: { index: false, follow: false },
};

/**
 * O painel do assistente.
 *
 * É o MESMO componente do painel do administrador, em modo "assistente": a
 * barra lateral mostra só as cinco secções dele e o endereço é outro, para o
 * middleware o distinguir sem abrir a página. Duas versões do painel eram
 * duas versões da mesma lógica a divergir; o que difere é a lista de
 * permissões, e essa vive num sítio só.
 */
export default function PainelDoAssistentePage() {
  return <LegacyAdminClient papel="assistente" />;
}

export const dynamic = "force-dynamic";
