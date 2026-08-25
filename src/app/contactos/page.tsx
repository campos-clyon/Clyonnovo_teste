import type { Metadata } from "next";
import ContactosClient from "./ContactosClient";

export const metadata: Metadata = {
  title: "Contactos — Orçamento Grátis em 6h | CLYON",
  description:
    "Contacte a CLYON para recolha de móveis, entulho, esvaziamento de casas ou mudanças em Lisboa e Setúbal. Resposta em 6h, orçamento grátis.",
  alternates: { canonical: "https://clyon.pt/contactos" },
  openGraph: {
    title: "Contacte a CLYON — Orçamento Grátis",
    description: "Telefone, WhatsApp ou formulário. Resposta em 6h, sem compromisso.",
    url: "https://clyon.pt/contactos",
  },
};

export const revalidate = 86400;

export default function ContactosPage() {
  return <ContactosClient />;
}
