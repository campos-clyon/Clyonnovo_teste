import type { Metadata } from "next";
import ImageManagerClient from "@/components/admin/ImageManagerClient";

export const metadata: Metadata = {
  title: "Gestor de Imagens",
  robots: { index: false, follow: false },
};

export default function AdminImagesPage() {
  return <ImageManagerClient />;
}

export const dynamic = "force-dynamic";
