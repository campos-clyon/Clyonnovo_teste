import type { Metadata } from "next";
import ImageManagerClient from "@/app/colaboradores/admin/ImageManagerClient";

export const metadata: Metadata = {
  title: "Gestor de Imagens",
  robots: { index: false, follow: false },
};

export default function AdminImagesPage() {
  return <ImageManagerClient />;
}

export const dynamic = "force-dynamic";
