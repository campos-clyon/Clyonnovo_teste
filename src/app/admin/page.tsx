import type { Metadata } from "next";
import LegacyAdminClient from "@/components/admin/LegacyAdminClient";

export const metadata: Metadata = {
  title: "Painel Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <LegacyAdminClient />;
}

export const dynamic = "force-dynamic";
