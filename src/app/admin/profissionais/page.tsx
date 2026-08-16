import type { Metadata } from "next";
import AdminProfissionaisClient from "./AdminProfissionaisClient";

export const metadata: Metadata = {
  title: "Profissionais — Admin CLYON",
  description: "Aprovar profissionais e confirmar registos de transportador.",
  robots: "noindex,nofollow",
};

export default function AdminProfissionaisPage() {
  return <AdminProfissionaisClient />;
}
