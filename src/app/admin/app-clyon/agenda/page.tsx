import type { Metadata } from "next";
import AgendaClient from "./AgendaClient";

export const metadata: Metadata = {
  title: "App CLYON — Agenda",
  robots: "noindex,nofollow",
};

export default function AgendaPage() {
  return <AgendaClient />;
}
